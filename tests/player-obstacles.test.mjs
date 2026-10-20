import {libraryMap,LIBRARY_BASES} from "../temp/tests/battle/LibraryMap.mjs";
import {windMap,WIND_BASES} from "../temp/tests/battle/WindMap.mjs";
import {rootMap,ROOT_BASES} from "../temp/tests/battle/RootMap.mjs";
import {prismMap,PRISM_BASES} from "../temp/tests/battle/PrismMap.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { siegeMap, SIEGE_WALLS } from "../temp/tests/battle/SiegeMap.mjs";
import { sandMap, SAND_ROCKS } from "../temp/tests/battle/SandMap.mjs";
import { thunderMap, THUNDER_BASES } from "../temp/tests/battle/ThunderMap.mjs";
import { moonMap, MOON_BASES } from "../temp/tests/battle/MoonMap.mjs";
import {tideMap,TIDE_BASES} from "../temp/tests/battle/TideMap.mjs";
import {bellMap,BELL_BASES} from "../temp/tests/battle/BellMap.mjs";
const stages = [
  [10,libraryMap,LIBRARY_BASES],
  [9,windMap,WIND_BASES],
  [8,rootMap,ROOT_BASES],
  [7,prismMap,PRISM_BASES],
  [6,tideMap,TIDE_BASES],
  [5,bellMap,BELL_BASES],
  [1, siegeMap, SIEGE_WALLS],
  [2, sandMap, SAND_ROCKS],
  [3, thunderMap, THUNDER_BASES],
  [4, moonMap, MOON_BASES],
];
function world(stage) {
  const w = new SurvivalWorld(31, "ranger", stage);
  // Isolate actual world movement from combat and upgrade UI.
  w.director.step = () => {};
  w.armory.step = () => {};
  w.siege.sample = () => {};
  return w;
}
for (const [stage, map, boxes] of stages) {
  test(`stage ${stage}: actual player movement cannot cross any obstacle from any face`, () => {
    for (const b of boxes)
      for (const [x, y] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        for (const dt of [1 / 60, 0.5, 3]) {
          const w = world(stage),
            half = x ? b.halfWidth : b.halfHeight;
          w.player = { x: b.x + x * (half + 0.5), y: b.y + y * (half + 0.5) };
          w.move = { x: -x, y: -y };
          for (let t = 0; t < 3 - 1e-8; t += dt) w.step(Math.min(dt, 3 - t));
          assert(!map.blocked(w.player, 0.299));
          assert(
            (x ? (w.player.x - b.x) * x : (w.player.y - b.y) * y) >=
              half + 0.299,
            `crossed ${JSON.stringify(b)} at dt=${dt}`,
          );
        }
  });
  test(`stage ${stage}: diagonal movement slides along a face and can round its corner`, () => {
    // Stage ten starts with joined L shelves; use its exposed northeast face for corner sliding.
    const b = boxes[stage===10?2:0],
      w = world(stage);
    w.player = { x: b.x - b.halfWidth - 0.3, y: b.y };
    w.move = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    for (let i = 0; i < 10; i++) w.step(1 / 60);
    assert(!map.blocked(w.player, 0.299));
    assert(w.player.y > b.y + 0.2);
    assert(w.player.x <= b.x - b.halfWidth - 0.299);
    for (let i = 0; i < 80; i++) w.step(1 / 60);
    assert(!map.blocked(w.player, 0.299));
    assert(w.player.x > b.x - b.halfWidth);
  });
}
