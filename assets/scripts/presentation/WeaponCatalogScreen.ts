import type { GameBootstrap } from "../GameBootstrap";
import { Graphics } from "cc";
import {
  ALL_WEAPONS as WEAPONS,
  Skill,
  WEAPON_ROLES,
  COLORS,
} from "../battle/SurvivalConfig";
import { MODS } from "../battle/ArmoryConfig";
import { HAMMER_PRICE } from "../battle/UnlockConfig";
import { LAMP_PRICE } from "../battle/SupportConfig";
import {
  gradeOf,
  weaponName,
  nextGrade,
  gradeMultiplier,
  GRADE_NAMES,
  GRADE_COLORS,
  GRADE_PRICE,
} from "../battle/WeaponGrade";
import { drawWeaponGlyph } from "./art/WeaponGlyph";
type Host = ReturnType<GameBootstrap["menuContext"]>;
type CatalogButton = (
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
  action: () => void,
) => void;
interface ListActions {
  navigate(page: number, filter?: string): void;
  detail(skill: Skill): void;
  upgrade(skill: Skill): void;
  back(): void;
}
interface DetailActions {
  back(): void;
  purchase(evolution?: boolean): void;
  achievements(): void;
}
/** Stateless catalog rendering. Navigation, focus and purchases stay in GameMenus. */
export function renderWeaponList(
  h: Host,
  page: number,
  filter: string,
  button: CatalogButton,
  actions: ListActions,
) {
  const list = WEAPONS.filter(
    (s) =>
      filter === "全部" ||
      (filter === "已解锁" && h.progress.unlockedWeapon(s)) ||
      (filter === "可升级" &&
        h.progress.unlockedWeapon(s) &&
        nextGrade(s, h.progress.weaponGrades) !== null) ||
      (filter === "金币购买" && (s === "hammer" || s === "lamp")) ||
      (filter === "成就解锁" && (s === "wheel" || s === "needle")),
  );
  const pages = Math.max(1, Math.ceil(list.length / 6));
  page = Math.max(0, Math.min(pages - 1, page));
  ["全部", "已解锁", "可升级", "金币购买", "成就解锁"].forEach((f, i) =>
    button((f === filter ? "◆ " : "") + f, (i - 2) * 210, 153, 195, 36, () =>
      actions.navigate(0, f),
    ),
  );
  list.slice(page * 6, page * 6 + 6).forEach((skill, i) => {
    const x = ((i % 3) - 1) * 360,
      y = 62 - Math.floor(i / 3) * 139,
      unlocked = h.progress.unlockedWeapon(skill);
    const target = unlocked ? nextGrade(skill, h.progress.weaponGrades) : null;
    h.panel(h.overlay, x, y, 338, 126, "#293443");
    const icon = h.make("WeaponGlyph", h.overlay);
    icon.setPosition(x - 135, y + 35);
    icon.setScale(0.7, 0.7, 1);
    drawWeaponGlyph(
      icon.addComponent(Graphics),
      skill,
      gradeOf(skill, h.progress.weaponGrades),
    );
    h.text(
      h.overlay,
      `${GRADE_NAMES[gradeOf(skill, h.progress.weaponGrades)]} · ${weaponName(skill, h.progress.weaponGrades)}`,
      x - 7,
      y + 35,
      20,
      GRADE_COLORS[gradeOf(skill, h.progress.weaponGrades)],
      230,
    );
    h.text(h.overlay, WEAPON_ROLES[skill], x, y + 4, 15, "#c4d4d2", 320);
    if (target)
      button("↑", x + 143, y + 38, 36, 32, () => {
        actions.upgrade(skill);
      });
    const status = unlocked
      ? target
        ? h.progress.coins >= GRADE_PRICE[target]
          ? `可升级 · ${GRADE_NAMES[target]} · ${GRADE_PRICE[target]}金币`
          : `还差${GRADE_PRICE[target] - h.progress.coins}金币 · 可升级`
        : gradeOf(skill, h.progress.weaponGrades) === 4
          ? "史诗 · 无需升级"
          : "已解锁 · 后续升级暂未开放"
      : skill === "hammer"
        ? `金币购买 · ${HAMMER_PRICE}金币`
        : skill === "lamp"
          ? `金币购买 · ${LAMP_PRICE}金币`
          : skill === "needle"
            ? "成就解锁 · 解签留路"
            : "成就解锁 · 破阵熟手";
    button(status, x, y - 34, 310, 34, () => actions.detail(skill));
  });
  if (!list.length)
    h.text(
      h.overlay,
      "暂无可升级武器 · 新路线开放后会在这里提示",
      0,
      0,
      22,
      "#c4d4d2",
      1050,
    );
  h.text(h.overlay, `${page + 1}/${pages}`, 0, -180, 17);
  button("上一页", -300, -185, 180, 36, () => actions.navigate(page - 1));
  button("下一页", 300, -185, 180, 36, () => actions.navigate(page + 1));
  button("返回菜单", 0, -245, 270, 44, () => actions.back());
  return page;
}
export function renderWeaponDetail(
  h: Host,
  skill: Skill,
  message: string,
  button: CatalogButton,
  actions: DetailActions,
) {
  h.text(h.overlay, WEAPON_ROLES[skill], 0, 154, 19, COLORS[skill], 1080);
  MODS[skill].forEach((m, i) => {
    const x = i % 2 ? 280 : -280,
      y = 72 - Math.floor(i / 2) * 130;
    h.panel(h.overlay, x, y, 535, 116, "#293443");
    h.text(
      h.overlay,
      `${i + 1} · ${m.name}${m.excludes ? "（与另一主形态互斥）" : ""}`,
      x,
      y + 33,
      19,
      "#f0dab1",
      510,
    );
    h.text(h.overlay, m.effect, x, y + 1, 16, "#d5dfdc", 510);
    h.text(h.overlay, "代价：" + m.cost, x, y - 34, 14, "#adbccc", 510);
  });
  const unlocked = h.progress.unlockedWeapon(skill);
  h.text(
    h.overlay,
    message ||
      (unlocked
        ? "已解锁 · 开局与升级随机获取"
        : skill === "hammer"
          ? `购买${HAMMER_PRICE}金币，当前余额${h.progress.coins}`
          : skill === "lamp"
            ? `购买${LAMP_PRICE}金币，当前余额${h.progress.coins}`
            : `完成「${skill === "needle" ? "解签留路" : "破阵熟手"}」解锁，不额外收金币`),
    0,
    -150,
    17,
    "#e8cc92",
    1060,
  );
  h.text(
    h.overlay,
    "1～8级成长 · 4/8级各选一次改造 · 最多两项 · 互斥项不能共选",
    0,
    -185,
    15,
    "#adbccc",
    1080,
  );
  button("返回图鉴", -230, -245, 280, 44, () => actions.back());
  if (!unlocked && (skill === "hammer" || skill === "lamp")) {
    const price = skill === "hammer" ? HAMMER_PRICE : LAMP_PRICE;
    button(
      h.progress.coins >= price
        ? "购买武器"
        : `还差${price - h.progress.coins}金币`,
      230,
      -245,
      320,
      44,
      () => {
        if (h.progress.coins >= price) actions.purchase();
      },
    );
  } else if (!unlocked)
    button("查看解锁成就", 230, -245, 320, 44, () => actions.achievements());
  else {
    const target = nextGrade(skill, h.progress.weaponGrades);
    if (target)
      button(
        `进阶${GRADE_NAMES[target]} · ${GRADE_PRICE[target]}金币`,
        230,
        -245,
        320,
        44,
        () => actions.purchase(true),
      );
    else
      h.text(
        h.overlay,
        gradeOf(skill, h.progress.weaponGrades) === 4
          ? "史诗 · 无需进阶"
          : "后续进阶暂未开放",
        230,
        -242,
        18,
        "#c8b1e3",
        320,
      );
  }
}
export function renderWeaponPurchase(
  h: Host,
  skill: Skill,
  current: ReturnType<typeof gradeOf>,
  target: ReturnType<typeof gradeOf>,
  evolution: boolean,
  price: number,
) {
  const grades = h.progress.weaponGrades,
    future = { ...grades, [skill]: target };
  for (const [i, g] of [current, target].entries()) {
    const x = i ? 250 : -250;
    h.panel(h.overlay, x, 72, 420, 174, "#293443");
    const icon = h.make("FormPreview", h.overlay);
    icon.setPosition(x, 104);
    icon.setScale(1.5, 1.5, 1);
    drawWeaponGlyph(icon.addComponent(Graphics), skill, g);
    h.text(
      h.overlay,
      `${GRADE_NAMES[g]} · ${weaponName(skill, { ...grades, [skill]: g })}`,
      x,
      37,
      23,
      GRADE_COLORS[g],
      400,
    );
    h.text(
      h.overlay,
      i
        ? evolution
          ? "下一局使用新形态与特效"
          : "永久解锁此系列"
        : evolution
          ? "当前形态"
          : "获取方式：金币购买",
      x,
      2,
      16,
      "#c7d4da",
      400,
    );
  }
  h.text(
    h.overlay,
    evolution
      ? `同等级伤害 ×${(gradeMultiplier(skill, future) / gradeMultiplier(skill, grades)).toFixed(2)} · 保留攻击方式与改造`
      : `${WEAPON_ROLES[skill]} · 无成就附加门槛`,
    0,
    -60,
    20,
    "#e8d2a7",
    1080,
  );
  h.text(
    h.overlay,
    `花费 ${price}金币 · 余额 ${h.progress.coins} → ${h.progress.coins - price}`,
    0,
    -109,
    21,
    "#e9d2ad",
    1080,
  );
}
