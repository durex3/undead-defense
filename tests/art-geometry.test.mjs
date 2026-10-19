import test from "node:test";
import assert from "node:assert/strict";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { drawHazards } from "../temp/tests/presentation/art/HazardPainter.mjs";
import {
  makeWorld,
  makeHazard,
  makeSiegeCharge,
  makeThunderHazard,
  makeMoonHazard,
} from "../tools/art-fixtures.mjs";

function boundsOf(hazard, worldOptions = {}, time = 0.5) {
  const world = makeWorld(worldOptions.stage ?? 1, { time });
  world.time = time;
  world.hazards = [hazard];
  const g = new Graphics();
  drawHazards(g, world, false);
  return g.bounds;
}

function near(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`,
  );
}

test("circle/warning keeps the exact hazard radius", () => {
  const b = boundsOf(makeHazard("circle", { radius: 1.4, due: 1 }), {}, 0.5);
  near(b.width, 2 * 1.4 * 48, 6, "circle width");
  near(b.height, 2 * 1.4 * 48, 6, "circle height");
});

test("sector uses radius and half-angle from the hazard", () => {
  const angle = 0,
    width = (Math.PI * 2) / 3,
    r = 2.2;
  const b = boundsOf(makeHazard("sector", { radius: r, width, angle, due: 1 }), {}, 0.5);
  near(b.maxX, r * 48, 6, "sector maxX");
  near(b.minX, 0, 6, "sector includes the caster origin");
  near(b.height, 2 * Math.sin(width / 2) * r * 48, 8, "sector height");
});

test("bell ring keeps inner/outer radii", () => {
  const b = boundsOf(makeHazard("bellRing", { radius: 2.4, width: 0.8, due: 1 }), {}, 0.5);
  near(b.width, 2 * 2.4 * 48, 8, "bell width");
  near(b.height, 2 * 2.4 * 48, 8, "bell height");
});

test("arrow corridor keeps its range and projectile speed", () => {
  const warning = boundsOf(
    makeHazard("arrow", { radius: 5, width: 0.45, angle: 0, due: 1, fixedDamage: true, projectileSpeed: 4.5 }),
    {},
    0.5,
  );
  near(warning.maxX, 5 * 48, 8, "arrow warning range");
  const flying = boundsOf(
    makeHazard("arrow", { radius: 5, width: 0.45, angle: 0, due: 1, fired: true, fixedDamage: true, projectileSpeed: 4.5 }),
    {},
    1.4,
  );
  near(flying.maxX, (1.4 - 1) * 4.5 * 48, 8, "arrow travel");
});

test("siege charge capsule keeps length and half-width", () => {
  const b = boundsOf(makeSiegeCharge({ radius: 4, width: 0.65, angle: 0, due: 1 }), {}, 0.5);
  near(b.width, 4 * 48 + 2 * 0.65 * 48, 10, "charge length");
});

test("thunder wall keeps its lateral span and gap", () => {
  const b = boundsOf(
    makeThunderHazard("wall", { radius: 4.8, width: 0.8, due: 1, travel: 6, speed: 2.8, gap: 0.6 }),
    { stage: 3 },
    1.3,
  );
  near(b.height, 4.8 * 48, 10, "wall span");
});

test("moon landing keeps its radius and locked endpoint", () => {
  const b = boundsOf(
    makeMoonHazard({
      shape: "landing",
      radius: 1.4,
      due: 1,
      out: 0.8,
      start: { x: -2, y: 0 },
      end: { x: 0, y: 0 },
    }),
    { stage: 4 },
    0.5,
  );
  // The true hit circle is 1.4 units; the second ring is a visual pulse that
  // starts at 1.4 and expands to 1.68 before the landing.
  near(b.maxX, 1.4 * 48 * (1 + 0.5 * 0.4), 8, "landing right edge");
  near(b.minX, -2 * 48, 8, "jump start marker");
});
