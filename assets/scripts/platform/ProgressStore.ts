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
/** Stable account namespace: updates never delete previous saves. */
export const PROGRESS_KEY = "ashen-survivors-armory-progress-v1";
export const RECOVERY_KEY = PROGRESS_KEY + "-recovery";
export const MANUAL_SAVE_LIMIT = 3;
export interface ManualSave { slot: number; token: string; state: "empty" | "saved" | "invalid" | "unreadable"; savedAt?: number; data?: ProgressData; }
const SAVE_KEYS = [PROGRESS_KEY, PROGRESS_KEY + "-backup", "ashen-survivors-progress-v1", "ashen-survivors-progress-v1-backup", "undead-defense-v1", "undead-defense-v1-backup"];
interface PreservedSave { key: string; raw: string; }
export interface RecoveryRecord { id: string; source: string; data: ProgressData; repaired: boolean; }
function repairChecksum(body: string) {
  let hash=2166136261;for(let i=0;i<body.length;i++)hash=Math.imul(hash^body.charCodeAt(i),16777619);
  return (hash>>>0).toString(36);
}
/** Local account correction, with a checksum against copy errors; not cloud authentication. */
export function createRepairCode(cleared: number, coins: number, nonce: string) {
  const body=`ASR1-${cleared}-${coins}-${nonce}`;return body+"-"+repairChecksum(body);
}
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
  loomQualifiedOpeners?: Skill[];
  kilnQualified?:Partial<Record<Skill,string[]>>;
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
  loadNotice = "";
  readBlocked = false;
  constructor(private storage: StoragePort) {
    const candidates: RecoveryRecord[] = [];
    let readFailed=false, activeUnknown=false;
    for(const key of SAVE_KEYS) try {
      const raw=this.storage.getItem(key);
      if(!raw)continue;
      const record=this.decode(raw);
      if(record) candidates.push({id:this.recordId(key,this.rawString(raw)),source:key===PROGRESS_KEY?"主存档":key===PROGRESS_KEY+"-backup"?"备用存档":"旧位置",...record});
      else if(key===PROGRESS_KEY || key===PROGRESS_KEY+"-backup") activeUnknown=true;
    } catch {readFailed=true;}
    const current=candidates.filter(v=>v.source!=="旧位置");
    const pool=current.length?current:candidates;
    if(pool.length) {
      const chosen=pool.sort((a,b)=>b.data.revision-a.data.revision)[0];
      this.data=chosen.data;
      if(chosen.repaired)this.loadNotice="已兼容读取旧存档，通关与金币已保留";
      else if(chosen.source!=="主存档")this.loadNotice="已从"+chosen.source+"读取账户进度";
    } else {
      this.readBlocked=readFailed || activeUnknown;
      if(this.readBlocked)this.loadNotice="存档读取异常，已暂停覆盖；请打开存档检查";
    }
    const before = JSON.stringify(this.data.achievements ?? []);
    const achievements = new Set(this.data.achievements ?? []);
    for(const stage of this.data.stages) achievements.add(STAGE_CLEAR_IDS[stage]);
    if(JSON.stringify(Array.from(achievements)) !== before) {
      this.data.achievements = Array.from(achievements); this.data.revision++; this.pending=true; this.flush();
    }
  }
  private rawString(raw: unknown) {return typeof raw === "string" ? raw : JSON.stringify(raw);}
  private recordId(key: string, raw: string) {
    let hash=2166136261;for(const ch of key+raw)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
    return (hash>>>0).toString(36);
  }
  private decode(raw: unknown): {data: ProgressData; repaired: boolean} | null {
    try {
      let v:any=raw;
      for(let i=0;i<2 && typeof v==="string";i++)v=JSON.parse(v);
      if(this.valid(v)) {
        const data=JSON.parse(JSON.stringify(v)) as ProgressData;
        const stages=new Set(data.stages);
        for(const [id,best]of Object.entries(data.stageBest))if(best.won)stages.add(Number(id));
        for(const id of data.achievements??[]){const stage=(STAGE_CLEAR_IDS as readonly string[]).indexOf(id);if(stage>0)stages.add(stage);}
        const repaired=stages.size!==data.stages.length;data.stages=Array.from(stages);
        return {data,repaired};
      }
      if(v?.version!==1 || v?.rules!=="armory-v1")return null;
      // Isolate optional/corrupt fields instead of discarding the account.
      if(v.coins!==undefined && !(Number.isSafeInteger(v.coins)&&v.coins>=0))return null;
      const d=fresh(), stage=(id:any)=>(STAGE_IDS as readonly number[]).includes(id);
      d.revision=Number.isSafeInteger(v.revision)&&v.revision>=0?v.revision:0;
      d.coins=Number.isSafeInteger(v.coins)&&v.coins>=0?v.coins:0;
      d.stages=Array.isArray(v.stages)?Array.from(new Set<number>(v.stages.filter(stage))):[];
      for(const k of ["kills","time","weapons"] as const) if(Number.isFinite(v.best?.[k])&&v.best[k]>=0)d.best[k]=v.best[k];
      if(v.stageBest && typeof v.stageBest==="object" && !Array.isArray(v.stageBest)) for(const [key,b] of Object.entries(v.stageBest) as [string,any][]) {
        if(!stage(Number(key)) || !Number.isFinite(b?.time)||b.time<0||!Number.isInteger(b.phase)||b.phase<0||b.phase>3||typeof b.won!=="boolean" || !(b.bossRemaining===null || Number.isFinite(b.bossRemaining)&&b.bossRemaining>=0&&b.bossRemaining<=100))continue;
        d.stageBest[key]=b;if(b.won && !d.stages.includes(Number(key)))d.stages.push(Number(key));
      }
      d.purchasedWeapons=Array.isArray(v.purchasedWeapons)?Array.from(new Set<string>(v.purchasedWeapons.filter((x:any)=>x==="hammer"||x==="lamp"))):[];
      d.achievements=Array.isArray(v.achievements)?Array.from(new Set<string>(v.achievements.filter((x:any)=>ACHIEVEMENTS.some(a=>a.id===x)))):[];
      d.settledRuns=Array.isArray(v.settledRuns)?Array.from(new Set<string>(v.settledRuns.filter((x:any)=>typeof x==="string"&&x.length<120))):[];
      d.grades={};if(v.grades && typeof v.grades==="object")for(const skill of ALL_WEAPONS)if(validGrade(skill,v.grades[skill]))d.grades[skill]=v.grades[skill];
      if(Array.isArray(v.openerWins))d.openerWins=v.openerWins.filter((x:any)=>ALL_WEAPONS.includes(x?.skill)&&stage(x.stage));
      if(v.kilnQualified && typeof v.kilnQualified==='object'&&!Array.isArray(v.kilnQualified)){
        d.kilnQualified={};for(const skill of ALL_WEAPONS){const pairs=v.kilnQualified[skill];if(Array.isArray(pairs))d.kilnQualified[skill]=Array.from(new Set<string>(pairs.filter((x:any)=>typeof x==='string'&&this.legalPair(skill,x.split('+'))).map((x:string)=>x.split('+').sort().join('+'))));}
      }
      if(Array.isArray(v.loomQualifiedOpeners))d.loomQualifiedOpeners=Array.from(new Set<Skill>(v.loomQualifiedOpeners.filter((x:any)=>ALL_WEAPONS.includes(x))));
      if(Array.isArray(v.sealOpeners))d.sealOpeners=Array.from(new Set<Skill>(v.sealOpeners.filter((x:any)=>ALL_WEAPONS.includes(x))));
      if(v.modWins && typeof v.modWins==="object") {
        d.modWins={};for(const skill of ALL_WEAPONS){const history=v.modWins[skill];if(!history||typeof history!=="object"||Array.isArray(history))continue;
          const result:Record<string,number[]>={};for(const [pair,stages]of Object.entries(history))if(this.legalPair(skill,pair.split("+"))&&Array.isArray(stages)) result[pair.split("+").sort().join("+")]=Array.from(new Set<number>(stages.filter(stage)));
          if(Object.keys(result).length)d.modWins[skill]=result;
        }
      }
      return this.valid(d)?{data:d,repaired:true}:null;
    }catch{return null;}
  }
  private archives(): PreservedSave[] {
    const raw=this.storage.getItem(RECOVERY_KEY);if(!raw)return [];
    const v=JSON.parse(this.rawString(raw));
    if(!Array.isArray(v))throw Error("Recovery archive unreadable");
    return v.filter(x=>x && typeof x.key==="string" && typeof x.raw==="string");
  }
  private preserveStored() {
    try {
      const old=this.archives(), next=[...old];
      for(const key of SAVE_KEYS){const raw=this.storage.getItem(key);if(!raw)continue;const value=this.rawString(raw);if(!next.some(x=>x.key===key&&x.raw===value))next.push({key,raw:value});}
      if(next.length===old.length)return true;
      // Preserve the original pair plus ten recent raw snapshots.
      const bounded=next.length>12?[...next.slice(0,2),...next.slice(-10)]:next;
      this.storage.setItem(RECOVERY_KEY,JSON.stringify(bounded));return true;
    }catch{return false;}
  }
  get recoveryRecords(): RecoveryRecord[] {
    const entries:PreservedSave[]=[];
    for(const key of SAVE_KEYS)try{const raw=this.storage.getItem(key);if(raw)entries.push({key,raw:this.rawString(raw)});}catch{}
    try {entries.push(...this.archives());}catch{}
    const records:RecoveryRecord[]=[], seen=new Set<string>();
    for(const entry of entries){const value=this.decode(entry.raw);if(!value)continue;const id=this.recordId(entry.key,entry.raw);if(seen.has(id))continue;seen.add(id);records.push({id,source:entry.key===PROGRESS_KEY?"主存档副本":entry.key===PROGRESS_KEY+"-backup"?"备用存档副本":"旧位置副本",...value});}
    return records.sort((a,b)=>b.data.stages.length-a.data.stages.length || b.data.revision-a.data.revision);
  }
  restoreRecord(id: string, expectedRevision: number) {
    if(this.data.revision!==expectedRevision)return "stale";
    const record=this.recoveryRecords.find(v=>v.id===id);if(!record)return "missing";
    const next=JSON.parse(JSON.stringify(record.data)) as ProgressData;
    next.revision=Math.max(this.data.revision,next.revision);
    if(!this.commit(next,true))return "save-failed";
    this.pending=false;this.readBlocked=false;this.loadNotice="已恢复所选账户快照";return "restored";
  }
  /** Manual slots are independent of automatic saves and bounded recovery history. */
  private manualKey(slot: number) { return PROGRESS_KEY + "-manual-" + slot; }
  get manualSaves(): ManualSave[] {
    return [1,2,3].map<ManualSave>(slot => {
      const key=this.manualKey(slot);
      try {
        const raw=this.storage.getItem(key), token=this.recordId(key,raw ? this.rawString(raw) : "");
        if(!raw)return {slot,token,state:"empty"};
        let v:any;
        try {v=JSON.parse(this.rawString(raw));} catch {return {slot,token,state:"invalid"};}
        if(v?.version===1 && v.deleted===true)return {slot,token,state:"empty"};
        const record=v?.version===1 && Number.isSafeInteger(v.savedAt) ? this.decode(v.data) : null;
        return record ? {slot,token,state:"saved",savedAt:v.savedAt,data:record.data} : {slot,token,state:"invalid"};
      } catch {return {slot,token:"",state:"unreadable"};}
    });
  }
  saveManual(slot: number, token: string, revision: number) {
    const entry=this.manualSaves.find(v=>v.slot===slot);
    if(!entry)return "missing";
    if(entry.state==="unreadable" || this.readBlocked)return "save-failed";
    if(entry.token!==token || this.data.revision!==revision)return "stale";
    try {
      this.storage.setItem(this.manualKey(slot),JSON.stringify({version:1,savedAt:Date.now(),data:this.data}));
      return "saved";
    } catch {return "save-failed";}
  }
  loadManual(slot: number, token: string, revision: number) {
    const entry=this.manualSaves.find(v=>v.slot===slot);
    if(!entry?.data)return "missing";
    if(entry.token!==token || this.data.revision!==revision)return "stale";
    const next=JSON.parse(JSON.stringify(entry.data)) as ProgressData;
    next.revision=Math.max(next.revision,this.data.revision);
    if(!this.commit(next,true))return "save-failed";
    this.pending=false;this.readBlocked=false;this.loadNotice="已读取手动存档";return "loaded";
  }
  deleteManual(slot: number, token: string) {
    const entry=this.manualSaves.find(v=>v.slot===slot);
    if(!entry || entry.state==="empty")return "missing";
    if(entry.state==="unreadable")return "save-failed";
    if(entry.token!==token)return "stale";
    try {
      // A single-key tombstone cannot be resurrected from automatic backups.
      this.storage.setItem(this.manualKey(slot),JSON.stringify({version:1,deleted:true}));
      return "deleted";
    } catch {return "save-failed";}
  }
  previewRepairCode(text: string): {data: ProgressData; id: string} | null {
    const code=text.trim();if(code.length>160)return null;
    const match=/^(ASR1-(\d{1,2})-(\d{1,8})-(\d{8,16}))-([a-z0-9]+)$/.exec(code);
    if(!match || repairChecksum(match[1])!==match[5])return null;
    const cleared=Number(match[2]),coins=Number(match[3]);
    if(cleared<0 || cleared>Math.max(...STAGE_IDS) || !Number.isSafeInteger(coins) || coins>10000000)return null;
    const data=fresh();data.stages=STAGE_IDS.filter(id=>id<=cleared);data.coins=coins;
    data.achievements=data.stages.map(id=>STAGE_CLEAR_IDS[id]);
    return {data,id:"repair:"+code};
  }
  applyRepairCode(code: string, expectedRevision: number) {
    const preview=this.previewRepairCode(code);if(!preview)return "invalid";
    if((this.data.settledRuns??[]).includes(preview.id))return "already";
    if(this.data.revision!==expectedRevision)return "stale";
    const next=preview.data;next.revision=this.data.revision;
    next.settledRuns=Array.from(new Set([...(this.data.settledRuns??[]),preview.id]));
    if(!this.commit(next,true))return "save-failed";
    this.pending=false;this.readBlocked=false;this.loadNotice="已补回通关与金币；请重新进入确认保存";return "restored";
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
      (d?.kilnQualified===undefined||(d.kilnQualified&&typeof d.kilnQualified==='object'&&!Array.isArray(d.kilnQualified)&&Object.entries(d.kilnQualified).every(([skill,pairs]:[string,any])=>(ALL_WEAPONS as readonly string[]).includes(skill)&&Array.isArray(pairs)&&new Set(pairs).size===pairs.length&&pairs.every((pair:any)=>typeof pair==='string'&&this.legalPair(skill as Skill,pair.split('+'))&&pair===pair.split('+').sort().join('+'))))) &&
      (d?.loomQualifiedOpeners === undefined || (Array.isArray(d.loomQualifiedOpeners) && d.loomQualifiedOpeners.every((v:any)=>(ALL_WEAPONS as readonly string[]).includes(v)) && new Set(d.loomQualifiedOpeners).size===d.loomQualifiedOpeners.length)) &&
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
  private commit(next: ProgressData, restoring=false) {
    if((this.readBlocked && !restoring) || !this.preserveStored())return false;
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
    if(id==="kiln_ten_paths")return `双路线起手 ${Object.values(this.data.kilnQualified??{}).filter(v=>v&&v.length>=2).length}/10 · 三阶段断源且Boss无伤`;
    if(id==="loom_eight_paths") return `合格起手 ${this.data.loomQualifiedOpeners?.length??0}/8 · 三阶段双线且Boss无伤`;
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
      if(w.stageId>=7 && w.stageId<=10 && mastered.length>=3) achievements.add("triple_mastery");
      if(w.startingWeapon) {
        const opener=w.startingWeapon;
        next.openerWins ??= [];
        if(!next.openerWins.some(v=>v.skill===opener && v.stage===w.stageId)) next.openerWins.push({skill:opener,stage:w.stageId});
        if(new Set(next.openerWins.map(v=>v.skill)).size>=5 && new Set(next.openerWins.map(v=>v.stage)).size>=3) achievements.add("five_openers");
        if(w.stageId===12&&w.skills[opener]===8&&this.legalPair(opener,w.mods[opener])&&[1,2,3].every(phase=>w.challenge.kilnPhases.has(phase))&&w.challenge.bossHits===0){
          next.kilnQualified??={};const key=[...w.mods[opener]].sort().join('+');
          next.kilnQualified[opener]=Array.from(new Set([...(next.kilnQualified[opener]??[]),key]));
          if(Object.values(next.kilnQualified).filter(v=>v&&v.length>=2).length>=10)achievements.add('kiln_ten_paths');
        }
        if(w.stageId===11 && [1,2,3].every(phase=>w.challenge.loomPhases.has(phase)) && w.challenge.bossHits===0) {
          next.loomQualifiedOpeners=Array.from(new Set([...(next.loomQualifiedOpeners??[]),opener]));
          if(next.loomQualifiedOpeners.length>=8)achievements.add("loom_eight_paths");
        }
        if(w.stageId===10 && [1,2,3].every(phase=>w.challenge.bossSealPhases.has(phase)) && w.challenge.bossHits===0) {
          next.sealOpeners=Array.from(new Set([...(next.sealOpeners??[]),opener]));
          if(next.sealOpeners.length>=6) achievements.add("seal_pathfinder");
        }
      }
      next.modWins ??= {};
      for(const skill of ALL_WEAPONS) if(w.skills[skill]>0 && this.legalPair(skill,w.mods[skill])) {
        const key=[...w.mods[skill]].sort().join("+");
        const history=next.modWins[skill] ??= {};
        history[key]=Array.from(new Set([...(history[key]??[]),w.stageId]));
      }
      for(const history of Object.values(next.modWins)) if(history && Object.keys(history).length>=3 && new Set(Object.values(history).flat()).size>=2) achievements.add("modification_paths");
      for(const id of Array.from(achievements)) if(!(next.achievements??[]).includes(id)) notices.push(ACHIEVEMENTS.find(a=>a.id===id)!.name);
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
    if (!this.pending) return !this.readBlocked;
    if(this.readBlocked || !this.preserveStored())return false;
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
