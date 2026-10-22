import fs from "node:fs";
import assert from "node:assert/strict";
import { captureArchitecture } from "./architecture-snapshot.mjs";
const result = captureArchitecture();
const dir = "artifacts/architecture-refactor";
fs.mkdirSync(dir, { recursive: true });
const mode = process.argv[2] || "after";
if (!["before", "after"].includes(mode)) throw Error("mode");
fs.writeFileSync(`${dir}/${mode}.json`, JSON.stringify(result, null, 2) + "\n");
if (mode === "after")
  assert.deepEqual(result, JSON.parse(fs.readFileSync(`${dir}/before.json`)));
console.log(
  JSON.stringify({
    mode,
    combat: result.combat.length,
    hud: result.hud.length,
    progress: result.progress.length,
    parity: mode === "after",
  }),
);
