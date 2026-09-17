import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  After,
  Given,
  Then,
  When,
  setWorldConstructor,
  type IWorldOptions,
} from "@cucumber/cucumber";

const cliPath = resolve("dist/cli.js");
const originalRequirement = "Feature: Take a payment\n";
const changedRequirement = "Feature: Take independent payments\n";

type TonicConfiguration = {
  requirements: Record<
    string,
    {
      affects: string[];
      source: string;
    }
  >;
  version: 1;
};

type TonicLock = {
  requirements: Record<string, { fingerprint: string }>;
  version: 1;
};

class TonicWorld {
  projectDirectory = "";
  result?: SpawnSyncReturns<string>;

  constructor(_options: IWorldOptions) {}
}

setWorldConstructor(TonicWorld);

Given("an empty project", async function (this: TonicWorld) {
  this.projectDirectory = await mkdtemp(join(tmpdir(), "tonic-acceptance-"));
});

Given("an initialised project", async function (this: TonicWorld) {
  this.projectDirectory = await mkdtemp(join(tmpdir(), "tonic-acceptance-"));
  await writeJson(join(this.projectDirectory, "tonic.json"), emptyConfiguration());
  await writeJson(join(this.projectDirectory, "tonic.lock"), emptyLock());
});

Given(
  "requirement {string} is defined in {string}",
  async function (this: TonicWorld, _requirementId: string, source: string) {
    await writeProjectFile({
      content: originalRequirement,
      projectDirectory: this.projectDirectory,
      relativePath: source,
    });
  },
);

Given(
  "artifact {string} exists",
  async function (this: TonicWorld, relativePath: string) {
    await writeProjectFile({
      content: "export {};\n",
      projectDirectory: this.projectDirectory,
      relativePath,
    });
  },
);

Given(
  "requirement {string} is linked to {string}",
  async function (this: TonicWorld, requirementId: string, affectedPath: string) {
    this.projectDirectory = await mkdtemp(join(tmpdir(), "tonic-acceptance-"));
    const source = `features/${requirementId}.feature`;
    await writeProjectFile({
      content: originalRequirement,
      projectDirectory: this.projectDirectory,
      relativePath: source,
    });
    await writeProjectFile({
      content: "export {};\n",
      projectDirectory: this.projectDirectory,
      relativePath: affectedPath,
    });
    await writeJson(join(this.projectDirectory, "tonic.json"), {
      requirements: {
        [requirementId]: {
          affects: [affectedPath],
          source,
        },
      },
      version: 1,
    } satisfies TonicConfiguration);
    await writeJson(join(this.projectDirectory, "tonic.lock"), {
      requirements: {
        [requirementId]: {
          fingerprint: fingerprint(originalRequirement),
        },
      },
      version: 1,
    } satisfies TonicLock);
  },
);

Given(
  "requirement {string} has changed",
  async function (this: TonicWorld, requirementId: string) {
    await writeProjectFile({
      content: changedRequirement,
      projectDirectory: this.projectDirectory,
      relativePath: `features/${requirementId}.feature`,
    });
  },
);

When("I run {string}", function (this: TonicWorld, command: string) {
  const [, ...arguments_] = splitCommand(command);
  this.result = spawnSync(process.execPath, [cliPath, ...arguments_], {
    cwd: this.projectDirectory,
    encoding: "utf8",
  });
});

Then("the command succeeds", function (this: TonicWorld) {
  assert.equal(commandResult(this).status, 0, commandOutput(this));
});

Then("the command fails", function (this: TonicWorld) {
  assert.notEqual(commandResult(this).status, 0);
});

Then(
  "the project contains an empty Tonic configuration",
  async function (this: TonicWorld) {
    assert.deepEqual(await readJson(join(this.projectDirectory, "tonic.json")), emptyConfiguration());
  },
);

Then(
  "the project contains an empty Tonic lock file",
  async function (this: TonicWorld) {
    assert.deepEqual(await readJson(join(this.projectDirectory, "tonic.lock")), emptyLock());
  },
);

Then(
  "the configuration links requirement {string} to {string}",
  async function (this: TonicWorld, requirementId: string, affectedPath: string) {
    const configuration = (await readJson(
      join(this.projectDirectory, "tonic.json"),
    )) as TonicConfiguration;
    assert.deepEqual(configuration.requirements[requirementId], {
      affects: [affectedPath],
      source: `features/${requirementId}.feature`,
    });
  },
);

Then(
  "the current fingerprint of {string} is recorded",
  async function (this: TonicWorld, requirementId: string) {
    const lock = (await readJson(join(this.projectDirectory, "tonic.lock"))) as TonicLock;
    const configuration = (await readJson(
      join(this.projectDirectory, "tonic.json"),
    )) as TonicConfiguration;
    const source = configuration.requirements[requirementId]?.source;
    assert.ok(source, `Requirement ${requirementId} is not configured`);
    const content = await readFile(join(this.projectDirectory, source), "utf8");
    assert.equal(lock.requirements[requirementId]?.fingerprint, fingerprint(content));
  },
);

Then("the command produces no output", function (this: TonicWorld) {
  assert.equal(commandOutput(this), "");
});

Then(
  "the command reports that {string} changed",
  function (this: TonicWorld, requirementId: string) {
    assert.match(commandOutput(this), new RegExp(`${requirementId} changed`));
  },
);

Then(
  "the command reports {string} for reconsideration",
  function (this: TonicWorld, affectedPath: string) {
    assert.match(commandOutput(this), new RegExp(`Reconsider:.*${escapeRegex(affectedPath)}`, "s"));
  },
);

Then(
  "the command reports that {string} does not exist",
  function (this: TonicWorld, relativePath: string) {
    assert.match(commandOutput(this), new RegExp(`${escapeRegex(relativePath)} does not exist`));
  },
);

After(async function (this: TonicWorld) {
  if (this.projectDirectory) {
    await rm(this.projectDirectory, { force: true, recursive: true });
  }
});

function emptyConfiguration(): TonicConfiguration {
  return { requirements: {}, version: 1 };
}

function emptyLock(): TonicLock {
  return { requirements: {}, version: 1 };
}

function fingerprint(content: string) {
  const normalizedContent = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  return `sha256:${createHash("sha256").update(normalizedContent, "utf8").digest("hex")}`;
}

function splitCommand(command: string) {
  return command.split(" ");
}

function commandResult(world: TonicWorld) {
  assert.ok(world.result, "No command has been run");
  return world.result;
}

function commandOutput(world: TonicWorld) {
  const result = commandResult(world);
  return `${result.stdout}${result.stderr}`.trim();
}

async function writeProjectFile({
  content,
  projectDirectory,
  relativePath,
}: {
  content: string;
  projectDirectory: string;
  relativePath: string;
}) {
  const path = join(projectDirectory, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
