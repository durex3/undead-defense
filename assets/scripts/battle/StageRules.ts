import { stageGrowth } from "./StageGrowth";
import type { StageId } from './ProgressionConfig';

/** Playable identities; health is derived from the shared reference-output × target-time budgets. */
export const STAGES = {
 19:{...stageGrowth(19),name:"双阙猎庭",boss:"双阙猎主",damage:1.80,xp:1.45,medicine:42},
 18:{...stageGrowth(18),name:"错拍鸣庭",boss:"双律监奏",damage:1.80,xp:1.45,medicine:42},
 17:{...stageGrowth(17),name:"逆痕刑场",boss:"执痕刑官",damage:1.80,xp:1.45,medicine:42},
 16:{...stageGrowth(16),name:"回骸墓苑",boss:"镇墓者",damage:1.78,xp:1.45,medicine:42},
 15:{...stageGrowth(15),name:"沉铅铸庭",boss:"抛铅铸主",damage:1.76,xp:1.45,medicine:42},
 14:{...stageGrowth(14),name:"蚀昼观台",boss:"噬曜仪主",damage:1.74,xp:1.45,medicine:42},
 13:{...stageGrowth(13),name:"断锋傀庭",boss:"换锋傀主",damage:1.72,xp:1.45,medicine:42},
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
 19:{threat:"近远双体协同 · 先倒一体改变独猎招式 · 两体全倒才通关",builds:"先拆追击或远程；看真实身体和矢头，低猎台不挡箭与横扫"},
 18:{threat:"先扫后刺 · 两次独立锁定 · 共鸣架使为追兵加甲",builds:"躲完第一拍继续看第二拍；先拆支援可减压，低鸣台不挡扫刺"},
 17:{threat:"一次脱枷复活 · 实体循迹与返程 · 旧脚印和预警线无伤",builds:"离开公布的旧路线，留意返身箭头；冲锋到位后横扫另有完整预警"},
 16:{threat:"一次裂棺复活 · 旧骨痕与本体夹击 · 墓台不挡骨震",builds:"看身体与旧痕编号，完整预警后才有伤；第二命倒下才通关"},
 15:{threat:"空中丸与投影无伤 · 落地短冲击 · 看编号与下一落点",builds:"可从高飞铅丸投影下穿过；离开即将落点，驻丸回跳另有完整预警"},
 14:{threat:"定轴旋光 · 实体石柱截光 · 预警扇面无伤 · 三阶段双仪",builds:"看箭头转向，绕内圈或有限光束末端；借柱影换位，收招时反击"},
 13:{threat:"本体与离体刃交棒 · 停驻刀与细线无伤 · 回锋独立预警 · 三阶段傀主",builds:"看下一击来源；绕过刀身和本体，回收后抓近身空门反击"},
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
