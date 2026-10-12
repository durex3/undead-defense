import type { SurvivalWorld } from "./SurvivalWorld";
import { Skill, isLarge } from "./SurvivalConfig";
import { Point, Enemy, distance, segmentDistance } from "./SurvivalTypes";
export const EXPANSION_SKILLS: Skill[] = [
  "water",
  "poison",
  "bone",
  "mine",
  "void",
  "bat",
];
export interface Field extends Point {
  id: number;
  skill: "water" | "poison" | "void";
  radius: number;
  created: number;
  due: number;
  until: number;
  damage: number;
  origin: Point;
  follow?: boolean;
}
export interface Mine extends Point {
  id: number;
  armed: number;
  until: number;
  queued: boolean;
}
export interface Bat extends Point {
  id: number;
  batch: number;
  target: number;
  hit: number[];
  returning: boolean;
  ttl: number;
  damage: number;
  maxHits: number;
}
interface BatBatch {
  remaining: number;
  healed: number;
  limit: number;
}
export class ExpansionWeapons {
  fields: Field[] = [];
  mines: Mine[] = [];
  bats: Bat[] = [];
  healed = 0;
  private nextLeech = 0;
  private lastPosition: Point;
  private walked = 0;
  private poisonReady = 0;
  private poisonSeen = 0;
  private poisonFresh = false;
  private fieldHits = new Map<string, number>();
  private poisonDeaths: number[] = [];
  private poisonBursts: Point[] = [];
  private batBatches = new Map<number, BatBatch>();
  private volleys: {
    due: number;
    angle: number;
    level: number;
    evolved: boolean;
  }[] = [];
  constructor(private w: SurvivalWorld) {
    this.lastPosition = { ...w.player };
  }
  remove(skill: Skill) {
    this.fields = this.fields.filter(f => f.skill !== skill);
    if (skill === "mine") this.mines = [];
    if (skill === "bat") { this.bats = []; this.batBatches.clear(); }
    if (skill === "bone") this.volleys = [];
    if (skill === "poison") { this.poisonSeen = 0; this.poisonFresh = false; this.walked = 0; this.poisonDeaths = []; this.poisonBursts = []; }
  }
  refresh(skill: Skill) {
    if (skill === "poison") this.poisonFresh = true;
  }
  step(dt: number) {
    const w = this.w;
    this.walked += w.skills.poison ? distance(w.player, this.lastPosition) : 0;
    this.lastPosition = { ...w.player };
    if (w.skills.poison > this.poisonSeen) {
      this.poisonSeen = w.skills.poison;
      this.poisonFresh = true;
    }
    for (const skill of EXPANSION_SKILLS) {
      w.cooldowns[skill] = Math.max(0, w.cooldowns[skill] - dt);
      if (!w.skills[skill]) continue;
      if (skill === "poison") {
        if (
          this.poisonFresh ||
          (this.walked >= (w.skills.poison >= 4 ? 2 : 3) &&
            w.time >= this.poisonReady)
        ) {
          this.cast(skill);
          this.poisonFresh = false;
          this.walked = 0;
          this.poisonReady = w.time + 0.6;
        }
        continue;
      }
      const hasTarget =
        skill === "void"
          ? w.enemies.some(
              (e) =>
                e.hp > 0 &&
                e.state !== "arriving" &&
                distance(e, w.player) >= 2.5 &&
                distance(e, w.player) < 7,
            )
          : !!w.target(w.player, skill === "bat" ? 7 : 8);
      if (
        w.cooldowns[skill] <= 0 &&
        (skill === "water" || skill === "mine" || hasTarget)
      ) {
        this.cast(skill);
        const base =
          skill === "water"
            ? 3
            : skill === "mine"
              ? 3
              : skill === "bone"
                ? w.weaponEvolution("bone")
                  ? 2
                  : 1.8
                : skill === "void"
                  ? w.skills.void >= 4
                    ? 4.8
                    : 6
                  : w.skills.bat >= 3
                    ? 3
                    : 4;
        w.cooldowns[skill] = base * w.cooldownFactor(skill);
      }
    }
    const due = this.volleys.filter((v) => v.due <= w.time);
    this.volleys = this.volleys.filter((v) => v.due > w.time);
    for (const v of due) this.boneVolley(v.angle, v.level, v.evolved);
    this.stepFields(dt);
    this.stepMines();
    this.stepBats(dt);
    for (const [key, until] of this.fieldHits)
      if (until < w.time - 2) this.fieldHits.delete(key);
  }
  private field(
    skill: Field["skill"],
    p: Point,
    radius: number,
    duration: number,
    damage: number,
    delay = 0,
  ) {
    const w = this.w;
    this.fields.push({
      id: w.id(),
      skill,
      x: Math.max(-22, Math.min(22, p.x)),
      y: Math.max(-26, Math.min(26, p.y)),
      radius,
      created: w.time,
      due: w.time + delay,
      until:
        w.time +
        delay +
        duration * (w.character === "alchemist" && skill !== "void" ? 1.2 : 1),
      damage,
      origin: { ...w.player },
    });
    if (this.fields.length > 64) this.fields.shift();
  }
  cast(skill: Skill) {
    const w = this.w,
      level = w.skills[skill];
    w.castCounts[skill] = (w.castCounts[skill] || 0) + 1;
    w.effects.push({ type: "cast", ...w.player, skill });
    if (skill === "water") {
      if (w.weaponEvolution("water") === "tide") {
        this.field("water", w.player, 3.2, 4, w.attack * 0.8, 0.35);
        const f = this.fields[this.fields.length - 1];
        if (f) f.follow = true;
        return;
      }
      let direction = { ...w.lastMove };
      let throwDistance = 2;
      const aimed =
        w.target(w.player, 4.5);
      if (Math.hypot(w.move.x, w.move.y) < 0.1) {
        const target = w.target();
        if (target) {
          const d = distance(target, w.player);
          direction = {
            x: (target.x - w.player.x) / Math.max(0.01, d),
            y: (target.y - w.player.y) / Math.max(0.01, d),
          };
        }
      }
      if (aimed) {
        const d = distance(aimed, w.player);
        direction = {
          x: (aimed.x - w.player.x) / Math.max(0.01, d),
          y: (aimed.y - w.player.y) / Math.max(0.01, d),
        };
        throwDistance = Math.max(0.4, Math.min(3, d));
      }
      const count = w.weaponEvolution("water")
        ? 5
        : level >= 10
          ? 5
          : level >= 7
            ? 4
        : level >= 4
          ? 3
          : level >= 2
            ? 2
            : 1;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 1.7;
        this.field(
          "water",
          {
            x: w.player.x + direction.x * throwDistance - direction.y * offset,
            y: w.player.y + direction.y * throwDistance + direction.x * offset,
          },
          w.weaponEvolution("water") ? 2.8 : level >= 10 ? 2.5 : level >= 7 ? 2.1 : level >= 3 ? 1.9 : 1.6,
          level >= 10 ? 5.5 : level >= 7 ? 4.8 : level >= 3 ? 5 : 4,
          w.attack * (w.weaponEvolution("water") ? 0.65 : 0.5),
          0.35,
        );
      }
      return;
    }
    if (skill === "poison") {
      this.field(
        "poison",
        {
          x: w.player.x - w.lastMove.x * 0.35,
          y: w.player.y - w.lastMove.y * 0.35,
        },
        level >= 10 ? 2.4 : level >= 7 ? 1.9 : level >= 3 ? 1.5 : 1.1,
        level >= 10 ? 7 : level >= 7 ? 5.5 : level >= 2 ? 4.5 : 3,
        w.attack * 0.5,
      );
      return;
    }
    if (skill === "mine") {
      for (let i = 0; i < (level >= 10 ? 5 : level >= 7 ? 4 : level >= 2 ? 2 : 1); i++) {
        if (this.mines.length >= 24) break;
        const offset = level >= 2 ? (i - 0.5) * 1.2 : 0;
        this.mines.push({
          id: w.id(),
          x: w.player.x - w.lastMove.y * offset,
          y: w.player.y + w.lastMove.x * offset,
          armed: w.time + 0.5,
          until: w.time + 8,
          queued: false,
        });
      }
      return;
    }
    if (skill === "void") {
      const candidates = w.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            e.state !== "arriving" &&
            distance(e, w.player) < 7 &&
            distance(e, w.player) >= 2.5,
        )
        .sort(
          (a, b) => w.near(b, 2).length - w.near(a, 2).length || a.id - b.id,
        );
      const t = candidates[0];
      if (!t) {
        w.cooldowns.void = 0;
        return;
      }
      this.field(
        "void",
        t,
        level >= 2 ? 2.8 : 2,
        level >= 3 ? 2 : 1.5,
        w.attack * (w.weaponEvolution("void") ? 2 : 0.8),
      );
      return;
    }
    if (skill === "bone") {
      const t = w.target();
      if (!t) return;
      const angle = Math.atan2(t.y - w.player.y, t.x - w.player.x);
      this.boneVolley(angle, level, !!w.weaponEvolution("bone"));
      if (level >= 4 && !w.weaponEvolution("bone"))
        this.volleys.push({ due: w.time + 0.25, angle, level, evolved: false });
      return;
    }
    if (skill === "bat") {
      const count = w.weaponEvolution("bat") ? 6 : level >= 10 ? 10 : level >= 7 ? 8 : level >= 4 ? 6 : level >= 2 ? 4 : 2;
      const batchId = w.id();
      const batch = {
        remaining: 0,
        healed: 0,
        limit: w.weaponEvolution("bat") ? 3 : level >= 10 ? 4 : level >= 7 ? 3 : level >= 4 ? 2 : 1,
      };
      this.batBatches.set(batchId, batch);
      const targets: number[] = [];
      for (let i = 0; i < count && this.bats.length < 64; i++) {
        const t = w.target(w.player, 7, targets) || w.target(w.player, 7);
        if (!t) break;
        targets.push(t.id);
        this.bats.push({
          id: w.id(),
          batch: batchId,
          x: w.player.x + Math.cos((i * Math.PI * 2) / count) * 0.2,
          y: w.player.y + Math.sin((i * Math.PI * 2) / count) * 0.2,
          target: t.id,
          hit: [],
          returning: false,
          ttl: 6,
          damage:
            w.attack * 0.6 * (w.weaponEvolution("bat") && w.hp >= w.maxHp * .7 ? 1.2 : 1),
          maxHits: level >= 10 ? 4 : level >= 7 ? 3 : level >= 4 ? 2 : 1,
        });
        batch.remaining++;
      }
      if (!batch.remaining) this.batBatches.delete(batchId);
    }
  }
  private boneVolley(angle: number, level: number, evolved: boolean) {
    const w = this.w,
      count = evolved ? 1 : level >= 10 ? 7 : level >= 7 ? 5 : level >= 2 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * 0.2;
      w.shots.push({
        id: w.id(),
        skill: "bone",
        ...w.player,
        vx: Math.cos(a) * 13,
        vy: Math.sin(a) * 13,
        damage: w.attack * (evolved ? 3 : level >= 2 ? 0.8 : 1.2),
        left: evolved ? 75 : level >= 3 ? 7 : 4,
        hit: [],
        target: 0,
        ttl: 10 / 13,
        age: 0,
        range: 10,
        returning: false,
        width: evolved ? 0.8 : 0.25,
        extra: 0,
        excursion: 0,
      });
    }
  }
  private stepFields(dt: number) {
    const w = this.w;
    const pulls = new Set<number>();
    for (const f of this.fields) {
      if (f.follow) { f.x = w.player.x; f.y = w.player.y; }
      if (f.due > w.time) continue;
      if (f.until <= w.time) {
        if (f.skill === "void") {
          for (const e of w.near(f, f.radius))
            w.hit(e, f.damage, "void", false, f, false);
          w.effects.push({
            type: "explosion",
            x: f.x,
            y: f.y,
            radius: f.radius,
            skill: "void",
          });
        }
        continue;
      }
      for (const e of w.near(f, f.radius)) {
        if (e.state === "arriving") continue;
        if (f.skill === "void") {
          const key = f.skill + ":" + e.id;
          if ((this.fieldHits.get(key) || 0) <= w.time) {
            this.fieldHits.set(key, w.time + .5);
            w.hit(e, f.damage * .28, "void", false, f, false);
          }
          if (e.kind !== "boss" && !pulls.has(e.id)) {
            const d = distance(e, f),
              move = Math.min(
                d,
                0.7 * (isLarge(e.kind) || e.kind === "shield" ? 0.5 : 1) * dt,
              );
            e.x += ((f.x - e.x) / Math.max(0.01, d)) * move;
            e.y += ((f.y - e.y) / Math.max(0.01, d)) * move;
            pulls.add(e.id);
          }
          continue;
        }
        if (
          (f.skill === "poison" && w.skills.poison >= 3) ||
          (f.skill === "water" && w.weaponEvolution("water"))
        ) {
          e.slow = Math.max(
            e.slowUntil > w.time ? e.slow : 0,
            isLarge(e.kind) ? 0.1 : 0.2,
          );
          e.slowUntil = Math.max(e.slowUntil, w.time + 0.15);
        }
        const key = f.skill + ":" + e.id;
        if ((this.fieldHits.get(key) || 0) > w.time) continue;
        this.fieldHits.set(key, w.time + (f.skill === "water" ? 0.5 : 1));
        const purified = f.skill === "water" && !!w.evolutions.water && w.skills.poison >= 10 &&
          this.fields.some(p => p.skill === "poison" && p.due <= w.time && p.until > w.time && distance(e, p) <= p.radius);
        w.hit(e, f.damage * (purified ? 1.5 : 1), f.skill, false, f, false, purified ? "water" : undefined, purified ? 1 / 3 : 1);
        if (purified) w.combinations.trigger("water", "comboPurify", e, 0.65);
      }
    }
    this.fields = this.fields.filter((f) => f.until > w.time);
    const bursts = this.poisonBursts;
    this.poisonBursts = [];
    for (const p of bursts) {
      for (const e of w.near(p, 1))
        w.hit(e, w.attack * 0.5, "poisonBurst", false, p, false);
      w.effects.push({ type: "explosion", ...p, radius: 1, skill: "poison" });
    }
  }
  onDeath(e: Enemy, source: string) {
    const w = this.w;
    if (isLarge(e.kind) || source === "poisonBurst" || !w.weaponEvolution("poison"))
      return;
    if (
      !this.fields.some(
        (f) =>
          f.skill === "poison" &&
          f.due <= w.time &&
          f.until > w.time &&
          distance(e, f) < f.radius,
      )
    )
      return;
    this.poisonDeaths = this.poisonDeaths.filter((t) => t > w.time - 1);
    if (this.poisonDeaths.length >= 4) return;
    this.poisonDeaths.push(w.time);
    this.poisonBursts.push({ x: e.x, y: e.y });
  }
  /** A completed bone/mine recipe lets a passing spear remotely arm the queue. */
  queueMinesOnSegment(from: Point, to: Point) {
    const w = this.w;
    if (!w.evolutions.bone || w.skills.bone < 10 || w.skills.mine < 10) return;
    for (const mine of this.mines)
      if (mine.armed <= w.time && mine.until > w.time && segmentDistance(mine, from, to) <= 0.65) mine.queued = true;
  }
  private stepMines() {
    const w = this.w;
    this.mines = this.mines.filter((m) => m.until > w.time);
    for (const m of this.mines)
      if (m.armed <= w.time && w.near(m, 1).some((e) => e.state !== "arriving"))
        m.queued = true;
    const fired = new Set<number>();
    let count = 0;
    while (count < 4) {
      const m = this.mines.find(
        (m) => m.queued && !fired.has(m.id) && m.armed <= w.time,
      );
      if (!m) break;
      count++;
      fired.add(m.id);
      const radius = w.skills.mine >= 3 ? 2.2 : 1.7;
      for (const e of w.near(m, radius)) {
        w.hit(e, w.attack * 1.8, "mine", false, m);
        if (w.skills.mine >= 4 && e.freezeReady <= w.time) {
          if (e.kind === "boss") {
            e.slow = Math.max(e.slowUntil > w.time ? e.slow : 0, 0.1);
            e.slowUntil = w.time + 0.35;
          } else {
            w.slow(e, true);
            e.freezeUntil = w.time + (isLarge(e.kind) ? 0.175 : 0.35);
          }
        }
      }
      w.effects.push({
        type: "explosion",
        x: m.x,
        y: m.y,
        radius,
        skill: "mine",
      });
      if (w.evolutions.bone && w.skills.bone >= 10 && w.skills.mine >= 10) {
        const shardRadius = radius + 0.8;
        for (const e of w.near(m, shardRadius)) w.hit(e, w.attack * 0.55, "bone", false, m, true, "bone");
        w.combinations.trigger("bone", "comboBone", m, shardRadius);
      }
      if (w.weaponEvolution("mine"))
        for (const other of this.mines)
          if (other.armed <= w.time && distance(other, m) < 3)
            other.queued = true;
    }
    this.mines = this.mines.filter((m) => !fired.has(m.id));
  }
  private stepBats(dt: number) {
    const w = this.w;
    const alive: Bat[] = [];
    for (const b of this.bats) {
      b.ttl -= dt;
      let done = b.ttl <= 0;
      const batch = this.batBatches.get(b.batch);
      if (!done) {
        const old = { x: b.x, y: b.y };
        if (!b.returning) {
          let target = w.enemies.find(
            (e) => e.id === b.target && e.hp > 0 && e.state !== "arriving",
          );
          if (!target) {
            target = w.target(b, 7, b.hit);
            if (target) b.target = target.id;
            else b.returning = true;
          }
          if (target && !b.returning) {
            const d = distance(target, b),
              move = Math.min(d, 7 * dt);
            b.x += ((target.x - b.x) / Math.max(0.01, d)) * move;
            b.y += ((target.y - b.y) / Math.max(0.01, d)) * move;
            if (segmentDistance(target, old, b) < 0.45) {
              w.combinations.mark("ghost", target);
              w.hit(target, b.damage, "bat", false, old);
              b.hit.push(target.id);
              const next =
                b.hit.length < b.maxHits ? w.target(b, 3, b.hit) : undefined;
              if (next) b.target = next.id;
              else b.returning = true;
            }
          }
        } else {
          const d = distance(b, w.player),
            move = Math.min(d, 9 * dt);
          b.x += ((w.player.x - b.x) / Math.max(0.01, d)) * move;
          b.y += ((w.player.y - b.y) / Math.max(0.01, d)) * move;
          if (distance(b, w.player) < 0.4) {
            done = true;
            if (
              w.hp > 0 && w.hp < w.maxHp * .7 &&
              w.time >= this.nextLeech && w.time - w.lastHurt >= 2 &&
              batch &&
              b.hit.length &&
              batch.healed < batch.limit
            ) {
              batch.healed++;
              const restored = Math.min(1, w.maxHp * .7 - w.hp);
              this.nextLeech = w.time + 2.5;
              w.hp += restored;
              this.healed += restored;
              if (restored) w.touch();
              if (restored)
                w.effects.push({
                  type: "heal",
                  ...w.player,
                  skill: "bat",
                  value: restored,
                });
            }
          }
        }
      }
      if (done) {
        if (batch && --batch.remaining <= 0) this.batBatches.delete(b.batch);
      } else alive.push(b);
    }
    this.bats = alive;
  }
}
