import type { SurvivalWorld } from "./SurvivalWorld";
import { weaponStats, WeaponStats } from "./ArmoryConfig";
import type { UnlockSkill } from "./UnlockConfig";
import {
  Enemy,
  Point,
  angleDelta,
  distance,
  segmentDistance,
} from "./SurvivalTypes";
export interface UnlockAttack extends Point {
  active: boolean;
  skill: UnlockSkill;
  stats: WeaponStats;
  start: Point;
  end: Point;
  angle: number;
  created: number;
  last: number;
  phase: number;
  index: number;
  parent: boolean;
  returning: boolean;
  hit: Set<number>;
}
export const UNLOCK_ATTACK_LIMIT = 80;
/** Every entity and delayed hit owns its cast snapshot; children never spawn children. */
export class UnlockedArmory {
  attacks: UnlockAttack[] = [];
  private side = 1;
  private readonly attackStrategies:Record<UnlockSkill,(a:UnlockAttack)=>void>={hammer:a=>this.hammer(a),wheel:a=>this.wheel(a)};
  constructor(private w: SurvivalWorld) {}
  private add(
    skill: UnlockSkill,
    s: WeaponStats,
    origin: Point,
    end: Point,
    angle: number,
    due: number,
    index: number,
    parent = true,
  ) {
    let a = this.attacks.find((a) => !a.active);
    if (!a) {
      if (this.attacks.length >= UNLOCK_ATTACK_LIMIT) return;
      a = {} as UnlockAttack;
      this.attacks.push(a);
    }
    Object.assign(a, {
      active: true,
      skill,
      stats: s,
      ...origin,
      start: { ...origin },
      end: { ...end },
      angle,
      created: due,
      last: due,
      phase: 0,
      index,
      parent,
      returning: false,
      hit: new Set<number>(),
    });
    return a;
  }
  private targets(p: Point, r: number) {
    return this.w.enemies.filter(
      (e) =>
        e.hp > 0 &&
        e.state !== "arriving" &&
        !e.sand?.buried &&
        distance(e, p) < r,
    );
  }
  private hit(e: Enemy, a: UnlockAttack, damage: number, layers: number) {
    if (layers) this.w.fracture(e, layers);
    this.w.hit(e, damage, a.skill, false, a);
  }
  step(dt: number) {
    const w = this.w;
    for (const skill of ["hammer", "wheel"] as const) {
      this.castWeapon(skill,dt);
    }
    this.advance(dt);
  }
  castWeapon(skill: UnlockSkill,dt:number) {
    const w=this.w;
      if (!w.skills[skill]) return;
      w.cooldowns[skill] = Math.max(0, w.cooldowns[skill] - dt);
      if (w.cooldowns[skill] > 0) return;
      const s = weaponStats(w, skill),
        target = w.target(
          w.player,
          skill === "hammer" ? s.radius + 0.5 : s.range,
        );
      if (
        !target ||
        this.attacks.filter((a) => a.active).length +
          Math.min(16, s.count) * 6 >
          UNLOCK_ATTACK_LIMIT
      )
        return;
      const angle = Math.atan2(target.y - w.player.y, target.x - w.player.x),
        n = Math.min(16, s.count),
        sweep = skill === "hammer" && s.mods.includes("sweep");
      for (let i = 0; i < n; i++) {
        // A full-strength opening strike plus weaker follow-ups. Keep the big
        // first hit without multiplying damage and fracture value by quantity.
        const strike = i === 0 ? s : {...s,damage:s.damage*.4};
        const a =
            angle +
            (skill === "wheel"
              ? (i - (n - 1) / 2) * (s.mods.includes("twin") ? 0.32 : 0.12)
              : 0),
          end = {
            x: w.player.x + Math.cos(a) * s.range,
            y: w.player.y + Math.sin(a) * s.range,
          };
        this.add(
          skill,
          strike,
          w.player,
          end,
          a,
          w.time + (skill === "hammer" ? 0.35 : 0.25) + i * 0.12,
          this.side,
        );
        if (sweep)
          this.add(
            skill,
            strike,
            w.player,
            end,
            a + Math.PI / 3,
            w.time + 0.35 + 0.43 + i * 0.12,
            this.side,
            false,
          );
      }
      // Rebound is once per whole hammer volley, never once per spawned strike.
      if (skill === "hammer" && s.mods.includes("return")) {
        const a = this.add(
          skill,
          s,
          w.player,
          w.player,
          angle,
          w.time + 0.35 + (n - 1) * 0.12 + (sweep ? 0.43 : 0) + 0.18 + 0.6,
          this.side,
          false,
        );
        if (a) {
          a.phase = 2;
          a.returning = true;
        }
      }
      this.side *= -1;
      w.cooldowns[skill] = s.cooldown;
      w.castCounts[skill] = (w.castCounts[skill] || 0) + 1;
      w.effects.push({ type: "cast", ...w.player, skill });

  }
  advance(dt:number) {
    const w=this.w;
    for (const a of this.attacks)
      if (a.active) {
        if (w.time < a.created) continue;
        this.attackStrategies[a.skill](a);
      }
  }
  private hammer(a: UnlockAttack) {
    const w = this.w,
      s = a.stats,
      age = w.time - a.created;
    if (a.phase === 3) {
      const old = { x: a.x, y: a.y },
        q = Math.min(1, age / 0.4);
      a.x = a.start.x + Math.cos(a.angle) * 4 * q;
      a.y = a.start.y + Math.sin(a.angle) * 4 * q;
      for (const e of this.targets(a.start, 5))
        if (
          !a.hit.has(e.id) &&
          segmentDistance(e, old, a) < (0.325 * s.radius) / 3 + 0.35
        ) {
          a.hit.add(e.id);
          this.hit(e, a, s.damage * 0.45, 0);
        }
      if (q >= 1) a.active = false;
      return;
    }
    if (!a.hit.has(-1)) {
      a.hit.add(-1);
      for (const e of this.targets(a.start, s.radius + 0.35))
        if (
          Math.abs(angleDelta(Math.atan2(e.y - a.y, e.x - a.x), a.angle)) <
          (95 * Math.PI) / 360 +
            Math.asin(Math.min(1, 0.35 / Math.max(0.35, distance(e, a))))
        ) {
          this.hit(
            e,
            a,
            s.damage * (a.returning ? 0.65 : 1),
            s.mods.includes("heavy") ? 2 : 1,
          );
        }
      w.effects.push({
        type: "explosion",
        ...a,
        radius: s.radius,
        skill: "hammer",
      });
      if (!a.returning && s.mods.includes("rift")) {
        const child = this.add(
          "hammer",
          s,
          a.start,
          a.end,
          a.angle,
          w.time,
          a.index,
          false,
        );
        if (child) child.phase = 3;
      }
    }
    if (age >= 0.18) a.active = false;
  }
  private wheel(a: UnlockAttack) {
    const w = this.w,
      s = a.stats,
      speed = s.mods.includes("heavy") ? 5.5 : 7,
      travel = s.range / speed,
      hold = s.mods.includes("grind") ? 0.9 : 0.15,
      age = w.time - a.created,
      old = { x: a.x, y: a.y },
      out = age < travel;
    const phase = out ? 0 : age < travel + hold ? 1 : 2;
    if (phase !== a.phase) {
      a.hit.clear();
      a.phase = phase;
    }
    if (phase === 0) {
      const q = Math.min(1, age / travel);
      a.x = a.start.x + (a.end.x - a.start.x) * q;
      a.y = a.start.y + (a.end.y - a.start.y) * q;
    } else if (phase === 1) {
      a.x = a.end.x;
      a.y = a.end.y;
      if (s.mods.includes("grind"))
        for (let k = 0; k < 2; k++)
          if (age >= travel + 0.25 + k * 0.4 && !a.hit.has(-1 - k)) {
            a.hit.add(-1 - k);
            for (const e of this.targets(a, (0.75 * s.radius) / 0.3))
              this.hit(e, a, s.damage * 0.4, 0);
          }
    } else {
      const q = Math.min(1, (age - travel - hold) / travel),
        curve = s.mods.includes("curve")
          ? Math.sin(q * Math.PI) * 2 * a.index
          : 0;
      a.x = a.end.x + (a.start.x - a.end.x) * q - Math.sin(a.angle) * curve;
      a.y = a.end.y + (a.start.y - a.end.y) * q + Math.cos(a.angle) * curve;
    }
    if (phase !== 1)
      for (const e of w.enemies)
        if (
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried &&
          !a.hit.has(e.id) &&
          segmentDistance(e, old, a) < s.radius + 0.35
        ) {
          a.hit.add(e.id);
          this.hit(
            e,
            a,
            s.damage * (phase === 2 && s.mods.includes("curve") ? 1.35 : 1),
            phase === 0 && s.mods.includes("heavy") ? 2 : 1,
          );
        }
    a.last = w.time;
    if (age >= travel * 2 + hold) a.active = false;
  }
}
