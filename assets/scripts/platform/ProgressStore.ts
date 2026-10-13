import type { StoragePort } from "./SaveStore";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import {
  ACHIEVEMENTS,
  CHARACTERS,
  CharacterId,
  StageId,
} from "../battle/ProgressionConfig";
import { WEAPONS } from "../battle/SurvivalConfig";
export const PROGRESS_KEY = "ashen-survivors-progress-v1";
export interface StageBest { time: number; phase: number; bossRemaining: number | null; won: boolean; }
export interface ProgressData {
  stageBest?: Record<string, StageBest>;
  version: 3;
  unlocked: CharacterId[];
  best: { kills: number; time: number; weapons: number };
  revision: number;
  achievements: string[];
  evolutions: string[];
  winners: CharacterId[];
  stages: number[];
}
export class ProgressStore {
  data: ProgressData = {
    version: 3,
    unlocked: ["ranger"],
    best: { kills: 0, time: 0, weapons: 0 },
    revision: 0,
    achievements: [],
    evolutions: [],
    winners: [],
    stages: [],
  };
  pending = false;
  constructor(private storage: StoragePort) {
    const candidates: ProgressData[] = [];
    for (const key of [PROGRESS_KEY, PROGRESS_KEY + "-backup"])
      try {
        const d = JSON.parse(storage.getItem(key) || "null");
        if (this.valid(d))
          candidates.push({
            ...d,
            version: 3,
            stageBest: this.readStageBest(d.stageBest),
            unlocked: d.version === 3 ? d.unlocked : (Object.keys(CHARACTERS) as CharacterId[]).filter(id => d.achievements.length >= ({ranger:0,alchemist:3,necromancer:6}[id])),
            best: d.version === 1 ? { kills: 0, time: 0, weapons: 0 } : d.best,
          });
      } catch {}
    if (candidates.length)
      this.data = candidates.sort((a, b) => b.revision - a.revision)[0];
  }
  private readStageBest(raw: any): Record<string, StageBest> {
    const result: Record<string, StageBest> = {};
    for (const id of [1,2,3,4,5,6,7,8,9,10]) {
      const b=raw?.[id];
      if(b && Number.isFinite(b.time) && b.time>=0 && Number.isInteger(b.phase) && b.phase>=0 && b.phase<=3 && typeof b.won==='boolean' && (b.bossRemaining===null || (Number.isFinite(b.bossRemaining)&&b.bossRemaining>=0&&b.bossRemaining<=100))) result[id]={time:b.time,phase:b.phase,bossRemaining:b.bossRemaining,won:b.won};
    }
    return result;
  }
  bestLine(stage: StageId) {
    const b=this.data.stageBest?.[stage];
    if(!b)return "本关尚无挑战记录";
    if(b.won)return "本关最佳：已通关";
    return b.phase>0 ? `本关最佳：首领第 ${b.phase} 阶段 · 剩余 ${b.bossRemaining}%` : `本关最佳：存活 ${Math.floor(b.time)} 秒`;
  }
  private valid(d: any): boolean {
    return (
      (d?.version === 1 ||
        ((d?.version === 2 || d?.version === 3) &&
          ["kills", "time", "weapons"].every(
            (k) => Number.isFinite(d.best?.[k]) && d.best[k] >= 0,
          ))) &&
      (d.version !== 3 || (Array.isArray(d.unlocked) && d.unlocked.every((id: string) => id in CHARACTERS) && new Set(d.unlocked).size === d.unlocked.length)) &&
      Number.isSafeInteger(d.revision) &&
      d.revision >= 0 &&
      [
        ["achievements", ACHIEVEMENTS.map((a) => a.id)],
        ["evolutions", WEAPONS],
        ["winners", Object.keys(CHARACTERS)],
        ["stages", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      ].every(
        ([key, values]) =>
          Array.isArray(d[key as string]) &&
          d[key as string].every((v: any) => (values as any[]).includes(v)) &&
          new Set(d[key as string]).size === d[key as string].length,
      )
    );
  }
  get weaponSlots(): number {
    const n = this.data.achievements.length;
    return n >= 14 && this.data.stages.includes(5) ? 6 : n >= 8 && this.data.stages.includes(3) ? 5 : 4;
  }
  unlockedCharacter(id: CharacterId) {
    const c = CHARACTERS[id];
    return this.data.unlocked.includes(id) || (this.data.achievements.length >= c.need && (!c.stage || this.data.stages.includes(c.stage)));
  }
  unlockedStage(stage: StageId) {
    return stage === 1 || this.data.stages.includes(stage - 1);
  }
  observe(w: SurvivalWorld) {
    const next: ProgressData = JSON.parse(JSON.stringify(this.data));
    for (const s of WEAPONS)
      if (w.evolutions[s] && !next.evolutions.includes(s))
        next.evolutions.push(s);
    if (w.state === "won" || w.state === "lost") {
      const boss=w.enemies.find(e=>e.kind==='boss');
      const current: StageBest={time:Math.floor(w.time),phase:boss?.bossPhase || 0,bossRemaining:boss?Math.ceil(Math.max(0,boss.hp)/boss.maxHp*100):null,won:w.state==='won'};
      const best=next.stageBest?.[w.stageId];
      if(!best || (!best.won && (current.won || current.phase>best.phase || (current.phase===best.phase && (current.phase>0 ? current.bossRemaining!<best.bossRemaining! : current.time>best.time))))) {
        next.stageBest ||= {}; next.stageBest[w.stageId]=current;
      }
      next.best.kills = Math.max(next.best.kills, w.kills);
      next.best.time = Math.max(next.best.time, Math.floor(w.time));
      next.best.weapons = Math.max(next.best.weapons, w.weaponCount);
    }
    if (w.state === "won") {
      if (!next.winners.includes(w.character)) next.winners.push(w.character);
      if (!next.stages.includes(w.stageId)) next.stages.push(w.stageId);
    }
    const checks = [
      w.level >= 2,
      w.weaponCount >= 2,
      w.weaponCount >= 4,
      next.evolutions.length > 0,
      w.eliteKills > 0,
      w.time >= 180,
      next.stages.length > 0,
      w.kills >= 300,
      next.evolutions.length >= 3,
      next.winners.length >= 2,
      next.stages.includes(3),
      next.stages.includes(2),
      w.state === "won" && w.stageId === 2 && !w.skills.bat,
      w.state === "won" && w.stageId === 3 && w.healing.potion + w.healing.repair + w.expansion.healed === 0,
      [1,2,3].every(id=>next.stages.includes(id)),
      next.stages.includes(4),
      w.state === "won" && w.stageId === 4 && !(w.losses["幽钟共振"] > 0),
      next.stages.includes(5),
      [1,2,3,4,5].every(id=>next.stages.includes(id)),
      w.state === "won" && w.stageId === 5 && !w.skills.bat,
    ];
    const earned: string[] = [];
    ACHIEVEMENTS.forEach((a, i) => {
      if (checks[i] && !next.achievements.includes(a.id)) {
        next.achievements.push(a.id);
        earned.push(a.id);
      }
    });
    for (const id of Object.keys(CHARACTERS) as CharacterId[]) {
      const c = CHARACTERS[id];
      if (!next.unlocked.includes(id) && next.achievements.length >= c.need && (!c.stage || next.stages.includes(c.stage))) next.unlocked.push(id);
    }
    if (JSON.stringify(next) !== JSON.stringify(this.data)) {
      next.revision++;
      this.data = next;
      this.pending = true;
      this.flush();
    }
    return earned;
  }
  progressLine(id: string, w?: SurvivalWorld) {
    if (this.data.achievements.includes(id)) return "已完成";
    const single = (
      current: number | undefined,
      best: number,
      goal: number,
      unit = "",
    ) =>
      w
        ? `本局 ${Math.min(goal, Math.floor(current || 0))}/${goal}${unit} · 最佳 ${Math.min(goal, best)}`
        : `单局最佳 ${Math.min(goal, best)}/${goal}${unit}`;
    if (id === "kills") return single(w?.kills, this.data.best.kills, 300);
    if (id === "survive")
      return single(w?.time, this.data.best.time, 180, " 秒");
    if (id === "four")
      return single(w?.weaponCount, this.data.best.weapons, 4, " 把");
    if (id === "three")
      return `已进化 ${Math.min(3, this.data.evolutions.length)}/3 种`;
    if (id === "heroes")
      return `已通关 ${Math.min(2, this.data.winners.length)}/2 个角色`;
    return "未完成 · 0/1";
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
