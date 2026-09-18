#!/usr/bin/env node

import {
  acknowledgeRequirement,
  addRequirement,
  findChangedRequirements,
  initializeRepository,
} from "./repository.js";
import { runExecutableRequirements } from "./executable-requirements.js";
import {
  acknowledgeCompiledRequirement,
  findChangedCompiledRequirements,
  readArtifactGherkin,
} from "./compiled-context.js";

try {
  await run({ arguments: process.argv.slice(2), projectDirectory: process.cwd() });
} catch (error) {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
}

async function run({
  arguments: arguments_,
  projectDirectory,
}: {
  arguments: string[];
  projectDirectory: string;
}) {
  const [command, ...commandArguments] = arguments_;

  switch (command) {
    case "init":
      requireNoArguments({ command, commandArguments });
      await initializeRepository({ projectDirectory });
      return;
    case "add":
      await runAdd({ commandArguments, projectDirectory });
      return;
    case "check":
      requireNoArguments({ command, commandArguments });
      await runCheck({ projectDirectory });
      return;
    case "acknowledge":
      await runAcknowledge({ commandArguments, projectDirectory });
      return;
    case "test":
      requireNoArguments({ command, commandArguments });
      await runTests({ projectDirectory });
      return;
    case "context":
      await runContext({ commandArguments, projectDirectory });
      return;
    default:
      throw new Error("Usage: tonic <init|add|check|acknowledge|test|context>");
  }
}

async function runAdd({
  commandArguments,
  projectDirectory,
}: {
  commandArguments: string[];
  projectDirectory: string;
}) {
  const [requirementId, ...options] = commandArguments;

  if (!requirementId) {
    throw new Error(
      "Usage: tonic add <requirement-id> --source <path> --affects <path>",
    );
  }

  const { affectedPaths, sourcePath } = parseAddOptions(options);
  await addRequirement({
    affectedPaths,
    projectDirectory,
    requirementId,
    sourcePath,
  });
}

async function runCheck({ projectDirectory }: { projectDirectory: string }) {
  const [configuredChanges, compiledChanges] = await Promise.all([
    findChangedRequirements({ projectDirectory }),
    findChangedCompiledRequirements({ projectDirectory }),
  ]);
  const changes = mergeChanges([...configuredChanges, ...compiledChanges]);

  for (const change of changes) {
    process.stdout.write(
      `${change.id} changed.\nReconsider:\n${change.affects
        .map((path) => `- ${path}`)
        .join("\n")}\n`,
    );
  }

  if (changes.length > 0) {
    process.exitCode = 1;
  }
}

async function runContext({
  commandArguments,
  projectDirectory,
}: {
  commandArguments: string[];
  projectDirectory: string;
}) {
  const [artifact, ...remainingArguments] = commandArguments;

  if (!artifact || remainingArguments.length > 0) {
    throw new Error("Usage: tonic context <artifact>");
  }

  const sources = await readArtifactGherkin({ artifact, projectDirectory });
  for (const source of sources) {
    process.stdout.write(`${source.content.trim()}\n`);
  }
}

async function runAcknowledge({
  commandArguments,
  projectDirectory,
}: {
  commandArguments: string[];
  projectDirectory: string;
}) {
  const [requirementId, ...remainingArguments] = commandArguments;

  if (!requirementId || remainingArguments.length > 0) {
    throw new Error("Usage: tonic acknowledge <requirement-id>");
  }

  const [configured, compiled] = await Promise.all([
    acknowledgeRequirement({ projectDirectory, requirementId }),
    acknowledgeCompiledRequirement({ projectDirectory, requirementId }),
  ]);

  if (!configured && !compiled) {
    throw new Error(`Requirement ${requirementId} is not configured or compiled`);
  }
}

async function runTests({ projectDirectory }: { projectDirectory: string }) {
  const success = await runExecutableRequirements({ projectDirectory });

  if (!success) {
    process.exitCode = 1;
  }
}

function parseAddOptions(options: string[]) {
  let sourcePath: string | undefined;
  const affectedPaths: string[] = [];

  for (let index = 0; index < options.length; index += 2) {
    const option = options[index];
    const value = options[index + 1];

    if (!value) {
      throw new Error(`${option} requires a path`);
    }

    if (option === "--source" && !sourcePath) {
      sourcePath = value;
      continue;
    }

    if (option === "--affects") {
      affectedPaths.push(value);
      continue;
    }

    throw new Error(`Unknown or repeated option ${option}`);
  }

  if (!sourcePath || affectedPaths.length === 0) {
    throw new Error(
      "Usage: tonic add <requirement-id> --source <path> --affects <path>",
    );
  }

  return { affectedPaths, sourcePath };
}

function requireNoArguments({
  command,
  commandArguments,
}: {
  command: string;
  commandArguments: string[];
}) {
  if (commandArguments.length > 0) {
    throw new Error(`tonic ${command} does not accept arguments`);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mergeChanges(changes: Array<{ affects: string[]; id: string }>) {
  const merged = new Map<string, Set<string>>();

  for (const change of changes) {
    const affectedPaths = merged.get(change.id) ?? new Set<string>();
    for (const path of change.affects) {
      affectedPaths.add(path);
    }
    merged.set(change.id, affectedPaths);
  }

  return [...merged.entries()].map(([id, affects]) => ({
    affects: [...affects].sort(),
    id,
  }));
}
