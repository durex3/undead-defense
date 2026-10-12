import type { Effect } from "../battle/SurvivalTypes";

export const FEEDBACK_SOUNDS = ["evolution", "combo_fire", "combo_ice", "combo_water", "meteor"] as const;
export interface FeedbackCue {
  sound: typeof FEEDBACK_SOUNDS[number];
  volume: number;
  shake: number;
  cooldown: number;
  priority: number;
  hold: number;
}
export function feedbackCue(e: Effect): FeedbackCue | null {
  if (e.type === "evolve" && e.final)
    return { sound: "evolution", volume: 0.32, shake: 8, cooldown: 0.35, priority: 3, hold: 0.7 };
  if (e.type === "comboFire")
    return { sound: "combo_fire", volume: 0.18, shake: 1.5, cooldown: 0.3, priority: 2, hold: 0.1 };
  if (e.type === "comboIce")
    return { sound: "combo_ice", volume: 0.16, shake: 0, cooldown: 0.25, priority: 2, hold: 0.1 };
  if (e.type === "comboPurify")
    return { sound: "combo_water", volume: 0.14, shake: 0, cooldown: 0.6, priority: 2, hold: 0.1 };
  if (e.type === "comboGhost")
    return { sound: "combo_ice", volume: 0.14, shake: 0, cooldown: 0.4, priority: 2, hold: 0.1 };
  if (e.type === "comboReap")
    return { sound: "combo_fire", volume: 0.14, shake: 0.5, cooldown: 0.4, priority: 2, hold: 0.1 };
  if (e.type === "comboCollapse")
    return { sound: "meteor", volume: 0.14, shake: 1, cooldown: 0.5, priority: 2, hold: 0.1 };
  if (e.type === "comboBone")
    return { sound: "meteor", volume: 0.14, shake: 1, cooldown: 0.4, priority: 2, hold: 0.1 };
  if (e.type === "comboJudgment")
    return { sound: "combo_ice", volume: 0.14, shake: 0, cooldown: 0.3, priority: 2, hold: 0.1 };
  if (e.type === "comboSoul")
    return { sound: "combo_water", volume: 0.12, shake: 0, cooldown: 0.5, priority: 2, hold: 0.1 };
  if (e.type === "fireImpact" && e.form === "meteor")
    return { sound: "meteor", volume: 0.2, shake: 3, cooldown: 0.4, priority: 2, hold: 0.1 };
  return null;
}

/** A presentation-clock gate: sound throttling never changes combat time or damage. */
export class CombatFeedback {
  private until = new Map<string, number>();
  private voiceUntil = 0;
  private priority = 0;
  reset() { this.until.clear(); this.voiceUntil = 0; this.priority = 0; }
  routineAllowed(now: number) { return now >= this.voiceUntil; }
  claim(e: Effect, now: number): FeedbackCue | null {
    const cue = feedbackCue(e);
    if (!cue || (this.until.get(cue.sound) ?? -Infinity) > now ||
        (this.voiceUntil > now && this.priority > cue.priority)) return null;
    this.until.set(cue.sound, now + cue.cooldown);
    this.voiceUntil = Math.max(this.voiceUntil, now + cue.hold);
    this.priority = cue.priority;
    return cue;
  }
}
