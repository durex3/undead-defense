import { upgradeSynergy, upgradeInventory } from "../battle/WeaponStatus";
import { branchRole } from "../battle/BuildProgression";
import { FURNACE_WINDOWS, furnaceEncounter } from "../battle/FurnaceEncounters";
import { weaponStatus, combinationRecipes } from "../battle/WeaponStatus";
import { WEAPON_ROLES } from "../battle/BuildProgression";

import { STAGES, STAGE_GUIDES } from "../battle/StageRules";
import { PLAY_VERSION, setupWechatShare } from "../platform/PlayPreferences";

import {
  CHARACTERS,
  ACHIEVEMENTS,
  CharacterId,
  StageId,
} from "../battle/ProgressionConfig";

import { battleReport } from "../battle/BattleReport";
import { Node, Graphics, EventTouch, KeyCode } from "cc";

import { SYNTHESIS_RECIPES, MAX_SKILL_LEVEL, Skill, Passive, WEAPONS as SKILLS, cardText, NAMES as names, COLORS as colors, EVOLUTIONS } from "../battle/SurvivalConfig";
import { skillGlyph } from "./BattlePainter";

import { weaponFormName } from "../battle/WeaponForms";

import type { GameBootstrap } from "../GameBootstrap";

/** Composes menu screens through a typed view of bootstrap state and actions. */
export class GameMenus {
  private stagePreview: StageId | null = null;
  private targetPicker = false;
  private targetRecipes = Object.keys(SYNTHESIS_RECIPES) as Skill[];
  handleTargetKey(code: number) {
    if (this.stagePreview !== null && !this.host.started) {
      if (code === KeyCode.ESCAPE) this.host.showStart();
      else if (code === KeyCode.ENTER && this.host.progress.unlockedStage(this.stagePreview)) {
        this.host.selectedStage = this.stagePreview;
        this.host.showStart();
      }
      return true;
    }
    if (!this.targetPicker || this.host.world.state !== "upgrade") return false;
    if (code === KeyCode.ESCAPE) this.closeTargetPicker();
    const index = [KeyCode.DIGIT_1, KeyCode.DIGIT_2, KeyCode.DIGIT_3, KeyCode.DIGIT_4, KeyCode.DIGIT_5, KeyCode.DIGIT_6, KeyCode.DIGIT_7, KeyCode.DIGIT_8, KeyCode.DIGIT_9].indexOf(code);
    if (index >= 0) this.selectTarget(this.targetRecipes[index]);
    return true;
  }
  private closeTargetPicker() { this.targetPicker = false; this.host.shown = ""; this.host.menus(); }
  private selectTarget(skill: Skill | null) {
    if (this.host.world.setBuildTarget(skill)) this.closeTargetPicker();
  }
  private drawTargetPicker() {
    const w = this.host.world;
    this.host.text(this.host.overlay, "选择目标组合", 0, 220, 34);
    this.host.text(this.host.overlay, "目标提高配方出现概率 · 不保证出现 · 切换不重抽当前牌", 0, 174, 18, "#a7b8c5");
    this.targetRecipes.forEach((main, i) => {
      const partner = SYNTHESIS_RECIPES[main]!;
      const x = (i % 3 - 1) * 350, y = 102 - Math.floor(i / 3) * 103;
      const reason = w.targetReason(main);
      const remaining = 20 - w.skills[main] - w.skills[partner];
      this.host.panel(this.host.overlay, x, y, 330, 91, reason ? "#222a36" : "#293443");
      const title = this.host.button(this.host.overlay, `${i + 1}  ${names[main]} + ${names[partner]}`, x, y + 16, 310, 40, () => this.selectTarget(main));
      title.fontSize = 18; title.lineHeight = 27;
      this.host.text(this.host.overlay, reason || `${w.skills[main]}/10 + ${w.skills[partner]}/10 · 还需 ${remaining} 次武器升级${w.buildTarget === main ? " · 已锁定" : ""}`, x, y - 25, 14, reason ? "#ad9292" : "#9edac8", 316);
    });
    this.host.button(this.host.overlay, "自动推荐", -150, -223, 250, 42, () => this.selectTarget(null));
    this.host.button(this.host.overlay, "返回升级", 150, -223, 250, 42, () => this.closeTargetPicker());
  }
  constructor(private host: ReturnType<GameBootstrap["menuContext"]>) {}
  showStart() {
    this.stagePreview = null;
    this.host.confirmation = null;
    setupWechatShare();
    this.host.started = false;
    this.host.world.starPath.clear();
    this.host.clearInput();
    this.host.progress.flush();
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay, 0, 0, 1100, 570, "#191e2d");
    this.host.text(this.host.overlay, "余烬幸存者 · 选择冒险", 0, 220, 34);
    this.host.text(this.host.overlay, PLAY_VERSION, 0, 265, 14, "#adbccc");
    this.host.muteButton(425, 225, true);
    const count = this.host.progress.data.achievements.length;
    this.host.text(
      this.host.overlay,
      `成就 ${count}/${ACHIEVEMENTS.length} · 六个武器槽已开放 · 组合伙伴仍占槽位`,
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
        unlocked ? c.description.replace(" · ", "\n") : `需要 ${c.need} 项成就\n并通关${STAGES[c.stage as StageId]?.name || "地牢"}`,
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
          : `成就 ${count}/${c.need} · 未解锁`,
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
    this.host.text(this.host.overlay, `${this.host.selectedStage} · ${STAGES[this.host.selectedStage].name}`, -175, -104, 24, "#f3deac", 620);
    this.host.button(this.host.overlay, "选择关卡", 355, -104, 300, 48, ()=>this.showStageSelect());
    const guide = STAGE_GUIDES[this.host.selectedStage];
    if (guide) {
      this.host.text(this.host.overlay, guide.threat, 0, -158, 16, "#e8cc92", 1050);
      this.host.text(this.host.overlay, guide.builds, 0, -185, 15, "#a9cdbc", 1050);
    }
    this.host.text(
      this.host.overlay,
      this.host.progress.pending
        ? "进度暂未保存，将自动重试"
        : this.host.touchMode ? "左侧拖动移动 · 右下角全收经验 · 8 分钟迎战首领 · 上限64级" : "WASD 移动 · 空格全收经验 · 8 分钟迎战首领 · 上限64级",
      0,
      guide ? -220 : -194,
      16,
      "#adbccc",
    );
    this.host.button(this.host.overlay, "查看成就", -190, -260, 290, 50, () =>
      this.host.showAchievements(),
    );
    this.host.button(this.host.overlay, "开始冒险", 190, -260, 290, 50, () =>
      this.host.restart(),
    );
  }
  showStageSelect(preview: StageId = this.host.selectedStage) {
    this.stagePreview = preview;
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay,0,0,1100,570,"#191e2d");
    this.host.text(this.host.overlay,"选择关卡",0,235,32,"#f3deac");
    this.host.text(this.host.overlay,"点击查看特点 · 通关前一关解锁",0,170,14,"#b9c8d5");
    const stages=Object.keys(STAGES).map(Number) as StageId[];
    const page=Math.floor(stages.indexOf(preview)/8),pages=Math.ceil(stages.length/8);
    for(const [i,stage] of stages.slice(page*8,page*8+8).entries()) {
      const x=(i%4-1.5)*252,y=100-Math.floor(i/4)*135,unlocked=this.host.progress.unlockedStage(stage);
      const label=this.host.button(this.host.overlay,"",x,y,236,116,()=>this.showStageSelect(stage));
      const card=label.node.parent!;
      this.host.text(card,`${stage===preview?"✓ ":""}${stage} · ${STAGES[stage].name}`,0,32,17,unlocked?"#f3deac":"#9ba5b1",224);
      const best=this.host.progress.data.stageBest?.[stage];
      this.host.text(card,unlocked?(best?.won?"已通关":"已解锁"):"未解锁",0,0,14,unlocked?"#a9cdbc":"#9ba5b1",180);
      this.host.text(card,!unlocked?`通关第${stage-1}关解锁`:best?`最佳 ${Math.floor(best.time/60).toString().padStart(2,"0")}:${Math.floor(best.time%60).toString().padStart(2,"0")}${best.won?" · 通关":" · 挑战"}`:"尚未挑战",0,-32,13,"#b9c8d5",180);
    }
    this.host.text(this.host.overlay,`${page+1}/${pages} 页`,0,190,16,"#b9c8d5",100);
    if(page>0)this.host.button(this.host.overlay,"上一页",-440,190,150,38,()=>this.showStageSelect(stages[(page-1)*8]));
    if(page+1<pages)this.host.button(this.host.overlay,"下一页",440,190,150,38,()=>this.showStageSelect(stages[(page+1)*8]));
    const guide=STAGE_GUIDES[preview];
    this.host.text(this.host.overlay,`${preview} · ${STAGES[preview].name} · 首领：${STAGES[preview].boss}`,0,-125,21,"#f3deac",1020);
    this.host.text(this.host.overlay,guide?.threat||"清理尸潮、积累武器，八分钟后迎战首领",0,-165,16,"#e8cc92",1020);
    this.host.text(this.host.overlay,guide?.builds||"尝试不同武器与分支，保留清路和反击空间",0,-194,15,"#a9cdbc",1020);
    this.host.button(this.host.overlay,"返回菜单",-190,-250,290,48,()=>this.host.showStart());
    const unlocked=this.host.progress.unlockedStage(preview);
    this.host.button(this.host.overlay,unlocked?"选择本关":`通关第${preview-1}关解锁`,190,-250,290,48,()=>{if(unlocked){this.host.selectedStage=preview;this.host.showStart();}});
  }
  showAchievements(page = 0) {
    page = Math.max(0, Math.min(Math.ceil(ACHIEVEMENTS.length/10)-1,page));
    this.host.overlay.destroyAllChildren();
    this.host.panel(this.host.overlay, 0, 0, 1100, 570, "#191e2d");
    this.host.text(
      this.host.overlay,
      `冒险成就 · ${this.host.progress.data.achievements.length}/${ACHIEVEMENTS.length} · ${page+1}/${Math.ceil(ACHIEVEMENTS.length/10)} 页`,
      0,
      225,
      32,
    );
    ACHIEVEMENTS.slice(page*10,page*10+10).forEach((a, i) => {
      const x = i<5 ? -260 : 260,
        y = 156 - (i % 5) * 75,
        done = this.host.progress.data.achievements.includes(a.id);
      this.host.text(
        this.host.overlay,
        `${done ? "✓" : "○"} ${a.name}`,
        x,
        y,
        22,
        done ? "#e8cc92" : "#b5c2cf",
        330,
      );
      this.host.text(this.host.overlay, a.description, x, y - 22, 16, "#adbccc", 330);
      this.host.text(
        this.host.overlay,
        this.host.progress.progressLine(a.id, this.host.started ? this.host.world : undefined),
        x,
        y - 43,
        15,
        done ? "#e8cc92" : "#8fcfbd",
        330,
      );
    });
    if(page>0)this.host.button(this.host.overlay,"上一页",-385,-237,180,46,()=>this.host.showAchievements(page-1));
    if((page+1)*10<ACHIEVEMENTS.length)this.host.button(this.host.overlay,"下一页",385,-237,180,46,()=>this.host.showAchievements(page+1));
    this.host.button(
      this.host.overlay,
      this.host.started ? "返回暂停" : "返回选择",
      0,
      -237,
      280,
      46,
      () => {
        if (this.host.started) {
          this.host.shown = "";
          this.host.menus();
        } else this.host.showStart();
      },
    );
  }
  menus() {
    if (this.host.confirmation) return;
    const w = this.host.world;
    if (w.state !== "upgrade") this.targetPicker = false;
    if (w.state === "won" && !this.host.victorySeen) {
      this.host.victorySeen = true;
      this.host.victoryTime = 2.2;
      this.host.sound("choose");
    }
    const state = (this.host.victoryTime > 0 ? "victory" : w.state) + (w.pauses.has("menu") ? "paused" : "");
    if (state === this.host.shown) return;
    this.host.shown = state;
    this.host.overlay.destroyAllChildren();
    if (state === "battle") return;
    this.host.clearInput();
    this.host.panel(this.host.overlay, 0, 0, 1180, 570, "#151b29");
    if(w.state === "starting") {
      this.host.text(this.host.overlay,"选择初始武器",0,210,34);
      this.host.text(this.host.overlay,"近战、远程、范围各一张 · 选定后开始8分钟冒险",0,160,19,"#a9cdbc");
      if(w.stageId===6)this.host.text(this.host.overlay,`本局遭遇：${FURNACE_WINDOWS.map(window=>furnaceEncounter(window.start,w.furnaceRoute)!.name).join(" → ")}`,0,125,16,"#e8cc92",1000);
      w.startingWeapons.forEach((skill,i)=>{
        const x=(i-1)*350;
        const partner=SYNTHESIS_RECIPES[skill] || Object.keys(SYNTHESIS_RECIPES).find(k=>SYNTHESIS_RECIPES[k as Skill]===skill);
        this.host.panel(this.host.overlay,x,0,325,220,"#293443");
        this.host.text(this.host.overlay,names[skill],x,65,27,colors[skill]);
        this.host.text(this.host.overlay,WEAPON_ROLES[skill],x,10,17,"#c6d4db",300);
        this.host.text(this.host.overlay,`组合伙伴：${partner ? names[partner as Skill] : "无"}`,x,-40,18,"#e8cc92",300);
        this.host.button(this.host.overlay,`${i+1} · 选择`,x,-150,280,48,()=>{w.chooseStartingWeapon(skill);this.host.shown="";this.host.menus();});
      });
      this.host.button(this.host.overlay,"返回选关",0,-240,280,44,()=>this.host.showStart());
      return;
    }
    if (this.host.victoryTime > 0) {
      this.host.text(this.host.overlay, w.stageId===5 ? "亡者君王已击败" : "首领已击败 · 通关成功", 0, 75, 42, "#e8cc92");
      this.host.text(this.host.overlay, w.stageId===5 ? "王庭远征完成 · 熔炉已开启" : `你击败了${STAGES[w.stageId].boss}`, 0, 0, 26);
      this.host.text(this.host.overlay, "正在整理战斗报告…", 0, -85, 19, "#adbccc");
    } else if (w.state === "evolution" && w.pendingEvolution) {
      const skill = w.pendingEvolution;
      this.host.text(this.host.overlay, "◇ 选择武器分支", 0, 208, 36);
      this.host.text(
        this.host.overlay,
        `${names[skill]} 10级 · 选清群或集火等不同路线 · ${weaponStatus(w,skill).condition}`,
        0,
        159,
        18,
        "#a7b8c5",
      );
      EVOLUTIONS[skill].forEach((e, i) => {
        const x = (i - (EVOLUTIONS[skill].length - 1) / 2) * 420;
        const p = this.host.panel(this.host.overlay, x, -12, 382, 300, "#303948");
        skillGlyph(
          this.host.make("EvolutionIcon", p).addComponent(Graphics),
          skill,
          0,
          94,
          26,
        );
        this.host.text(p, `${i + 1}  ${e.name}`, 0, 43, 27, colors[skill], 360);
        this.host.text(p, `${i===1?"◆ 独立进化":"◇ 组合路线"} · ${branchRole(skill,i)}`, 0, 16, 16, "#e9cf92", 350);
        this.host.text(p, e.description, 0, -38, 18, "#d5e0e5", 350);
        this.host.button(p, i===1?"选择独立进化":"选择组合路线", 0, -110, 295, 46, () => this.host.evolve(e.id));
      });
      this.host.button(this.host.overlay, "使用默认分支", 0, -220, 210, 42, () => {
        w.back();
        this.host.shown = "";
      });
    } else if (w.state === "upgrade") {
      if (this.targetPicker) { this.drawTargetPicker(); return; }
      const progress = w.growthProgress;
      this.host.text(this.host.overlay, "灵魂觉醒", 0, 210, 36);
      this.host.text(
        this.host.overlay,
        progress
          ? `${progress.locked ? "已锁定" : "推荐组合"} · ${names[progress.main]} ${w.skills[progress.main]}/10 + ${names[progress.partner]} ${w.skills[progress.partner]}/10 · 还需 ${progress.remaining} 次武器升级`
          : `武器 ${w.weaponCount}/${w.weaponSlots} · 组合伙伴仍占槽位 · 满槽可在暂停商店回收换装`,
        0,
        162,
        18,
        "#a7b8c5",
      );
      this.host.button(this.host.overlay, "选择目标组合", 330, -223, 250, 42, () => {
        this.targetPicker = true; this.host.shown = ""; this.host.menus();
      });
      if (w.buildTarget) this.host.button(this.host.overlay, "取消锁定", -330, -223, 210, 42, () => this.selectTarget(null));
      this.host.text(this.host.overlay, upgradeInventory(w), 0, 130, 16, "#b9d2dc", 980);
      w.cards.forEach((c, i) => {
        const x = (i - (w.cards.length - 1) / 2) * 350;
        const p = this.host.panel(this.host.overlay, x, -35, 328, 280, "#293443");
        p.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
          e.propagationStopped = true;
          this.host.choose(c);
        });
        const icon = this.host.make("SkillIcon", p).addComponent(Graphics);
        skillGlyph(icon, c, 0, 112, 23);
        const isSkill = SKILLS.includes(c as Skill);
        const lv = isSkill
          ? w.skills[c as Skill]
          : c === "repair"
            ? 0
            : w.passives[c as Passive];
        this.host.text(
          p,
          `${i + 1}  ${names[c]}`,
          0,
          43,
          25,
          colors[c] || "#e9cf92",
          306,
        );
        const nextLevel = Math.min(MAX_SKILL_LEVEL, lv + 1);
        if (isSkill) {
          const skill = c as Skill;
          const branch = lv >= MAX_SKILL_LEVEL && !w.evolutions[skill];
          const current = weaponFormName(skill, lv, !!w.evolutions[skill]);
          const next = weaponFormName(skill, nextLevel, !!w.evolutions[skill]);
          const pair = w.growthPair;
          const synergy=upgradeSynergy(w,skill);
          const lane = !lv && synergy.owned ? "已有配方伙伴 · 新武器" : skill === pair?.main ? "组合武器" : skill === pair?.partner ? "配方伙伴" : skill === w.buildWeapons[0] ? "主修" : skill === w.buildWeapons[1] ? "副修" : !lv ? "新武器" : "强化";
          const partner = SYNTHESIS_RECIPES[skill] || (Object.entries(SYNTHESIS_RECIPES).find(([,p]) => p === skill)?.[0] as Skill | undefined);
          this.host.text(p, `${lane} · ${lv}/${MAX_SKILL_LEVEL}`, 0, 76, 16, "#e8cc92", 300);
          this.host.text(p, branch ? "终极进化 · 选择流派分支" : !lv ? `获得 ${next}` : current === next ? `${current} · 强度提升` : `${current} → ${next}`, 0, 8, 16, "#e8cc92", 304);
          this.host.text(p, synergy.text || WEAPON_ROLES[skill], 0, -24, 14, synergy.owned?"#e9cf92":"#9edac8", 304);
        }
        this.host.text(p, cardText(c, lv), 0, -70, 14, "#c7d2dc", 302);
        this.host.button(
          p,
          isSkill
            ? lv >= MAX_SKILL_LEVEL && !w.evolutions[c as Skill]
              ? "终极进化"
              : lv
                ? "升级至 " + (lv + 1) + " 级"
                : "学习 · 立即释放"
            : "选择",
          0,
          -124,
          282,
          36,
          () => this.host.choose(c),
        );
      });
      this.host.button(
        this.host.overlay,
        `重抽（${w.refreshes}）`,
        0,
        -223,
        210,
        42,
        () => {
          w.refresh();
          this.host.shown = "";
        },
      );
    } else if (w.state === "won" || w.state === "lost") {
      const report = battleReport(w);
      this.host.text(
        this.host.overlay,
        w.state === "won" ? "通关成功 · 首领已击败" : report.bossRemaining !== null ? `挑战失败 · 首领还剩 ${report.bossRemaining}% 生命` : "挑战失败 · 战斗报告",
        0,
        215,
        32,
      );
      this.host.text(
        this.host.overlay,
        `存活 ${this.host.clock(w.time)} · 击败 ${w.kills} · 等级 ${w.level}${report.phase ? ` · 首领第 ${report.phase} 阶段` : ""} · 总伤害 ${Math.round(report.total)}`,
        0,
        167,
        21,
      );
      this.host.text(this.host.overlay, "武器 · ◇组合分支 · ◆独立 · ∞联动", -285, 120, 16, "#adbccc", 365);
      this.host.text(this.host.overlay, "有效伤害 / 占比", 60, 120, 19, "#adbccc", 280);
      this.host.text(this.host.overlay, "击杀", 370, 120, 19, "#adbccc", 100);
      report.rows.forEach((row, i) => {
        const y = 90 - i * 29;
        this.host.panel(this.host.overlay, 0, y, 940, 26, "#26323f");
        this.host.text(
          this.host.overlay,
          `${row.name} · ${row.stage}`,
          -285,
          y,
          15,
          colors[row.skill],
          365,
        );
        this.host.text(
          this.host.overlay,
          `${Math.round(row.damage)} · ${(row.share * 100).toFixed(1)}%${w.combinations.stats[row.skill] ? ` · 联动+${Math.round(w.combinations.stats[row.skill]!.damage)}/${w.combinations.stats[row.skill]!.triggers}次` : ""}`,
          60,
          y,
          15,
          "#f4e8d3",
          320,
        );
        this.host.text(this.host.overlay, `${row.kills}`, 370, y, 20, "#f4e8d3", 100);
      });
      this.host.text(
        this.host.overlay,
        `其他伤害 ${Math.round(report.otherDamage)} · 击杀 ${report.otherKills}  |  回复：药水 ${Math.round(w.healing.potion)} / 技能 ${Math.round(w.healing.repair)} / 蝙蝠 ${Math.round(w.expansion.healed)}`,
        0,
        -136,
        18,
        "#adbccc",
      );
      this.host.text(
        this.host.overlay,
        report.losses.length
          ? w.state === "lost" && report.deathSource
            ? `致命来源：${report.deathSource} · 下局建议：${report.retryTip}`
            : "主要受伤：" + report.losses.slice(0,3).map(r=>`${r.name} ${Math.round(r.damage)}`).join(" / ")
          : "本局未受到伤害",
        0,
        -173,
        18,
        "#edb5ad",
      );
      this.host.text(this.host.overlay, this.host.progress.bestLine(w.stageId), 0, -77, 14, "#e8cc92", 940);
      this.host.text(this.host.overlay, report.comboTriggers
        ? `组合联动 · 额外伤害 ${Math.round(report.comboDamage)} · 触发 ${report.comboTriggers} 次（已计入总伤害）`
        : "组合联动 · 本局尚未触发", 0, -103, 17, "#9edac8", 940);
      this.host.button(this.host.overlay, "再战一局", -175, -247, 250, 50, () =>
        this.host.restart(),
      );
      this.host.text(
        this.host.overlay,
        this.host.runUnlocks.length
          ? "新解锁：" + this.host.runUnlocks.join(" / ")
          : `本局成就 +${this.host.runEarned.length} · 累计 ${this.host.progress.data.achievements.length}/${ACHIEVEMENTS.length}${this.host.progress.pending ? " · 保存待重试" : ""}`,
        0,
        -208,
        17,
        "#e8cc92",
      );
      this.host.button(this.host.overlay, "返回选关页面", 175, -247, 250, 50, () =>
        this.host.showStart(),
      );
    } else {
      if (w.shopOpen) {
        this.host.text(this.host.overlay, `补给商店 · 金币 ${w.gold} · 装备 ${w.weaponCount}/${w.weaponSlots}`, 0, 225, 26, "#e8cc92");
        (["buy", "sell", "fusion"] as const).forEach((tab, i) => {
          this.host.button(this.host.overlay, ({buy:"购买补给",sell:"回收装备",fusion:"∞ 组合图鉴"})[tab] + (this.host.shopTab === tab ? " ·" : ""), (i-1)*300, 155, 270, 52, () => { this.host.shopTab=tab; this.host.pendingShopAction=null; this.host.shown=""; });
        });
        const pending = this.host.pendingShopAction;
        if (pending) {
          const sacrifice = pending.skill;
          this.host.text(this.host.overlay, "确认回收装备", 0, 65, 27);
          this.host.text(this.host.overlay, `将失去 ${names[sacrifice]} Lv.${w.skills[sacrifice]} 及其进化`, 0, 8, 21, "#f1b9a9", 900);
          this.host.text(this.host.overlay, "获得 3 金币；该装备的攻击与效果立即移除", 0, -42, 19, "#c7d2dc", 900);
          this.host.button(this.host.overlay, "取消", -160, -112, 260, 56, () => {this.host.pendingShopAction=null;this.host.shown="";});
          this.host.button(this.host.overlay, "确认回收", 160, -112, 260, 56, () => {w.sellShop(pending.skill);this.host.pendingShopAction=null;this.host.shown="";});
        } else if (this.host.shopTab === "buy") {
          w.shopItems.forEach((s,i) => {
            const x=(i-1.5)*250, lv=w.skills[s];
            this.host.panel(this.host.overlay,x,10,230,210,"#26323f");
            this.host.text(this.host.overlay,names[s],x,78,20,colors[s],220);
            this.host.text(this.host.overlay,`${lv ? `Lv.${lv} → ${lv+1}` : "学习武器"} · ${w.shopCost(s)} 金`,x,38,17,"#c7d2dc",220);
            this.host.button(this.host.overlay,w.shopBuyReason(s)||"购买",x,-12,204,52,()=>{w.buyShop(s);this.host.shown="";});
            this.host.button(this.host.overlay,w.shopLocked.includes(s)?"已锁定":"锁定",x,-70,204,44,()=>{w.toggleShopLock(s);this.host.shown="";});
          });
          if (!w.shopItems.length) this.host.text(this.host.overlay,"本批补给已售罄，可付费刷新",0,20,24);
          this.host.button(this.host.overlay,`刷新 · 2 金 · 剩 ${w.shopRefreshes} 次`,0,-136,360,48,()=>{w.refreshShop();this.host.shown="";});
        } else if (this.host.shopTab === "sell") {
          SKILLS.filter(s=>w.skills[s]).forEach((s,i)=>{
            const x=(i%3-1)*330,y=65-Math.floor(i/3)*115;
            this.host.panel(this.host.overlay,x,y,310,100,"#26323f");
            this.host.text(this.host.overlay,`${names[s]} Lv.${w.skills[s]}`,x,y+24,18,colors[s],300);
            this.host.button(this.host.overlay,w.weaponCount<=1?"保留最后武器":"回收 +3 金",x,y-20,280,44,()=>{if(w.weaponCount<=1)w.sellShop(s);else this.host.pendingShopAction={type:"sell",skill:s};this.host.shown="";});
          });
        } else {
          this.host.text(this.host.overlay,"配方双方选择第一分支并满10级 → 自动组合超武",0,94,20,"#c7d2dc");
          this.host.text(this.host.overlay,"◇ 第一分支可组合 · ◆ 第二分支独立进化 · ∞ 超武联动",0,52,18,"#e8cc92");
          combinationRecipes(w).forEach((recipe,i)=>{
            this.host.text(this.host.overlay,`${recipe.blocked?"◆ 独立路线":recipe.ready?"∞ 已激活":"未达成"} · ${recipe.label} · ${recipe.progress}`,0,10-i*24,16,recipe.ready?"#e8cc92":"#a7b8c5",1000);
          });
        }
        if(this.host.shopTab!=="fusion")this.host.text(this.host.overlay,w.shopMessage,0,-190,17,"#e8cc92",1020);
        this.host.button(this.host.overlay,"返回暂停菜单",-230,-247,400,54,()=>{w.closeShop();this.host.pendingShopAction=null;this.host.shown="";});
        this.host.button(this.host.overlay,"继续冒险",230,-247,400,54,()=>this.host.togglePause());
        return;
      }
      this.host.text(this.host.overlay, "已暂停", 0, 180, 36);
      this.host.muteButton(445, 225, false);
      this.host.text(this.host.overlay, "移动拾取结晶 · 升级选择秘术\n空格全收场上经验 · 躲开红色预警", -230, -152, 17, "#adbccc", 440);
      this.host.text(
        this.host.overlay,
        SKILLS.filter((k) => w.skills[k])
          .map(
            (k) =>
              `${names[k]} ${w.skills[k]}级 · ${weaponStatus(w,k).branch ? weaponStatus(w,k).icons+" "+weaponStatus(w,k).branch : "未选分支"}`,
          )
          .join("\n"),
        -230,
        80,
        18,
        "#c7d2dc",
        440,
      );
      const combos=combinationRecipes(w).filter(r=>r.ready);
      this.host.text(this.host.overlay,combos.length?combos.map(r=>`∞ ${r.label}`).join("\n"):"◇ 第一分支可组合\n◆ 第二分支独立进化，不参与联动",-230,-75,14,"#e8cc92",470);
      this.host.button(this.host.overlay, "继续冒险", 280, 88, 270, 48, () =>
        this.host.togglePause(),
      );
      if (!w.shopOpen) this.host.button(this.host.overlay, "打开补给商店", 280, 26, 270, 48, () => {
        this.host.shopTab="buy"; this.host.pendingShopAction=null; w.openShop(); this.host.shown = "";
      });
      this.host.button(this.host.overlay, "重新开始", 280, -36, 270, 48, () =>
        this.host.confirmAbandon("restart"),
      );
      this.host.button(this.host.overlay, "返回选关页面", 280, -98, 270, 48, () =>
        this.host.confirmAbandon("selection"),
      );
      this.host.button(this.host.overlay, "本局成就进度", 280, -160, 270, 48, () =>
        this.host.showAchievements(),
      );
    }
  }
  muteButton(x: number, y: number, start: boolean) {
    this.host.button(this.host.overlay,this.host.preferences.powerSaving ? "省电优先" : "流畅优先",x-180,y,160,40,()=>{
      this.host.preferences.togglePowerSaving();this.host.applyFrameRate();
      if(start)this.host.showStart();else{this.host.shown="";this.host.menus();}
    });
    this.host.button(this.host.overlay, this.host.preferences.muted ? "声音：关" : "声音：开", x, y, 160, 40, () => {
      this.host.preferences.toggleMute();
      if (start) this.host.showStart();
      else { this.host.shown = ""; this.host.menus(); }
    });
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
    this.host.text(this.host.overlay, "本局战斗无法继续，已获得的成就会保留。", 0, 20, 22);
    this.host.button(this.host.overlay, "取消", -170, -95, 250, 55, () => this.host.cancelConfirmation());
    this.host.button(this.host.overlay, "确认结束", 170, -95, 250, 55, () => {
      this.host.syncProgress();
      this.host.progress.flush();
      if (action === "restart") this.host.restart(); else this.host.showStart();
    });
  }
}
