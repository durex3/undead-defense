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
import { KeyCode } from "cc";
import {
  WEAPONS,
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
  private detailSkill: Skill | null = null;
  private stagePreview: StageId | null = null;
  constructor(private host: ReturnType<GameBootstrap["menuContext"]>) {}
  handleTargetKey(code: number) {
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
        w.skills[s] ? `${NAMES[s]} ${w.skills[s]}/8级` : `${NAMES[s]} · 未持有`,
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
        h.text(h.overlay, NAMES[s], x, 72, 28, COLORS[s]);
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
    if(w.state==="tactical"){
      h.text(h.overlay,"精英战利 · 选择一项战术祝福",0,210,30,"#e8cc92");
      h.text(h.overlay,"精英击破后暂停选择；效果持续到本局结束",0,170,17,"#b9c8d5",900);
      w.tacticalChoices.forEach((choice,i)=>{
        const x=(i-(w.tacticalChoices.length-1)/2)*350;
        h.panel(h.overlay,x,0,320,220,"#293a47");
        h.text(h.overlay,`${i+1} · ${choice.name}`,x,55,24,"#e8cc92",295);
        h.text(h.overlay,choice.effect,x,-5,18,"#d5e0e5",280);
        h.button(h.overlay,"选择祝福",x,-72,270,42,()=>{h.clearInput();w.chooseTacticalBlessing(choice.id);this.redraw();});
      });
      return;
    }
    if (w.state === "modification" && w.pendingModification) {
      const s = w.pendingModification,
        options = w.modOptions();
      h.text(
        h.overlay,
        `${NAMES[s]} · 选择第${w.mods[s].length + 1}次改造`,
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
        h.text(h.overlay, `${i + 1}  ${NAMES[c]}`, x, 25, 26, COLORS[c], 310);
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
      h.text(h.overlay, r.retryTip, 0, -159, 17, "#a9cdbc", 1050);
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
        `${NAMES[s]} · ${w.skills[s]}级`,
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
        `${NAMES[s]} ${w.skills[s]}/8级 · ${modSummary(w, s)}`,
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
      "新武器系统 · 本轮开放飞刀、火球、圣水 · 4级 / 8级改造",
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
          ? "左侧拖动移动 · 右下角全收经验 · 8 分钟迎战首领 · 上限64级"
          : "WASD 移动 · 空格全收经验 · 8 分钟迎战首领 · 上限64级",
      0,
      guide ? -220 : -194,
      16,
      "#adbccc",
    );
    this.host.button(this.host.overlay, "开始冒险", 0, -260, 290, 50, () =>
      this.host.restart(),
    );
  }
  showStageSelect(preview: StageId = this.host.selectedStage) {
    this.stagePreview = preview;
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay, 0, 0, 1100, 570, "#191e2d");
    this.host.text(this.host.overlay, "选择关卡", 0, 235, 32, "#f3deac");
    this.host.text(
      this.host.overlay,
      "点击查看特点 · 通关前一关解锁",
      0,
      170,
      14,
      "#b9c8d5",
    );
    const stages = STAGE_IDS;
    const page = Math.floor(stages.indexOf(preview) / 8),
      pages = Math.ceil(stages.length / 8);
    for (const [i, stage] of stages.slice(page * 8, page * 8 + 8).entries()) {
      const x = (i % 4 - (Math.min(stages.length-page*8,4) - 1) / 2) * (stages.length > 3 ? 280 : 350),
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
      guide?.threat || "清理尸潮、积累武器，八分钟后迎战首领",
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
