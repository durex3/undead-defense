import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  WEAPONS,
  PASSIVES,
  PASSIVE_MAX,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import {
  MODS,
  weaponStats,
  modReason,
} from "../temp/tests/battle/ArmoryConfig.mjs";
import { EXTRA_WEAPONS } from "../temp/tests/battle/ExtraArmoryConfig.mjs";
import { EXTRA_LIMIT } from "../temp/tests/battle/ExtraArmory.mjs";
import {
  weaponDetails,
  upgradeChanges,
} from "../temp/tests/battle/WeaponStatus.mjs";
import { battleReport } from "../temp/tests/battle/BattleReport.mjs";
const world = () => {
  const w = new SurvivalWorld(22, "ranger", 14);
  for (const s of WEAPONS) w.skills[s] = 0;
  w.enemies = [];
  return w;
};
const enemy = (w, x = 3, y = 0, kind = "siegebone") => {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.hp = e.maxHp = 1e7;
  return e;
};
const step = (w, t) => {
  for (let i = 0; i < Math.round(t * 60); i++) {
    w.time += 1 / 60;
    w.armory.step(1 / 60);
  }
};
const cast = (w) => {
  w.armory.step(0);
  for (const s of WEAPONS) w.cooldowns[s] = 100;
};
const pairs = (s) =>
  MODS[s].flatMap((m, i) =>
    MODS[s]
      .slice(i + 1)
      .filter((n) => n.id !== m.excludes)
      .map((n) => [m.id, n.id]),
  );
for (const s of EXTRA_WEAPONS) {
  test(`${s}: every base, single and legal pair deals damage; both pair orders preserve outcomes`, () => {
    for (const mods of [[], ...MODS[s].map((m) => [m.id]), ...pairs(s)]) {
      const run = (chosen) => {
        const w = world();
        w.skills[s] = 8;
        w.mods[s] = chosen;
        for (let i = 0; i < 18; i++) {
          const a = (i * Math.PI) / 9;
          enemy(w, Math.cos(a) * 2, Math.sin(a) * 2);
        }
        cast(w);
        if (s === "mine")
          for (const a of w.armory.extra.attacks.filter((a) => a.active))
            enemy(w, a.x, a.y);
        step(w, 8);
        assert((w.damage[s] || 0) > 0, `${s}:${chosen}`);
        assert(
          w.armory.extra.attacks.every((a) => !a.active),
          `${s}:${chosen} did not expire`,
        );
        return w.damage[s];
      };
      const a = run(mods);
      if (mods.length === 2) assert.equal(run([...mods].reverse()), a);
    }
  });
  test(`${s}: automatic nodes, exclusions, snapshots and real upgrade deltas`, () => {
    const w = world();
    w.skills[s] = 4;
    w.upgrades.openNode();
    assert.equal(w.pendingModification, s);
    const m = MODS[s][0];
    assert(w.chooseMod(m.id));
    w.skills[s] = 8;
    w.upgrades.openNode();
    assert.match(modReason(w, s, m.excludes), /互斥/);
    assert(!w.chooseMod(m.excludes));
    assert(w.chooseMod(MODS[s][2].id));
    assert.equal(w.mods[s].length, 2);
    enemy(w);
    cast(w);
    const a = w.armory.extra.attacks.find((a) => a.active),
      old = a.stats.damage;
    w.passives.power = 4;
    w.mods[s] = [];
    assert.equal(a.stats.damage, old);
    assert.equal(a.stats.mods.length, 2);
    assert.match(weaponDetails(w, s), /8\/8级/);
    w.skills[s] = 7;
    assert.match(upgradeChanges(w, s), /改造/);
    w.skills[s] = 8;
    assert.equal(battleReport(w).rows[0].skill, s);
    for (let l = 1; l <= 8; l++) {
      const st = weaponStats(w, s, l);
      assert(st.damage > 0 && st.count > 0 && st.cooldown > 0);
      if (l > 1) assert(st.damage >= weaponStats(w, s, l - 1).damage);
    }
  });
}
test("opening offers exactly three distinct weapons with all ten reachable across seeded games", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 120; seed++) {
    const w = new SurvivalWorld(seed, "ranger", 14);
    assert(w.offerStartingWeapons());
    assert.equal(w.startingWeapons.length, 3);
    assert.equal(new Set(w.startingWeapons).size, 3);
    w.startingWeapons.forEach((s) => seen.add(s));
    assert(w.chooseStartingWeapon(w.startingWeapons[0]));
    assert.equal(w.weaponCount, 1);
  }
  assert.equal(seen.size, 10);
});
test("six weapon slots prevent seventh learning while owned weapons remain upgradeable", () => {
  const w = world();
  for (const s of WEAPONS.slice(0, 6)) w.skills[s] = 1;
  assert.equal(w.weaponCount, 6);
  assert(WEAPONS.slice(0, 6).every((s) => w.legal().includes(s)));
  assert(WEAPONS.slice(6).every((s) => !w.legal().includes(s)));
});
test("ice cannot freeze or slow bosses or cancel charges; elite control has a three second gate", () => {
  const w = world();
  w.skills.frost = 8;
  const b = enemy(w, 1, 0, "boss"),
    c = enemy(w, 1, 1, "siegerider"),
    e = enemy(w, 2, 0, "siegeflag");
  c.state = "charge";
  cast(w);
  assert.equal(b.freezeUntil, 0);
  assert.equal(b.slowUntil, 0);
  assert.equal(c.freezeUntil, 0);
  assert.equal(c.slowUntil, 0);
  assert.equal(e.freezeUntil, 0.25);
  step(w, 0.6);
  assert.equal(e.freezeUntil, 0.25);
  assert.equal(e.freezeReady, 3);
});
test("ice aftershock fires once rather than every frame until expiration", () => {
  const w = world();
  w.skills.frost = 1;
  w.mods.frost = ["aftershock"];
  enemy(w, 1);
  cast(w);
  const d = w.damage.frost;
  step(w, 0.85);
  assert(Math.abs(w.damage.frost - d * 1.45) < 1e-6);
  const total = w.damage.frost;
  step(w, 1);
  assert.equal(w.damage.frost, total);
});
test("lightning chain never repeats the same enemy within one main strike, and echo is finite", () => {
  const w = world();
  w.skills.lightning = 8;
  w.mods.lightning = ["relay", "echo"];
  const e = enemy(w, 2);
  for (let i = 0; i < 8; i++) enemy(w, 2 + i * 0.1, 0.1);
  const d = weaponStats(w, "lightning").damage;
  cast(w);
  assert(Math.abs(e.maxHp - e.hp - d) < 1e-5);
  step(w, 1.5);
  assert(Math.abs(e.maxHp - e.hp - d * 1.65) < 1e-5);
  assert(w.armory.extra.attacks.every((a) => !a.active));
});
test("untriggered mines expire quietly, fuse explodes exactly twice after a real trigger", () => {
  const w = world();
  w.skills.mine = 1;
  w.mods.mine = ["fuse"];
  enemy(w, 7);
  cast(w);
  step(w, 8);
  assert.equal(w.damage.mine || 0, 0);
  const v = world();
  v.skills.mine = 1;
  v.mods.mine = ["fuse"];
  enemy(v, 7);
  cast(v);
  const a = v.armory.extra.attacks[0],
    e = enemy(v, a.x, a.y),
    d = a.stats.damage;
  step(v, 2);
  assert(Math.abs(e.maxHp - e.hp - d * 1.65) < 1e-5);
  step(v, 6);
  assert(v.armory.extra.attacks.every((a) => !a.active));
});
test("black hole pulls only ordinary seeking enemies and maxes overlapping same-source ticks", () => {
  const w = world();
  w.skills.void = 1;
  w.mods.void = ["binary"];
  const e = enemy(w, 2, 0),
    b = enemy(w, 2, 0.1, "boss"),
    elite = enemy(w, 2, 0.2, "siegeflag");
  cast(w);
  const a = w.armory.extra.attacks.filter((a) => a.active);
  for (const f of a) {
    f.x = 1;
    f.y = 0;
    f.next = w.time + 0.001;
  }
  const hp = e.hp,
    d = a[0].stats.damage;
  step(w, 0.02);
  assert(e.x < 2);
  assert.equal(b.x, 2);
  assert.equal(elite.x, 2);
  assert(Math.abs(hp - e.hp - d) < 1e-5);
  step(w, 5);
  assert(w.armory.extra.attacks.every((a) => !a.active));
});
test("empty center of recoil black hole receives no terminal ring damage", () => {
  const w = world();
  w.skills.void = 1;
  w.mods.void = ["repel", "collapse"];
  const e = enemy(w, 3, 0, "boss");
  cast(w);
  const before = w.damage.void || 0;
  step(w, 1.19);
  const ticks = w.damage.void;
  step(w, 0.2);
  assert.equal(w.damage.void, ticks);
  assert(ticks >= before);
});
test("holy blade locks its preview, misses enemies that leave, and cross intersection damages once", () => {
  const w = world();
  w.skills.holy = 1;
  enemy(w, 3);
  cast(w);
  w.enemies[0].x = 8;
  step(w, 1);
  assert.equal(w.damage.holy || 0, 0);
  const v = world();
  v.skills.holy = 1;
  v.mods.holy = ["cross"];
  const e = enemy(v, 3),
    d = weaponStats(v, "holy").damage;
  cast(v);
  step(v, 0.6);
  assert(Math.abs(e.maxHp - e.hp - d) < 1e-5);
});
test("all legal max-mod builds remain finite and six-weapon pressure stays bounded", () => {
  const w = world();
  for (const s of EXTRA_WEAPONS.slice(0, 6)) {
    w.skills[s] = 8;
    w.mods[s] = pairs(s)[0];
  }
  for (const p of PASSIVES) w.passives[p] = PASSIVE_MAX[p];
  for (let i = 0; i < 80; i++) enemy(w, Math.cos(i) * 5, Math.sin(i) * 5);
  step(w, 30);
  assert(w.armory.extra.attacks.length <= EXTRA_LIMIT);
  assert(
    w.armory.extra.attacks.every(
      (a) => Number.isFinite(a.x) && Number.isFinite(a.y),
    ),
  );
  assert(EXTRA_WEAPONS.slice(0, 6).every((s) => w.castCounts[s] > 1));
});
test('bone segment collision pierces different enemies once each even when resting inside width',()=>{const w=world();w.skills.bone=1;const a=enemy(w,2),b=enemy(w,4),d=weaponStats(w,'bone').damage;cast(w);step(w,2);assert(Math.abs(a.maxHp-a.hp-d)<1e-5);assert(Math.abs(b.maxHp-b.hp-d)<1e-5);});
test('ghost return endpoint locks once and a moving player cannot extend its lifetime',()=>{const w=world();w.skills.ghost=1;w.mods.ghost=['reap'];enemy(w,8);cast(w);step(w,.85);const a=w.armory.extra.attacks.find(a=>a.active);assert.equal(a.phase,2);const end={...a.end};w.player={x:20,y:20};step(w,.05);assert.deepEqual(a.end,end);step(w,4);assert(!a.active);});
test('full extra pool postpones a complete cast without overwriting and then reuses released slots',()=>{const w=world();w.skills.mine=1;enemy(w,7);cast(w);const original=w.armory.extra.attacks[0];while(w.armory.extra.attacks.length<EXTRA_LIMIT)w.armory.extra.attacks.push({...original,hit:new Set(),secondary:new Set()});const count=w.castCounts.mine;w.cooldowns.mine=0;w.armory.step(0);assert.equal(w.castCounts.mine,count);assert.equal(w.cooldowns.mine,0);for(let i=0;i<2;i++)w.armory.extra.attacks[i].active=false;w.armory.step(0);assert.equal(w.castCounts.mine,count+1);assert.equal(w.armory.extra.attacks.length,EXTRA_LIMIT);assert(w.armory.extra.attacks.slice(0,2).every(a=>a.active));});
test('black hole has a synchronized first tick and cannot add immediate off-beat overlap damage',()=>{const w=world();w.skills.void=1;enemy(w,3);w.time=.13;cast(w);assert.equal(w.damage.void||0,0);assert.equal(w.armory.extra.attacks[0].next,.4);step(w,.2);assert.equal(w.damage.void||0,0);step(w,.1);assert(w.damage.void>0);});
test('ghost hunter changes priority from nearby enemies to dangerous distant targets',()=>{for(const hunt of [false,true]){const w=world();w.skills.ghost=1;w.mods.ghost=hunt?['execution']:[];const near=enemy(w,2),elite=enemy(w,8,0,'siegeflag');cast(w);assert.equal(w.armory.extra.attacks[0].targetId,hunt?elite.id:near.id);}});
