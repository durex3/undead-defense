export function encounterBeat(time: number): {
  name: string;
  rest: boolean;
  harvest: boolean;
} {
  if (time >= 240) return { name: "首领决战", rest: false, harvest: false };
  if ((time >= 82 && time < 90) || (time >= 165 && time < 175) || time >= 230)
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
  if (time >= 60 && time % 30 >= 25)
    return { name: "短暂喘息 · 收集战场补给", rest: true, harvest: false };
  return {
    name: time < 25 ? "初入地牢 · 沿敌群边缘收割" : "敌群逼近 · 留意特殊敌人",
    rest: false,
    harvest: false,
  };
}
