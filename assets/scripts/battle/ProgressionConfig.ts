import { Skill } from "./SurvivalConfig";
export const CHARACTERS={
 ranger:{name:"飞刀游侠",stage:0,weapon:"blade" as Skill,description:"伤害 +10% · 移动速度 +10%"},
 alchemist:{name:"炼金术士",stage:1,weapon:"water" as Skill,description:"覆盖面积 +15% · 持续时间 +15%"},
 necromancer:{name:"亡灵使者",stage:2,weapon:"fire" as Skill,description:"冷却缩减 8% · 拾取半径 +20%"},
};
export type CharacterId=keyof typeof CHARACTERS;
export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const STAGE_IDS: readonly StageId[] = [1,2,3,4,5,6,7,8,9,10,11];
export function stageNumber(id: StageId) { return STAGE_IDS.indexOf(id)+1; }
