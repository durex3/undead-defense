import type { Skill } from "./SurvivalConfig";
/** Frozen version1 recipes for the seventeenth-stage challenge. */
export const TRACE_RECIPES: Record<Skill, readonly string[]> = {
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
export function traceKey(
  skill: Skill,
  mods: readonly string[],
  direction: "left" | "right",
) {
  const pair = Array.from(mods).sort().join("+");
  return mods.length === 2 && TRACE_RECIPES[skill]?.includes(pair)
    ? pair + "|" + direction
    : undefined;
}
export function validTraceKey(skill: Skill, key: unknown): key is string {
  if (typeof key !== "string") return false;
  const [pair, dir, ...rest] = key.split("|");
  return (
    !rest.length &&
    (dir === "left" || dir === "right") &&
    traceKey(skill, pair.split("+"), dir) === key
  );
}
