import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy } from "./SurvivalTypes";
import { stageReference } from "./StageGrowth";
import type { GateOrder } from "./TwingateChallenge";
/** Stable group ownership survives either corpse leaving the enemy list. */
export class TwingateEncounter {
  readonly members: Enemy[] = [];
  readonly total = stageReference(19).bossDps * stageReference(19).bossSeconds;
  soloAt = 0;
  private firstFrame = -1;
  private firstId = 0;
  private milestones = 0;
  order: GateOrder | "simultaneous" | undefined;
  constructor(private w: SurvivalWorld) {}
  initialize(e: Enemy) {
    if (e.kind !== "boss") return;
    if (this.members.length >= 2) {
      e.hp = 0;
      return;
    }
    e.hp = e.maxHp = this.total * 0.5;
    e.twin = {
      role: this.members.length ? "warden" : "hunter",
      action: "A",
      vulnerable: false,
    };
    this.members.push(e);
  }
  get alive() {
    return this.members.filter((e) => e.hp > 0);
  }
  get solo() {
    return !!this.firstId;
  }
  summary() {
    if (this.members.length !== 2) return undefined;
    const hp = this.members.reduce((n, e) => n + Math.max(0, e.hp), 0);
    return {
      hp,
      maxHp: this.total,
      remaining: hp / this.total,
      form: this.solo ? 2 : 1,
      livesRemaining: hp > 0 ? 1 : 0,
      bodiesRemaining: this.alive.length,
      killOrder: this.order,
      hunterHp: Math.max(0, this.members[0].hp),
      wardenHp: Math.max(0, this.members[1].hp),
    };
  }
  supplies(e: Enemy) {
    while (
      this.milestones < 3 &&
      (this.summary()?.hp ?? this.total) <=
        this.total * (0.75 - this.milestones * 0.25) + 1e-8
    ) {
      this.w.dropBossPotion(e);
      this.milestones++;
    }
  }
  death(e: Enemy) {
    if (!this.firstId) {
      this.firstId = e.id;
      this.firstFrame = this.w.frame;
      this.order = e.twin!.role === "hunter" ? "hunter_first" : "warden_first";
      this.soloAt =
        Math.max(
          this.w.time,
          ...this.w.hazards.filter((h) => h.twin).map((h) => h.until),
        ) + 1.8;
      return true;
    }
    if (e.id === this.firstId) return true;
    if (this.w.frame === this.firstFrame) this.order = "simultaneous";
    return false;
  }
}
