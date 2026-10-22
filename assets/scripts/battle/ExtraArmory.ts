import { createExtraBehaviors } from "./ExtraWeaponBehaviors";
import type { SurvivalWorld } from "./SurvivalWorld";
import { isPriorityTarget } from "./SurvivalConfig";
import { Enemy, Point, distance } from "./SurvivalTypes";
import { weaponStats, WeaponStats, replicaStats } from "./ArmoryConfig";
import { EXTRA_WEAPONS, ExtraSkill } from "./ExtraArmoryConfig";
export const EXTRA_LIMIT = 192;
export interface ExtraAttack extends Point {
  active: boolean;
  skill: ExtraSkill;
  stats: WeaponStats;
  created: number;
  age: number;
  until: number;
  next: number;
  phase: number;
  angle: number;
  start: Point;
  target: Point;
  end?: Point;
  targetId?: number;
  hit: Set<number>;
  secondary: Set<number>;
  points: Point[];
  group: number;
  index: number;
  travel: number;
  speed: number;
  companion?: number;
  retargeted?: boolean;
  impactAt?: number;
}

/** One bounded slot owns an attack's entire lifecycle, including echoes and terminal effects. */
export class ExtraArmory {
  attacks: ExtraAttack[] = [];
  ghostCount = 0;
  readonly behaviors: ReturnType<typeof createExtraBehaviors>;
  constructor(private w: SurvivalWorld) {
    this.behaviors = createExtraBehaviors(w, {
      enemies: (p, r) => this.enemies(p, r),
      damage: (e, d, a, p) => this.damage(e, d, a, p),
      attacks: () => this.attacks,
    });
  }
  private enemies(p: Point, r: number) {
    return this.w.enemies.filter(
      (e) =>
        e.hp > 0 &&
        e.state !== "arriving" &&
        !e.sand?.buried &&
        distance(e, p) <= r,
    );
  }
  private damage(e: Enemy, d: number, a: ExtraAttack, p: Point = a) {
    this.w.hit(
      e,
      d,
      a.skill,
      false,
      p,
      a.skill === "bone",
      undefined,
      1,
      a.skill === "bone",
      false,
    );
  }
  /** Compatibility entry for existing controlled freeze/interrupt diagnostics. */
  private freeze(e: Enemy, a: ExtraAttack) {
    this.behaviors.frost.freeze(e, a);
  }
  private put(a: ExtraAttack) {
    const slot = this.attacks.find((v) => !v.active);
    if (slot) Object.assign(slot, a);
    else this.attacks.push(a);
  }
  private target(skill: ExtraSkill, s: WeaponStats) {
    const list = this.enemies(this.w.player, s.range);
    return list.sort((a, b) => {
      const priority = this.w.targetPriority(b) - this.w.targetPriority(a);
      if (priority) return priority;
      if (this.behaviors[skill].prefersThreat?.(s)) {
        const rank = (e: Enemy) => Number(isPriorityTarget(e.kind,true));
        const d = rank(b) - rank(a);
        if (d) return d;
      }
      return distance(a, this.w.player) - distance(b, this.w.player);
    })[0];
  }
  step(dt: number) {
    for (const skill of EXTRA_WEAPONS) {
      this.castWeapon(skill, dt);
    }
    this.advance(dt);
  }
  castWeapon(skill: ExtraSkill, dt: number) {
    const w = this.w;
    if (!w.skills[skill]) return;
    w.cooldowns[skill] = Math.max(0, w.cooldowns[skill] - dt);
    if (w.cooldowns[skill] > 0) return;
    if (
      skill === "ghost" &&
      this.attacks.some((a) => a.active && a.skill === "ghost")
    )
      return;
    const s = weaponStats(w, skill),
      t = this.target(skill, s);
    if (!t) return;
    const count = this.behaviors[skill].count?.(s) ?? s.count;
    if (this.attacks.filter((a) => a.active).length + count > EXTRA_LIMIT)
      return;
    this.cast(skill, s, t, count);
    w.cooldowns[skill] = s.cooldown;
    w.castCounts[skill] = (w.castCounts[skill] || 0) + 1;
    w.effects.push({ type: "cast", ...w.player, skill });
  }
  advance(dt: number) {
    const w = this.w;
    // Same-source black hole overlap is max-only, including synchronized terminal explosions.
    const ticks = new Map<number, { a: ExtraAttack; damage: number }>(),
      ends = new Map<number, { a: ExtraAttack; damage: number }>();
    for (const a of this.attacks)
      if (a.active) {
        a.age += dt;
        if (a.age < 0) continue;
        this.behaviors[a.skill].step(a, dt, ticks, ends);
      }
    for (const bucket of [ticks, ends])
      for (const [id, { a, damage }] of bucket) {
        const e = w.enemies.find((e) => e.id === id);
        if (e && e.hp > 0) this.damage(e, damage, a);
      }
  }
  private cast(skill: ExtraSkill, s: WeaponStats, t: Enemy, count: number) {
    if (skill === "ghost") this.ghostCount = count;
    const w = this.w,
      group = w.id(),
      angle =
        this.behaviors[skill].aim?.(s, t) ??
        Math.atan2(t.y - w.player.y, t.x - w.player.x),
      targets = this.enemies(w.player, s.range).sort(
        (a, b) => distance(a, t) - distance(b, t),
      );
    for (let i = 0; i < count; i++) {
      const target: Point = { ...targets[i % targets.length] },
        origin: Point = { ...w.player };
      const a: ExtraAttack = {
        active: true,
        skill,
        stats: skill === "lightning" ? s : replicaStats(s, i),
        created: w.time,
        age: 0,
        until: w.time + s.duration,
        next: 0,
        phase: 0,
        angle,
        start: { ...origin },
        target: { ...target },
        targetId: targets[i % targets.length]?.id,
        x: origin.x,
        y: origin.y,
        hit: new Set(),
        secondary: new Set(),
        points: [],
        group,
        index: i,
        travel: 0,
        speed: 18,
        companion: undefined,
      };
      this.behaviors[skill].initialize?.(a, {
        target: t,
        targets,
        count,
        stats: s,
      });
      this.put(a);
    }
  }
}
