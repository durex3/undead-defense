import {ELITE_TIMES,eliteQuiet,RETURN_ELITE_HEALTH} from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, ThunderState, distance } from "./SurvivalTypes";
import { thunderMap } from "./ThunderMap";
import { thunderContains, thunderEscape } from "./ThunderGeometry";
import { STAGES } from "./StageRules";
import { BOSS_TIME, encounterScoreTime, encounterRealTime } from "./EncounterPacing";
const TAU = Math.PI * 2;
export const thunderDevice = (k: Kind) =>
  k === "thunderanchor" || k === "gridelectrode";
export const thunderEnemy = (k: Kind) =>
  [
    "rivetwalker",
    "anchorweaver",
    "arclantern",
    "railsaw",
    "gridwarden",
    "railreaper",
    "thunderanchor",
    "gridelectrode",
  ].includes(k);
export function thunderHint(w: SurvivalWorld) {
  const b = w.enemies.find((e) => e.kind === "boss" && e.hp > 0),
    a = b?.thunder?.action;
  if (b?.state === "recover") return "核心暴露 · 靠近反击";
  if (a === "walls" || a === "reap") return "向固定缺口换道 · 电栅两端也能绕过";
  if (a === "court" || a === "grid") return "拆电极断线 · 从开口换边";
  if (a === "beats") return "横移躲锁线 · 留意下一拍";
  return "拆电锚断电 · 虚线可穿，实线避让";
}
export class ThunderSystem {
  private reserved = new Map<number, number>();
  private nextGroup = 0;
  private nextSpecial = encounterRealTime(35);
  private specialWave = 0;
  private elites = [false, false, false];
  private boss = false;
  private lastSide = 1;
  private rest = 0;
  private lastSpecialStart = -Infinity;
  private completed = 0;
  private reinforce = 0;
  constructor(private w: SurvivalWorld) {}
  private live(id: number) {
    return this.w.enemies.find((e) => e.id === id && e.hp > 0);
  }
  private state(
    e: Enemy,
    action: ThunderState["action"],
    points: Point[] = [],
    angle = 0,
  ): ThunderState {
    return (e.thunder = {
      action,
      step: 0,
      next: this.w.time,
      points,
      devices: [],
      angle,
    });
  }
  /** Reservations count physical hazards, including emitted attacks from dead owners. */
  slots() {
    const costs = new Map(this.reserved);
    for (const h of this.w.hazards)
      if (h.until > this.w.time)
        costs.set(
          h.source,
          Math.max(
            costs.get(h.source) || 0,
            this.w.hazards.filter(
              (o) => o.source === h.source && o.until > this.w.time,
            ).length,
          ),
        );
    return Array.from(costs.values()).reduce((a, b) => a + b, 0);
  }
  private reserve(e: Enemy, n: number) {
    this.clean();
    if (this.slots() + n > 2) return false;
    this.reserved.set(e.id, n);
    return true;
  }
  clean() {
    const w = this.w;
    w.hazards = w.hazards.filter(
      (h) => !h.thunder || (h.until > w.time && this.valid(h)),
    );
    for (const e of w.enemies)
      if (
        thunderDevice(e.kind) &&
        e.hp > 0 &&
        (e.thunder?.expires ?? Infinity) <= w.time
      )
        e.hp = 0;
    for (const [id] of this.reserved) {
      const e = this.live(id);
      if (!e || e.state === "seek" || e.state === "recover")
        this.reserved.delete(id);
    }
  }
  private valid(h: Hazard) {
    const t = h.thunder!;
    if (t.devices.some((id) => !this.live(id))) return false;
    return (
      !!this.live(h.source) || h.fired || this.w.time >= (t.launch ?? h.due)
    );
  }
  onDeath(e: Enemy) {
    this.reserved.delete(e.id);
    if (isElite(e.kind)) this.rest = Math.max(this.rest, this.w.time + 6);
    else if (
      ENEMIES[e.kind].threat > 0 &&
      !this.w.enemies.some(
        (o) => o.id !== e.id && o.hp > 0 && ENEMIES[o.kind].threat > 0,
      )
    )
      this.rest = Math.max(this.rest, this.w.time + 3);
    // Before launch the owner controls the circuit; after launch the finite attack persists.
    this.w.hazards = this.w.hazards.filter((h) => !h.thunder || this.valid(h));
    for (const d of this.w.enemies)
      if (
        d.owner === e.id &&
        thunderDevice(d.kind) &&
        !this.w.hazards.some(
          (h) => h.thunder?.devices.includes(d.id) && this.valid(h),
        )
      )
        d.hp = 0;
  }
  private legalPoint(p: Point, r = 0.35) {
    return (
      Math.abs(p.x) < 22 - r &&
      Math.abs(p.y) < 26 - r &&
      !thunderMap.blocked(p, r)
    );
  }
  private seen(p: Point) {
    return this.w.visible(p, 0.45);
  }
  private device(
    e: Enemy,
    p: Point,
    ratio: number,
    kind: Kind = "gridelectrode",
    life = 7,
  ) {
    const w = this.w;
    if (
      !this.legalPoint(p) ||
      w.enemies.filter((o) => o.hp > 0 && thunderDevice(o.kind)).length >= 4
    )
      return undefined;
    const d = w.addEnemy(kind, p.x, p.y, true);
    if (!d) return undefined;
    d.owner = e.id;
    d.hp = d.maxHp =
      30 *
      (1 + Math.min(w.time, 90) / 300) *
      ENEMIES.rivetwalker.health *
      1.82 *
      ratio;
    this.state(d, "anchor").expires = w.time + life;
    e.thunder?.devices.push(d.id);
    return d;
  }
  private clearDevices(e: Enemy) {
    for (const d of this.w.enemies)
      if (d.owner === e.id && thunderDevice(d.kind)) d.hp = 0;
  }
  private hazard(
    e: Enemy,
    shape: "zone" | "line" | "wall" | "sector",
    p: Point,
    angle: number,
    radius: number,
    width: number,
    delay: number,
    duration: number,
    damage: number,
    devices: number[] = [],
    order = 1,
  ): Hazard {
    const w = this.w;
    return {
      id: w.id(),
      source: e.id,
      kind:
        shape === "zone" ? "circle" : shape === "sector" ? "sector" : "line",
      ...p,
      angle,
      radius,
      width,
      created: w.time,
      due: w.time + delay,
      until: w.time + delay + duration,
      damage,
      fired: false,
      next: w.time + delay,
      fixedDamage: true,
      damageLabel:
        shape === "wall"
          ? "推进电栅"
          : shape === "zone"
            ? "电锚过载"
            : "断轨电弧",
      thunder: { shape, devices: [...devices], order },
    };
  }
  private ends(h: Hazard): Point[] {
    const c = Math.cos(h.angle),
      s = Math.sin(h.angle);
    if (h.thunder?.shape === "wall")
      return [-1, 1].flatMap((side) =>
        [0, h.thunder!.travel ?? 6].map((u) => ({
          x: h.x + c * u - (s * side * h.radius) / 2,
          y: h.y + s * u + (c * side * h.radius) / 2,
        })),
      );
    if (h.thunder?.shape === "line")
      return [-1, 1].map((side) => ({
        x: h.x + (c * side * h.radius) / 2,
        y: h.y + (s * side * h.radius) / 2,
      }));
    return [
      { x: h.x - h.radius, y: h.y - h.radius },
      { x: h.x + h.radius, y: h.y + h.radius },
    ];
  }
  private publish(h: Hazard, check = true) {
    const w = this.w;
    if (
      w.hazards.filter((o) => o.until > w.time).length >= 2 ||
      !this.ends(h).every((p) => this.seen(p))
    )
      return false;
    if (check && !thunderEscape(w, [h])) return false;
    w.hazards.push(h);
    return true;
  }
  private line(
    e: Enemy,
    a: Point,
    b: Point,
    width: number,
    delay: number,
    duration: number,
    damage: number,
    devices: number[] = [],
    order = 1,
  ) {
    return this.hazard(
      e,
      "line",
      { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      Math.atan2(b.y - a.y, b.x - a.x),
      distance(a, b),
      width,
      delay,
      duration,
      damage,
      devices,
      order,
    );
  }
  private recover(e: Enemy, seconds: number, cooldown = 0) {
    e.state = "recover";
    e.timer = seconds;
    e.attack = cooldown;
    if (e.thunder) e.thunder.vulnerable = isElite(e.kind) || e.kind === "boss";
    this.reserved.delete(e.id);
    if (e.kind === "boss") {
      this.rest = Math.max(this.rest, this.w.time + Math.max(3, seconds));
      if (e.thunder?.action !== "transition") {
        this.completed++;
        if (this.completed % 2 === 0) this.reinforce++;
      }
    }
  }
  private move(
    e: Enemy,
    target: Point,
    dt: number,
    speed = ENEMIES[e.kind].speed,
  ) {
    if (distance(e, target) < 0.1) return;
    const a = thunderMap.heading(e, target),
      slow = e.slowUntil > this.w.time ? 1 - e.slow : 1;
    e.facing = a;
    e.x = Math.max(-22, Math.min(22, e.x + Math.cos(a) * speed * slow * dt));
    e.y = Math.max(-26, Math.min(26, e.y + Math.sin(a) * speed * slow * dt));
    thunderMap.resolve(e, e.kind === "boss" ? 0.65 : 0.35);
  }
  private ready(e: Enemy) {
    return (
      e.visibleSince >= 0 &&
      this.w.time - e.visibleSince >= 1 &&
      this.w.visible(e, 0.5) &&
      e.attack <= 0
    );
  }
  private ordinaryRest() {
    const t = encounterScoreTime(this.w.time);
    return (
      eliteQuiet(this.w.time) || (t >= 175 && t < 185) ||
      (t >= 290 && t < 300) ||
      (t >= 345 && t < 355) ||
      (t >= 472 && t < 480)
    );
  }
  private suppressSpecial() {
    const w = this.w,
      t = w.time;
    return (
      this.ordinaryRest() ||
      w.time < Math.max(this.rest, w.reinforcementRestUntil) ||
      w.enemies.some((e) => isElite(e.kind) && e.hp > 0) ||
      (t >= BOSS_TIME &&
        w.enemies.some((e) => e.kind === "boss" && e.state !== "seek"))
    );
  }
  private allowed(): Kind[] {
    const t = encounterScoreTime(this.w.time);
    if (t < 35 || this.ordinaryRest() || t >= 472) return [];
    if (t < 70) return ["anchorweaver"];
    if (t < 110) return ["arclantern"];
    if (t < 150) return ["railsaw"];
    if (t < 175) return ["anchorweaver", "arclantern"];
    if (t < 235) return [];
    if (t < 290) return [this.specialWave % 2 ? "arclantern" : "railsaw"];
    if (t < 345) return ["anchorweaver", "railsaw"];
    if (t < 405) return [];
    if (t < 460)
      return ["anchorweaver", this.specialWave % 2 ? "arclantern" : "railsaw"];
    return ["anchorweaver", "arclantern"];
  }
  private spawn(kind: Kind, angle: number, flank = false) {
    const w = this.w,
      c = ENEMIES[kind];
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >= c.cap ||
      w.enemies.reduce(
        (s, e) => s + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) +
        c.threat >
        6
    )
      return undefined;
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * TAU) / 24,
        r = Math.min(
          8,
          (w.viewport.x - 0.8) / Math.max(0.01, Math.abs(Math.cos(a))),
          (w.viewport.y - 0.8) / Math.max(0.01, Math.abs(Math.sin(a))),
        );
      const p = {
        x: w.camera.x + Math.cos(a) * r,
        y: w.camera.y + Math.sin(a) * r,
      };
      if (
        !this.legalPoint(p, 0.7) ||
        distance(p, w.player) < 6 ||
        !w.visible(p, 0.4)
      )
        continue;
      const e = w.addEnemy(kind, p.x, p.y);
      if (!e) return;
      e.state = "arriving";
      e.timer = 1;
      e.attack = 1;
      if (
        kind === "rivetwalker" &&
        flank &&
        w.enemies.filter(
          (o) => o.thunder?.flankUntil && o.thunder.flankUntil > w.time,
        ).length < 8
      ) {
        const point = {
          x: w.player.x + Math.cos(a + (this.lastSide * Math.PI) / 2) * 3,
          y: w.player.y + Math.sin(a + (this.lastSide * Math.PI) / 2) * 3,
        };
        if (this.legalPoint(point))
          this.state(e, "anchor", [point]).flankUntil = w.time + 2.8;
      }
      return e;
    }
    return undefined;
  }
  director(dt: number) {
    const w = this.w, score = encounterScoreTime(w.time);
    this.clean();
    if (w.time >= BOSS_TIME && !this.boss) {
      const e = this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      if (e) {
        this.boss = true;
        e.timer = 2;
        e.attack = 1;
        w.effects.push({ type: "boss", ...e });
      }
      return;
    }
    if (!this.boss) {
      for (let i = 0; i < 3; i++)
        if (!this.elites[i] && w.time >= ELITE_TIMES[i]) {
          if (w.time >= 340) {
            this.elites[i] = true;
            continue;
          }
          if (
            w.time < Math.max(this.rest, w.reinforcementRestUntil) ||
            w.enemies.some((e) => e.hp > 0 && isElite(e.kind))
          )
            break;
          const e = this.spawn(
            i === 1 ? "railreaper" : "gridwarden",
            w.random() * TAU,
          );
          if (e) {
            if(i===2)e.hp=e.maxHp=e.hp*RETURN_ELITE_HEALTH;
            this.elites[i] = true;
            e.timer = 1.5;
            w.effects.push({ type: "elite", ...e });
          }
          break;
        }
    }
    const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
    this.nextGroup -= dt;
    if (this.nextGroup <= 0) {
      this.nextGroup = this.boss ? 2 : Math.max(1.1, 2.9 - score / 300);
      const rest =
          this.ordinaryRest() ||
          w.time < Math.max(this.rest, w.reinforcementRestUntil),
        elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind));
      const ordinary = w.enemies.filter(
        (e) => e.hp > 0 && e.kind === "rivetwalker",
      ).length;
      const count = this.boss
        ? rest || !boss || boss.state === "arriving"
          ? 0
          : Math.max(
              0,
              Math.min(8, (boss.bossPhase === 1 ? 28 : 34) - ordinary),
            )
        : Math.max(
            0,
            Math.min(
              rest ? 3 : elite ? 5 : 6 + Math.floor(score / 70),
              82 - ordinary,
            ),
          );
      const base = w.random() * TAU;
      this.lastSide *= -1;
      for (let i = 0; i < count; i++) {
        const e = this.spawn(
          "rivetwalker",
          base + (i / count) * TAU,
          i % 4 === 0,
        );
        if (e && this.boss) {
          e.summoned = true;
          e.bossReinforcement = true;
        }
      }
    }
    if (this.suppressSpecial()) return;
    if (this.boss) {
      if (
        this.reinforce &&
        boss?.state === "seek" &&
        !w.enemies.some(
          (e) => e.hp > 0 && ["arclantern", "railsaw"].includes(e.kind),
        )
      ) {
        const e = this.spawn(
          this.completed % 4 ? "arclantern" : "railsaw",
          w.random() * TAU,
        );
        if (e) {
          e.summoned = true;
          e.bossReinforcement = true;
          this.reinforce--;
        }
      }
      return;
    }
    if (w.time < this.nextSpecial) return;
    const allowed = this.allowed();
    if (!allowed.length) return;
    // Recovery after a cleared group; no backlog or instant replacement at the player's feet.
    this.nextSpecial = w.time + 12;
    const kind = allowed[this.specialWave++ % allowed.length];
    if (
      score < 150 &&
      w.enemies.some((e) => e.hp > 0 && ENEMIES[e.kind].threat > 0)
    )
      return;
    this.spawn(kind, w.random() * TAU);
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w;
    if (thunderDevice(e.kind)) return;
    if (e.kind === "boss" && e.bossPhase === 1 && e.hp <= e.maxHp * 0.55) {
      e.bossPhase = 2;
      w.hazards = w.hazards.filter(
        (h) =>
          h.source !== e.id ||
          h.fired ||
          w.time >= (h.thunder?.launch ?? h.due),
      );
      this.clearDevices(e);
      this.reserved.delete(e.id);
      this.state(e, "transition").next = w.time + 1.5;
      e.state = "windup";
      e.bossAction = "transition";
      e.pattern = 0;
      w.effects.push({ type: "bossPhase", ...e, value: 2 });
    }
    if (e.kind !== "boss" && e.freezeUntil > w.time) {
      if (e.thunder) e.thunder.next += dt;
      for (const h of w.hazards)
        if (
          h.source === e.id &&
          h.thunder &&
          !h.fired &&
          w.time < (h.thunder.launch ?? h.due)
        ) {
          h.created += dt;
          h.due += dt;
          h.until += dt;
          h.next += dt;
          if (h.thunder.launch !== undefined) h.thunder.launch += dt;
        }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        if (e.thunder) e.thunder.vulnerable = false;
        this.clearDevices(e);
        e.thunder = undefined;
      }
      return;
    }
    if (e.state === "windup" || e.state === "charge") {
      this.advance(e, dt);
      return;
    }
    e.attack -= dt;
    if (e.kind === "rivetwalker") {
      const target =
        e.thunder?.flankUntil && e.thunder.flankUntil > w.time
          ? e.thunder.points[0]
          : w.player;
      this.move(e, target, dt);
      if (distance(e, w.player) < 0.65) w.hurt(8, "铆齿行机");
      return;
    }
    if (e.kind === "boss" && w.enemies.some((o) => o.hp > 0 && isElite(o.kind)))
      return;
    if (
      e.kind === "boss" &&
      w.time < Math.max(this.rest, w.reinforcementRestUntil)
    )
      return;
    const d = distance(e, w.player),
      ranged = e.kind === "anchorweaver" || e.kind === "arclantern";
    if (d > (ranged ? 5 : 3))
      this.move(
        e,
        w.player,
        dt,
        e.kind === "boss" ? 1.65 : ENEMIES[e.kind].speed,
      );
    if (distance(e, w.player) < (e.kind === "boss" ? 1 : 0.65))
      w.hurt(
        e.kind === "boss" ? 22 : ENEMIES[e.kind].contact,
        e.kind === "boss" ? STAGES[3].boss : ENEMIES[e.kind].name,
        e.kind !== "boss" && !isElite(e.kind),
      );
    if (
      e.kind !== "boss" &&
      !isElite(e.kind) &&
      w.time - this.lastSpecialStart < 3
    )
      return;
    if (e.kind === "boss" && d > 4.5) return;
    if (
      !this.ready(e) ||
      (ranged && (d < 3 || d > 9)) ||
      (!isElite(e.kind) && e.kind !== "boss" && this.suppressSpecial())
    )
      return;
    // First introductions have only their own attack type, even if an old caster survived.
    if (
      encounterScoreTime(w.time) < 150 &&
      e.kind !==
        (encounterScoreTime(w.time) < 70 ? "anchorweaver" : encounterScoreTime(w.time) < 110 ? "arclantern" : "railsaw")
    )
      return;
    if (e.kind === "boss") {
      const action = (
        e.bossPhase === 1
          ? ["beats", "walls", "court"]
          : ["walls", "court", "beats"]
      )[e.pattern % 3] as ThunderState["action"];
      if (this.slots() > 0) return;
      if (this.start(e, action)) e.pattern++;
      else {
        e.pattern++;
        this.recover(e, 1);
      }
    } else if (
      this.start(
        e,
        e.kind === "anchorweaver"
          ? "anchor"
          : e.kind === "arclantern"
            ? "arc"
            : e.kind === "railsaw"
              ? "saw"
              : e.kind === "gridwarden"
                ? "grid"
                : "reap",
      )
    )
      this.lastSpecialStart = w.time;
  }
  private start(e: Enemy, action: ThunderState["action"]) {
    const w = this.w;
    if (!this.reserve(e, ["walls", "court", "reap"].includes(action) ? 2 : 1)) {
      e.attack = 0.4;
      return false;
    }
    this.clearDevices(e);
    const s = this.state(e, action);
    e.state = "windup";
    e.bossAction = "none";
    const fail = () => {
      this.clearDevices(e);
      e.thunder = undefined;
      e.state = "seek";
      e.attack = 0.5;
      this.reserved.delete(e.id);
      return false;
    };
    if (action === "anchor") {
      const p = { ...w.player },
        h = this.hazard(e, "zone", p, 0, 1.3, 0, 1.6, 2.2, 10, []);
      h.thunder!.tick = 0.6;
      h.thunder!.launch = w.time + 0.2;
      h.endX = e.x;
      h.endY = e.y;
      if (!this.legalPoint(p) || !this.publish(h)) return fail();
      const d = this.device(e, p, 0.6, "thunderanchor", 3.8);
      if (!d) {
        h.until = w.time;
        return fail();
      }
      d.state = "arriving";
      d.timer = 1.15;
      h.thunder!.devices = [d.id];
      s.next = h.until;
      e.attack = 4.5;
    } else if (action === "arc" || action === "grid" || action === "court") {
      const p = action === "arc" ? w.player : e,
        angle =
          action === "court"
            ? (e.bossPhase === 2 ? TAU / 3 : 0) + e.pattern * 0.2
            : Math.PI / 4;
      s.points =
        action === "court"
          ? [0, 1, 2].map((i) => ({
              x: p.x + Math.cos(angle + (i * TAU) / 3) * 3.5,
              y: p.y + Math.sin(angle + (i * TAU) / 3) * 3.5,
            }))
          : [-1, 1].map((i) => ({
              x: p.x + Math.cos(angle) * i * (action === "arc" ? 2.5 : 3),
              y: p.y + Math.sin(angle) * i * (action === "arc" ? 2.5 : 3),
            }));
      if (!s.points.every((p) => this.legalPoint(p) && this.seen(p)))
        return fail();
      const devices = (action === "arc" ? s.points.slice(0, 1) : s.points).map(
        (p) =>
          this.device(
            e,
            p,
            action === "arc" ? 0.7 : action === "grid" ? 1.2 : 1.5,
          ),
      );
      if (devices.some((d) => !d)) return fail();
      const edges =
        action === "court"
          ? [
              [0, 1],
              [1, 2],
            ]
          : [[0, 1]];
      const hs = edges.map(([a, b], i) =>
        this.line(
          e,
          s.points[a],
          s.points[b],
          action === "arc" ? 0.28 : 0.35,
          action === "court" ? 1.3 : 1.25,
          action === "arc" ? 0.65 : action === "grid" ? 0.7 : 1.2,
          action === "arc" ? 18 : action === "grid" ? 22 : 24,
          action === "arc" ? s.devices : [s.devices[a], s.devices[b]],
          i + 1,
        ),
      );
      if (
        !hs.every((h) => this.ends(h).every((p) => this.seen(p))) ||
        !thunderEscape(w, hs)
      )
        return fail();
      for (const h of hs) if (!this.publish(h, false)) return fail();
      s.next =
        Math.max(...hs.map((h) => h.until)) +
        (action === "arc" ? 0 : action === "grid" ? 0.3 : 0.4);
    } else if (action === "beats") {
      if (!this.beat(e)) return fail();
    } else if (action === "walls" || action === "reap") {
      const angle = w.player.y > 0 ? -Math.PI / 2 : Math.PI / 2,
        firstGap = (e.pattern % 2 ? 1 : -1) * 1.8;
      s.angle = angle;
      const first = this.wall(
        e,
        angle,
        firstGap,
        action === "walls" ? 12 : 10,
        action === "walls" ? 6 : 5,
        action === "walls" ? 1.35 : 1.3,
      );
      const second = this.wall(
        e,
        angle,
        firstGap + (firstGap > 0 ? -2.4 : 2.4),
        12,
        6,
        1.35 + 1.6 + 1.35,
      );
      if (action === "walls") {
        // Both positions are fixed before publishing; reduce to one if the second cannot be sampled safely.
        s.points = [{ x: second.x, y: second.y }];
        second.thunder!.preview = true;
        second.created = w.time;
        second.damage = 28;
        if (
          !this.ends(second).every((p) => this.seen(p)) ||
          !thunderEscape(w, [first, second])
        )
          s.step = 1;
        else {
          s.devices = [];
          s.next = first.due + 1.6;
          s.points.push({ x: second.thunder!.gap!, y: second.angle });
        }
      }
      if (!this.publish(first)) return fail();
      s.next =
        action === "walls" && s.step === 0 ? first.due + 1.6 : first.until;
    } else if (action === "saw") {
      const a = Math.atan2(w.player.y - e.y, w.player.x - e.x) + Math.PI / 2;
      s.angle = a - Math.PI / 2;
      s.points = [0, 2.5, 5].map((u) => ({
        x: e.x + Math.cos(a) * u,
        y: e.y + Math.sin(a) * u,
      }));
      if (
        !s.points.every((p) => this.legalPoint(p) && this.seen(p)) ||
        thunderMap.segment(s.points[0], s.points[2], 0.35)
      )
        return fail();
      const preview = s.points.map((p, i) =>
        this.hazard(
          e,
          "line",
          {
            x: p.x + Math.cos(s.angle) * 1.6,
            y: p.y + Math.sin(s.angle) * 1.6,
          },
          s.angle,
          3.2,
          0.3,
          0.9 + i * 2.5,
          0.12,
          18,
          [],
          i + 1,
        ),
      );
      if (!preview.every((h) => this.ends(h).every((p) => this.seen(p))))
        return fail();
      s.next = w.time + 0.9;
      e.state = "charge";
    } else return fail();
    return true;
  }
  private wall(
    e: Enemy,
    angle: number,
    gap: number,
    width: number,
    travel: number,
    delay: number,
  ) {
    const p = {
      x: this.w.player.x - Math.cos(angle) * 3.5,
      y: this.w.player.y - Math.sin(angle) * 3.5,
    };
    const h = this.hazard(
      e,
      "wall",
      p,
      angle,
      width,
      e.kind === "boss" ? 0.6 : 0.55,
      delay,
      travel / 2.8,
      e.kind === "boss" ? 28 : 26,
    );
    h.thunder!.gap = gap;
    h.thunder!.speed = 2.8;
    h.thunder!.travel = travel;
    return h;
  }
  private beat(e: Enemy) {
    const s = e.thunder!,
      w = this.w;
    const angles =
      e.bossPhase === 1
        ? [0, Math.PI / 2, ((e.pattern % 2 ? 1 : -1) * Math.PI) / 4]
        : [Math.PI / 4, 0, Math.PI / 2];
    const h = this.hazard(
      e,
      "line",
      { ...w.player },
      angles[s.step],
      8,
      0.45,
      1.15,
      0.15 + (s.step < 2 ? 0.7 : 0),
      26,
      [],
      s.step + 1,
    );
    if (s.step < 2) {
      h.thunder!.residue = 8;
      h.thunder!.tick = 0.5;
    }
    if (!this.publish(h)) return false;
    s.next = h.due + 0.15 + (s.step === 0 ? 0.25 : s.step === 1 ? 0.75 : 0);
    return true;
  }
  private advance(e: Enemy, dt: number) {
    const w = this.w,
      s = e.thunder!;
    if (!s) return;
    if (s.action === "transition") {
      if (w.time >= s.next) {
        e.bossAction = "none";
        this.recover(e, 1.5);
      }
      return;
    }
    if (s.action === "saw" && e.state === "charge" && s.step > 0) {
      const target = s.points[s.step];
      if (distance(e, target) > 0.08) {
        const a = Math.atan2(target.y - e.y, target.x - e.x),
          m = Math.min(distance(e, target), 3.5 * dt);
        const p = { x: e.x + Math.cos(a) * m, y: e.y + Math.sin(a) * m };
        if (!this.legalPoint(p)) {
          this.recover(e, 1.8, 2);
          return;
        }
        e.x = p.x;
        e.y = p.y;
        return;
      }
    }
    if (w.time < s.next) return;
    if (s.action === "anchor") {
      this.recover(e, 0, 4.5);
      return;
    }
    if (s.action === "arc") {
      this.recover(e, 1.5, 3);
      return;
    }
    if (s.action === "beats") {
      if (s.step < 2) {
        s.step++;
        if (!this.beat(e)) this.recover(e, 2.8, 1);
        return;
      }
      this.recover(e, 2.8, 1);
      return;
    }
    if (s.action === "walls") {
      if (s.step === 0) {
        const p = s.points[0],
          spec = s.points[1],
          h = this.hazard(
            e,
            "wall",
            p,
            spec.y,
            12,
            0.6,
            1.35,
            6 / 2.8,
            28,
            [],
            2,
          );
        h.thunder!.gap = spec.x;
        h.thunder!.travel = 6;
        h.thunder!.speed = 2.8;
        if (!this.publish(h)) {
          s.step = 1;
          s.next = Math.max(
            w.time,
            ...w.hazards.filter((h) => h.source === e.id).map((h) => h.until),
          );
          return;
        }
        s.step = 1;
        s.next = h.until;
        return;
      }
      this.recover(e, 3.2, 1);
      return;
    }
    if (s.action === "reap") {
      if (s.step === 0) {
        s.step = 1;
        const angle = Math.atan2(w.player.y - e.y, w.player.x - e.x),
          h = this.hazard(
            e,
            "sector",
            { x: e.x, y: e.y },
            angle,
            2.4,
            Math.PI / 2,
            1.1,
            0.12,
            22,
          );
        if (this.publish(h)) {
          s.next = h.until;
          return;
        }
      }
      this.recover(e, 3, 1);
      return;
    }
    if (s.action === "grid" || s.action === "court") {
      const maximum = s.action === "court" ? 1 : 2;
      if (s.step < maximum) {
        const id = s.devices[s.step++],
          d = this.live(id);
        if (!d) {
          s.next = w.time + 0.35;
          return;
        }
        const h = this.hazard(
          e,
          "zone",
          { x: d.x, y: d.y },
          0,
          s.action === "court" ? 1.5 : 1.4,
          0,
          s.action === "court" ? 1.2 : 1.15,
          0.12,
          s.action === "court" ? 24 : 20,
          [id],
          s.step,
        );
        if (this.publish(h)) {
          s.next = h.until + 0.35;
          return;
        }
        s.next = w.time + 0.35;
        return;
      }
      this.clearDevices(e);
      this.recover(e, s.action === "court" ? 3 : 2.6, 1);
      return;
    }
    if (s.action === "saw") {
      const p = s.points[s.step];
      if (e.state === "charge") {
        const h = this.hazard(
          e,
          "line",
          {
            x: p.x + Math.cos(s.angle) * 1.6,
            y: p.y + Math.sin(s.angle) * 1.6,
          },
          s.angle,
          3.2,
          0.3,
          0.9,
          0.12,
          18,
          [],
          s.step + 1,
        );
        if (!this.publish(h)) {
          this.recover(e, 1.8, 2);
          return;
        }
        e.state = "windup";
        s.next = h.until + 0.2;
        return;
      }
      if (++s.step >= 3) {
        this.recover(e, 1.8, 2);
        return;
      }
      e.state = "charge";
      s.next = w.time;
      return;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      t = h.thunder!;
    if (!this.valid(h)) {
      h.until = w.time;
      return;
    }
    if (w.time < h.due) return;
    const was = h.fired;
    h.fired = true;
    const inside = thunderContains(h, w.player, w.time);
    if (t.shape === "zone" && t.tick) {
      if (w.time >= h.next) {
        h.next = w.time + t.tick;
        if (inside) w.hurt(h.damage, h.damageLabel!, false);
      }
      return;
    }
    if (t.residue && w.time >= h.due + 0.15) {
      if (w.time >= h.next) {
        h.next = w.time + (t.tick ?? 0.5);
        if (inside) w.hurt(t.residue, "轨道余电", false);
      }
      return;
    }
    // Frame-time sweep for moving walls, including 3x simulation substeps.
    let hit = inside;
    if (t.shape === "wall" && !hit) {
      for (let time = Math.max(h.due, h.next); time < w.time; time += 0.01)
        if (thunderContains(h, w.player, time)) {
          hit = true;
          break;
        }
    }
    h.next = w.time;
    if (hit && !t.hit) {
      t.hit = true;
      w.hurt(h.damage, h.damageLabel!, false);
    }
    if (!was && t.residue) h.next = h.due + 0.15 + 0.5;
  }
}
