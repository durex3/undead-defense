import {
  Card,
  COOLDOWNS,
  ENEMIES,
  Kind,
  Skill,
  SKILLS,
  XP,
  stageWaves,
} from "./Config";
export interface Enemy {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  slow: number;
  slowUntil: number;
  freezeUntil: number;
  freezeReady: number;
  burn: number;
  burnUntil: number;
  burnNext: number;
}
export interface Shot {
  id: number;
  skill: Skill | "gun";
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  left: number;
  hit: number[];
  target: number;
  ttl: number;
}
export interface Effect {
  type: string;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  value?: number;
  skill?: string;
}
interface Zone {
  x: number;
  y: number;
  until: number;
  next: number;
  damage: number;
}
export class BattleWorld {
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  effects: Effect[] = [];
  zones: Zone[] = [];
  state: "battle" | "upgrade" | "won" | "lost" = "battle";
  pauses = new Set<string>();
  hp: number;
  maxHp: number;
  attack: number;
  time = 0;
  wave = 0;
  level = 1;
  xp = 0;
  kills = 0;
  power = 0;
  haste = 0;
  skills: Record<Skill, number> = {
    fire: 0,
    ice: 0,
    lightning: 0,
    ballista: 0,
  };
  cooldowns: Record<Skill, number> = {
    fire: 0,
    ice: 0,
    lightning: 0,
    ballista: 0,
  };
  cards: Card[] = [];
  refreshes = 1;
  ultimate = 0;
  bonusGold = 0;
  damage: Record<string, number> = {};
  losses: Record<string, number> = {};
  revision = 0;
  focusId = 0;
  focusUntil = 0;
  seed: number;
  private nextId = 1;
  private gun = 0;
  private plan: Kind[][];
  private spawn: Kind[] = [];
  private spawnTimer = 0;
  private rest = 0;
  private waveStarted = false;
  constructor(
    public stage = 1,
    weaponLevel = 0,
    wallLevel = 0,
    seed = 12345,
  ) {
    this.seed = seed;
    this.maxHp = 1000 * (1 + 0.05 * wallLevel);
    this.hp = this.maxHp;
    this.attack = 20 * (1 + 0.05 * weaponLevel);
    this.plan = stageWaves(stage);
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  touch() {
    this.revision++;
  }
  drain() {
    const result = this.effects;
    this.effects = [];
    return result;
  }
  focus(id: number) {
    this.focusId = id;
    this.focusUntil = this.time + 3;
    this.touch();
  }
  pause(reason: string, on: boolean) {
    on ? this.pauses.add(reason) : this.pauses.delete(reason);
    this.touch();
  }
  get cleared() {
    return this.waveStarted ? Math.max(0, this.wave - 1) : this.wave;
  }
  get active() {
    return this.state === "battle" && this.pauses.size === 0;
  }
  addEnemy(kind: Kind, x?: number, y = 18) {
    const c = ENEMIES[kind];
    const hp = c.hp * [1, 1.5, 2.15][this.stage - 1];
    const e: Enemy = {
      id: this.nextId++,
      kind,
      x: x ?? (this.random() - 0.5) * 8.4,
      y,
      hp,
      maxHp: hp,
      attack: c.interval,
      slow: 0,
      slowUntil: 0,
      freezeUntil: 0,
      freezeReady: 0,
      burn: 0,
      burnUntil: 0,
      burnNext: 0,
    };
    this.enemies.push(e);
    this.effects.push({ type: "spawn", x: e.x, y: e.y });
    return e;
  }
  step(dt: number) {
    if (!this.active) return;
    this.time += dt;
    this.ultimate = Math.max(0, this.ultimate - dt);
    if (!this.waveStarted) {
      this.rest -= dt;
      if (this.rest <= 0) {
        this.spawn = this.plan[this.wave].slice();
        for (let i = this.spawn.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.spawn[i], this.spawn[j]] = [this.spawn[j], this.spawn[i]];
        }
        this.wave++;
        this.waveStarted = true;
        this.spawnTimer = 0;
        this.effects.push({ type: "wave", x: 0, y: 0, value: this.wave });
        this.touch();
      }
    }
    if (this.spawn.length && this.enemies.length < 80) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.addEnemy(this.spawn.shift()!);
        const window = this.stage === 1 ? 15 : this.stage === 2 ? 9 : 5;
        this.spawnTimer = window / Math.max(1, this.plan[this.wave - 1].length);
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const cfg = ENEMIES[e.kind];
      if (e.burnUntil >= this.time && e.burnNext <= this.time) {
        e.burnNext += 1;
        this.hit(e, e.burn, "fire", false);
      }
      if (e.hp <= 0) continue;
      const stop = e.kind === "mage" ? 8 : 0.65;
      if (e.y > stop) {
        const slow = e.slowUntil > this.time ? e.slow : 0;
        if (e.freezeUntil <= this.time)
          e.y = Math.max(stop, e.y - cfg.speed * (1 - slow) * dt);
      } else if (e.freezeUntil <= this.time) {
        e.attack -= dt;
        if (e.attack <= 0) {
          const amount = cfg.damage * Math.pow(1.06, this.stage - 1);
          this.hp = Math.max(0, this.hp - amount);
          this.losses[e.kind] = (this.losses[e.kind] || 0) + amount;
          e.attack = cfg.interval;
          this.effects.push({ type: "wallHit", x: e.x, y: 0, value: amount });
          this.touch();
        }
      }
    }
    this.gun -= dt;
    const target = this.target();
    if (target && this.gun <= 0) {
      this.fire("gun", target);
      this.gun = 0.5 / (1 + this.haste * 0.1);
    }
    for (const s of SKILLS) {
      this.cooldowns[s] = Math.max(0, this.cooldowns[s] - dt);
      if (this.skills[s] && target && this.cooldowns[s] <= 0) {
        this.cast(s, target);
        this.cooldowns[s] = COOLDOWNS[s];
      }
    }
    for (const p of this.shots) {
      const ox = p.x,
        oy = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ttl -= dt;
      if (p.skill === "fire") {
        const t = this.enemies.find((e) => e.id === p.target && e.hp > 0);
        if (t) {
          const len = Math.hypot(t.x - p.x, t.y - p.y);
          p.vx = ((t.x - p.x) / Math.max(0.01, len)) * 22;
          p.vy = ((t.y - p.y) / Math.max(0.01, len)) * 22;
        }
        if ((t && Math.hypot(t.x - p.x, t.y - p.y) < 0.8) || p.ttl <= 0) {
          this.explode(p.x, p.y, p.damage);
          p.left = 0;
        }
        continue;
      }
      const hits = this.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            !p.hit.includes(e.id) &&
            this.segmentDistance(e.x, e.y, ox, oy, p.x, p.y) <
              (e.kind === "boss" ? 0.8 : 0.38),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy),
        );
      for (const e of hits) {
        let d = p.damage;
        if (
          p.skill === "ballista" &&
          this.skills.ballista === 5 &&
          e.kind === "boss"
        )
          d *= 1.5;
        this.hit(e, d, p.skill);
        p.hit.push(e.id);
        p.left--;
        if (p.skill === "ice") this.chill(e);
        if (!p.left) break;
      }
    }
    this.shots = this.shots.filter(
      (p) => p.left > 0 && p.ttl > 0 && Math.abs(p.x) < 15 && p.y < 25,
    );
    for (const z of this.zones)
      if (z.until >= this.time && z.next <= this.time) {
        z.next += 1;
        for (const e of this.near(z.x, z.y, 1.8).slice(0, 8))
          this.hit(e, z.damage, "fire", false);
      }
    this.zones = this.zones.filter((z) => z.until > this.time);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.hp <= 0) {
      this.state = "lost";
      this.touch();
      return;
    }
    if (this.waveStarted && !this.spawn.length && !this.enemies.length) {
      this.waveStarted = false;
      this.rest = 3;
      if (this.wave === 9) this.xp += 12;
      if (this.wave === this.plan.length) {
        this.state = "won";
        this.touch();
        return;
      }
    }
    this.checkUpgrade();
  }
  private segmentDistance(
    x: number,
    y: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ) {
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
    );
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  }
  target() {
    const live = this.enemies.filter((e) => e.hp > 0);
    return (
      (this.focusUntil > this.time
        ? live.find((e) => e.id === this.focusId)
        : undefined) || live.sort((a, b) => a.y - b.y || a.id - b.id)[0]
    );
  }
  private scale(s: Skill) {
    return this.skills[s] >= 4 ? 1.5 : this.skills[s] >= 2 ? 1.25 : 1;
  }
  private fire(skill: Skill | "gun", target: Enemy) {
    const length = Math.hypot(target.x, target.y + 1);
    const speed = skill === "fire" ? 22 : 30;
    const base =
      skill === "gun" ? 1 : skill === "ballista" ? 4 : skill === "fire" ? 2 : 1;
    const damage =
      this.attack * base * (skill === "gun" ? 1 : this.scale(skill));
    this.shots.push({
      id: this.nextId++,
      skill,
      x: 0,
      y: -1,
      vx: (target.x / length) * speed,
      vy: ((target.y + 1) / length) * speed,
      damage,
      left:
        skill === "ballista"
          ? this.skills.ballista >= 3
            ? 5
            : 3
          : skill === "ice"
            ? this.skills.ice >= 3
              ? 6
              : 4
            : 1,
      hit: [],
      target: target.id,
      ttl: 1.5,
    });
    this.effects.push({ type: "fire", x: 0, y: -1, skill });
  }
  private cast(s: Skill, target: Enemy) {
    if (s === "lightning") {
      let current = target;
      const used: number[] = [];
      let damage = this.attack * 1.5 * this.scale(s);
      for (let i = 0; i < (this.skills[s] >= 3 ? 6 : 4); i++) {
        used.push(current.id);
        this.hit(current, damage, s);
        const next = this.enemies
          .filter(
            (e) =>
              e.hp > 0 &&
              !used.includes(e.id) &&
              Math.hypot(e.x - current.x, e.y - current.y) <= 3,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - current.x, a.y - current.y) -
              Math.hypot(b.x - current.x, b.y - current.y),
          )[0];
        this.effects.push({
          type: "lightning",
          x: current.x,
          y: current.y,
          endX: next?.x ?? 0,
          endY: next?.y ?? -1,
        });
        if (!next) break;
        current = next;
        damage *= this.skills[s] === 5 ? 0.9 : 0.8;
      }
      return;
    }
    if (
      s === "fire" &&
      !(this.focusUntil > this.time && target.id === this.focusId)
    ) {
      const radius = this.skills.fire >= 3 ? 1.8 : 1.5;
      target = this.enemies
        .filter((e) => e.hp > 0)
        .sort(
          (a, b) =>
            this.near(b.x, b.y, radius).length -
              this.near(a.x, a.y, radius).length || a.y - b.y,
        )[0];
    }
    this.fire(s, target);
  }
  private near(x: number, y: number, r: number) {
    return this.enemies
      .filter((e) => e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= r)
      .sort((a, b) => a.id - b.id);
  }
  private explode(x: number, y: number, damage: number) {
    for (const e of this.near(x, y, this.skills.fire >= 3 ? 1.8 : 1.5).slice(
      0,
      8,
    )) {
      this.hit(e, damage, "fire");
      e.burn = Math.max(e.burn, this.attack * 0.2 * this.scale("fire"));
      e.burnUntil = this.time + 3;
      e.burnNext = this.time + 1;
    }
    if (this.skills.fire === 5)
      this.zones.push({
        x,
        y,
        until: this.time + 3,
        next: this.time + 1,
        damage: this.attack * 0.4 * this.scale("fire"),
      });
    this.effects.push({ type: "explosion", x, y });
  }
  private chill(e: Enemy) {
    e.slow = e.kind === "boss" ? 0.175 : 0.35;
    e.slowUntil = this.time + 2;
    if (this.skills.ice === 5 && e.freezeReady <= this.time) {
      if (e.kind === "boss") {
        e.slow = 0.25;
      } else e.freezeUntil = this.time + 0.6;
      e.freezeReady = this.time + 4;
    }
  }
  hit(e: Enemy, base: number, source: string, crit = true) {
    if (e.hp <= 0) return;
    const physical = source === "gun" || source === "ballista";
    const amount =
      base *
      (1 + this.power * 0.1) *
      (crit && this.random() < 0.05 ? 1.5 : 1) *
      (physical && e.kind === "warrior" ? 0.7 : 1);
    const dealt = Math.min(e.hp, amount);
    e.hp -= amount;
    this.damage[source] = (this.damage[source] || 0) + dealt;
    this.effects.push({
      type: "hit",
      x: e.x,
      y: e.y,
      value: dealt,
      skill: source,
    });
    if (e.hp <= 0) {
      this.kills++;
      this.xp += ENEMIES[e.kind].xp;
      this.effects.push({ type: "death", x: e.x, y: e.y, skill: e.kind });
    }
    this.touch();
  }
  useUltimate() {
    if (!this.active || this.ultimate > 0) return false;
    for (const e of this.enemies) {
      this.hit(e, this.attack * 2, "ultimate");
      if (e.kind !== "boss") e.y = Math.min(18, e.y + 2);
    }
    this.ultimate = 45;
    this.effects.push({ type: "ultimate", x: 0, y: 7 });
    this.touch();
    return true;
  }
  private checkUpgrade() {
    if (this.level < 13 && this.xp >= XP[this.level - 1]) {
      this.xp -= XP[this.level - 1];
      this.level++;
      this.state = "upgrade";
      this.roll();
    }
  }
  legal(): Card[] {
    const slots = SKILLS.filter((s) => this.skills[s] > 0).length;
    const pool: Card[] = SKILLS.filter(
      (s) => this.skills[s] < 5 && (this.skills[s] > 0 || slots < 3),
    );
    if (this.power < 3) pool.push("power");
    if (this.haste < 3) pool.push("haste");
    if (this.hp < this.maxHp * 0.7) pool.push("repair");
    return pool;
  }
  private roll() {
    const pool = this.legal();
    const cards: Card[] = [];
    const pick = (a: Card[]) => {
      if (!a.length) return;
      const c = a[Math.floor(this.random() * a.length)];
      cards.push(c);
      pool.splice(pool.indexOf(c), 1);
    };
    if (this.level <= 3)
      pick(
        pool.filter(
          (c) => SKILLS.includes(c as Skill) && !this.skills[c as Skill],
        ),
      );
    pick(
      pool.filter(
        (c) => SKILLS.includes(c as Skill) && this.skills[c as Skill] > 0,
      ),
    );
    while (cards.length < 3 && pool.length) pick(pool);
    this.cards = cards.length
      ? cards
      : [this.hp < this.maxHp ? "repair" : "gold"];
    this.touch();
  }
  refresh() {
    if (this.state !== "upgrade" || !this.refreshes) return false;
    this.refreshes--;
    this.roll();
    return true;
  }
  choose(c: Card) {
    if (this.state !== "upgrade" || !this.cards.includes(c)) return false;
    if (SKILLS.includes(c as Skill)) this.skills[c as Skill]++;
    else if (c === "power") this.power++;
    else if (c === "haste") this.haste++;
    else if (c === "repair")
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15);
    else this.bonusGold += 10;
    this.cards = [];
    this.state = "battle";
    this.checkUpgrade();
    this.touch();
    return true;
  }
}
