import type { WeaponMod, WeaponStats } from "./ArmoryConfig";
export const EXTRA_WEAPONS = [
  "frost",
  "lightning",
  "ghost",
  "bone",
  "mine",
  "void",
  "holy",
] as const;
export type ExtraSkill = (typeof EXTRA_WEAPONS)[number];
const mod = (
  id: string,
  name: string,
  short: string,
  glyph: string,
  effect: string,
  cost: string,
  excludes?: string,
): WeaponMod => ({ id, name, short, glyph, effect, cost, excludes });
export const EXTRA_MODS: Record<ExtraSkill, readonly WeaponMod[]> = {
  frost: [
    mod(
      "outward",
      "逐浪寒潮",
      "寒潮",
      "◯",
      "脉环向外扩散，半径×1.4，沿途逐个命中",
      "伤害−20%；外缘延迟到达",
      "sectors",
    ),
    mod(
      "sectors",
      "三相霜扇",
      "霜扇",
      "❄",
      "三个错时扇区依次扫过，伤害×1.4",
      "三个方向有时间空档；周期×1.2",
      "outward",
    ),
    mod(
      "aftershock",
      "霜痕复震",
      "复震",
      "〰",
      "原中心0.8秒后再震一次，伤害为主击45%",
      "主击伤害−15%；复震不冻结",
    ),
    mod(
      "brittle",
      "碎冰裂响",
      "碎冰",
      "✳",
      "命中已减速目标时追加35%直接伤害",
      "不再冻结普通怪，只减速；不触发递归爆炸",
    ),
  ],
  lightning: [
    mod(
      "relay",
      "扩域落雷",
      "扩雷",
      "ϟ",
      "每轮落雷数量+2，相邻落点可选间距由3.5增至5.5",
      "每击伤害−20%",
      "storm",
    ),
    mod(
      "storm",
      "范围雷暴",
      "雷暴",
      "≋",
      "同时小范围落雷改为每0.18秒依次轰击，基础半径0.48增至0.9",
      "每击伤害−30%；锁定后不追踪",
      "relay",
    ),
    mod(
      "echo",
      "余电回击",
      "回击",
      "↯",
      "0.45秒后原落点追加一次65%雷击",
      "主击伤害−15%；回击锁定位置",
    ),
    mod(
      "bridge",
      "电弧连桥",
      "连桥",
      "⌁",
      "相邻落点之间电弧对沿线敌人造成45%伤害",
      "主击伤害−20%；每轮沿线同目标只结算一次",
    ),
  ],
  ghost: [
    mod(
      "execution",
      "缚魂猎手",
      "猎手",
      "➤",
      "优先精英与远程，单次伤害×1.7",
      "伙伴数−1，至少1；周期×1.2",
      "swarm",
    ),
    mod(
      "swarm",
      "群灵出巡",
      "群灵",
      "♧",
      "额外召唤2只幽灵，分配不同目标",
      "单次伤害−40%",
      "execution",
    ),
    mod(
      "haunt",
      "盘魂追击",
      "盘魂",
      "◎",
      "第二爪改为锁点盘旋0.9秒，追加3次单爪70%伤害",
      "首次爪击与盘旋伤害−20%；盘旋不追随目标",
    ),
    mod(
      "reap",
      "归途收割",
      "归途",
      "↶",
      "归途沿锁定回收路线造成65%伤害",
      "主击伤害−15%；每目标每回程只受伤一次",
    ),
  ],
  bone: [
    mod(
      "lance",
      "破阵重矛",
      "重矛",
      "➤",
      "直线穿透，射程×1.35，伤害×1.5",
      "周期×1.25；仍只覆盖窄射线",
      "fan",
    ),
    mod(
      "fan",
      "扇骨齐射",
      "齐射",
      "⋔",
      "追加2根骨矛，向宽扇面发射",
      "每矛伤害−35%",
      "lance",
    ),
    mod(
      "marrow",
      "贯骨加速",
      "贯骨",
      "»",
      "每穿过1人，速度与伤害+15%，最多3层",
      "初始伤害−15%；必须排列敌人",
    ),
    mod(
      "ridge",
      "骨棘留阵",
      "骨棘",
      "╪",
      "矛终点留1.2秒横向骨棘，触碰造成50%伤害",
      "主矛伤害−15%；每条骨棘同目标只命中一次",
    ),
  ],
  mine: [
    mod(
      "trip",
      "绊线符雷",
      "绊线",
      "⌁",
      "相邻地雷之间连绊线，穿线可引爆两端",
      "爆炸伤害−20%；至少两个雷才能连线",
      "burrow",
    ),
    mod(
      "burrow",
      "伏击重雷",
      "重雷",
      "◉",
      "延迟1.2秒武装，伤害×1.7，爆炸半径×1.3",
      "触发半径−25%；不主动索敌",
      "trip",
    ),
    mod(
      "scatter",
      "散布雷阵",
      "雷阵",
      "⁙",
      "额外布设2雷，沿角色周围宽圈分散",
      "每雷伤害−35%；需要引怪踩雷",
    ),
    mod(
      "fuse",
      "延时追爆",
      "追爆",
      "✹",
      "触发0.6秒后在原地再爆一次，伤害65%",
      "主爆伤害−20%；敌人可能离开复爆区",
    ),
  ],
  void: [
    mod(
      "drift",
      "迁移涡心",
      "迁移",
      "↝",
      "黑洞缓慢向施放方向移动，速度1.3",
      "每跳伤害−20%；原落点不会持续聚怪",
      "collapse",
    ),
    mod(
      "collapse",
      "瞬息坍缩",
      "坍缩",
      "◉",
      "寿命减半，结束爆发由3跳伤害变为6跳",
      "聚怪时间短；最终爆发需要敌人仍在圈内",
      "drift",
    ),
    mod(
      "binary",
      "双核引力",
      "双核",
      "☍",
      "额外形成1个侧向涡心，覆盖不同区域",
      "每核伤害−30%；同源重叠不叠伤",
    ),
    mod(
      "repel",
      "反冲星环",
      "反冲",
      "◌",
      "结束时爆发改为空心环，外半径×1.6",
      "中心55%半径无终结伤害；终结伤害×1.5",
    ),
  ],
  holy: [
    mod(
      "execution",
      "斩首巨剑",
      "巨剑",
      "†",
      "落剑延迟0.8秒，中央伤害×1.8",
      "落点半径−20%，数量−1至少1",
      "rain",
    ),
    mod(
      "rain",
      "巡行剑雨",
      "剑雨",
      "⁝",
      "额外2把圣剑，间隔0.18秒依次落下",
      "每剑伤害−40%，半径−15%",
      "execution",
    ),
    mod(
      "cross",
      "十字圣裁",
      "十字",
      "✚",
      "圆形落点改为两条交叉圣刃，长度为半径×2",
      "伤害−15%；四角没有伤害",
    ),
    mod(
      "brand",
      "裁痕重落",
      "重落",
      "⇣",
      "0.7秒后原落点第二次落剑，伤害65%",
      "首击伤害−15%；第二剑不会追踪",
    ),
  ],
};
const baseCache = new Map<
  string,
  {
    damage: number[];
    count: number[];
    cooldown: number[];
    radius: number;
    range: number;
    duration: number;
  }
>();
export function extraBase(skill: ExtraSkill, l: number) {
  const key = `${skill}:${l}`,
    cached = baseCache.get(key);
  if (cached) return cached;
  const bases = {
    frost: [24, 3.6, 3.2, 1, 7, 1.2],
    lightning: [30, 2.3, 0.9, 3, 11, 0.4],
    ghost: [14.4, 3.0, 0.3, 2, 12, 3],
    bone: [32, 2.6, 0.24, 1, 11, 1.2],
    mine: [60, 3.8, 1.8, 2, 8, 6],
    void: [8, 5.4, 2.2, 1, 9, 2.4],
    holy: [40, 3.6, 1.2, 1, 12, 0.55],
  }[skill];
  const value = {
    damage: Array.from(
      { length: 8 },
      (_, i) => bases[0] * [1, 1.25, 1.25, 1.25, 1.6, 1.6, 2, 2][i],
    ),
    count: Array.from(
      { length: 8 },
      (_, i) => bases[3] + (i >= 2 ? 1 : 0) + (i >= 5 ? 1 : 0),
    ),
    cooldown: Array.from(
      { length: 8 },
      (_, i) => bases[1] * (i >= 7 ? 0.75 : i >= 3 ? 0.88 : 1),
    ),
    radius: bases[2] * (l >= 3 ? 1.12 : 1) * (l >= 7 ? 1.1 : 1),
    range: bases[4],
    duration: bases[5],
  };
  if (skill === "lightning") {
    value.damage = [36,45,45,54,66,74,88,100];
    value.cooldown = [2.3,2.3,2.3,2,2,2,2,1.6];
  }
  baseCache.set(key, value);
  return value;
}
export function applyExtraMods(skill: ExtraSkill, s: WeaponStats) {
  const has = (id: string) => s.mods.includes(id);
  const scale = (id: string, d: number) => {
    if (has(id)) s.damage *= d;
  };
  if (skill === "frost") {
    scale("outward", 0.8);
    if (has("outward")) s.radius *= 1.4;
    if (has("sectors")) {
      s.damage *= 1.4;
      s.cooldown *= 1.2;
    }
    scale("aftershock", 0.85);
  }
  if (skill === "lightning") {
    if (has("relay")) {
      s.damage *= 0.8;
      s.count += 2;
    }
    scale("storm", 0.7);
    scale("echo", 0.85);
    scale("bridge", 0.8);
  }
  if (skill === "ghost") {
    if (has("execution")) {
      s.damage *= 1.7;
      s.count = Math.max(1, s.count - 1);
      s.cooldown *= 1.2;
    }
    if (has("swarm")) {
      s.count += 2;
      s.damage *= 0.6;
    }
    scale("haunt", 0.8);
    scale("reap", 0.85);
  }
  if (skill === "bone") {
    if (has("lance")) {
      s.damage *= 1.5;
      s.range *= 1.35;
      s.cooldown *= 1.25;
    }
    if (has("fan")) {
      s.count += 2;
      s.damage *= 0.65;
    }
    scale("marrow", 0.85);
    scale("ridge", 0.85);
  }
  if (skill === "mine") {
    scale("trip", 0.8);
    if (has("burrow")) {
      s.damage *= 1.7;
      s.radius *= 1.3;
    }
    if (has("scatter")) {
      s.count += 2;
      s.damage *= 0.65;
    }
    scale("fuse", 0.8);
  }
  if (skill === "void") {
    scale("drift", 0.8);
    if (has("collapse")) s.duration *= 0.5;
    if (has("binary")) {
      s.count++;
      s.damage *= 0.7;
    }
  }
  if (skill === "holy") {
    if (has("execution")) {
      s.damage *= 1.8;
      s.radius *= 0.8;
      s.count = Math.max(1, s.count - 1);
    }
    if (has("rain")) {
      s.count += 2;
      s.damage *= 0.6;
      s.radius *= 0.85;
    }
    scale("cross", 0.85);
    scale("brand", 0.85);
  }
}
export const EXTRA_RULES: Record<ExtraSkill, string> = {
  frost:
    "结霜0.1秒后爆冰一次，残纹不补伤；普通冻结0.75秒、精英0.25秒，间隔3秒；首领与冲锋不受控。持续只延长减速。",
  lightning:
    "数量增加每轮落雷上限，实际落点取决于附近目标；同轮主雷对每个敌人最多命中一次。范围增加落点可选间距与雷击范围；回击与连桥不额外生成落雷。持续属性不适用。",
  ghost:
    "伙伴驻队、出击两爪后回收；目标失效最多重索敌一次，任务最多3秒。盘魂替换第二爪；归途锁定一次终点。",
  bone: "选密集直线蓄力0.2秒后贯穿，每矛同目标一次；数量增加射线，范围增加矛宽；持续只延长骨棘。",
  mine: "地雷武装后等待敌人触发；未触发到期消失，不免费爆炸。数量增加雷数；持续增加等待寿命。复爆不递归。",
  void: "每0.4秒一跳，同源重叠只取最高伤害；终结爆发同源同拍不叠伤。只拉普通追兵，不拉精英、首领或冲锋怪。",
  holy: "先预示固定落点再落剑；数量增加本轮圣剑总数；十字交叉处只命中一次。持续属性不延长预警或增加落剑次数。",
};
