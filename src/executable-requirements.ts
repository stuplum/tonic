import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
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
  const cucumberArguments = stepPaths.flatMap((path) => ["--import", path]);
  const exitCode = await runCucumberProcess({
    arguments: [...cucumberArguments, ...featurePaths],
    projectDirectory,
  });

  return exitCode === 0;
}

async function runCucumberProcess({
  arguments: arguments_,
  projectDirectory,
}: {
  arguments: string[];
  projectDirectory: string;
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
        stdio: "inherit",
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
