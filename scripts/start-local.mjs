import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { delimiter, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const windows = process.platform === "win32";
const environment = { ...process.env };
let dockerCommand = "docker";

if (windows && environment.LOCALAPPDATA) {
  const dockerBin = join(
    environment.LOCALAPPDATA,
    "Programs",
    "DockerDesktop",
    "resources",
    "bin",
  );
  const bundledDocker = join(dockerBin, "docker.exe");
  if (existsSync(bundledDocker)) {
    // Use the explicit path so a fresh PowerShell session does not depend on
    // Docker Desktop having refreshed PATH already.
    dockerCommand = bundledDocker;
    const pathKey =
      Object.keys(environment).find((key) => key.toLowerCase() === "path") ??
      "Path";
    environment[pathKey] =
      `${dockerBin}${delimiter}${environment[pathKey] ?? ""}`;
  }
}

function spawnPnpm(args, options = {}) {
  const npmExecutable = environment.npm_execpath;
  if (npmExecutable) {
    return options.sync
      ? spawnSync(process.execPath, [npmExecutable, ...args], options)
      : spawn(process.execPath, [npmExecutable, ...args], options);
  }

  const command = windows ? "pnpm.cmd" : "pnpm";
  return options.sync
    ? spawnSync(command, args, { ...options, shell: windows })
    : spawn(command, args, { ...options, shell: windows });
}

function run(args, label) {
  console.log(`\n[RAVA] ${label}`);
  const result = spawnPnpm(args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
    sync: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runExternal(command, args, label) {
  console.log(`\n[RAVA] ${label}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    console.error(`[RAVA] Could not start ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", (error) => reject(error));
    probe.listen(port, "0.0.0.0", () => probe.close(resolve));
  });
}

try {
  await assertPortAvailable(3000);
} catch (error) {
  if (error?.code === "EADDRINUSE") {
    console.error(
      "[RAVA] Port 3000 is already in use. Close the previous RAVA PowerShell window, then run pnpm.cmd launch again.",
    );
    process.exit(1);
  }
  throw error;
}

runExternal(
  dockerCommand,
  ["compose", "up", "-d", "--wait", "postgres", "redis", "minio"],
  "Starting PostgreSQL, Redis and object storage…",
);
runExternal(
  dockerCommand,
  ["compose", "run", "--rm", "minio-init"],
  "Preparing private and public object-storage buckets…",
);
run(["db:migrate"], "Applying database migrations…");
run(["build"], "Building the production application…");

console.log(
  "\n[RAVA] Starting website and background worker on the fixed web port 3000…",
);
const worker = spawnPnpm(["--filter", "@rava/worker", "start"], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});
const web = spawnPnpm(
  ["--filter", "@rava/web", "run", "start", "--port", "3000"],
  {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  },
);

let stopping = false;
function stopChild(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (windows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGTERM");
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  stopChild(worker);
  stopChild(web);
  setTimeout(() => process.exit(exitCode), 250);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
worker.on("exit", (code) => stop(code ?? 1));
web.on("exit", (code) => stop(code ?? 1));
