import type { Effect } from "../battle/SurvivalTypes";

export const FEEDBACK_SOUNDS = ["evolution", "meteor"] as const;
export interface FeedbackCue {
  sound: (typeof FEEDBACK_SOUNDS)[number];
  volume: number;
  shake: number;
  cooldown: number;
  priority: number;
  hold: number;
}
export function feedbackCue(e: Effect): FeedbackCue | null {
  if (e.type === "modify" && e.final)
    return {
      sound: "evolution",
      volume: 0.32,
      shake: 2,
      cooldown: 0.35,
      priority: 3,
      hold: 0.7,
    };
  if (e.type === "explosion" && e.skill === "fire" && e.form === "heavy")
    return {
      sound: "meteor",
      volume: 0.16,
      shake: 1,
      cooldown: 0.5,
      priority: 2,
      hold: 0.1,
    };
  return null;
}

/** A presentation-clock gate: sound throttling never changes combat time or damage. */
export class CombatFeedback {
  private until = new Map<string, number>();
  private voiceUntil = 0;
  private priority = 0;
  reset() {
    this.until.clear();
    this.voiceUntil = 0;
    this.priority = 0;
  }
  routineAllowed(now: number) {
    return now >= this.voiceUntil;
  }
  claim(e: Effect, now: number): FeedbackCue | null {
    const cue = feedbackCue(e);
    if (
      !cue ||
      (this.until.get(cue.sound) ?? -Infinity) > now ||
      (this.voiceUntil > now && this.priority > cue.priority)
    )
      return null;
    this.until.set(cue.sound, now + cue.cooldown);
    this.voiceUntil = Math.max(this.voiceUntil, now + cue.hold);
    this.priority = cue.priority;
    return cue;
  }
}
