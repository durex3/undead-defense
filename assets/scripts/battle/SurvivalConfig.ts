export const MAX_ENEMIES=100;
export const MAX_SKILL_LEVEL=8;
export const WEAPONS=["blade","fire","water","frost","lightning","ghost","bone","mine","void","holy"] as const;
export const ALL_WEAPONS=[...WEAPONS,"hammer","wheel","lamp","needle"] as const;
export type Skill=typeof ALL_WEAPONS[number];
export const PASSIVES=["power","hourglass","area","duration","amount","boots","vitality","magnet"] as const;
export type Passive=typeof PASSIVES[number];
export type Card=Skill|Passive|"repair"|"continue";
export const PASSIVE_MAX:Record<Passive,number>={power:4,hourglass:4,area:4,duration:4,amount:2,boots:4,vitality:4,magnet:4};
export const NAMES:Record<Card,string>={lamp:"引魂灯",needle:"缚影缝针",hammer:"镇钟重锤",wheel:"裂甲飞轮",blade:"飞刀",fire:"烈焰火球",water:"圣水瓶",frost:"寒霜脉环",lightning:"连锁闪电",ghost:"幽灵伙伴",bone:"贯阵骨矛",mine:"符印地雷",void:"坍缩黑洞",holy:"裁决圣剑",power:"力量徽记",hourglass:"疾咏沙漏",area:"广域烛台",duration:"长效符文",amount:"复刻指环",boots:"风行靴",vitality:"生命护符",magnet:"拾魂吊坠",repair:"生命药剂",continue:"继续战斗"};
export const COLORS:Record<string,string>={lamp:"#92e5cd",needle:"#d2b3ee",hammer:"#deb976",wheel:"#a8d7c7",blade:"#f4da9b",fire:"#ff9854",water:"#7bdded",frost:"#9edfff",lightning:"#ffe075",ghost:"#a7e4cf",bone:"#e6d4b5",mine:"#e6a45b",void:"#bf9bff",holy:"#fff1ab",power:"#efaa89",hourglass:"#ecc99d",area:"#b8a4ed",duration:"#a9d8b1",amount:"#e8d9a6",boots:"#bdd99a",vitality:"#f59fa7",magnet:"#72e4ca",repair:"#f59fa7",continue:"#c4d4de"};
export const WEAPON_ROLES:Record<Skill,string>={lamp:"定点烙魂 · 短时支援增伤",needle:"双端缝线 · 有限伤害转递",hammer:"近侧重击破甲 · 慢速扇面",wheel:"去回贯穿裂甲 · 中距切线",blade:"多刃环绕 · 数把实体刀持续绕身切割",fire:"范围爆破 · 轰炸密集敌群",water:"持续封路 · 将追兵引进水区",frost:"结霜爆冰 · 短冻结解围，不控制首领",lightning:"瞬时传导 · 在邻近敌人之间跳跃",ghost:"驻队伙伴 · 离队追猎两爪后回收",bone:"蓄力贯阵 · 选密集直线，长矛贯穿整列",mine:"布设反击 · 敌人靠近才触发爆炸",void:"短时聚怪 · 收束爆破，不牵制首领",holy:"锁点裁决 · 预示后落剑，抓住停顿"};

/**
 * Every enemy belongs to exactly one stage, plus two shared roles.
 * Keep this list and ENEMIES in sync; the type derives from it.
 */
export const ENEMY_KINDS = [
  // 1 · 铁棘围城
  "siegebone", "thornshield", "siegebow", "flanker", "siegeflag", "siegerider",
  // 2 · 赤砂虫巢
  "sandworker", "sandlarva", "sandegg", "shellroller", "sandspitter", "sandstalker", "broodelite", "breakerelite",
  // 3 · 雷铸机庭
  "rivetwalker", "anchorweaver", "arclantern", "railsaw", "gridwarden", "railreaper", "thunderanchor", "gridelectrode",
  // 4 · 苍棘猎原
  "thornrunner", "crescentmantis", "vaultlynx", "antlerprowler", "moonreaver", "hornwarden",
  "waxbearer","bellacolyte","waxscribe","waxcrawler","twinbell","waxporter",
  "brineporter","sluiceray","sailharpooner","winchbeast","twinlockwarden","severedcrane",
  "shardhermit","facetgastropod","prismmason","corebrood","bifacetregent","strataflinger","prismmirror","prismcore",
  "rootshuffler","vinecantor","wreathpod","bulbmaw","biforktangler","pairedcalyx","migratorycorolla",
  "fledglingeffigy","reedwhistler","sickleplumer","foldedskimmer","windarbiter","plumejudge",
  "paperbonegrub","sealclerk","folioray","spineclasp","sealprovost","claspjailer",
  // 通用
  "minion", "boss",
] as const;
export type Kind = (typeof ENEMY_KINDS)[number];
export interface EnemyConfig {
  name: string;
  health: number;
  speed: number;
  contact: number;
  xp: number;
  threat: number;
  cap: number;
  sprite: string;
  scale: number;
  elite?: boolean;
}

export const ENEMIES: Record<Kind, EnemyConfig> = {
 paperbonegrub:{name:"纸骨蠹",health:1.1,speed:1.65,contact:12,xp:1,threat:0,cap:100,sprite:"",scale:3.4},
 sealclerk:{name:"押印书吏",health:1.9,speed:1.15,contact:14,xp:2,threat:2,cap:2,sprite:"",scale:3.4},
 folioray:{name:"巡页鳐",health:1.85,speed:1.2,contact:12,xp:2,threat:2,cap:2,sprite:"",scale:3.4},
 spineclasp:{name:"夹脊钳兽",health:2,speed:1.05,contact:14,xp:2,threat:2,cap:1,sprite:"",scale:3.4},
 sealprovost:{name:"提签校监",health:9.5,speed:1.15,contact:10,xp:8,threat:3,cap:1,sprite:"",scale:3.4,elite:true},
 claspjailer:{name:"合卷典狱",health:10,speed:1.1,contact:11,xp:8,threat:3,cap:1,sprite:"",scale:3.4,elite:true},

 fledglingeffigy:{name:"风蚀雏俑",health:1.1,speed:1.65,contact:12,xp:1,threat:0,cap:100,sprite:"",scale:3.4},
 reedwhistler:{name:"哨喙风俑",health:1.8,speed:1.15,contact:12,xp:2,threat:2,cap:1,sprite:"",scale:3.4},
 sickleplumer:{name:"弧翎投手",health:1.85,speed:1.2,contact:14,xp:2,threat:2,cap:2,sprite:"",scale:3.4},
 foldedskimmer:{name:"折翼踏卫",health:1.8,speed:1.5,contact:14,xp:2,threat:2,cap:2,sprite:"",scale:3.4},
 windarbiter:{name:"衡风祭羽",health:9,speed:1.15,contact:10,xp:8,threat:3,cap:1,sprite:"",scale:3.4,elite:true},
 plumejudge:{name:"裁羽巡判",health:10,speed:1.2,contact:11,xp:8,threat:3,cap:1,sprite:"",scale:3.4,elite:true},

 migratorycorolla:{name:"迁萼巡守",health:8,speed:1.25,contact:10,xp:8,threat:3,cap:1,sprite:"",scale:4.2,elite:true},
 rootshuffler:{name:"匍根芽团",health:1.1,speed:1.65,contact:12,xp:1,threat:0,cap:100,sprite:"",scale:3.2},
 vinecantor:{name:"盘藤执鞭者",health:1.85,speed:1.15,contact:14,xp:2,threat:2,cap:2,sprite:"",scale:3.4},
 wreathpod:{name:"环萼囊花",health:1.75,speed:1.2,contact:12,xp:2,threat:2,cap:2,sprite:"",scale:3.4},
 bulbmaw:{name:"鼓腹灯蕊",health:1.9,speed:1.1,contact:14,xp:2,threat:2,cap:2,sprite:"",scale:3.4},
 biforktangler:{name:"双节绞藤",health:10,speed:1.2,contact:10,xp:8,threat:3,cap:1,sprite:"",scale:4.2,elite:true},
 pairedcalyx:{name:"对生育花母",health:10,speed:1.1,contact:11,xp:8,threat:3,cap:1,sprite:"",scale:4.6,elite:true},

  // 1 · 铁棘围城
  siegebone:{name:"铁棘步卒",health:1.05,speed:1.55,contact:8,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3.2},
  thornshield:{name:"棘盾禁卫",health:2.2,speed:1.25,contact:12,xp:2,threat:1,cap:4,sprite:"orc_warrior_run",scale:3.4},
  siegebow:{name:"钉地弩兵",health:1.8,speed:1.2,contact:16,xp:2,threat:2,cap:2,sprite:"goblin_run",scale:3.2},
  flanker:{name:"猎袭战犬",health:.9,speed:2.2,contact:10,xp:1,threat:1,cap:4,sprite:"skelet_run",scale:3},
  siegeflag:{name:"军团旗官",health:10,speed:1.45,contact:9,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4.2,elite:true},
  siegerider:{name:"破阵骑将",health:12,speed:1.7,contact:10,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4.6,elite:true},

  // 2 · 赤砂虫巢
  sandworker:{name:"镰足工虫",health:1.05,speed:1.65,contact:8,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3},
  sandlarva:{name:"赤砂幼虫",health:.25,speed:2.2,contact:4,xp:0,threat:0,cap:20,sprite:"skelet_run",scale:2},
  sandegg:{name:"孵巢虫卵",health:.525,speed:0,contact:0,xp:0,threat:0,cap:3,sprite:"skelet_run",scale:2},
  shellroller:{name:"裂甲滚虫",health:2.1,speed:1.4,contact:10,xp:2,threat:1,cap:3,sprite:"skelet_run",scale:3},
  sandspitter:{name:"喷砂囊虫",health:1.8,speed:1.1,contact:12,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  sandstalker:{name:"潜沙猎虫",health:1.3,speed:2,contact:10,xp:2,threat:1,cap:2,sprite:"skelet_run",scale:3},
  broodelite:{name:"孵巢监母",health:10,speed:1.3,contact:9,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4,elite:true},
  breakerelite:{name:"裂地暴君",health:12,speed:1.6,contact:10,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4,elite:true},

  // 3 · 雷铸机庭
  rivetwalker:{name:"铆齿行机",health:1.1,speed:1.7,contact:8,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3},
  anchorweaver:{name:"落锚蛛机",health:1.7,speed:1.15,contact:10,xp:2,threat:1,cap:2,sprite:"skelet_run",scale:3},
  arclantern:{name:"导弧浮灯",health:1.55,speed:1.25,contact:10,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  railsaw:{name:"滑轨切割机",health:1.9,speed:1.8,contact:12,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  gridwarden:{name:"接地织阵者",health:10,speed:1.35,contact:10,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  railreaper:{name:"断轨裁切机",health:12,speed:1.45,contact:11,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  thunderanchor:{name:"电锚",health:0.6,speed:0,contact:0,xp:0,threat:0,cap:4,sprite:"skelet_run",scale:3},
  gridelectrode:{name:"接地电极",health:0.7,speed:0,contact:0,xp:0,threat:0,cap:4,sprite:"skelet_run",scale:3},

  // 4 · 苍棘猎原
  thornrunner:{name:"棘背群兽",health:1.1,speed:1.75,contact:8,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3},
  crescentmantis:{name:"回刃螳猎",health:1.6,speed:1.2,contact:10,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  vaultlynx:{name:"跃枝猞猁",health:1.45,speed:1.8,contact:10,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  antlerprowler:{name:"摆角巡兽",health:1.9,speed:1.3,contact:12,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  moonreaver:{name:"回锋猎酋",health:10,speed:1.4,contact:10,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  hornwarden:{name:"巡角巨灵",health:12,speed:1.4,contact:11,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},

  waxbearer:{name:"抬烛蜡徒",health:1.1,speed:1.65,contact:12,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3},
  bellacolyte:{name:"鸣钟执事",health:1.8,speed:1.15,contact:14,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  waxscribe:{name:"刻蜡书吏",health:1.7,speed:1.25,contact:12,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  waxcrawler:{name:"绕柱爬蜡",health:1.4,speed:1.95,contact:14,xp:2,threat:1,cap:3,sprite:"skelet_run",scale:3},
  twinbell:{name:"双钟司祭",health:10,speed:1.3,contact:10,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  waxporter:{name:"封蜡抬钟者",health:12,speed:1.2,contact:11,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  brineporter:{name:"背篓潮佣",health:1.10,speed:1.7,contact:12,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3},
  sluiceray:{name:"开闸背鳐",health:1.85,speed:1.15,contact:14,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  sailharpooner:{name:"卷帆叉手",health:1.65,speed:1.3,contact:12,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  winchbeast:{name:"绞盘拖锚兽",health:1.90,speed:1.25,contact:14,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  twinlockwarden:{name:"双闸港监",health:10,speed:1.25,contact:10,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  severedcrane:{name:"断缆吊主",health:12,speed:1.2,contact:11,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  // 通用
  shardhermit:{name:"碎晶寄居",health:1.1,speed:1.65,contact:12,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3},
  facetgastropod:{name:"回棱梭螺",health:1.85,speed:1.15,contact:14,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  prismmason:{name:"植棱晶匠",health:1.7,speed:1.2,contact:12,xp:2,threat:2,cap:1,sprite:"skelet_run",scale:3},
  corebrood:{name:"囊晶蠕兽",health:1.9,speed:1.15,contact:14,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  bifacetregent:{name:"双面折光者",health:10,speed:1.2,contact:10,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  strataflinger:{name:"裂层抛岩者",health:12,speed:1.1,contact:11,xp:8,threat:3,cap:1,sprite:"skelet_run",scale:3,elite:true},
  prismmirror:{name:"反射棱镜",health:1,speed:0,contact:0,xp:0,threat:0,cap:2,sprite:"skelet_run",scale:3},
  prismcore:{name:"可击碎晶核",health:1,speed:0,contact:0,xp:0,threat:0,cap:2,sprite:"skelet_run",scale:3},
  minion: {name:"游荡骷髅",health:1,speed:1.5,contact:8,xp:1,threat:0,cap:75,sprite:"skelet_run",scale:3},
  boss:{name:"骸骨领主",health:2800,speed:0.9,contact:18,xp:0,threat:0,cap:1,sprite:"big_demon_run",scale:4.5},
};

export function isElite(kind: Kind) {
  return !!ENEMIES[kind].elite;
}
export function isLarge(kind: Kind) {
  return kind === "boss" || isElite(kind);
}

/**
 * The four stages resolve ranged damage inside their own systems (Siege/Sand/
 * Thunder/Moon), so no shared ranged role needs the legacy x2 pass here.
 */
export const RANGED_ENEMIES: readonly Kind[] = [];
export function enemyAttackRate(kind: Kind) { return RANGED_ENEMIES.includes(kind) ? 2 : 1; }
export function enemyDamage(kind: Kind, amount: number) {
  return amount * (isElite(kind) || RANGED_ENEMIES.includes(kind) ? 2 : 1);
}
// Apply once to the shared spawn/contact config; overlap never compounds to four times.
for (const kind of ENEMY_KINDS) {
  if (!isElite(kind) && !RANGED_ENEMIES.includes(kind)) continue;
  ENEMIES[kind].health *= 2;
  ENEMIES[kind].contact *= 2;
}

export function enemyRecoveryRate(kind: Kind, state: string) { return state === "recover" ? enemyAttackRate(kind) : 1; }
