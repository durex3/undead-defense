import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite, Skill } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { graveMap } from "./EchoGraveMap";
import {
  graveMove,
  graveDistance,
  graveEscape,
  graveCut,
  graveImpact,
  GravePulse,
} from "./EchoGraveGeometry";
export const GRAVE_KINDS: readonly Kind[] = [
  "gravegrub",
  "ribwarden",
  "echoacolyte",
  "shedstalker",
  "coffinregent",
  "scarprelate",
];
export const graveEnemy = (k: Kind) => GRAVE_KINDS.includes(k);
export interface GraveState {
  action: string;
  step: number;
  life: 1 | 2;
  next: number;
  recover: number;
  vulnerable: boolean;
  items?: Hazard[];
  waiting?: number;
  relocate?: Point;
  relocateUntil?: number;
  scar?: GravePulse;
  scarUntil?: number;
  total?: number;
  deadUntil?: number;
  reviveAt?: number;
  milestones?: number;
  qualified?: boolean;
  moveTo?: Point;
  moveAt?: number;
  usedActions?: number;
}
export class EchoGraveSystem {
  private reinforceEpoch = 360;
  private wave = 0;
  private special = 0;
  private rounds = [false, false, false, false];
  private firstReturn = 0;
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastStart = -Infinity;
  private lastElite = 0;
  readonly stats = {
    lifecycle: [] as { event: string; time: number }[],
    dualCasts: 0,
    pulses: 0,
    rejected: 0,
    cancelled: 0,
    qualified: 0,
    eliteCasts: { coffinregent: 0, scarprelate: 0 },
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0, 0],
    phasePatterns: [
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
    ],
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): GraveState {
    return (
      e.grave ??
      (e.grave = {
        action: "A",
        step: 0,
        life: 1,
        next: 0,
        recover: 3,
        vulnerable: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.grave?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !graveMap.blocked(p, 0.8)) return p;
    }
  }
  private spawn(kind: Kind, angle: number, reinforcement = false) {
    const w = this.w,
      c = ENEMIES[kind];
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >= c.cap ||
      w.enemies.reduce(
        (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) +
        c.threat >
        6
    )
      return;
    const p = this.position(angle);
    if (!p) return;
    const e = w.addEnemy(kind, p.x, p.y, reinforcement);
    if (e) {
      e.state = "arriving";
      e.timer = kind === "boss" ? 2 : 1;
      e.bossReinforcement = reinforcement;
    }
    return e;
  }
  director(dt: number) {
    const w = this.w,
      t = w.time;
    this.wave -= dt;
    this.special -= dt;
    const elites = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
    if (
      t >= 360 &&
      !this.boss &&
      !elites.length &&
      t >= this.rest &&
      !w.hazards.some((h) => h.until > t)
    ) {
      const e = this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      if (e) {
        this.boss = true;
        this.initialize(e);
        this.horde = t + 3;
        w.effects.push({ type: "boss", ...e });
      }
    }
    if (this.boss) {
      const boss = w.enemies.find((e) => e.hp > 0 && e.kind === "boss");
      if (
        boss &&
        !elites.length &&
        t >= this.rest &&
        t >= this.horde &&
        boss.state !== "recover" &&
        !boss.grave?.deadUntil &&
        (t - this.reinforceEpoch) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "gravegrub",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn("gravegrub", (i * Math.PI) / 4 + w.random() * 0.3, true);
        this.horde = t + 3;
      }
      return;
    }
    for (let i = 0; i < 4; i++) {
      const at = [135, 225, 305, 311][i],
        deadline = i === 2 ? 328 : i === 3 ? 334 : 340;
      if (this.rounds[i] || t < at) continue;
      if (t > deadline) {
        this.rounds[i] = true;
        continue;
      }
      if (i < 3 && (elites.length || t < this.rest)) continue;
      if (i === 3 && (!this.firstReturn || t < this.firstReturn + 6)) continue;
      const e = this.spawn(
        i === 0 || i === 2 ? "coffinregent" : "scarprelate",
        w.random() * Math.PI * 2,
      );
      if (e) {
        this.rounds[i] = true;
        if (i === 2) this.firstReturn = t;
        this.special = 6;
        w.effects.push({ type: "elite", ...e });
      }
      break;
    }
    const quiet =
      t >= 350 ||
      (t >= 125 && t < 135) ||
      (t >= 215 && t < 225) ||
      (t >= 295 && t < 305);
    if (this.wave <= 0) {
      const n = quiet
        ? 3
        : Math.floor(
            Math.min(16, 6 + Math.floor(t / 40)) *
              (elites.length >= 2 ? 0.7 : 1),
          );
      for (let i = 0; i < n; i++)
        this.spawn(
          "gravegrub",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.7;
    }
    if (
      quiet ||
      elites.length ||
      t < this.rest ||
      this.special > 0 ||
      t < 30 ||
      (t >= 295 && t < 340)
    )
      return;
    const kinds: Kind[] =
      t < 65
        ? ["ribwarden"]
        : t < 95
          ? ["echoacolyte"]
          : t < 125
            ? ["shedstalker"]
            : t >= 265 && t < 295
              ? ["ribwarden", "echoacolyte"]
              : Math.floor(t / 20) % 2
                ? ["ribwarden", "echoacolyte"]
                : ["echoacolyte", "shedstalker"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          graveEnemy(e.kind) &&
          e.kind !== "gravegrub" &&
          !isElite(e.kind) &&
          !kinds.includes(e.kind),
      )
    )
      return;
    this.spawn(
      kinds[Math.floor(t / 5) % kinds.length],
      w.random() * Math.PI * 2,
    );
    this.special = 9;
  }

  initialize(e: Enemy) {
    if (e.kind !== "boss") return;
    const s = this.state(e);
    if (s.total) return;
    s.total = e.maxHp;
    this.stats.lifecycle.push({ event: "firstAlive", time: this.w.time });
    e.hp = e.maxHp = s.total * 0.4;
  }
  keep(e: Enemy) {
    return e.kind === "boss" && !!e.grave?.deadUntil && e.grave.life === 1;
  }
  tick() {
    const w = this.w;
    if (!w.active) return;
    for (const e of w.enemies) {
      const s = e.grave;
      if (!s?.deadUntil || s.life !== 1) continue;
      if (w.time + 1e-9 < s.deadUntil) continue;
      this.stats.lifecycle.push({ event: "secondAlive", time: w.time });
      s.life = 2;
      s.deadUntil = undefined;
      s.reviveAt = undefined;
      s.scar = undefined;
      s.items = undefined;
      s.step = 0;
      s.action = "A";
      s.vulnerable = false;
      e.hp = e.maxHp = s.total! * 0.6;
      e.state = "seek";
      e.immovable = false;
      e.pattern = 0;
      s.usedActions=0;
      e.attack = 0;
      e.bossPhase = 2;
      e.burn = 0;
      e.burnUntil = 0;
      e.burnNext = 0;
      e.slow = 0;
      e.slowUntil = 0;
      e.freezeUntil = 0;
      e.freezeReady = 0;
      e.fracture = 0;
      e.fractureUntil = 0;
      this.reinforceEpoch = w.time;
      this.horde = w.time + 3;
      w.effects.push({ type: "bossPhase", ...e, value: 2 });
      w.touch();
    }
  }
  totalRemaining(e: Enemy) {
    const s = this.state(e);
    return s.total
      ? Math.max(0, e.hp) + (s.life === 1 ? s.total * 0.6 : 0)
      : e.hp;
  }
  onHit(e: Enemy, source: string, dealt: number) {
    const s = this.state(e);
    if (e.kind !== "boss") return;
    const skill = source === "needleEcho" ? "needle" : (source as Skill);
    if (
      this.w.skills[skill] > 0 &&
      dealt > 0 &&
      s.vulnerable &&
      s.qualified &&
      e.state === "recover" &&
      distance(e, this.w.player) <= 2.8
    )
      this.w.challenge.graveGroups.add(`${s.life}${s.action}`);
  }
  supplies(e: Enemy) {
    const s = this.state(e);
    if (!s.total) return;
    let n = s.milestones ?? 0;
    while (
      n < 3 &&
      this.totalRemaining(e) <= s.total * (0.75 - n * 0.25) + 1e-8
    ) {
      this.w.dropBossPotion(e);
      n++;
    }
    s.milestones = n;
  }
  onDeath(e: Enemy) {
    const s = this.state(e);
    this.cancelPending(e);
    s.scar = undefined;
    if (e.kind === "boss" && s.life === 1 && s.total) {
      e.hp = 0;
      s.reviveAt = Math.max(
        this.w.time,
        ...(s.items ?? []).map((h) => h.until),
      );
      s.deadUntil = s.reviveAt + 2.4;
      this.stats.lifecycle.push(
        { event: "firstDead", time: this.w.time },
        { event: "revivalStart", time: s.reviveAt },
      );
      e.immovable = true;
      s.vulnerable = false;
      e.burn =
        e.burnUntil =
        e.slow =
        e.slowUntil =
        e.freezeUntil =
        e.fracture =
        e.fractureUntil =
          0;
      this.w.armory.support.clearTarget(e.id);
      return true;
    }
    if (e.kind === "boss" && s.life === 2)
      this.stats.lifecycle.push({ event: "finalDead", time: this.w.time });
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.id !== e.id && o.hp > 0 && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    return false;
  }
  private recover(e: Enemy, seconds = this.state(e).recover) {
    const s = this.state(e),
      items = s.items ?? [];
    s.qualified =
      !!items.length &&
      items.every(
        (h) =>
          !h.grave!.interrupted &&
          !h.grave!.damaged &&
          h.grave!.pulses.every(
            (f) => !f.cancelled && f.end <= this.w.time + 1e-8,
          ),
      ) &&
      (s.life === 1
        ? s.action === "A" || s.action === "B"
        : s.action === "B" && items.some((h) => h.grave!.dual));
    const body = items
      .flatMap((h) => h.grave!.pulses)
      .filter((f) => !f.old && !f.cancelled && f.end <= this.w.time + 1e-8)
      .sort((a, b) => b.end - a.end)[0];
    if (body) {
      s.scar = { ...body, hit: false };
      s.scarUntil = this.w.time + 12;
    }
    if (e.kind === "boss" && s.life === 2 && s.action === "B" && body) {
      for (const side of [1, -1]) {
        const a = e.facing + (side * Math.PI) / 2,
          p = { x: e.x + Math.cos(a) * 2.4, y: e.y + Math.sin(a) * 2.4 };
        if (!graveMap.blocked(p, 0.7)) {
          s.relocate = p;
          s.relocateUntil = this.w.time + 6;
          break;
        }
      }
    }
    s.items = undefined;
    s.step = 0;
    s.moveTo = undefined;
    s.waiting = undefined;
    s.vulnerable = true;
    e.immovable = false;
    e.state = "recover";
    e.timer = seconds * stageRecoveryFactor(this.w.stageId);
  }
  private move(
    e: Enemy,
    dt: number,
    target = this.w.player,
    speedOverride?: number,
  ) {
    const d = distance(e, target),
      a = graveMap.heading(e, target),
      speed =
        (speedOverride ??
          (e.kind === "boss"
            ? d > 5.2
              ? 5
              : this.state(e).life === 2
                ? 2.4
                : 1.6
            : ENEMIES[e.kind].speed)) *
        (e.slowUntil > this.w.time ? 1 - e.slow : 1);
    e.facing = a;
    if (d > 0.15)
      graveMove(
        e,
        {
          x: Math.cos(a) * Math.min(speed, d / Math.max(dt, 0.001)),
          y: Math.sin(a) * Math.min(speed, d / Math.max(dt, 0.001)),
        },
        dt,
        e.kind === "boss" ? 0.7 : 0.35,
        this.w.time,
      );
  }
  movePlayer(dt: number) {
    this.clean();
    graveMove(
      this.w.player,
      { x: this.w.move.x * this.w.speed, y: this.w.move.y * this.w.speed },
      dt,
      0.3,
      this.w.time,
      (a, z, from, to) => this.sample(a, z, from, to),
    );
  }
  sample(a: Point, z: Point, from: number, to: number) {
    for (const h of this.w.hazards)
      if (h.grave && !h.grave.cancelled) {
        const b = h.grave;
        for (const f of b.pulses)
          if (!f.hit && graveImpact(f, z, to, from, a)) {
            f.hit = true;
            const hp = this.w.hp;
            this.w.hurt(h.damage, h.damageLabel!, false, h.source);
            if (this.w.hp < hp) b.damaged = true;
          }
        b.last = to;
        b.player = { ...z };
      }
  }
  plan(e: Enemy, rotation = 0, bodyOnly = false): Hazard[] {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      warning = boss || isElite(e.kind) ? 2.4 : 2.2,
      aim = Math.atan2(w.player.y - e.y, w.player.x - e.x) + rotation,
      group = w.id(),
      action = s.action;
    const pulse = (
      angle = aim,
      radius = 4.2,
      half = 45,
      due = w.time + warning,
      old = false,
      origin: Point = e,
    ): GravePulse => ({
      x: origin.x,
      y: origin.y,
      angle,
      radius,
      half: (half * Math.PI) / 180,
      due,
      end: due + 0.18,
      old,
      hit: false,
    });
    let lists: GravePulse[][] = [];
    const echo = (r = 4.2, half = 45) => {
      const f = pulse(aim, r, half);
      return [f, { ...f, due: f.end + 2.4, end: f.end + 2.58, old: true }];
    };
    const cached =
      s.scar && s.scarUntil! > w.time && distance(s.scar, e) >= 1.5
        ? s.scar
        : undefined;
    if (boss && s.life === 2) {
      if (action === "A") lists = [echo(4.2, 50)];
      else if (action === "B") {
        lists = [[pulse(aim, 4.2, 50, w.time + warning + 0.8)]];
        if (cached && !bodyOnly)
          lists.unshift([
            {
              ...cached,
              due: w.time + 2.4,
              end: w.time + 2.58,
              hit: false,
              old: true,
            },
          ]);
      } else {
        lists = [[pulse(aim, 1.65, 180), pulse(aim, 4.2, 50, w.time + 4.98)]];
        if (cached && !bodyOnly)
          lists.push([
            {
              ...cached,
              due: w.time + 3.6,
              end: w.time + 3.78,
              hit: false,
              old: true,
            },
          ]);
      }
    } else if (action === "C" || action === "pair")
      lists = [
        [pulse(aim - (55 * Math.PI) / 180, 4.2, 40)],
        [pulse(aim + (55 * Math.PI) / 180, 4.2, 40, w.time + warning + 0.8)],
      ];
    else if (
      action === "B" ||
      action === "echo" ||
      action === "move" ||
      action === "mixed"
    ) {
      if (action === "mixed" && cached && !bodyOnly)
        lists = [
          [
            {
              ...cached,
              due: w.time + 2.4,
              end: w.time + 2.58,
              hit: false,
              old: true,
            },
          ],
          [pulse(aim, 4.2, 50, w.time + 3.2)],
        ];
      else lists = [echo(boss ? 3.6 : 4.2, boss ? 60 : 45)];
    } else lists = [[pulse()]];
    const dual = lists.length === 2 && lists.some((x) => x.some((f) => f.old));
    return lists.map((pulses, i) => ({
      id: w.id(),
      source: e.id,
      kind: "sector",
      x: e.x,
      y: e.y,
      angle: aim,
      radius: 4.2,
      width: 0,
      created: w.time,
      due: pulses[0].due,
      until: Math.max(...pulses.map((f) => f.end)),
      damage: boss
        ? s.life === 2 && action === "C"
          ? 28
          : 26
        : isElite(e.kind)
          ? 26
          : 22,
      fixedDamage: true,
      damageLabel: "墓苑骨震",
      fired: false,
      next: 0,
      grave: {
        pulses,
        group,
        life: s.life,
        action,
        order: i + 1,
        last: w.time,
        player: { ...w.player },
        dual,
      },
    }));
  }
  legal(h: Hazard) {
    return h.grave!.pulses.every((f) => {
      for (let i = 0; i <= 24; i++) {
        const a = f.angle - f.half + (2 * f.half * i) / 24,
          p = {
            x: f.x + Math.cos(a) * f.radius,
            y: f.y + Math.sin(a) * f.radius,
          };
        if (
          Math.abs(p.x) > 21.7 ||
          Math.abs(p.y) > 25.7 ||
          Math.abs(p.x - this.w.camera.x) > this.w.viewport.x - 0.4 ||
          Math.abs(p.y - this.w.camera.y) > this.w.viewport.y - 2.1
        )
          return false;
      }
      return true;
    });
  }
  private threatens(items:Hazard[]) {
    return items.some(h=>h.grave!.pulses.some(f=>!f.old&&graveDistance(f,this.w.player)<=.3+1e-9));
  }
  bossPosition(e:Enemy):Point|undefined {
    const w=this.w,s=this.state(e);let best:Point|undefined,score=Infinity;
    const state={...s,action:this.selectBossAction(e)};
    for(const radius of [2.8,3.4,3.8,1.2])for(let i=0;i<24;i++){
      const a=i*Math.PI/12,p={x:w.player.x+Math.cos(a)*radius,y:w.player.y+Math.sin(a)*radius};
      if(Math.abs(p.x)>21.3||Math.abs(p.y)>25.3||graveMap.blocked(p,.7))continue;
      const cost=distance(p,e);if(cost>=score)continue;
      const probe={...e,...p,grave:state};
      for(const turn of [0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2]){
        const plan=this.plan(probe,turn,true);
        if(plan.every(h=>this.legal(h))&&this.threatens(plan)){best=p;score=cost;break;}
      }
    }
    return best;
  }
  begin(e: Enemy) {
    const s = this.state(e),
      w = this.w;
    let items = this.plan(e),
      valid = false;
    for (const bodyOnly of [false, true]) {
      for (let i = 0; i < 36; i++) {
        const p = this.plan(e, (i * Math.PI) / 18, bodyOnly);
        if (
          this.slots + p.length <= 2 &&
          p.every((h) => this.legal(h)) &&
          (e.kind!=="boss"||this.threatens(p)) &&
          graveEscape(w, p)
        ) {
          items = p;
          valid = true;
          break;
        }
      }
      if (valid) break;
    }
    if (!valid) {
      this.stats.rejected++;
      e.attack = 0.5;
      s.relocate = this.position(
        Math.atan2(e.y - w.player.y, e.x - w.player.x) + Math.PI / 3,
        3,
      );
      s.relocateUntil = w.time + 4;
      return false;
    }
    s.recover =
      e.kind === "boss"
        ? (s.life === 1 ? [4.2, 4.6, 4.8] : [4.6, 4.8, 5.2])[
            "ABC".indexOf(s.action)
          ] || 4.6
        : isElite(e.kind)
          ? 4.4
          : 3.2;
    w.hazards.push(...items);
    s.items = items;
    s.step = 1;
    s.next = Math.max(...items.map((h) => h.until));
    s.vulnerable = false;
    s.qualified = false;
    s.waiting = undefined;
    e.state = "windup";
    e.immovable = true;
    this.stats.pulses += items.length;
    if (items.some((h) => h.grave!.dual)) this.stats.dualCasts++;
    if (
      (e.kind === "boss" && s.life === 2 && s.action === "A") ||
      s.action === "move" ||
      (s.action === "mixed" && items.length === 1)
    ) {
      const f = items[0].grave!.pulses[0],
        a = e.facing + Math.PI / 2,
        p = {
          x: e.x + Math.cos(a) * (e.kind === "boss" ? 2.4 : 2),
          y: e.y + Math.sin(a) * (e.kind === "boss" ? 2.4 : 2),
        };
      if (!graveMap.blocked(p, e.kind === "boss" ? 0.7 : 0.35)) {
        s.moveTo = p;
        s.moveAt = f.end;
      }
    }
    if (e.kind === "boss") {
      this.stats.patterns[s.action as "A" | "B" | "C"]++;
      this.stats.phases[s.life - 1]++;
      this.stats.phasePatterns[s.life - 1][s.action as "A" | "B" | "C"]++;
    }
    if (isElite(e.kind)) {
      this.lastElite = e.id;
      this.stats.eliteCasts[e.kind as "coffinregent" | "scarprelate"]++;
    }
    return true;
  }
  private cancelPending(e: Enemy) {
    const s = this.state(e);
    s.qualified = false;
    s.moveTo = undefined;
    for (const h of s.items ?? [])
      if (h.until > this.w.time && !h.grave!.interrupted) {
        graveCut(h, this.w.time);
        this.stats.cancelled++;
      }
  }
  clean() {
    for (const h of this.w.hazards)
      if (h.grave && !h.grave.interrupted) {
        const owner = this.w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!owner || owner.freezeUntil > this.w.time) graveCut(h, this.w.time);
      }
  }
  private eliteTurn(e: Enemy) {
    const w = this.w,
      s = this.state(e);
    s.waiting ??= w.time;
    const ready = w.enemies
      .filter(
        (o) =>
          o.hp > 0 &&
          isElite(o.kind) &&
          o.state === "seek" &&
          o.attack <= 0 &&
          o.freezeUntil <= w.time,
      )
      .sort(
        (a, b) =>
          (this.state(a).waiting ?? w.time) -
            (this.state(b).waiting ?? w.time) ||
          Number(a.id === this.lastElite) - Number(b.id === this.lastElite) ||
          a.id - b.id,
      );
    return !ready.length || ready[0].id === e.id;
  }
  /** Reorder a three-action bag by current spacing and an available old scar. */
  selectBossAction(e:Enemy):"A"|"B"|"C" {
    const s=this.state(e),d=distance(e,this.w.player),used=s.usedActions===7?0:s.usedActions??0;
    const scar=s.life===2&&s.scar&&s.scarUntil!>this.w.time&&distance(s.scar,e)>=1.5;
    const scores={A:d>3.5?5:2,B:scar?6:1,C:d<2?5:0};
    return (["A","B","C"] as const).filter((_,i)=>!(used&(1<<i))).sort((a,b)=>scores[b]-scores[a])[0];
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";
    if (boss) this.initialize(e);
    if (e.freezeUntil > w.time) {
      this.cancelPending(e);
      if (s.step && !(s.items ?? []).some((h) => h.until > w.time))
        this.recover(e);
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;
        s.qualified = false;
        e.attack = boss || isElite(e.kind) ? 0 : 3.2;
      }
      return;
    }
    if (s.step) {
      if (s.moveTo && w.time >= s.moveAt!) {
        e.immovable = false;
        this.move(e, dt, s.moveTo, 2.4);
      }
      if (w.time >= s.next) this.recover(e);
      return;
    }
    if (e.kind === "gravegrub") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (
      boss &&
      (w.enemies.some((o) => o.hp > 0 && isElite(o.kind)) ||
        w.hazards.some((h) => h.source !== e.id && h.until > w.time))
    ) {
      this.rest = w.time + 3;
      return;
    }
    if (boss && w.time < this.rest) return;
    if (
      !boss &&
      !isElite(e.kind) &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    )
      return;
    if (s.relocate) {
      if (w.time < (s.relocateUntil ?? 0) && distance(e, s.relocate) > 0.3) {
        this.move(e, dt, s.relocate);
        return;
      }
      s.relocate = undefined;
    }
    const d = distance(e, w.player);
    if (d > 5.2 || !w.visible(e, 1.2)) {
      this.move(e, dt);
      return;
    }
    if (d < (boss ? 1 : 0.65))
      w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > 3.2) this.move(e, dt);
      return;
    }
    if (isElite(e.kind) && !this.eliteTurn(e)) return;
    if (!boss && !isElite(e.kind) && w.time - this.lastStart < 3) {
      e.attack = 0.2;
      return;
    }
    s.action = boss
      ? this.selectBossAction(e)
      : e.kind === "coffinregent"
        ? "pair"
        : e.kind === "scarprelate"
          ? "mixed"
          : e.kind === "echoacolyte"
            ? "echo"
            : e.kind === "shedstalker"
              ? "move"
              : "A";
    if (this.begin(e)) {
      if(boss){const used=s.usedActions===7?0:s.usedActions??0;s.usedActions=used|(1<<"ABC".indexOf(s.action));}
      e.pattern++;
      this.lastStart = w.time;
    }else if(boss&&!this.slots){
      const used=s.usedActions===7?0:s.usedActions??0;s.usedActions=used|(1<<"ABC".indexOf(s.action));
    }
  }
  stepHazard(h: Hazard) {
    const b = h.grave!;
    if (!b.cancelled && b.last < this.w.time)
      this.sample(b.player, this.w.player, b.last, this.w.time);
  }
}
