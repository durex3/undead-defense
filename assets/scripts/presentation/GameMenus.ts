import { LAMP_PRICE } from "../battle/SupportConfig";
import { gradeOf, weaponName, nextGrade, gradeMultiplier, GRADE_NAMES, GRADE_COLORS, GRADE_PRICE } from "../battle/WeaponGrade";
import { drawWeaponGlyph } from "./art/WeaponGlyph";
import { drawStageMap } from "./StageMapPainter";
import { drawActorLayer } from "./art/EnemyPainter";
import { stageMapBackdrop } from "./art/MapArt";
import { SurvivalWorld } from "../battle/SurvivalWorld";
import { ink } from "./art/Ink";
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
import { KeyCode, Graphics, EditBox, Label, UITransform } from "cc";
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
  private catalog: "weapons" | "achievements" | "detail" | "purchase" | "recovery" | null =
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
  private repairInput: EditBox | null = null;
  private repairHint: Label | null = null;
  private repairDraft = "";
  private repairEditing = false;
  private catalogLabels: {label: Label; title: string; width: number}[] = [];
  constructor(private host: ReturnType<GameBootstrap["menuContext"]>) {}
  handleTargetKey(code: number) {
    if(this.repairEditing)return true;
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
        else if(route === "recovery") this.catalogLabels.forEach((b,i)=>{b.label.string=(i===this.catalogFocus&&b.width>=100?"▸ ":"")+b.title;});
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
      else if (code === KeyCode.ARROW_LEFT || code === KeyCode.KEY_A) this.moveStage(-1);
      else if (code === KeyCode.ARROW_RIGHT || code === KeyCode.KEY_D) this.moveStage(1);
      else if (code === KeyCode.ENTER || code === KeyCode.SPACE) this.startPreviewStage();
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
      `总伤害 +${Math.round(a.damage * 100)}% · 冷却 −${Math.round(a.cooldown * 100)}%\n覆盖面积 +${Math.round((a.area - 1) * 100)}% · 持续 +${Math.round((a.duration - 1) * 100)}%`,
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
    this.repairInput=null;this.repairHint=null;this.repairEditing=false;
    this.stagePreview = null;
    this.host.confirmation = null;
    setupWechatShare();
    this.host.started = false;
    this.host.clearInput();
    this.host.progress.flush();
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay, 0, 0, 1100, 570, "#191e2d");
    this.host.text(this.host.overlay, this.host.progress.hasAchievement("loom_eight_paths")?"余烬幸存者 · 断纬者":"余烬幸存者 · 选择冒险", 0, 220, 34);
    this.host.text(this.host.overlay, PLAY_VERSION, 0, 265, 14, "#adbccc");
    this.host.muteButton(425, 225, true);
    this.host.button(this.host.overlay,"存档管理",-430,225,160,38,()=>this.showManualSaves());
    this.host.text(
      this.host.overlay,
      "十四系列 · 十把默认开放 · 金币与成就各解锁两把",
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
      this.host.progress.readBlocked ? this.host.progress.loadNotice : (this.host.progress.pending
        ? "进度暂未保存，将自动重试"
        : this.host.progress.loadNotice || (this.host.touchMode
          ? "左侧拖动移动 · 右下角全收经验 · 6 分钟迎战首领 · 上限64级"
          : "WASD 移动 · 空格全收经验 · 6 分钟迎战首领 · 上限64级")),
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
    this.catalogLabels = [];
    this.repairInput=null;this.repairHint=null;this.repairEditing=false;
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
    const widget=this.host.button(
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
    this.catalogLabels.push({label:widget,title:label,width});
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
      if(a.id==='loom_eight_paths'&&done){const badge=h.make('LoomAchievementBadge',h.overlay);badge.setPosition(425,y+29);const g=badge.addComponent(Graphics);g.strokeColor=ink('#d9c0f0');g.lineWidth=3;for(let v=-1;v<=1;v++){g.moveTo(v*8-13,-9);g.lineTo(v*8+13,9);g.moveTo(v*8-13,9);g.lineTo(v*8+13,-9);}g.stroke();}
      const weapon=a.weapon;if(weapon)this.catalogButton("查看奖励武器",345,y+29,260,29,()=>this.showWeaponDetail(weapon));
    });
    h.text(h.overlay,`${this.achievementPage+1}/${pages}`,0,-185,17);
    this.catalogButton("上一页",-300,-185,180,34,()=>this.showAchievements(this.achievementPage-1));
    this.catalogButton("下一页",300,-185,180,34,()=>this.showAchievements(this.achievementPage+1));
    this.catalogButton("返回菜单",0,-245,280,44,()=>this.showStart());
  }
  showManualSaves() {
    this.catalog="recovery";this.catalogFocus=0;this.catalogShell("存档管理 · 最多3个");
    const h=this.host;
    h.text(h.overlay,this.catalogMessage || "保存通关、金币、武器与成就；不保存战斗中途状态。",0,155,18,"#e8d1a2",1080);
    this.catalogMessage="";
    for(const entry of h.progress.manualSaves) {
      const y=80-(entry.slot-1)*100,d=entry.data;
      h.panel(h.overlay,0,y,1060,90,"#293443");
      h.text(h.overlay,`存档 ${entry.slot} · ${d?`${d.stages.length}关 · ${d.coins??0}金币`:entry.state==="empty"?"空存档位":"读取异常"}`,-285,y+22,21,"#e6d8b7",460);
      const stamp=entry.savedAt?new Date(entry.savedAt).toLocaleString():"";
      h.text(h.overlay,d?stamp:entry.state==="empty"?"点击保存当前进度":"原始数据保留；覆盖前请确认",-270,y-18,15,"#b9cbd4",490);
      this.catalogButton(d?"覆盖保存":"保存",75,y+17,160,36,()=>this.confirmManualSave(entry.slot,"save"));
      if(d)this.catalogButton("读取",255,y+17,160,36,()=>this.confirmManualSave(entry.slot,"load"));
      if(entry.state!=="empty")this.catalogButton("删除",435,y+17,140,36,()=>this.confirmManualSave(entry.slot,"delete"));
    }
    h.text(h.overlay,"自动保存独立保留；删除手动存档不会清空当前进度。",0,-190,17,"#b9cbd4",1080);
    this.catalogButton("返回菜单",-350,-245,280,44,()=>this.showStart());
    this.catalogButton("存档检查",0,-245,280,44,()=>this.showRecovery());
    this.catalogButton("输入补回码",350,-245,280,44,()=>this.showRepairEntry());
  }
  private confirmManualSave(slot: number, action: "save" | "load" | "delete") {
    const h=this.host,entry=h.progress.manualSaves.find(v=>v.slot===slot);if(!entry)return;
    const revision=h.progress.data.revision,verb=action==="save"?"保存":action==="load"?"读取":"删除";
    this.catalog="recovery";this.catalogFocus=0;this.catalogShell(`确认${verb}存档 ${slot}`);
    const data=action==="save"?h.progress.data:entry.data;
    h.text(h.overlay,`已通关 ${data?.stages.join("、")||"暂无"} · ${data?.coins??0}金币`,0,95,25,"#f1ddaf",1060);
    h.text(h.overlay,action==="save"?(entry.state==="empty"?"将当前进度保存到这个存档位。":"将替换此存档位的旧内容，其他存档位不受影响。"):
      action==="load"?"当前金币、通关、武器与成就将以此存档为准，不叠加奖励。":"此手动存档将被删除，不能撤销；当前进度与其他存档位保留。",0,15,19,"#e2c69d",1060);
    h.text(h.overlay,"手动存档仅保存在当前设备的微信环境中。",0,-55,17,"#b9cbd4",1060);
    this.catalogButton("取消",-220,-170,300,48,()=>this.showManualSaves());
    this.catalogButton(`确认${verb}`,220,-170,300,48,()=>{
      const result=action==="save"?h.progress.saveManual(slot,entry.token,revision):action==="load"?h.progress.loadManual(slot,entry.token,revision):h.progress.deleteManual(slot,entry.token);
      this.catalogMessage=result==="saved"?`存档 ${slot} 已保存`:result==="loaded"?`存档 ${slot} 已读取`:result==="deleted"?`存档 ${slot} 已删除`:result==="save-failed"?"操作失败，未确认保存，请重试":"记录已变化，请重新选择";
      this.showManualSaves();
    });
  }
  showRecovery(page=0) {
    this.catalog="recovery";this.catalogFocus=0;this.catalogShell("存档检查与恢复");
    const h=this.host, records=h.progress.recoveryRecords, pages=Math.max(1,Math.ceil(records.length/3)), p=Math.max(0,Math.min(pages-1,page));
    h.text(h.overlay,this.catalogMessage || h.progress.loadNotice || `当前已通关 ${h.progress.data.stages.length}关 · ${h.progress.coins}金币 · 可读副本 ${records.length}份`,0,153,17,"#e8d1a2",1080);
    this.catalogMessage="";
    records.slice(p*3,p*3+3).forEach((record,i)=>{
      const y=80-i*98,d=record.data;
      h.panel(h.overlay,0,y,1060,88,"#293443");
      h.text(h.overlay,`${record.source} · ${d.stages.length}关 · ${d.coins??0}金币`,-200,y+21,21,"#e6d8b7",610);
      h.text(h.overlay,`通关记录：${d.stages.join("、")||"暂无"} · 修订${d.revision}${record.repaired?" · 已兼容读取":""}`,0,y-17,16,"#b9cbd4",1020);
      this.catalogButton("预览恢复",355,y+21,240,34,()=>this.confirmRecovery(record.id));
    });
    if(!records.length) {
      h.text(h.overlay,"没有找到可读取的账户副本",0,50,25,"#e6d8b7",1020);
      h.text(h.overlay,"原始数据会保留；此功能无法还原已被微信清除或完全覆盖的数据。",0,-5,17,"#b9cbd4",1030);
    }
    h.text(h.overlay,`${p+1}/${pages}`,0,-180,17);
    this.catalogButton("上一页",-300,-185,180,34,()=>this.showRecovery(p-1));
    this.catalogButton("下一页",300,-185,180,34,()=>this.showRecovery(p+1));
    this.catalogButton("返回菜单",-250,-245,280,44,()=>this.showStart());
    this.catalogButton("输入补回码",250,-245,320,44,()=>this.showRepairEntry());
  }
  private confirmRecovery(id: string) {
    const h=this.host, record=h.progress.recoveryRecords.find(v=>v.id===id);if(!record){this.showRecovery();return;}
    const revision=h.progress.data.revision,d=record.data;
    this.catalog="recovery";this.catalogFocus=0;this.catalogShell("确认恢复账户快照");
    h.text(h.overlay,`已通关 ${d.stages.join("、")||"暂无"} · ${d.coins??0}金币`,0,100,25,"#f1ddaf",1060);
    h.text(h.overlay,`购买 ${d.purchasedWeapons?.length??0}项 · 成就 ${d.achievements?.length??0}项`,0,48,21,"#bfd4d2",1060);
    h.text(h.overlay,"恢复后金币、武器和进度以所选快照为准，不与当前余额相加。",0,-15,18,"#e2c69d",1060);
    h.text(h.overlay,"当前原始副本会先保留；保存失败不会替换当前账户。",0,-58,17,"#b9cbd4",1060);
    this.catalogButton("取消",-220,-170,300,48,()=>this.showRecovery());
    this.catalogButton("确认恢复",220,-170,300,48,()=>{
      const result=h.progress.restoreRecord(id,revision);
      if(result!=="restored")h.progress.loadNotice=result==="save-failed"?"恢复保存失败，原始副本已保留，请重试":"记录已变化，请重新选择副本";
      this.showRecovery();
    });
  }
  private showRepairEntry(code=this.repairDraft) {
    this.catalog="recovery";this.catalogFocus=2;this.catalogShell("输入补回码");
    const h=this.host;
    h.text(h.overlay,"点击下方输入框，可手动输入或长按粘贴",0,140,23,"#e7d5af",1040);
    const box=h.panel(h.overlay,0,48,1010,82,"#293b48");box.name="RepairCodeInput";
    const input=box.addComponent(EditBox);
    input.inputMode=EditBox.InputMode.SINGLE_LINE;input.inputFlag=EditBox.InputFlag.DEFAULT;
    input.returnType=EditBox.KeyboardReturnType.DONE;input.maxLength=160;
    // addComponent initializes default labels immediately; remove them before
    // assigning our styled labels so the engine's default “label” cannot leak.
    input.textLabel?.node.destroy();input.placeholderLabel?.node.destroy();
    const text=h.text(box,"",0,0,25,"#f3e6c7",970),placeholder=h.text(box,"在这里输入或长按粘贴补回码",0,0,22,"#92a8b8",970);
    for(const label of [text,placeholder]){label.horizontalAlign=Label.HorizontalAlign.LEFT;label.enableWrapText=false;label.node.getComponent(UITransform)!.setContentSize(970,70);}
    input.textLabel=text;input.placeholderLabel=placeholder;input.string=code;this.repairDraft=code;this.repairInput=input;
    this.repairHint=h.text(h.overlay,"",0,-25,18,"#efc896",1040);
    box.on(EditBox.EventType.TEXT_CHANGED,()=>{this.repairDraft=input.string;if(this.repairHint)this.repairHint.string="";});
    box.on(EditBox.EventType.EDITING_DID_BEGAN,()=>{this.repairEditing=true;});
    box.on(EditBox.EventType.EDITING_DID_ENDED,()=>{this.repairEditing=false;this.repairDraft=input.string;});
    box.on(EditBox.EventType.EDITING_RETURN,()=>{this.repairEditing=false;this.showRepairCodePreview(input.string);});
    this.catalogButton("返回检查",-340,-140,280,48,()=>this.showRecovery());
    this.catalogButton("从剪贴板粘贴",0,-140,280,48,()=>this.pasteRepairCode());
    this.catalogButton("预览补回",340,-140,280,48,()=>this.showRepairCodePreview(this.repairInput?.string??this.repairDraft));
    h.text(h.overlay,"预览不会修改账户；确认补回后才会保存。",0,-220,17,"#b7c7ce",1040);
  }
  private pasteRepairCode() {
    const fail=()=>{if(this.repairHint)this.repairHint.string="无法读取剪贴板，请长按输入框粘贴或手动输入";};
    const accept=(code:string)=>{if(!this.repairInput){this.showRepairEntry(code);return;}this.repairInput.string=code;this.repairDraft=code;if(this.repairHint)this.repairHint.string="已粘贴，请点击预览补回";};
    const wx=(globalThis as any).wx;
    if(wx?.getClipboardData) wx.getClipboardData({success:(result:{data:string})=>accept(result.data),fail});
    else if(typeof navigator!=="undefined"&&navigator.clipboard?.readText)navigator.clipboard.readText().then(accept).catch(fail);
    else fail();
  }
  private showRepairCodePreview(code: string) {
    const h=this.host,preview=h.progress.previewRepairCode(code);
    if(!preview){if(this.repairInput){if(this.repairHint)this.repairHint.string=code.trim()?"补回码无效或复制不完整，请检查后重试":"请先在输入框填写补回码";}else{this.catalogMessage="补回码无效或复制不完整，账户尚未修改";this.showRecovery();}return;}
    const d=preview.data, revision=h.progress.data.revision;
    this.catalog="recovery";this.catalogFocus=0;this.catalogShell("确认补回通关与金币");
    h.text(h.overlay,`已通关 ${d.stages.join("、")||"暂无"} · ${d.coins??0}金币`,0,100,26,"#f1ddaf",1060);
    h.text(h.overlay,"仅默认武器 · 默认品阶 · 不授予挑战解锁武器",0,42,21,"#bfd4d2",1060);
    h.text(h.overlay,"确认后按以上内容替换当前账户，余额不会相加。",0,-17,18,"#e2c69d",1060);
    h.text(h.overlay,"当前原始副本会保留；同一补回码只使用一次。",0,-60,17,"#b9cbd4",1060);
    this.catalogButton("取消",-220,-170,300,48,()=>this.showRecovery());
    this.catalogButton("确认补回",220,-170,300,48,()=>{
      const result=h.progress.applyRepairCode(code,revision);
      this.catalogMessage=result==="restored"?"补回成功 · 请退出重进确认进度":result==="already"?"此码已使用，不会重复增加金币":result==="save-failed"?"保存失败，账户未修改，请重试":"账户已变化，请重新粘贴补回码";
      this.showRecovery();
    });
  }
  private moveStage(direction: number) {
    if (this.stagePreview === null) return;
    const index = STAGE_IDS.indexOf(this.stagePreview);
    const next = Math.max(0, Math.min(STAGE_IDS.length - 1, index + direction));
    if (next !== index) this.showStageSelect(STAGE_IDS[next]);
  }
  private startPreviewStage() {
    const stage = this.stagePreview;
    if (stage === null || !this.host.progress.unlockedStage(stage)) return;
    this.host.selectedStage = stage;
    this.stagePreview = null;
    this.host.restart();
  }
  showStageSelect(preview: StageId = this.host.selectedStage) {
    const h = this.host;
    this.catalog = null;
    this.detailSkill = null;
    this.stagePreview = preview;
    h.started = false;
    h.clearInput();
    h.overlay.destroyAllChildren();
    h.panel(h.overlay, 0, 0, 1280, 720, "#131821");
    h.panel(h.overlay, 0, 0, 1100, 650, "#191e2d");
    const index = STAGE_IDS.indexOf(preview);
    const unlocked = h.progress.unlockedStage(preview);
    const best = h.progress.data.stageBest?.[preview];
    h.text(h.overlay, `选择战场 · ${index + 1} / ${STAGE_IDS.length}`, 0, 283, 18, "#a9bac4");
    h.text(h.overlay, STAGES[preview].name, 0, 237, 32, "#f3deac", 800);

    // One themed image, using the actual complete map and the stage's own boss art.
    const image = h.panel(h.overlay, 0, 38, 790, 310, stageMapBackdrop(preview));
    image.name = "StageThemePreview";
    const map = h.make("StageMapThumbnail", image);
    map.setPosition(-185, 0);
    map.setScale(.095, .095, 1);
    drawStageMap(map.addComponent(Graphics), preview);
    h.text(image, "战场全貌", -185, -139, 14, "#c4d4d2", 260);
    const portrait = h.make("StageBossPortrait", image);
    portrait.setPosition(165, -62);
    portrait.setScale(1.15, 1.15, 1);
    const study = new SurvivalWorld(19, "ranger", preview);
    study.player = {x: 0, y: -8};
    study.camera = {x: 0, y: 0};
    study.time = .5;
    const boss = study.addEnemy("boss", 0, 0)!;
    boss.state = "seek";
    drawActorLayer(portrait.addComponent(Graphics), study, false, false);
    h.text(image, "首领", 165, 119, 14, "#b5c4cd", 300);
    h.text(image, STAGES[preview].boss, 165, -111, 22, "#f3deac", 340);

    for (const direction of [-1, 1]) {
      const enabled = direction < 0 ? index > 0 : index < STAGE_IDS.length - 1;
      const x = direction * 475;
      if (enabled) {
        const label = h.button(h.overlay, direction < 0 ? "‹" : "›", x, 38, 84, 104,
          () => this.moveStage(direction));
        label.fontSize = 56;
        label.lineHeight = 70;
      } else {
        const edge = h.panel(h.overlay, x, 38, 84, 104, "#222a36");
        h.text(edge, direction < 0 ? "‹" : "›", 0, 0, 56, "#53606d", 68);
      }
    }
    h.text(h.overlay, STAGE_GUIDES[preview].threat, 0, -144, 16, "#c4d4d2", 940);
    const status = !unlocked ? `通关第${stageNumber(preview)-1}关解锁`
      : (best?.won || h.progress.data.stages.includes(preview)) ? "已通关" : "已解锁";
    h.text(h.overlay, `${status} · 胜利奖励 ${CLEAR_COINS[preview]}金币 · 6分钟迎战首领`,
      0, -181, 17, unlocked ? "#b8d4bc" : "#b5b5c3", 940);
    const dots = h.make("StageCarouselPosition", h.overlay);
    dots.setPosition(0, -212);
    const g = dots.addComponent(Graphics);
    for (let i=0;i<STAGE_IDS.length;i++) {
      g.fillColor = ink(i===index?"#f3deac":"#53606d");
      g.circle((i-(STAGE_IDS.length-1)/2)*18,0,i===index?4.5:2.5);g.fill();
    }
    h.button(h.overlay, "返回菜单", -175, -263, 270, 54, () => h.showStart());
    if (unlocked) h.button(h.overlay, "开始本关", 175, -263, 310, 54, () => this.startPreviewStage());
    else {
      const locked = h.panel(h.overlay, 175, -263, 310, 54, "#2b313e");
      h.text(locked, "尚未解锁", 0, 0, 20, "#8795a6", 290);
    }
    h.text(h.overlay, h.touchMode ? "点击左右箭头切换关卡" : "← → / A D 切换关卡 · Enter 开始 · Esc 返回",
      0, -307, 14, "#8fa1b1", 940);
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
