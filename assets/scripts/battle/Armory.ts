import { SupportArmory } from "./SupportArmory";
import { UnlockedArmory } from "./UnlockedArmory";
import { ExtraArmory } from "./ExtraArmory";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Skill, WEAPONS, isElite, ENEMIES } from "./SurvivalConfig";
import {
  Enemy,
  Point,
  distance,
  segmentDistance,
  angleDelta,
} from "./SurvivalTypes";
import { weaponStats, WeaponStats, playerAttributes, orbitProgress } from "./ArmoryConfig";
export const ARMORY_LIMITS = { shots: 256, fields: 64, pending: 64 };
export interface ArmoryShot extends Point {
  active: boolean;
  skill: Skill;
  stats: WeaponStats;
  angle: number;
  speed: number;
  travel: number;
  range: number;
  hit: Set<number>;
  returning: boolean;
  end?: Point;
  child: boolean;
  group: number;
  age: number;
  until: number;
  start: Point;
  target: Point;
  orbit: boolean;
  index: number;
  trail?: Point[];
  spawnStep?: number;
}
export interface ArmoryField extends Point {
  active: boolean;
  skill: "fire" | "water";
  stats: WeaponStats;
  radius: number;
  baseRadius: number;
  created: number;
  until: number;
  angle: number;
  returnTarget?: Point;
  returning: boolean;
  next: number;
  interval: number;
  lastTick?: number;
}
interface Cast {
  skill: Skill;
  stats: WeaponStats;
  due: number;
  index: number;
  group: number;
  target: Point;
  origin: Point;
}
/** Bounded reusable entities. Every cast snapshots its modifiers and attributes. */
export class Armory {
  private stepIndex = 0;
  shots: ArmoryShot[] = [];
  fields: ArmoryField[] = [];
  pending: Cast[] = [];
  private groups = new Map<
    number,
    {
      left: number;
      shards: boolean;
      stats: WeaponStats;
      angle: number;
      end: Point;
    }
  >();
  readonly support: SupportArmory;
  readonly extra: ExtraArmory;
  readonly unlocked: UnlockedArmory;
  constructor(private w: SurvivalWorld) {
    this.support = new SupportArmory(w);
    this.extra = new ExtraArmory(w);
    this.unlocked = new UnlockedArmory(w);
  }
  private enemies(origin: Point, range: number) {
    return this.w.enemies.filter(
      (e) =>
        e.hp > 0 &&
        e.state !== "arriving" &&
        !e.sand?.buried &&
        distance(e, origin) <= range,
    );
  }
  private target(skill: Skill, s: WeaponStats) {
    const list = this.enemies(this.w.player, s.range);
    let best: Enemy | undefined,
      score = -Infinity;
    for (const e of list) {
      let value = -distance(e, this.w.player) * 0.01;
      if (skill === "blade")
        value +=
          isElite(e.kind) || /bow|spitter|mage|archer|sealclerk|folioray|spineclasp|reedwhistler|sickleplumer|foldedskimmer|vinecantor|wreathpod|bulbmaw|facetgastropod|prismmason|corebrood|prismcore|sluiceray|sailharpooner|winchbeast|crescentmantis|anchorweaver|arclantern|railsaw|thunderanchor|gridelectrode/.test(e.kind) ? 100 : 0;
      else
        for (const other of list)
          if (distance(other, e) <= s.radius * 1.3) value++;
      if (value > score) {
        score = value;
        best = e;
      }
    }
    return best;
  }
  private room(s: WeaponStats, skill: Skill) {
    const n = s.count;
    const shotNeed =
      skill === "water"
        ? n
        : skill === "blade"
          ? n + (s.mods.includes("shards") ? 2 : 0)
          : n * (s.mods.includes("embers") ? 3 : 1);
    // Include worst-case descendants and in-flight reservations; capacity never truncates a burst.
    const live = this.shots.filter((p) => p.active);
    const reserved =
      this.pending.reduce(
        (v, c) =>
          v + (c.skill === "fire" && c.stats.mods.includes("embers") ? 3 : 1),
        0,
      ) +
      live.filter(
        (p) =>
          p.skill === "fire" && !p.child && p.stats.mods.includes("embers"),
      ).length *
        2 +
      Array.from(this.groups.values()).filter((g) => g.shards).length * 2;
    const fieldReserved =
      live.filter(
        (p) =>
          p.skill === "water" ||
          (p.skill === "fire" && !p.child && p.stats.mods.includes("flame")),
      ).length +
      this.pending.filter(
        (c) =>
          c.skill === "water" ||
          (c.skill === "fire" && c.stats.mods.includes("flame")),
      ).length;
    const fieldNeed =
      skill === "water" || (skill === "fire" && s.mods.includes("flame"))
        ? n
        : 0;
    return (
      live.length + reserved + shotNeed <= ARMORY_LIMITS.shots &&
      this.fields.filter((f) => f.active).length + fieldReserved + fieldNeed <=
        ARMORY_LIMITS.fields &&
      this.pending.length + n <= ARMORY_LIMITS.pending
    );
  }
  step(dt: number) {
    this.stepIndex++;
    const w = this.w;
    this.support.step(dt);
    this.extra.step(dt);
    this.unlocked.step(dt);
    for (const skill of WEAPONS) {
      if (!["blade", "fire", "water"].includes(skill)) continue;
      if (!w.skills[skill]) continue;
      w.cooldowns[skill] = Math.max(0, w.cooldowns[skill] - dt);
      if (w.cooldowns[skill] > 0) continue;
      const s = weaponStats(w, skill),
        t = this.target(skill, s) || (skill==="blade"&&!s.mods.includes("hunt")?w.player:undefined);
      if(skill==="blade" && this.shots.some(p=>p.active&&p.orbit))continue;
      if (!t || !this.room(s, skill)) continue;
      this.cast(skill, s, t);
      w.cooldowns[skill] = s.cooldown;
      w.castCounts[skill] = (w.castCounts[skill] || 0) + 1;
      w.effects.push({ type: "cast", ...w.player, skill });
    }
    for (let i = this.pending.length - 1; i >= 0; i--)
      if (this.pending[i].due <= w.time) {
        const c = this.pending.splice(i, 1)[0];
        this.launch(c);
      }
    for (const p of this.shots)
      if (p.active && (!p.child || p.spawnStep !== this.stepIndex)) this.stepShot(p, dt);
    // Replace the completed orbit as a whole in the same frame: four/six
    // separate knives remain present, with new upgrades applied at the seam.
    if(w.skills.blade && !w.mods.blade.includes("hunt") && w.cooldowns.blade<=1e-7 &&
      !this.shots.some(p=>p.active&&p.orbit)) {
      const s=weaponStats(w,"blade");
      if(this.room(s,"blade")) {
        this.cast("blade",s,w.player);w.cooldowns.blade=s.cooldown;
        w.castCounts.blade=(w.castCounts.blade||0)+1;
        for(let i=this.pending.length-1;i>=0;i--)if(this.pending[i].skill==="blade"&&this.pending[i].due<=w.time) {
          const c=this.pending.splice(i,1)[0];this.launch(c);
        }
        for(const p of this.shots)if(p.active&&p.orbit&&p.age===0)this.stepShot(p,0);
      }
    }
    for (const f of this.fields) if (f.active) this.stepField(f, dt);
    this.tickFields();
  }
  private cast(skill: Skill, s: WeaponStats, target: Point) {
    const w = this.w,
      g = w.id(),
      angle = Math.atan2(target.y - w.player.y, target.x - w.player.x);
    if (skill === "blade")
      this.groups.set(g, {
        left: s.count,
        shards: s.mods.includes("shards"),
        stats: s,
        angle,
        end: { ...target },
      });
    const targets = this.enemies(w.player, s.range).sort(
      (a, b) => distance(a, target) - distance(b, target),
    );
    const chosen: Point[] = [];
    for (let i = 0; i < s.count; i++) {
      let t: Point = { ...target };
      if (skill === "water") {
        const distinct = targets.find((e) =>
          chosen.every((p) => distance(p, e) > s.radius * 1.2),
        );
        t = distinct
          ? { x: distinct.x, y: distinct.y }
          : {
              x: target.x + Math.cos(angle + i * 2.4) * s.radius,
              y: target.y + Math.sin(angle + i * 2.4) * s.radius,
            };
        chosen.push(t);
      } else if (skill === "fire" && s.mods.includes("salvo") && targets.length)
        t = { ...targets[i % Math.min(3, targets.length)] };
      const delay =
        skill === "fire"
          ? s.mods.includes("heavy")
            ? 0.35
            : s.mods.includes("salvo")
              ? Math.floor((i * 3) / s.count) * 0.12
              : 0
          : 0;
      this.pending.push({
        skill,
        stats: s,
        due: w.time + delay,
        index: i,
        group: g,
        target: t,
        origin: { ...w.player },
      });
    }
  }
  private launch(c: Cast, child = false) {
    const { skill, stats: s, origin: o, target: t } = c,
      base = Math.atan2(t.y - o.y, t.x - o.x);
    const angle =
      base +
      (skill === "blade" && !child && !s.mods.includes("orbit")
        ? (c.index - (s.count - 1) / 2) * 0.06
        : 0);
    const data: ArmoryShot = {
      active: true,
      skill,
      stats: s,
      x: o.x,
      y: o.y,
      angle,
      speed: skill === "blade" ? 15 : skill === "fire" ? (child ? 12 : 22) : 7,
      travel: 0,
      range: skill === "fire" ? Math.max(0.4, distance(o, t)) : s.range,
      hit: new Set(),
      returning: false,
      child,
      group: c.group,
      age: 0,
      until: this.w.time + (skill === "blade" ? s.duration : 3),
      start: { ...o },
      target: { ...t },
      orbit: skill === "blade" && !child && !s.mods.includes("hunt"),
      index: c.index,
      trail: [],
      spawnStep: this.stepIndex,
    };
    const slot = this.shots.find((p) => !p.active);
    if (slot) Object.assign(slot, data);
    else this.shots.push(data);
  }
  private hit(
    e: Enemy,
    damage: number,
    p: Point,
    skill: Skill,
    projectile = false,
  ) {
    this.w.hit(
      e,
      damage,
      skill,
      false,
      p,
      projectile,
      undefined,
      1,
      projectile,
      false,
    );
  }
  private stepShot(p: ArmoryShot, dt: number) {
    const w = this.w,
      s = p.stats,
      m = s.mods,
      old = { x: p.x, y: p.y };
    p.age += dt;
    if(p.skill === "blade" && !p.orbit && dt > 0) {
      p.trail ??= [];
      p.trail.push(old);
      if(p.trail.length>4)p.trail.shift();
    }
    if (p.skill === "water") {
      const q = Math.min(1, p.age / 0.45);
      p.x = p.start.x + (p.target.x - p.start.x) * q;
      p.y = p.start.y + (p.target.y - p.start.y) * q;
      if (q >= 1) {
        this.addField("water", p, p.angle, s);
        p.active = false;
      }
      return;
    }
    if (p.orbit) {
      const oldQ=Math.max(0,Math.min(1,(p.age-dt)/s.duration));
      const q = p.age+1e-8>=s.duration?1:Math.min(1, p.age / s.duration),
        radius =
          ((m.includes("orbit") ? 2.7 : 1.9) + (m.includes("return") ? 1.1 * Math.sin(q * Math.PI) : 0)) *
          playerAttributesFrom(s);
      // Start on the circumference: never sweep a phantom damage line through the hero.
      if (p.age === dt) {
        old.x = w.player.x + Math.cos(p.index * Math.PI * 2 / s.count) * radius;
        old.y = w.player.y + Math.sin(p.index * Math.PI * 2 / s.count) * radius;
      }
      p.angle = (p.index * Math.PI * 2) / s.count + orbitProgress(q) * Math.PI * 2;
      p.x = w.player.x + Math.cos(p.angle) * radius;
      p.y = w.player.y + Math.sin(p.angle) * radius;
      // Sample the actual circular sweep, not a chord through its empty centre.
      const slices=Math.max(1,Math.ceil((orbitProgress(q)-orbitProgress(oldQ))*48));
      for(let i=0;i<=slices;i++) {
        const t=oldQ+(q-oldQ)*i/slices;
        if(m.includes("return") && t>=.5 && !p.returning) {p.returning=true;p.hit.clear();}
        const rr=((m.includes("orbit")?2.7:1.9)+(m.includes("return")?1.1*Math.sin(t*Math.PI):0))*playerAttributesFrom(s);
        const angle=p.index*Math.PI*2/s.count+orbitProgress(t)*Math.PI*2;
        const sample={x:w.player.x+Math.cos(angle)*rr,y:w.player.y+Math.sin(angle)*rr};
        for(const e of this.enemies(sample,s.radius+.45))if(!p.hit.has(e.id)) {
          p.hit.add(e.id);this.hit(e,s.damage,sample,"blade",true);
        }
      }
      if (q >= 1) this.finish(p);
      return;
    }
    if (p.skill === "blade" && !p.child) {
      if (p.returning) {
        const t = p.end!;
        p.angle = Math.atan2(t.y - p.y, t.x - p.x);
        if (distance(p, t) <= p.speed * dt) {
          this.finish(p);
          return;
        }
      } else if (m.includes("hunt")) {
        const t = this.enemies(p, 6)
          .filter((e) => !p.hit.has(e.id))
          .sort(
            (a, b) =>
              Number(isElite(b.kind) || /bow|spitter/.test(b.kind)) -
                Number(isElite(a.kind) || /bow|spitter/.test(a.kind)) ||
              distance(a, p) - distance(b, p),
          )[0];
        if (t)
          p.angle += Math.max(
            -dt * 2.2,
            Math.min(
              dt * 2.2,
              angleDelta(Math.atan2(t.y - p.y, t.x - p.x), p.angle),
            ),
          );
      }
    }
    const step = Math.min(p.speed * dt, Math.max(0,p.range-p.travel));
    p.x += Math.cos(p.angle) * step;
    p.y += Math.sin(p.angle) * step;
    p.travel += step;
    const collisions = w.enemies
      .filter(
        (e) =>
          !(p.child && p.travel<(p.skill==="fire"?.5:.3)) &&
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried &&
          !p.hit.has(e.id) &&
          segmentDistance(e, old, p) <=
            (p.skill === "blade" ? s.radius : 0.24) + 0.45,
      )
      .sort((a, b) => distance(a, old) - distance(b, old));
    for (const e of collisions) {
      p.hit.add(e.id);
      if (p.skill === "fire") {
        // Resolve at first contact, even when a fast shot crosses a whole enemy in one frame.
        const dx=p.x-old.x,dy=p.y-old.y,len=Math.hypot(dx,dy);
        if(len>0) {
          const along=((e.x-old.x)*dx+(e.y-old.y)*dy)/len;
          const across2=(e.x-old.x)**2+(e.y-old.y)**2-along**2;
          const contact=Math.max(0,Math.min(len,along-Math.sqrt(Math.max(0,.69**2-across2))));
          p.x=old.x+dx/len*contact;p.y=old.y+dy/len*contact;
        }
        this.explode(p);
        return;
      }
      this.hit(e, s.damage, p, "blade", true);
      if (p.hit.size >= (m.includes("hunt") && !p.child ? 2 : 1)) {
        this.terminal(p);
        return;
      }
    }
    if (p.travel >= p.range || p.age > 4) this.terminal(p);
  }
  private terminal(p: ArmoryShot) {
    if (p.skill === "fire") {
      this.explode(p);
      return;
    }
    if (!p.child && !p.returning && p.stats.mods.includes("return")) {
      p.returning = true;
      p.hit.clear();
      p.travel = 0;
      p.end = { ...this.w.player };
      p.range = distance(p, p.end) + 0.1;
      return;
    }
    this.finish(p);
  }
  private finish(p: ArmoryShot) {
    p.active = false;
    if (p.child || p.skill !== "blade") return;
    const g = this.groups.get(p.group);
    if (!g) return;
    g.left--;
    g.end = { x: p.x, y: p.y };
    g.angle = p.orbit ? p.angle + Math.PI / 2 : p.angle;
    if (g.left > 0) return;
    this.groups.delete(p.group);
    if (g.shards) {
      for (let i = 0; i < 2; i++) {
        const a = g.angle + (i ? 0.32 : -0.32);
        const s = {
          ...g.stats,
          damage: g.stats.damage * 0.5,
          mods: [],
          range: 2.4,
        };
        this.launch(
          {
            skill: "blade",
            stats: s,
            due: this.w.time,
            index: i,
            group: p.group,
            origin: { ...g.end },
            target: {
              x: g.end.x + Math.cos(a) * 2,
              y: g.end.y + Math.sin(a) * 2,
            },
          },
          true,
        );
      }
    }
  }
  private explode(p: ArmoryShot) {
    p.active = false;
    const s = p.stats,
      m = s.mods;
    for (const e of this.enemies(p, s.radius + 0.45)) {
      const heavy = !p.child && m.includes("heavy");
      const damage =
        heavy && distance(e, p) > s.radius * 0.55
          ? (s.damage * 1.25) / 1.8
          : s.damage;
      this.hit(e, damage, p, "fire");
    }
    this.w.effects.push({
      type: "explosion",
      x: p.x,
      y: p.y,
      radius: s.radius,
      skill: "fire",
      form: p.child ? "ember" : m.includes("heavy") ? "heavy" : "base",
    });
    if (p.child) return;
    if (m.includes("flame")) this.addField("fire", p, p.angle, s);
    const explosionAngle = p.angle;
    if (m.includes("embers"))
      for (let i = 0; i < 2; i++) {
        const a = explosionAngle + (i ? 0.85 : -0.85),
          child = {
            ...s,
            damage: s.damage * 0.35,
            radius: s.radius * 0.6,
            mods: [],
          };
        this.launch(
          {
            skill: "fire",
            stats: child,
            origin: { x: p.x, y: p.y },
            target: { x: p.x + Math.cos(a) * 1.5, y: p.y + Math.sin(a) * 1.5 },
            group: p.group,
            index: i,
            due: this.w.time,
          },
          true,
        );
      }
  }
  private addField(
    skill: "fire" | "water",
    p: Point,
    angle: number,
    s: WeaponStats,
  ) {
    const w = this.w,
      interval = skill === "water" && s.mods.includes("pulse") ? 1 : 0.4,
      duration = s.duration;
    const f: ArmoryField = {
      active: true,
      skill,
      stats: s,
      x: p.x,
      y: p.y,
      created: w.time,
      until: w.time + duration,
      radius: s.radius,
      baseRadius: s.radius,
      angle,
      returning: false,
      next: (Math.floor((w.time + 1e-7) / interval) + 1) * interval,
      interval,
      lastTick: -Infinity,
    };
    if (skill === "water" && s.mods.includes("spring")) f.radius *= 0.45;
    const slot = this.fields.find((v) => !v.active);
    if (slot) Object.assign(slot, f);
    else this.fields.push(f);
  }
  private stepField(f: ArmoryField, dt: number) {
    const w = this.w;
    if (w.time >= f.until) {
      f.active = false;
      return;
    }
    if (f.skill !== "water") return;
    const m = f.stats.mods,
      q = (w.time - f.created) / (f.until - f.created);
    if (m.includes("recall") && q >= 0.5 && !f.returning) {
      f.returning = true;
      f.returnTarget = { ...w.player };
    }
    if (f.returning) {
      // Catch up across empty ground, then stay with enemies instead of outrunning them.
      const covered=this.enemies(f,f.radius+.35);
      const speed=covered.length ? Math.max(.6,Math.min(1.6,...covered.map(e =>
        e.freezeUntil>w.time ? 0 : ENEMIES[e.kind].speed*(e.slowUntil>w.time?1-e.slow:1)))) : 3.8;
      const t = f.returnTarget!,
        d = distance(f, t),
        step = Math.min(d, speed * dt);
      if (d > 0) {
        f.x += ((t.x - f.x) / d) * step;
        f.y += ((t.y - f.y) / d) * step;
      }
    } else if (m.includes("wave")) {
      f.x += Math.cos(f.angle) * 2.5 * dt;
      f.y += Math.sin(f.angle) * 2.5 * dt;
    } else if (m.includes("spring"))
      f.radius = f.baseRadius * (0.45 + 1.2 * Math.min(1, q * 2));
  }
  private tickFields() {
    const w = this.w;
    const due = this.fields.filter((f) => f.active && f.next <= w.time + 1e-7);
    if (!due.length) return;
    // Synchronized field cadence; select maximum same-weapon damage for each enemy, never sum overlaps.
    const buckets = new Map<
      string,
      { f: ArmoryField; damage: number; e: Enemy }
    >();
    for (const f of due) {
      f.lastTick=w.time;
      f.next = (Math.floor((w.time + 1e-7) / f.interval) + 1) * f.interval;
      const damage =
        f.skill === "fire"
          ? f.stats.damage * 0.12
          : f.stats.damage * (f.interval / 0.4);
      for (const e of this.enemies(f, f.radius + 0.35)) {
        const key = `${f.skill}:${e.id}`,
          prev = buckets.get(key);
        if (!prev || damage > prev.damage) buckets.set(key, { f, damage, e });
      }
      if (f.interval === 1)
        w.effects.push({
          type: "explosion",
          x: f.x,
          y: f.y,
          skill: "water",
          radius: f.radius,
        });
    }
    for (const { f, damage, e } of buckets.values())
      this.hit(e, damage, f, f.skill);
  }
}
// Area affects orbit reach as well as blade collision width, using the snapshot.
function playerAttributesFrom(s: WeaponStats) {
  return s.radius / 0.21;
}
