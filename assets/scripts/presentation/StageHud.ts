import type { SurvivalWorld } from "../battle/SurvivalWorld";
import type { Enemy, Hazard } from "../battle/SurvivalTypes";
import type { StageId } from "../battle/ProgressionConfig";
import { STAGES } from "../battle/StageRules";
import { loomState } from "../battle/LoomGeometry";
import { moonHint } from "../battle/MoonSystem";
import { thunderHint } from "../battle/ThunderSystem";
interface Context {
  w: SurvivalWorld;
  boss?: Enemy;
  hazard?: Hazard;
}
interface StageHudProvider {
  hint?(w: SurvivalWorld): string;
  advice(c: Context): string;
  progress?(c: Context): string;
  action?(c: Context): string;
  bossTitle?(boss: Enemy): string;
  phase(boss: Enemy): string;
}
const legacy = (e: Enemy) => (e.bossPhase >= 2 ? "狂怒" : "第一阶段");
const threePhase = (e: Enemy) =>
  ["第一阶段 I", "第二阶段 II", "第三阶段 III"][e.bossPhase - 1];
const fixed = (
  hint: string,
  advice: string,
  phase: (e: Enemy) => string = legacy,
): StageHudProvider => ({ hint: () => hint, advice: () => advice, phase });
const phases = (label: string, set: Set<number>) =>
  `${label} I${set.has(1) ? "✓" : "·"} II${set.has(2) ? "✓" : "·"} III${set.has(3) ? "✓" : "·"}`;
/** Complete presentation registration. Adding a StageId requires a HUD provider. */
const providers: Record<StageId, StageHudProvider> = {
  1: {
    phase: legacy,
    advice: ({ hazard: h }) =>
      h?.kind === "bellRing"
        ? "进入空心内圈或退出外圈"
        : h?.siegeCharge
          ? "横向离开冲锋通道"
          : "离开实心区域，留意下一击",
  },
  2: { phase: legacy, advice: () => "离开锁定区域，留意折返与连喷" },
  3: {
    phase: legacy,
    hint: thunderHint,
    advice: () => "离开锁线，向电栅缺口移动",
  },
  4: { phase: legacy, hint: moonHint, advice: () => "躲开落点，留意回刃折返" },
  5: fixed(
    "钟台挡声浪 · 蜡印需换位 · 收招甲缝可反击",
    "借钟台避声浪，离开蜡印",
  ),
  6: fixed("绕过浪头再切回 · 厚蜡甲可裂解 · 收舷时反击", "绕过浪头，离开锚点"),
  7: fixed(
    "看完整折线 · 晶核可击碎 · 收招时甲缝暴露",
    "避开完整折线，晶核可击碎",
  ),
  8: fixed(
    "绕端换侧 · 空心可进，实心须出 · 收招护皮开缝",
    "空心可进，实心须出，绕藤端换侧",
  ),
  9: fixed(
    "借风换位 · 曲羽不追踪 · 击破一名精英可减压",
    "顺风换位，横向避开曲羽",
  ),
  10: fixed(
    "踩签撤招 · 看配对编号 · 中缝可留，端头可绕",
    "踩配对封签撤招，绕开页刃",
    threePhase,
  ),
  11: {
    ...fixed("紧线绕端 · 松弛可穿 · 看第二拍与移梭箭头", "", threePhase),
    advice: ({ w, hazard: h }) =>
      h?.loom
        ? `织线${h.loom.order} · ${loomState(h, w.time) === "slack" ? "松线可穿，留意第二拍" : loomState(h, w.time) === "tight" ? "紧线绕端，离开线体" : "看端点与倒计时，准备换侧"}`
        : "紧线绕端，松弛换侧",
    progress: ({ w }) => phases("松线双穿", w.challenge.loomPhases),
  },
  12: {
    ...fixed("虚线无伤 · 尾过安全 · 靠近导火栓可引导自动攻击", "", threePhase),
    advice: ({ w, hazard: h }) =>
      h?.kiln
        ? `走焰${h.kiln.order} · ${w.time < h.due ? "看实线箭头，虚线无伤" : "绕开火头，尾过安全"}`
        : "靠近导火栓可引导自动攻击",
    progress: ({ w }) => phases("分流前断源", w.challenge.kilnPhases),
  },
  13: {
    ...fixed("本体与落刀交棒 · 停驻刀/细线无伤 · 回收后反击", "", threePhase),
    advice: ({ hazard: h }) =>
      h?.edge
        ? `来源${h.edge.order} · ${h.edge.shape === "body" ? "本体换步，侧移避开" : "看落刀回收箭头，停驻刀无伤"}`
        : "回收后抓本体空门",
    progress: ({ w }) => phases("交棒反击", w.challenge.edgePhases),
    action: ({ w, hazard: h }) => {
      const f = h?.edge?.flights.find((f) => !f.cancelled && f.end > w.time);
      return f
        ? `${h!.edge!.shape === "body" ? "本体换步" : f.index ? "落刀回收" : "本体掷锋"} · ${w.time < f.due ? `${(f.due - w.time).toFixed(1)}秒后启动` : "移动实体有伤"} · 停驻刀/细线无伤`
        : "";
    },
  },
  14: {
    ...fixed(
      "预警无伤 · 仅亮束有伤 · 借柱影换位或绕有限端头",
      "看箭头转向 · 石柱截光 · 内圈与光束末端可绕",
      threePhase,
    ),
    progress: ({ w, boss }) =>
      phases("柱影", w.challenge.eclipsePhases) +
      ` · ${Math.min(0.8, Math.max(0, ...Object.values(boss?.eclipse?.shadow ?? {}))).toFixed(1)}/0.8秒`,
    action: ({ w, hazard: h }) => {
      const f = h?.eclipse?.sweeps.find((f) => !f.cancelled && f.end > w.time);
      return f
        ? `旋光${h!.eclipse!.order} · ${w.time < f.due ? `${(f.due - w.time).toFixed(1)}秒后启动` : "旋转中"} · 柱后/内圈/端头换位`
        : "";
    },
  },
  15: {
    ...fixed(
      "空中/投影无伤 · 仅落地短冲击 · 驻丸回跳另有预警",
      "空中丸/投影无伤 · 看下一落点编号与倒计时",
      threePhase,
    ),
    progress: ({ w, boss }) =>
      phases("踏空", w.challenge.leadPhases) +
      (boss?.lead?.earned ? " · 待落地收束确认" : ""),
    action: ({ w, boss }) =>
      boss
        ? w.hazards
            .filter(
              (h) =>
                h.source === boss.id &&
                h.lead &&
                !h.lead.cancelled &&
                h.until > w.time,
            )
            .flatMap((h) =>
              h
                .lead!.legs.filter((f) => !f.cancelled && f.end > w.time)
                .map((f) => ({ f, order: h.lead!.order })),
            )
            .sort(
              (a, b) =>
                Number(a.f.due > w.time) - Number(b.f.due > w.time) ||
                a.f.due - b.f.due,
            )
            .slice(0, 2)
            .map(
              ({ f, order }) =>
                `丸${order}→点${f.index + 1} ${w.time < f.due ? `${(f.due - w.time).toFixed(1)}秒` : "冲击中"}`,
            )
            .join(" · ")
        : "",
  },
  16: {
    ...fixed(
      "旧痕再震前有完整预警 · 墓台不挡骨震 · 裂棺后更换招式",
      "旧址不追踪 · 每次回响完整预警 · 墓台不挡骨震",
    ),
    phase: (e) =>
      e.grave?.deadUntil ? "裂棺复生" : "余命" + (e.grave?.life === 1 ? 2 : 1),
    bossTitle: (e) => (e.grave?.life === 1 ? "负棺镇墓者" : "裂棺猎骸"),
    progress: ({ w }) =>
      `断棺 A${w.challenge.graveGroups.has("1A") ? "✓" : "·"} B${w.challenge.graveGroups.has("1B") ? "✓" : "·"} 双址${w.challenge.graveGroups.has("2B") ? "✓" : "·"}`,
    action: ({ w, boss }) =>
      !boss
        ? ""
        : boss.grave?.deadUntil
          ? `裂棺复生 · ${Math.max(0, boss.grave.deadUntil - w.time).toFixed(1)}秒 · 第二命倒下才通关`
          : w.hazards
              .filter((h) => h.source === boss.id && h.grave)
              .flatMap((h) =>
                h
                  .grave!.pulses.filter((f) => !f.cancelled && f.end > w.time)
                  .map(
                    (f, i) =>
                      `${f.old ? "旧址" : "本体"}${h.grave!.order}-${i + 1} ${w.time < f.due ? (f.due - w.time).toFixed(1) + "秒" : "骨震中"}`,
                  ),
              )
              .slice(0, 2)
              .join(" · "),
  },
};
export function stageHud(w: SurvivalWorld, boss?: Enemy, hazard?: Hazard) {
  const p = providers[w.stageId],
    context = { w, boss, hazard };
  return {
    hint: p.hint?.(w),
    advice: p.advice(context),
    progress: p.progress?.(context) ?? "",
    action: p.action?.(context) ?? "",
    bossLabel: boss
      ? `${p.bossTitle?.(boss) ?? STAGES[w.stageId].boss} · ${p.phase(boss)} · ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`
      : "",
  };
}
