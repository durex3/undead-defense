export type Kind = "minion" | "rogue" | "warrior" | "mage" | "boss";
export type Skill = "fire" | "ice" | "lightning" | "ballista";
export type Card = Skill | "power" | "haste" | "repair" | "gold";
export const ENEMIES: Record<
  Kind,
  {
    hp: number;
    speed: number;
    damage: number;
    interval: number;
    xp: number;
    model: string;
  }
> = {
  minion: {
    hp: 60,
    speed: 0.65,
    damage: 10,
    interval: 1.5,
    xp: 1,
    model: "Skeleton_Minion",
  },
  rogue: {
    hp: 40,
    speed: 1.1,
    damage: 8,
    interval: 1,
    xp: 1,
    model: "Skeleton_Rogue",
  },
  warrior: {
    hp: 180,
    speed: 0.4,
    damage: 20,
    interval: 2,
    xp: 3,
    model: "Skeleton_Warrior",
  },
  mage: {
    hp: 90,
    speed: 0.5,
    damage: 12,
    interval: 3,
    xp: 2,
    model: "Skeleton_Mage",
  },
  boss: {
    hp: 2400,
    speed: 0.28,
    damage: 60,
    interval: 3,
    xp: 0,
    model: "Skeleton_Golem",
  },
};
export const SKILLS: Skill[] = ["fire", "ice", "lightning", "ballista"];
export const NAMES: Record<Card, string> = {
  fire: "烈焰弹",
  ice: "寒冰穿刺",
  lightning: "连锁闪电",
  ballista: "重型弩炮",
  power: "火力强化",
  haste: "快速装填",
  repair: "修复防线",
  gold: "战利品",
};
export const COOLDOWNS: Record<Skill, number> = {
  fire: 5,
  ice: 4,
  lightning: 5,
  ballista: 7,
};
export const XP = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 50];
export const WAVES: number[][] = [
  [12, 0, 0, 0],
  [16, 0, 0, 0],
  [14, 6, 0, 0],
  [14, 0, 4, 0],
  [18, 6, 0, 0],
  [16, 0, 0, 4],
  [16, 0, 6, 0],
  [18, 8, 0, 4],
  [20, 0, 6, 4],
];
export function stageWaves(stage: number): Kind[][] {
  const kinds: Kind[] = ["minion", "rogue", "warrior", "mage"];
  return [
    ...WAVES.map((row, i) => {
      const counts = row.slice();
      if (stage >= 2 && i >= 2) {
        counts[0] = Math.max(0, counts[0] - 2);
        counts[1] += 2;
      }
      if (stage >= 3 && i >= 4) {
        counts[0] = Math.max(0, counts[0] - 2);
        counts[3] += 1;
      }
      const wave: Kind[] = [];
      for (let k = 0; k < 4; k++)
        for (let j = 0; j < counts[k]; j++) wave.push(kinds[k]);
      return wave;
    }),
    ["boss"] as Kind[],
  ];
}
export function cardText(card: Card, level: number): string {
  if (card === "power") return "全部伤害 +10%\n持续整场战斗";
  if (card === "haste") return "主武器射速 +10%\n更快压制敌人";
  if (card === "repair") return "立即修复 15% 最大生命\n稳住这道防线";
  if (card === "gold") return "结算金币 +10";
  if (!level)
    return {
      fire: "范围爆炸 + 持续燃烧\n每 5 秒释放",
      ice: "穿透 4 个敌人，减速 35%\n每 4 秒释放",
      lightning: "在 4 个敌人之间连锁\n每 5 秒释放",
      ballista: "400% 攻击，穿透 3 人\n每 7 秒释放",
    }[card];
  if (level === 1) return "技能伤害提升至 125%\n强化你的核心火力";
  if (level === 2)
    return {
      fire: "爆炸半径 1.5 → 1.8",
      ice: "穿透目标 4 → 6",
      lightning: "连锁目标 4 → 6",
      ballista: "穿透目标 3 → 5",
    }[card];
  if (level === 3) return "技能伤害提升至 150%";
  return {
    fire: "进化：爆炸后留下烈焰地带",
    ice: "进化：冻结普通敌人 0.6 秒",
    lightning: "进化：每跳伤害保留 90%",
    ballista: "进化：对首领额外伤害 +50%",
  }[card];
}
