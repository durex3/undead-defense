import sharp from "sharp";
import fs from "node:fs";
const source =
  "/Users/liugelong/Desktop/resouce/0x72_DungeonTilesetII_v1.7/frames/";
const names = fs
  .readdirSync(source)
  .filter((n) =>
    /^(wizzard_m_(idle|run)|skelet_run|orc_warrior_run|goblin_run|big_zombie_run|big_demon_run|necromancer_anim|coin_anim|column\.|flask_red\.|weapon_rusty_sword\.)/.test(
      n,
    ),
  );
names.push(...fs.readdirSync("art/pixel").filter(n=>n.endsWith(".png")));
const sourcePath=n=>fs.existsSync("art/pixel/"+n)?"art/pixel/"+n:source+n;
const entries = [],
  map = {};
for (let i = 0; i < names.length; i++) {
  const m = await sharp(sourcePath(names[i])).metadata();
  const x = (i % 8) * 40,
    y = Math.floor(i / 8) * 40;
  entries.push({ input: sourcePath(names[i]), left: x, top: y });
  map[names[i].replace(".png", "")] = [x, y, m.width, m.height];
}
await sharp({
  create: {
    width: 320,
    height: Math.ceil(names.length / 8) * 40,
    channels: 4,
    background: "#00000000",
  },
})
  .composite(entries)
  .png()
  .toFile("assets/resources/pixel/atlas.png");
fs.writeFileSync(
  "assets/scripts/presentation/PixelAtlas.ts",
  "export const PIXELS:Record<string,number[]> = " +
    JSON.stringify(map) +
    ";\n",
);
const tiles = [];
let seed = 19;
for (let y = 0; y < 56; y++)
  for (let x = 0; x < 48; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = (seed >>> 16) % 100 < 88 ? 1 : 2 + ((seed >>> 20) % 7);
    tiles.push({
      input: source + "floor_" + n + ".png",
      left: x * 16,
      top: y * 16,
    });
  }
await sharp({
  create: { width: 768, height: 896, channels: 4, background: "#22242b" },
})
  .composite(tiles)
  .modulate({ saturation: 0.22 })
  .linear([0.78, 0.84, 1.05], [0, 0, 0])
  .png()
  .toFile("assets/resources/pixel/ground.png");
