#!/usr/bin/env node

import { runExecutableRequirements } from "./executable-requirements.js";
import {
  acknowledgeCompiledRequirement,
  findChangedCompiledRequirements,
  readArtifactGherkin,
} from "./compiled-context.js";
import {
  findDecisionsAffectedByWorkingTreeChanges,
  type AffectedDecision,
} from "./decision-awareness.js";

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
    case "test":
      requireNoArguments({ command, commandArguments });
      await runTests({ projectDirectory });
      return;
    case "context":
      await runContext({ commandArguments, projectDirectory });
      return;
    case "check":
      requireNoArguments({ command, commandArguments });
      await runCheck({ projectDirectory });
      return;
    case "acknowledge":
      await runAcknowledge({ commandArguments, projectDirectory });
      return;
    default:
      throw new Error("Usage: tonic <test|context|check|acknowledge>");
  }
}

async function runCheck({ projectDirectory }: { projectDirectory: string }) {
  const [changes, affectedDecisions] = await Promise.all([
    findChangedCompiledRequirements({ projectDirectory }),
    findDecisionsAffectedByWorkingTreeChanges({ projectDirectory }),
  ]);

  for (const change of changes) {
    process.stdout.write(
      `${change.id} changed.\nReconsider:\n${change.affects
        .map((path) => `- ${path}`)
        .join("\n")}\n`,
    );
  }

  for (const affected of affectedDecisions) {
    writeAffectedDecision(affected);
  }

  if (changes.length > 0 || affectedDecisions.length > 0) {
    process.exitCode = 1;
  }
}

function writeAffectedDecision({
  decision,
  requirement,
}: AffectedDecision): void {
  process.stdout.write(
    [
      `Reconsider decision ${decision.decision.id}: ${decision.decision.title}`,
      `Driven by changed requirement ${requirement.id}`,
      "",
      `Requirement source: ${requirement.uri}`,
      requirement.content.trim(),
      "",
      `Decision source: ${decision.uri}`,
      decision.content.trim(),
      "",
    ].join("\n"),
  );
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
  if (sources.length === 0) {
    process.stdout.write(`No compiled context for ${artifact}\n`);
    return;
  }
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

  const acknowledged = await acknowledgeCompiledRequirement({
    projectDirectory,
    requirementId,
  });

  if (!acknowledged) {
    throw new Error(`Requirement ${requirementId} is not compiled`);
  }
}

async function runTests({ projectDirectory }: { projectDirectory: string }) {
  const success = await runExecutableRequirements({ projectDirectory });

  if (!success) {
    process.exitCode = 1;
  }
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
