import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraBehavior, ExtraBehaviorPort } from "./ExtraBehavior";
import type { ExtraSkill } from "./ExtraArmoryConfig";
import { FrostBehavior } from "./FrostBehavior";
import { LightningBehavior } from "./LightningBehavior";
import { GhostBehavior } from "./GhostBehavior";
import { BoneBehavior } from "./BoneBehavior";
import { MineBehavior } from "./MineBehavior";
import { VoidBehavior } from "./VoidBehavior";
import { HolyBehavior } from "./HolyBehavior";
export function createExtraBehaviors(
  w: SurvivalWorld,
  port: ExtraBehaviorPort,
): Record<ExtraSkill,ExtraBehavior> & {frost:FrostBehavior} {
  return {
    frost: new FrostBehavior(w, port),
    lightning: new LightningBehavior(w, port),
    ghost: new GhostBehavior(w, port),
    bone: new BoneBehavior(w, port),
    mine: new MineBehavior(w, port),
    void: new VoidBehavior(w, port),
    holy: new HolyBehavior(w, port),
  } satisfies Record<ExtraSkill, ExtraBehavior>;
}
