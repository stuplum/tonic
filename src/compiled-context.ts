import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { calculateFingerprint } from "./fingerprint.js";

type RequirementContext = {
  fingerprint: string;
  id: string;
  source: string;
};

type ArtifactContext = {
  artifact: string;
  requirements: RequirementContext[];
  version: 1;
};

type FeatureExecution = {
  artifacts: string[];
  source: string;
};

type CoverageFile = {
  result: Array<{
    functions: Array<{
      functionName: string;
      ranges: Array<{
        count: number;
        endOffset: number;
        startOffset: number;
      }>;
    }>;
    url: string;
  }>;
};

const compiledDirectory = ".tonic/compiled";
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

export async function compileFeatureExecutions({
  executions,
  projectDirectory,
}: {
  executions: FeatureExecution[];
  projectDirectory: string;
}) {
  const existingContexts = await readAllContexts({ projectDirectory });
  const verifiedFingerprints = new Map<string, string>();
  for (const context of existingContexts) {
    for (const requirement of context.requirements) {
      verifiedFingerprints.set(requirement.id, requirement.fingerprint);
    }
  }

  const contexts = new Map<string, Map<string, RequirementContext>>();

  for (const execution of executions) {
    const feature = await readFile(
      resolveProjectPath({
        projectDirectory,
        relativePath: execution.source,
      }),
      "utf8",
    );
    const fingerprint = calculateFingerprint(feature);
    const requirements = requirementIds(feature).map((id) => ({
      fingerprint: verifiedFingerprints.get(id) ?? fingerprint,
      id,
      source: execution.source,
    }));

    if (requirements.length === 0) {
      continue;
    }

    for (const artifact of execution.artifacts) {
      const artifactRequirements = contexts.get(artifact) ?? new Map();
      for (const requirement of requirements) {
        artifactRequirements.set(requirement.id, requirement);
      }
      contexts.set(artifact, artifactRequirements);
    }
  }

  const directory = resolveProjectPath({
    projectDirectory,
    relativePath: compiledDirectory,
  });
  await rm(directory, { force: true, recursive: true });

  await Promise.all(
    [...contexts.entries()].map(async ([artifact, requirements]) => {
      const path = join(directory, `${artifact}.json`);
      const context: ArtifactContext = {
        artifact,
        requirements: [...requirements.values()].sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
        version: 1,
      };
      await writeContext({ context, path });
    }),
  );
}

export async function acknowledgeCompiledRequirement({
  projectDirectory,
  requirementId,
}: {
  projectDirectory: string;
  requirementId: string;
}) {
  const contexts = await readAllContexts({ projectDirectory });
  const fingerprints = new Map<string, string>();
  let acknowledged = false;

  await Promise.all(
    contexts.map(async (context) => {
      if (
        !context.requirements.some(
          (requirement) => requirement.id === requirementId,
        )
      ) {
        return;
      }

      acknowledged = true;
      context.requirements = await Promise.all(
        context.requirements.map(async (requirement) =>
          requirement.id === requirementId
            ? {
                ...requirement,
                fingerprint: await currentFingerprint({
                  fingerprints,
                  projectDirectory,
                  source: requirement.source,
                }),
              }
            : requirement,
        ),
      );
      await writeContext({
        context,
        path: resolveProjectPath({
          projectDirectory,
          relativePath: `${compiledDirectory}/${context.artifact}.json`,
        }),
      });
    }),
  );

  return acknowledged;
}

export async function collectExecutedArtifacts({
  baselineCoverageDirectory,
  coverageDirectory,
  projectDirectory,
  stepFiles,
}: {
  baselineCoverageDirectory: string;
  coverageDirectory: string;
  projectDirectory: string;
  stepFiles: string[];
}) {
  const [baseline, coverageFiles, resolvedProjectDirectory, resolvedStepFiles] =
    await Promise.all([
      readCoverageCounts(baselineCoverageDirectory),
      readCoverageFiles(coverageDirectory),
      realpath(projectDirectory),
      Promise.all(
        stepFiles.map((path) => realpath(resolve(projectDirectory, path))),
      ),
    ]);
  const steps = new Set(resolvedStepFiles);
  const artifacts = new Set<string>();

  for (const coverage of coverageFiles) {
    for (const script of coverage.result) {
      if (!script.url.startsWith("file:")) {
        continue;
      }

      const path = await resolveCoveredFile(script.url);
      if (
        !path ||
        steps.has(path) ||
        !isProjectSource({ path, resolvedProjectDirectory })
      ) {
        continue;
      }

      const source = await readFile(path, "utf8");
      const executedFunctions = executedFunctionsBeyondBaseline(script, baseline);
      if (
        !executedFunctions.some((name) => sourceDefinesFunction({ name, source }))
      ) {
        continue;
      }

      artifacts.add(normalizePath(relative(resolvedProjectDirectory, path)));
    }
  }

  return [...artifacts].sort();
}

export async function findChangedCompiledRequirements({
  projectDirectory,
}: {
  projectDirectory: string;
}) {
  const contexts = await readAllContexts({ projectDirectory });
  const changes = new Map<string, { affects: Set<string>; id: string }>();
  const fingerprints = new Map<string, string>();

  for (const context of contexts) {
    for (const requirement of context.requirements) {
      const fingerprint = await currentFingerprint({
        fingerprints,
        projectDirectory,
        source: requirement.source,
      });
      if (fingerprint === requirement.fingerprint) {
        continue;
      }

      const change = changes.get(requirement.id) ?? {
        affects: new Set<string>(),
        id: requirement.id,
      };
      change.affects.add(context.artifact);
      changes.set(requirement.id, change);
    }
  }

  return [...changes.values()].map((change) => ({
    affects: [...change.affects].sort(),
    id: change.id,
  }));
}

export async function readArtifactGherkin({
  artifact,
  projectDirectory,
}: {
  artifact: string;
  projectDirectory: string;
}) {
  const context = await readContext({ artifact, projectDirectory });
  const sources = [
    ...new Set(context.requirements.map((requirement) => requirement.source)),
  ].sort();
  return Promise.all(
    sources.map(async (source) => ({
      content: await readFile(
        resolveProjectPath({ projectDirectory, relativePath: source }),
        "utf8",
      ),
      source,
    })),
  );
}

async function readAllContexts({ projectDirectory }: { projectDirectory: string }) {
  const paths = await glob(`${compiledDirectory}/**/*.json`, {
    absolute: true,
    cwd: projectDirectory,
    nodir: true,
  });
  return Promise.all(
    paths.sort().map(async (path) =>
      JSON.parse(await readFile(path, "utf8")) as ArtifactContext,
    ),
  );
}

async function currentFingerprint({
  fingerprints,
  projectDirectory,
  source,
}: {
  fingerprints: Map<string, string>;
  projectDirectory: string;
  source: string;
}) {
  const existing = fingerprints.get(source);
  if (existing) {
    return existing;
  }

  const feature = await readFile(
    resolveProjectPath({ projectDirectory, relativePath: source }),
    "utf8",
  );
  const fingerprint = calculateFingerprint(feature);
  fingerprints.set(source, fingerprint);
  return fingerprint;
}

async function readContext({
  artifact,
  projectDirectory,
}: {
  artifact: string;
  projectDirectory: string;
}) {
  const path = resolveProjectPath({
    projectDirectory,
    relativePath: `${compiledDirectory}/${artifact}.json`,
  });

  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(`No compiled context for ${artifact}`);
    }
    throw error;
  }

  return JSON.parse(content) as ArtifactContext;
}

async function writeContext({
  context,
  path,
}: {
  context: ArtifactContext;
  path: string;
}) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(context, null, 2)}\n`, "utf8");
}

function requirementIds(feature: string) {
  return [...feature.matchAll(/(?:^|\s)@([A-Z][A-Z0-9]*-\d+)\b/g)].map(
    (match) => match[1],
  );
}

async function readCoverageFiles(directory: string) {
  const paths = await glob("*.json", {
    absolute: true,
    cwd: directory,
    nodir: true,
  });
  return Promise.all(
    paths.map(
      async (path) =>
        JSON.parse(await readFile(path, "utf8")) as CoverageFile,
    ),
  );
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readCoverageCounts(directory: string) {
  const coverageFiles = await readCoverageFiles(directory);
  const counts = new Map<string, number>();

  for (const coverage of coverageFiles) {
    for (const script of coverage.result) {
      for (const fn of script.functions) {
        for (const range of fn.ranges) {
          const key = coverageRangeKey({ range, url: script.url });
          counts.set(key, (counts.get(key) ?? 0) + range.count);
        }
      }
    }
  }

  return counts;
}

function executedFunctionsBeyondBaseline(
  script: CoverageFile["result"][number],
  baseline: Map<string, number>,
) {
  return script.functions
    .filter(
      (fn) =>
        fn.ranges.some(
          (range) =>
            range.count >
            (baseline.get(coverageRangeKey({ range, url: script.url })) ?? 0),
        ),
    )
    .map((fn) => fn.functionName);
}

function coverageRangeKey({
  range,
  url,
}: {
  range: { endOffset: number; startOffset: number };
  url: string;
}) {
  return `${url}:${range.startOffset}:${range.endOffset}`;
}

async function resolveCoveredFile(url: string) {
  try {
    const path = fileURLToPath(url);
    const queryIndex = path.indexOf("?");
    return await realpath(queryIndex === -1 ? path : path.slice(0, queryIndex));
  } catch {
    return undefined;
  }
}

function sourceDefinesFunction({ name, source }: { name: string; source: string }) {
  if (name === "") {
    return true;
  }

  if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
    return false;
  }

  return new RegExp(`\\b${escapeRegex(name)}\\b`).test(source);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isProjectSource({
  path,
  resolvedProjectDirectory,
}: {
  path: string;
  resolvedProjectDirectory: string;
}) {
  const relativePath = relative(resolvedProjectDirectory, path);
  const segments = normalizePath(relativePath).split("/");
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !segments.includes("node_modules") &&
    segments[0] !== ".tonic" &&
    sourceExtensions.has(extname(path))
  );
}

function resolveProjectPath({
  projectDirectory,
  relativePath,
}: {
  projectDirectory: string;
  relativePath: string;
}) {
  const directory = resolve(projectDirectory);
  const path = resolve(directory, relativePath);

  if (relative(directory, path).startsWith("..")) {
    throw new Error(`${relativePath} must be inside the project`);
  }

  return path;
}

function normalizePath(path: string) {
  return path.split("\\").join("/");
}
