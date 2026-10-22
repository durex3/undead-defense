import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { runCheck } from "./check-process.mjs";
await withVerificationLock(async (env) => {
  await runCheck(process.execPath, ["tools/test-build.mjs"], { env });
  await runCheck(
    process.execPath,
    [
      "--test",
      ...fs
        .readdirSync("tests")
        .filter((f) => f.endsWith(".test.mjs"))
        .sort()
        .map((f) => "tests/" + f),
    ],
    { env },
  );
});
