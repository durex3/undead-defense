import type { Skill } from "./SurvivalConfig";
export function formTier(level: number, evolved = false): 0 | 1 | 2 | 3 {
  return level >= 10 ? 3 : evolved || level >= 7 ? 2 : level >= 4 ? 1 : 0;
}
export const WEAPON_FORMS: Record<Skill, readonly [string, string, string, string]> = {
  blade: ["环绕短刀", "双刃旋刀", "三刃绞轮", "四刃风暴轮"],
  fire: ["火球", "焰尾火弹", "熔核陨星", "裂壳日轮"],
  ice: ["冰环", "六棱冰环", "霜晶法阵", "极寒星阵"],
  lightning: ["电弧", "分叉雷矛", "雷晶审判", "雷暴冠冕"],
  scythe: ["回旋镰", "双面月镰", "死神巨镰", "收割轮镰"],
  ghost: ["小幽灵", "兜帽幽灵", "角冠怨灵", "翼冠冥使"],
  water: ["圣水池", "十字圣泉", "花瓣圣泉", "净化圣坛"],
  poison: ["毒雾", "孢子毒簇", "瘟疫菌床", "蚀骨毒沼"],
  bone: ["骨矛", "倒钩骨矛", "骸骨冲角", "脊骨龙枪"],
  mine: ["地雷", "齿爪地雷", "符文雷盘", "雷霆机关阵"],
  void: ["黑洞印记", "蚀月漩涡", "碎星核心", "坍缩星门"],
  bat: ["蝙蝠", "钩翼血蝠", "角翼魔蝠", "血月蝠王"],
  axe: ["战斧", "双面战斧", "锯齿战轮", "四刃裂地轮"],
  chain: ["火链", "熔铁锁节", "狱火棘链", "地狱锁网"],
  pillar: ["光柱", "十字光柱", "圣剑落柱", "天穹剑阵"],
  totem: ["骨柱", "骷髅图腾", "角冠骨塔", "亡骨祭坛"],
  soul: ["魂线", "念珠魂链", "幽魂枷锁", "轮回锁阵"],
  meteor: ["落石", "裂岩陨石", "熔核灾星", "末日星坠"],
};
export function weaponFormName(skill: Skill, level: number, evolved = false) {
  return WEAPON_FORMS[skill][formTier(level, evolved)];
}
