import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let activeChild = null;
let server = null;
let shuttingDown = false;

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    activeChild = child;

    child.once("error", (error) => {
      if (activeChild === child) {
        activeChild = null;
      }
      reject(error);
    });

    child.once("exit", (code, signal) => {
      if (activeChild === child) {
        activeChild = null;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command} ${args.join(" ")} terminated with signal ${signal}`
            : `${command} ${args.join(" ")} exited with code ${code}`,
        ),
      );
    });
  });
}

function terminateProcess(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (activeChild) {
    activeChild.kill(signal);
  }

  if (server?.listening) {
    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(0);
    }, 10000).unref();
    return;
  }

  process.exit(0);
}

process.on("SIGTERM", () => terminateProcess("SIGTERM"));
process.on("SIGINT", () => terminateProcess("SIGINT"));

try {
  await runCommand(npmCommand, ["run", "prisma:deploy"]);
  await runCommand(npmCommand, ["run", "verify:schema"]);
  const { startServer } = await import("../src/app.js");
  server = startServer();
} catch (error) {
  console.error("[start-production] Failed to boot application:", error);
  process.exit(1);
}
