import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const mode = process.argv[2];
const releaseVersion = process.argv[3] ?? process.env.OBSERVA_WEB_RELEASE_VERSION ?? "^0.1.9";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.join(root, "frontend");
const localPackage = path.join(root, "packages", "observa-web");
const devPackages = path.join(root, ".dev-packages");
const npm = "npm";

if (!["dev", "release"].includes(mode)) {
  console.error("Usage: node scripts/switch-observa-web-package.mjs <dev|release> [release-version]");
  process.exit(1);
}

function run(args, cwd) {
  if (!attempt(args, cwd)) process.exit(1);
}

function attempt(args, cwd) {
  const result = spawnSync(npm, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) {
    console.error(result.error.message);
    return false;
  }
  return result.status === 0;
}

function runJson(args, cwd) {
  const result = spawnSync(npm, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}

if (mode === "dev") {
  run(["run", "build"], localPackage);
  rmSync(devPackages, { recursive: true, force: true });
  mkdirSync(devPackages, { recursive: true });
  const [packed] = runJson(["pack", localPackage, "--json", "--pack-destination", devPackages], root);
  run(["install", "--force", "--save", `@mutiur03/observa-web@file:../.dev-packages/${packed.filename}`], frontend);
  console.log(`Observa web package mode: dev (packed local packages/observa-web as ${packed.filename})`);
} else {
  const install = ["install", "--save", `@mutiur03/observa-web@${releaseVersion}`];
  if (!attempt(install, frontend)) {
    console.warn("Registry install failed. Trying npm cache offline.");
    run(["install", "--offline", "--save", `@mutiur03/observa-web@${releaseVersion}`], frontend);
  }
  console.log(`Observa web package mode: release (${releaseVersion})`);
}
