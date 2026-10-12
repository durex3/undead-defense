import sharp from "sharp";
import fs from "node:fs";
const root = "/Users/liugelong/Desktop/resouce/icons/ffffff/000000/1x1/";
const items = {
  fire: ["lorc/fireball", "#FFAC72"],
  ice: ["lorc/ice-bolt", "#83E9FA"],
  lightning: ["willdabeast/chain-lightning", "#D5B3FF"],
  ballista: ["carl-olsen/crossbow", "#EDD39B"],
};
fs.mkdirSync("assets/resources/ui/icons", { recursive: true });
for (const [name, [file, color]] of Object.entries(items)) {
  const svg = fs
    .readFileSync(root + file + ".svg", "utf8")
    .replace('<path d="M0 0h512v512H0z"/>', "")
    .replaceAll("#fff", color);
  await sharp(Buffer.from(svg))
    .resize(128, 128)
    .png()
    .toFile("assets/resources/ui/icons/" + name + ".png");
}
fs.writeFileSync(
  "licenses/ICON-CREDITS.md",
  "# Icon credits\n\nIcons made by Lorc (fireball, ice-bolt), Willdabeast (chain-lightning), and Carl Olsen (crossbow).\nSource: https://game-icons.net\nLicense: CC BY 3.0 https://creativecommons.org/licenses/by/3.0/\nChanges: background removed, recolored and rasterized to PNG.\n",
);
