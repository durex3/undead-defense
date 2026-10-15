export const MAX_ENEMIES=100;
export const MAX_SKILL_LEVEL=8;
export const WEAPONS=["blade","fire","water"] as const;
export type Skill=typeof WEAPONS[number];
export const PASSIVES=["power","hourglass","area","duration","amount","boots","vitality","magnet"] as const;
export type Passive=typeof PASSIVES[number];
export type Card=Skill|Passive|"repair"|"continue";
export const PASSIVE_MAX:Record<Passive,number>={power:4,hourglass:4,area:4,duration:4,amount:2,boots:4,vitality:4,magnet:4};
export const NAMES:Record<Card,string>={blade:"飞刀",fire:"烈焰火球",water:"圣水瓶",power:"力量徽记",hourglass:"疾咏沙漏",area:"广域烛台",duration:"长效符文",amount:"复刻指环",boots:"风行靴",vitality:"生命护符",magnet:"拾魂吊坠",repair:"生命药剂",continue:"继续战斗"};
export const COLORS:Record<string,string>={blade:"#f4da9b",fire:"#ff9854",water:"#7bdded",power:"#efaa89",hourglass:"#ecc99d",area:"#b8a4ed",duration:"#a9d8b1",amount:"#e8d9a6",boots:"#bdd99a",vitality:"#f59fa7",magnet:"#72e4ca",repair:"#f59fa7",continue:"#c4d4de"};
export const WEAPON_ROLES:Record<Skill,string>={blade:"精准切线 · 自动瞄准附近危险敌人",fire:"范围爆破 · 轰炸密集敌群",water:"持续封路 · 将追兵引进水区"};
export const ENEMY_KINDS = [
  "sandworker", "sandlarva", "sandegg", "shellroller", "sandspitter", "sandstalker", "broodelite", "breakerelite",
  "siegeflag", "siegerider",
  "siegebone", "thornshield", "siegebow", "flanker",
  "forgeguard", "lineworker", "hammerer", "mirrorguard", "prismarcher", "mirrorpriest", "ferryguard", "tidecaller", "echoferryman",
  "minion", "sailor", "drowned", "anchorhand", "boneguard", "standardbearer", "crossbowman", "warflag", "starpatrol", "starweaver", "starpuppet",
  "rogue",
  "shield",
  "boar",
  "bloater",
  "mage",
  "archer",
  "slime",
  "slimeling",
  "banshee",
  "wisp",
  "drummer",
  "summoner",
  "executioner",
  "charger",
  "boss",
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
  sandworker:{name:"镰足工虫",health:1.05,speed:1.65,contact:8,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3},
  sandlarva:{name:"赤砂幼虫",health:.25,speed:2.2,contact:4,xp:0,threat:0,cap:20,sprite:"skelet_run",scale:2},
  sandegg:{name:"孵巢虫卵",health:.525,speed:0,contact:0,xp:0,threat:0,cap:3,sprite:"skelet_run",scale:2},
  shellroller:{name:"裂甲滚虫",health:2.1,speed:1.4,contact:10,xp:2,threat:1,cap:3,sprite:"skelet_run",scale:3},
  sandspitter:{name:"喷砂囊虫",health:1.8,speed:1.1,contact:12,xp:2,threat:2,cap:2,sprite:"skelet_run",scale:3},
  sandstalker:{name:"潜沙猎虫",health:1.3,speed:2,contact:10,xp:2,threat:1,cap:2,sprite:"skelet_run",scale:3},
  // Elite health/contact below receive the shared elite x2 baseline exactly once.
  broodelite:{name:"孵巢监母",health:10,speed:1.3,contact:9,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4,elite:true},
  breakerelite:{name:"裂地暴君",health:12,speed:1.6,contact:10,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4,elite:true},
  siegeflag:{name:"军团旗官",health:10,speed:1.45,contact:9,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4.2,elite:true},
  siegerider:{name:"破阵骑将",health:12,speed:1.7,contact:10,xp:8,threat:3,cap:1,sprite:"orc_warrior_run",scale:4.6,elite:true},
  siegebone:{name:"铁棘步卒",health:1.05,speed:1.55,contact:8,xp:1,threat:0,cap:100,sprite:"skelet_run",scale:3.2},
  thornshield:{name:"棘盾禁卫",health:2.2,speed:1.25,contact:12,xp:2,threat:1,cap:4,sprite:"orc_warrior_run",scale:3.4},
  // Post-0.17.3 values: do not add this role to the legacy double multiplier list.
  siegebow:{name:"钉地弩兵",health:1.8,speed:1.2,contact:16,xp:2,threat:2,cap:2,sprite:"goblin_run",scale:3.2},
  flanker:{name:"猎袭战犬",health:.9,speed:2.2,contact:10,xp:1,threat:1,cap:4,sprite:"skelet_run",scale:3},
  forgeguard:{name:"推炉骨兵",health:1,speed:1.5,contact:8,xp:1,threat:0,cap:12,sprite:"skelet_run",scale:3.2},
  lineworker:{name:"熔线工",health:1,speed:1.2,contact:8,xp:2,threat:2,cap:2,sprite:"goblin_run",scale:3.2},
  hammerer:{name:"落锤匠",health:1.1,speed:1.3,contact:8,xp:2,threat:2,cap:2,sprite:"orc_warrior_run",scale:3.2},
  mirrorguard:{name:"游镜骨兵",health:0.95,speed:1.6,contact:8,xp:1,threat:0,cap:12,sprite:"skelet_run",scale:3.2},
  prismarcher:{name:"棱光射手",health:0.9,speed:1.2,contact:8,xp:2,threat:2,cap:2,sprite:"goblin_run",scale:3.2},
  mirrorpriest:{name:"分镜祭徒",health:1.05,speed:1.1,contact:8,xp:2,threat:2,cap:2,sprite:"orc_warrior_run",scale:3.2},
  ferryguard:{name:"摆渡骨兵",health:1,speed:1.5,contact:8,xp:1,threat:0,cap:12,sprite:"skelet_run",scale:3.2},
  tidecaller:{name:"引潮者",health:1.05,speed:1.2,contact:8,xp:2,threat:2,cap:2,sprite:"goblin_run",scale:3.2},
  echoferryman:{name:"回响摆渡人",health:1,speed:1.15,contact:8,xp:2,threat:2,cap:2,sprite:"orc_warrior_run",scale:3.2},

  starpatrol:{name:"巡星骨兵",health:1,speed:1.4,contact:8,xp:1,threat:0,cap:12,sprite:"skelet_run",scale:3.1},
  starweaver:{name:"刻痕师",health:1.05,speed:1.2,contact:8,xp:2,threat:2,cap:2,sprite:"orc_warrior_run",scale:3.2},
  starpuppet:{name:"坠星傀儡",health:.9,speed:1.3,contact:8,xp:2,threat:2,cap:2,sprite:"goblin_run",scale:3.1},
  boneguard:{name:"护旗骨卫",health:1.15,speed:1.35,contact:8,xp:1,threat:0,cap:16,sprite:"skelet_run",scale:3.3},
  standardbearer:{name:"枯骨旗手",health:1.1,speed:1.2,contact:8,xp:2,threat:2,cap:2,sprite:"orc_warrior_run",scale:3.2},
  crossbowman:{name:"裂甲弩手",health:.85,speed:1.2,contact:8,xp:2,threat:2,cap:2,sprite:"goblin_run",scale:3},
  warflag:{name:"整军旗标",health:3,speed:0,contact:0,xp:0,threat:0,cap:1,sprite:"skelet_run",scale:.8},
  sailor:{name:"水手尸",health:1,speed:1.4,contact:8,xp:1,threat:0,cap:24,sprite:"skelet_run",scale:3.2},
  drowned:{name:"溺亡者",health:.8,speed:2,contact:8,xp:1,threat:1,cap:6,sprite:"goblin_run",scale:2.8},
  anchorhand:{name:"投锚手",health:1.25,speed:1.3,contact:8,xp:2,threat:2,cap:2,sprite:"orc_warrior_run",scale:3.3},
  minion: {
    name: "游荡骷髅",
    health: 1,
    speed: 1.5,
    contact: 8,
    xp: 1,
    threat: 0,
    cap: 75,
    sprite: "skelet_run",
    scale: 3,
  },
  rogue: {
    name: "狂奔食尸鬼",
    health: 0.65,
    speed: 2.4,
    contact: 8,
    xp: 1,
    threat: 1,
    cap: 6,
    sprite: "goblin_run",
    scale: 3,
  },
  shield: {
    name: "持盾亡兵",
    health: 2.2,
    speed: 1,
    contact: 12,
    xp: 3,
    threat: 1,
    cap: 4,
    sprite: "skelet_run",
    scale: 3.3,
  },
  boar: {
    name: "蓄势野猪",
    health: 1.2,
    speed: 1.3,
    contact: 8,
    xp: 2,
    threat: 2,
    cap: 2,
    sprite: "boar_run",
    scale: 3,
  },
  bloater: {
    name: "腐毒胖尸",
    health: 2.5,
    speed: 0.85,
    contact: 12,
    xp: 3,
    threat: 2,
    cap: 2,
    sprite: "big_zombie_run",
    scale: 3,
  },
  mage: {
    name: "骸骨术士",
    health: 0.9,
    speed: 1.1,
    contact: 6,
    xp: 3,
    threat: 2,
    cap: 2,
    sprite: "necromancer",
    scale: 3,
  },

  archer: {
    name: "骨弓猎手",
    health: 0.8,
    speed: 1.2,
    contact: 6,
    xp: 2,
    threat: 2,
    cap: 2,
    sprite: "skelet_run",
    scale: 3,
  },
  slime: {
    name: "分裂软泥",
    health: 1.5,
    speed: 1.2,
    contact: 8,
    xp: 2,
    threat: 1,
    cap: 3,
    sprite: "slime_run",
    scale: 3,
  },
  slimeling: {
    name: "软泥幼体",
    health: 0.3,
    speed: 2,
    contact: 5,
    xp: 0,
    threat: 0,
    cap: 75,
    sprite: "slime_run",
    scale: 1.8,
  },
  banshee: {
    name: "哀嚎女妖",
    health: 1,
    speed: 1,
    contact: 6,
    xp: 3,
    threat: 2,
    cap: 2,
    sprite: "banshee_run",
    scale: 3,
  },
  wisp: {
    name: "持灯幽魂",
    health: 0.8,
    speed: 1.6,
    contact: 8,
    xp: 2,
    threat: 1,
    cap: 3,
    sprite: "wisp_run",
    scale: 3,
  },
  drummer: {
    name: "墓地鼓手",
    health: 1.6,
    speed: 0.9,
    contact: 6,
    xp: 4,
    threat: 2,
    cap: 1,
    sprite: "goblin_run",
    scale: 3.4,
  },
  summoner: {
    name: "掘墓召唤师",
    health: 1.2,
    speed: 0.8,
    contact: 6,
    xp: 4,
    threat: 2,
    cap: 1,
    sprite: "necromancer",
    scale: 3.4,
  },
  executioner: {
    name: "双刃刽子手",
    health: 10,
    speed: 1.1,
    contact: 15,
    xp: 8,
    threat: 0,
    cap: 1,
    sprite: "orc_warrior_run",
    scale: 4,
    elite: true,
  },
  charger: {
    name: "铁蹄统领",
    health: 12,
    speed: 1.1,
    contact: 15,
    xp: 8,
    threat: 0,
    cap: 1,
    sprite: "boar_run",
    scale: 4.5,
    elite: true,
  },
  boss: {
    name: "骸骨领主",
    health: 2800,
    speed: 0.9,
    contact: 18,
    xp: 0,
    threat: 0,
    cap: 1,
    sprite: "big_demon_run",
    scale: 4.5,
  },
};
export function isElite(kind: Kind) {
  return !!ENEMIES[kind].elite;
}
export function isLarge(kind: Kind) {
  return kind === "boss" || isElite(kind);
}

/** Ranged attackers include projectile shooters and ranged ground/beam casters. */
export const RANGED_ENEMIES: readonly Kind[] = [
  "mage", "archer", "anchorhand", "crossbowman", "starweaver",
  "lineworker", "hammerer", "prismarcher", "mirrorpriest", "tidecaller", "echoferryman",
];
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
