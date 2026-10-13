import type { Skill } from "./SurvivalConfig";
export const WEAPON_ROLES: Record<Skill, string> = {
  blade:"贴身割草 · 沿敌潮边缘切入", fire:"远程轰炸 · 清理密集怪群", ice:"近身控场 · 冻住追兵再脱身",
  lightning:"连锁清群 · 越密集越有效", scythe:"自动索敌 · 弧线往返收割", ghost:"自动追击 · 处理远处威胁",
  water:"铺地封路 · 引敌走进圣泉", poison:"移动布毒 · 边撤退边消耗", bone:"直线破阵 · 贯穿厚重敌潮",
  mine:"陷阱爆破 · 留给身后追兵", void:"聚怪控制 · 搭配范围伤害", bat:"追击续航 · 命中返回回血",
  axe:"自动索敌 · 往返重击", chain:"锁链灼烧 · 持续压制近敌", pillar:"定点轰击 · 预判怪群走向",
  totem:"阵地火力 · 围绕图腾作战", soul:"束缚吸血 · 牵制危险目标", meteor:"范围爆破 · 轰炸密集落点",
};
export function rankDamage(level: number) {
  return level >= 10 ? 3 : level >= 9 ? 2.6 : level >= 8 ? 2.3 : level >= 7 ? 2 : level >= 6 ? 1.38 : level >= 5 ? 1.18 : 1;
}

const BRANCH_ROLES: Record<Skill, readonly [string,string]> = {
  blade:["环绕清群","往返切线"],fire:["集中爆破","多点火雨"],ice:["近身控场","穿透冻结"],
  lightning:["连锁清群","少目标集火"],scythe:["宽幅穿透","交叉刃风 · 回程清群"],ghost:["分散清群","追踪强敌 · 击杀魂爆"],
  water:["远程铺地","随身护场"],poison:["毒爆清群","单点叠毒 · 无毒爆"],bone:["直线破阵","多目标跳弹"],
  mine:["连锁清群","定点重击 · 不连锁"],void:["聚怪收割","集中伤害 · 牵引减弱"],bat:["清群续航","连续追猎 · 不回血"],
  axe:["双斧清群","重斧往返 · 回程震波"],chain:["多目标灼烧","集中灼烧 · 击杀转锁"],pillar:["三连清群","主矛重击 · 五处落点"],
  totem:["阵地穿透","随行双线速射"],soul:["控场断链爆破","单体增伤 · 不减速"],meteor:["范围余烬","集中重击 · 无余烬"],
};
export function branchRole(skill: Skill, index: number) { return BRANCH_ROLES[skill][index === 0 ? 0 : 1]; }
