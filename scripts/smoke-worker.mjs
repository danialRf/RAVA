import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const workspace = process.cwd();
const tsxCli = path.join(
  workspace,
  "apps",
  "worker",
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const worker = spawn(process.execPath, [tsxCli, "apps/worker/src/index.ts"], {
  cwd: workspace,
  env: process.env,
  stdio: ["ignore", "pipe", "inherit"],
  windowsHide: true,
});

function stopWorker() {
  if (!worker.pid || worker.exitCode !== null) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(worker.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  worker.kill("SIGTERM");
}

try {
  const startupLog = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Worker did not emit its startup event within 10 seconds."),
      );
    }, 10_000);

    worker.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Worker exited before startup with code ${code}.`));
    });

    worker.stdout.setEncoding("utf8");
    worker.stdout.on("data", (chunk) => {
      for (const line of chunk.split("\n")) {
        if (!line.includes('"event":"worker.started"')) continue;
        clearTimeout(timeout);
        resolve(line);
      }
    });
  });

  process.stdout.write(`${startupLog}\n`);
} finally {
  stopWorker();
}

process.exit(0);
