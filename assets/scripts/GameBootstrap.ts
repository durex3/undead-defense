import {starHeight} from "./battle/ObservatorySystem";
import { combinationLabel } from "./battle/WeaponStatus";
import { drawLateStage } from "./presentation/LateStagePainter";
import { GameMenus } from "./presentation/GameMenus";
import { MenuWidgets } from "./presentation/MenuWidgets";
import { battleHud, clock } from "./presentation/BattleHud";

import { drawCrown } from "./presentation/CrownPainter";
import { KING_PHASES } from "./battle/KingBossSystem";
import { drawChurch } from "./presentation/ChurchPainter";
import { drawAltar } from "./presentation/AltarPainter";
import { STAGES } from "./battle/StageRules";
import { PlayPreferences } from "./platform/PlayPreferences";
import { drawGarden } from "./presentation/GardenPainter";
import { ProgressStore } from "./platform/ProgressStore";
import {
  CHARACTERS,
  ACHIEVEMENTS,
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
  Sprite,
  SpriteFrame,
  Texture2D,
  Rect,
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
import { SYNTHESIS_RECIPES, MAX_ENEMIES, Card, Skill, NAMES as names, COLORS as colors, EVOLUTIONS, ENEMIES } from "./battle/SurvivalConfig";
import { BattlePainter } from "./presentation/BattlePainter";
import { CombatFeedback, FEEDBACK_SOUNDS } from "./presentation/CombatFeedback";
import { weaponFormName } from "./battle/WeaponForms";
import { drawBladeForm, drawGhostForm } from "./presentation/CompanionForms";
import { PIXELS } from "./presentation/PixelAtlas";
const { ccclass } = _decorator;
@ccclass("GameBootstrap")
export class GameBootstrap extends Component {
  world = new SurvivalWorld(Date.now());
  private progress = new ProgressStore(sys.localStorage);
  private preferences = new PlayPreferences(sys.localStorage);
  private touchMode = sys.isMobile;
  private shopTab: "buy" | "sell" | "fusion" = "buy";
  private pendingShopAction: { type: "sell"; skill: Skill } | null = null;
  private victoryTime = 0;
  private victorySeen = false;
  private confirmation: "restart" | "selection" | null = null;
  private selectedCharacter: CharacterId = "ranger";
  private selectedStage: StageId = 1;
  private runEarned: string[] = [];
  private runUnlocks: string[] = [];
  private progressNotice = "";
  private saveRetry = 0;
  private ui!: Node;
  private stage!: Node;
  private garden!: Node;
  private altarMap!: Node;
  private churchMap!: Node;
  private crownMap!: Node;
  private actors!: Node;
  private hud!: Node;
  private overlay!: Node;
  private fx!: Graphics;
  private bars!: Graphics;
  private joy!: Graphics;
  private stats!: Label;
  private hint!: Label;
  private weapons!: Label;
  private novaLabel!: Label;
  private frames = new Map<string, SpriteFrame>();
  private units = new Map<number, Node>();
  private pool: Node[] = [];
  private potions = new Map<number, Node>();
  private potionPool: Node[] = [];
  private hero!: Node;
  private blades: Node[] = [];
  private ghosts: Node[] = [];
  private painter!: BattlePainter;
  private announcement!: Label;
  private announcementLife = 0;
  private superBanner!: Node;
  private superTitle!: Label;
  private superSubtitle!: Label;
  private superLife = 0;
  private feedbackClock = 0;
  private feedback = new CombatFeedback();
  private reveal = 0;
  private keys = new Set<number>();
  private finger: number | null = null;
  private origin = { x: 0, y: 0 };
  private stick = { x: 0, y: 0 };
  private camera = { x: 0, y: 0 };
  private acc = 0;
  private shown = "";
  private ready = false;
  private started = false;
  private shake = 0;
  private screenW = 1280;
  private screenH = 720;
  private flashes = new Map<number, number>();
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
    this.actors = this.make("Actors", this.stage);
    this.hud = this.make("HUD", this.ui);
    this.overlay = this.make("Overlay", this.ui);
    this.text(this.overlay, "正在点亮地牢…", 0, 0, 26);
    this.audio = this.node.addComponent(AudioSource);
    for (const key of ["impact", "choose", "ultimate", "shot", ...FEEDBACK_SOUNDS])
      resources.load("audio/" + key, AudioClip, (err, a) => {
        if (!err) this.sounds.set(key, a);
      });
    try {
      const [atlas, ground] = await Promise.all([
        this.texture("atlas"),
        this.texture("ground"),
      ]);
      for (const [key, r] of Object.entries(PIXELS)) {
        const sf = new SpriteFrame();
        sf.texture = atlas;
        sf.rect = new Rect(r[0], r[1], r[2], r[3]);
        this.frames.set(key, sf);
      }
      const floor = this.make("Floor", this.stage);
      floor.setSiblingIndex(0);
      const sf = new SpriteFrame();
      sf.texture = ground;
      this.sprite(floor, sf, 2304, 2688);
      floor.getComponent(Sprite)!.color = new Color(175, 181, 193, 255);
      for (let i = 0; i < 24; i++) {
        const n = this.make("Pillar", this.stage);
        const side = i % 2 ? 1 : -1;
        n.setPosition(side * 1095, (Math.floor(i / 2) - 5.5) * 210);
        this.pixel(n, "column", 3);
      }
      this.garden = this.make("Garden", this.stage);
      this.garden.setSiblingIndex(1);
      drawGarden(this.garden.addComponent(Graphics));
      this.garden.active = false;
      this.altarMap = this.make("Altar", this.stage);
      this.altarMap.setSiblingIndex(2);
      drawAltar(this.altarMap.addComponent(Graphics));
      this.altarMap.active = false;
      this.churchMap = this.make("Church", this.stage);
      this.churchMap.setSiblingIndex(3);
      drawChurch(this.churchMap.addComponent(Graphics));
      this.churchMap.active = false;
      this.crownMap=this.make("Crown",this.stage);
      this.crownMap.setSiblingIndex(4);
      drawCrown(this.crownMap.addComponent(Graphics));
      this.crownMap.active=false;
      this.hero = this.make("Hero", this.actors);
      this.pixel(this.hero, "wizzard_m_idle_anim_f0", 3);
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
      this.superBanner = this.make("SuperweaponBanner", this.hud);
      this.superBanner.setPosition(0, this.screenH / 2 - 210);
      const banner = this.superBanner.addComponent(Graphics);
      banner.fillColor = new Color(18, 25, 38, 190);
      banner.roundRect(-320, -38, 640, 76, 10); banner.fill();
      this.superTitle = this.text(this.superBanner, "", 0, 13, 24, "#fff2c3", 620);
      this.superSubtitle = this.text(this.superBanner, "", 0, -19, 16, "#c4e8e0", 620);
      this.superBanner.active = false;
      this.prewarmEnemies();
      for(let i=0;i<3;i++) {
        const n=this.make("Health potion",this.stage);
        this.pixel(n,"flask_red",3);n.active=false;this.potionPool.push(n);
      }
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
  private texture(key: string) {
    return new Promise<Texture2D>((resolve, reject) =>
      resources.load("pixel/" + key + "/texture", Texture2D, (err, t) => {
        if (err) reject(err);
        else {
          t.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
          resolve(t);
        }
      }),
    );
  }
  private make(name: string, parent: Node) {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    parent.addChild(n);
    n.addComponent(UITransform);
    return n;
  }
  private sprite(n: Node, sf: SpriteFrame, w: number, h: number) {
    const s = n.getComponent(Sprite) || n.addComponent(Sprite);
    s.spriteFrame = sf;
    s.sizeMode = Sprite.SizeMode.CUSTOM;
    n.getComponent(UITransform)!.setContentSize(w, h);
  }
  private pixel(n: Node, key: string, scale = 3) {
    const sf = this.frames.get(key);
    if (sf) this.sprite(n, sf, sf.rect.width * scale, sf.rect.height * scale);
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
      else if (e.keyCode === KeyCode.KEY_C) this.showAchievements();
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
    if (e.keyCode === KeyCode.ESCAPE) {
      if (this.world.state === "evolution") {
        this.world.back();
        this.shown = "";
      } else this.togglePause();
    }
    if (e.keyCode === KeyCode.SPACE && this.world.active && this.started) {
      if (this.world.useUltimate()) this.sound("choose");
    }
    if (this.world.state === "evolution") {
      const i = [KeyCode.DIGIT_1, KeyCode.DIGIT_2].indexOf(e.keyCode);
      const skill = this.world.pendingEvolution;
      const evo = skill ? EVOLUTIONS[skill][i] : undefined;
      if (evo) this.evolve(evo.id);
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
    if (this.world.shopOpen) this.world.closeShop();
    this.pendingShopAction = null;
    this.world.pause("menu", !this.world.pauses.has("menu"));
    this.clearInput();
    this.shown = "";
  }
  private syncProgress() {
    const before = (Object.keys(CHARACTERS) as CharacterId[]).filter((id) =>
      this.progress.unlockedCharacter(id),
    );
    const stageBefore = [2,3,4,5,6,7,8,9,10].filter(id=>this.progress.unlockedStage(id as StageId));
    const earned = this.progress.observe(this.world);
    for (const id of earned)
      if (!this.runEarned.includes(id)) this.runEarned.push(id);
    const unlocks = (Object.keys(CHARACTERS) as CharacterId[])
      .filter(
        (id) => !before.includes(id) && this.progress.unlockedCharacter(id),
      )
      .map((id) => CHARACTERS[id].name);
    for (const id of [2,3,4,5,6,7,8,9,10] as StageId[])
      if (!stageBefore.includes(id) && this.progress.unlockedStage(id)) unlocks.push(STAGES[id].name);
    this.runUnlocks.push(...unlocks);
    if (unlocks.length)
      this.progressNotice = "解锁成功 · " + unlocks.join(" / ");
    else if (earned.length)
      this.progressNotice =
        "成就达成 · " +
        earned
          .map((id) => ACHIEVEMENTS.find((a) => a.id === id)!.name)
          .join(" / ");
  }
  private prewarmEnemies() {
    while(this.pool.length+this.units.size<MAX_ENEMIES) {
      const n=this.make("Enemy",this.actors);
      this.pixel(n,`${ENEMIES.minion.sprite}_anim_f0`,ENEMIES.minion.scale);
      n.active=false;this.pool.push(n);
    }
  }
  private releaseEnemy(id: number, n: Node) {
    n.active=false;n.setPosition(0,0,0);n.setScale(1,1,1);n.angle=0;
    const sprite=n.getComponent(Sprite);if(sprite)sprite.color=Color.WHITE;
    this.units.delete(id);this.flashes.delete(id);this.pool.push(n);
  }
  private releasePotion(id: number, n: Node) {
    n.active=false;n.setPosition(0,0,0);
    n.getComponent(Sprite)!.color=Color.WHITE;
    this.potions.delete(id);this.potionPool.push(n);
  }
  restart() {
    for(const [id,n] of this.units)this.releaseEnemy(id,n);
    for(const [id,n] of this.potions)this.releasePotion(id,n);
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
    this.world.offerStartingWeapons();
    this.runEarned = [];
    this.runUnlocks = [];
    this.progressNotice = "";
    this.started = true;
    this.garden.active = this.selectedStage === 2;
    this.altarMap.active = this.selectedStage === 3;
    this.churchMap.active = this.selectedStage === 4;
    this.crownMap.active = this.selectedStage >= 5;
    if(this.selectedStage>=5) {
      const graphics=this.crownMap.getComponent(Graphics)!;
      graphics.clear();
      if(this.selectedStage===5)drawCrown(graphics);else drawLateStage(graphics,this.selectedStage);
    }
    this.camera = { x: 0, y: 0 };
    this.painter.reset();
    this.announcementLife = 0;
    this.announcement.string = "";
    this.superLife = 0;
    this.superBanner.active = false;
    this.feedbackClock = 0;
    this.feedback.reset();
    this.reveal = 0;
    this.lastSound = 0;
    this.flashes.clear();
    this.shown = "";
    this.acc = 0;
    this.clearInput();
    this.overlay.destroyAllChildren();
  }
  private choose(c: Card) {
    if (this.world.choose(c)) {
      this.clearInput();
      this.sound("choose");
      if (this.world.state !== "evolution") this.reveal = 0.3;
      this.shown = "";
    }
  }
  private evolve(id: string) {
    if (this.world.evolve(id)) {
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
      evolve: owner.evolve.bind(owner),
      make: owner.make.bind(owner),
      menus: owner.menus.bind(owner),
      muteButton: owner.muteButton.bind(owner),
      get overlay() { return owner.overlay; },
      panel: owner.panel.bind(owner),
      get pendingShopAction() { return owner.pendingShopAction; },
      set pendingShopAction(value) { owner.pendingShopAction = value; },
      get preferences() { return owner.preferences; },
      applyFrameRate: owner.applyFrameRate.bind(owner),
      get progress() { return owner.progress; },
      restart: owner.restart.bind(owner),
      get runEarned() { return owner.runEarned; },
      get runUnlocks() { return owner.runUnlocks; },
      get selectedCharacter() { return owner.selectedCharacter; },
      set selectedCharacter(value) { owner.selectedCharacter = value; },
      get selectedStage() { return owner.selectedStage; },
      set selectedStage(value) { owner.selectedStage = value; },
      get shopTab() { return owner.shopTab; },
      set shopTab(value) { owner.shopTab = value; },
      showAchievements: owner.showAchievements.bind(owner),
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
  private showAchievements(page = 0) { return this.menuScreens.showAchievements(page); }
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
      } else this.acc += dt;
      while (this.acc >= 1 / 60) {
        w.step(1 / 60);
        this.acc -= 1 / 60;
      }
      this.syncProgress();
      this.menus();
    }
    const f = 1 - Math.exp(-dt * 11);
    this.camera.x +=
      (Math.max(-512, Math.min(512, w.player.x * 48)) - this.camera.x) * f;
    this.camera.y +=
      (Math.max(-984, Math.min(984, w.player.y * 48)) - this.camera.y) * f;
    this.shake = Math.max(0, this.shake - dt * 20);
    this.stage.setPosition(
      -this.camera.x + Math.sin(w.time * 73) * this.shake,
      -this.camera.y + Math.cos(w.time * 59) * this.shake,
    );
    const anim = Math.floor(w.time * 9) % 4;
    this.pixel(
      this.hero,
      `wizzard_m_${Math.hypot(w.move.x, w.move.y) > 0.1 ? "run" : "idle"}_anim_f${anim}`,
    );
    this.hero.setPosition(w.player.x * 48, w.player.y * 48 + 22);
    while (this.blades.length < w.bladeCount) {
      const n = this.make("Orbiting blade", this.stage);
      this.pixel(n, "weapon_rusty_sword", 3);
      this.make("WeaponForm", n).addComponent(Graphics);
      this.blades.push(n);
    }
    this.blades.forEach((n, i) => {
      const b = w.blades[i];
      n.active = !!b;
      if (b) {
        n.setPosition(b.x * 48, b.y * 48 + 12);
        n.angle = (b.angle * 180) / Math.PI - 90;
        n.getComponent(Sprite)!.enabled = w.skills.blade < 4 && !w.evolutions.blade;
        drawBladeForm(n.getChildByName("WeaponForm")!.getComponent(Graphics)!, w.skills.blade, w.evolutions.blade);
        n.getComponent(Sprite)!.color = w.evolutions.blade
          ? new Color(255, 226, 134)
          : Color.WHITE;
      }
    });
    while (this.ghosts.length < w.ghostCount) {
      const n = this.make("Spirit companion", this.stage);
      this.pixel(n, "ghost", 2.4);
      this.make("WeaponForm", n).addComponent(Graphics);
      this.ghosts.push(n);
    }
    this.ghosts.forEach((n, i) => {
      n.active = i < w.ghostCount;
      drawGhostForm(n.getChildByName("WeaponForm")!.getComponent(Graphics)!, w.skills.ghost, !!w.evolutions.ghost, w.time, w.evolutions.ghost);
      const a = (i * Math.PI * 2) / Math.max(1, w.ghostCount) + w.time * 0.7;
      n.setPosition(
        (w.player.x + Math.cos(a) * 0.85) * 48,
        (w.player.y + Math.sin(a) * 0.85) * 48 +
          36 +
          Math.sin(w.time * 4 + i) * 4,
      );
    });
    if (w.move.x) this.hero.setScale(w.move.x < 0 ? -1 : 1, 1, 1);
    this.hero.getComponent(Sprite)!.color =
      w.invulnerable > 0 && Math.floor(w.time * 18) % 2
        ? new Color(255, 130, 130)
        : w.character === "alchemist"
          ? new Color(166, 235, 202)
          : w.character === "necromancer"
            ? new Color(205, 178, 244)
            : Color.WHITE;
    const live = new Set(w.enemies.filter(e=>e.hp>0).map(e=>e.id));
    // Recycle old wave first: a 75-enemy replacement must not allocate a second 75 nodes.
    for(const [id,n] of this.units)if(!live.has(id))this.releaseEnemy(id,n);
    const visiblePotions = w.potions.filter(p=>p.expires === undefined || p.expires > w.time);
    for(const [id,n] of this.potions)
      if(!visiblePotions.some(p=>p.id===id))this.releasePotion(id,n);
    for (const p of visiblePotions) {
      let n = this.potions.get(p.id);
      if (!n) {
        n = this.potionPool.pop()!;
        if(!n)continue;
        n.active=true;
        this.potions.set(p.id, n);
      }
      n.setPosition(p.x * 48, p.y * 48 + 8);
      const fading = p.expires !== undefined && p.expires - w.time < 5;
      n.getComponent(Sprite)!.color = new Color(255,255,255,fading && Math.floor(w.time*6)%2 ? 100 : 255);
    }
    for (const e of w.enemies) {
      if(e.hp<=0)continue;
      let n = this.units.get(e.id);
      if (!n) {
        n = this.pool.pop()!;
        if(!n)continue;
        n.active = true;
        this.units.set(e.id, n);
      }
      const config =
        e.kind === "boss" && w.stageId >= 2
          ? { ...ENEMIES.boss, sprite: "necromancer", scale: 5.5 }
          : ENEMIES[e.kind];
      this.pixel(n, `${config.sprite}_anim_f${anim}`, config.scale);
      n.setPosition(e.x * 48, e.y * 48 + 20 + starHeight(e));
      n.setScale(Math.cos(e.facing) < 0 ? -1 : 1, 1, 1);
      n.getComponent(Sprite)!.color =
        (this.flashes.get(e.id) || 0) > w.time
          ? new Color(255, 180, 125)
          : e.slowUntil > w.time
            ? new Color(138, 215, 255)
            : e.kind === "boss" && w.stageId === 3 ? new Color("#ff9865") : e.kind === "boss" && w.stageId === 4 ? new Color("#a4d9ef") : e.kind === "boss" && w.stageId === 5 ? new Color("#ead7ad") : e.kind === "boss" && w.stageId === 6 ? new Color("#efaa70") : e.kind === "boss" && w.stageId === 7 ? new Color("#aab5ff") : e.kind === "boss" && w.stageId === 8 ? new Color("#80c5cb") : e.kind === "sailor" ? new Color("#a6d3ca") : e.kind === "drowned" ? new Color("#79b9d0") : e.kind === "anchorhand" ? new Color("#ccb98a") : e.kind === "boss" && w.stageId === 10 ? new Color("#b6b5e5") : ["starpatrol","starweaver","starpuppet"].includes(e.kind) ? new Color("#c4c4e0") : e.kind === "boss" && w.stageId === 9 ? new Color("#e0b78e") : ["boneguard","standardbearer","crossbowman","warflag"].includes(e.kind) ? new Color("#cfb393") : Color.WHITE;
    }
    const ordered = [this.hero, ...Array.from(this.units.values())].sort(
      (a, b) => b.position.y - a.position.y,
    );
    ordered.forEach((n, i) => n.setSiblingIndex(i));
    const events = w.drain();
    // Final evolution takes priority over routine shots/hits in the same frame.
    for (const e of events.slice().sort((a,b) => Number(!!b.final) - Number(!!a.final))) {
      const cue = this.feedback.claim(e, this.feedbackClock);
      if (cue) {
        this.sound(cue.sound, cue.volume);
        this.shake = Math.max(this.shake, cue.shake);
      }
    }
    for (const e of events) {
      if (e.type === "hit" && e.id) this.flashes.set(e.id, w.time + 0.09);
      if (e.type === "supply") {
        this.announcement.string = "装备已满级 · 金币 +10 · 自动恢复生命";
        this.announcementLife = 2.2;
      }
      if (e.type === "playerHit") {
        this.shake = Math.max(this.shake, 5);
        this.announcement.string = `受伤 −${Math.round(e.value || 0)} · ${battleReport(w).deathSource}`;
        this.announcementLife = 1.3;
      }
      if (e.type === "evolve" && !e.final) this.shake = Math.max(this.shake, e.value === 10 ? 6 : e.value === 7 ? 5 : 3);
      if (e.type === "evolve" && e.final) {
        const skill = e.skill as Skill;
        const form = EVOLUTIONS[skill].find(v => v.id === e.form);
        this.superTitle.string = `◇ 分支已选择 · ${form?.name || names[skill]}`;
        this.superTitle.color = new Color().fromHEX(colors[skill]);
        const partner = SYNTHESIS_RECIPES[skill];
        this.superSubtitle.string = "本武器攻击形态已改变 · 组合联动另需配方双方10级";
        this.superLife = 2.6;
      }
      if (e.type === "comboReady") {
        const skill = e.skill as Skill, partner = SYNTHESIS_RECIPES[skill]!;
        this.announcement.string = `∞ 超武联动已激活 · ${combinationLabel(skill)}`;
        this.announcementLife = 3;
      }
      if (e.type === "hit" && this.feedback.routineAllowed(this.feedbackClock) && w.time - this.lastSound > 0.1) {
        this.sound("impact");
        this.lastSound = w.time;
      }
      if (e.type === "cast" && this.feedback.routineAllowed(this.feedbackClock)) this.sound("shot");
      if (e.type === "learn" || (e.type === "evolve" && e.value !== undefined)) {
        const skill = e.skill as Skill;
        const title =
          e.type === "evolve"
            ? EVOLUTIONS[skill].find((v) => v.id === (e.form || w.evolutions[skill]))?.name || weaponFormName(skill, w.skills[skill], !!w.evolutions[skill])
            : weaponFormName(skill, w.skills[skill], !!w.evolutions[skill]);
        this.announcement.string =
          (e.type === "evolve"
            ? (e.value === 4 ? "小成 4级 · " : e.value === 7 ? "觉醒 7级 · " : e.value === 10 ? "终式 10级 · " : "进化完成 · ")
            : w.skills[skill] === 1
              ? "习得 · "
              : "强化 · ") + title;
        this.announcementLife = 2.2;
      }
      if (e.type === "bossPhase") {
        this.announcement.string =
          w.stageId===5 ? `亡者君王 · ${KING_PHASES[e.value || 1]}` : `${STAGES[w.stageId].boss}狂怒 · 第二阶段`;
        this.announcementLife = 2.5;
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
    if (w.active) this.superLife = Math.max(0, this.superLife - dt);
    this.superBanner.active = this.started && w.active && this.superLife > 0;
    const entrance = Math.min(1, (2.6 - this.superLife) / 0.22);
    this.superBanner.setScale(0.92 + 0.08 * (1 - Math.pow(1 - entrance, 3)), 0.92 + 0.08 * (1 - Math.pow(1 - entrance, 3)), 1);
    this.painter.draw(w, dt, events);
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
    this.stats.string = hud.stats;
    this.weapons.string = hud.weapons;
    this.hint.string = hud.hint;
    this.novaLabel.string = hud.nova;
    this.novaLabel.color = new Color(w.ultimate > 0 ? "#adbccc" : "#9df5d5");
    this.joy.clear();
    if (this.finger !== null) {
      this.joy.strokeColor = new Color(220, 235, 240, 100);
      this.joy.lineWidth = 3;
      this.joy.circle(this.origin.x, this.origin.y, 55);
      this.joy.stroke();
      this.joy.fillColor = new Color(220, 235, 240, 100);
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
    g.fillColor = new Color().fromHEX(color);
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
