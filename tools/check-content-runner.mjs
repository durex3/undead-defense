import { withVerificationLock } from "./verification-lock.mjs";
import { runCheck } from "./check-process.mjs";
await withVerificationLock(async (env) => {
  await runCheck(process.execPath, ["tools/test-build.mjs"], { env });
  await runCheck(process.execPath, ["tools/check-content.mjs"], { env });
});
