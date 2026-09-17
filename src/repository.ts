import { access, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { calculateFingerprint } from "./fingerprint.js";
import type {
  ChangedRequirement,
  RequirementLink,
  TonicConfiguration,
  TonicLock,
} from "./model.js";

const configurationFileName = "tonic.json";
const lockFileName = "tonic.lock";

export async function initializeRepository({
  projectDirectory,
}: {
  projectDirectory: string;
}) {
  await ensureFileDoesNotExist({ projectDirectory, relativePath: configurationFileName });
  await ensureFileDoesNotExist({ projectDirectory, relativePath: lockFileName });
  await writeConfiguration({
    configuration: { requirements: {}, version: 1 },
    projectDirectory,
  });
  await writeLock({
    lock: { requirements: {}, version: 1 },
    projectDirectory,
  });
}

export async function addRequirement({
  affectedPaths,
  projectDirectory,
  requirementId,
  sourcePath,
}: {
  affectedPaths: string[];
  projectDirectory: string;
  requirementId: string;
  sourcePath: string;
}) {
  if (affectedPaths.length === 0) {
    throw new Error("At least one affected artifact is required");
  }

  await ensureProjectFileExists({ projectDirectory, relativePath: sourcePath });
  await Promise.all(
    affectedPaths.map((relativePath) =>
      ensureProjectFileExists({ projectDirectory, relativePath }),
    ),
  );

  const [configuration, lock, fingerprint] = await Promise.all([
    readConfiguration({ projectDirectory }),
    readLock({ projectDirectory }),
    fingerprintProjectFile({ projectDirectory, relativePath: sourcePath }),
  ]);

  if (configuration.requirements[requirementId]) {
    throw new Error(`Requirement ${requirementId} already exists`);
  }

  configuration.requirements[requirementId] = {
    affects: [...affectedPaths],
    source: sourcePath,
  };
  lock.requirements[requirementId] = { fingerprint };

  await Promise.all([
    writeConfiguration({ configuration, projectDirectory }),
    writeLock({ lock, projectDirectory }),
  ]);
}

export async function findChangedRequirements({
  projectDirectory,
}: {
  projectDirectory: string;
}): Promise<ChangedRequirement[]> {
  const [configuration, lock] = await Promise.all([
    readConfiguration({ projectDirectory }),
    readLock({ projectDirectory }),
  ]);
  const changes = await Promise.all(
    Object.entries(configuration.requirements).map(
      async ([requirementId, requirement]) => {
        await validateRequirementLink({ projectDirectory, requirement });
        const recordedVersion = lock.requirements[requirementId];

        if (!recordedVersion) {
          throw new Error(`Requirement ${requirementId} has no recorded fingerprint`);
        }

        const currentFingerprint = await fingerprintProjectFile({
          projectDirectory,
          relativePath: requirement.source,
        });

        if (currentFingerprint === recordedVersion.fingerprint) {
          return undefined;
        }

        return {
          affects: [...requirement.affects],
          id: requirementId,
        };
      },
    ),
  );

  return changes.filter(
    (change): change is ChangedRequirement => change !== undefined,
  );
}

export async function acknowledgeRequirement({
  projectDirectory,
  requirementId,
}: {
  projectDirectory: string;
  requirementId: string;
}) {
  const [configuration, lock] = await Promise.all([
    readConfiguration({ projectDirectory }),
    readLock({ projectDirectory }),
  ]);
  const requirement = configuration.requirements[requirementId];

  if (!requirement) {
    throw new Error(`Requirement ${requirementId} is not configured`);
  }

  await validateRequirementLink({ projectDirectory, requirement });
  lock.requirements[requirementId] = {
    fingerprint: await fingerprintProjectFile({
      projectDirectory,
      relativePath: requirement.source,
    }),
  };
  await writeLock({ lock, projectDirectory });
}

async function validateRequirementLink({
  projectDirectory,
  requirement,
}: {
  projectDirectory: string;
  requirement: RequirementLink;
}) {
  await ensureProjectFileExists({
    projectDirectory,
    relativePath: requirement.source,
  });
  await Promise.all(
    requirement.affects.map((relativePath) =>
      ensureProjectFileExists({ projectDirectory, relativePath }),
    ),
  );
}

async function fingerprintProjectFile({
  projectDirectory,
  relativePath,
}: {
  projectDirectory: string;
  relativePath: string;
}) {
  const content = await readFile(
    resolveProjectPath({ projectDirectory, relativePath }),
    "utf8",
  );
  return calculateFingerprint(content);
}

async function readConfiguration({
  projectDirectory,
}: {
  projectDirectory: string;
}) {
  return readJson<TonicConfiguration>({
    projectDirectory,
    relativePath: configurationFileName,
  });
}

async function readLock({ projectDirectory }: { projectDirectory: string }) {
  return readJson<TonicLock>({
    projectDirectory,
    relativePath: lockFileName,
  });
}

async function readJson<T>({
  projectDirectory,
  relativePath,
}: {
  projectDirectory: string;
  relativePath: string;
}) {
  const content = await readFile(
    resolveProjectPath({ projectDirectory, relativePath }),
    "utf8",
  );
  return JSON.parse(content) as T;
}

async function writeConfiguration({
  configuration,
  projectDirectory,
}: {
  configuration: TonicConfiguration;
  projectDirectory: string;
}) {
  await writeJson({
    projectDirectory,
    relativePath: configurationFileName,
    value: configuration,
  });
}

async function writeLock({
  lock,
  projectDirectory,
}: {
  lock: TonicLock;
  projectDirectory: string;
}) {
  await writeJson({
    projectDirectory,
    relativePath: lockFileName,
    value: lock,
  });
}

async function writeJson({
  projectDirectory,
  relativePath,
  value,
}: {
  projectDirectory: string;
  relativePath: string;
  value: unknown;
}) {
  await writeFile(
    resolveProjectPath({ projectDirectory, relativePath }),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

async function ensureProjectFileExists({
  projectDirectory,
  relativePath,
}: {
  projectDirectory: string;
  relativePath: string;
}) {
  try {
    await access(resolveProjectPath({ projectDirectory, relativePath }));
  } catch {
    throw new Error(`${relativePath} does not exist`);
  }
}

async function ensureFileDoesNotExist({
  projectDirectory,
  relativePath,
}: {
  projectDirectory: string;
  relativePath: string;
}) {
  try {
    await access(resolveProjectPath({ projectDirectory, relativePath }));
  } catch {
    return;
  }

  throw new Error(`${relativePath} already exists`);
}

function resolveProjectPath({
  projectDirectory,
  relativePath,
}: {
  projectDirectory: string;
  relativePath: string;
}) {
  if (isAbsolute(relativePath)) {
    throw new Error(`${relativePath} must be relative to the project`);
  }

  const resolvedProjectDirectory = resolve(projectDirectory);
  const resolvedPath = resolve(join(resolvedProjectDirectory, relativePath));

  if (relative(resolvedProjectDirectory, resolvedPath).startsWith("..")) {
    throw new Error(`${relativePath} must be inside the project`);
  }

  return resolvedPath;
}
