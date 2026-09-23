import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { glob } from "glob";
import type { DecisionAst } from "./decision-model.js";
import { parseDecision } from "./decision-parser.js";
import { requirementIds } from "./gherkin-requirements.js";
import { readConfiguration } from "./repository.js";

type KnowledgeSource = {
  content: string;
  uri: string;
};

type RequirementSource = KnowledgeSource & {
  id: string;
};

type DecisionSource = KnowledgeSource & {
  decision: DecisionAst;
};

export type AffectedDecision = {
  decision: DecisionSource;
  requirement: RequirementSource;
};

const defaultFeaturePaths = ["features/**/*.feature"];
const executeFile = promisify(execFile);

export async function findDecisionsAffectedByWorkingTreeChanges({
  projectDirectory,
}: {
  projectDirectory: string;
}): Promise<AffectedDecision[]> {
  const decisions = await discoverDecisions({ projectDirectory });
  if (decisions.length === 0) {
    return [];
  }

  const requirements = await discoverRequirements({ projectDirectory });
  requireResolvedDrivers({ decisions, requirements });

  const changedUris = new Set(
    await changedWorkingTreeUris({ projectDirectory }),
  );
  const changedRequirements = new Map(
    requirements
      .filter(({ uri }) => changedUris.has(uri))
      .map((requirement) => [requirement.id, requirement]),
  );

  return decisions
    .flatMap((decision) =>
      decision.decision.drivers
        .filter(({ kind }) => kind === "requirement")
        .map(({ id }) => changedRequirements.get(id))
        .filter((requirement): requirement is RequirementSource =>
          Boolean(requirement),
        )
        .map((requirement) => ({ decision, requirement })),
    )
    .sort(compareAffectedDecisions);
}

async function discoverDecisions({
  projectDirectory,
}: {
  projectDirectory: string;
}): Promise<DecisionSource[]> {
  const uris = await glob("**/*.decision", {
    cwd: projectDirectory,
    ignore: [".git/**", ".tonic/**", "node_modules/**"],
    nodir: true,
  });
  const decisions = await Promise.all(
    uris.sort().map(async (uri) => {
      const content = await readFile(join(projectDirectory, uri), "utf8");
      return { content, decision: parseDecision(content), uri };
    }),
  );
  requireUniqueDecisions(decisions);
  return decisions;
}

async function discoverRequirements({
  projectDirectory,
}: {
  projectDirectory: string;
}): Promise<RequirementSource[]> {
  const configuration = await readConfiguration({ projectDirectory });
  const patterns = configuration.cucumber?.features ?? defaultFeaturePaths;
  const uris = await glob(patterns, { cwd: projectDirectory, nodir: true });
  const sources = await Promise.all(
    uris.sort().map(async (uri) => {
      const content = await readFile(join(projectDirectory, uri), "utf8");
      return { content, ids: requirementIds({ content, uri }), uri };
    }),
  );
  const requirements = sources.flatMap(({ content, ids, uri }) =>
    ids.map((id) => ({ content, id, uri })),
  );
  requireUniqueRequirements(requirements);
  return requirements;
}

async function changedWorkingTreeUris({
  projectDirectory,
}: {
  projectDirectory: string;
}): Promise<string[]> {
  try {
    const { stdout } = await executeFile(
      "git",
      ["diff", "--name-only", "--relative", "-z", "HEAD", "--"],
      { cwd: projectDirectory, encoding: "utf8" },
    );
    return stdout.split("\0").filter(Boolean);
  } catch (error) {
    throw new Error(
      `Cannot inspect changed requirements: ${errorMessage(error)}`,
    );
  }
}

function requireResolvedDrivers({
  decisions,
  requirements,
}: {
  decisions: DecisionSource[];
  requirements: RequirementSource[];
}): void {
  const requirementIds = new Set(requirements.map(({ id }) => id));
  for (const { decision, uri } of decisions) {
    for (const driver of decision.drivers) {
      if (driver.kind === "requirement" && !requirementIds.has(driver.id)) {
        throw new Error(
          `Decision ${decision.id} in ${uri} references unknown requirement ${driver.id}`,
        );
      }
    }
  }
}

function requireUniqueDecisions(decisions: DecisionSource[]): void {
  requireUniqueIds({
    entries: decisions.map(({ decision, uri }) => ({ id: decision.id, uri })),
    kind: "decision",
  });
}

function requireUniqueRequirements(requirements: RequirementSource[]): void {
  requireUniqueIds({
    entries: requirements.map(({ id, uri }) => ({ id, uri })),
    kind: "requirement",
  });
}

function requireUniqueIds({
  entries,
  kind,
}: {
  entries: Array<{ id: string; uri: string }>;
  kind: string;
}): void {
  const sources = new Map<string, string>();
  for (const { id, uri } of entries) {
    const existing = sources.get(id);
    if (existing && existing !== uri) {
      throw new Error(`Duplicate ${kind} ID ${id}: ${existing}, ${uri}`);
    }
    sources.set(id, uri);
  }
}

function compareAffectedDecisions(
  left: AffectedDecision,
  right: AffectedDecision,
): number {
  return (
    left.requirement.id.localeCompare(right.requirement.id) ||
    left.decision.decision.id.localeCompare(right.decision.decision.id)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
