import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { kilnMap } from "./KilnMap";
import {
  kilnEnvelope,
  kilnSolid,
  kilnMove,
  kilnImpact,
  kilnCut,
  kilnEscape,
} from "./KilnGeometry";
export const KILN_KINDS: readonly Kind[] = [
  "glazeling",
  "kilnstoker",
  "forkmason",
  "ashsled",
  "splitcrucible",
  "glazejailer",
];
export const kilnEnemy = (kind: Kind) =>
  KILN_KINDS.includes(kind) || kind === "kilnvalve";
export interface KilnState {
  action:
    | "straight"
    | "fork"
    | "bend"
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
  relocate?: Point;
  waiting?: number;
}
export class KilnSystem {
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
    straight: 0,
    fork: 0,
    bend: 0,
    valves: 0,
    cancelled: 0,
    rejected: 0,

    eliteCasts: { splitcrucible: 0, glazejailer: 0 },
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0, 0],
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): KilnState {
    return (
      e.kiln ??
      (e.kiln = {
        action: "straight",
        step: 0,
        next: 0,
        recover: 2.8,
        vulnerable: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.kiln?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !kilnMap.blocked(p, 0.8)) return p;
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
        boss.kiln?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "glazeling",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn("glazeling", (i * Math.PI) / 4 + w.random() * 0.3, true);
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
        i === 0 || i === 2 ? "splitcrucible" : "glazejailer",
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
          "glazeling",
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
        ? ["kilnstoker"]
        : t < 95
          ? ["forkmason"]
          : t < 125
            ? ["ashsled"]
            : t >= 265 && t < 295
              ? ["forkmason"]
              : Math.floor(t / 20) % 2
                ? ["kilnstoker", "forkmason"]
                : ["forkmason", "ashsled"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          kilnEnemy(e.kind) &&
          e.kind !== "glazeling" &&
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
    const s = this.state(e);
    e.state = "recover";
    e.timer = seconds * stageRecoveryFactor(this.w.stageId);
    e.immovable = false;
    s.step = 0;
    s.vulnerable = true;
    s.waiting = undefined;
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const d = distance(e, target),
      a = kilnMap.heading(e, target),
      speed =
        d > 0.3
          ? (e.kind === "boss" ? (d > 6.5 ? 5 : 1.25) : ENEMIES[e.kind].speed) *
            (e.slowUntil > this.w.time ? 1 - e.slow : 1)
          : 0;
    e.facing = a;
    kilnMove(
      e,
      { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      dt,
      e.kind === "boss" ? 0.7 : 0.35,
      this.w.time,
    );
  }
  movePlayer(dt: number) {
    const w = this.w;
    this.clean();
    kilnMove(
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
      if (h.kiln && !h.kiln.cancelled) {
        const b = h.kiln;
        if (!b.hit && kilnImpact(h, z, to, from, a)) {
          b.hit = true;
          w.hurt(h.damage, h.damageLabel!, false, h.source);
        }
        if (to >= h.due) h.fired = true;
        b.last = to;
        b.player = { ...z };
      }
  }
  thread(
    e: Enemy,
    shape: "straight" | "fork" | "bend",
    center: Point = this.w.player,
    angle = 0,
    delay = 0,
    order = 1,
    reverse = false,
  ): Hazard {
    const w = this.w,
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      large = boss || elite,
      sign = reverse ? -1 : 1;
    const point = (p: Point, d: number, a: number) => ({
      x: p.x + Math.cos(a) * d,
      y: p.y + Math.sin(a) * d,
    });
    const source = point(center, -2, angle),
      fork = { ...center };
    const path =
      shape === "straight"
        ? [source, point(source, 4.4, angle)]
        : [
            source,
            fork,
            point(
              fork,
              shape === "bend" ? 1.6 : 2.4,
              angle + (sign * Math.PI) / 4,
            ),
          ];
    if (shape === "bend") path.push(point(path[2], 1.6, angle));
    const length = shape === "bend" ? 5.2 : 4.4,
      due = w.time + delay + (large ? 2.2 : 2),
      valve =
        shape === "straight"
          ? undefined
          : point(source, 0.8, angle + Math.PI / 2);
    return {
      id: w.id(),
      source: e.id,
      kind: "circle",
      x: source.x,
      y: source.y,
      angle,
      radius: 0,
      width: 0,
      damage: boss ? 26 : elite ? 26 : 22,
      fixedDamage: true,
      damageLabel: "裂釉走焰",
      created: w.time,
      due,
      until: due + (length + 1.2) / 1.6,
      fired: false,
      next: 0,
      kiln: {
        shape,
        path,
        preview:
          shape === "straight"
            ? []
            : [fork, point(fork, 2.4, angle - (sign * Math.PI) / 4)],
        valve,
        length,
        limit: length,
        fork: shape === "straight" ? Infinity : 2,
        halfWidth: 0.22,
        speed: 1.6,
        body: 1.2,
        order,
        phase: e.bossPhase,
        boss,
        last: w.time,
        player: { ...w.player },
        hit: false,
      },
    };
  }
  plan(e: Enemy, rotation = 0): Hazard[] {
    const w = this.w,
      s = this.state(e),
      p = { ...w.player },
      boss = e.kind === "boss",
      phase = e.bossPhase;
    const angle =
      [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2][e.pattern % 4] + rotation;
    const line = (
      shape: "straight" | "fork" | "bend",
      center = p,
      a = angle,
      delay = 0,
      order = 1,
      reverse = false,
    ) => this.thread(e, shape, center, a, delay, order, reverse);
    const pair = (offset = 1) =>
      [-1, 1].map((v, i) =>
        line(
          "fork",
          {
            x: p.x - Math.sin(angle) * v * offset,
            y: p.y + Math.cos(angle) * v * offset,
          },
          angle,
          i * 0.8,
          i + 1,
          i === 1,
        ),
      );
    let items: Hazard[];
    if (s.action === "straight") items = [line("straight")];
    else if (s.action === "fork") {
      const partner =
        e.kind === "forkmason" && w.time >= 265 && w.time < 295
          ? w.enemies.find(
              (o) =>
                o.id !== e.id &&
                o.kind === "forkmason" &&
                o.hp > 0 &&
                o.state === "seek" &&
                o.freezeUntil <= w.time,
            )
          : undefined;
      items = partner
        ? [
            line(
              "fork",
              { x: p.x + Math.sin(angle), y: p.y - Math.cos(angle) },
              angle,
            ),
            this.thread(
              partner,
              "fork",
              { x: p.x - Math.sin(angle), y: p.y + Math.cos(angle) },
              angle,
              0.8,
              2,
              true,
            ),
          ]
        : [line("fork")];
    } else if (s.action === "bend") items = [line("bend")];
    else if (s.action === "pair")
      items =
        e.pattern % 3 === 0
          ? [line("straight")]
          : e.pattern % 3 === 1
            ? [line("fork")]
            : pair();
    else if (!boss)
      items = [
        line("straight"),
        line(
          "fork",
          { x: p.x - Math.sin(angle), y: p.y + Math.cos(angle) },
          angle,
          0.8,
          2,
          true,
        ),
      ];
    else if (s.action === "A")
      items =
        phase === 1
          ? [line("straight")]
          : [
              line("straight"),
              line(
                "fork",
                {
                  x: p.x - Math.sin(angle) * (phase === 3 ? 0.6 : 1),
                  y: p.y + Math.cos(angle) * (phase === 3 ? 0.6 : 1),
                },
                angle,
                0.8,
                2,
                true,
              ),
            ];
    else if (s.action === "B")
      items = [
        line(
          phase === 3 ? "bend" : "fork",
          p,
          angle + (phase === 2 ? Math.PI / 2 : 0),
        ),
      ];
    else {
      items = pair(phase === 2 ? 0.5 : 1);
      if (phase === 3) for (const h of items) h.damage = 30;
    }
    const envelope = items.flatMap((h) => kilnEnvelope(h));
    const shift = { x: 0, y: 0 };
    for (const axis of ["x", "y"] as const) {
      const low =
        axis === "x"
          ? Math.max(-21.9, w.camera.x - w.viewport.x + 0.5)
          : Math.max(-25.9, w.camera.y - w.viewport.y + 2.8);
      const high =
        axis === "x"
          ? Math.min(21.9, w.camera.x + w.viewport.x - 0.5)
          : Math.min(25.9, w.camera.y + w.viewport.y - 2.7);
      const min = Math.min(...envelope.map((p) => p[axis])),
        max = Math.max(...envelope.map((p) => p[axis]));
      shift[axis] = min < low ? low - min : max > high ? high - max : 0;
    }
    for (const h of items) {
      const b = h.kiln!;
      h.x += shift.x;
      h.y += shift.y;
      for (const p of Array.from(
        new Set([...b.path, ...b.preview, ...(b.valve ? [b.valve] : [])]),
      )) {
        p.x += shift.x;
        p.y += shift.y;
      }
    }
    return items;
  }
  legal(h: Hazard) {
    return (
      !kilnSolid(h) &&
      kilnEnvelope(h).every(
        (p) =>
          Math.abs(p.x - this.w.camera.x) < this.w.viewport.x - 0.4 &&
          p.y - this.w.camera.y < this.w.viewport.y - 2.6 &&
          p.y - this.w.camera.y > -this.w.viewport.y + 2.7,
      )
    );
  }
  private validPlan(items: Hazard[]) {
    return (
      !!items.length &&
      items.every((h) => this.legal(h)) &&
      kilnEscape(this.w, items)
    );
  }
  private recovery(e: Enemy) {
    const s = this.state(e);
    return e.kind === "boss"
      ? e.bossPhase === 1
        ? s.action === "C"
          ? 4.4
          : s.action === "B"
            ? 4
            : 3.8
        : e.bossPhase === 2
          ? s.action === "A"
            ? 4.4
            : s.action === "B"
              ? 4.2
              : 4.6
          : s.action === "A"
            ? 4.6
            : s.action === "B"
              ? 4.8
              : 5
      : isElite(e.kind)
        ? e.kind === "splitcrucible"
          ? 3.6
          : 3.8
        : e.kind === "kilnstoker"
          ? 2.8
          : 3;
  }
  private reject(e: Enemy) {
    this.stats.rejected++;
    this.recover(e);
    this.state(e).relocate = this.position(
      Math.atan2(e.y - this.w.player.y, e.x - this.w.player.x) + Math.PI / 3,
      3.2,
    );
    if (isElite(e.kind)) this.lastElite = e.id;
  }
  begin(e: Enemy) {
    const s = this.state(e);
    let items = this.plan(e);
    s.recover = this.recovery(e);
    if (this.slots + items.length > 2) {
      e.attack = 0.2;
      return false;
    }
    // Reserve all entity and danger capacity before publishing any part of a pair.
    let valves = items.filter((h) => h.kiln!.valve);
    if (
      this.w.enemies.filter((e) => e.hp > 0).length + valves.length > 100 ||
      this.w.enemies.filter((e) => e.hp > 0 && e.kind === "kilnvalve").length +
        valves.length >
        2
    ) {
      e.attack = 0.2;
      return false;
    }
    let valid = this.validPlan(items);
    // The full snapshot may rotate before publication; warning time, distances,
    // selected branch, paired offset and speed are never shortened to fit a corner.
    if (!valid)
      for (const turn of [
        Math.PI / 4,
        -Math.PI / 4,
        Math.PI / 2,
        -Math.PI / 2,
        Math.PI,
        (3 * Math.PI) / 4,
        (-3 * Math.PI) / 4,
      ]) {
        const candidate = this.plan(e, turn);
        if (this.validPlan(candidate)) {
          items = candidate;
          valid = true;
          break;
        }
      }
    if (!valid) {
      this.reject(e);
      return true;
    }
    valves = items.filter((h) => h.kiln!.valve);
    this.w.hazards.push(...items);
    for (const h of valves) {
      const v = this.w.addEnemy(
        "kilnvalve",
        h.kiln!.valve!.x,
        h.kiln!.valve!.y,
      )!;
      v.hp = v.maxHp = 160;
      v.immovable = true;
      v.owner = h.source;
      v.hazardId = h.id;
      h.kiln!.valveId = v.id;
    }
    for (const other of this.w.enemies)
      if (other.id !== e.id && items.some((h) => h.source === other.id)) {
        const state = this.state(other);
        state.action = "fork";
        state.step = 1;
        state.next = Math.max(...items.map((h) => h.until));
        state.recover = this.recovery(other);
        state.vulnerable = false;
        other.state = "windup";
        other.immovable = true;
        other.pattern++;
      }
    s.step = 1;
    s.next = Math.max(...items.map((h) => h.until));
    s.vulnerable = false;
    s.waiting = undefined;
    e.state = "windup";
    e.immovable = true;
    for (const h of items) this.stats[h.kiln!.shape]++;
    if (
      e.kind === "boss" &&
      (s.action === "A" || s.action === "B" || s.action === "C")
    ) {
      this.stats.patterns[s.action]++;
      this.stats.phases[e.bossPhase - 1]++;
    }
    if (e.kind === "splitcrucible" || e.kind === "glazejailer") {
      this.stats.eliteCasts[e.kind]++;
      this.lastElite = e.id;
    }
    return true;
  }
  private cancelPending(e: Enemy) {
    for (const h of this.w.hazards)
      if (h.source === e.id && h.kiln && !h.kiln.cancelled) {
        h.kiln.counterClosed = true;
        kilnCut(h, this.w.time);
        this.stats.cancelled++;
      }
  }
  clean() {
    const w = this.w;
    for (const h of w.hazards)
      if (h.kiln && !h.kiln.cancelled) {
        const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!owner || owner.freezeUntil > w.time) {
          h.kiln.counterClosed = true;
          kilnCut(h, w.time);
        }
      }
    for (const e of w.enemies)
      if (
        e.kind === "kilnvalve" &&
        e.hp > 0 &&
        !w.hazards.some(
          (h) =>
            h.id === e.hazardId &&
            h.kiln &&
            !h.kiln.cancelled &&
            h.until > w.time,
        )
      )
        e.hp = 0;
  }
  onDeath(e: Enemy) {
    if (e.kind === "kilnvalve") {
      const h = this.w.hazards.find(
        (h) =>
          h.id === e.hazardId &&
          h.kiln &&
          !h.kiln.cancelled &&
          h.until > this.w.time,
      );
      if (h) {
        const b = h.kiln!;
        if (
          !b.counterClosed &&
          this.w.enemies.some((o) => o.id === h.source && o.hp > 0) &&
          this.w.time < h.due + b.fork / b.speed
        ) {
          this.stats.valves++;
          if (b.boss) this.w.challenge.kilnPhases.add(b.phase);
        }
        kilnCut(h, this.w.time);
      }
      return true;
    }
    this.cancelPending(e);
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.id !== e.id && o.hp > 0 && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    this.clean();
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
    if (e.kind === "kilnvalve") return;
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
          ...w.hazards
            .filter(
              (h) =>
                h.source === e.id &&
                h.due <= w.time &&
                !h.kiln?.cancelled &&
                h.until > w.time,
            )
            .map((h) => h.until),
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
      if (s.step) {
        this.cancelPending(e);
        if (
          !w.hazards.some(
            (h) =>
              h.source === e.id &&
              h.kiln &&
              !h.kiln.cancelled &&
              h.until > w.time,
          )
        )
          this.recover(e);
      }
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        s.action = "straight";
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;
        e.attack =
          e.kind === "boss" || isElite(e.kind)
            ? 0
            : e.kind === "forkmason"
              ? 3.6
              : e.kind === "ashsled"
                ? 3.4
                : 3.2;
      }
      return;
    }
    if (s.step) {
      const live = w.hazards.filter(
        (h) =>
          h.source === e.id && h.kiln && !h.kiln.cancelled && h.until > w.time,
      );
      e.timer = Math.max(0, ...live.map((h) => h.due - w.time));
      if (!live.length) this.recover(e);
      return;
    }
    if (e.kind === "glazeling") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (boss && w.enemies.some((o) => o.hp > 0 && isElite(o.kind))) {
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
      if (distance(e, s.relocate) > 0.3) {
        this.move(e, dt, s.relocate);
        return;
      }
      s.relocate = undefined;
    }
    const d = distance(e, w.player);
    if (d > 8.5 || !w.visible(e, 1)) {
      this.move(e, dt);
      return;
    }
    if (d < (boss ? 1 : 0.65))
      w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > (boss ? 0.8 : 3.2)) this.move(e, dt);
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
      : e.kind === "splitcrucible"
        ? "pair"
        : e.kind === "glazejailer"
          ? "mixed"
          : e.kind === "ashsled"
            ? "bend"
            : e.kind === "forkmason"
              ? "fork"
              : "straight";
    if (this.begin(e)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.kiln!;
    if (b.cancelled) return;
    // Move-player normally samples all actual segments; this also handles explicit test/debug time advances.
    if (b.last < w.time) this.sample(b.player, w.player, b.last, w.time);
  }
}
