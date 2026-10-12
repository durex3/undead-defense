import type { StageId } from './ProgressionConfig';
export const STAGES = {
  1: {name:'地牢', boss:'骸骨领主', health:1, elite:1, bossHealth:1, damage:1, xp:1, medicine:25},
  2: {name:'诅咒庭院', boss:'守墓人', health:1.2, elite:1.25, bossHealth:1.534, damage:1.1, xp:.85, medicine:40},
  3: {name:'熔骨祭坛', boss:'熔骨祭司', health:1.32, elite:1.4375, bossHealth:1.8408, damage:1.155, xp:.85, medicine:40},
  4: {name:'幽钟教堂', boss:'丧钟主教', health:1.36, elite:1.5, bossHealth:1.90, damage:1.18, xp:.85, medicine:40},
  5: {name:'亡者王庭',boss:'亡者君王',health:1.42,elite:1.6,bossHealth:2,damage:1.22,xp:.85,medicine:40},
  6: {name:'亡者熔炉',boss:'铸魂监工',health:1.44,elite:1.62,bossHealth:2.04,damage:1.24,xp:.85,medicine:40},
  7: {name:'永夜裂隙',boss:'裂隙织主',health:1.46,elite:1.64,bossHealth:2.08,damage:1.26,xp:.85,medicine:40},
} satisfies Record<StageId, object>;

export const STAGE_GUIDES: Partial<Record<StageId, {threat: string; builds: string}>> = {
  6: {threat:'盾兵护阵 · 熔流封路 · 监工蓄力时直接伤害降低', builds:'尝试圣水＋毒雾、骨矛＋地雷；搭配幽灵＋蝙蝠集中输出'},
  7: {threat:'远程分散 · 内外圈交替 · 织主恢复时可追击', builds:'尝试雷电＋冰环、幽灵＋蝙蝠；搭配镰刀＋战斧清群'},
};
