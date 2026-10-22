import { startBuildServer } from "./serve-build.mjs";
import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { runCheck } from "./check-process.mjs";
const args = process.argv.slice(2),
  valid = new Set(["--full", "--browser", "--plan"]);
if (args.some((a) => !valid.has(a)))
  throw Error("Usage: npm run verify -- [--full] [--browser] [--plan]");
export function verificationSteps({ full = false, browser = full } = {}) {
  return [
    ["类型检查", ["node_modules/typescript/bin/tsc", "--noEmit"]],
    ["准备回归模块", ["tools/test-build.mjs"]],
    ["内容完整性", ["tools/check-content.mjs"]],
    [
      "全部回归测试",
      [
        "--test",
        ...fs
          .readdirSync("tests")
          .filter((f) => f.endsWith(".test.mjs"))
          .sort()
          .map((f) => "tests/" + f),
      ],
    ],
    ["架构行为快照", ["tools/check-architecture-parity.mjs", "after"]],
    ...(full
      ? [
          [
            "武器数值诊断",
            [
              "tools/check-current-weapon-balance.mjs",
              "artifacts/architecture-refactor/weapon-balance",
            ],
          ],
        ]
      : []),
    ...(full || browser
      ? [["本地Web构建", ["tools/build.mjs", "web-mobile"]]]
      : []),
    ...(browser
      ? [["实际浏览器回归", ["tools/check-architecture-browser.mjs"]]]
      : []),
    ...(full ? [["本地微信构建", ["tools/build.mjs", "wechatgame"]]] : []),
  ];
}
const steps = verificationSteps({
  full: args.includes("--full"),
  browser: args.includes("--browser") || args.includes("--full"),
});
if (args.includes("--plan"))
  console.log(
    JSON.stringify(
      steps.map(([name, args]) => ({ name, args })),
      null,
      2,
    ),
  );
else
  await withVerificationLock(async (env) => {
    const report = {
      mode: args.includes("--full")
        ? "full"
        : args.includes("--browser")
          ? "browser"
          : "standard",
      startedAt: new Date().toISOString(),
      ok: false,
      steps: [],
    };
    fs.mkdirSync("artifacts/verification", { recursive: true });
    try {
      for (const [name, args] of steps) {
        console.log("\n[verify] " + name);
        const started = Date.now();
        try {
          if (args[0] === "tools/check-architecture-browser.mjs") {
            const server = await startBuildServer();
            try {
              await runCheck(process.execPath, args, {
                env: { ...env, UNDEAD_BROWSER_URL: server.url },
              });
            } finally {
              await server.close();
            }
          } else await runCheck(process.execPath, args, { env });
          report.steps.push({
            name,
            ok: true,
            seconds: (Date.now() - started) / 1000,
          });
        } catch (e) {
          report.steps.push({ name, ok: false, error: e.message });
          throw e;
        }
      }
      report.ok = true;
    } finally {
      report.finishedAt = new Date().toISOString();
      fs.writeFileSync(
        `artifacts/verification/${report.mode}.json`,
        JSON.stringify(report, null, 2) + "\n",
      );
      fs.writeFileSync(
        "artifacts/verification/latest.json",
        JSON.stringify(report, null, 2) + "\n",
      );
    }
  });
