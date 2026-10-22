import { withVerificationLock } from "./verification-lock.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
await withVerificationLock(async (env) => {
  const platform = process.argv[2] || "web-mobile";
  if (!["web-mobile", "wechatgame"].includes(platform))
    throw Error("Unsupported platform");
  const candidates = [
    process.env.COCOS_CREATOR,
    path.resolve(
      "..",
      ".local-tools",
      "CocosCreator",
      "3.8.8",
      "CocosCreator.exe",
    ),
    "C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe",
    "C:/Cocos/Creator/3.8.8/CocosCreator.exe",
    "/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator",
  ].filter(Boolean);
  const creator = candidates.find((file) => fs.existsSync(file));
  if (!creator)
    throw Error(
      "Cocos Creator 3.8.8 not found. Set COCOS_CREATOR to the executable path.",
    );
  const scene = JSON.parse(
    fs.readFileSync("assets/scenes/Main.scene.meta", "utf8"),
  ).uuid;
  fs.mkdirSync("temp/build-logs", { recursive: true });
  const log = fs.createWriteStream(`temp/build-logs/${platform}.log`);
  const child = spawn(
    creator,
    [
      "--project",
      process.cwd(),
      "--build",
      `platform=${platform};debug=${platform === "web-mobile"};startScene=${scene};scenes=${scene};packages=${JSON.stringify({ [platform]: { orientation: platform === "wechatgame" ? "landscape" : "auto" } })}`,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env },
  );
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    child.kill("SIGINT");
  };
  const terminate = () => {
    cancelled = true;
    child.kill("SIGTERM");
  };
  process.once("SIGINT", cancel);
  process.once("SIGTERM", terminate);
  await new Promise((resolve) => {
    child.on("error", (error) => {
      log.end(String(error));
      console.error(`Cannot launch Creator: ${error.message}`);
      process.exitCode = 1;
      resolve();
    });
    child.on("close", (code) => {
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", terminate);
      log.end();
      if (cancelled) {
        process.exitCode = 1;
        resolve();
        return;
      }
      const output = path.resolve("build", platform);
      if ((code === 36 || code === 0) && platform === "web-mobile") {
        const index = path.join(output, "index.html");
        if (!fs.existsSync(index)) {
          console.error(
            `Web build is missing ${index}; inspect temp/build-logs/${platform}.log`,
          );
          process.exitCode = 1;
          resolve();
          return;
        }
        const html = fs
          .readFileSync(index, "utf8")
          .replace(/<title>[^<]*<\/title>/, "<title>余烬幸存者</title>")
          .replace("</head>", '<link rel="icon" href="data:,">\n</head>');
        fs.writeFileSync(index, html);
      }
      if ((code === 36 || code === 0) && platform === "wechatgame") {
        const projectPath = path.join(output, "project.config.json");
        const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
        project.appid = "wx941ec18966484d46";
        fs.writeFileSync(projectPath, JSON.stringify(project, null, 2) + "\n");
      }
      console.log(JSON.stringify({ platform, exitCode: code, output }));
      process.exitCode = code === 36 || code === 0 ? 0 : (code ?? 1);
      resolve();
    });
  });
});
