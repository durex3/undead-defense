import type { SurvivalWorld } from "./SurvivalWorld";
import type { TwingateSystem } from "./TwingateSystem";
import { ENEMIES, isElite, type Kind } from "./SurvivalConfig";
import { distance, type Enemy, type Point } from "./SurvivalTypes";
import { twingateMap } from "./TwingateMap";
const gateEnemy = (k: Kind) =>
  [
    "gategrub",
    "shorthorn",
    "bowwatch",
    "splitblade",
    "huntermarshal",
    "gateballista",
  ].includes(k);
export class TwingateDirector {
  private reinforceEpoch = 360;
  private wave = 0;
  private special = 0;
  private rounds = [false, false, false, false];
  private firstReturn = 0;
  private boss = false;
  private horde = 0;
  private rest = 0;
  constructor(
    private w: SurvivalWorld,
    private system: TwingateSystem,
  ) {}
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !twingateMap.blocked(p, 0.8))
        return p;
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
  step(dt: number) {
    const w = this.w,
      t = w.time;
    this.wave -= dt;
    this.special -= dt;
    if (t >= 350) this.system.retireSpecials();
    const elites = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
    if (
      t >= 360 &&
      !this.boss &&
      !elites.length &&
      t >= this.rest &&
      !w.hazards.some((h) => h.until > t)
    ) {
      const e = this.system.spawnBosses()?.[0];
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
        this.system.canReinforce &&
        (t - this.reinforceEpoch) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "gategrub",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn("gategrub", (i * Math.PI) / 4 + w.random() * 0.3, true);
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
        i === 0 || i === 2 ? "huntermarshal" : "gateballista",
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
          "gategrub",
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
        ? ["shorthorn"]
        : t < 95
          ? ["bowwatch"]
          : t < 125
            ? ["splitblade"]
            : t >= 235 && t < 265
              ? ["splitblade"]
              : t >= 265 && t < 295
                ? ["shorthorn", "bowwatch", "splitblade"]
                : Math.floor(t / 20) % 2
                  ? ["shorthorn", "bowwatch"]
                  : ["bowwatch", "splitblade"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          gateEnemy(e.kind) &&
          e.kind !== "gategrub" &&
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

  onDeath(e: Enemy) {
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.hp > 0 && o.id !== e.id && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
  }
}
