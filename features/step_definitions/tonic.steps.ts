import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
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
  cucumber?: { features: string[]; steps: string[] };
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

Given(
  "a project with legacy manual relationship configuration",
  async function (this: TonicWorld) {
    this.projectDirectory = await mkdtemp(join(tmpdir(), "tonic-acceptance-"));
    await writeJson(join(this.projectDirectory, "tonic.json"), {
      requirements: {
        "PAY-001": {
          affects: ["src/payment.ts"],
          source: "features/PAY-001.feature",
        },
      },
      version: 1,
    });
  },
);

Given(
  "requirement {string} has changed",
  async function (this: TonicWorld, requirementId: string) {
    const path = `features/${requirementId}.feature`;
    const existing = await readFile(join(this.projectDirectory, path), "utf8");
    await writeProjectFile({
      content: existing.replace(originalRequirement.trim(), changedRequirement.trim()),
      projectDirectory: this.projectDirectory,
      relativePath: path,
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

Given(
  "a passing executable requirement in the default feature directory",
  async function (this: TonicWorld) {
    await linkTonicPackage({ projectDirectory: this.projectDirectory });
    await writeExecutableRequirement({
      featureDirectory: "features",
      passing: true,
      projectDirectory: this.projectDirectory,
      stepsDirectory: "features/step_definitions",
    });
  },
);

Given(
  "a failing executable requirement in the default feature directory",
  async function (this: TonicWorld) {
    await linkTonicPackage({ projectDirectory: this.projectDirectory });
    await writeExecutableRequirement({
      featureDirectory: "features",
      passing: false,
      projectDirectory: this.projectDirectory,
      stepsDirectory: "features/step_definitions",
    });
  },
);

Given(
  "Tonic is configured to find features in {string} and steps in {string}",
  async function (
    this: TonicWorld,
    featureDirectory: string,
    stepsDirectory: string,
  ) {
    const configuration: TonicConfiguration = {
      cucumber: {
        features: [`${featureDirectory}/**/*.feature`],
        steps: [`${stepsDirectory}/**/*.ts`],
      },
      version: 1,
    };
    await writeJson(join(this.projectDirectory, "tonic.json"), configuration);
  },
);

Given(
  "a passing executable requirement exists in the configured directories",
  async function (this: TonicWorld) {
    await linkTonicPackage({ projectDirectory: this.projectDirectory });
    await writeExecutableRequirement({
      featureDirectory: "specifications",
      passing: true,
      projectDirectory: this.projectDirectory,
      stepsDirectory: "specifications/support",
    });
  },
);

Given(
  "executable requirement {string} exercises {string}",
  async function (this: TonicWorld, requirementId: string, artifactPath: string) {
    await linkTonicPackage({ projectDirectory: this.projectDirectory });
    await writeProjectFile({
      content: [
        `@${requirementId}`,
        "Feature: Take a payment",
        "  Scenario: Complete an accepted payment",
        "    When the customer pays 10 pounds",
        "    Then the payment is accepted",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: `features/${requirementId}.feature`,
    });
    await writeProjectFile({
      content: [
        "export function takePayment(amount: number) {",
        '  return amount > 0 ? "accepted" : "declined";',
        "}",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: artifactPath,
    });
    await writeProjectFile({
      content: [
        "export function recordPayment() {",
        '  return "recorded";',
        "}",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "src/payment-audit.ts",
    });
    await writeProjectFile({
      content: [
        'import assert from "node:assert/strict";',
        'import { When, Then } from "tonic/cucumber";',
        'import { takePayment } from "../../src/payment.ts";',
        'import { recordPayment } from "../../src/payment-audit.ts";',
        "",
        "void recordPayment;",
        'let result = "";',
        "",
        'When("the customer pays 10 pounds", function () {',
        "  result = takePayment(10);",
        "});",
        "",
        'Then("the payment is accepted", function () {',
        '  assert.equal(result, "accepted");',
        "});",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "features/step_definitions/payment.steps.ts",
    });
  },
);

Given(
  "an executable requirement uses aliases from {string}",
  async function (this: TonicWorld, configurationFile: string) {
    await linkTonicPackage({ projectDirectory: this.projectDirectory });
    await writeJson(join(this.projectDirectory, configurationFile), {
      compilerOptions: {
        baseUrl: ".",
        module: "ESNext",
        moduleResolution: "Bundler",
        paths: { "@payments/*": ["src/*"] },
        target: "ES2022",
      },
    });
    await writeProjectFile({
      content: [
        "@PAY-001",
        "Feature: Take a payment",
        "  Scenario: Accept a valid payment",
        "    When the customer pays",
        "    Then the payment is accepted",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "features/PAY-001.feature",
    });
    await writeProjectFile({
      content: [
        "export function takePayment() {",
        '  return "accepted";',
        "}",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "src/payment.ts",
    });
    await writeProjectFile({
      content: [
        'import assert from "node:assert/strict";',
        'import { Then, When } from "tonic/cucumber";',
        'import { takePayment } from "@payments/payment.ts";',
        "",
        'let result = "";',
        "",
        'When("the customer pays", function () {',
        "  result = takePayment();",
        "});",
        "",
        'Then("the payment is accepted", function () {',
        '  assert.equal(result, "accepted");',
        "});",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "features/step_definitions/payment.steps.ts",
    });
  },
);

Given(
  "an executable requirement exists without step definitions",
  async function (this: TonicWorld) {
    await writeProjectFile({
      content: [
        "@PAY-001",
        "Feature: Take a payment",
        "  Scenario: Accept a valid payment",
        "    When the customer pays",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "features/PAY-001.feature",
    });
  },
);

Given(
  "an executable requirement dynamically imports {string} with a query",
  async function (this: TonicWorld, artifactPath: string) {
    await linkTonicPackage({ projectDirectory: this.projectDirectory });
    await writeProjectFile({
      content: [
        "@PAY-001",
        "Feature: Take a payment",
        "  Scenario: Accept a valid payment",
        "    When the customer pays through a dynamic module",
        "    Then the dynamic payment is accepted",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "features/PAY-001.feature",
    });
    await writeProjectFile({
      content: [
        "export function takePayment() {",
        '  return "accepted";',
        "}",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: artifactPath,
    });
    await writeProjectFile({
      content: [
        'import assert from "node:assert/strict";',
        'import { Then, When } from "tonic/cucumber";',
        "",
        'let result = "";',
        "",
        'When("the customer pays through a dynamic module", async function () {',
        '  const payment = await import("../../src/payment.ts?scenario=payment");',
        "  result = payment.takePayment();",
        "});",
        "",
        'Then("the dynamic payment is accepted", function () {',
        '  assert.equal(result, "accepted");',
        "});",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "features/step_definitions/payment.steps.ts",
    });
  },
);

Given(
  "requirement ID {string} appears in two executable feature files",
  async function (this: TonicWorld, requirementId: string) {
    await linkTonicPackage({ projectDirectory: this.projectDirectory });
    for (const featureName of ["first-payment", "second-payment"]) {
      await writeProjectFile({
        content: [
          `@${requirementId}`,
          `Feature: ${featureName}`,
          "  Scenario: Accept a valid payment",
          "    When the customer pays 10 pounds",
          "    Then the payment is accepted",
          "",
        ].join("\n"),
        projectDirectory: this.projectDirectory,
        relativePath: `features/${featureName}.feature`,
      });
    }
    await writeProjectFile({
      content: [
        "export function takePayment(amount: number) {",
        '  return amount > 0 ? "accepted" : "declined";',
        "}",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "src/payment.ts",
    });
    await writeProjectFile({
      content: [
        'import assert from "node:assert/strict";',
        'import { Then, When } from "tonic/cucumber";',
        'import { takePayment } from "../../src/payment.ts";',
        "",
        'let result = "";',
        "",
        'When("the customer pays 10 pounds", function () {',
        "  result = takePayment(10);",
        "});",
        "",
        'Then("the payment is accepted", function () {',
        '  assert.equal(result, "accepted");',
        "});",
        "",
      ].join("\n"),
      projectDirectory: this.projectDirectory,
      relativePath: "features/step_definitions/payment.steps.ts",
    });
  },
);

Given(
  "malformed compiled context exists for {string}",
  async function (this: TonicWorld, artifactPath: string) {
    await writeProjectFile({
      content: JSON.stringify(
        {
          artifact: artifactPath,
          requirements: "not-an-array",
          version: 1,
        },
        null,
        2,
      ),
      projectDirectory: this.projectDirectory,
      relativePath: `.tonic/compiled/${artifactPath}.json`,
    });
  },
);

Then(
  "the command returns the current Gherkin for requirement {string}",
  async function (this: TonicWorld, requirementId: string) {
    const source = `features/${requirementId}.feature`;
    const feature = await readFile(join(this.projectDirectory, source), "utf8");
    assert.ok(commandOutput(this).includes(feature.trim()));
  },
);

Then("no legacy Tonic files are created", async function (this: TonicWorld) {
  await assert.rejects(access(join(this.projectDirectory, "tonic.json")));
  await assert.rejects(access(join(this.projectDirectory, "tonic.lock")));
});

Then("the command reports only the supported commands", function (this: TonicWorld) {
  assert.match(
    commandOutput(this),
    /Usage: tonic <test\|context\|check\|acknowledge>/,
  );
});

Then("the command reports invalid Tonic configuration", function (this: TonicWorld) {
  assert.match(commandOutput(this), /Invalid Tonic configuration/);
});

Then(
  "the command reports no compiled context for {string}",
  function (this: TonicWorld, artifactPath: string) {
    assert.match(
      commandOutput(this),
      new RegExp(`No compiled context for ${artifactPath}`),
    );
  },
);

Then(
  "the command reports that no executable requirements matched",
  function (this: TonicWorld) {
    assert.match(commandOutput(this), /No executable requirements matched/);
  },
);

Then(
  "the command reports that no step definitions matched",
  function (this: TonicWorld) {
    assert.match(commandOutput(this), /No step definitions matched/);
  },
);

Then(
  "the command warns that dynamic module coverage may be unreliable",
  function (this: TonicWorld) {
    assert.match(
      commandOutput(this),
      /Dynamic module coverage may be unreliable/,
    );
  },
);

Then(
  "the command reports duplicate requirement ID {string}",
  function (this: TonicWorld, requirementId: string) {
    assert.match(
      commandOutput(this),
      new RegExp(`Duplicate requirement ID ${requirementId}`),
    );
  },
);

Then(
  "the command reports invalid compiled context",
  function (this: TonicWorld) {
    assert.match(commandOutput(this), /Invalid compiled context/);
  },
);

Then("the executable requirement ran", async function (this: TonicWorld) {
  assert.equal(
    await readFile(join(this.projectDirectory, "requirement-ran.txt"), "utf8"),
    "yes\n",
  );
});

Then(
  "the command reports that the executable requirement failed",
  function (this: TonicWorld) {
    assert.match(commandOutput(this), /the requirement is satisfied/);
  },
);

After(async function (this: TonicWorld) {
  if (this.projectDirectory) {
    await rm(this.projectDirectory, { force: true, recursive: true });
  }
});

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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function linkTonicPackage({
  projectDirectory,
}: {
  projectDirectory: string;
}) {
  const nodeModulesDirectory = join(projectDirectory, "node_modules");
  await mkdir(nodeModulesDirectory, { recursive: true });
  await symlink(resolve("."), join(nodeModulesDirectory, "tonic"), "dir");
}

async function writeExecutableRequirement({
  featureDirectory,
  passing,
  projectDirectory,
  stepsDirectory,
}: {
  featureDirectory: string;
  passing: boolean;
  projectDirectory: string;
  stepsDirectory: string;
}) {
  await writeProjectFile({
    content: [
      "Feature: Execute a requirement",
      "  Scenario: Run through bundled Cucumber",
      "    Given the bundled runner is available",
      "    Then the requirement is satisfied",
      "",
    ].join("\n"),
    projectDirectory,
    relativePath: `${featureDirectory}/example.feature`,
  });
  await writeProjectFile({
    content: [
      'import assert from "node:assert/strict";',
      'import { writeFile } from "node:fs/promises";',
      'import { Given, Then } from "tonic/cucumber";',
      "",
      "let runnerAvailable: boolean = false;",
      "",
      'Given("the bundled runner is available", function () {',
      "  runnerAvailable = true;",
      "});",
      "",
      'Then("the requirement is satisfied", async function () {',
      `  assert.equal(runnerAvailable, ${passing});`,
      '  await writeFile("requirement-ran.txt", "yes\\n", "utf8");',
      "});",
      "",
    ].join("\n"),
    projectDirectory,
    relativePath: `${stepsDirectory}/example.steps.ts`,
  });
}
