import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const scriptArg = process.argv[2];

if (!scriptArg) {
  console.error("Usage: node scripts/manage-build.mjs <clean|clean:reinstall|build:safe|dev:safe|reinstall>");
  process.exit(1);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    ...options
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function runCleanup(reinstall = false) {
  const isWindows = process.platform === "win32";
  const scriptPath = path.join(rootDir, "scripts", isWindows ? "cleanup.ps1" : "cleanup.sh");

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Cleanup script not found: ${scriptPath}`);
  }

  if (isWindows) {
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath
    ];

    if (reinstall) {
      args.push("-Reinstall");
    }

    runCommand("powershell", args);
    return;
  }

  runCommand("sh", [scriptPath, ...(reinstall ? ["--reinstall"] : [])]);
}

function reinstallDependencies() {
  runCommand("npm", ["install"]);
}

switch (scriptArg) {
  case "clean":
    runCleanup(false);
    break;
  case "clean:reinstall":
    runCleanup(true);
    break;
  case "reinstall":
    runCleanup(true);
    reinstallDependencies();
    break;
  case "build:safe":
    runCleanup(false);
    runCommand("npm", ["run", "build:next"]);
    break;
  case "dev:safe":
    runCleanup(false);
    runCommand("npm", ["run", "dev:next"]);
    break;
  default:
    console.error(`Unknown command: ${scriptArg}`);
    process.exit(1);
}
