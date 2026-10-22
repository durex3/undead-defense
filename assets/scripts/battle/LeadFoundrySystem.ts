import { BossPlanChoice, type BossAction } from "./BossPlanChoice";
import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { leadMap } from "./LeadFoundryMap";
import {
  leadMove,
  leadEscape,
  leadCut,
  leadImpact,
  leadCross,
  leadPosition,
} from "./LeadFoundryGeometry";
import type { LeadLeg } from "./LeadFoundryGeometry";
export const LEAD_KINDS: readonly Kind[] = [
  "leadgrub",
  "pitchframe",
  "kneehopper",
  "offsetcart",
  "twinpitch",
  "presswarden",
];
export const leadEnemy = (kind: Kind) => LEAD_KINDS.includes(kind);
export interface LeadState {
  action:
    | "sweep"
    | "reverse"
    | "offset"
    | "pair"
    | "mixed"
    | "A"
    | "B"
    | "C"
    | "transition";
  step: number;
  next: number;
  recover: number;
  vulnerable: boolean;
  items?: Hazard[];
  origin?: Point;
  relocate?: Point;
  relocateUntil?: number;
  waiting?: number;

  earned?: boolean;
}
export class LeadFoundrySystem {
  readonly bossChoices = new BossPlanChoice();
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
    balls: 0,
    rejected: 0,
    cancelled: 0,
    qualified: 0,
    eliteCasts: { twinpitch: 0, presswarden: 0 },
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0, 0],
    phasePatterns: [
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
    ],
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): LeadState {
    return (
      e.lead ??
      (e.lead = {
        action: "sweep",
        step: 0,
        next: 0,
        recover: 3,
        vulnerable: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.lead?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !leadMap.blocked(p, 0.8)) return p;
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
    if (t >= 360 && !this.boss) {
      const e = this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      if (e) {
        this.boss = true;
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
        boss.lead?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "leadgrub",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn("leadgrub", (i * Math.PI) / 4 + w.random() * 0.3, true);
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
        i === 0 || i === 2 ? "twinpitch" : "presswarden",
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
          "leadgrub",
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
        ? ["pitchframe"]
        : t < 95
          ? ["kneehopper"]
          : t < 125
            ? ["offsetcart"]
            : t >= 265 && t < 295
              ? ["pitchframe", "kneehopper"]
              : Math.floor(t / 20) % 2
                ? ["pitchframe", "kneehopper"]
                : ["kneehopper", "offsetcart"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          leadEnemy(e.kind) &&
          e.kind !== "leadgrub" &&
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
  private recover(e: Enemy, seconds = this.state(e).recover) {
    const s = this.state(e),
      items = s.items ?? [];
    e.state = "recover";
    e.timer = seconds * stageRecoveryFactor(this.w.stageId);
    e.immovable = false;
    s.step = 0;
    s.vulnerable = true;
    s.waiting = undefined;
    const complete =
      items.length &&
      items.every(
        (h) =>
          !h.lead!.interrupted &&
          !h.lead!.damaged &&
          h.lead!.legs.every(
            (f) => !f.cancelled && f.end <= this.w.time + 1e-8,
          ),
      );
    if (complete && s.earned && e.kind === "boss") {
      const phase = items[0].lead!.phase;
      if (phase < 3 || items[0].lead!.bossC) {
        this.w.challenge.leadPhases.add(phase);
        this.stats.qualified++;
      }
    }
    s.items = undefined;
    s.origin = undefined;

    s.earned = false;
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const d = distance(e, target),
      a = leadMap.heading(e, target),
      speed =
        (e.kind === "boss" ? (d > 5.2 ? 5 : 1.6) : ENEMIES[e.kind].speed) *
        (e.slowUntil > this.w.time ? 1 - e.slow : 1);
    e.facing = a;
    if (d > 0.25)
      leadMove(
        e,
        { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        dt,
        e.kind === "boss" ? 0.7 : 0.35,
        this.w.time,
      );
  }
  movePlayer(dt: number) {
    this.clean();
    const w = this.w;
    leadMove(
      w.player,
      { x: w.move.x * w.speed, y: w.move.y * w.speed },
      dt,
      0.3,
      w.time,
      (a, z, from, to) => this.sample(a, z, from, to),
    );
  }
  sample(a: Point, z: Point, from: number, to: number) {
    const w = this.w;
    for (const h of w.hazards)
      if (h.lead && !h.lead.cancelled) {
        const b = h.lead;
        for (const f of b.legs) {
          if (!f.hit && leadImpact(f, z, to, from, a)) {
            f.hit = true;
            const hp = w.hp;
            w.hurt(h.damage, h.damageLabel!, false, h.source);
            if (w.hp < hp) b.damaged = true;
          }
          if (!b.interrupted) {
            leadCross(f, a, z, from, to);
            if (f.crossed) {
              const owner = w.enemies.find(
                (e) => e.id === h.source && e.hp > 0 && e.kind === "boss",
              );
              if (owner?.lead?.items?.includes(h))
                this.state(owner).earned = true;
            }
          }
        }
        if (to >= h.due) h.fired = true;
        b.last = to;
        b.player = { ...z };
      }
  }
  plan(e: Enemy, rotation = 0): Hazard[] {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      phase = boss ? e.bossPhase : 1,
      warning = boss || isElite(e.kind) ? 2.4 : 2.2;
    const group = w.id(),
      aim = Math.atan2(w.player.y - e.y, w.player.x - e.x) + rotation,
      d = Math.max(2.8, Math.min(4.4, distance(e, w.player))),
      a = s.action;
    const paired =
      a === "pair" || (boss && (a === "C" || (phase === 3 && a === "A")));
    const count = paired ? 2 : 1;
    return Array.from({ length: count }, (_, i) => {
      const angle = aim + (paired ? ((i ? -1 : 1) * 25 * Math.PI) / 180 : 0),
        u = { x: Math.cos(angle), y: Math.sin(angle) },
        v = { x: -Math.sin(angle), y: Math.cos(angle) };
      const point = (x: number, y = 0) => ({
        x: e.x + u.x * x + v.x * y,
        y: e.y + u.y * x + v.y * y,
      });
      const A = point(0.65, -0.25),
        B = point(d, 0.9),
        C = point(d + 0.9, -0.7),
        L = point(d - 0.9),
        R = point(d + 0.9);
      const side =
        e.kind === "offsetcart" ||
        e.kind === "presswarden" ||
        paired ||
        (boss && phase === 2 && a === "B");
      const origin = side ? point(0, (i ? -1 : 1) * 1.1) : { x: e.x, y: e.y };
      let points = [L, R],
        hold = false;
      if (
        a === "reverse" ||
        a === "mixed" ||
        (boss && (a === "B" || phase >= 2))
      )
        points = [A, B, C];
      if (a === "offset") points = [R, L];
      if (boss && phase === 2 && a === "B") points = [C, B, A];
      if (paired && boss && phase >= 2) points = i ? [C, B, A] : [A, B, C];
      if (
        (a === "mixed" && e.pattern % 2 === 1) ||
        (boss && ((phase === 2 && a === "A") || (phase === 3 && a === "B")))
      ) {
        points = phase === 3 || !boss ? [A, B, A] : [L, R, L];
        hold = true;
      }
      const offset = i * (boss && phase === 3 && a === "C" ? 0.48 : 0.8),
        legs: LeadLeg[] = [];
      for (const [j, target] of points.entries()) {
        const due =
          j === 0
            ? w.time + warning + offset
            : legs[j - 1].end + (hold && j === 2 ? 2.4 : 0.8);
        legs.push({
          from: { ...(j ? points[j - 1] : origin) },
          to: { ...target },
          launch: due - 0.8,
          due,
          end: due + 0.16,
          mount: j ? 0 : 0.8,
          index: j,
          hit: false,
        });
      }
      return {
        id: w.id(),
        source: e.id,
        kind: "circle",
        ...origin,
        angle,
        radius: 0.8,
        width: 0,
        created: w.time,
        due: legs[0].due,
        until: legs[legs.length - 1].end,
        damage: boss
          ? phase === 3 && a === "C"
            ? 28
            : 26
          : isElite(e.kind)
            ? 26
            : 22,
        fixedDamage: true,
        damageLabel: "铅丸落地",
        fired: false,
        next: 0,
        lead: {
          body: { x: e.x, y: e.y },
          origin: { ...origin },
          legs,
          group,
          phase,
          bossC: boss && a === "C",
          order: i + 1,
          last: w.time,
          player: { ...w.player },
        },
      };
    });
  }
  legal(h: Hazard) {
    const visible = (p: Point, r = 0.25) =>
      Math.abs(p.x - this.w.camera.x) < this.w.viewport.x - r &&
      p.y - this.w.camera.y < this.w.viewport.y - 2.1 - r &&
      p.y - this.w.camera.y > -this.w.viewport.y + 2.1 + r;
    return h.lead!.legs.every((f) => {
      if (
        leadMap.blocked(f.to, 0.8) ||
        Math.abs(f.to.x) > 21.2 ||
        Math.abs(f.to.y) > 25.2 ||
        !visible(f.to, 0.9)
      )
        return false;
      for (let i = 0; i <= 20; i++) {
        const q = leadPosition(f, f.launch + (0.8 * i) / 20);
        if (!visible({ x: q.x, y: q.y + q.z }) || !visible(q)) return false;
      }
      return true;
    });
  }
  private recovery(e: Enemy) {
    const a = this.state(e).action;
    return e.kind === "boss"
      ? e.bossPhase === 1
        ? a === "A"
          ? 4.2
          : a === "B"
            ? 4.4
            : 4.8
        : e.bossPhase === 2
          ? a === "A"
            ? 4.8
            : a === "B"
              ? 4.6
              : 5
          : a === "A"
            ? 5
            : a === "B"
              ? 5.2
              : 5.4
      : isElite(e.kind)
        ? 4.4
        : 3.2;
  }
  selectBossPlan(e:Enemy,preferred:BossAction){
    const state=this.state(e);
    return this.bossChoices.choose(e,preferred,(action,turn)=>this.plan({...e,lead:{...state,action}},turn),items=>items.every(h=>this.legal(h))&&leadEscape(this.w,items),items=>items.some(h=>h.lead!.legs.some(f=>leadImpact(f,this.w.player,f.end,f.due))));
  }
  begin(e: Enemy, proposal?: Hazard[]) {
    const w = this.w,
      s = this.state(e);
    let items = proposal ?? this.plan(e);
    s.recover = this.recovery(e);
    if (this.slots + items.length > 2) {
      e.attack = 0.2;
      return false;
    }
    let valid = items.every((h) => this.legal(h)) && leadEscape(w, items);
    if (!valid)
      for (const turn of Array.from(
        { length: 71 },
        (_, i) => ((i + 1) * Math.PI) / 36,
      )) {
        const candidate = this.plan(e, turn);
        if (candidate.every((h) => this.legal(h)) && leadEscape(w, candidate)) {
          items = candidate;
          valid = true;
          break;
        }
      }
    if (!valid) {
      this.stats.rejected++;
      this.recover(e);
      s.relocate = this.position(
        Math.atan2(e.y - w.player.y, e.x - w.player.x) + Math.PI / 3,
        3.2,
      );
      s.relocateUntil = w.time + 6;
      return false;
    }
    w.hazards.push(...items);
    if(e.kind==="boss"&&["A","B","C"].includes(s.action))this.bossChoices.commit(e,s.action as BossAction);
    s.items = items;
    s.origin = { x: e.x, y: e.y };

    s.earned = false;
    s.step = 1;
    s.next = Math.max(...items.map((h) => h.until));
    s.vulnerable = false;
    s.waiting = undefined;
    e.state = "windup";
    e.immovable = true;
    this.stats.balls += items.length;
    if (
      e.kind === "boss" &&
      (s.action === "A" || s.action === "B" || s.action === "C")
    ) {
      this.stats.patterns[s.action]++;
      this.stats.phases[e.bossPhase - 1]++;
      this.stats.phasePatterns[e.bossPhase - 1][s.action]++;
    }
    if (e.kind === "twinpitch" || e.kind === "presswarden") {
      this.stats.eliteCasts[e.kind]++;
      this.lastElite = e.id;
    }
    return true;
  }
  private cancelPending(e: Enemy) {
    const s = this.state(e);

    s.earned = false;
    for (const h of s.items ?? [])
      if (h.until > this.w.time && !h.lead!.interrupted) {
        leadCut(h, this.w.time);
        this.stats.cancelled++;
      }
  }
  clean() {
    const w = this.w;
    for (const h of w.hazards)
      if (h.lead && !h.lead.interrupted) {
        const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!owner || owner.freezeUntil > w.time) leadCut(h, w.time);
      }
  }
  onDeath(e: Enemy) {
    this.cancelPending(e);
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.id !== e.id && o.hp > 0 && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    return false;
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
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";

    if (boss) {
      const target = e.hp / e.maxHp <= 0.35 ? 3 : e.hp / e.maxHp <= 0.7 ? 2 : 1;
      if (target > e.bossPhase) {
        e.bossPhase = target;
        this.cancelPending(e);
        s.next = Math.max(
          s.action === "transition" ? s.next : w.time + 1.5,
          ...(s.items ?? []).map((h) => h.until),
        );
        s.action = "transition";
        s.step = 0;
        s.vulnerable = false;
        e.pattern = 0;
        e.state = "windup";
        e.immovable = true;
        w.effects.push({ type: "bossPhase", ...e, value: e.bossPhase });
        return;
      }
    }
    if (e.freezeUntil > w.time) {
      this.cancelPending(e);
      if (s.step && !(s.items ?? []).some((h) => h.until > w.time))
        this.recover(e);
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        s.action = "sweep";
        s.items = undefined;
        s.origin = undefined;
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;

        s.earned = false;
        e.attack = boss || isElite(e.kind) ? 0 : 3.2;
      }
      return;
    }
    if (s.step) {
      const live = (s.items ?? []).filter((h) => h.until > w.time);
      e.timer = Math.max(0, ...live.map((h) => h.due - w.time));
      if (!live.length) this.recover(e);
      return;
    }
    if (e.kind === "leadgrub") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (
      boss &&
      (w.enemies.some((o) => o.hp > 0 && isElite(o.kind)) ||
        w.hazards.some((h) => h.lead && h.source !== e.id && h.until > w.time))
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
      ? ((e.bossPhase === 1
          ? ["A", "B", "C"]
          : e.bossPhase === 2
            ? ["B", "A", "C"]
            : ["C", "B", "A"])[e.pattern % 3] as "A" | "B" | "C")
      : e.kind === "twinpitch"
        ? "pair"
        : e.kind === "presswarden"
          ? "mixed"
          : e.kind === "kneehopper"
            ? "reverse"
            : e.kind === "offsetcart"
              ? "offset"
              : "sweep";
    const proposal=boss&&this.slots===0?this.selectBossPlan(e,s.action as BossAction):undefined;
    if(proposal)s.action=proposal.action;
    if (this.begin(e,proposal?.items)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const b = h.lead!;
    if (!b.cancelled && b.last < this.w.time)
      this.sample(b.player, this.w.player, b.last, this.w.time);
  }
}
