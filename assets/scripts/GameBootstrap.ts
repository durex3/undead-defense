import { modInfo } from './battle/ArmoryConfig';
import { nextPlaySpeed, PlaySpeed } from "./battle/PlaySpeed";
import { GameMenus } from "./presentation/GameMenus";
import { MenuWidgets } from "./presentation/MenuWidgets";
import { battleHud, clock } from "./presentation/BattleHud";

import { STAGES } from "./battle/StageRules";
import { PlayPreferences } from "./platform/PlayPreferences";
import { ProgressStore } from "./platform/ProgressStore";
import {
  CHARACTERS,
  STAGE_IDS,
  CharacterId,
  StageId,
} from "./battle/ProgressionConfig";

import { battleReport } from "./battle/BattleReport";
import {
  _decorator,
  sys,
  Component,
  Node,
  Camera,
  Canvas,
  UITransform,
  Label,
  Color,
  Graphics,
  Layers,
  resources,
  input,
  Input,
  EventTouch,
  EventKeyboard,
  KeyCode,
  view,
  screen,
  ResolutionPolicy,
  game,
  Game,
  profiler,
  AudioSource,
  AudioClip,
} from "cc";
import { DEBUG, WECHAT } from "cc/env";
import { SurvivalWorld } from "./battle/SurvivalWorld";
import { Card, Skill, NAMES as names, COLORS as colors } from "./battle/SurvivalConfig";
import { BattlePainter } from "./presentation/BattlePainter";
import { ink } from "./presentation/art/Ink";
import { drawStageMap } from "./presentation/StageMapPainter";
import { CombatFeedback, FEEDBACK_SOUNDS } from "./presentation/CombatFeedback";
const { ccclass } = _decorator;
@ccclass("GameBootstrap")
export class GameBootstrap extends Component {
  world = new SurvivalWorld(Date.now(), "ranger", 1);
  private progress = new ProgressStore(sys.localStorage);
  private preferences = new PlayPreferences(sys.localStorage);
  private touchMode = sys.isMobile;
  private victoryTime = 0;
  private victorySeen = false;
  private confirmation: "restart" | "selection" | null = null;
  private selectedCharacter: CharacterId = "ranger";
  private selectedStage: StageId = 1;
  private runUnlocks: string[] = [];
  private progressNotice = "";
  private saveRetry = 0;
  private ui!: Node;
  private stage!: Node;
  private mapLayer!: Node;
  private mapGraphics!: Graphics;
  private hud!: Node;
  private overlay!: Node;
  private fx!: Graphics;
  private bars!: Graphics;
  private bossHealthLabel!: Label;
  private joy!: Graphics;
  private stats!: Label;
  private hint!: Label;
  private weapons!: Label;
  private novaLabel!: Label;
  private painter!: BattlePainter;
  private announcement!: Label;
  private announcementLife = 0;
  private modBanner!: Node;
  private modTitle!: Label;
  private modSubtitle!: Label;
  private modLife = 0;
  private feedbackClock = 0;
  private feedback = new CombatFeedback();
  private reveal = 0;
  private keys = new Set<number>();
  private finger: number | null = null;
  private origin = { x: 0, y: 0 };
  private stick = { x: 0, y: 0 };
  private playSpeed: PlaySpeed = 1;
  private speedLabel!: Label;
  private camera = { x: 0, y: 0 };
  private acc = 0;
  private shown = "";
  private ready = false;
  private started = false;
  private shake = 0;
  private screenW = 1280;
  private screenH = 720;
  private audio!: AudioSource;
  private sounds = new Map<string, AudioClip>();
  private lastSound = 0;
  async start() {
    this.applyFrameRate();
    profiler.hideStats();
    view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
    this.ui = this.make("Canvas", this.node);
    this.ui.getComponent(UITransform)!.setContentSize(1280, 720);
    const canvas = this.ui.addComponent(Canvas);
    const cn = new Node("Camera");
    this.node.addChild(cn);
    cn.setPosition(0, 0, 1000);
    const cam = cn.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.orthoHeight = 360;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = new Color(19, 22, 30, 255);
    cam.visibility = Layers.Enum.UI_2D;
    canvas.cameraComponent = cam;
    this.screenW = view.getVisibleSize().width;
    this.screenH = view.getVisibleSize().height;
    this.stage = this.make("World", this.ui);
    this.hud = this.make("HUD", this.ui);
    this.overlay = this.make("Overlay", this.ui);
    this.text(this.overlay, "正在点亮地牢…", 0, 0, 26);
    this.audio = this.node.addComponent(AudioSource);
    for (const key of ["impact", "choose", "ultimate", "shot", ...FEEDBACK_SOUNDS])
      resources.load("audio/" + key, AudioClip, (err, a) => {
        if (!err) this.sounds.set(key, a);
      });
    try {
      // Each stage paints its own floor and landmarks; no shared dungeon backdrop.
      this.mapLayer = this.make("StageMap", this.stage);
      this.mapLayer.setSiblingIndex(0);
      this.mapGraphics = this.mapLayer.addComponent(Graphics);
      this.fx = this.make("Effects", this.stage).addComponent(Graphics);
      this.painter = new BattlePainter(this.fx);
      this.bars = this.make("Bars", this.hud).addComponent(Graphics);
      this.joy = this.make("Joystick", this.hud).addComponent(Graphics);
      this.panel(
        this.hud,
        0,
        this.screenH / 2 - 39,
        this.screenW,
        64,
        "#151923",
      );
      this.stats = this.text(this.hud, "", 0, this.screenH / 2 - 42, 23);
      this.bossHealthLabel = this.text(this.hud, "", 0, this.screenH / 2 - 91, 17, "#ffe3dc", Math.max(200, this.screenW - 320));
      this.hint = this.text(
        this.hud,
        "",
        0,
        -this.screenH / 2 + 33,
        17,
        "#adb9c7",
      );
      this.weapons = this.text(
        this.hud,
        "",
        0,
        -this.screenH / 2 + 92,
        16,
        "#e8cc92",
        860,
      );
      this.button(
        this.hud,
        "暂停",
        this.screenW / 2 - 86,
        this.screenH / 2 - 107,
        110,
        this.touchMode ? 80 : 40,
        () => this.togglePause(),
      );
      this.speedLabel = this.button(this.hud, "倍速 ×1", -this.screenW / 2 + 86, this.screenH / 2 - 107, 110, this.touchMode ? 80 : 40, () => this.cycleSpeed());
      this.novaLabel = this.button(
        this.hud,
        "全收经验 [空格]",
        this.screenW / 2 - 112,
        -this.screenH / 2 + 78,
        174,
        this.touchMode ? 84 : 56,
        () => {
          if (this.world.useUltimate()) this.sound("choose");
        },
      );
      this.announcement = this.text(this.hud, "", 0, 227, 26, "#f5da9e");
      this.modBanner = this.make("ModificationBanner", this.hud);
      this.modBanner.setPosition(0, this.screenH / 2 - 210);
      const banner = this.modBanner.addComponent(Graphics);
      banner.fillColor = new Color(18, 25, 38, 190);
      banner.roundRect(-320, -38, 640, 76, 10); banner.fill();
      this.modTitle = this.text(this.modBanner, "", 0, 13, 24, "#fff2c3", 620);
      this.modSubtitle = this.text(this.modBanner, "", 0, -19, 16, "#c4e8e0", 620);
      this.modBanner.active = false;
      this.ready = true;
      this.showStart();
    } catch (e) {
      this.overlay.destroyAllChildren();
      this.text(this.overlay, "资源加载失败，请刷新重试", 0, 0, 24);
      console.error(e);
    }
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.KEY_UP, this.keyUp, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
    input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
    game.on(Game.EVENT_HIDE, this.hide, this);
    if (typeof window !== "undefined")
      window.addEventListener("blur", this.hide);
    if (DEBUG) (globalThis as any).__undead = this;
  }
  private make(name: string, parent: Node) {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    parent.addChild(n);
    n.addComponent(UITransform);
    return n;
  }
  private widgets = new MenuWidgets((name, parent) => this.make(name, parent));
  private text(...args: Parameters<MenuWidgets["text"]>) { return this.widgets.text(...args); }
  private panel(...args: Parameters<MenuWidgets["panel"]>) { return this.widgets.panel(...args); }
  private button(...args: Parameters<MenuWidgets["button"]>) { return this.widgets.button(...args); }
  private clearInput() {
    this.keys.clear();
    this.finger = null;
    this.stick = { x: 0, y: 0 };
    this.world.setMove(0, 0);
    this.joy?.clear();
  }
  private hide = () => {
    this.syncProgress();
    this.progress.flush();
    this.clearInput();
    if (this.started && this.world.active) {
      this.world.pause("menu", true);
      this.shown = "";
    }
  };
  private keyDown(e: EventKeyboard) {
    this.touchMode = false;
    if (this.confirmation) {
      if (e.keyCode === KeyCode.ESCAPE) this.cancelConfirmation();
      return;
    }
    if (this.menuScreens.handleTargetKey(e.keyCode)) return;
    if (this.keys.has(e.keyCode)) return;
    this.keys.add(e.keyCode);
    if (!this.started) {
      if (e.keyCode === KeyCode.ENTER) this.restart();
      else if (e.keyCode === KeyCode.ESCAPE) this.showStart();
      else {
        const i = [KeyCode.DIGIT_1, KeyCode.DIGIT_2, KeyCode.DIGIT_3].indexOf(
          e.keyCode,
        );
        const id = (Object.keys(CHARACTERS) as CharacterId[])[i];
        if (id && this.progress.unlockedCharacter(id)) {
          this.selectedCharacter = id;
          this.showStart();
        }
      }
      return;
    }
    if(this.world.state === "starting") {
      const index=[KeyCode.DIGIT_1,KeyCode.DIGIT_2,KeyCode.DIGIT_3].indexOf(e.keyCode);
      if(index>=0 && this.world.startingWeapons[index])this.world.chooseStartingWeapon(this.world.startingWeapons[index]);
      return;
    }
    if(this.world.state === "tactical") {
      const index=[KeyCode.DIGIT_1,KeyCode.DIGIT_2,KeyCode.DIGIT_3].indexOf(e.keyCode);
      const choice=this.world.tacticalChoices[index];
      if(choice)this.world.chooseTacticalBlessing(choice.id);
      return;
    }
    if (e.keyCode === KeyCode.ESCAPE) {
      if (this.world.state === "modification") {
        /* Modification choices require an explicit selection. */
        this.shown = "";
      } else this.togglePause();
    }
    if (e.keyCode === KeyCode.SPACE && this.world.active && this.started) {
      if (this.world.useUltimate()) this.sound("choose");
    }
    if (this.world.state === "modification") {
      const i = [KeyCode.DIGIT_1, KeyCode.DIGIT_2, KeyCode.DIGIT_3, KeyCode.DIGIT_4].indexOf(e.keyCode);
      const skill = this.world.pendingModification;
      const evo = skill ? this.world.modOptions()[i] : undefined;
      if (evo) this.chooseMod(evo.id);
    } else if (this.world.state === "upgrade") {
      const index = [KeyCode.DIGIT_1, KeyCode.DIGIT_2, KeyCode.DIGIT_3].indexOf(
        e.keyCode,
      );
      if (index >= 0 && this.world.cards[index])
        this.choose(this.world.cards[index]);
    }
  }
  private keyUp(e: EventKeyboard) {
    this.keys.delete(e.keyCode);
  }
  private touchStart(e: EventTouch) {
    this.touchMode = true;
    if (!this.started || !this.world.active || this.finger !== null) return;
    const p = e.getUILocation();
    // Exclude actual buttons only, not the entire right-hand movement strip.
    const pauseHit=p.x>this.screenW-150 && p.y>this.screenH-152 && p.y<this.screenH-62;
    const novaHit=p.x>this.screenW-210 && p.y<126;
    if (pauseHit || novaHit || p.y > this.screenH - 75) return;
    this.finger = e.getID();
    this.origin = { x: p.x - this.screenW / 2, y: p.y - this.screenH / 2 };
    this.stick = { x: 0, y: 0 };
  }
  private touchMove(e: EventTouch) {
    if (e.getID() !== this.finger) return;
    const p = e.getUILocation();
    const x = p.x - this.screenW / 2 - this.origin.x,
      y = p.y - this.screenH / 2 - this.origin.y;
    const d = Math.hypot(x, y);
    this.stick =
      d < 8
        ? { x: 0, y: 0 }
        : { x: x / Math.max(55, d), y: y / Math.max(55, d) };
  }
  private touchEnd(e: EventTouch) {
    if (e.getID() === this.finger) {
      this.finger = null;
      this.stick = { x: 0, y: 0 };
    }
  }
  private togglePause() {
    if (this.confirmation) return;
    if (!this.started || this.world.state !== "battle") return;
    this.world.pause("menu", !this.world.pauses.has("menu"));
    this.clearInput();
    this.shown = "";
  }
  private syncProgress() {
    const before = (Object.keys(CHARACTERS) as CharacterId[]).filter((id) =>
      this.progress.unlockedCharacter(id),
    );
    const stageBefore = STAGE_IDS.filter(id=>this.progress.unlockedStage(id));
    const accountNotices=this.progress.observe(this.world);
    const unlocks = (Object.keys(CHARACTERS) as CharacterId[])
      .filter(
        (id) => !before.includes(id) && this.progress.unlockedCharacter(id),
      )
      .map((id) => CHARACTERS[id].name);
    for (const id of STAGE_IDS)
      if (!stageBefore.includes(id) && this.progress.unlockedStage(id)) unlocks.push(STAGES[id].name);
    unlocks.push(...accountNotices);
    this.runUnlocks.push(...unlocks);
    if (unlocks.length)
      this.progressNotice = "解锁成功 · " + unlocks.join(" / ");

  }
  restart() {
    this.victoryTime = 0;
    this.victorySeen = false;
    this.confirmation = null;
    if (!this.progress.unlockedCharacter(this.selectedCharacter))
      this.selectedCharacter = "ranger";
    if (!this.progress.unlockedStage(this.selectedStage))
      this.selectedStage = 1;
    this.world = new SurvivalWorld(
      Date.now(),
      this.selectedCharacter,
      this.selectedStage,
      this.progress.weaponSlots,
    );
    this.world.availableWeapons=this.progress.availableWeapons;
    this.world.weaponGrades=this.progress.weaponGrades;
    this.world.offerStartingWeapons();
    this.runUnlocks = [];
    this.progressNotice = "";
    this.started = true;
    drawStageMap(this.mapGraphics, this.selectedStage);
    this.camera = { x: this.world.player.x*48, y: this.world.player.y*48 };
    this.playSpeed=1;if(this.speedLabel)this.speedLabel.string="倍速 ×1";
    this.painter.reset();
    this.announcementLife = 0;
    this.announcement.string = "";
    this.modLife = 0;
    this.modBanner.active = false;
    this.feedbackClock = 0;
    this.feedback.reset();
    this.reveal = 0;
    this.lastSound = 0;
    this.shown = "";
    this.acc = 0;
    this.clearInput();
    this.overlay.destroyAllChildren();
  }
  private choose(c: Card) {
    if (this.world.choose(c)) {
      this.clearInput();
      this.sound("choose");
      if (this.world.state !== "modification") this.reveal = 0.3;
      this.shown = "";
    }
  }
  private chooseMod(id: string) {
    if (this.world.chooseMod(id)) {
      this.syncProgress();
      this.clearInput();
      this.reveal = 0.3;
      this.shown = "";
    }
  }
  private menuScreens: GameMenus = new GameMenus(this.menuContext());
  menuContext() {
    const owner = this;
    return {
      button: owner.button.bind(owner),
      cancelConfirmation: owner.cancelConfirmation.bind(owner),
      choose: owner.choose.bind(owner),
      clearInput: owner.clearInput.bind(owner),
      clock: owner.clock.bind(owner),
      confirmAbandon: owner.confirmAbandon.bind(owner),
      get confirmation() { return owner.confirmation; },
      set confirmation(value) { owner.confirmation = value; },
      chooseMod: owner.chooseMod.bind(owner),
      make: owner.make.bind(owner),
      menus: owner.menus.bind(owner),
      muteButton: owner.muteButton.bind(owner),
      get overlay() { return owner.overlay; },
      panel: owner.panel.bind(owner),
      get preferences() { return owner.preferences; },
      applyFrameRate: owner.applyFrameRate.bind(owner),
      get progress() { return owner.progress; },
      restart: owner.restart.bind(owner),
      get runUnlocks() { return owner.runUnlocks; },
      get selectedCharacter() { return owner.selectedCharacter; },
      set selectedCharacter(value) { owner.selectedCharacter = value; },
      get selectedStage() { return owner.selectedStage; },
      set selectedStage(value) { owner.selectedStage = value; },
      showStart: owner.showStart.bind(owner),
      get shown() { return owner.shown; },
      set shown(value) { owner.shown = value; },
      sound: owner.sound.bind(owner),
      get started() { return owner.started; },
      set started(value) { owner.started = value; },
      syncProgress: owner.syncProgress.bind(owner),
      text: owner.text.bind(owner),
      togglePause: owner.togglePause.bind(owner),
      get touchMode() { return owner.touchMode; },
      get victorySeen() { return owner.victorySeen; },
      set victorySeen(value) { owner.victorySeen = value; },
      get victoryTime() { return owner.victoryTime; },
      set victoryTime(value) { owner.victoryTime = value; },
      get world() { return owner.world; },
    };
  }
  private showStart() { return this.menuScreens.showStart(); }
  private menus() { return this.menuScreens.menus(); }
  private muteButton(x: number, y: number, start: boolean) { return this.menuScreens.muteButton(x, y, start); }
  private cancelConfirmation(): void { return this.menuScreens.cancelConfirmation(); }
  private confirmAbandon(action: "restart" | "selection") { return this.menuScreens.confirmAbandon(action); }
  private clock(t: number) { return clock(t); }
  private sound(key: string, volume?: number) {
    if (this.preferences.muted) return;
    const c = this.sounds.get(key);
    if (c) this.audio.playOneShot(c, volume ?? (key === "impact" ? 0.12 : 0.25));
  }
  private cycleSpeed() {
    if(!this.started || !this.world.active)return;
    this.playSpeed=nextPlaySpeed(this.playSpeed);this.speedLabel.string=`倍速 ×${this.playSpeed}`;
  }
  private applyFrameRate() {
    game.frameRate = (sys.isMobile || WECHAT) && this.preferences.powerSaving ? 30 : 60;
  }
  update(dt: number) {
    if (!this.ready) return;
    dt = Math.min(dt, 0.1);
    this.feedbackClock += dt;
    this.victoryTime = Math.max(0, this.victoryTime - dt);
    const w = this.world;
    if (this.started) {
      w.camera = { x: this.camera.x / 48, y: this.camera.y / 48 };
      const frame = screen.windowSize;
      w.viewport = {
        x: (7.5 * frame.width) / Math.max(1, frame.height),
        y: 7.5,
      };
      const k = this.keys;
      w.setMove(
        this.stick.x +
          Number(k.has(KeyCode.KEY_D) || k.has(KeyCode.ARROW_RIGHT)) -
          Number(k.has(KeyCode.KEY_A) || k.has(KeyCode.ARROW_LEFT)),
        this.stick.y +
          Number(k.has(KeyCode.KEY_W) || k.has(KeyCode.ARROW_UP)) -
          Number(k.has(KeyCode.KEY_S) || k.has(KeyCode.ARROW_DOWN)),
      );
      if (this.reveal > 0) {
        this.reveal -= dt;
      } else if(w.active) this.acc += dt*this.playSpeed;
      else this.acc=0;
      while (this.acc >= 1 / 60) {
        w.step(1 / 60);
        this.acc -= 1 / 60;
      }
      this.syncProgress();
      this.menus();
    }
    const f = 1 - Math.exp(-dt * 11 * (w.active?this.playSpeed:1));
    this.camera.x +=
      (Math.max(-512, Math.min(512, w.player.x * 48)) - this.camera.x) * f;
    this.camera.y +=
      (Math.max(-984, Math.min(984, w.player.y * 48)) - this.camera.y) * f;
    this.shake = Math.max(0, this.shake - dt * 20);
    this.stage.setPosition(
      -this.camera.x + Math.sin(w.time * 73) * this.shake,
      -this.camera.y + Math.cos(w.time * 59) * this.shake,
    );
    const visiblePotions = w.potions.filter(p => p.expires === undefined || p.expires > w.time);
    const events = w.drain();
    // Modification feedback takes priority over routine shots/hits.
    for (const e of events.slice().sort((a,b) => Number(!!b.final) - Number(!!a.final))) {
      const cue = this.feedback.claim(e, this.feedbackClock);
      if (cue) {
        this.sound(cue.sound, cue.volume);
        this.shake = Math.max(this.shake, cue.shake);
      }
    }
    for (const e of events) {
      if (e.type === "supply") {
        this.announcement.string = "装备已满级 · 金币 +10 · 自动恢复生命";
        this.announcementLife = 2.2;
      }
      if (e.type === "playerHit") {
        this.shake = Math.max(this.shake, 5);
        this.announcement.string = `受伤 −${Math.round(e.value || 0)} · ${battleReport(w).deathSource}`;
        this.announcementLife = 1.3;
      }
      if (e.type === "modify" && !e.final) this.shake = Math.max(this.shake, e.value === 10 ? 6 : e.value === 7 ? 5 : 3);
      if (e.type === "modify" && e.final) {
        const skill = e.skill as Skill;
        const form = modInfo(skill,e.form||'');
        this.modTitle.string = `改造已安装 · ${form?.name || names[skill]}`;
        this.modTitle.color = new Color().fromHEX(colors[skill]);
        this.modSubtitle.string = form?.effect || '本武器攻击形态已改变';
        this.modLife=2.2;
      }
      if (e.type === "hit" && this.feedback.routineAllowed(this.feedbackClock) && w.time - this.lastSound > 0.1) {
        this.sound("impact");
        this.lastSound = w.time;
      }
      if (e.type === "cast" && this.feedback.routineAllowed(this.feedbackClock)) this.sound("shot");
      if (e.type === "learn") {
        const skill=e.skill as Skill;
        this.announcement.string=`${w.skills[skill]===1?'习得':'强化'} · ${names[skill]} ${w.skills[skill]}级`;
        this.announcementLife=1.6;
      }
      if (e.type === "bossPhase") {
        this.announcement.string = w.stageId===10 ? `${STAGES[w.stageId].boss} · ${e.value===3?"第三阶段 III":"第二阶段 II"}` : `${STAGES[w.stageId].boss}狂怒 · 第二阶段`;
        this.announcementLife = w.stageId===10?1.5:2.5;
      }
      if (e.type === "elite" || e.type === "boss") {
        this.announcement.string =
          e.type === "boss"
            ? `${STAGES[w.stageId].boss}降临`
            : "精英现身 · 留意攻击预警";
        this.announcementLife = 3;
      }
    }
    this.saveRetry -= dt;
    if ((this.progress.pending || this.preferences.pending) && this.saveRetry <= 0) {
      this.preferences.flush();
      this.progress.flush();
      this.saveRetry = 5;
    }
    if (this.progressNotice) {
      this.announcement.string = this.progressNotice;
      this.announcementLife = 3;
      this.progressNotice = "";
    }
    this.announcementLife -= dt;
    if (this.announcementLife <= 0) this.announcement.string = "";
    if (w.active) this.modLife = Math.max(0, this.modLife - dt);
    this.modBanner.active = this.started && w.active && this.modLife > 0;
    const entrance = Math.min(1, (2.6 - this.modLife) / 0.22);
    this.modBanner.setScale(0.92 + 0.08 * (1 - Math.pow(1 - entrance, 3)), 0.92 + 0.08 * (1 - Math.pow(1 - entrance, 3)), 1);
    // Keep the last frame while paused/menus are open instead of repainting an
    // unchanged battlefield every frame.
    if (w.active) this.painter.draw(w, dt, events, this.preferences.powerSaving);
    const b = this.bars;
    b.clear();
    this.rect(
      b,
      -this.screenW / 2,
      this.screenH / 2 - 9,
      this.screenW,
      9,
      "#293844",
    );
    this.rect(
      b,
      -this.screenW / 2,
      this.screenH / 2 - 9,
      this.screenW * Math.min(1, w.xp / w.xpNeed),
      9,
      "#66d7c2",
    );
    const hx = w.player.x * 48 - this.camera.x,
      hy = w.player.y * 48 - this.camera.y - 24;
    this.rect(b, hx - 25, hy, 50, 6, "#371f32");
    this.rect(b, hx - 25, hy, (50 * w.hp) / w.maxHp, 6, "#f18787");
    const hud = battleHud(w, this.touchMode, visiblePotions);
    this.bossHealthLabel.node.active = !!hud.bossHealth;
    if (hud.bossHealth) {
      this.bossHealthLabel.string = hud.bossHealth.label;
      const width = Math.max(200, this.screenW - 320);
      const y = this.screenH / 2 - 120;
      this.rect(b, -width / 2 - 2, y - 2, width + 4, 16, "#e8c6bc");
      this.rect(b, -width / 2, y, width, 12, "#381f2b");
      this.rect(b, -width / 2, y, width * hud.bossHealth.ratio, 12, "#ee697c");
    }
    this.stats.string = hud.stats;
    this.weapons.string = hud.weapons;
    this.hint.string = hud.hint;
    this.novaLabel.string = hud.nova;
    this.novaLabel.color = ink(w.ultimate > 0 ? "#adbccc" : "#9df5d5");
    this.joy.clear();
    if (this.finger !== null) {
      this.joy.strokeColor = ink("#dcebf0", 100);
      this.joy.lineWidth = 3;
      this.joy.circle(this.origin.x, this.origin.y, 55);
      this.joy.stroke();
      this.joy.fillColor = ink("#dcebf0", 100);
      this.joy.circle(
        this.origin.x + this.stick.x * 55,
        this.origin.y + this.stick.y * 55,
        20,
      );
      this.joy.fill();
    }
  }
  private rect(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) {
    g.fillColor = ink(color);
    g.rect(x, y, w, h);
    g.fill();
  }
  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.KEY_UP, this.keyUp, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
    input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
    game.off(Game.EVENT_HIDE, this.hide, this);
    if (typeof window !== "undefined")
      window.removeEventListener("blur", this.hide);
  }
}
