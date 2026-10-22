import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { withVerificationLock } from "../tools/verification-lock.mjs";
test("shared output lock rejects concurrent work, accepts descendants and releases on failure", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "undead-lock-")),
    file = path.join(dir, "check.lock");
  try {
    let unrelatedRan = false;
    await assert.rejects(
      withVerificationLock(
        async (env) => {
          assert(fs.existsSync(file));
          await withVerificationLock(async () => {}, { file, env });
          await assert.rejects(
            withVerificationLock(
              async () => {
                unrelatedRan = true;
              },
              { file, env: {} },
            ),
            /已有检查/,
          );
          const code = `import {withVerificationLock} from ${JSON.stringify(new URL("../tools/verification-lock.mjs", import.meta.url).href)};await withVerificationLock(async()=>{}, {file:${JSON.stringify(file)}});`;
          const child = spawnSync(
            process.execPath,
            ["--input-type=module", "-e", code],
            {
              env: { ...process.env, UNDEAD_VERIFICATION_TOKEN: "" },
              encoding: "utf8",
            },
          );
          assert.notEqual(child.status, 0);
          assert(child.stderr.includes("已有检查"));
          throw Error("injected");
        },
        { file, env: {} },
      ),
      /injected/,
    );
    assert(!unrelatedRan);
    assert(!fs.existsSync(file));
    await withVerificationLock(async () => {}, { file, env: {} });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("validation plans have no upload step and serialize preparation, tests and Creator builds", () => {
  const invoke = (args) => {
    const r = spawnSync(
      process.execPath,
      ["tools/verify.mjs", ...args, "--plan"],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const standard = invoke([]),
    full = invoke(["--full", "--browser"]);
  assert(!standard.some((v) => v.args.includes("tools/build.mjs")));
  assert(
    full.findIndex((v) => v.args.includes("tools/test-build.mjs")) <
      full.findIndex((v) => v.args.includes("--test")),
  );
  assert(
    full.findIndex((v) => v.args.includes("web-mobile")) <
      full.findIndex((v) =>
        v.args.includes("tools/check-architecture-browser.mjs"),
      ),
  );
  assert(
    full.findIndex((v) =>
      v.args.includes("tools/check-architecture-browser.mjs"),
    ) < full.findIndex((v) => v.args.includes("wechatgame")),
  );
  assert(!full.some((v) => v.args.some((a) => /upload|push/.test(a))));
});
