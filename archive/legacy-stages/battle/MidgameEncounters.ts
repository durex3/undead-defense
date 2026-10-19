import type { Kind } from "./SurvivalConfig";
import { encounterBeat } from "./EncounterPacing";

export type MidgameEncounter = {
  name: string;
  enemies: Kind[];
  hint: string;
  spread: number;
  rearGuard: boolean;
};

// Real battle seconds. Short pressure beats alternate with collection windows;
// the furnace keeps its existing seeded encounter order and workshop layout.
export const MIDGAME_WINDOWS = [
  { start: 150, end: 164 },
  { start: 220, end: 250 },
  { start: 280, end: 310 },
  { start: 380, end: 410 },
];

const PACKS: Partial<Record<number, MidgameEncounter[]>> = {
  3: [
    { name: "盾阵压进", enemies: ["shield", "archer"], hint: "绕盾侧击，优先清弓手", spread: .3, rearGuard: true },
    { name: "烈阵追击", enemies: ["boar", "archer"], hint: "横移避冲锋，再切入后排", spread: Math.PI * .65, rearGuard: false },
    { name: "护阵唤潮", enemies: ["shield", "summoner"], hint: "绕开护盾，处理召唤师", spread: .3, rearGuard: true },
  ],
  4: [
    { name: "钟下夹击", enemies: ["banshee", "archer"], hint: "避开扇形，横移躲箭", spread: Math.PI * .65, rearGuard: false },
    { name: "鼓阵推进", enemies: ["drummer", "shield"], hint: "先清鼓手，绕盾反击", spread: .4, rearGuard: false },
    { name: "钟下唤潮", enemies: ["summoner", "archer"], hint: "清掉后排，留意钟环内圈", spread: Math.PI * .65, rearGuard: false },
  ],
  5: [
    { name: "王庭护卫", enemies: ["shield", "archer"], hint: "绕盾切后排，保持退路", spread: .3, rearGuard: true },
    { name: "王庭军鼓", enemies: ["drummer", "banshee"], hint: "先清军鼓，避开女妖扇形", spread: Math.PI * .6, rearGuard: false },
    { name: "王庭召令", enemies: ["shield", "summoner"], hint: "切入盾后，阻止增援", spread: .3, rearGuard: true },
  ],
  7: [
    { name: "裂隙交火", enemies: ["archer", "wisp"], hint: "横移躲箭，留意幽魂冲线", spread: Math.PI * 2 / 3, rearGuard: false },
    { name: "裂隙咒猎", enemies: ["mage", "wisp"], hint: "离开咒印，避开冲线", spread: Math.PI * 2 / 3, rearGuard: false },
    { name: "裂隙哀鸣", enemies: ["banshee", "archer"], hint: "绕开扇形，优先清弓手", spread: Math.PI * 2 / 3, rearGuard: false },
  ],
};

export function midgameEncounter(stage: number, time: number) {
  const packs = PACKS[stage];
  if (!packs || encounterBeat(time).rest) return null;
  const index = MIDGAME_WINDOWS.findIndex(w => time >= w.start && time < w.end);
  return index < 0 ? null : packs[index % packs.length];
}

export function midgameRest(stage: number, time: number) {
  return !!PACKS[stage] && MIDGAME_WINDOWS.some(w => time >= w.end && time < w.end + 10);
}

export function midgameForecast(stage: number, time: number) {
  if (midgameRest(stage, time)) return "暂歇 · 拾取经验和补给";
  const active = midgameEncounter(stage, time);
  return active ? `${active.name} · ${active.hint}` : null;
}
