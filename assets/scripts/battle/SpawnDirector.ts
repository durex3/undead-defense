import { sandMap } from "./SandMap";
import { siegeMap } from "./SiegeMap";
import { thunderMap } from "./ThunderMap";
import { hordePressure, bossCrowdRules } from "./HordePressure";
import { bossTimeForStage, encounterRealTime } from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Kind, ENEMIES, isElite } from "./SurvivalConfig";

/**
 * One director for the four playable stages. Each stage delegates its own
 * spawns and boss behaviour to its system; this class owns the shared boss
 * hand-off, elite schedule and reinforcement waves.
 */
export class SpawnDirector {
  restUntil = 0;
  private boss = false;
  private nextBossWave = 0;
  private elites = [false, false];
  private lastAngle = 0;

  step(w: SurvivalWorld, dt: number) {
    if (!w.active) return;
    if (w.stageId === 4) {
      w.moon.director(dt);
      return;
    }
    if (w.stageId === 3) {
      w.thunder.director(dt);
      return;
    }
    const bossTime = bossTimeForStage(w.stageId);
    if (w.time >= bossTime && !this.boss) {
      this.boss = true;
      w.hazards = [];
      let kept = 0;
      w.enemies = w.enemies.filter(
        (e) =>
          (e.kind === "minion" ||
            (w.stageId === 1 && e.kind === "siegebone") ||
            (w.stageId === 2 && e.kind === "sandworker")) &&
          e.hp > 0 &&
          kept++ < bossCrowdRules(w.stageId).target,
      );
      const p = this.position(w, Math.atan2(-w.player.y, -w.player.x), 6.5);
      w.addEnemy("boss", p.x, p.y);
      this.nextBossWave = w.time + 1.5;
      w.effects.push({ type: "boss", ...p });
      return;
    }
    if (this.boss) {
      this.bossHorde(w);
      return;
    }
    this.elitesAt(w, bossTime);
    if (w.stageId === 2) {
      w.sand.director(
        dt,
        (a) => this.position(w, a),
        (!this.elites[0] && w.time >= encounterRealTime(175)) || (!this.elites[1] && w.time >= encounterRealTime(345)),
      );
      return;
    }
    w.siege.director(
      dt,
      (a, r) => this.position(w, a, r),
      (!this.elites[0] && w.time >= 134) || (!this.elites[1] && w.time >= 263),
    );
  }

  private elitesAt(w: SurvivalWorld, bossTime: number) {
    for (let i = 0; i < 2; i++) {
      if (w.time >= bossTime - 20) break;
      const due = w.stageId === 2 ? encounterRealTime(i ? 345 : 175) : i ? 263 : 134;
      if (w.time < w.reinforcementRestUntil) continue;
      if (this.elites[i] || w.time < due) continue;
      const special = w.enemies.filter((e) => ENEMIES[e.kind].threat > 0).length;
      if (special > 2 && w.time < due + 20) continue;
      if (w.enemies.some((e) => isElite(e.kind) && e.hp > 0)) continue;
      const p = this.position(w, this.lastAngle + Math.PI, 7);
      const kind: Kind =
        w.stageId === 2
          ? i
            ? "breakerelite"
            : "broodelite"
          : i
            ? "siegerider"
            : "siegeflag";
      if (
        w.enemies.reduce((n, o) => n + (o.hp > 0 ? ENEMIES[o.kind].threat : 0), 0) +
          ENEMIES[kind].threat >
        6
      )
        continue;
      const e = w.addEnemy(kind, p.x, p.y);
      if (e) {
        w.hazards = w.hazards.filter((h) => h.source !== 0);
        e.hp *= i === 0 ? 0.9 : 1.1;
        e.maxHp = e.hp;
        e.state = "arriving";
        e.timer = 1.5;
        e.attack = i ? 1 : 4;
        this.elites[i] = true;
        w.effects.push({ type: "elite", ...p });
      }
      break;
    }
  }

  private bossHorde(w: SurvivalWorld) {
    const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
    if (
      !boss ||
      boss.state === "arriving" ||
      (boss.state === "windup" && boss.bossAction === "transition")
    ) {
      this.nextBossWave = Math.max(this.nextBossWave, w.time + 0.8);
      return;
    }
    // Dense surges alternate with a short clear-and-approach window for close-range builds.
    const bossTime = bossTimeForStage(w.stageId);
    if ((w.time - bossTime) % 14 >= 9) {
      this.nextBossWave = Math.max(this.nextBossWave, w.time + 0.3);
      return;
    }
    if (w.stageId === 1) w.siege.bossReinforcements();
    if (w.time < this.nextBossWave) return;
    const rules = bossCrowdRules(w.stageId, boss.bossPhase);
    this.nextBossWave = w.time + rules.interval;
    const alive = w.enemies.filter((e) => e.hp > 0 && e.kind !== "boss").length;
    const count = Math.min(rules.batch, rules.target - alive);
    // Omit an inward-facing sector so each new wave leaves a movement lane.
    const gap =
      Math.hypot(w.player.x, w.player.y) > 3
        ? Math.atan2(-w.player.y, -w.player.x)
        : Math.atan2(w.lastMove.y, w.lastMove.x);
    for (let i = 0; i < count; i++) {
      const angle = gap + 0.65 + ((Math.PI * 2 - 1.3) * (i + 0.5)) / count;
      const p = this.position(w, angle);
      if (Math.hypot(p.x - w.player.x, p.y - w.player.y) < 4) continue;
      const actual = Math.atan2(p.y - w.player.y, p.x - w.player.x);
      if (Math.abs(Math.atan2(Math.sin(actual - gap), Math.cos(actual - gap))) < 0.6) continue;
      const e = w.addEnemy(
        w.stageId === 2 ? "sandworker" : w.stageId === 1 ? "siegebone" : "minion",
        p.x,
        p.y,
        true,
      );
      if (!e) break;
      // Reinforcements are distinct from the boss's own capped summon skill.
      e.state = "arriving";
      e.timer = 1;
      e.owner = 0;
      e.bossReinforcement = true;
    }
  }

  private position(w: SurvivalWorld, angle: number, radius?: number) {
    for (let i = 0; i < 16; i++) {
      const a = angle + (i * Math.PI) / 8;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      const r =
        radius ??
        Math.min(
          (w.viewport.x + 0.8) / Math.max(0.01, Math.abs(dx)),
          (w.viewport.y + 0.8) / Math.max(0.01, Math.abs(dy)),
        );
      const center = radius ? w.player : w.camera;
      const x = center.x + dx * r,
        y = center.y + dy * r;
      if (
        !(w.stageId === 2 && sandMap.blocked({ x, y }, 0.65)) &&
        !(w.stageId === 1 && siegeMap.blocked({ x, y }, 0.4)) &&
        !(w.stageId === 3 && thunderMap.blocked({ x, y }, 0.4)) &&
        Math.abs(x) < 22.8 &&
        Math.abs(y) < 26.8 &&
        Math.hypot(x - w.player.x, y - w.player.y) > 3
      )
        return { x, y };
    }
    return {
      x: w.player.x > 0 ? -21 : 21,
      y: Math.max(-25, Math.min(25, w.player.y)),
    };
  }
}
