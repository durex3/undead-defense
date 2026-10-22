import { spawn } from "node:child_process";
/** Relay cancellation and wait for the child before releasing a workspace lock. */
export function runCheck(
  command,
  args,
  { env = process.env, stdio = "inherit" } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio });
    let signal;
    const interrupt = () => {
      signal = "SIGINT";
      child.kill(signal);
    };
    const terminate = () => {
      signal = "SIGTERM";
      child.kill(signal);
    };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    const cleanup = () => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
    };
    child.once("error", (e) => {
      cleanup();
      reject(e);
    });
    child.once("exit", (code, killed) => {
      cleanup();
      if (code === 0 && !signal) resolve();
      else
        reject(
          Error(
            `${command} ${args.join(" ")} failed (${signal || killed || code})`,
          ),
        );
    });
  });
}
