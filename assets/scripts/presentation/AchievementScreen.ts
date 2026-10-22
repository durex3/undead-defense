import {GATE_OPENERS} from "../battle/TwingateChallenge";
import {COUNTERBEAT_ROLES} from "../battle/CounterbeatChallenge";
import {TRACE_RECIPES} from "../battle/TraceChallenge";
import {MODS} from "../battle/ArmoryConfig";
import type { GameBootstrap } from "../GameBootstrap";
import { ACHIEVEMENTS } from "../battle/UnlockConfig";
import { ALL_WEAPONS, NAMES, Skill } from "../battle/SurvivalConfig";
import { drawAchievementBadge } from "./AchievementBadges";
type Host = ReturnType<GameBootstrap["menuContext"]>;
type CatalogButton = (
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
  action: () => void,
) => void;
export const OPENER_PATH_SCREENS = {
 twingate_twelve_orders:{title:"十二途分猎 · 先倒顺序",field:"duetOrders",required:2,hint:"起手8级双改 · 双体和独猎反击 · 全Boss无伤"},
 counterbeat_mastery:{title:"六律拆奏 · 职责认证",field:"counterbeatMastery",required:2,hint:"每类两种起手 · 完整错拍反击与全Boss无伤"},
 trace_twelve_paths:{title:"十二途逆痕 · 顺逆配方进度",field:"traceQualified",required:10,hint:"每起手5组双改×左右两向 · 起手8级 · 四组机制反击与全Boss无伤"},
  eclipse_twelve_paths: {
    title: "十二途逐晖 · 起手进度",
    field: "eclipseQualified",
    required: 3,
    hint: "起手8级 · 每种起手需3组不同合法双改 · 三阶段柱影无伤通关",
  },
  lead_twelve_paths: {
    title: "十二途踏空 · 起手进度",
    field: "leadQualified",
    required: 4,
    hint: "起手8级 · 每种起手需4组不同合法双改 · 三阶段穿空无伤通关",
  },
  grave_twelve_paths: {
    title: "十二途断棺 · 起手进度",
    field: "graveQualified",
    required: 5,
    hint: "起手8级 · 每种起手需5组不同合法双改 · 负棺A/B、裂棺双址B反击并全Boss无伤",
  },
} as const;
export type OpenerPathId = keyof typeof OPENER_PATH_SCREENS;
interface AchievementActions {
  navigate(page: number, category?: string): void;
  paths(id: OpenerPathId): void;
  weapon(skill: Skill): void;
  back(): void;
}
/** Stateless achievement pages. Ownership, settlement, input and storage stay outside rendering. */
export function renderAchievements(
  h: Host,
  page: number,
  category: string,
  button: CatalogButton,
  actions: AchievementActions,
) {
  const list = ACHIEVEMENTS.filter((a) => a.category === category),
    pages = Math.max(1, Math.ceil(list.length / 3));
  page = Math.max(0, Math.min(pages - 1, page));
  ["通关记录", "机制挑战", "配装挑战"].forEach((name, i) =>
    button(
      (category === name ? "◆ " : "") + name,
      (i - 1) * 320,
      155,
      290,
      36,
      () => actions.navigate(0, name),
    ),
  );
  list.slice(page * 3, page * 3 + 3).forEach((a, i) => {
    const y = 80 - i * 100,
      done = h.progress.hasAchievement(a.id);
    h.panel(h.overlay, 0, y, 1060, 93, "#293443");
    h.text(
      h.overlay,
      a.name + (done ? " · 已完成" : " · 未完成"),
      -265,
      y + 29,
      21,
      done ? "#a8d7c7" : "#f3deac",
      500,
    );
    h.text(h.overlay, a.condition, 0, y, 15, "#d5dfdc", 1020);
    h.text(
      h.overlay,
      `奖励：${a.reward} · ${h.progress.achievementProgress(a.id)}`,
      0,
      y - 29,
      14,
      "#b9c8d5",
      1020,
    );
    if (a.id in OPENER_PATH_SCREENS)
      button("起手进度", 300, y + 29, 170, 29, () =>
        actions.paths(a.id as OpenerPathId),
      );
    if (done) drawAchievementBadge(h, a.id, y);
    const weapon = a.weapon;
    if (weapon)
      button("查看奖励武器", 345, y + 29, 260, 29, () =>
        actions.weapon(weapon),
      );
  });
  h.text(h.overlay, `${page + 1}/${pages}`, 0, -185, 17);
  button("上一页", -300, -185, 180, 34, () => actions.navigate(page - 1));
  button("下一页", 300, -185, 180, 34, () => actions.navigate(page + 1));
  button("返回菜单", 0, -245, 280, 44, () => actions.back());
  return page;
}
export function renderOpenerProgress(
  h: Host,
  id: OpenerPathId,
  button: CatalogButton,
  back: () => void,
  detail?:Skill,
  showDetail?:(skill?:Skill)=>void,
) {
  if(id==="twingate_twelve_orders"){
    GATE_OPENERS.forEach((skill,i)=>{const x=i<7?-265:265,y=160-(i%7)*48,keys=h.progress.data.duetOrders?.[skill]??[];h.text(h.overlay,NAMES[skill],x,y,20,'#e7dcc7',450);h.text(h.overlay,`逐先 ${keys.includes('hunter_first')?'✓':'·'}  镇先 ${keys.includes('warden_first')?'✓':'·'}`,x,y-20,15,'#b5d8cb',450);});h.text(h.overlay,'每起手两种先倒顺序 · 同帧双杀正常通关但不记顺序认证',0,-215,17,'#bdcbd6',1060);button('返回成就',0,-270,260,40,back);return;
  }
  if(id==="counterbeat_mastery"){
    const keys=h.progress.data.counterbeatMastery??[];
    COUNTERBEAT_ROLES.forEach((r,i)=>{const y=155-i*62,n=r.skills.filter(s=>keys.includes(s)).length;h.text(h.overlay,`${r.name}  ${Math.min(2,n)}/2`,0,y,23,n>=2?'#a8d7c7':'#e7dcc7',1000);h.text(h.overlay,r.skills.map(s=>NAMES[s]+(keys.includes(s)?' ✓':' ·')).join('    '),0,y-27,17,'#c4d4d9',1060);});
    h.text(h.overlay,'起手8级双改 · 双精英错拍反击 · Boss A/B/C各两组反击且无伤',0,-222,16,'#bdcbd6',1060);button('返回成就',0,-270,260,40,back);return;
  }
  const screen = OPENER_PATH_SCREENS[id];
  if(id==="trace_twelve_paths"&&detail){
    h.text(h.overlay,NAMES[detail]+" · 左右辨迹",0,175,24);
    TRACE_RECIPES[detail].forEach((pair,i)=>{const y=115-i*60,keys=h.progress.data.traceQualified?.[detail]??[];h.text(h.overlay,pair.split('+').map(mod=>MODS[detail].find(m=>m.id===mod)?.name??mod).join(' + '),0,y,21,'#e7dcc7',1000);h.text(h.overlay,`左转 ${keys.includes(pair+'|left')?'✓':'·'}      右转 ${keys.includes(pair+'|right')?'✓':'·'}`,0,y-25,17,'#b8d8ca',900);});
    h.text(h.overlay,"方向绑定第二命首次合格循痕A；同局仅记一格",0,-225,16,'#bbc9d6',1000);button('返回起手列表',0,-270,290,40,()=>showDetail?.());return;
  }

  ALL_WEAPONS.forEach((skill, i) => {
    const x = i < 7 ? -260 : 260,
      y = 160 - (i % 7) * 48,
      n = Math.min(
        screen.required,
        h.progress.data[screen.field]?.[skill]?.length ?? 0,
      );
    h.text(
      h.overlay,
      `${NAMES[skill]}  ${n}/${screen.required}`,
      id==="trace_twelve_paths"?x-45:x,
      y,
      id==="trace_twelve_paths"?19:22,
      n >= screen.required ? "#a8d7c7" : "#e7dcc7",
      460,
    );
    if(id==="trace_twelve_paths")button("配方",x+170,y,85,30,()=>showDetail?.(skill));
  });
  h.text(h.overlay, screen.hint, 0, -200, 17, "#b9c8d5", 1060);
  button("返回成就", 0, -260, 260, 44, back);
}
