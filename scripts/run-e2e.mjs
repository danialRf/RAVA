import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import path from "node:path";

// Resolve Windows redirected profile paths (for example C:\Users -> D:\UserData)
// before passing the app directory to Next, otherwise Next can concatenate both
// spellings of the same path when it reads the production manifests.
const workspace = realpathSync(process.cwd());
const nextCli = path.join(
  workspace,
  "apps",
  "web",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const playwrightCli = path.join(
  workspace,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const completionFile = path.join(
  workspace,
  "test-results",
  ".rava-e2e-complete.json",
);

mkdirSync(path.dirname(completionFile), { recursive: true });
rmSync(completionFile, { force: true });

// A dedicated port so a developer's `pnpm dev` on 3000 does not collide with
// (or silently serve) the end-to-end run.
const port = process.env.RAVA_E2E_PORT ?? "3210";
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(
  process.execPath,
  [nextCli, "start", "apps/web", "--hostname", "127.0.0.1", "--port", port],
  {
    cwd: workspace,
    env: { ...process.env, APP_URL: baseUrl },
    stdio: "inherit",
    windowsHide: true,
  },
);

function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

async function waitForHealth() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `RAVA web server exited early with code ${server.exitCode}.`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The process is still starting; retry until the bounded deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("RAVA web server did not become healthy within 60 seconds.");
}

async function waitForTestCompletion(testRun) {
  const deadline = Date.now() + 300_000;

  while (Date.now() < deadline) {
    if (existsSync(completionFile)) {
      const result = JSON.parse(readFileSync(completionFile, "utf8"));
      return result.status === "passed" ? 0 : 1;
    }

    if (testRun.exitCode !== null) return testRun.exitCode;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Playwright did not report completion within 300 seconds.");
}

let testRun;
let finalExitCode = 1;

try {
  await waitForHealth();

  testRun = spawn(process.execPath, [playwrightCli, "test"], {
    cwd: workspace,
    env: {
      ...process.env,
      RAVA_E2E_COMPLETION_FILE: completionFile,
      RAVA_E2E_BASE_URL: baseUrl,
    },
    stdio: "inherit",
    windowsHide: true,
  });

  finalExitCode = await waitForTestCompletion(testRun);
} finally {
  stopProcess(testRun);
  stopProcess(server);
}

process.exit(finalExitCode);
