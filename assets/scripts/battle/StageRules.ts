import type { StageId } from './ProgressionConfig';

/** The four playable stages. Difficulty scales from stage 1 to 4. */
export const STAGES = {
  1: {name:'铁棘围城', boss:'铁棘围城督军', health:1.65, elite:1.85, bossHealth:2.45, damage:1.42, xp:.85, medicine:42},
  2: {name:'赤砂虫巢', boss:'赤砂巢皇', health:1.72, elite:1.95, bossHealth:2.65, damage:1.46, xp:.85, medicine:42},
  3: {name:'雷铸机庭', boss:'天穹铸雷机', health:1.82, elite:2.08, bossHealth:2.86, damage:1.50, xp:.85, medicine:42},
  4: {name:'苍棘猎原', boss:'蚀月角王', health:1.86, elite:2.12, bossHealth:2.90, damage:1.52, xp:.85, medicine:42},
} satisfies Record<StageId, object>;

export const STAGE_GUIDES: Record<StageId, {threat: string; builds: string}> = {
  1: {threat:"错位短墙与双侧环路 · 盾弩阵型、钉地逼位、战犬突袭 · 断墙不挡攻击",builds:"先拆旗官与弩兵，侧移避骑将；督军连续钉位与内外圈交替，换位后反击"},
  2: {threat:"分散岩岛与斜向沙道 · 分裂、折返、连喷与潜沙 · 岩岛不挡攻击",builds:"先清幼虫与虫卵，躲第一击后准备换向；引暴君撞岩，巢皇出土后留意钳击"},
  3: {threat:"锁线、电锚与缺口电栅 · 绝缘机座不挡攻击",builds:"拆电极断线，向电栅缺口换道；抓住机械恢复期反击"},
  4: {threat:"回刃折返、锁点跃扑与旋转角刃 · 残木不挡攻击",builds:"看去回程箭头换向，躲落点后绕背；猎王收招时切入反击"},
};
