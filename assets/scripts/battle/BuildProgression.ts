import type { Skill } from "./SurvivalConfig";
export const WEAPON_ROLES: Record<Skill, string> = {
  blade:"贴身割草 · 沿敌潮边缘切入", fire:"远程轰炸 · 清理密集怪群", ice:"近身控场 · 冻住追兵再脱身",
  lightning:"连锁清群 · 越密集越有效", scythe:"穿透收割 · 切开身后追兵", ghost:"自动追击 · 处理远处威胁",
  water:"铺地封路 · 引敌走进圣泉", poison:"移动布毒 · 边撤退边消耗", bone:"直线破阵 · 贯穿厚重敌潮",
  mine:"陷阱爆破 · 留给身后追兵", void:"聚怪控制 · 搭配范围伤害", bat:"追击续航 · 命中返回回血",
  axe:"往返重击 · 打通撤退路线", chain:"锁链灼烧 · 持续压制近敌", pillar:"定点轰击 · 预判怪群走向",
  totem:"阵地火力 · 围绕图腾作战", soul:"束缚吸血 · 牵制危险目标", meteor:"范围爆破 · 轰炸密集落点",
};
export function rankDamage(level: number) {
  return level >= 10 ? 3 : level >= 9 ? 2.6 : level >= 8 ? 2.3 : level >= 7 ? 2 : level >= 6 ? 1.38 : level >= 5 ? 1.18 : 1;
}
