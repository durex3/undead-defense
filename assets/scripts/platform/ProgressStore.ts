import { freshProgress } from "./ProgressCodec";
import { ProgressRepository } from "./ProgressRepository";
import { ManualSaveSlots } from "./ManualSaveSlots";
import { previewRepairCode } from "./ProgressRepair";
export { PROGRESS_KEY, RECOVERY_KEY } from "./ProgressRepository";
export type { RecoveryRecord } from "./ProgressRepository";
export { MANUAL_SAVE_LIMIT } from "./ManualSaveSlots";
export type { ManualSave } from "./ManualSaveSlots";
export { createRepairCode } from "./ProgressRepair";
import { achievementProgress } from "../battle/AchievementProgress";
import { settleVictory } from "../battle/AchievementRules";
import type { ProgressData, StageBest } from "./ProgressData";
export type { ProgressData, StageBest } from "./ProgressData";
import {
  gradeOf,
  initialGrades,
  nextGrade,
  GRADE_PRICE,
  WeaponGrade,
} from "../battle/WeaponGrade";
import { LAMP_PRICE } from "../battle/SupportConfig";
import { ALL_WEAPONS, WEAPONS, Skill } from "../battle/SurvivalConfig";
import { STAGE_CLEAR_IDS, HAMMER_PRICE } from "../battle/UnlockConfig";
import type { StoragePort } from "./StoragePort";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import { MAX_WEAPON_SLOTS } from "../battle/EncounterPacing";
import {
  CHARACTERS,
  CharacterId,
  StageId,
  STAGE_IDS,
} from "../battle/ProgressionConfig";
export class ProgressStore {
  data: ProgressData = freshProgress();
  private readonly repository: ProgressRepository;
  private readonly slots: ManualSaveSlots;
  pending = false;
  loadNotice = "";
  readBlocked = false;
  constructor(storage: StoragePort) {
    this.repository = new ProgressRepository(storage);
    this.slots = new ManualSaveSlots(storage);
    const loaded = this.repository.load();
    this.data = loaded.data;
    this.loadNotice = loaded.loadNotice;
    this.readBlocked = loaded.readBlocked;
    const before = JSON.stringify(this.data.achievements ?? []);
    const achievements = new Set(this.data.achievements ?? []);
    for (const stage of this.data.stages)
      achievements.add(STAGE_CLEAR_IDS[stage]);
    if (JSON.stringify(Array.from(achievements)) !== before) {
      this.data.achievements = Array.from(achievements);
      this.data.revision++;
      this.pending = true;
      this.flush();
    }
  }
  get recoveryRecords() {
    return this.repository.recoveryRecords;
  }
  restoreRecord(id: string, expectedRevision: number) {
    if (this.data.revision !== expectedRevision) return "stale";
    const record = this.recoveryRecords.find((v) => v.id === id);
    if (!record) return "missing";
    const next = JSON.parse(JSON.stringify(record.data)) as ProgressData;
    next.revision = Math.max(this.data.revision, next.revision);
    if (!this.commit(next, true)) return "save-failed";
    this.pending = false;
    this.readBlocked = false;
    this.loadNotice = "已恢复所选账户快照";
    return "restored";
  }
  /** Manual slots are independent of automatic saves and bounded recovery history. */
  get manualSaves() {
    return this.slots.manualSaves;
  }
  saveManual(slot: number, token: string, revision: number) {
    return this.slots.saveManual(
      slot,
      token,
      revision,
      this.data,
      this.readBlocked,
    );
  }
  loadManual(slot: number, token: string, revision: number) {
    const entry = this.manualSaves.find((v) => v.slot === slot);
    if (!entry?.data) return "missing";
    if (entry.token !== token || this.data.revision !== revision)
      return "stale";
    const next = JSON.parse(JSON.stringify(entry.data)) as ProgressData;
    next.revision = Math.max(next.revision, this.data.revision);
    if (!this.commit(next, true)) return "save-failed";
    this.pending = false;
    this.readBlocked = false;
    this.loadNotice = "已读取手动存档";
    return "loaded";
  }
  deleteManual(slot: number, token: string) {
    return this.slots.deleteManual(slot, token);
  }
  previewRepairCode(text: string) {
    return previewRepairCode(text);
  }
  applyRepairCode(code: string, expectedRevision: number) {
    const preview = this.previewRepairCode(code);
    if (!preview) return "invalid";
    if ((this.data.settledRuns ?? []).includes(preview.id)) return "already";
    if (this.data.revision !== expectedRevision) return "stale";
    const next = preview.data;
    next.revision = this.data.revision;
    next.settledRuns = Array.from(
      new Set([...(this.data.settledRuns ?? []), preview.id]),
    );
    if (!this.commit(next, true)) return "save-failed";
    this.pending = false;
    this.readBlocked = false;
    this.loadNotice = "已补回通关与金币；请重新进入确认保存";
    return "restored";
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
      (skill === "lamp" &&
        (this.data.purchasedWeapons ?? []).includes("lamp")) ||
      (skill === "needle" && this.hasAchievement("seal_pathfinder"))
    );
  }
  get availableWeapons(): Skill[] {
    return ALL_WEAPONS.filter((s) => this.unlockedWeapon(s));
  }
  get weaponGrades() {
    const grades = initialGrades();
    for (const s of ALL_WEAPONS) grades[s] = gradeOf(s, this.data.grades);
    return grades;
  }
  private commit(next: ProgressData, restoring = false) {
    if (this.readBlocked && !restoring) return false;
    if (!this.repository.writePreserved(next, true)) return false;
    this.data = next;
    return true;
  }
  buyHammer() {
    return this.buyWeapon("hammer");
  }
  buyWeapon(skill: Skill) {
    const price =
      skill === "hammer" ? HAMMER_PRICE : skill === "lamp" ? LAMP_PRICE : 0;
    if (!price) return "unavailable";
    if (this.unlockedWeapon(skill)) return "already";
    if (this.pending && !this.flush()) return "save-failed";
    if (this.coins < price) return "insufficient";
    const next: ProgressData = JSON.parse(JSON.stringify(this.data));
    next.coins = this.coins - price;
    next.purchasedWeapons = [...(next.purchasedWeapons ?? []), skill];
    return this.commit(next) ? "purchased" : "save-failed";
  }
  evolveWeapon(skill: Skill, expectedGrade: WeaponGrade) {
    if (!this.unlockedWeapon(skill)) return "locked";
    if (gradeOf(skill, this.data.grades) !== expectedGrade) return "already";
    const target = nextGrade(skill, this.data.grades);
    if (!target) return "unavailable";
    if (this.pending && !this.flush()) return "save-failed";
    if (this.coins < GRADE_PRICE[target]) return "insufficient";
    const next: ProgressData = JSON.parse(JSON.stringify(this.data));
    next.coins = this.coins - GRADE_PRICE[target];
    next.grades = { ...next.grades, [skill]: target };
    return this.commit(next) ? "evolved" : "save-failed";
  }
  achievementProgress(id: string) {
    return achievementProgress(this.data, id);
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
        : b.form
          ? `本关最佳：${b.form === 1 ? "负棺" : "裂棺"}形态 · 总剩余 ${b.bossRemaining}%`
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
      notices.push(...settleVictory(next, w));
    }
    const group=w.stageStrategy.encounter?.();
    const current: StageBest = {
        time: Math.floor(w.time),
        phase: boss?.bossPhase || 0,
        ...(w.stageStrategy.lifecycle?.progress?{form:boss?w.stageStrategy.lifecycle.progress(boss).form:w.state==="won"?(w.stageStrategy.lifecycle.forms??0):0,livesRemaining:w.state==="won"||!boss?0:w.stageStrategy.lifecycle.progress(boss).livesRemaining}:{}),
        bossRemaining:boss?Math.ceil((w.stageStrategy.lifecycle?.progress?.(boss).remaining??Math.max(0,boss.hp)/boss.maxHp)*100):null,
        ...(group?{form:group.form,livesRemaining:group.livesRemaining,bodiesRemaining:group.bodiesRemaining,killOrder:group.killOrder,bossRemaining:Math.ceil(group.remaining*100),phase:group.form}:{}),
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
    if (this.readBlocked) return false;
    this.pending = !this.repository.writePreserved(this.data);
    return !this.pending;
  }
}
