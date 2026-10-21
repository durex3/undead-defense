import { stageGrowth } from "./StageGrowth";
import type { StageId } from './ProgressionConfig';

/** Playable identities; health is derived from the shared reference-output × target-time budgets. */
export const STAGES = {
 12:{...stageGrowth(12),name:"裂釉熔窑",boss:"裂釉炉心",damage:1.70,xp:1.45,medicine:42},
 11:{...stageGrowth(11),name:"缚烬织坊",boss:"绷骨织后",damage:1.66,xp:1.45,medicine:42},
  1: {...stageGrowth(1),name:'铁棘围城', boss:'铁棘围城督军', damage:1.42, xp:.85, medicine:42},
  2: {...stageGrowth(2),name:'赤砂虫巢', boss:'赤砂巢皇', damage:1.46, xp:.85, medicine:42},
  3: {...stageGrowth(3),name:'雷铸机庭', boss:'天穹铸雷机', damage:1.50, xp:1.2, medicine:42},
  4: {...stageGrowth(4),name:'苍棘猎原', boss:'蚀月角王', damage:1.52, xp:1.3, medicine:42},
  5: {...stageGrowth(5),name:"灰烛钟庭",boss:"覆钟蜡主",damage:1.54,xp:1.30,medicine:42},
  10: {...stageGrowth(10),name:"缄页禁库",boss:"缄律藏典",damage:1.62,xp:1.40,medicine:42},
  9: {...stageGrowth(9),name:"断羽风廊",boss:"悬翼风枭",damage:1.62,xp:1.30,medicine:42},
  8: {...stageGrowth(8),name:"蚀根温室",boss:"垂冠根母",damage:1.62,xp:1.30,medicine:42},
  7: {...stageGrowth(7),name:"折晶矿窟",boss:"裂冠岩母",damage:1.62,xp:1.30,medicine:42},
  6: {...stageGrowth(6),name:"锈潮船坞",boss:"沉锚船骸",damage:1.58,xp:1.30,medicine:42},
} satisfies Record<StageId, object>;

export const STAGE_GUIDES: Record<StageId, {threat: string; builds: string}> = {
 12:{threat:"火头沿箭头分流，虚线支路无伤 · 导火栓可截断后段 · 三阶段裂釉炉心",builds:"绕开火头、等尾部经过；靠近导火栓可引导自动攻击，分流前击碎可截断后段"},
 11:{threat:"松线可穿、紧线绕端 · 两拍回扣与平移梭线 · 三阶段错拍织后",builds:"看端点开合与第二拍刻度；松弛时换侧，紧线可绕有限端头，收招时反击"},
 10:{threat:"封签可踏断撤招 · 实体页刃与双夹页 · 三阶段藏典 · 书架不挡友方攻击",builds:"先看配对编号，直接躲开或踩签撤一条；抓中缝、端头与收招窗口"},
 9:{threat:"定向风推、完整曲羽与贴地折步 · 双精英错峰同场 · 风柱挡敌弹，不挡友方攻击",builds:"先看风向借风换位，沿弧线侧移；优先击破一名精英，抓收招窗口反击"},
 8:{threat:"树脂护皮 · 固定支点摆藤、空心环刺与实心花爆 · 盆床不挡友方攻击",builds:"看摆向绕端换侧，空心可进内圈，实心须退出；收招开缝时反击"},
 7:{threat:"厚蜡甲 · 晶柱反射棱弹，晶核可击碎 · 晶柱不挡友方攻击",builds:"看完整折线与折点；晶核可打碎或绕开，收招甲缝暴露时反击"},
 6:{threat:"厚蜡甲与潮墙 · 货垛截潮、截锚，不挡飞叉和友方攻击",builds:"绕过浪头再切回；细绳无伤，裂甲或收舷暴露时反击"},
 5:{threat:"厚蜡甲与声浪 · 钟台挡声浪、不挡蜡印或友方攻击",builds:"借台避浪、换侧离印；裂甲改善输出，抓收招时暴露的甲缝"},
  1: {threat:"错位短墙与双侧环路 · 盾弩阵型、钉地逼位、战犬突袭 · 断墙不挡攻击",builds:"先拆旗官与弩兵，侧移避骑将；督军连续钉位与内外圈交替，换位后反击"},
  2: {threat:"分散岩岛与斜向沙道 · 分裂、折返、连喷与潜沙 · 岩岛不挡攻击",builds:"先清幼虫与虫卵，躲第一击后准备换向；引暴君撞岩，巢皇出土后留意钳击"},
  3: {threat:"锁线、电锚与缺口电栅 · 绝缘机座不挡攻击",builds:"拆电极断线，向电栅缺口换道；抓住机械恢复期反击"},
  4: {threat:"回刃折返、锁点跃扑与旋转角刃 · 残木不挡攻击",builds:"看去回程箭头换向，躲落点后绕背；猎王收招时切入反击"},
};
