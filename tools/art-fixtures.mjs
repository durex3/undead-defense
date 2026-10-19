/**
 * Shared fake-world builders for tests/art-*.test.mjs and tools/art-preview.mjs.
 *
 * Run `node tools/test-build.mjs` before importing this file; it loads the
 * transpiled battle modules from temp/tests.
 */
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ENEMY_KINDS } from "../temp/tests/battle/SurvivalConfig.mjs";

export { ENEMY_KINDS };

export function makeWorld(stageId = 1, options = {}) {
  const world = new SurvivalWorld(options.seed ?? 7, options.character ?? "ranger", stageId);
  world.time = options.time ?? 3.7;
  world.state = "battle";
  world.camera = options.camera ?? { x: 0, y: 0 };
  // A generous viewport keeps every preview cell on-screen.
  world.viewport = options.viewport ?? { x: 100, y: 100 };
  world.player = options.player ?? { x: 0, y: 0 };
  world.move = options.move ?? { x: 0, y: 1 };
  world.invulnerable = options.invulnerable ?? 0;
  world.enemies = [];
  world.hazards = [];
  world.gems = [];
  world.potions = [];
  return world;
}

const BASE_ENEMY = {
  attack: 0,
  slow: 0,
  slowUntil: 0,
  freezeUntil: 0,
  freezeReady: 0,
  burn: 0,
  burnUntil: 0,
  burnNext: 0,
  state: "seek",
  timer: 0,
  facing: 0,
  lockedAngle: 0,
  combo: 0,
  pattern: 0,
  born: 0,
  visibleSince: 0,
  hazardId: 0,
  summoned: false,
  owner: 0,
  bossPhase: 1,
  bossAction: "none",
};

export function addEnemy(world, kind, options = {}) {
  const enemy = world.addEnemy(kind, options.x ?? 0, options.y ?? 0);
  if (!enemy) throw new Error("could not spawn " + kind);
  Object.assign(enemy, BASE_ENEMY, options.fields ?? {});
  enemy.x = options.x ?? 0;
  enemy.y = options.y ?? 0;
  enemy.hp = options.hp ?? enemy.maxHp;
  if (options.freeze) enemy.freezeUntil = world.time + 2;
  if (options.slow) {
    enemy.slow = 0.4;
    enemy.slowUntil = world.time + 2;
  }
  if (options.arriving) {
    enemy.state = "arriving";
    enemy.timer = 0.5;
  }
  if (options.windup) {
    enemy.state = "windup";
    enemy.timer = 0.35;
  }
  if (options.recover) {
    enemy.state = "recover";
    enemy.timer = 0.8;
  }
  if (options.pattern !== undefined) enemy.pattern = options.pattern;
  return enemy;
}

export function addShield(world, kind = "thornshield") {
  const a = addEnemy(world, kind, { x: -0.6, y: 0, fields: { shieldClock: 0 } });
  const b = addEnemy(world, "siegebow", { x: 1.1, y: 0 });
  a.shieldPartner = b.id;
  b.facing = Math.PI;
  return a;
}

export function setVulnerable(enemy, time) {
  if (enemy.kind === "sandstalker" || enemy.kind === "breakerelite" || enemy.kind === "broodelite" || enemy.kind === "boss") {
    enemy.sand = {
      action: "break",
      step: 0,
      angle: 0,
      vulnerable: true,
      buried: false,
      next: time + 1,
    };
  }
  if (enemy.moon) enemy.moon.vulnerable = true;
  if (enemy.thunder) enemy.thunder.vulnerable = true;
  enemy.state = "recover";
  enemy.timer = 0.8;
}

export function setBuried(enemy, time) {
  enemy.sand = {
    action: "burrow",
    step: 1,
    angle: 0,
    buried: true,
    end: { x: enemy.x - 2, y: enemy.y },
    next: time + 1,
  };
}

export function setJump(enemy, time) {
  enemy.moon = {
    action: "leaps",
    step: 1,
    next: time + 1,
    recovery: 0,
    cooldown: 0,
    direction: 1,
    jumpStart: { x: enemy.x - 1, y: enemy.y },
    jumpEnd: { x: enemy.x + 1, y: enemy.y },
    jumpAt: time - 0.2,
    jumpDue: time + 0.25,
    vulnerable: false,
  };
  enemy.state = "charge";
}

export function setDevice(enemy, time, expiresIn = 3.2) {
  enemy.thunder = {
    action: "anchor",
    step: 0,
    next: time + 1,
    points: [],
    devices: [],
    angle: 0,
    expires: time + expiresIn,
  };
}

const MOD_STATS = {
  radius: 1.2,
  count: 1,
  damage: 20,
  cooldown: 2,
  range: 8,
  duration: 4,
  speed: 10,
};

export function stats(mods = [], overrides = {}) {
  return { ...MOD_STATS, ...overrides, mods: [...mods] };
}

export function makeShot(skill, options = {}) {
  const { mods = [], stats: statOverrides, ...rest } = options;
  return {
    active: true,
    skill,
    stats: stats(mods, statOverrides),
    angle: 0,
    speed: 11,
    travel: 0,
    range: 10,
    hit: new Set(),
    returning: false,
    end: undefined,
    child: false,
    group: 1,
    age: 0.2,
    until: 3,
    start: { x: 0, y: 0 },
    target: { x: 1, y: 1 },
    orbit: false,
    index: 0,
    x: 0,
    y: 0,
    ...rest,
  };
}

export function makeField(skill, options = {}) {
  const { mods = [], stats: statOverrides, ...rest } = options;
  return {
    active: true,
    skill,
    stats: stats(mods, statOverrides),
    radius: 1.5,
    baseRadius: 1.5,
    created: 0,
    until: 9,
    angle: 0,
    returnTarget: undefined,
    returning: false,
    next: 0,
    interval: 0.4,
    x: 0,
    y: 0,
    ...rest,
  };
}

export function makeCast(skill, options = {}) {
  const { mods = [], stats: statOverrides, ...rest } = options;
  return {
    skill,
    stats: stats(mods, statOverrides),
    due: 0.35,
    index: 0,
    group: 1,
    target: { x: 1, y: 1 },
    origin: { x: 0, y: 0 },
    ...rest,
  };
}

export function makeExtra(skill, options = {}) {
  const { mods = [], stats: statOverrides, ...rest } = options;
  const common = {
    active: true,
    skill,
    stats: stats(mods, statOverrides),
    created: 0,
    age: 0.3,
    until: 9,
    next: 1,
    phase: 0,
    angle: 0,
    start: { x: 0, y: 0 },
    target: { x: 1, y: 1 },
    end: undefined,
    targetId: 1,
    hit: new Set(),
    secondary: new Set(),
    points: [],
    group: 1,
    index: 1,
    travel: 0,
    speed: 10,
    x: 0,
    y: 0,
  };
  const extra = { ...common, ...rest };
  if (!extra.points || !extra.points.length) {
    extra.points = [
      { x: extra.x, y: extra.y },
      { x: extra.x + 2, y: extra.y + 1 },
    ];
  }
  return extra;
}

export function makeHazard(kind, options = {}) {
  return {
    id: 1,
    source: 1,
    kind,
    x: options.x ?? 0,
    y: options.y ?? 0,
    angle: options.angle ?? 0,
    radius: options.radius ?? 1.4,
    width: options.width ?? 0.45,
    created: options.created ?? 0,
    due: options.due ?? 1,
    until: options.until ?? 2,
    damage: options.damage ?? 10,
    fired: options.fired ?? false,
    next: 0,
    projectileSpeed: options.projectileSpeed,
    ...options,
  };
}

export function moonMotion(options = {}) {
  return {
    shape: options.shape ?? "blade",
    radius: options.radius ?? 1.1,
    width: options.width ?? 0.5,
    angle: options.angle ?? 0,
    turn: options.turn ?? Math.PI * 1.4,
    due: options.due ?? 1,
    out: options.out ?? 0.8,
    inner: options.inner ?? 0.6,
    start: options.start ?? { x: 0, y: 0 },
    control: options.control ?? { x: 2, y: 2 },
    end: options.end ?? { x: 4, y: 0 },
    returnControl: options.returnControl ?? { x: 3, y: -2 },
    home: options.home ?? { x: 1, y: 0 },
  };
}

export function makeMoonHazard(options = {}) {
  const h = makeHazard("circle", { radius: 0.2, width: 0.2, ...options });
  h.moon = {
    motion: options.motion ?? moonMotion(options),
    launched: options.launched ?? false,
    hits: 0,
    last: -Infinity,
    player: { x: 0, y: 0 },
    order: options.order ?? 1,
  };
  return h;
}

export function makeThunderHazard(shape, options = {}) {
  const h = makeHazard(shape === "wall" || shape === "line" ? "line" : shape === "sector" ? "sector" : "circle", options);
  h.thunder = {
    shape,
    devices: [],
    speed: options.speed ?? 2.8,
    travel: options.travel ?? 6,
    gap: options.gap ?? 0,
    tick: options.tick,
    residue: options.residue,
    launch: options.launch,
    hit: false,
    order: options.order ?? 1,
  };
  return h;
}

export function makeSiegeCharge(options = {}) {
  return makeHazard("line", { siegeCharge: true, radius: 4, width: 0.65, angle: 0, ...options });
}

export function makeSiegeGround(options = {}) {
  return makeHazard("circle", {
    siegeGround: true,
    radius: 1.4,
    siegeTick: 8,
    endX: -2,
    endY: 1,
    siegeLaunched: true,
    ...options,
  });
}

export function makeFrontierLane(options = {}) {
  return makeHazard("frontierLane", {
    radius: 4,
    width: 0.5,
    endX: 4,
    endY: 2,
    ...options,
  });
}

/** A small world containing only one enemy, used for contact sheets. */
export function oneEnemy(stageId, kind, options = {}) {
  const world = makeWorld(stageId, { time: options.time ?? 3.7 });
  const enemy = addEnemy(world, kind, options);
  return { world, enemy };
}
