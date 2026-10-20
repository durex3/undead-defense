import { LAMP_PRICE } from "../battle/SupportConfig";
import { gradeOf, weaponName, nextGrade, gradeMultiplier, GRADE_NAMES, GRADE_COLORS, GRADE_PRICE } from "../battle/WeaponGrade";
import { drawWeaponGlyph } from "./art/WeaponGlyph";
import {
  ACHIEVEMENTS,
  HAMMER_PRICE,
  CLEAR_COINS,
} from "../battle/UnlockConfig";
import {
  weaponDetails,
  upgradeChanges,
  combatWeaponEntries,
} from "../battle/WeaponStatus";
import {
  MODS,
  modInfo,
  modReason,
  modSummary,
  stageBuildHint,
  playerAttributes,
  passiveValue,
} from "../battle/ArmoryConfig";
import { STAGES, STAGE_GUIDES } from "../battle/StageRules";
import { PLAY_VERSION, setupWechatShare } from "../platform/PlayPreferences";
import {
  CHARACTERS,
  STAGE_IDS,
  stageNumber,
  CharacterId,
  StageId,
} from "../battle/ProgressionConfig";
import { battleReport } from "../battle/BattleReport";
import { KeyCode, Graphics } from "cc";
import {
  ALL_WEAPONS as WEAPONS,
  PASSIVES,
  Card,
  Skill,
  Passive,
  NAMES,
  COLORS,
  WEAPON_ROLES,
} from "../battle/SurvivalConfig";
import type { GameBootstrap } from "../GameBootstrap";
export class GameMenus {
  private catalog: "weapons" | "achievements" | "detail" | "purchase" | null =
    null;
  private catalogPage = 0;
  private catalogFocus = 0;
  private catalogActions: (() => void)[] = [];
  private catalogReturn: "weapons" | "achievements" = "weapons";
  private catalogFilter = "全部";
  private catalogSkill: Skill = "blade";
  private catalogMessage = "";
  private achievementPage = 0;
  private achievementCategory = "通关记录";
  private detailSkill: Skill | null = null;
  private stagePreview: StageId | null = null;
  constructor(private host: ReturnType<GameBootstrap["menuContext"]>) {}
  handleTargetKey(code: number) {
    if (this.catalog) {
      if (code === KeyCode.ESCAPE) {
        if (this.catalog === "purchase")
          this.showWeaponDetail(this.catalogSkill);
        else if (this.catalog === "detail") this.returnCatalog();
        else this.showStart();
      } else if (code === KeyCode.ENTER || code === KeyCode.SPACE)
        this.catalogActions[this.catalogFocus]?.();
      else if (
        [
          KeyCode.ARROW_LEFT,
          KeyCode.ARROW_UP,
          KeyCode.ARROW_RIGHT,
          KeyCode.ARROW_DOWN,
        ].includes(code)
      ) {
        const n = this.catalogActions.length;
        this.catalogFocus =
          (this.catalogFocus +
            ([KeyCode.ARROW_LEFT, KeyCode.ARROW_UP].includes(code)
              ? n - 1
              : 1)) %
          Math.max(1, n);
        const route = this.catalog;
        if (route === "weapons") this.showWeapons();
        else if (route === "achievements") this.showAchievements();
        else if (route === "detail") this.showWeaponDetail(this.catalogSkill);
        else this.confirmWeaponPurchase();
      }
      return true;
    }
    if (this.detailSkill) {
      if (code === KeyCode.ESCAPE) {
        this.detailSkill = null;
        this.host.shown = "";
        this.host.menus();
      }
      return true;
    }
    if (this.stagePreview !== null && !this.host.started) {
      if (code === KeyCode.ESCAPE) this.host.showStart();
      else if (
        code === KeyCode.ENTER &&
        this.host.progress.unlockedStage(this.stagePreview)
      ) {
        this.host.selectedStage = this.stagePreview;
        this.host.showStart();
      }
      return true;
    }
    return false;
  }
  private redraw() {
    this.host.shown = "";
    this.menus();
  }
  private inventory() {
    const h = this.host,
      w = h.world;
    const equipped = WEAPONS.filter((s) => w.skills[s]);
    equipped.forEach((s, i) => {
      const x = ((i % 3) - 1) * 350,
        y = 164 - Math.floor(i / 3) * 56;
      h.panel(h.overlay, x, y, 330, 50, "#25323e");
      h.text(
        h.overlay,
        w.skills[s] ? `${weaponName(s,w.weaponGrades)} ${w.skills[s]}/8级` : `${weaponName(s,w.weaponGrades)} · 未持有`,
        x,
        y + 10,
        17,
        w.skills[s] ? COLORS[s] : "#85929e",
        316,
      );
      h.text(
        h.overlay,
        w.skills[s] ? modSummary(w, s) : "可从升级中学习",
        x,
        y - 12,
        14,
        "#b9c8d5",
        316,
      );
    });
    const ps = PASSIVES.filter((p) => w.passives[p]);
    h.text(
      h.overlay,
      `被动 ${ps.length}/4：` +
        (ps.map((p) => `${NAMES[p]} ${w.passives[p]}级`).join(" · ") || "暂无"),
      0,
      64,
      15,
      "#a9cdbc",
      1050,
    );
  }
  menus() {
    const h = this.host,
      w = h.world;
    if (h.confirmation) return;
    if (!w.pauses.has("menu")) this.detailSkill = null;
    if (w.state === "won" && !h.victorySeen) {
      h.victorySeen = true;
      h.victoryTime = 2.2;
      h.sound("choose");
    }
    const state =
      (h.victoryTime > 0 ? "victory" : w.state) +
      (w.pauses.has("menu") ? "paused" : "") +
      (this.detailSkill || "");
    if (state === h.shown) return;
    h.shown = state;
    h.overlay.destroyAllChildren();
    if (state === "battle") return;
    h.clearInput();
    h.panel(h.overlay, 0, 0, 1180, 570, "#151b29");
    if (w.state === "starting") {
      h.text(h.overlay, "选择初始武器", 0, 218, 34);
      h.text(h.overlay, stageBuildHint(w.stageId), 0, 164, 17, "#a9cdbc", 1050);
      w.startingWeapons.forEach((s, i) => {
        const x = (i - 1) * 350;
        h.panel(h.overlay, x, 0, 326, 235, "#293443");
        h.text(h.overlay, weaponName(s,w.weaponGrades), x, 72, 28, COLORS[s]);
        h.text(h.overlay, WEAPON_ROLES[s], x, 17, 18, "#d1dbe2", 300);
        h.text(
          h.overlay,
          "4级、8级各选择一次形态改造",
          x,
          -45,
          17,
          "#e8cc92",
          300,
        );
        h.button(h.overlay, `${i + 1} · 选择`, x, -155, 280, 48, () => {
          w.chooseStartingWeapon(s);
          this.redraw();
        });
      });
      h.button(h.overlay, "返回选关", 0, -243, 280, 44, () => h.showStart());
      return;
    }
    if (h.victoryTime > 0) {
      h.text(h.overlay, "首领已击败 · 通关成功", 0, 65, 40, "#e8cc92");
      h.text(h.overlay, "正在整理战斗报告…", 0, -40, 22);
      return;
    }
    if (w.pauses.has("menu")) {
      this.pause();
      return;
    }
    if (w.state === "tactical") {
      h.text(h.overlay, "精英战利 · 选择一项战术祝福", 0, 210, 30, "#e8cc92");
      h.text(
        h.overlay,
        "精英击破后暂停选择；效果持续到本局结束",
        0,
        170,
        17,
        "#b9c8d5",
        900,
      );
      w.tacticalChoices.forEach((choice, i) => {
        const x = (i - (w.tacticalChoices.length - 1) / 2) * 350;
        h.panel(h.overlay, x, 0, 320, 220, "#293a47");
        h.text(
          h.overlay,
          `${i + 1} · ${choice.name}`,
          x,
          55,
          24,
          "#e8cc92",
          295,
        );
        h.text(h.overlay, choice.effect, x, -5, 18, "#d5e0e5", 280);
        h.button(h.overlay, "选择祝福", x, -72, 270, 42, () => {
          h.clearInput();
          w.chooseTacticalBlessing(choice.id);
          this.redraw();
        });
      });
      return;
    }
    if (w.state === "modification" && w.pendingModification) {
      const s = w.pendingModification,
        options = w.modOptions();
      h.text(
        h.overlay,
        `${weaponName(s,w.weaponGrades)} · 选择第${w.mods[s].length + 1}次改造`,
        0,
        235,
        30,
        COLORS[s],
      );
      h.text(
        h.overlay,
        `当前 ${w.skills[s]}级 · ${modSummary(w, s)} · 免费安装，不重置攻击冷却`,
        0,
        190,
        16,
        "#b9c8d5",
        1050,
      );
      options.forEach((m, i) => {
        const x = ((i % 2) - 0.5) * 540,
          y = 75 - Math.floor(i / 2) * 190,
          reason = modReason(w, s, m.id);
        h.panel(h.overlay, x, y, 515, 174, reason ? "#252a34" : "#293a47");
        h.text(
          h.overlay,
          `${i + 1}  ${m.glyph} ${m.name}`,
          x,
          y + 57,
          24,
          reason ? "#85909d" : COLORS[s],
          490,
        );
        h.text(h.overlay, m.effect, x, y + 17, 18, "#d5e0e5", 485);
        h.text(h.overlay, `代价：${m.cost}`, x, y - 22, 15, "#e4b497", 485);
        h.button(h.overlay, reason || "安装改造", x, y - 62, 460, 34, () => {
          if (!reason) h.chooseMod(m.id);
        });
      });
      h.text(
        h.overlay,
        "每把武器最多2个改造 · 灰色选项互斥 · 已安装改造不会重复出现",
        0,
        -255,
        15,
        "#a9b7c3",
        1050,
      );
      return;
    }
    if (w.state === "upgrade") {
      h.text(h.overlay, `等级 ${w.level} · 选择成长`, 0, 235, 30);
      this.inventory();
      w.cards.forEach((c, i) => {
        const x = (i - (w.cards.length - 1) / 2) * 350,
          skill = WEAPONS.includes(c as Skill),
          lv = skill
            ? w.skills[c as Skill]
            : PASSIVES.includes(c as Passive)
              ? w.passives[c as Passive]
              : 0;
        h.panel(h.overlay, x, -80, 330, 260, "#293443");
        h.text(h.overlay, `${i + 1}  ${WEAPONS.includes(c as Skill)?weaponName(c as Skill,w.weaponGrades):NAMES[c]}`, x, 25, 26, COLORS[c], 310);
        h.text(
          h.overlay,
          skill
            ? `${lv ? "强化" : "新武器"} · ${lv} → ${lv + 1}级`
            : "通用成长",
          x,
          -7,
          17,
          "#e8cc92",
          306,
        );
        h.text(h.overlay, upgradeChanges(w, c), x, -70, 20, "#d5e0e5", 306);
        h.button(h.overlay, "选择", x, -177, 288, 40, () => h.choose(c));
      });
      h.button(h.overlay, `重抽（${w.refreshes}）`, 0, -251, 250, 40, () => {
        w.refresh();
        this.redraw();
      });
      return;
    }
    if (w.state === "won" || w.state === "lost") {
      const r = battleReport(w);
      h.text(
        h.overlay,
        w.state === "won" ? "通关成功 · 首领已击败" : "挑战失败 · 战斗报告",
        0,
        225,
        32,
      );
      h.text(
        h.overlay,
        `存活 ${h.clock(w.time)} · 击败 ${w.kills} · 等级 ${w.level} · 总伤害 ${Math.round(r.total)}`,
        0,
        178,
        21,
      );
      h.text(
        h.overlay,
        "武器 / 改造                                        有效伤害 / 占比                击杀",
        0,
        128,
        18,
        "#adbccc",
        1000,
      );
      r.rows.forEach((row, i) => {
        const y = 82 - i * 34;
        h.panel(h.overlay, 0, y, 1020, 30, "#26323f");
        h.text(
          h.overlay,
          `${row.name} ${w.skills[row.skill]}级 · ${modSummary(w, row.skill)}`,
          -260,
          y,
          17,
          COLORS[row.skill],
          480,
        );
        h.text(
          h.overlay,
          `${Math.round(row.damage)} · ${(row.share * 100).toFixed(1)}%`,
          170,
          y,
          19,
          "#f4e8d3",
          260,
        );
        h.text(h.overlay, `${row.kills}`, 430, y, 20);
      });
      h.text(
        h.overlay,
        r.losses.length
          ? "主要受伤：" +
              r.losses
                .slice(0, 3)
                .map((l) => `${l.name} ${Math.round(l.damage)}`)
                .join(" / ")
          : "本局未受到伤害",
        0,
        -115,
        18,
        "#edb5ad",
        1050,
      );
      h.text(h.overlay, r.retryTip, 0, -144, 16, "#a9cdbc", 1050);
      h.text(
        h.overlay,
        `本次账户金币 +${w.state === "won" ? CLEAR_COINS[w.stageId] : 0} · 账户余额 ${h.progress.coins}`,
        0,
        -174,
        16,
        "#e8cc92",
        1050,
      );
      h.text(
        h.overlay,
        h.runUnlocks.length
          ? "新解锁：" + h.runUnlocks.join(" / ")
          : h.progress.pending
            ? "进度保存待重试"
            : "本局进度已保存",
        0,
        -204,
        17,
        "#e8cc92",
      );
      h.button(h.overlay, "再战一局", -190, -252, 300, 48, () => h.restart());
      h.button(h.overlay, "返回选关页面", 190, -252, 300, 48, () =>
        h.showStart(),
      );
    }
  }
  private pause() {
    const h = this.host,
      w = h.world;
    h.muteButton(445, 235, false);
    if (this.detailSkill) {
      const s = this.detailSkill;
      h.text(
        h.overlay,
        `${weaponName(s,w.weaponGrades)} · ${w.skills[s]}级`,
        0,
        197,
        30,
        COLORS[s],
      );
      h.text(h.overlay, weaponDetails(w, s), 0, -2, 19, "#d5e0e5", 1050);
      h.button(h.overlay, "返回暂停", 0, -250, 300, 42, () => {
        this.detailSkill = null;
        this.redraw();
      });
      return;
    }
    h.text(h.overlay, "已暂停", 0, 190, 34);
    h.text(
      h.overlay,
      "点击武器查看形态、效果与改造代价",
      -235,
      135,
      17,
      "#a9b9c5",
      560,
    );
    WEAPONS.filter((s) => w.skills[s]).forEach((s, i) =>
      h.button(
        h.overlay,
        `${weaponName(s,w.weaponGrades)} ${w.skills[s]}/8级 · ${modSummary(w, s)}`,
        -235,
        92 - i * 34,
        555,
        30,
        () => {
          this.detailSkill = s;
          this.redraw();
        },
      ),
    );
    const a = playerAttributes(w);
    h.text(
      h.overlay,
      PASSIVES.filter((p) => w.passives[p])
        .map(
          (p) =>
            `${NAMES[p]} ${w.passives[p]}级：${passiveValue(p, w.passives[p])}`,
        )
        .join("\n") || "暂无被动",
      -235,
      -166,
      16,
      "#a9cdbc",
      550,
    );
    h.text(
      h.overlay,
      `总伤害 +${Math.round(a.damage * 100)}% · 冷却 −${Math.round(a.cooldown * 100)}%\n范围 +${Math.round((a.area - 1) * 100)}% · 持续 +${Math.round((a.duration - 1) * 100)}%`,
      280,
      -125,
      17,
      "#e8cc92",
      400,
    );
    h.button(h.overlay, "继续冒险", 280, 92, 340, 48, () => h.togglePause());
    h.button(h.overlay, "重新开始", 280, 25, 340, 48, () =>
      h.confirmAbandon("restart"),
    );
    h.button(h.overlay, "返回选关页面", 280, -42, 340, 48, () =>
      h.confirmAbandon("selection"),
    );
    h.text(h.overlay, stageBuildHint(w.stageId), 0, -252, 16, "#a9b9c5", 1080);
  }
  showStart() {
    this.catalog = null;
    this.stagePreview = null;
    this.host.confirmation = null;
    setupWechatShare();
    this.host.started = false;
    this.host.clearInput();
    this.host.progress.flush();
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay, 0, 0, 1100, 570, "#191e2d");
    this.host.text(this.host.overlay, "余烬幸存者 · 选择冒险", 0, 220, 34);
    this.host.text(this.host.overlay, PLAY_VERSION, 0, 265, 14, "#adbccc");
    this.host.muteButton(425, 225, true);
    this.host.text(
      this.host.overlay,
      "十二武器 · 十把默认开放 · 金币与成就各解锁一把",
      0,
      174,
      20,
      "#b9c8d5",
    );
    (Object.keys(CHARACTERS) as CharacterId[]).forEach((id, i) => {
      const c = CHARACTERS[id],
        x = (i - 1) * 340,
        unlocked = this.host.progress.unlockedCharacter(id);
      this.host.panel(
        this.host.overlay,
        x,
        45,
        315,
        185,
        this.host.selectedCharacter === id ? "#374a55" : "#252f3c",
      );
      this.host.text(
        this.host.overlay,
        c.name,
        x,
        102,
        25,
        unlocked ? "#f3d798" : "#9ba5b1",
        290,
      );
      this.host.text(
        this.host.overlay,
        unlocked
          ? c.description.replace(" · ", "\n")
          : `通关第${stageNumber(c.stage as StageId)}关解锁\n${STAGES[c.stage as StageId]?.name || ""}`,
        x,
        46,
        18,
        "#c4cdd7",
        295,
      );
      this.host.button(
        this.host.overlay,
        unlocked
          ? this.host.selectedCharacter === id
            ? "已选择"
            : "选择角色"
          : "未解锁",
        x,
        -15,
        278,
        42,
        () => {
          if (unlocked) {
            this.host.selectedCharacter = id;
            this.host.showStart();
          }
        },
      );
    });
    this.host.text(
      this.host.overlay,
      `${stageNumber(this.host.selectedStage)} · ${STAGES[this.host.selectedStage].name}`,
      -175,
      -104,
      24,
      "#f3deac",
      620,
    );
    this.host.button(this.host.overlay, "选择关卡", 355, -104, 300, 48, () =>
      this.showStageSelect(),
    );
    const guide = STAGE_GUIDES[this.host.selectedStage];
    if (guide) {
      this.host.text(
        this.host.overlay,
        guide.threat,
        0,
        -158,
        16,
        "#e8cc92",
        1050,
      );
      this.host.text(
        this.host.overlay,
        stageBuildHint(this.host.selectedStage),
        0,
        -185,
        15,
        "#a9cdbc",
        1050,
      );
    }
    this.host.text(
      this.host.overlay,
      this.host.progress.pending
        ? "进度暂未保存，将自动重试"
        : this.host.touchMode
          ? "左侧拖动移动 · 右下角全收经验 · 6 分钟迎战首领 · 上限64级"
          : "WASD 移动 · 空格全收经验 · 6 分钟迎战首领 · 上限64级",
      0,
      guide ? -220 : -194,
      16,
      "#adbccc",
    );
    this.host.button(this.host.overlay, "武器图鉴", -370, -260, 235, 48, () =>
      this.showWeapons(),
    );
    this.host.button(this.host.overlay, "成就图鉴", 370, -260, 235, 48, () =>
      this.showAchievements(),
    );
    this.host.button(this.host.overlay, "开始冒险", 0, -260, 290, 50, () =>
      this.host.restart(),
    );
  }
  private catalogShell(title: string) {
    const h = this.host;
    this.catalogActions = [];
    h.started = false;
    h.clearInput();
    h.overlay.destroyAllChildren();
    h.panel(h.overlay, 0, 0, 1160, 570, "#191e2d");
    h.text(h.overlay, title, 0, 242, 30, "#f3deac");
    h.text(
      h.overlay,
      `账户金币 ${h.progress.coins} · 同系列只占一席 · 进阶从下一局生效`,
      0,
      201,
      16,
      "#b9c8d5",
      1080,
    );
  }
  private catalogButton(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    action: () => void,
  ) {
    const i = this.catalogActions.length;
    this.catalogActions.push(action);
    this.host.button(
      this.host.overlay,
      (i === this.catalogFocus && width >= 100 ? "▸ " : "") + label,
      x,
      y,
      width,
      height,
      () => {
        this.catalogFocus = i;
        action();
      },
    );
  }
  private returnCatalog() {
    if (this.catalogReturn === "achievements") this.showAchievements();
    else this.showWeapons();
  }
  showWeapons(page = this.catalogPage, filter = this.catalogFilter) {
    if (this.catalog !== "weapons") {
      this.catalogFocus = 0;
      this.catalogReturn = "weapons";
    }
    this.catalog = "weapons";
    this.catalogFilter = filter;
    this.catalogShell("武器图鉴");
    const h = this.host;
    const list = WEAPONS.filter(
      (s) =>
        filter === "全部" ||
        (filter === "已解锁" && h.progress.unlockedWeapon(s)) ||
        (filter === "可升级" && h.progress.unlockedWeapon(s) && nextGrade(s,h.progress.weaponGrades) !== null) ||
        (filter === "金币购买" && (s === "hammer" || s === "lamp")) ||
        (filter === "成就解锁" && (s === "wheel" || s === "needle")),
    );
    const pages = Math.max(1, Math.ceil(list.length / 6));
    this.catalogPage = Math.max(0, Math.min(pages - 1, page));
    ["全部", "已解锁", "可升级", "金币购买", "成就解锁"].forEach((f, i) =>
      this.catalogButton(
        (f === filter ? "◆ " : "") + f,
        (i - 2) * 210,
        153,
        195,
        36,
        () => this.showWeapons(0, f),
      ),
    );
    list
      .slice(this.catalogPage * 6, this.catalogPage * 6 + 6)
      .forEach((skill, i) => {
        const x = ((i % 3) - 1) * 360,
          y = 62 - Math.floor(i / 3) * 139,
          unlocked = h.progress.unlockedWeapon(skill);
        const target=unlocked?nextGrade(skill,h.progress.weaponGrades):null;
        h.panel(h.overlay, x, y, 338, 126, "#293443");
        const icon = h.make("WeaponGlyph", h.overlay);
        icon.setPosition(x - 135, y + 35);
        icon.setScale(0.7, 0.7, 1);
        drawWeaponGlyph(icon.addComponent(Graphics), skill, gradeOf(skill,h.progress.weaponGrades));
        h.text(h.overlay, `${GRADE_NAMES[gradeOf(skill,h.progress.weaponGrades)]} · ${weaponName(skill,h.progress.weaponGrades)}`, x-7, y+35, 20, GRADE_COLORS[gradeOf(skill,h.progress.weaponGrades)], 230);
        h.text(h.overlay, WEAPON_ROLES[skill], x, y + 4, 15, "#c4d4d2", 320);
        if(target) this.catalogButton("↑", x+143, y+38, 36, 32, () => {
          this.catalogSkill=skill;
          this.catalogReturn="weapons";
          this.confirmWeaponPurchase(true);
        });
        const status = unlocked
          ? target
            ? (h.progress.coins>=GRADE_PRICE[target]?`可升级 · ${GRADE_NAMES[target]} · ${GRADE_PRICE[target]}金币`:`还差${GRADE_PRICE[target]-h.progress.coins}金币 · 可升级`)
            : gradeOf(skill,h.progress.weaponGrades)===4?"史诗 · 无需升级":"已解锁 · 后续升级暂未开放"
          : skill === "hammer"
            ? `金币购买 · ${HAMMER_PRICE}金币`
            : skill === "lamp" ? `金币购买 · ${LAMP_PRICE}金币` : skill === "needle" ? "成就解锁 · 解签留路" : "成就解锁 · 破阵熟手";
        this.catalogButton(status, x, y - 34, 310, 34, () =>
          this.showWeaponDetail(skill),
        );
      });
    if(!list.length) h.text(h.overlay,"暂无可升级武器 · 新路线开放后会在这里提示",0,0,22,"#c4d4d2",1050);
    h.text(h.overlay, `${this.catalogPage + 1}/${pages}`, 0, -180, 17);
    this.catalogButton("上一页", -300, -185, 180, 36, () =>
      this.showWeapons(this.catalogPage - 1),
    );
    this.catalogButton("下一页", 300, -185, 180, 36, () =>
      this.showWeapons(this.catalogPage + 1),
    );
    this.catalogButton("返回菜单", 0, -245, 270, 44, () => this.showStart());
  }
  showWeaponDetail(skill: Skill) {
    if (this.catalog !== "detail") {
      if (this.catalog === "achievements") this.catalogReturn = "achievements";
      this.catalogFocus = 0;
    }
    this.catalog = "detail";
    this.catalogSkill = skill;
    this.catalogShell(`${GRADE_NAMES[gradeOf(skill,this.host.progress.weaponGrades)]} · ${weaponName(skill,this.host.progress.weaponGrades)}`);
    const h = this.host;
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
      this.catalogMessage ||
        (unlocked
          ? "已解锁 · 开局与升级随机获取"
          : skill === "hammer"
            ? `购买${HAMMER_PRICE}金币，当前余额${h.progress.coins}`
            : skill === "lamp" ? `购买${LAMP_PRICE}金币，当前余额${h.progress.coins}` : `完成「${skill === "needle" ? "解签留路" : "破阵熟手"}」解锁，不额外收金币`),
      0,
      -150,
      17,
      "#e8cc92",
      1060,
    );
    this.catalogMessage = "";
    h.text(
      h.overlay,
      "1～8级成长 · 4/8级各选一次改造 · 最多两项 · 互斥项不能共选",
      0,
      -185,
      15,
      "#adbccc",
      1080,
    );
    this.catalogButton("返回图鉴", -230, -245, 280, 44, () =>
      this.returnCatalog(),
    );
    if (!unlocked && (skill === "hammer" || skill === "lamp")) {
      const price=skill==="hammer"?HAMMER_PRICE:LAMP_PRICE;
      this.catalogButton(h.progress.coins>=price?"购买武器":`还差${price-h.progress.coins}金币`,230,-245,320,44,()=>{
        if(h.progress.coins>=price) this.confirmWeaponPurchase();
      });
    } else if(!unlocked) this.catalogButton("查看解锁成就",230,-245,320,44,()=>this.showAchievements(0,"机制挑战"));
    else {
      const target=nextGrade(skill,h.progress.weaponGrades);
      if(target) this.catalogButton(`进阶${GRADE_NAMES[target]} · ${GRADE_PRICE[target]}金币`,230,-245,320,44,()=>this.confirmWeaponPurchase(true));
      else h.text(h.overlay,gradeOf(skill,h.progress.weaponGrades)===4?"史诗 · 无需进阶":"后续进阶暂未开放",230,-242,18,"#c8b1e3",320);
    }
  }
  private confirmWeaponPurchase(evolution=false) {
    this.catalogFocus=0; this.catalog="purchase";
    const h=this.host, skill=this.catalogSkill, grades=h.progress.weaponGrades, current=gradeOf(skill,grades), target=evolution?nextGrade(skill,grades):current;
    if(!target) {this.showWeaponDetail(skill);return;}
    const future={...grades,[skill]:target}, price=evolution?GRADE_PRICE[target]:skill==="hammer"?HAMMER_PRICE:LAMP_PRICE;
    this.catalogShell(evolution?"武器进阶":"购买武器");
    for(const [i,g] of [current,target].entries()) {
      const x=i?250:-250;
      h.panel(h.overlay,x,72,420,174,"#293443");
      const icon=h.make("FormPreview",h.overlay);icon.setPosition(x,104);icon.setScale(1.5,1.5,1);
      drawWeaponGlyph(icon.addComponent(Graphics),skill,g);
      h.text(h.overlay,`${GRADE_NAMES[g]} · ${weaponName(skill,{...grades,[skill]:g})}`,x,37,23,GRADE_COLORS[g],400);
      h.text(h.overlay,i?(evolution?"下一局使用新形态与特效":"永久解锁此系列"):(evolution?"当前形态":"获取方式：金币购买"),x,2,16,"#c7d4da",400);
    }
    h.text(h.overlay,evolution?`同等级伤害 ×${(gradeMultiplier(skill,future)/gradeMultiplier(skill,grades)).toFixed(2)} · 保留攻击方式与改造`:`${WEAPON_ROLES[skill]} · 无成就附加门槛`,0,-60,20,"#e8d2a7",1080);
    h.text(h.overlay,`花费 ${price}金币 · 余额 ${h.progress.coins} → ${h.progress.coins-price}`,0,-109,21,"#e9d2ad",1080);
    this.catalogButton("取消",-230,-215,300,45,()=>this.showWeaponDetail(skill));
    this.catalogButton(h.progress.coins>=price?"确认购买":`还差${price-h.progress.coins}金币`,230,-215,330,45,()=>{
      if(h.progress.coins<price)return;
      const result=evolution?h.progress.evolveWeapon(skill,current):h.progress.buyWeapon(skill);
      this.catalogMessage=result==="evolved"?"进阶成功 · 下一局使用新形态":result==="purchased"?"购买成功 · 已加入随机池":result==="already"?"已经取得，无需重复购买":result==="insufficient"?"余额不足":result==="save-failed"?"保存失败，未扣款，请重试":"此进阶暂未开放";
      this.showWeaponDetail(skill);
    });
  }
  showAchievements(page=this.achievementPage,category=this.achievementCategory) {
    if(this.catalog!=="achievements")this.catalogFocus=0;
    this.catalog="achievements";this.achievementCategory=category;
    this.catalogShell("成就图鉴");
    const h=this.host, list=ACHIEVEMENTS.filter(a=>a.category===category), pages=Math.max(1,Math.ceil(list.length/3));
    this.achievementPage=Math.max(0,Math.min(pages-1,page));
    ["通关记录","机制挑战","配装挑战"].forEach((name,i)=>this.catalogButton((category===name?"◆ ":"")+name,(i-1)*320,155,290,36,()=>this.showAchievements(0,name)));
    list.slice(this.achievementPage*3,this.achievementPage*3+3).forEach((a,i)=>{
      const y=80-i*100,done=h.progress.hasAchievement(a.id);
      h.panel(h.overlay,0,y,1060,93,"#293443");
      h.text(h.overlay,a.name+(done?" · 已完成":" · 未完成"),-265,y+29,21,done?"#a8d7c7":"#f3deac",500);
      h.text(h.overlay,a.condition,0,y,15,"#d5dfdc",1020);
      h.text(h.overlay,`奖励：${a.reward} · ${h.progress.achievementProgress(a.id)}`,0,y-29,14,"#b9c8d5",1020);
      const weapon=a.weapon;if(weapon)this.catalogButton("查看奖励武器",345,y+29,260,29,()=>this.showWeaponDetail(weapon));
    });
    h.text(h.overlay,`${this.achievementPage+1}/${pages}`,0,-185,17);
    this.catalogButton("上一页",-300,-185,180,34,()=>this.showAchievements(this.achievementPage-1));
    this.catalogButton("下一页",300,-185,180,34,()=>this.showAchievements(this.achievementPage+1));
    this.catalogButton("返回菜单",0,-245,280,44,()=>this.showStart());
  }
  showStageSelect(preview: StageId = this.host.selectedStage) {
    this.stagePreview = preview;
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay, 0, 0, 1100, 570, "#191e2d");
    this.host.text(this.host.overlay, "选择关卡", 0, 235, 32, "#f3deac");
    this.host.text(
      this.host.overlay,
      `点击查看特点 · 通关前一关解锁 · 本关胜利奖励 ${CLEAR_COINS[preview]}金币`,
      0,
      170,
      14,
      "#b9c8d5",
    );
    const stages = STAGE_IDS;
    const page = Math.floor(stages.indexOf(preview) / 8),
      pages = Math.ceil(stages.length / 8);
    for (const [i, stage] of stages.slice(page * 8, page * 8 + 8).entries()) {
      const x =
          ((i % 4) - (Math.min(stages.length - page * 8, 4) - 1) / 2) *
          (stages.length > 3 ? 280 : 350),
        y = 100 - Math.floor(i / 4) * 135,
        unlocked = this.host.progress.unlockedStage(stage);
      const label = this.host.button(
        this.host.overlay,
        "",
        x,
        y,
        236,
        116,
        () => this.showStageSelect(stage),
      );
      const card = label.node.parent!;
      this.host.text(
        card,
        `${stage === preview ? "✓ " : ""}${stageNumber(stage)} · ${STAGES[stage].name}`,
        0,
        32,
        17,
        unlocked ? "#f3deac" : "#9ba5b1",
        224,
      );
      const best = this.host.progress.data.stageBest?.[stage];
      this.host.text(
        card,
        unlocked ? (best?.won ? "已通关" : "已解锁") : "未解锁",
        0,
        0,
        14,
        unlocked ? "#a9cdbc" : "#9ba5b1",
        180,
      );
      this.host.text(
        card,
        !unlocked
          ? `通关第${stageNumber(stage) - 1}关解锁`
          : best
            ? `最佳 ${Math.floor(best.time / 60)
                .toString()
                .padStart(2, "0")}:${Math.floor(best.time % 60)
                .toString()
                .padStart(2, "0")}${best.won ? " · 通关" : " · 挑战"}`
            : "尚未挑战",
        0,
        -32,
        13,
        "#b9c8d5",
        180,
      );
    }
    this.host.text(
      this.host.overlay,
      `${page + 1}/${pages} 页`,
      0,
      190,
      16,
      "#b9c8d5",
      100,
    );
    if (page > 0)
      this.host.button(this.host.overlay, "上一页", -440, 190, 150, 38, () =>
        this.showStageSelect(stages[(page - 1) * 8]),
      );
    if (page + 1 < pages)
      this.host.button(this.host.overlay, "下一页", 440, 190, 150, 38, () =>
        this.showStageSelect(stages[(page + 1) * 8]),
      );
    const guide = STAGE_GUIDES[preview];
    this.host.text(
      this.host.overlay,
      `${stageNumber(preview)} · ${STAGES[preview].name} · 首领：${STAGES[preview].boss}`,
      0,
      -125,
      21,
      "#f3deac",
      1020,
    );
    this.host.text(
      this.host.overlay,
      guide?.threat || "清理尸潮、积累武器，六分钟后迎战首领",
      0,
      -165,
      16,
      "#e8cc92",
      1020,
    );
    this.host.text(
      this.host.overlay,
      stageBuildHint(preview),
      0,
      -194,
      15,
      "#a9cdbc",
      1020,
    );
    this.host.button(this.host.overlay, "返回菜单", -190, -250, 290, 48, () =>
      this.host.showStart(),
    );
    const unlocked = this.host.progress.unlockedStage(preview);
    this.host.button(
      this.host.overlay,
      unlocked ? "选择本关" : `通关第${stageNumber(preview) - 1}关解锁`,
      190,
      -250,
      290,
      48,
      () => {
        if (unlocked) {
          this.host.selectedStage = preview;
          this.host.showStart();
        }
      },
    );
  }
  muteButton(x: number, y: number, start: boolean) {
    this.host.button(
      this.host.overlay,
      this.host.preferences.powerSaving ? "省电优先" : "流畅优先",
      x - 180,
      y,
      160,
      40,
      () => {
        this.host.preferences.togglePowerSaving();
        this.host.applyFrameRate();
        if (start) this.host.showStart();
        else {
          this.host.shown = "";
          this.host.menus();
        }
      },
    );
    this.host.button(
      this.host.overlay,
      this.host.preferences.muted ? "声音：关" : "声音：开",
      x,
      y,
      160,
      40,
      () => {
        this.host.preferences.toggleMute();
        if (start) this.host.showStart();
        else {
          this.host.shown = "";
          this.host.menus();
        }
      },
    );
  }
  cancelConfirmation() {
    this.host.confirmation = null;
    this.host.clearInput();
    this.host.shown = "";
    this.host.menus();
  }
  confirmAbandon(action: "restart" | "selection") {
    this.host.confirmation = action;
    this.host.clearInput();
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay, 0, 0, 850, 350, "#191e2d");
    this.host.text(this.host.overlay, "结束本次冒险？", 0, 100, 32);
    this.host.text(
      this.host.overlay,
      "本局战斗无法继续，新版角色解锁和历史记录会保留。",
      0,
      20,
      22,
    );
    this.host.button(this.host.overlay, "取消", -170, -95, 250, 55, () =>
      this.host.cancelConfirmation(),
    );
    this.host.button(this.host.overlay, "确认结束", 170, -95, 250, 55, () => {
      this.host.syncProgress();
      this.host.progress.flush();
      if (action === "restart") this.host.restart();
      else this.host.showStart();
    });
  }
}
