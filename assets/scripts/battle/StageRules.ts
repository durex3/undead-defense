import type { StageId } from './ProgressionConfig';
export const STAGES = {
  1: {name:'地牢', boss:'骸骨领主', health:1, elite:1, bossHealth:1, damage:1, xp:1, medicine:25},
  2: {name:'诅咒庭院', boss:'守墓人', health:1.2, elite:1.25, bossHealth:1.534, damage:1.1, xp:.85, medicine:40},
  3: {name:'熔骨祭坛', boss:'熔骨祭司', health:1.32, elite:1.4375, bossHealth:1.8408, damage:1.155, xp:.85, medicine:40},
  4: {name:'幽钟教堂', boss:'丧钟主教', health:1.36, elite:1.5, bossHealth:1.90, damage:1.18, xp:.85, medicine:40},
  5: {name:'亡者王庭',boss:'亡者君王',health:1.42,elite:1.6,bossHealth:2,damage:1.22,xp:.85,medicine:40},
  6: {name:'亡者熔炉',boss:'铸魂监工',health:1.44,elite:1.62,bossHealth:2.04,damage:1.24,xp:.85,medicine:40},
  7: {name:'永夜裂隙',boss:'裂隙织主',health:1.46,elite:1.64,bossHealth:2.08,damage:1.26,xp:.85,medicine:40},
  8: {name:"骸潮港湾",boss:"沉港船长",health:1.48,elite:1.66,bossHealth:2.14,damage:1.28,xp:.85,medicine:40},
  9: {name:"白骨军械库",boss:"军械统领",health:1.50,elite:1.68,bossHealth:2.18,damage:1.30,xp:.85,medicine:40},
  10: {name:"葬星观测台",boss:"葬星占卜者",health:1.52,elite:1.70,bossHealth:2.22,damage:1.32,xp:.85,medicine:40},
  11: {name:"灰烬铸造厂",boss:"灰烬大铸师",health:1.54,elite:1.72,bossHealth:2.26,damage:1.34,xp:.85,medicine:40},
  12: {name:"暮镜回廊",boss:"千面镜守",health:1.56,elite:1.74,bossHealth:2.30,damage:1.36,xp:.85,medicine:40},
  13: {name:"终焉渡口",boss:"终渡领航者",health:1.58,elite:1.76,bossHealth:2.34,damage:1.38,xp:.85,medicine:40},
} satisfies Record<StageId, object>;

export const STAGE_GUIDES: Partial<Record<StageId, {threat: string; builds: string}>> = {
  11: {threat:"有限熔线与落锤 · 冷却砧不挡攻击",builds:"横移清路、绕砧换侧；大铸师停步恢复时贴近反击"},
  12: {threat:"交叉光线与双镜夹道 · 镜座不挡光线",builds:"看清交点，向夹角空区移动；搭配清群与追踪后排"},
  13: {threat:"两处潮印提前锁定 · 留意先后顺序",builds:"侧向换位、持续引怪；第二击结束后切入反击"},
  10: {threat:"旧路星痕、侧向切入、坠星落点 · 基座不挡星痕",builds:"清路换线、追踪后排、持续引怪；躲落点后贴近反击"},
  9: {threat:"骨卫护阵、旗手加速、弩手锁线 · 兵器架不挡弩箭",builds:"贯穿清路后切入、持续引怪、追踪后排；统领恢复时反击"},
  6: {threat:'护阵/追猎/唤潮轮换 · 中央绕行、两侧炉柱引怪', builds:'尝试圣水＋毒雾、骨矛＋地雷；搭配幽灵＋蝙蝠集中输出'},
  8: {threat:"排队推进、侧切与落锚 · 货堆挡冲锋，不挡远程",builds:"贯穿清路、持续引怪、追踪打后排；多种组合均可"},
  7: {threat:'远程分散 · 内外圈交替 · 织主恢复时可追击', builds:'尝试雷电＋冰环、幽灵＋蝙蝠；搭配镰刀＋战斧清群'},
};
