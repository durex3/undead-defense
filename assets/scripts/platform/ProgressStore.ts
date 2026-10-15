import type { StoragePort } from "./StoragePort";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import {
  CHARACTERS,
  CharacterId,
  StageId,
  STAGE_IDS,
} from "../battle/ProgressionConfig";
/** Deliberate fresh start: old keys and old schemas are never read. */
export const PROGRESS_KEY = "ashen-survivors-armory-progress-v1";
export interface StageBest {
  time: number;
  phase: number;
  bossRemaining: number | null;
  won: boolean;
}
export interface ProgressData {
  version: 1;
  rules: "armory-v1";
  revision: number;
  stages: number[];
  stageBest: Record<string, StageBest>;
  best: { kills: number; time: number; weapons: number };
}
const fresh = (): ProgressData => ({
  version: 1,
  rules: "armory-v1",
  revision: 0,
  stages: [],
  stageBest: {},
  best: { kills: 0, time: 0, weapons: 0 },
});
export class ProgressStore {
  data: ProgressData = fresh();
  pending = false;
  constructor(private storage: StoragePort) {
    for (const key of [
      "ashen-survivors-progress-v1",
      "ashen-survivors-progress-v1-backup",
      "ashen-survivors-preferences-v1",
      "undead-defense-v1",
      "undead-defense-v1-backup",
    ])
      try {
        storage.removeItem?.(key);
      } catch {}
    const candidates: ProgressData[] = [];
    for (const key of [PROGRESS_KEY, PROGRESS_KEY + "-backup"])
      try {
        const d = JSON.parse(storage.getItem(key) || "null");
        if (this.valid(d)) candidates.push(d);
      } catch {}
    if (candidates.length)
      this.data = candidates.sort((a, b) => b.revision - a.revision)[0];
  }
  private valid(d: any): d is ProgressData {
    return (
      d?.version === 1 &&
      d.rules === "armory-v1" &&
      Number.isSafeInteger(d.revision) &&
      d.revision >= 0 &&
      Array.isArray(d.stages) &&
      d.stages.every((id: number) =>
        (STAGE_IDS as readonly number[]).includes(id),
      ) &&
      new Set(d.stages).size === d.stages.length &&
      ["kills", "time", "weapons"].every(
        (k) => Number.isFinite(d.best?.[k]) && d.best[k] >= 0,
      ) &&
      d.stageBest &&
      typeof d.stageBest === "object" &&
      !Array.isArray(d.stageBest) &&
      Object.entries(d.stageBest).every(
        ([id, b]: [string, any]) =>
          (STAGE_IDS as readonly number[]).includes(Number(id)) &&
          Number.isFinite(b?.time) &&
          b.time >= 0 &&
          Number.isInteger(b.phase) &&
          b.phase >= 0 &&
          b.phase <= 3 &&
          typeof b.won === "boolean" &&
          (b.bossRemaining === null ||
            (Number.isFinite(b.bossRemaining) &&
              b.bossRemaining >= 0 &&
              b.bossRemaining <= 100)),
      )
    );
  }
  get weaponSlots() {
    return 6;
  }
  unlockedCharacter(id: CharacterId) {
    const stage = CHARACTERS[id].stage;
    return !stage || this.data.stages.includes(stage);
  }
  unlockedStage(stage: StageId) {
    return stage === 14 || (stage === 15 && this.data.stages.includes(14));
  }
  bestLine(stage: StageId) {
    const b = this.data.stageBest[stage];
    return !b
      ? "本关尚无挑战记录"
      : b.won
        ? "本关最佳：已通关"
        : b.phase > 0
          ? `本关最佳：首领第 ${b.phase} 阶段 · 剩余 ${b.bossRemaining}%`
          : `本关最佳：存活 ${Math.floor(b.time)} 秒`;
  }
  observe(w: SurvivalWorld) {
    if (!(STAGE_IDS as readonly number[]).includes(w.stageId) || w.state !== "won" && w.state !== "lost") return [];
    const next: ProgressData = JSON.parse(JSON.stringify(this.data)),
      boss = w.enemies.find((e) => e.kind === "boss");
    const current: StageBest = {
        time: Math.floor(w.time),
        phase: boss?.bossPhase || 0,
        bossRemaining: boss
          ? Math.ceil((Math.max(0, boss.hp) / boss.maxHp) * 100)
          : null,
        won: w.state === "won",
      },
      best = next.stageBest[w.stageId];
    if (
      !best ||
      (!best.won &&
        (current.won ||
          current.phase > best.phase ||
          (current.phase === best.phase &&
            (current.phase > 0
              ? current.bossRemaining! < best.bossRemaining!
              : current.time > best.time))))
    )
      next.stageBest[w.stageId] = current;
    next.best.kills = Math.max(next.best.kills, w.kills);
    next.best.time = Math.max(next.best.time, Math.floor(w.time));
    next.best.weapons = Math.max(next.best.weapons, w.weaponCount);
    if (w.state === "won" && !next.stages.includes(w.stageId))
      next.stages.push(w.stageId);
    if (JSON.stringify(next) !== JSON.stringify(this.data)) {
      next.revision++;
      this.data = next;
      this.pending = true;
      this.flush();
    }
    return [];
  }
  flush() {
    if (!this.pending) return true;
    const raw = JSON.stringify(this.data);
    let successes = 0;
    for (const key of [PROGRESS_KEY, PROGRESS_KEY + "-backup"])
      try {
        this.storage.setItem(key, raw);
        successes++;
      } catch {}
    this.pending = successes === 0;
    return !this.pending;
  }
}
