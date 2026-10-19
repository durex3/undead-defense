import type { SurvivalWorld } from "./SurvivalWorld";
import type { MoonSystem } from "./MoonSystem";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Point, distance } from "./SurvivalTypes";
import { moonMap } from "./MoonMap";
import { BOSS_TIME, encounterScoreTime, encounterRealTime } from "./EncounterPacing";
const TAU = Math.PI * 2;
export class MoonDirector {
  private nextGroup = 0;
  private nextSpecial = encounterRealTime(35);
  private specialWave = 0;
  private elites = [false, false];
  private boss = false;
  private lastSide = 1;
  constructor(
    private w: SurvivalWorld,
    private system: MoonSystem,
  ) {}
  private legal(p: Point, r = 0.35) {
    return (
      Math.abs(p.x) < 22 - r && Math.abs(p.y) < 26 - r && !moonMap.blocked(p, r)
    );
  }
  ordinaryRest() {
    const t = encounterScoreTime(this.w.time);
    return (
      (t >= 175 && t < 185) ||
      (t >= 290 && t < 300) ||
      (t >= 345 && t < 355) ||
      (t >= 472 && t < 480)
    );
  }
  suppressSpecial() {
    const w = this.w,
      t = w.time;
    return (
      this.ordinaryRest() ||
      w.time < Math.max(this.system.rest, w.reinforcementRestUntil) ||
      w.enemies.some((e) => isElite(e.kind) && e.hp > 0) ||
      (t >= BOSS_TIME &&
        w.enemies.some((e) => e.kind === "boss" && e.state !== "seek"))
    );
  }
  private allowed(): Kind[] {
    const t = encounterScoreTime(this.w.time);
    if (t < 35 || this.ordinaryRest() || t >= 472) return [];
    if (t < 75) return ["crescentmantis"];
    if (t < 115) return ["vaultlynx"];
    if (t < 150) return ["antlerprowler"];
    if (t < 175) return ["crescentmantis", "antlerprowler"];
    if (t < 235) return [];
    if (t < 290) return [this.specialWave % 2 ? "crescentmantis" : "vaultlynx"];
    if (t < 345) return ["vaultlynx", "antlerprowler"];
    if (t < 405) return [];
    if (t < 460)
      return [
        "crescentmantis",
        this.specialWave % 2 ? "vaultlynx" : "antlerprowler",
      ];
    return ["crescentmantis", "antlerprowler"];
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
        !this.legal(p, 0.7) ||
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
        kind === "thornrunner" &&
        flank &&
        w.enemies.filter(
          (o) => o.moon?.flankUntil && o.moon.flankUntil > w.time,
        ).length < 6
      ) {
        const point = {
          x: w.player.x + Math.cos(a + (this.lastSide * Math.PI) / 2) * 3,
          y: w.player.y + Math.sin(a + (this.lastSide * Math.PI) / 2) * 3,
        };
        if (this.legal(point))
          e.moon = {
            action: "blades",
            step: 0,
            next: 0,
            recovery: 0,
            cooldown: 0,
            flank: point,
            flankUntil: w.time + 2.8,
          };
      }
      return e;
    }
    return undefined;
  }
  director(dt: number) {
    const w = this.w, score = encounterScoreTime(w.time);
    this.system.clean();
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
      for (let i = 0; i < 2; i++)
        if (!this.elites[i] && score >= [185, 355][i]) {
          if (score >= 460) {
            this.elites[i] = true;
            continue;
          }
          if (
            w.time < Math.max(this.system.rest, w.reinforcementRestUntil) ||
            w.enemies.some((e) => e.hp > 0 && isElite(e.kind))
          )
            break;
          const e = this.spawn(
            i ? "hornwarden" : "moonreaver",
            w.random() * TAU,
          );
          if (e) {
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
          w.time < Math.max(this.system.rest, w.reinforcementRestUntil),
        elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind));
      const ordinary = w.enemies.filter(
        (e) => e.hp > 0 && e.kind === "thornrunner",
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
          "thornrunner",
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
        this.system.reinforce &&
        boss?.state === "seek" &&
        !w.enemies.some(
          (e) =>
            e.hp > 0 &&
            ["crescentmantis", "vaultlynx", "antlerprowler"].includes(e.kind),
        )
      ) {
        const e = this.spawn(
          this.system.completed % 4 ? "crescentmantis" : "vaultlynx",
          w.random() * TAU,
        );
        if (e) {
          e.summoned = true;
          e.bossReinforcement = true;
          this.system.reinforce = 0;
        }
      }
      return;
    }
    if (
      score >= 235 &&
      score < 290 &&
      w.enemies.some((e) => e.hp > 0 && ENEMIES[e.kind].threat > 0)
    )
      return;
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
}
