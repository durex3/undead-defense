import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const platform = process.argv[2] || "web-mobile";
if (!["web-mobile", "wechatgame"].includes(platform))
  throw Error("Unsupported platform");
const creator =
  "/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator";
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
  { stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.pipe(log);
child.stderr.pipe(log);
child.on("exit", (code) => {
  log.end();
  const output = path.resolve("build", platform);
  if ((code === 36 || code === 0) && platform === "web-mobile") {
    const index = path.join(output, "index.html");
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
});
