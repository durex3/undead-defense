import type { Skill } from "./SurvivalConfig";
/** Version1 recipe keys are frozen; later modifications never expand old requirements. */
export const GRAVE_RECIPES: Record<Skill, readonly string[]> = {
  blade: [
    "orbit+return",
    "orbit+shards",
    "hunt+return",
    "hunt+shards",
    "return+shards",
  ],
  fire: [
    "embers+heavy",
    "flame+heavy",
    "embers+salvo",
    "flame+salvo",
    "embers+flame",
  ],
  water: [
    "recall+spring",
    "pulse+spring",
    "recall+wave",
    "pulse+wave",
    "pulse+recall",
  ],
  frost: [
    "aftershock+outward",
    "brittle+outward",
    "aftershock+sectors",
    "brittle+sectors",
    "aftershock+brittle",
  ],
  lightning: [
    "echo+relay",
    "bridge+relay",
    "echo+storm",
    "bridge+storm",
    "bridge+echo",
  ],
  ghost: [
    "execution+haunt",
    "execution+reap",
    "haunt+swarm",
    "reap+swarm",
    "haunt+reap",
  ],
  bone: [
    "lance+marrow",
    "lance+ridge",
    "fan+marrow",
    "fan+ridge",
    "marrow+ridge",
  ],
  mine: [
    "scatter+trip",
    "fuse+trip",
    "burrow+scatter",
    "burrow+fuse",
    "fuse+scatter",
  ],
  void: [
    "binary+drift",
    "drift+repel",
    "binary+collapse",
    "collapse+repel",
    "binary+repel",
  ],
  holy: [
    "cross+execution",
    "brand+execution",
    "cross+rain",
    "brand+rain",
    "brand+cross",
  ],
  hammer: [
    "heavy+rift",
    "heavy+return",
    "rift+sweep",
    "return+sweep",
    "return+rift",
  ],
  wheel: [
    "grind+heavy",
    "curve+heavy",
    "grind+twin",
    "curve+twin",
    "curve+grind",
  ],
  lamp: [
    "focus+linger",
    "focus+pulse",
    "linger+wide",
    "pulse+wide",
    "linger+pulse",
  ],
  needle: ["deep+long", "barb+deep", "long+swift", "barb+swift", "barb+long"],
};
export function graveRecipe(skill: Skill, mods: readonly string[]) {
  return (
    mods.length === 2 &&
    GRAVE_RECIPES[skill]?.includes(Array.from(mods).sort().join("+"))
  );
}
