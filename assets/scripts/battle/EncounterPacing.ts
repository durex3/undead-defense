export const BOSS_TIME = 480;
export const MAX_PLAYER_LEVEL = 64;
/** Authored encounter beats use a four-minute score stretched over eight minutes. */
export const encounterTime = (time: number) => time / 2;
export function encounterBeat(time: number): {
  name: string;
  rest: boolean;
  harvest: boolean;
} {
  time = encounterTime(time);
  if (time >= 240) return { name: "首领决战", rest: false, harvest: false };
  if ((time >= 82 && time < 86) || (time >= 165 && time < 170) || time >= 234)
    return {
      name: "短暂喘息 · 拾取经验，准备迎战",
      rest: true,
      harvest: false,
    };
  if (
    (time >= 35 && time < 45) ||
    (time >= 110 && time < 145) ||
    (time >= 195 && time < 225)
  )
    return { name: "亡潮涌入 · 清理成群敌人", rest: false, harvest: true };
  if (time >= 60 && time % 30 >= 27 && !(time >= 82 && time < 90))
    return { name: "短暂喘息 · 收集战场补给", rest: true, harvest: false };
  return {
    name: time < 25 ? "初入地牢 · 沿敌群边缘收割" : "敌群逼近 · 留意特殊敌人",
    rest: false,
    harvest: false,
  };
}
