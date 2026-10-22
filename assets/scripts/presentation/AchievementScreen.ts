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
) {
  const screen = OPENER_PATH_SCREENS[id];
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
      x,
      y,
      22,
      n >= screen.required ? "#a8d7c7" : "#e7dcc7",
      460,
    );
  });
  h.text(h.overlay, screen.hint, 0, -200, 17, "#b9c8d5", 1060);
  button("返回成就", 0, -260, 260, 44, back);
}
