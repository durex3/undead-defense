import {loomState} from "../battle/LoomGeometry";
import { moonHint } from "../battle/MoonSystem";
import { thunderHint } from "../battle/ThunderSystem";
import { mapRouteHint } from "../battle/MapEncounters";
import { sandHint } from "../battle/SandSystem";
import { siegeHint } from "../battle/SiegeSystem";
import { combatWeaponEntries } from "../battle/WeaponStatus";
import { bossTimeForStage } from "../battle/EncounterPacing";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import {
  WEAPONS as SKILLS,
  isElite,
  NAMES as names,
} from "../battle/SurvivalConfig";
import { STAGES } from "../battle/StageRules";
import { bossExposed } from "../battle/BossSystem";
import { encounterBeat } from "../battle/EncounterPacing";

export function clock(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
/** Pure HUD content, independent of Cocos nodes and input handling. */
export function battleHud(
  w: SurvivalWorld,
  touchMode: boolean,
  visiblePotions: readonly { x: number; y: number }[],
) {
  const bossTime = bossTimeForStage(w.stageId);
  const stats = `Lv.${w.level}                 ${w.time >= bossTime ? "首领战 " + clock(w.time - bossTime) : clock(w.time) + " / " + clock(bossTime)}                 击败 ${w.kills}                 生命 ${Math.ceil(w.hp)}`;
  const entries = combatWeaponEntries(w);
  const weapons = entries
    .map((entry, i) => entry + (i % 3 === 2 ? "\n" : "    "))
    .join("")
    .trim();
  const boss = w.enemies.find((e) => e.kind === "boss" && (e.hp > 0 || w.stageStrategy.lifecycle?.keep(e)));
  const lateHazard = w.hazards.find((h) => h.damageLabel);
  const bossHazard = boss && w.hazards.filter(h => h.source === boss.id && h.created <= w.time && h.until > w.time && !h.lead?.cancelled && !h.eclipse?.cancelled && !h.edge?.cancelled && !h.kiln?.cancelled && !h.loom?.cancelled && !h.library?.cancelled && !h.wind?.cancelled)
    .sort((a,b) => Number(a.due <= w.time)-Number(b.due <= w.time) || a.due-b.due)[0];
  const bossAdvice: Record<number,string> = {
    16:"旧址不追踪 · 每次回响完整预警 · 墓台不挡骨震",
    15:"空中丸/投影无伤 · 看下一落点编号与倒计时",
    14:"看箭头转向 · 石柱截光 · 内圈与光束末端可绕",
    13:bossHazard?.edge?`来源${bossHazard.edge.order} · ${bossHazard.edge.shape==="body"?"本体换步，侧移避开":"看落刀回收箭头，停驻刀无伤"}`:"回收后抓本体空门",
    12:bossHazard?.kiln?`走焰${bossHazard.kiln.order} · ${w.time<bossHazard.due?"看实线箭头，虚线无伤":"绕开火头，尾过安全"}`:"靠近导火栓可引导自动攻击",
    11:bossHazard?.loom?`织线${bossHazard.loom.order} · ${loomState(bossHazard,w.time)==="slack"?"松线可穿，留意第二拍":loomState(bossHazard,w.time)==="tight"?"紧线绕端，离开线体":"看端点与倒计时，准备换侧"}`:"紧线绕端，松弛换侧",
    1: bossHazard?.kind === "bellRing" ? "进入空心内圈或退出外圈" : bossHazard?.siegeCharge ? "横向离开冲锋通道" : "离开实心区域，留意下一击",
    2:"离开锁定区域，留意折返与连喷",3:"离开锁线，向电栅缺口移动",4:"躲开落点，留意回刃折返",
    5:"借钟台避声浪，离开蜡印",6:"绕过浪头，离开锚点",7:"避开完整折线，晶核可击碎",
    8:"空心可进，实心须出，绕藤端换侧",9:"顺风换位，横向避开曲羽",10:"踩配对封签撤招，绕开页刃",
  };
  const shadowTimer=Math.max(0,...Object.values(boss?.eclipse?.shadow??{}));
  const leadPending=!!boss?.lead?.earned;
  const loomProgress=w.stageId===16?`断棺 A${w.challenge.graveGroups.has("1A")?"✓":"·"} B${w.challenge.graveGroups.has("1B")?"✓":"·"} 双址${w.challenge.graveGroups.has("2B")?"✓":"·"}`:w.stageId===15?`踏空 I${w.challenge.leadPhases.has(1)?"✓":"·"} II${w.challenge.leadPhases.has(2)?"✓":"·"} III${w.challenge.leadPhases.has(3)?"✓":"·"}${leadPending?" · 待落地收束确认":""}`:w.stageId===14?`柱影 I${w.challenge.eclipsePhases.has(1)?"✓":"·"} II${w.challenge.eclipsePhases.has(2)?"✓":"·"} III${w.challenge.eclipsePhases.has(3)?"✓":"·"} · ${Math.min(.8,shadowTimer).toFixed(1)}/0.8秒`:w.stageId===13?`交棒反击 I${w.challenge.edgePhases.has(1)?"✓":"·"} II${w.challenge.edgePhases.has(2)?"✓":"·"} III${w.challenge.edgePhases.has(3)?"✓":"·"}`:w.stageId===12?`分流前断源 I${w.challenge.kilnPhases.has(1)?"✓":"·"} II${w.challenge.kilnPhases.has(2)?"✓":"·"} III${w.challenge.kilnPhases.has(3)?"✓":"·"}`:w.stageId===11?`松线双穿 I${w.challenge.loomPhases.has(1)?"✓":"·"} II${w.challenge.loomPhases.has(2)?"✓":"·"} III${w.challenge.loomPhases.has(3)?"✓":"·"}`:"";
  const hint = w.stageId === 16 ? "旧痕再震前有完整预警 · 墓台不挡骨震 · 裂棺后更换招式" : w.stageId === 15 ? "空中/投影无伤 · 仅落地短冲击 · 驻丸回跳另有预警" : w.stageId === 14 ? "预警无伤 · 仅亮束有伤 · 借柱影换位或绕有限端头" : w.stageId === 13 ? "本体与落刀交棒 · 停驻刀/细线无伤 · 回收后反击" : w.stageId === 12 ? "虚线无伤 · 尾过安全 · 靠近导火栓可引导自动攻击" : w.stageId === 11 ? "紧线绕端 · 松弛可穿 · 看第二拍与移梭箭头" : w.stageId === 10 ? "踩签撤招 · 看配对编号 · 中缝可留，端头可绕" : w.stageId === 9 ? "借风换位 · 曲羽不追踪 · 击破一名精英可减压" : w.stageId === 8 ? "绕端换侧 · 空心可进，实心须出 · 收招护皮开缝" : w.stageId === 7 ? "看完整折线 · 晶核可击碎 · 收招时甲缝暴露" : w.stageId === 6 ? "绕过浪头再切回 · 厚蜡甲可裂解 · 收舷时反击" : w.stageId === 5 ? "钟台挡声浪 · 蜡印需换位 · 收招甲缝可反击" : w.stageId === 4
    ? moonHint(w)
    : w.stageId === 3
      ? thunderHint(w)
      : lateHazard
        ? `${lateHazard.damageLabel} · 预警位置已锁定，横向离开`
        : boss
          ? `${STAGES[w.stageId].boss} · ${boss.bossPhase === 2 ? "狂怒" : "第一阶段"} · 生命 ${Math.ceil((boss.hp / boss.maxHp) * 100)}%  |  ${bossExposed(w, boss) ? "破绽！伤害 +25%" : boss.state === "windup" ? "蓄力中 · 准备躲避" : "留意预警，等待反击机会"}`
          : !w.hazards.length &&
              w.hp >= w.maxHp &&
              visiblePotions.some(
                (p) => Math.hypot(p.x - w.player.x, p.y - w.player.y) < 1.2,
              )
            ? "生命已满 · 药水可留待受伤后拾取"
            : w.time < 12
              ? touchMode
                ? "拖动移动 · 靠近绿色结晶升级 · 自动攻击"
                : "WASD移动 · 靠近绿色结晶升级 · 自动攻击"
              : w.time < 30 && w.weaponCount < 2
                ? "下一次升级可学习副武器 · 也可继续专修主武器"
                : w.stageId === 2
                  ? mapRouteHint(2, w.time)
                  : w.stageId === 1
                    ? siegeHint(w.time)
                    : encounterBeat(w.time).name;
  const nova =
    w.ultimate > 0
      ? `全收经验 ${Math.ceil(w.ultimate)}s`
      : touchMode
        ? "全收经验"
        : "全收经验 [空格]";
  const bossHealth = boss
    ? {
        ratio: Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp))),
        label: `${w.stageId===16?(boss.grave?.life===1?"负棺镇墓者":"裂棺猎骸"):STAGES[w.stageId].boss} · ${w.stageId===16?(boss.grave?.deadUntil?"裂棺复生":"余命"+(boss.grave?.life===1?2:1)):w.stageId>=10?["第一阶段 I","第二阶段 II","第三阶段 III"][boss.bossPhase-1]:boss.bossPhase >= 2 ? "狂怒" : "第一阶段"} · ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`,
      }
    : null;
  const edgeNext=bossHazard?.edge?.flights.find(f=>!f.cancelled&&f.end>w.time);
  const edgeHint=edgeNext?`${bossHazard!.edge!.shape==='body'?'本体换步':edgeNext.index?'落刀回收':'本体掷锋'} · ${w.time<edgeNext.due?`${(edgeNext.due-w.time).toFixed(1)}秒后启动`:'移动实体有伤'} · 停驻刀/细线无伤`:'';
  const beam=bossHazard?.eclipse?.sweeps.find(f=>!f.cancelled&&f.end>w.time);
  const beamHint=beam?`旋光${bossHazard!.eclipse!.order} · ${w.time<beam.due?`${(beam.due-w.time).toFixed(1)}秒后启动`:"旋转中"} · 柱后/内圈/端头换位`:"";
  const leadItems=boss?w.hazards.filter(h=>h.source===boss.id&&h.lead&&!h.lead.cancelled&&h.until>w.time).flatMap(h=>h.lead!.legs.filter(f=>!f.cancelled&&f.end>w.time).map(f=>({f,order:h.lead!.order}))).sort((a,b)=>Number(a.f.due>w.time)-Number(b.f.due>w.time)||a.f.due-b.f.due):[];
  const leadHint=leadItems.slice(0,2).map(({f,order})=>`丸${order}→点${f.index+1} ${w.time<f.due?`${(f.due-w.time).toFixed(1)}秒`:"冲击中"}`).join(" · ");
  const graveHint=w.stageId===16&&boss?(boss.grave?.deadUntil?`裂棺复生 · ${Math.max(0,boss.grave.deadUntil-w.time).toFixed(1)}秒 · 第二命倒下才通关`:w.hazards.filter(h=>h.source===boss.id&&h.grave).flatMap(h=>h.grave!.pulses.filter(f=>!f.cancelled&&f.end>w.time).map((f,i)=>`${f.old?'旧址':'本体'}${h.grave!.order}-${i+1} ${w.time<f.due?(f.due-w.time).toFixed(1)+'秒':'骨震中'}`)).slice(0,2).join(' · ')):'';
  const bossHint = graveHint?graveHint:leadHint?leadHint:beamHint?beamHint:edgeHint?edgeHint:bossHazard
    ? `${bossHazard.damageLabel || "首领技能"} · ${bossHazard.due > w.time ? `${(bossHazard.due-w.time).toFixed(1)}秒后释放` : "释放中"} · ${bossAdvice[w.stageId]}`
    : boss && bossExposed(w,boss) ? "破绽！伤害 +25% · 抓紧反击" : hint;
  return { stats, weapons, hint: loomProgress&&boss?bossHint+" · "+loomProgress:bossHint, nova, bossHealth };
}
