export const BOSS_TIME = 360;
export const MAX_WEAPON_SLOTS = 4;
export const bossTimeForStage = (_stageId: number) => BOSS_TIME;
/** Map real seconds to the existing 480-beat encounter score, never to attack clocks. */
export const encounterScoreTime = (time: number) => (time * 480) / BOSS_TIME;
export const encounterRealTime = (score: number) => (score * BOSS_TIME) / 480;
export const MAX_PLAYER_LEVEL = 64;
/** The four-minute shared score now spans a six-minute approach to the boss. */
export const encounterTime = (time: number) => encounterScoreTime(time) / 2;
export function encounterBeat(time: number): {
  name: string;
  rest: boolean;
  harvest: boolean;
} {
  if (eliteQuiet(time))
    return {
      name: "精英前休整 · 拾取经验，准备换位",
      rest: true,
      harvest: false,
    };
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

/** Three staggered elite rounds; these are real seconds, never attack-speed scaling. */
export const ELITE_TIMES = [135, 225, 305] as const;
export const ELITE_DEADLINE = 340;
export const RETURN_ELITE_HEALTH = 1;
export const eliteQuiet = (time: number) =>
  ELITE_TIMES.some((at) => time >= at - 10 && time < at);
