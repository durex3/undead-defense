import { gradeOf, initialGrades, nextGrade, GRADE_PRICE, validGrade, WeaponGrade } from "../battle/WeaponGrade";
import { LAMP_PRICE } from "../battle/SupportConfig";
import { MODS } from "../battle/ArmoryConfig";
import { ALL_WEAPONS, WEAPONS, Skill } from "../battle/SurvivalConfig";
import { ACHIEVEMENTS, STAGE_CLEAR_IDS, CLEAR_COINS, HAMMER_PRICE } from "../battle/UnlockConfig";
import type { StoragePort } from "./StoragePort";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import { MAX_WEAPON_SLOTS } from "../battle/EncounterPacing";
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
  grades?: Partial<Record<Skill, WeaponGrade>>;
  openerWins?: {skill: Skill; stage: number}[];
  modWins?: Partial<Record<Skill, Record<string, number[]>>>;
  sealOpeners?: Skill[];
  coins?: number;
  purchasedWeapons?: string[];
  achievements?: string[];
  settledRuns?: string[];
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
  coins: 0,
  purchasedWeapons: [],
  achievements: [],
  settledRuns: [],
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
    if (candidates.length) this.data = candidates.sort((a, b) => b.revision - a.revision)[0];
    const before = JSON.stringify(this.data.achievements ?? []);
    const achievements = new Set(this.data.achievements ?? []);
    for(const stage of this.data.stages) achievements.add(STAGE_CLEAR_IDS[stage]);
    if(JSON.stringify([...achievements]) !== before) {
      this.data.achievements = [...achievements]; this.data.revision++; this.pending=true; this.flush();
    }
  }
  private valid(d: any): d is ProgressData {
    return (
      (d?.coins === undefined ||
        (Number.isSafeInteger(d.coins) && d.coins >= 0)) &&
      (d?.purchasedWeapons === undefined ||
        (Array.isArray(d.purchasedWeapons) &&
          d.purchasedWeapons.every((v: unknown) => v === "hammer" || v === "lamp") &&
          new Set(d.purchasedWeapons).size === d.purchasedWeapons.length)) &&
      (d?.achievements === undefined ||
        (Array.isArray(d.achievements) &&
          d.achievements.every(
            (v: unknown) => ACHIEVEMENTS.some(a => a.id === v),
          ) &&
          new Set(d.achievements).size === d.achievements.length)) &&
      (d?.settledRuns === undefined ||
        (Array.isArray(d.settledRuns) &&
          d.settledRuns.every(
            (v: unknown) => typeof v === "string" && v.length < 120,
          ) &&
          new Set(d.settledRuns).size === d.settledRuns.length)) &&
      (d?.grades === undefined || (d.grades && typeof d.grades === "object" && !Array.isArray(d.grades) && Object.entries(d.grades).every(([skill,g]) => (ALL_WEAPONS as readonly string[]).includes(skill) && validGrade(skill as Skill,g)))) &&
      (d?.openerWins === undefined || (Array.isArray(d.openerWins) && d.openerWins.every((v:any)=>(ALL_WEAPONS as readonly string[]).includes(v?.skill) && (STAGE_IDS as readonly number[]).includes(v?.stage)))) &&
      (d?.sealOpeners === undefined || (Array.isArray(d.sealOpeners) && d.sealOpeners.every((v:any)=>(ALL_WEAPONS as readonly string[]).includes(v)) && new Set(d.sealOpeners).size===d.sealOpeners.length)) &&
      (d?.modWins === undefined || (d.modWins && typeof d.modWins === "object" && !Array.isArray(d.modWins) && Object.entries(d.modWins).every(([skill,combinations]:[string,any])=>(ALL_WEAPONS as readonly string[]).includes(skill) && combinations && typeof combinations === "object" && !Array.isArray(combinations) && Object.entries(combinations).every(([pair,stages]:[string,any])=>this.legalPair(skill as Skill,pair.split("+")) && Array.isArray(stages) && stages.every((id:any)=>(STAGE_IDS as readonly number[]).includes(id)))))) &&
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
  get coins() {
    return this.data.coins ?? 0;
  }
  hasAchievement(id: string) {
    return (this.data.achievements ?? []).includes(id);
  }
  unlockedWeapon(skill: Skill) {
    return (
      (WEAPONS as readonly string[]).includes(skill) ||
      (skill === "hammer" &&
        (this.data.purchasedWeapons ?? []).includes("hammer")) ||
      (skill === "wheel" && this.hasAchievement("forge_mastery")) ||
      (skill === "lamp" && (this.data.purchasedWeapons ?? []).includes("lamp")) ||
      (skill === "needle" && this.hasAchievement("seal_pathfinder"))
    );
  }
  get availableWeapons(): Skill[] {
    return ALL_WEAPONS.filter(s => this.unlockedWeapon(s));
  }
  get weaponGrades() {
    const grades=initialGrades();
    for(const s of ALL_WEAPONS) grades[s]=gradeOf(s,this.data.grades);
    return grades;
  }
  private legalPair(s: Skill, pair: readonly string[]) {
    return pair.length===2 && new Set(pair).size===2 && pair.every(id => MODS[s].some(m=>m.id===id && !pair.includes(m.excludes ?? "__none__")));
  }
  private commit(next: ProgressData) {
    next.revision++;
    const raw=JSON.stringify(next); let success=0;
    for(const key of [PROGRESS_KEY,PROGRESS_KEY+"-backup"]) try {this.storage.setItem(key,raw);success++;} catch {}
    if(!success) return false;
    this.data=next; return true;
  }
  buyHammer() { return this.buyWeapon("hammer"); }
  buyWeapon(skill: Skill) {
    const price=skill==="hammer"?HAMMER_PRICE:skill==="lamp"?LAMP_PRICE:0;
    if(!price) return "unavailable";
    if(this.unlockedWeapon(skill)) return "already";
    if(this.pending && !this.flush()) return "save-failed";
    if(this.coins<price) return "insufficient";
    const next:ProgressData=JSON.parse(JSON.stringify(this.data));
    next.coins=this.coins-price; next.purchasedWeapons=[...(next.purchasedWeapons??[]),skill];
    return this.commit(next)?"purchased":"save-failed";
  }
  evolveWeapon(skill: Skill, expectedGrade: WeaponGrade) {
    if(!this.unlockedWeapon(skill)) return "locked";
    if(gradeOf(skill,this.data.grades)!==expectedGrade) return "already";
    const target=nextGrade(skill,this.data.grades);
    if(!target) return "unavailable";
    if(this.pending && !this.flush()) return "save-failed";
    if(this.coins<GRADE_PRICE[target]) return "insufficient";
    const next:ProgressData=JSON.parse(JSON.stringify(this.data));
    next.coins=this.coins-GRADE_PRICE[target]; next.grades={...next.grades,[skill]:target};
    return this.commit(next)?"evolved":"save-failed";
  }
  achievementProgress(id: string) {
    if(this.hasAchievement(id)) return "已完成";
    if(id==="seal_pathfinder") return `合格起手 ${this.data.sealOpeners?.length??0}/6 · 从本版开始统计`;
    if(id==="five_openers") return `起手 ${new Set(this.data.openerWins?.map(v=>v.skill)).size}/5 · 关卡 ${new Set(this.data.openerWins?.map(v=>v.stage)).size}/3`;
    return "以胜利结算验证；新挑战从本版开始统计";
  }
  get weaponSlots() {
    return MAX_WEAPON_SLOTS;
  }
  unlockedCharacter(id: CharacterId) {
    const stage = CHARACTERS[id].stage;
    return !stage || this.data.stages.includes(stage);
  }
  unlockedStage(stage: StageId) {
    if (stage === 1) return true;
    return this.data.stages.includes((stage - 1) as StageId);
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
    if (
      !(STAGE_IDS as readonly number[]).includes(w.stageId) ||
      (w.state !== "won" && w.state !== "lost")
    )
      return [];
    const next: ProgressData = JSON.parse(JSON.stringify(this.data)),
      boss = w.enemies.find((e) => e.kind === "boss");
    const notices: string[] = [];
    if (w.state === "won" && !(next.settledRuns ?? []).includes(w.runId)) {
      next.coins = (next.coins ?? 0) + CLEAR_COINS[w.stageId];
      next.settledRuns = [...(next.settledRuns ?? []), w.runId];
      notices.push(`通关金币 +${CLEAR_COINS[w.stageId]}`);
      const achievements = new Set(next.achievements ?? []);
      const mastered=ALL_WEAPONS.filter(s=>w.skills[s]===8 && this.legalPair(s,w.mods[s]));
      if(w.stageId===3 && mastered.length) achievements.add("forge_mastery");
      if(w.stageId===3 && w.challenge.devices.size>=4) achievements.add("device_tactician");
      achievements.add(STAGE_CLEAR_IDS[w.stageId]);
      if(w.stageId>=7 && mastered.length>=3) achievements.add("triple_mastery");
      if(w.startingWeapon) {
        const opener=w.startingWeapon;
        next.openerWins ??= [];
        if(!next.openerWins.some(v=>v.skill===opener && v.stage===w.stageId)) next.openerWins.push({skill:opener,stage:w.stageId});
        if(new Set(next.openerWins.map(v=>v.skill)).size>=5 && new Set(next.openerWins.map(v=>v.stage)).size>=3) achievements.add("five_openers");
        if(w.stageId===10 && [1,2,3].every(phase=>w.challenge.bossSealPhases.has(phase)) && w.challenge.bossHits===0) {
          next.sealOpeners=[...new Set([...(next.sealOpeners??[]),opener])];
          if(next.sealOpeners.length>=6) achievements.add("seal_pathfinder");
        }
      }
      next.modWins ??= {};
      for(const skill of ALL_WEAPONS) if(w.skills[skill]>0 && this.legalPair(skill,w.mods[skill])) {
        const key=[...w.mods[skill]].sort().join("+");
        const history=next.modWins[skill] ??= {};
        history[key]=[...new Set([...(history[key]??[]),w.stageId])];
      }
      for(const history of Object.values(next.modWins)) if(history && Object.keys(history).length>=3 && new Set(Object.values(history).flat()).size>=2) achievements.add("modification_paths");
      for(const id of achievements) if(!(next.achievements??[]).includes(id)) notices.push(ACHIEVEMENTS.find(a=>a.id===id)!.name);
      next.achievements = Array.from(achievements);
    }
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
    return notices;
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
