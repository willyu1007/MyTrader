import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const electronPath = require("electron");

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ["."], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: childEnv
});

const exit = (code) => {
  if (!child.killed) child.kill("SIGTERM");
  process.exit(code);
};

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => exit(130));
process.on("SIGTERM", () => exit(143));
