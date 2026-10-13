import { rankDamage } from "./BuildProgression";
export const MAX_ENEMIES = 100;
export const MAX_SKILL_LEVEL = 10;
export const EVOLUTION_LEVELS = [10] as const;
export const WEAPONS = [
  "blade",
  "fire",
  "ice",
  "lightning",
  "scythe",
  "ghost",
  "water",
  "poison",
  "bone",
  "mine",
  "void",
  "bat",
  "axe",
  "chain", "pillar", "totem", "soul", "meteor",
] as const;
export type Skill = (typeof WEAPONS)[number];
export type WeaponTag = "melee" | "projectile" | "area" | "summon" | "elemental" | "control" | "critical" | "leech";
export const WEAPON_TAGS: Record<Skill, readonly WeaponTag[]> = {
  blade: ["melee"], fire: ["projectile", "area", "elemental"], ice: ["area", "control", "elemental"], lightning: ["projectile", "control", "elemental"],
  scythe: ["melee", "projectile"], ghost: ["projectile", "summon"], water: ["area", "elemental", "control"], poison: ["area", "elemental", "control"],
  bone: ["projectile"], mine: ["area", "control"], void: ["area", "control"], bat: ["projectile", "summon", "leech"], axe: ["melee", "projectile"],
  chain: ["control", "elemental"], pillar: ["area", "elemental"], totem: ["summon", "projectile"], soul: ["control", "leech"], meteor: ["area", "elemental"],
};
export const SYNTHESIS_RECIPES: Partial<Record<Skill, Skill>> = {
  fire: "blade", lightning: "ice", scythe: "axe", ghost: "bat", water: "poison", meteor: "void", bone: "mine", chain: "pillar", totem: "soul",
};
export const PASSIVES = ["magnet", "boots", "hourglass"] as const;
export type Passive = (typeof PASSIVES)[number];
export type Card = Skill | Passive | "repair";
export const NAMES: Record<Card, string> = {
  blade: "环绕飞刀",
  fire: "烈焰火球",
  ice: "冰霜新环",
  lightning: "连锁闪电",
  scythe: "回旋镰刀",
  ghost: "幽灵伙伴",
  water: "圣水瓶",
  poison: "毒雾尾迹",
  bone: "骨矛齐射",
  mine: "雷霆地雷",
  void: "黑洞印记",
  bat: "噬魂蝙蝠",
  axe: "回旋战斧",
  chain: "火焰锁链", pillar: "圣光柱", totem: "亡骨图腾", soul: "灵魂锁链", meteor: "灾厄陨石",
  magnet: "拾魂吊坠",
  boots: "风行靴",
  hourglass: "延时沙漏",
  repair: "生命药剂",
};
export const COLORS: Record<string, string> = {
  blade: "#f4da9b",
  fire: "#ff9854",
  ice: "#87e6ff",
  lightning: "#c6a1ff",
  scythe: "#a8eac0",
  ghost: "#b4d6ff",
  water: "#7bdded",
  poison: "#b5d878",
  bone: "#e7dac0",
  mine: "#eac76c",
  void: "#b992e5",
  bat: "#f092b1",
  axe: "#d99555",
  chain: "#ff694f", pillar: "#fff1a6", totem: "#a98772", soul: "#c69cff", meteor: "#e56c56",
  magnet: "#72e4ca",
  boots: "#bdd99a",
  hourglass: "#ecc99d",
  repair: "#f59fa7",
};
export const EVOLUTIONS: Record<
  Skill,
  { id: string; name: string; description: string }[]
> = {
  blade: [
    {
      id: "ring",
      name: "绞肉之环",
      description: "满级六把高速短刀，向近敌偏转\n扩大环绕范围，保留贴身持续收割",
    },
    {
      id: "return",
      name: "归巢飞刃",
      description: "四把飞刃自动瞄准，扇形往返切割\n向远处敌人伸展，近身有攻击空档",
    },
  ],
  fire: [
    {
      id: "meteor",
      name: "熔岩陨星",
      description: "巨型陨星主击，满级追加两枚副陨星\n覆盖不同敌群，留下燃烧地面；保留飞刀联动",
    },
    { id: "inferno", name: "焚天火雨", description: "六发火球分散轰炸不同敌群\n爆炸留下持续火海，封锁大片区域" },
  ],
  ice: [
    {
      id: "domain",
      name: "极寒领域",
      description: "随身领域半径 3.5\n持续减速，每 4 秒冻结脉冲\n适合近身控场，冰雷组合效果保留",
    },
    { id: "icicle", name: "极点冰刺", description: "五枚穿透冰刺瞄准首领与精英\n每枚命中两人，冻结小怪、减速首领" },
  ],
  lightning: [
    {
      id: "judgment",
      name: "雷霆审判",
      description: "双链末端触发雷爆\n冰环减速目标额外受到碎冰伤害",
    },
    { id: "thunder", name: "极点天罚", description: "五道重雷自动锁敌，无跳跃衰减\n前三道强击，独立压制远程威胁" },
  ],
  scythe: [
    {
      id: "reaper",
      name: "死神收割",
      description: "自动索敌，巨型宽镰往返收割\n回程击杀延长最多3单位\n回程追击战斧印记，触发收割冲击",
    },
    { id: "cross", name: "双月交锋", description: "双镰自动索敌，交叉往返切割\n回程伤害提高50%，命中掀起小型刃风" },
  ],
  ghost: [
    {
      id: "legion",
      name: "幽魂军团",
      description: "四个幽灵分别寻找目标，灵弹穿透并溅射\n组合后：标记击杀释放追踪魂弹",
    },
    { id: "hunters", name: "冥界双猎", description: "双猎魂高速追踪首领与精英\n直接击杀引发魂爆，重新寻找存活目标" },
  ],
  water: [
    {
      id: "spring",
      name: "净化圣泉",
      description: "五重半径 2.8 的圣泉，自动瞄准并减速\n组合后：水毒交叠形成周期爆发法阵",
    },
    { id: "tide", name: "随身圣潮", description: "半径3.6的圣潮跟随角色\n持续伤害与减速，边移动边清理近敌" },
  ],
  poison: [
    {
      id: "plague",
      name: "瘟疫行者",
      description: "毒雾中的敌人死亡触发毒爆\n每秒最多 4 次，不递归引爆",
    },
    { id: "venom", name: "蚀骨剧毒", description: "主动投毒并立即伤害目标\n每次叠两层，最多五层，离池持续4秒" },
  ],
  bone: [
    {
      id: "ram",
      name: "白骨冲车",
      description: "齐射化作巨型穿透骨矛\n击退普通敌人；穿过已武装地雷时引爆\n雷爆追加骨片冲击",
    },
    { id: "ricochet", name: "碎骨跳弹", description: "三枚骨片各跳弹最多五个不同目标\n弹射逐次衰减，追击分散敌人" },
  ],
  mine: [
    {
      id: "network",
      name: "连环雷阵",
      description: "爆炸引爆附近已武装地雷\n每帧最多连锁 4 枚",
    },
    {id:"demolition",name:"定点重雷",description:"两枚重雷投向首领与精英脚下\n独立高伤爆破，附带短暂控制"},
  ],
  void: [
    {
      id: "collapse",
      name: "坍缩核心",
      description: "黑洞结束时发生大爆炸\n在聚怪之后集中收割",
    },
    {id:"singularity",name:"奇点压缩",description:"小范围持续压缩，随后大范围爆破\n牵引较弱，靠自身伤害终结敌群"},
  ],
  axe: [{ id: "warwheel", name: "战轮回旋", description: "双斧自动索敌、宽幅往返\n返回伤害提高70%\n适合清理成群敌人，保留镰刀印记" },
    { id: "execution", name: "断头重斧", description: "重斧自动瞄准首领与精英\n往返重击，回程命中掀起范围震波" }],
  chain: [{ id: "hellchain", name: "地狱锁链", description: "火链持续标记敌人，光柱加速落下\n命中标记触发灼爆，每敌1秒一次" }, {id:"brand",name:"焚魂烙印",description:"优先锁定强敌，持续灼烧并波及近敌\n击杀后自动转锁，延续剩余时间"}],
  pillar: [{ id: "judgmentsky", name: "审判天穹", description: "连续三次落柱，中心命中额外伤害" }, {id:"sunlance",name:"裁决光矛",description:"最多五处光矛同时落下\n主矛优先重击首领，副矛清理其他落点"}],
  totem: [{ id: "gravegrid", name: "墓园矩阵", description: "三座图腾组成交叉射线\n命中魂链束缚目标追加魂击，每敌0.5秒一次" }, {id:"obelisk",name:"随行骨塔",description:"一座骨塔随身移动，快速双线射击\n主线集中强敌，副线攻击另一目标"}],
  soul: [{ id: "reincarnation", name: "轮回枷锁", description: "锁链断裂时爆发" }, {id:"torment",name:"蚀魂独缚",description:"独立锁定强敌，伤害随持续时间递增\n击杀自动转锁，继承增伤与剩余时间"}],
  meteor: [{ id: "doomsfall", name: "末日星坠", description: "落点形成短时余烬区\n命中黑洞牵引区追加坍缩冲击" }, {id:"impact",name:"灭星重陨",description:"主陨重击首领，最多四处碎陨清场\n独立多点爆破，不留余烬"}],
  bat: [
    {
      id: "bloodmoon",
      name: "血月归巢",
      description: "每轮 6 只，生命≥70%时伤害 +20%\n吸血仅至70%，间隔2.5秒，受伤停2秒",
    },
    {id:"bloodhunt",name:"血影猎杀",description:"三只血蝠优先强敌，每只追击两名敌人\n高伤高速猎杀，完成后返回，不回血"},
  ],
};
/** Second branches are self-contained evolutions and never activate recipe effects. */
export function independentBranch(skill: Skill, form?: string) {
  return !!form && EVOLUTIONS[skill][1]?.id === form;
}
const DESCRIPTIONS: Record<Skill, string[]> = {
  water: [
    "每 4 秒向前投出圣水\n形成持续净化区域",
    "圣水瓶 1 → 2 瓶\n左右落点打开通路",
    "半径 1.3 → 1.6\n持续 3 → 4 秒",
    "圣水瓶 2 → 3 瓶\n形成短走廊，重叠不叠伤",
  ],
  poison: [
    "移动 3 单位留下毒雾\n静止不会持续产生",
    "毒雾持续 3 → 4.5 秒\n更长的追兵陷阱",
    "半径 1.1 → 1.5\n附加 20% 减速",
    "每移动 3 → 2 单位留雾\n更密集铺设撤退路线",
  ],
  bone: [
    "每 1.8 秒射出骨矛\n穿透最多 4 名敌人",
    "单矛 → 3 支扇形齐射\n单支伤害略降",
    "穿透目标 4 → 7\n射穿更厚的敌潮",
    "每次发射两轮齐射\n间隔 0.25 秒",
  ],
  mine: [
    "每 3 秒布置一枚地雷\n0.5 秒武装后触发爆炸",
    "每次布置 1 → 2 枚\n左右错开，阻截追兵",
    "爆炸半径 1.7 → 2.2\n扩大陷阱覆盖",
    "爆炸附加 0.35 秒麻痹\n同敌控制间隔至少 3 秒",
  ],
  void: [
    "每 6 秒生成牵引印记\n聚拢怪群，结束时坍缩",
    "牵引半径 2 → 2.8\n吸引更大范围敌人",
    "牵引持续 1.5 → 2 秒\n首领不受位移影响",
    "施法间隔 6 → 4.8 秒\n更频繁聚拢敌群",
  ],
  bat: [
    "命中返回回复1点，仅至70%生命\n回复间隔2.5秒，受伤后停2秒",
    "蝙蝠 2 → 4 只\n每轮治疗仍最多 1 点",
    "施法间隔 4 → 3 秒\n更频繁猎杀与返回",
    "每只追加攻击一个目标\n每轮治疗上限 1 → 2 点",
  ],

  blade: [
    "一把环绕短刀\n靠近敌群边缘收割",
    "飞刀 1 → 2 把\n覆盖更多方向",
    "环绕半径 1.7 → 2.2\n刀刃判定加宽 20%",
    "飞刀 2 → 3 把\n每圈 2.4 → 2 秒",
  ],
  fire: [
    "每 3 秒发射火球\n命中后范围爆炸",
    "每轮 1 → 2 颗火球\n优先攻击不同目标",
    "爆炸半径 1.2 → 1.7\n附加持续燃烧",
    "每轮 2 → 3 颗火球\n连续轰炸敌群",
  ],
  ice: [
    "每 4 秒释放冰环\n减速近敌，创造脱身机会",
    "冰环半径 2.4 → 3.2\n更早挡住追兵",
    "单环 → 双环\n第二圈延迟 0.5 秒",
    "第一圈冻结普通敌人\n解冻后继续减速",
  ],
  lightning: [
    "每 2.6 秒连锁 3 名敌人\n敌群越密集越有效",
    "连锁目标 3 → 5\n扩大群体杀伤",
    "单链 → 双链\n分别攻击不同敌人",
    "每链目标 5 → 6\n跳跃距离 2.8 → 3.5",
  ],
  scythe: [
    "自动瞄准敌人，弧线扫出\n飞出与返回各命中一次",
    "单镰 → 双镰\n两条路线穿透敌群",
    "飞行距离 6 → 8\n刀刃判定加宽 30%",
    "施法间隔 2.5 → 1.8 秒\n更快打通行进路线",
  ],
  axe: [
    "每 2.8 秒自动瞄准敌人投出\n返回路径重击并穿透敌群",
    "战斧 1 → 2 把\n覆盖两条进攻路线",
    "飞行距离 5 → 7\n斧刃判定加宽",
    "返回路径伤害 +35%\n更快完成一轮攻击",
  ],
  chain: ["自动连接附近敌人，持续灼烧", "连接数量 +1", "跳转距离 +25%", "灼烧时间 +50%"],
  pillar: ["延迟标记地面，落下范围伤害", "标记数量 +1", "光柱范围 +25%", "连续落下三次"],
  totem: ["生成图腾自动射击附近敌人", "图腾数量 +1", "射速 +25%", "形成三角交叉阵"],
  soul: ["连接两个敌人并减速", "连接数量 +1", "减速 +15%", "断裂时爆发"],
  meteor: ["锁定密集区域延迟轰炸", "落石数量 +1", "爆炸半径 +25%", "留下余烬区"],
  ghost: [
    "召唤 1 个跟随幽灵\n每 1.2 秒发射追踪灵弹",
    "幽灵 1 → 2 个\n持续寻找远处威胁",
    "灵弹穿透 1 个额外敌人\n对齐敌群可连续命中",
    "攻击间隔 1.2 → 0.9 秒\n更频繁发射灵弹",
  ],
};
/** Explicit shape changes shown at the three breakthrough ranks. */
export const BREAKTHROUGH_DESCRIPTIONS: Record<Skill, [string, string, string]> = {
  axe: ["4级：双面战斧，回旋切割", "7级：锯齿战轮，回程重击", "10级：四刃裂地轮，交叉收割"],
  blade: ["4级：双刀环绕，覆盖扩大", "7级：五刀绞肉环，持续切割", "10级：六刀风暴，半径与判定大幅提升"],
  fire: ["4级：三连火球，连续爆炸", "7级：陨星落点，留下燃烧区", "10级：流星雨，多个落点覆盖区域"],
  ice: ["4级：双重冰环，延迟冻结", "7级：极寒领域，持续减速", "10级：周期冰爆，清空近身敌潮"],
  lightning: ["4级：双链分流，覆盖两侧", "7级：雷霆审判，末端雷爆", "10级：雷暴场，连续落雷覆盖区域"],
  scythe: ["4级：双镰交叉，回程收割", "7级：巨镰轨迹，穿透加宽", "10级：死神回旋，扩大往返范围"],
  ghost: ["4级：双幽灵，同时锁定目标", "7级：幽魂军团，弹体穿透", "10级：四灵围猎，命中产生溅射"],
  water: ["4级：三瓶连线，形成净化走廊", "7级：圣泉领域，持续控制", "10级：多重圣泉，覆盖大片区域"],
  poison: ["4级：高密度毒雾，持续减速", "7级：瘟疫扩散，死亡毒爆", "10级：毒海蔓延，连续铺设区域"],
  bone: ["4级：双轮齐射，扇形覆盖", "7级：白骨冲车，巨矛穿透", "10级：骨矛风暴，多轮贯穿敌潮"],
  mine: ["4级：双雷布置，交错封路", "7级：连环雷阵，爆炸串联", "10级：雷区扩张，持续封锁大片区域"],
  void: ["4级：牵引范围扩大，聚怪更强", "7级：坍缩核心，结束时爆炸", "10级：双重黑洞，交替吞噬敌潮"],
  bat: ["4级：四蝙蝠分路猎杀", "7级：噬魂回旋，命中强化回复", "10级：蝙蝠军团，多目标围猎"],
  chain: ["4级：锁链分叉，覆盖更多敌人", "7级：地狱锁链，持续灼烧", "10级：链网扩散，形成控制区域"],
  pillar: ["4级：连续光柱，扩大落点", "7级：圣光阵列，多点轰击", "10级：天穹审判，覆盖大型区域"],
  totem: ["4级：三角图腾阵，交叉射击", "7级：图腾增殖，扩大火力网", "10级：亡骨祭坛，持续召唤火力"],
  soul: ["4级：多重灵魂连接", "7级：断链爆发，范围收割", "10级：灵魂风暴，持续牵制敌群"],
  meteor: ["4级：多重落石，扩大爆炸", "7级：余烬区域，持续灼烧", "10级：灾厄陨星，连续轰炸大片区域"],
};
export function cardText(card: Card, level: number) {
  if (WEAPONS.includes(card as Skill)) {
    const next = level + 1;
    if (level >= MAX_SKILL_LEVEL) return "10级终式已成型\n选择最终进化分支";
    if (next === 7) return `觉醒 · ${EVOLUTIONS[card as Skill][0].name}\n${EVOLUTIONS[card as Skill][0].description.split("\n")[0]}`;
    if (next === 10) return "终式：最终形态与覆盖强化\n全部命中伤害提升至 3 倍";
    if (next === 4) return "小成：武器轮廓与攻击强化\n继续培养，7级解锁觉醒";
    if (level >= 4) return `伤害倍率 ${rankDamage(level)} → ${rankDamage(next)}\n${next < 7 ? "距离觉醒还差 " + (7-next) + " 级" : "距离终式还差 " + (10-next) + " 级"}`;
  }
  if (WEAPONS.includes(card as Skill))
    return level >= MAX_SKILL_LEVEL
      ? "已满级，可选择进化\n改变武器的攻击形态"
      : DESCRIPTIONS[card as Skill][Math.min(level, 4)] +
        (level > 4 ? `\n深度强化 · 等级 ${level}/${MAX_SKILL_LEVEL}` : "");
  if (card === "repair") return "立即恢复 20 点生命\n不占装备位";
  return (
    (
      {
        magnet: ["拾取半径 +35%", "拾取半径 +35% → +70%"],
        boots: ["移动速度 +10%", "移动速度 +10% → +18%"],
        hourglass: ["武器冷却缩短 10%", "武器冷却缩短 10% → 18%"],
      } as Record<Passive, string[]>
    )[card as Passive][level] + "\n被动装备 · 最多装备两件"
  );
}
export const ENEMY_KINDS = [
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
