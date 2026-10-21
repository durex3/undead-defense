import { thunderDevice } from "./ThunderSystem";
import type { SurvivalWorld } from "./SurvivalWorld";
import { isElite, isLarge } from "./SurvivalConfig";
import {
  Enemy,
  Point,
  distance,
  segmentDistance,
  angleDelta,
} from "./SurvivalTypes";
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
type ExtraDamageBucket=Map<number,{a:ExtraAttack;damage:number}>;
/** One bounded slot owns an attack's entire lifecycle, including echoes and terminal effects. */
export class ExtraArmory {
  attacks: ExtraAttack[] = [];
  ghostCount = 0;
  private readonly attackStrategies:Record<ExtraSkill,(a:ExtraAttack,dt:number,ticks:ExtraDamageBucket,ends:ExtraDamageBucket)=>void>={
    frost:(a,dt)=>this.frost(a,dt),lightning:a=>this.lightning(a),ghost:(a,dt)=>this.ghost(a,dt),
    bone:(a,dt)=>this.bone(a,dt),mine:a=>this.mine(a),void:(a,dt,ticks,ends)=>this.void(a,dt,ticks,ends),holy:a=>this.holy(a),
  };
  constructor(private w: SurvivalWorld) {}
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
  private radius(a: ExtraAttack) {
    return a.stats.radius;
  }
  private has(a: ExtraAttack, id: string) {
    return a.stats.mods.includes(id);
  }
  private put(a: ExtraAttack) {
    const slot = this.attacks.find((v) => !v.active);
    if (slot) Object.assign(slot, a);
    else this.attacks.push(a);
  }
  private target(skill: ExtraSkill, s: WeaponStats) {
    const list = this.enemies(this.w.player, s.range);
    return list.sort((a, b) => {
      if (skill === "holy" || (skill === "ghost" && s.mods.includes("execution"))) {
        const rank = (e: Enemy) =>
          Number(isLarge(e.kind) || /bow|spitter|mage|sealclerk|folioray|spineclasp|reedwhistler|sickleplumer|foldedskimmer|vinecantor|wreathpod|bulbmaw|facetgastropod|prismmason|corebrood|prismcore|sluiceray|sailharpooner|winchbeast|crescentmantis|anchorweaver|arclantern|railsaw|thunderanchor|gridelectrode/.test(e.kind));
        const d = rank(b) - rank(a);
        if (d) return d;
      }
      return distance(a, this.w.player) - distance(b, this.w.player);
    })[0];
  }
  step(dt: number) {
    const w = this.w;
    for (const skill of EXTRA_WEAPONS) {
      this.castWeapon(skill,dt);
    }
    this.advance(dt);
  }
  castWeapon(skill: ExtraSkill,dt:number) {
    const w=this.w;
      if (!w.skills[skill]) return;
      w.cooldowns[skill] = Math.max(0, w.cooldowns[skill] - dt);
      if (w.cooldowns[skill] > 0) return;
      if (skill === "ghost" && this.attacks.some(a => a.active && a.skill === "ghost")) return;
      const s = weaponStats(w, skill),
        t = this.target(skill, s);
      if (!t) return;
      const count = skill === "lightning" ? 1 : skill === "ghost" ? Math.min(8,s.count) : s.count;
      if (this.attacks.filter((a) => a.active).length + count > EXTRA_LIMIT)
        return;
      this.cast(skill, s, t, count);
      w.cooldowns[skill] = s.cooldown;
      w.castCounts[skill] = (w.castCounts[skill] || 0) + 1;
      w.effects.push({ type: "cast", ...w.player, skill });

  }
  advance(dt:number) {
    const w=this.w;
    // Same-source black hole overlap is max-only, including synchronized terminal explosions.
    const ticks = new Map<number, { a: ExtraAttack; damage: number }>(),
      ends = new Map<number, { a: ExtraAttack; damage: number }>();
    for (const a of this.attacks)
      if (a.active) {
        a.age += dt;
        if (a.age < 0) continue;
        this.attackStrategies[a.skill](a,dt,ticks,ends);
      }
    for (const bucket of [ticks, ends])
      for (const [id, { a, damage }] of bucket) {
        const e = w.enemies.find((e) => e.id === id);
        if (e && e.hp > 0) this.damage(e, damage, a);
      }
  }
  private cast(skill: ExtraSkill, s: WeaponStats, t: Enemy, count: number) {
    if(skill==="ghost")this.ghostCount=count;
    const w = this.w,
      group = w.id(),
      angle = skill === "bone" ? this.boneDirection(s, t) : Math.atan2(t.y - w.player.y, t.x - w.player.x),
      targets = this.enemies(w.player, s.range).sort(
        (a, b) => distance(a, t) - distance(b, t),
      );
    for (let i = 0; i < count; i++) {
      let target: Point = { ...targets[i % targets.length] },
        origin: Point = { ...w.player };
      if (skill === "mine") {
        const theta = angle + Math.PI + (2 * Math.PI * i) / count,
          r = s.mods.includes("scatter") ? 2.5 : 1.3;
        origin = {
          x: w.player.x + Math.cos(theta) * r,
          y: w.player.y + Math.sin(theta) * r,
        };
        w.stageStrategy.map.resolve(origin, 0.2);
        target = { ...origin };
      }
      if (skill === "void") {
        const side = (i - (count - 1) / 2) * s.radius * 1.5;
        origin = {
          x: t.x - Math.sin(angle) * side,
          y: t.y + Math.cos(angle) * side,
        };
        target = { ...origin };
      }
      if (skill === "frost") origin = { ...w.player };
      if (skill === "holy") origin = { ...target };
      const a: ExtraAttack = {
        active: true,
        skill,
        stats: skill === "lightning" ? s : replicaStats(s,i),
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
        speed: skill === "ghost" ? 10 : 18,
        companion: skill === "ghost" ? i : undefined,
      };
      if (skill === "bone") {
        a.phase = -1;
        a.next = .2;
        a.angle =
          angle +
          (i - (count - 1) / 2) * (s.mods.includes("fan") ? 0.25 : 0.055);
        a.target = {
          x: origin.x + Math.cos(a.angle) * s.range,
          y: origin.y + Math.sin(a.angle) * s.range,
        };
      }
      if (skill === "frost") a.age = -i * 0.22;
      if (skill === "void")
        a.next = (Math.floor((w.time + 1e-7) / 0.4) + 1) * 0.4;
      if (skill === "holy")
        a.next =
          (s.mods.includes("execution") ? 0.8 : 0.55) +
          (s.mods.includes("rain") ? i * 0.18 : 0);
      if (skill === "lightning") {
        let last: Point = t;
        const seen = new Set<number>();
        for (let j = 0; j < s.count; j++) {
          const e =
            j === 0
              ? t
              : this.enemies(
                  last,
                  ((s.mods.includes("relay") ? 5.5 : 3.5) * s.radius) / 0.9,
                )
                  .filter((e) => !seen.has(e.id))
                  .sort((a, b) => distance(a, last) - distance(b, last))[0];
          if (!e) break;
          seen.add(e.id);
          a.points.push({ x: e.x, y: e.y });
          last = e;
        }
        if (s.mods.includes("storm"))
          a.points = targets.slice(0, s.count).map((e) => ({ x: e.x, y: e.y }));
      }
      this.put(a);
    }
  }
  private boneDirection(s: WeaponStats, fallback: Enemy) {
    const origin = this.w.player, list = this.enemies(origin, s.range);
    let best = Math.atan2(fallback.y-origin.y, fallback.x-origin.x), score = -1, nearest = Infinity;
    for (const candidate of list) {
      const angle = Math.atan2(candidate.y-origin.y,candidate.x-origin.x);
      const end = {x:origin.x+Math.cos(angle)*s.range,y:origin.y+Math.sin(angle)*s.range};
      const count = list.filter(e=>segmentDistance(e,origin,end)<=s.radius+.35).length;
      const d = distance(origin,candidate);
      if(count>score || (count===score && d<nearest)) {best=angle;score=count;nearest=d;}
    }
    return best;
  }
  private freeze(e: Enemy, a: ExtraAttack) {
    const w = this.w;
    if(e.kind==="prismcore"){if(!this.has(a,"brittle"))w.slow(e,true);return;}
    if (e.kind === "boss" || (e.immovable && !e.root && !e.wind && !e.library) || thunderDevice(e.kind) || (e.state === "charge" && !e.wind)) return;
    e.slow = 0.4;
    e.slowUntil = Math.max(e.slowUntil, w.time + a.stats.duration);
    if (this.has(a, "brittle") || e.freezeReady > w.time) return;
    e.freezeUntil = w.time + (isElite(e.kind) ? 0.25 : 0.75);
    e.freezeReady = w.time + 3;
  }
  private frost(a: ExtraAttack, dt: number) {
    const w = this.w,
      s = a.stats,
      r = s.radius;
    if (a.phase === 0) {
      const outward=this.has(a,"outward"), sectors=this.has(a,"sectors");
      const previous=a.age-dt;
      const edge = outward ? r * Math.min(1, Math.max(0,(a.age-.1)/.5)) : r;
      for (const e of this.enemies(a, r + 0.35)) {
        if (a.age < .1) continue;
        if (!outward && !sectors && previous >= .1) continue;
        if (a.hit.has(e.id)) continue;
        const d = distance(e, a);
        if (d > edge + 0.35) continue;
        if(outward && previous>=.1 && d < r*Math.min(1,(previous-.1)/.5)-.35) continue;
        if (sectors) {
          const angle = Math.atan2(e.y - a.y, e.x - a.x);
          let crossed=false;
          for(let sector=0;sector<3;sector++) {
            const at=.1+sector*.22;
            if(previous<at && a.age>=at && Math.abs(angleDelta(angle,a.angle+sector*Math.PI*2/3))<=Math.PI/3) crossed=true;
          }
          if(!crossed)continue;
        }
        a.hit.add(e.id);
        const brittle = this.has(a, "brittle") && e.slowUntil > w.time;
        this.damage(e, s.damage * (brittle ? 1.35 : 1), a);
        this.freeze(e, a);
      }
      if (a.age >= 0.66) {
        a.phase = 1;
        if (!this.has(a, "aftershock")) a.active = false;
      }
    } else if (a.phase === 1 && a.age >= 0.8) {
      for (const e of this.enemies(a, r + 0.35))
        this.damage(e, s.damage * 0.45, a);
      a.phase = 2;
      a.next = a.age + 0.18;
    }
    if (a.phase === 2 && a.age >= a.next) a.active = false;
  }
  private lightning(a: ExtraAttack) {
    const w = this.w,
      s = a.stats,
      storm = this.has(a, "storm");
    const strike = (p: Point, stats:WeaponStats, scale:number, seen: Set<number>) => {
      for (const e of this.enemies(
        p,
        (storm ? stats.radius : (0.48 * stats.radius) / 0.9) + 0.35,
      ))
        if (!seen.has(e.id)) {
          seen.add(e.id);
          this.damage(e, stats.damage*scale, a, p);
        }
    };
    if (a.phase === 0) {
      const n = storm ? Math.floor(a.age / 0.18) + 1 : a.points.length;
      while (a.index < Math.min(n, a.points.length)) {
        const i = a.index++,
          p = a.points[i];
        strike(p, replicaStats(s,i), 1, a.hit);
        if (this.has(a, "bridge") && i > 0) {
          const prev = a.points[i - 1];
          for (const e of w.enemies)
            if (
              e.hp > 0 &&
              e.state !== "arriving" &&
              !e.sand?.buried &&
              !a.secondary.has(e.id) &&
              segmentDistance(e, prev, p) < (0.24 * replicaStats(s,i).radius) / 0.9 + 0.35
            ) {
              a.secondary.add(e.id);
              this.damage(e, replicaStats(s,i).damage * 0.45, a, p);
            }
        }
      }
      if (a.index >= a.points.length) {
        a.phase = 1;
        a.next = a.age + (this.has(a, "echo") ? 0.45 : 0.25);
      }
    } else if (a.phase === 1 && a.age >= a.next) {
      if (this.has(a, "echo")) {
        const seen = new Set<number>();
        for (let i=0;i<a.points.length;i++) strike(a.points[i], replicaStats(s,i), .65, seen);
      }
      a.phase = 2;
      a.next = a.age + 0.18;
    }
    if (a.phase === 2 && a.age >= a.next) a.active = false;
  }
  private ghost(a: ExtraAttack, dt: number) {
    const w = this.w,
      s = a.stats,
      old = { x: a.x, y: a.y };
    if (a.age >= 3) {
      a.active = false;
      return;
    }
    if (a.phase === 0) {
      let e = w.enemies.find(
        (e) =>
          e.id === a.targetId &&
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried,
      );
      if(e && distance(e,w.player)>s.range)e=undefined;
      if (!e && !a.retargeted) {
        a.retargeted=true;
        const reserved=new Set(this.attacks.filter(b=>b!==a&&b.active&&b.skill==="ghost").map(b=>b.targetId));
        e=this.enemies(a,s.range).sort((l,r)=>Number(reserved.has(l.id))-Number(reserved.has(r.id)) || distance(l,a)-distance(r,a))[0];
        if(e)a.targetId=e.id;
      }
      if(!e) {a.phase=2;a.end={...w.player};return;}
      if (e) a.target = { x: e.x, y: e.y };
      a.angle=Math.atan2(a.target.y-a.y,a.target.x-a.x);
      this.move(a, a.target, a.speed * dt);
      const touched =
        this.enemies(a, 0.45 + s.radius).find((e) => e.id === a.targetId);
      if (touched || a.age >= 1.4) {
        if (touched) this.damage(touched, s.damage, a);
        a.start = { x: a.x, y: a.y };
        a.phase = !touched ? 2 : this.has(a, "haunt") ? 1 : 3;
        a.next = a.age + (a.phase===3 ? .22 : .3);
        a.travel=a.age+.45;
        a.index = 0;
        if (a.phase === 2) a.end = { ...w.player };
      }
    } else if (a.phase === 1) {
      const q = a.age - (a.next - 0.3);
      a.x = a.start.x + Math.cos(q * 10) * 0.6;
      a.y = a.start.y + Math.sin(q * 10) * 0.6;
      a.angle=Math.atan2(a.y-old.y,a.x-old.x);
      if (a.age >= a.next) {
        for (const e of this.enemies(a.start, 1 + s.radius))
          this.damage(e, s.damage * 0.7, a, a.start);
        a.index++;
        a.next += 0.3;
        if (a.index >= 3) {
          a.phase = 2;
          a.end = { ...w.player };
        }
      }
    } else if(a.phase===3) {
      const e=w.enemies.find(e=>e.id===a.targetId && e.hp>0 && e.state!=="arriving" && !e.sand?.buried);
      if(e) {
        a.angle=Math.atan2(e.y-a.y,e.x-a.x);
        this.move(a,e,a.speed*dt);
      }
      if(!e || a.age>=a.travel || (a.age>=a.next && distance(e,a)<=s.radius+.45)) {
        if(e && a.age>=a.next && distance(e,a)<=s.radius+.45) this.damage(e,s.damage,a);
        a.phase=2;a.end={...w.player};a.next=a.age;
      }
    } else {
      a.angle=Math.atan2(a.end!.y-a.y,a.end!.x-a.x);
      this.move(a, a.end!, 12 * dt);
      if (this.has(a, "reap"))
        for (const e of this.enemies(a, 1 + 12 * dt))
          if (
            !a.hit.has(e.id) &&
            segmentDistance(e, old, a) < s.radius + 0.45
          ) {
            a.hit.add(e.id);
            this.damage(e, s.damage * 0.65, a);
          }
      if (distance(a, a.end!) < 0.1) a.active = false;
    }
  }
  private move(a: Point, t: Point, step: number) {
    const d = distance(a, t);
    if (d > 0) {
      a.x += (t.x - a.x) * Math.min(1, step / d);
      a.y += (t.y - a.y) * Math.min(1, step / d);
    }
  }
  private bone(a: ExtraAttack, dt: number) {
    const s = a.stats,
      w = this.w;
    if(a.phase===-1) {
      a.x=w.player.x;a.y=w.player.y;
      if(a.age<.2)return;
      a.phase=0;
      dt=Math.min(dt,Math.max(0,a.age-.2));
    }
    const old = { x: a.x, y: a.y },
      step = Math.min(a.speed * dt, s.range - a.travel);
    a.x += Math.cos(a.angle) * step;
    a.y += Math.sin(a.angle) * step;
    a.travel += step;
    const hits = w.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried &&
          !a.hit.has(e.id) &&
          segmentDistance(e, old, a) <= s.radius + 0.35,
      )
      .sort((b, c) => distance(b, old) - distance(c, old));
    for (const e of hits) {
      if(e.hp<=0)continue;
      const stacks = this.has(a, "marrow") ? Math.min(3, a.hit.size) : 0;
      this.damage(e, s.damage * (1 + stacks * 0.15), a);
      a.hit.add(e.id);
      if(this.has(a,"ridge") && a.points.length<3) {
        // Burst at the actual pierced enemy, never an empty far endpoint.
        const center={x:e.x,y:e.y},radius=.9*s.radius/.24;
        a.points.push(center);
        w.effects.push({type:"explosion",skill:"bone",form:"boneBurst",...center,radius});
        for(const other of this.enemies(center,radius+.35))if(!a.secondary.has(other.id)) {
          a.secondary.add(other.id);
          this.damage(other,s.damage*.35,a,center);
        }
      }
      if (this.has(a, "marrow"))
        a.speed = 12 * (1 + Math.min(3, a.hit.size) * 0.15);
    }
    if (a.travel >= s.range - 0.001 || a.age >= 2) a.active=false;
  }
  private mine(a: ExtraAttack) {
    const w = this.w,
      s = a.stats,
      arm = this.has(a, "burrow") ? 1.2 : 0.6;
    if (a.phase === 0) {
      if (w.time >= a.until) {
        a.active = false;
        return;
      }
      if (a.age < arm) return;
      const trigger = ((this.has(a, "burrow") ? 0.6 : 0.8) * s.radius) / 1.8;
      let ready = this.enemies(a, trigger + 0.35).length > 0;
      if (this.has(a, "trip"))
        for (const b of this.attacks)
          if (
            b !== a &&
            b.active &&
            b.group === a.group &&
            b.phase === 0 &&
            b.age >= arm &&
            b.index === (a.index + 1) % s.count
          ) {
            if (
              w.enemies.some(
                (e) =>
                  e.hp > 0 &&
                  e.state !== "arriving" &&
                  !e.sand?.buried &&
                  segmentDistance(e, a, b) <= 0.2,
              )
            ) {
              ready = true;
              b.phase = 1;
              b.next = b.age;
            }
          }
      if (ready) {
        a.phase = 1;
        a.next = a.age;
      }
    }
    if (a.phase === 1 && a.age >= a.next) {
      this.blast(a, s.damage);
      a.phase = 2;
      a.next = a.age + (this.has(a, "fuse") ? 0.6 : 0.18);
    } else if (a.phase === 2 && a.age >= a.next) {
      if (this.has(a, "fuse")) this.blast(a, s.damage * 0.65);
      a.phase = 3;
      a.next = a.age + 0.18;
    }
    if (a.phase === 3 && a.age >= a.next) a.active = false;
  }
  private blast(a: ExtraAttack, damage: number) {
    for (const e of this.enemies(a, a.stats.radius + 0.35))
      this.damage(e, damage, a);
    this.w.effects.push({
      type: "explosion",
      skill: a.skill,
      x: a.x,
      y: a.y,
      radius: a.stats.radius,
    });
  }
  private void(
    a: ExtraAttack,
    dt: number,
    ticks: Map<number, { a: ExtraAttack; damage: number }>,
    ends: Map<number, { a: ExtraAttack; damage: number }>,
  ) {
    const w = this.w,
      s = a.stats,
      r = s.radius;
    const collect = (
      map: Map<number, { a: ExtraAttack; damage: number }>,
      e: Enemy,
      d: number,
    ) => {
      const prev = map.get(e.id);
      if (!prev || d > prev.damage) map.set(e.id, { a, damage: d });
    };
    if (a.phase === 1) {
      if (a.age >= a.next) a.active = false;
      return;
    }
    if (w.time >= a.until) {
      const repel = this.has(a, "repel"),
        radius = r * (repel ? 1.6 : 1);
      for (const e of this.enemies(a, radius + 0.35))
        if (!repel || distance(e, a) >= radius * 0.55)
          collect(
            ends,
            e,
            s.damage * (this.has(a, "collapse") ? 6 : 3) * (repel ? 1.5 : 1),
          );
      a.phase = 1;
      a.next = a.age + 0.25;
      return;
    }
    if (this.has(a, "drift")) {
      a.x += Math.cos(a.angle) * 1.3 * dt;
      a.y += Math.sin(a.angle) * 1.3 * dt;
    }
    for (const e of this.enemies(a, r + 0.35))
      if (
        !e.immovable && !isLarge(e.kind) &&
        e.state === "seek" &&
        !thunderDevice(e.kind) && !["sandegg", "warflag"].includes(e.kind)
      ) {
        const d = distance(e, a),
          step = Math.min(Math.max(0, d - 0.3), 1.4 * dt);
        if (d > 0) {
          e.x += ((a.x - e.x) * step) / d;
          e.y += ((a.y - e.y) * step) / d;
          w.stageStrategy.map.resolve(e, 0.35);
        }
      }
    if (w.time + 1e-7 >= a.next) {
      a.next = (Math.floor((w.time + 1e-7) / 0.4) + 1) * 0.4;
      for (const e of this.enemies(a, r + 0.35)) collect(ticks, e, s.damage);
    }
  }
  private holy(a: ExtraAttack) {
    const s = a.stats;
    const impact = (mult: number) => {
      for (const e of this.enemies(
        a,
        s.radius * (this.has(a, "cross") ? 2 : 1) + 0.35,
      )) {
        const dx = Math.abs(e.x - a.x),
          dy = Math.abs(e.y - a.y);
        if (
          this.has(a, "cross") &&
          !(
            Math.min(dx, dy) <= s.radius * 0.28 + 0.35 &&
            Math.max(dx, dy) <= s.radius * 2 + 0.35
          )
        )
          continue;
        this.damage(e, s.damage * mult, a);
      }
    };
    if (a.phase === 0 && a.age >= a.next) {
      impact(1);
      a.impactAt=a.age;
      a.phase = 1;
      a.next = a.age + (this.has(a, "brand") ? 0.7 : 0.25);
    } else if (a.phase === 1 && a.age >= a.next) {
      if (this.has(a, "brand")) {impact(0.65);a.impactAt=a.age;}
      a.phase = 2;
      a.next = a.age + 0.25;
    }
    if (a.phase === 2 && a.age >= a.next) a.active = false;
  }
}
