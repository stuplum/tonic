import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import {
  collectExecutedArtifacts,
  compileFeatureExecutions,
} from "./compiled-context.js";
import { readConfiguration } from "./repository.js";

const defaultFeaturePaths = ["features/**/*.feature"];
const defaultStepPaths = ["features/step_definitions/**/*.ts"];

export async function runExecutableRequirements({
  projectDirectory,
}: {
  projectDirectory: string;
}) {
  const configuration = await readConfiguration({ projectDirectory });
  const featurePaths = configuration.cucumber?.features ?? defaultFeaturePaths;
  const stepPaths = configuration.cucumber?.steps ?? defaultStepPaths;
  const [featureFiles, stepFiles] = await Promise.all([
    glob(featurePaths, { cwd: projectDirectory, nodir: true }),
    glob(stepPaths, { cwd: projectDirectory, nodir: true }),
  ]);
  const cucumberArguments = stepPaths.flatMap((path) => ["--import", path]);
  const executions = [];

  for (const source of featureFiles.sort()) {
    const baselineCoverageDirectory = await mkdtemp(join(tmpdir(), "tonic-baseline-"));
    const coverageDirectory = await mkdtemp(join(tmpdir(), "tonic-coverage-"));

    try {
      const baselineExitCode = await runCucumberProcess({
        arguments: ["--dry-run", ...cucumberArguments, source],
        coverageDirectory: baselineCoverageDirectory,
        projectDirectory,
        silent: true,
      });
      if (baselineExitCode !== 0) {
        return false;
      }

      const exitCode = await runCucumberProcess({
        arguments: [...cucumberArguments, source],
        coverageDirectory,
        projectDirectory,
        silent: false,
      });

      if (exitCode !== 0) {
        return false;
      }

      executions.push({
        artifacts: await collectExecutedArtifacts({
          baselineCoverageDirectory,
          coverageDirectory,
          projectDirectory,
          stepFiles,
        }),
        source,
      });
    } finally {
      await Promise.all([
        rm(baselineCoverageDirectory, { force: true, recursive: true }),
        rm(coverageDirectory, { force: true, recursive: true }),
      ]);
    }
  }

  await compileFeatureExecutions({ executions, projectDirectory });
  return true;
}

async function runCucumberProcess({
  arguments: arguments_,
  coverageDirectory,
  projectDirectory,
  silent,
}: {
  arguments: string[];
  coverageDirectory: string;
  projectDirectory: string;
  silent: boolean;
}) {
  const cucumberPackageUrl = import.meta.resolve(
    "@cucumber/cucumber/package.json",
  );
  const cucumberCliPath = fileURLToPath(
    new URL("./bin/cucumber.js", cucumberPackageUrl),
  );
  const tsxLoaderUrl = import.meta.resolve("tsx");

  return new Promise<number>((resolve, reject) => {
    const cucumber = spawn(
      process.execPath,
      ["--import", tsxLoaderUrl, cucumberCliPath, ...arguments_],
      {
        cwd: projectDirectory,
        env: { ...process.env, NODE_V8_COVERAGE: coverageDirectory },
        stdio: silent ? "ignore" : "inherit",
      },
    );

    cucumber.on("error", reject);
    cucumber.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Cucumber stopped after receiving ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}
