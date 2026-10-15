import {mapApproach,mapPackOffset} from './MapEncounters';
import type { SurvivalWorld } from "./SurvivalWorld";
import {
  Enemy,
  Hazard,
  Point,
  distance,
  segmentDistance,
} from "./SurvivalTypes";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { sandMap } from "./SandMap";
import { crownEscape } from "./CrownSystem";
import { hordePressure } from "./HordePressure";
export const SAND_KINDS: readonly Kind[] = [
  "sandworker",
  "sandlarva",
  "sandegg",
  "shellroller",
  "sandspitter",
  "sandstalker",
  "broodelite",
  "breakerelite",
];
export const sandEnemy = (kind: Kind) => SAND_KINDS.includes(kind);
export const sandRest = (t: number) =>
  (t >= 167 && t < 175) ||
  (t >= 285 && t < 293) ||
  (t >= 337 && t < 345) ||
  (t >= 472 && t < 480);
export function sandHint(t: number) {
  return sandRest(t)
    ? "暂歇 · 清理虫卵、回收经验"
    : t < 25
      ? "工虫死亡会分裂 · 清掉幼虫再回收"
      : t < 60
        ? "滚虫还会折返 · 引它撞岩反击"
        : t < 100
          ? "喷砂连续三段 · 看清偏转方向"
          : t < 135
            ? "潜沙落点已经锁定 · 出土后反击"
            : "先拆虫卵 · 躲首击后准备再次换向";
}
export class SandSystem {
  readonly stats = {
    packs: 0,
    split: 0,
    hatch: 0,
    roll: 0,
    spit: 0,
    burrow: 0,
    elite: 0,
    boss: 0,
    follow: 0,
    degraded: 0,
    rejected: 0,
    peakHazards: 0,
  };
  private reservations = new Map<number, number>();
  private mapWave=0;
  private nextGroup = 0;
  private special = 25;
  private bossCycle = 0;
  constructor(private w: SurvivalWorld) {}
  reserved(except = 0) {
    let n = 0;
    for (const [id, k] of this.reservations) if (id !== except) n += k;
    return n;
  }
  release(e: Enemy) {
    this.reservations.delete(e.id);
  }
  private reserve(e: Enemy, n: number) {
    const w = this.w;
    if (
      w.hazards.filter((h) => h.source !== e.id).length +
        this.reserved(e.id) +
        n >
      2
    )
      return false;
    this.reservations.set(e.id, n);
    return true;
  }
  clean() {
    const w = this.w;
    for (const id of this.reservations.keys())
      if (!w.enemies.some((e) => e.id === id && e.hp > 0))
        this.reservations.delete(id);
    for (const e of w.enemies)
      if (
        e.kind === "sandegg" &&
        !w.enemies.some((o) => o.id === e.owner && o.hp > 0)
      )
        e.hp = 0;
  }
  private legal(p: Point, r = 0.4) {
    return (
      Math.abs(p.x) <= 22 - r &&
      Math.abs(p.y) <= 26 - r &&
      !sandMap.blocked(p, r)
    );
  }
  private move(e: Enemy, p: Point, dt: number, speed = ENEMIES[e.kind].speed) {
    if (distance(e, p) < 0.1) return;
    const a = sandMap.heading(e, p),
      s = speed * (e.slowUntil > this.w.time ? 1 - e.slow : 1),
      step = Math.min(distance(e, p), s * dt);
    e.x += Math.cos(a) * step;
    e.y += Math.sin(a) * step;
    e.x = Math.max(-21.6, Math.min(21.6, e.x));
    e.y = Math.max(-25.6, Math.min(25.6, e.y));
    sandMap.resolve(e, 0.35);
  }
  private hazard(
    e: Enemy,
    kind: Hazard["kind"],
    p: Point,
    radius: number,
    width: number,
    delay: number,
    damage: number,
    duration = 0.15,
  ): Hazard {
    return {
      id: this.w.id(),
      source: e.id,
      kind,
      x: p.x,
      y: p.y,
      angle: e.facing,
      radius,
      width,
      created: this.w.time,
      due: this.w.time + delay,
      until: this.w.time + delay + duration,
      damage,
      fixedDamage: true,
      fired: false,
      next: 0,
    };
  }
  private publish(e: Enemy, h: Hazard) {
    const w = this.w;
    if (
      w.hazards.length + this.reserved(e.id) >= 2 ||
      !w.visible(e, 0.3) ||
      !w.visible(h, h.kind === "circle" ? h.radius : 0.3) ||
      !this.legal(h, 0.1) ||
      (h.kind === "circle" &&
        (Math.abs(h.x) + h.radius > 22 || Math.abs(h.y) + h.radius > 26)) ||
      (h.kind === "frontierLane" &&
        (Math.abs(h.endX ?? 0) > 22 || Math.abs(h.endY ?? 0) > 26)) ||
      !crownEscape(w, [h], true)
    ) {
      this.stats.rejected++;
      return false;
    }
    w.hazards.push(h);
    this.stats.peakHazards = Math.max(this.stats.peakHazards, w.hazards.length);
    return true;
  }
  private wait(e: Enemy, t: number, step: number) {
    e.state = "windup";
    e.timer = t;
    e.sand!.step = step;
  }
  private finish(e: Enemy, t: number, vulnerable = false) {
    this.release(e);
    if (e.sand) {
      e.sand.buried = false;
      e.sand.vulnerable = vulnerable;
      e.sand.step = 99;
    }
    e.state = "recover";
    e.timer = t;
  }
  private ready(e: Enemy) {
    return (
      e.attack <= 0 &&
      e.visibleSince >= 0 &&
      this.w.time - e.visibleSince >= 1 &&
      this.w.visible(e, 0.3)
    );
  }
  private budget(kind: Kind) {
    const w = this.w,
      c = ENEMIES[kind];
    return (
      w.enemies.filter((e) => e.hp > 0).length < 100 &&
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length < c.cap &&
      w.enemies.reduce(
        (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) +
        c.threat <=
        6
    );
  }
  spawnPack(kinds: readonly Kind[], reinforcement = false) {
    const w = this.w;
    if (kinds.some((k) => w.enemies.some((e) => e.hp > 0 && e.kind === k)))
      return false;
    let made = 0;
    const a = w.random() * Math.PI * 2;
    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i];
      if (!this.budget(kind)) continue;
      for (let j = 0; j < 24; j++) {
        const angle = a + i * Math.PI + (j * Math.PI) / 12,
          r = Math.min(
            8,
            (w.viewport.x - 0.8) / Math.max(0.01, Math.abs(Math.cos(angle))),
            (w.viewport.y - 0.8) / Math.max(0.01, Math.abs(Math.sin(angle))),
          ),
          p = {
            x: w.camera.x + Math.cos(angle) * r,
            y: w.camera.y + Math.sin(angle) * r,
          };
        if (!this.legal(p) || distance(p, w.player) < 6 || !w.visible(p, 0.4))
          continue;
        const e = w.addEnemy(kind, p.x, p.y, reinforcement);
        if (e) {
          e.state = "arriving";
          e.timer = 1;
          e.attack = 1;
          e.bossReinforcement = reinforcement;
          made++;
        }
        break;
      }
    }
    if (made) this.stats.packs++;
    return made > 0;
  }
  director(dt: number, position: (a: number) => Point, suppress = false) {
    const w = this.w,
      t = w.time;
    this.clean();
    if (sandRest(t) || t < w.reinforcementRestUntil) return;
    const elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind));
    this.nextGroup -= dt;
    if (this.nextGroup <= 0) {
      const pressure = hordePressure(w),
        n =
          t < 1
            ? 6
            : Math.min(
                22,
                5 + Math.floor(t / 50) + (elite ? 0 : pressure.extra),
              ),
        a = mapApproach(15,t,this.mapWave,w.random());
      for (let i = 0; i < n; i++) {
        const p = position(a + mapPackOffset(15,t,this.mapWave,i,n));
        if (!this.legal(p) || distance(p, w.player) < 3) continue;
        const e = w.addEnemy("sandworker", p.x, p.y);
        if (!e) break;
        e.state = "arriving";
        e.timer = 1;
      }
      this.mapWave++;
      this.nextGroup =
        Math.max(0.9, 2.6 - t / 250) / (elite ? 0.6 : pressure.rate);
    }
    if (suppress || t >= 472 || t < this.special) return;
    this.special = t + (t >= 395 ? 10 : 12);
    if (t < 60) this.spawnPack(["shellroller"]);
    else if (t < 100) this.spawnPack(["sandspitter"]);
    else if (t < 135) this.spawnPack(["sandstalker"]);
    else if (elite) this.spawnPack(t < 225 ? ["shellroller"] : ["sandspitter"]);
    else if (t >= 460) this.spawnPack(["sandspitter"]);
    else
      this.spawnPack(
        Math.floor(t / 12) % 2
          ? ["shellroller", "sandstalker"]
          : ["sandspitter", "sandstalker"],
      );
  }
  onDeath(e: Enemy) {
    const w = this.w;
    this.release(e);
    if (e.kind === "broodelite")
      for (const egg of w.enemies)
        if (egg.kind === "sandegg" && egg.owner === e.id) egg.hp = 0;
    if (e.kind !== "sandworker") return;
    const reward = !e.summoned || e.bossReinforcement;
    e.sandXp = reward ? 0.5 : 0;
    for (const side of [-1, 1]) {
      const p = { x: e.x + side * 0.45, y: e.y };
      if (!this.legal(p, 0.2) || !this.budget("sandlarva")) {
        if (reward) e.sandXp += 0.25;
        continue;
      }
      const child = w.addEnemy("sandlarva", p.x, p.y, true);
      if (!child) {
        if (reward) e.sandXp += 0.25;
        continue;
      }
      child.state = "windup";
      child.timer = 0.65;
      child.sandXp = reward ? 0.25 : 0;
      child.bossReinforcement = e.bossReinforcement;
      this.stats.split++;
    }
  }
  private eggs(e: Enemy) {
    const w = this.w;
    for (let i = 0; i < 3; i++) {
      if (
        !this.budget("sandegg") ||
        w.enemies.filter(
          (o) => o.hp > 0 && o.owner === e.id && o.kind === "sandworker",
        ).length >= 6
      )
        break;
      const a = e.facing + Math.PI / 2 + (i * Math.PI * 2) / 3,
        p = { x: e.x + Math.cos(a) * 2, y: e.y + Math.sin(a) * 2 };
      if (!this.legal(p) || distance(p, w.player) < 1.5) continue;
      const egg = w.addEnemy("sandegg", p.x, p.y, true);
      if (egg) {
        egg.owner = e.id;
        egg.sand = { action: "brood", step: 0, angle: 0, hatch: w.time + 3.2 };
      }
    }
  }
  private hatch(e: Enemy) {
    const w = this.w;
    if (!w.enemies.some((o) => o.id === e.owner && o.hp > 0)) {
      e.hp = 0;
      return;
    }
    if (w.time < (e.sand?.hatch ?? Infinity)) return;
    e.hp = 0;
    if (
      w.enemies.filter(
        (o) => o.hp > 0 && o.owner === e.owner && o.kind === "sandworker",
      ).length >= 6
    )
      return;
    const child = w.addEnemy("sandworker", e.x, e.y, true);
    if (child) {
      child.owner = e.owner;
      child.state = "arriving";
      child.timer = 0.65;
      child.sandXp = 0;
      this.stats.hatch++;
    }
  }
  private line(
    e: Enemy,
    angle: number,
    length: number,
    width: number,
    delay: number,
    damage: number,
    charge = false,
    p: Point = e,
    duration = 0.15,
  ) {
    const h = this.hazard(
      e,
      charge ? "line" : "frontierLane",
      p,
      length,
      width,
      delay,
      damage,
      duration,
    );
    h.angle = angle;
    if (charge) h.siegeCharge = true;
    else {
      h.endX = p.x + Math.cos(angle) * length;
      h.endY = p.y + Math.sin(angle) * length;
    }
    h.damageLabel = e.kind === "boss" ? "巢皇交剪" : "虫群砂线";
    return this.publish(e, h) ? h : null;
  }
  private ground(
    e: Enemy,
    p: Point,
    r: number,
    delay: number,
    damage: number,
    ballistic = false,
  ) {
    const h = this.hazard(e, "circle", p, r, 0, delay, damage);
    h.damageLabel = e.kind === "boss" ? "巢皇砂卵" : "虫群震地";
    if (ballistic)
      Object.assign(h, {
        siegeGround: true,
        siegeBallistic: true,
        sandLaunchDelay: 0.25,
        endX: e.x,
        endY: e.y,
      });
    return this.publish(e, h) ? h : null;
  }
  private sector(e: Enemy, angle: number, delay: number, boss = false) {
    const h = this.hazard(
      e,
      "sector",
      e,
      boss ? 5 : 7,
      ((boss ? 75 : 40) * Math.PI) / 180,
      delay,
      boss ? 24 : 16,
    );
    h.angle = angle;
    h.damageLabel = boss ? "巢皇追击钳" : "连续喷砂";
    return this.publish(e, h) ? h : null;
  }
  startRoll(e: Enemy) {
    if (!this.reserve(e, 1)) return false;
    const a = Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x);
    e.sand = {
      action: "roll",
      step: 0,
      angle: a + ((e.id % 2 ? 1 : -1) * Math.PI) / 3,
    };
    if (!this.line(e, a, 5, 0.55, 1, 20, true, e, 5 / 6)) {
      this.release(e);
      e.sand = undefined;
      return false;
    }
    e.lockedAngle = a;
    e.combo = 0;
    this.wait(e, 1, 0);
    this.stats.roll++;
    return true;
  }
  startBurrow(e: Enemy) {
    const w = this.w;
    if (!this.reserve(e, e.kind === "boss" ? 2 : 1)) return false;
    const d = distance(e, w.player),
      a = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      p = {
        x: e.x + Math.cos(a) * Math.min(6, d),
        y: e.y + Math.sin(a) * Math.min(6, d),
      };
    if (!this.legal(p, 0.65) || sandMap.segment(e, p, 0.65)) {
      this.release(e);
      return false;
    }
    const h = this.ground(
      e,
      p,
      e.kind === "boss" ? 1.8 : 1.6,
      1.65,
      e.kind === "boss" ? 28 : 22,
    );
    if (!h) {
      this.release(e);
      return false;
    }
    e.sand = {
      action: "burrow",
      step: 0,
      angle: a,
      target: p,
      end: { x: e.x, y: e.y },
      next: h.until,
    };
    this.wait(e, 0.45, 0);
    this.stats.burrow++;
    return true;
  }
  private startSpit(e: Enemy) {
    if (!this.reserve(e, 1)) return false;
    const a = Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x);
    e.sand = {
      action: "spit",
      step: 0,
      angle: a,
      target: { x: e.id % 2 ? 1 : -1, y: 0 },
    };
    if (!this.sector(e, a, 0.95)) {
      this.release(e);
      e.sand = undefined;
      return false;
    }
    this.wait(e, 1.1, 0);
    this.stats.spit++;
    return true;
  }
  private startBrood(e: Enemy) {
    if (!this.reserve(e, 2)) return false;
    const a = Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x);
    if (!this.line(e, a, 7, 0.55, 1.1, 22, false, e, 0.2)) {
      this.release(e);
      return false;
    }
    e.sand = { action: "brood", step: 0, angle: a };
    this.eggs(e);
    this.wait(e, 1.8, 0);
    this.stats.elite++;
    return true;
  }
  private startBreak(e: Enemy) {
    if (!this.reserve(e, 2)) return false;
    if (!this.ground(e, { ...this.w.player }, 1.7, 1.1, 24)) {
      this.release(e);
      return false;
    }
    e.sand = { action: "break", step: 0, angle: 0 };
    this.wait(e, 1.6, 0);
    this.stats.elite++;
    return true;
  }
  private cross(e: Enemy, second = false) {
    const w = this.w,
      a = ((second ? -1 : 1) * Math.PI) / 4,
      p = { x: w.player.x - Math.cos(a) * 3, y: w.player.y - Math.sin(a) * 3 },
      h = this.line(
        e,
        a,
        6,
        0.55,
        second ? 1 : 1.1,
        24,
        false,
        p,
        second && e.bossPhase === 2 ? 1.35 : 0.15,
      );
    if (h && second && e.bossPhase === 2) {
      h.sandRift = true;
      h.next = h.due + 0.6;
    }
    return !!h;
  }
  startBoss(e: Enemy, action: number) {
    if (action === 0) {
      const ok = this.startBurrow(e);
      if (ok) this.stats.boss++;
      return ok;
    }
    if (!this.reserve(e, 2)) return false;
    e.sand = { action: action === 1 ? "cross" : "scatter", step: 0, angle: 0 };
    const ok =
      action === 1
        ? this.cross(e)
        : !!this.ground(e, { ...this.w.player }, 1.4, 1.1, 20, true);
    if (!ok) {
      this.release(e);
      e.sand = undefined;
      return false;
    }
    this.wait(e, action === 1 ? 1.6 : 0.6, 0);
    this.stats.boss++;
    return true;
  }
  private transition(e: Enemy) {
    const w = this.w;
    this.release(e);
    w.hazards = w.hazards.filter(
      (h) => h.source !== e.id || h.fired || h.siegeLaunched,
    );
    e.bossPhase = 2;
    e.pattern = 0;
    e.bossAction = "transition";
    e.sand = { action: "transition", step: 0, angle: 0 };
    this.wait(e, 1.4, 0);
    w.effects.push({ type: "bossPhase", ...e, value: 2 });
  }
  private phase(e: Enemy) {
    if (e.kind !== "boss" || e.bossPhase !== 1 || e.hp > e.maxHp * 0.55) return;
    if (e.sand?.buried) {
      e.sand.pendingPhase = true;
      return;
    }
    this.transition(e);
  }
  private follow(e: Enemy) {
    const w = this.w,
      s = e.sand!;
    this.stats.follow++;
    if (s.action === "roll") {
      if (s.step === 0) {
        if (!this.line(e, s.angle, 4, 0.55, 0.9, 20, true, e, 4 / 6)) {
          this.stats.degraded++;
          this.finish(e, 1.7);
          return;
        }
        e.lockedAngle = s.angle;
        this.wait(e, 0.9, 1);
      } else this.finish(e, 1.7);
      return;
    }
    if (s.action === "spit") {
      if (s.step < 2) {
        const n = s.step + 1,
          a = s.angle + (s.target!.x * n * 35 * Math.PI) / 180;
        if (!this.sector(e, a, 0.8)) {
          this.stats.degraded++;
          this.finish(e, 1.8);
          return;
        }
        this.wait(e, 1.1, n);
      } else this.finish(e, 1.8);
      return;
    }
    if (s.action === "burrow") {
      s.buried = false;
      if (s.pendingPhase) {
        this.transition(e);
        return;
      }
      if (e.kind !== "boss") {
        this.finish(e, 2, true);
        return;
      }
      if (s.step === 1) {
        this.wait(e, 0.3, 2);
        return;
      }
      if (s.step === 2) {
        const a = Math.atan2(w.player.y - e.y, w.player.x - e.x);
        if (!this.sector(e, a, 1, true)) {
          this.stats.degraded++;
          this.finish(e, 2.4, true);
          return;
        }
        this.wait(e, 1.15, 3);
        return;
      }
      this.finish(e, e.bossPhase === 2 ? 2 : 2.4, true);
      return;
    }
    if (s.action === "brood") {
      if (s.step === 0) {
        const egg = w.enemies.find(
          (o) => o.kind === "sandegg" && o.owner === e.id && o.hp > 0,
        );
        if (egg && this.ground(e, egg, 1.6, 1, 18)) {
          w.hazards[w.hazards.length - 1].source = egg.id;
          this.wait(e, 1.15, 1);
          return;
        }
      }
      this.finish(e, 2.4);
      return;
    }
    if (s.action === "break") {
      if (s.step === 0) {
        const a = Math.atan2(w.player.y - e.y, w.player.x - e.x);
        if (this.line(e, a, 5.5, 0.65, 1, 26, true, e, 5.5 / 6.5)) {
          e.lockedAngle = a;
          this.wait(e, 1, 1);
          return;
        }
        this.stats.degraded++;
        this.finish(e, 1.8);
        return;
      }
      this.finish(e, 2);
      return;
    }
    if (s.action === "cross") {
      if (s.step === 0 && this.cross(e, true)) {
        this.wait(e, e.bossPhase === 2 ? 2.35 : 1.15, 1);
        return;
      }
      if (s.step === 0) this.stats.degraded++;
      this.finish(e, 2.2);
      return;
    }
    if (s.action === "scatter") {
      if (s.step < 2) {
        const h = this.ground(e, { ...w.player }, 1.4, 1.05, 20, true);
        if (!h) {
          this.stats.degraded++;
          this.finish(e, 2);
          return;
        }
        this.wait(e, s.step === 0 ? 0.75 : 1.2, s.step + 1);
      } else this.finish(e, 2);
      return;
    }
    if (s.action === "transition") {
      e.bossAction = "none";
      this.finish(e, 0.2);
    }
  }
  private charge(e: Enemy, dt: number) {
    const w = this.w,
      s = e.sand!;
    if (s.action === "burrow") {
      const target = s.target!,
        d = distance(e, target),
        step = Math.min(d, 5 * dt);
      const p = {
        x: e.x + Math.cos(s.angle) * step,
        y: e.y + Math.sin(s.angle) * step,
      };
      if (!this.legal(p, 0.65) || sandMap.segment(e, p, 0.65)) {
        w.hazards = w.hazards.filter((h) => h.source !== e.id);
        s.buried = false;
        this.finish(e, 2, true);
        return;
      }
      e.x = p.x;
      e.y = p.y;
      e.timer -= dt;
      if (d <= step + 0.01 || e.timer <= 0)
        this.wait(e, Math.max(0, (s.next ?? w.time) - w.time), 1);
      return;
    }
    const speed = s.action === "break" ? 6.5 : 6,
      length = s.action === "break" ? 5.5 : s.step === 0 ? 5 : 4,
      width = s.action === "break" ? 0.65 : 0.55,
      old = { ...e },
      p = {
        x: e.x + Math.cos(e.lockedAngle) * speed * Math.min(dt, e.timer),
        y: e.y + Math.sin(e.lockedAngle) * speed * Math.min(dt, e.timer),
      };
    const wall = !this.legal(p, width) || sandMap.segment(old, p, width);
    if (!wall) {
      e.x = p.x;
      e.y = p.y;
      if (!s.hit && segmentDistance(w.player, old, e) < width) {
        w.hurt(
          s.action === "break" ? 26 : 20,
          s.action === "break" ? "暴君扑进" : "滚虫折返",
          false,
        );
        s.hit = true;
      }
    }
    e.timer -= dt;
    if (wall || e.timer <= 0) {
      w.hazards = w.hazards.filter((h) => h.source !== e.id);
      if (wall) {
        this.finish(e, s.action === "break" ? 3 : 2.5, true);
        return;
      }
      if (s.action === "roll" && s.step === 0) {
        this.follow(e);
        return;
      }
      this.finish(e, s.action === "break" ? 2 : 1.7);
    }
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w;
    if (e.kind === "sandegg") {
      if (e.freezeUntil > w.time) {
        if (e.sand?.hatch !== undefined) e.sand.hatch += dt;
        for (const h of w.hazards)
          if (h.source === e.id && !h.fired) {
            h.created += dt;
            h.due += dt;
            h.until += dt;
          }
        return;
      }
      this.hatch(e);
      return;
    }
    if (e.kind === "sandlarva" && e.state === "windup") {
      if (e.freezeUntil > w.time) return;
      e.timer -= dt;
      if (e.timer <= 0) e.state = "seek";
      return;
    }
    this.phase(e);
    if (e.freezeUntil > w.time) {
      for (const h of w.hazards)
        if (h.source === e.id && !h.fired && !h.siegeLaunched) {
          h.created += dt;
          h.due += dt;
          h.until += dt;
        }
      if (e.sand?.next !== undefined) e.sand.next += dt;
      return;
    }
    if (e.state === "arriving") {
      e.timer -= dt;
      if (e.timer <= 0) e.state = "seek";
      return;
    }
    const s = e.sand;
    if (e.state === "windup" && s) {
      e.timer -= dt;
      if (e.timer > 1e-6) return;
      if (s.action === "burrow" && s.step === 0) {
        s.buried = true;
        e.state = "charge";
        e.timer = 1.2;
        return;
      }
      if (
        (s.action === "roll" && s.step < 2) ||
        (s.action === "break" && s.step === 1)
      ) {
        e.state = "charge";
        e.timer =
          s.action === "break" ? 5.5 / 6.5 : s.step === 0 ? 5 / 6 : 4 / 6;
        return;
      }
      this.follow(e);
      return;
    }
    if (e.state === "charge" && s) {
      this.charge(e, dt);
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        if (s) s.vulnerable = false;
        e.attack =
          e.kind === "sandstalker"
            ? 6
            : e.kind === "sandspitter"
              ? 2
              : e.kind === "boss"
                ? 0.2
                : 1;
      }
      return;
    }
    const d = distance(e, w.player);
    e.facing = Math.atan2(w.player.y - e.y, w.player.x - e.x);
    e.attack -= dt;
    if (
      e.kind === "sandspitter" &&
      d < 2 &&
      w.time >= (e.siegeDodgeReady ?? 0)
    ) {
      e.siegeDodgeReady = w.time + 4;
      const a = e.facing + Math.PI,
        p = { x: e.x + Math.cos(a) * 1.5, y: e.y + Math.sin(a) * 1.5 };
      if (this.legal(p) && !sandMap.segment(e, p, 0.35)) {
        e.siegeTarget = p;
        e.siegeRouteTime = 1;
      }
    }
    if (
      e.kind === "sandspitter" &&
      e.siegeTarget &&
      (e.siegeRouteTime ?? 0) > 0
    ) {
      this.move(e, e.siegeTarget, dt, 1.5);
      e.siegeRouteTime! -= dt;
      return;
    }
    const stop = e.kind === "sandspitter" ? 6 : 0.7;
    if (d > stop)
      this.move(e, w.player, dt, e.kind === "boss" ? 2 : ENEMIES[e.kind].speed);
    if (d < (e.kind === "boss" || isElite(e.kind) ? 1 : 0.65))
      w.hurt(
        e.kind === "boss" ? 20 : ENEMIES[e.kind].contact,
        e.kind,
        e.kind !== "boss" && !isElite(e.kind),
      );
    if (!this.ready(e)) return;
    let ok = false;
    if (e.kind === "shellroller" && d >= 2.5 && d <= 7) ok = this.startRoll(e);
    else if (e.kind === "sandspitter" && d >= 2 && d <= 7)
      ok = this.startSpit(e);
    else if (e.kind === "sandstalker" && d >= 2 && d <= 8)
      ok = this.startBurrow(e);
    else if (e.kind === "broodelite") ok = this.startBrood(e);
    else if (e.kind === "breakerelite") ok = this.startBreak(e);
    else if (e.kind === "boss") {
      const action =
        e.bossPhase === 2 ? [1, 0, 2][e.pattern % 3] : e.pattern % 3;
      ok = this.startBoss(e, action);
      if (ok) {
        e.pattern++;
        if (
          e.bossPhase === 2 &&
          e.pattern % 3 === 0 &&
          !w.enemies.some(
            (o) => o.hp > 0 && ["sandstalker", "sandspitter"].includes(o.kind),
          )
        ) {
          this.spawnPack(
            [this.bossCycle++ % 2 ? "sandspitter" : "sandstalker"],
            true,
          );
        }
      }
    }
    if (!ok) e.attack = 0.35;
  }
}
