import {
  _decorator,
  Component,
  Node,
  Camera,
  Canvas,
  UITransform,
  Label,
  Color,
  Graphics,
  Vec3,
  Vec4,
  MeshRenderer,
  Material,
  primitives,
  utils,
  DirectionalLight,
  Layers,
  resources,
  assetManager,
  Prefab,
  instantiate,
  SkeletalAnimation,
  AnimationClip,
  input,
  Input,
  EventTouch,
  EventMouse,
  EventKeyboard,
  KeyCode,
  view,
  ResolutionPolicy,
  game,
  Game,
  sys,
  Sprite,
  SpriteFrame,
  Texture2D,
  tween,
  AudioClip,
  AudioSource,
  Mesh,
  profiler,
} from "cc";
import { BattleWorld, Enemy, Effect } from "./battle/BattleWorld";
import {
  ENEMIES,
  SKILLS,
  Skill,
  Card,
  NAMES,
  cardText,
  XP,
} from "./battle/Config";
import { SaveStore } from "./platform/SaveStore";
import { DEBUG } from "cc/env";
import { MODELS } from "./presentation/AssetIndex";
const { ccclass } = _decorator;
const C = {
  ink: "#162B30",
  panel: "#213A40",
  gold: "#F4CE83",
  cream: "#F7ECD5",
  muted: "#A7BBB7",
  green: "#75D6AA",
  red: "#EB7E76",
};
const skillColor: Record<string, string> = {
  gun: "#FFE1A0",
  fire: "#FF9259",
  ice: "#83E9FA",
  lightning: "#C9A0FF",
  ballista: "#E9D49C",
};
@ccclass("GameBootstrap")
export class GameBootstrap extends Component {
  private world?: BattleWorld;
  private store!: SaveStore;
  private prefabs = new Map<string, Prefab>();
  private units = new Map<number, Node>();
  private pooled = new Map<string, Node[]>();
  private bullets = new Map<number, Node>();
  private root!: Node;
  private ui!: Node;
  private overlay!: Node;
  private hud!: Node;
  private cam!: Camera;
  private hero?: Node;
  private health!: Graphics;
  private xpBar!: Graphics;
  private waveLabel!: Label;
  private hpLabel!: Label;
  private skillLabel!: Label;
  private status!: Label;
  private ultLabel!: Label;
  private materials = new Map<string, Material>();
  private effects: { node: Node; ttl: number; max: number; fixed?:boolean }[] = [];
  private markers!:Graphics;private lastNumber=0;
  private acc = 0;
  private lastRevision = -1;
  private displayed = "";
  private runId = "";
  private selected = 1;
  private ready = false;
  private elapsed = 0;
  private reward = 0;
  private uiFrames = new Map<string, SpriteFrame>();
  private audioClips = new Map<string, AudioClip>();
  private audioSource!: AudioSource;
  private lastSound = new Map<string, number>();
  private cube!: Mesh;
  async start() {
    this.store = new SaveStore(sys.localStorage);
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.SHOW_ALL);
    this.cube = utils.createMesh(primitives.box());
    this.audioSource = this.node.addComponent(AudioSource);
    profiler.hideStats();
    this.root = new Node("World");
    this.node.addChild(this.root);
    this.setupCamera();
    this.setupUI();
    this.loading("正在准备防线…");
    game.on(Game.EVENT_HIDE, this.hide, this);
    game.on(Game.EVENT_SHOW, this.show, this);
    input.on(Input.EventType.TOUCH_END, this.tap, this);
    input.on(Input.EventType.MOUSE_UP, this.mouse, this);
    input.on(Input.EventType.KEY_DOWN,this.key,this);
    try {
      await Promise.all(
        Object.entries(MODELS).map(async ([name, id]) => {
          const p = await new Promise<Prefab>((resolve, reject) =>
            assetManager.loadAny({ uuid: id }, (err: any, a: any) =>
              err ? reject(err) : resolve(a),
            ),
          );
          this.prefabs.set(name, p);
        }),
      );
      await this.loadPresentation();
      this.makeWorld();
      this.ready = true;
      this.lobby();
      console.log("UNDEAD_READY", this.prefabs.size);
    } catch (e) {
      console.error("Asset load failed", e);
      this.loading("资源加载失败\n请重新打开预览");
    }
    if (DEBUG) (globalThis as any).__undead = this;
  }
  private async loadPresentation() {
    const load = (path: string, type: any) =>
      new Promise<any>((resolve, reject) =>
        resources.load(path, type, (e, a) => (e ? reject(e) : resolve(a))),
      );
    for (const name of ["panel_brown_dark", "button_brown", ...SKILLS]) {
      const path = SKILLS.includes(name as Skill) ? "ui/icons/" + name : "ui/" + name;
      const texture = await load(path + "/texture", Texture2D);
      const frame = new SpriteFrame(); frame.texture = texture;
      if (!SKILLS.includes(name as Skill)) { frame.insetTop=16;frame.insetBottom=16;frame.insetLeft=16;frame.insetRight=16; }
      this.uiFrames.set(name, frame);
    }
    for (const name of ["shot", "impact", "choose", "ultimate", "victory"])
      this.audioClips.set(name, await load("audio/" + name, AudioClip));
  }
  private sound(name: string) {
    if (this.store.data.muted) return;
    const now = this.elapsed;
    if (
      now - (this.lastSound.get(name) ?? -10) <
      (name === "shot" ? 0.16 : 0.08)
    )
      return;
    this.lastSound.set(name, now);
    const clip = this.audioClips.get(name);
    if (clip) this.audioSource.playOneShot(clip, name === "shot" ? 0.25 : 0.5);
  }
  private icon(parent: Node, key: string, x: number, y: number, size = 66) {
    const frame = this.uiFrames.get(key);
    if (!frame) return;
    const n = this.uiNode("Icon", parent);
    n.setPosition(x, y);
    n.getComponent(UITransform)!.setContentSize(size, size);
    const sprite=n.addComponent(Sprite);sprite.spriteFrame=frame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;n.getComponent(UITransform)!.setContentSize(size,size);
  }
  private setupCamera() {
    const n = new Node("BattleCamera");
    this.node.addChild(n);
    n.setPosition(0, 25, 16);
    n.lookAt(new Vec3(0, 0, -8));
    this.cam = n.addComponent(Camera);
    this.cam.projection = Camera.ProjectionType.ORTHO;
    this.cam.orthoHeight = 13.8;
    this.cam.clearColor = Color.fromHEX(new Color(), "#142B30");
    this.cam.visibility = Layers.Enum.DEFAULT;
    const sun = new Node("Sun");
    this.node.addChild(sun);
    sun.setRotationFromEuler(-55, -30, 0);
    sun.addComponent(DirectionalLight).illuminance = 45000;
    const scene = this.node.scene;
    scene.globals.ambient.skyColor = new Vec4(0.75, 0.85, 0.88, 1);
    scene.globals.ambient.skyIllum = 22000;
    scene.globals.ambient.groundAlbedo = new Vec4(0.35, 0.41, 0.46, 1);
  }
  private setupUI() {
    const u = new Node("Interface");
    this.node.addChild(u);
    u.layer = Layers.Enum.UI_2D;
    u.addComponent(UITransform).setContentSize(720, 1280);
    const canvas = u.addComponent(Canvas);
    const cameraNode = new Node("UICamera");
    this.node.addChild(cameraNode);
    cameraNode.setPosition(0, 0, 1000);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = 640;
    camera.priority = 10;
    camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
    camera.visibility = Layers.Enum.UI_2D;
    canvas.cameraComponent = camera;
    this.ui = u;
    this.hud = this.uiNode("HUD", u);
    this.overlay = this.uiNode("Overlay", u);
    this.buildHUD();const marks=this.uiNode("Enemy signals",this.hud);this.markers=marks.addComponent(Graphics);
  }
  private uiNode(name: string, parent: Node) {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    n.addComponent(UITransform);
    parent.addChild(n);
    return n;
  }
  private text(
    parent: Node,
    value: string,
    x: number,
    y: number,
    size = 24,
    color = C.cream,
    width = 640,
  ) {
    const n = this.uiNode("Text", parent);
    n.setPosition(x, y);
    n.getComponent(UITransform)!.setContentSize(width, size * 3);
    const l = n.addComponent(Label);
    l.string = value;
    l.fontSize = size;
    l.lineHeight = size * 1.35;
    l.color = Color.fromHEX(new Color(), color);
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    l.verticalAlign = Label.VerticalAlign.CENTER;
    l.overflow = Label.Overflow.SHRINK;
    return l;
  }
  private panel(
    parent: Node,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    stroke?: string,
  ) {
    const n = this.uiNode("Panel", parent);
    n.setPosition(x, y);
    n.getComponent(UITransform)!.setContentSize(w, h);
    const frame = this.uiFrames.get("panel_brown_dark");
    if (frame && w > 150 && h > 100) {
      const sprite = n.addComponent(Sprite);
      sprite.spriteFrame = frame;
      sprite.type = Sprite.Type.SLICED;
      sprite.sizeMode=Sprite.SizeMode.CUSTOM;
      n.getComponent(UITransform)!.setContentSize(w,h);
      sprite.color = Color.fromHEX(
        new Color(),
        color === C.ink ? "#C5D3CD" : "#DEE0CE",
      );
      return n;
    }
    const g = n.addComponent(Graphics);
    g.fillColor = Color.fromHEX(new Color(), color);
    g.roundRect(-w / 2, -h / 2, w, h, 16);
    g.fill();
    if (stroke) {
      g.strokeColor = Color.fromHEX(new Color(), stroke);
      g.lineWidth = 2;
      g.stroke();
    }
    return n;
  }
  private button(
    parent: Node,
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fn: () => void,
    color = C.gold,
  ) {
    const n = this.panel(parent, x, y, w, h, color);
    this.text(n, title, 0, 0, 24, color === C.gold ? C.ink : C.cream, w - 16);
    n.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      e.propagationStopped = true;
      fn();
    });
    return n;
  }
  private clearOverlay() {
    this.overlay.removeAllChildren();
  }
  private loading(msg: string) {
    this.clearOverlay();
    this.panel(this.overlay, 0, 0, 660, 280, C.panel, C.gold);
    this.text(this.overlay, msg, 0, 0, 28);
    this.hud.active = false;
  }
  private makeWorld() {
    this.box("Ground", 0, -0.3, -8, 13, 0.5, 25, "#354744");
    for (let row = 0; row < 12; row++)
      for (let col = 0; col < 5; col++)
        this.box(
          "Paving",
          (col - 2) * 2.2,
          -0.03,
          -row * 1.9,
          2.13,
          0.09,
          1.82,
          (row + col) % 3 ? "#56635B" : "#647064",
        );
    for (const x of [-5.8, 5.8]) {
      this.box("WallSide", x, 0.3, -8, 0.45, 0.8, 24, "#34434A");
      for (let i = 0; i < 7; i++) {
        this.prop("column", x, 0, -i * 3.4, 0.75);
        this.box("Lamp", x, 1.75, -i * 3.4, 0.22, 0.3, 0.22, "#FFC979");
      }
    }
    for (let i = -4; i <= 4; i += 2) {
      this.box("Fortification", i, 0.4, 0.45, 1.8, 0.8, 0.6, "#778A87");
      this.box("Cap", i, 0.87, 0.45, 1.95, 0.15, 0.72, "#B3BBA3");
    }
    this.box("Gate", 0, 0.01, -18.5, 10, 0.04, 1, "#293F3C");
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        this.prop("gravestone-decorative", side * 5.15, 0, -3 - i * 4, 1.1);
        this.prop("rocks", side * 5.25, 0, -4.5 - i * 4, 0.65);
      }
      this.prop("pine-fall", side * 5.6, 0, -18, 1.2);
    }
    this.prop("crypt-small", 0, 0, -21, 2.2);
    this.hero = this.model("Engineer");
    this.hero.setPosition(0, 0, 1.65);
    this.hero.setRotationFromEuler(0, 180, 0);
    this.play(this.hero, "Idle_A");
    this.prop("chest", -3.6, 0, 2.5, 1);
    this.prop("chest", 3.6, 0, 2.5, 1);
    this.batchBoxes();
    if (this.prefabs.has("shotgun") && this.hero) {
      const find = (n: Node): Node | null =>
        n.name === "handslot.r"
          ? n
          : n.children.map(find).find(Boolean) || null;
      const hand = find(this.hero);
      if (hand) {
        const gun = instantiate(this.prefabs.get("shotgun")!);
        hand.addChild(gun);
        gun.setPosition(0, 0, 0);
      }
    }
  }
  private batchBoxes() {
    const groups = new Map<Material, Node[]>();
    for (const n of this.root.children) {
      const mr = n.getComponent(MeshRenderer);
      if (mr && mr.mesh === this.cube) {
        const m = mr.getMaterial(0)!;
        const list = groups.get(m) || [];
        list.push(n);
        groups.set(m, list);
      }
    }
    const base = primitives.box();
    for (const [mat, nodes] of groups) {
      const positions: number[] = [],
        indices: number[] = [];
      for (const n of nodes) {
        const offset = positions.length / 3;
        for (let i = 0; i < base.positions.length; i += 3)
          positions.push(
            base.positions[i] * n.scale.x + n.position.x,
            base.positions[i + 1] * n.scale.y + n.position.y,
            base.positions[i + 2] * n.scale.z + n.position.z,
          );
        for (const i of base.indices!) indices.push(i + offset);
        n.destroy();
      }
      const node = new Node("Batched architecture");
      this.root.addChild(node);
      const mr = node.addComponent(MeshRenderer);
      mr.mesh = utils.createMesh({ positions, indices });
      mr.setMaterial(mat, 0);
    }
  }
  private material(hex: string) {
    if (!this.materials.has(hex)) {
      const m = new Material();
      m.initialize({
        effectName: "builtin-unlit",
        defines: { USE_COLOR: true },
      });
      m.setProperty("mainColor", Color.fromHEX(new Color(), hex));
      this.materials.set(hex, m);
    }
    return this.materials.get(hex)!;
  }
  private box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    const n = new Node(name);
    this.root.addChild(n);
    n.setPosition(x, y, z);
    n.setScale(w, h, d);
    const mr = n.addComponent(MeshRenderer);
    mr.mesh = this.cube;
    mr.setMaterial(this.material(color), 0);
    return n;
  }
  private model(name: string) {
    const pool = this.pooled.get(name);
    let n = pool?.pop();
    if (!n) {
      const p = this.prefabs.get(name);
      n = p ? instantiate(p) : this.box(name, 0, 0, 0, 0.5, 1, 0.5, "#FFFFAA");
      n.name = name;
    }
    n.active = true;
    this.root.addChild(n);
    return n;
  }
  private prop(name: string, x: number, y: number, z: number, scale: number) {
    if (!this.prefabs.has(name)) return;
    const n = this.model(name);
    n.setPosition(x, y, z);
    n.setScale(scale, scale, scale);
  }
  private play(node: Node, clip: string) {
    for (const a of node.getComponentsInChildren(SkeletalAnimation)) {
      if (a.clips.some((c) => c?.name === clip)) {
        const state = a.getState(clip);
        if (state) {
          state.wrapMode = AnimationClip.WrapMode.Loop;
          a.play(clip);
        }
      }
    }
  }
  private release(n: Node) {
    n.active = false;
    n.removeFromParent();
    const p = this.pooled.get(n.name) || [];
    p.push(n);
    this.pooled.set(n.name, p);
  }
  private buildHUD() {
    this.panel(this.hud, 0, 542, 680, 154, C.ink);
    this.text(this.hud, "最后一道防线", -175, 574, 27, C.gold, 280);
    this.waveLabel = this.text(
      this.hud,
      "第 1 波 / 10",
      -180,
      526,
      22,
      C.cream,
      260,
    );
    this.button(
      this.hud,
      "Ⅱ",
      276,
      558,
      64,
      62,
      () => this.pauseGame(),
      C.panel,
    );
    const h = this.uiNode("Health", this.hud);
    h.setPosition(60, 520);
    this.health = h.addComponent(Graphics);
    this.hpLabel = this.text(
      this.hud,
      "1000 / 1000",
      90,
      520,
      19,
      C.cream,
      290,
    );
    const ex = this.uiNode("Experience", this.hud);
    ex.setPosition(0, 460);
    this.xpBar = ex.addComponent(Graphics);
    this.panel(this.hud, 0, -534, 680, 168, C.ink);
    this.skillLabel = this.text(
      this.hud,
      "主武器就绪",
      -90,
      -499,
      20,
      C.gold,
      440,
    );
    this.status = this.text(
      this.hud,
      "点击敌人集火 · 升级选择技能",
      -90,
      -553,
      18,
      C.muted,
      440,
    );
    const ult = this.button(
      this.hud,
      "",
      250,
      -530,
      132,
      124,
      () => {
        if (this.world?.useUltimate()) this.updateHUD();
      },
      "#826443",
    );
    this.ultLabel = this.text(ult, "冲击波\n就绪", 0, 0, 22, C.cream, 124);
    this.hud.active = false;
  }
  private lobby() {
    this.world = undefined;
    this.hud.active = false;
    this.displayed = "lobby";
    this.clearBattle();
    this.clearOverlay();
    this.panel(this.overlay, 0, 395, 638, 236, C.ink, C.gold);
    this.text(this.overlay, "暮 色 将 至", 0, 463, 20, C.muted);
    this.text(this.overlay, "最后一道防线", 0, 400, 48, C.gold);
    this.text(this.overlay, "守住城墙，让亡灵止步于此", 0, 338, 21);
    this.panel(this.overlay, 0, -260, 646, 470, C.ink);
    this.text(
      this.overlay,
      `战备金币  ${this.store.data.coins}`,
      0,
      -70,
      25,
      C.gold,
    );
    for (let stage = 1; stage <= 3; stage++)
      this.button(
        this.overlay,
        stage <= this.store.data.unlocked ? `第 ${stage} 关` : "未解锁",
        (stage - 2) * 195,
        -137,
        177,
        62,
        () => {
          if (stage <= this.store.data.unlocked) {
            this.selected = stage;
            this.lobby();
          }
        },
        this.selected === stage ? C.gold : C.panel,
      );
    this.button(
      this.overlay,
      `武器 Lv.${this.store.data.weapon}  ·  ${this.store.cost("weapon")} 金币`,
      -153,
      -230,
      290,
      72,
      () => {
        this.store.buy("weapon");
        this.lobby();
      },
      C.panel,
    );
    this.button(
      this.overlay,
      `城墙 Lv.${this.store.data.wall}  ·  ${this.store.cost("wall")} 金币`,
      153,
      -230,
      290,
      72,
      () => {
        this.store.buy("wall");
        this.lobby();
      },
      C.panel,
    );
    this.button(this.overlay, "开始守卫", 0, -345, 576, 86, () =>
      this.begin(this.selected),
    );
    this.text(
      this.overlay,
      "自动射击  /  三选一成长  /  单手守城",
      0,
      -426,
      18,
      C.muted,
    );
    this.button(
      this.overlay,
      this.store.data.muted ? "声音：关" : "声音：开",
      -150,
      -563,
      260,
      55,
      () => {
        this.store.settings(!this.store.data.muted, this.store.data.low);
        this.lobby();
      },
      C.panel,
    );
    this.button(
      this.overlay,
      this.store.data.low ? "画质：流畅" : "画质：标准",
      150,
      -563,
      260,
      55,
      () => {
        this.store.settings(this.store.data.muted, !this.store.data.low);
        this.lobby();
      },
      C.panel,
    );
    this.button(this.overlay,'素材署名',0,-616,160,34,()=>this.credits(),C.panel);
  }
  private credits(){this.clearOverlay();this.panel(this.overlay,0,0,650,610,C.ink,C.gold);this.text(this.overlay,'美术与声音',0,235,34,C.gold);this.text(this.overlay,'角色与地牢：Kay Lousberg · CC0\n界面与墓地：Kenney · CC0\n图标：Lorc / Willdabeast / Carl Olsen\ngame-icons.net · CC BY 3.0\n图标已改色、去底并转换为 PNG\n音效：本项目程序合成\n许可：creativecommons.org/licenses/by/3.0',0,0,21,C.cream,570);this.button(this.overlay,'返回',0,-229,420,64,()=>this.lobby());}
  begin(stage: number) {
    if (!this.ready) return;
    this.clearBattle();
    this.world = new BattleWorld(
      stage,
      this.store.data.weapon,
      this.store.data.wall,
      Date.now() >>> 0,
    );
    this.runId =
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    this.acc = 0;
    this.lastRevision = -1;
    this.clearOverlay();
    this.hud.active = true;
    this.displayed = "battle";
    if (this.hero) this.play(this.hero, "Ranged_2H_Shooting");
    this.updateHUD();
  }
  private clearBattle() {
    for (const n of this.units.values()) this.release(n);
    this.units.clear();
    for (const n of this.bullets.values()) n.destroy();
    this.bullets.clear();
    for (const e of this.effects) e.node.destroy();
    this.effects = [];
    if (this.hero) this.play(this.hero, "Idle_A");
  }
  update(dt: number) {
    if (!this.ready) return;
    this.elapsed += dt;
    const w = this.world;
    if (w) {
      this.acc = Math.min(this.acc + dt, 0.16);
      while (this.acc >= 1 / 30) {
        w.step(1 / 30);
        this.acc -= 1 / 30;
      }
      this.sync();
      for (const e of w.drain()) this.feedback(e);
      if (
        w.revision !== this.lastRevision ||
        Math.floor(this.elapsed * 4) !== Math.floor((this.elapsed - dt) * 4)
      )
        this.updateHUD();
      if (w.state === "upgrade" && this.displayed !== "upgrade") this.upgrade();
      if (
        (w.state === "won" || w.state === "lost") &&
        this.displayed !== w.state
      )
        this.result();
    }
    for (const e of this.effects) {
      e.ttl -= dt;
      if(!e.fixed)e.node.setScale(
        Math.max(0.01, (1 - e.ttl / e.max) * 2 + 0.2),
        0.06,
        Math.max(0.01, (1 - e.ttl / e.max) * 2 + 0.2),
      );
      if (e.ttl <= 0) e.node.destroy();
    }
    this.effects = this.effects.filter((e) => e.ttl > 0);
  }
  private sync() {
    const w = this.world!;
    this.drawMarkers();
    const ids = new Set(w.enemies.map((e) => e.id));
    for (const [id, n] of this.units)
      if (!ids.has(id)) {
        this.release(n);
        this.units.delete(id);
      }
    for (const e of w.enemies) {
      let n = this.units.get(e.id);
      if (!n) {
        n = this.model(ENEMIES[e.kind].model);
        this.units.set(e.id, n);
        this.play(n, e.kind === "rogue" ? "Running_A" : "Walking_A");
      }
      n.setPosition(e.x, 0, -e.y);
      n.setRotationFromEuler(0, 0, 0);
      const scale = e.kind === "boss" ? 1.15 : 0.8;
      n.setScale(scale, scale, scale);
    }
    const shotIds = new Set(w.shots.map((p) => p.id));
    for (const [id, n] of this.bullets)
      if (!shotIds.has(id)) {
        n.destroy();
        this.bullets.delete(id);
      }
    for (const p of w.shots) {
      let n = this.bullets.get(p.id);
      if (!n) {
        n = this.box(
          "Shot",
          p.x,
          0.8,
          -p.y,
          0.09,
          0.09,
          p.skill === "ballista" ? 0.7 : 0.35,
          skillColor[p.skill],
        );
        this.bullets.set(p.id, n);
      }
      n.setPosition(p.x, 0.85, -p.y);
      n.setRotationFromEuler(0, (Math.atan2(p.vx, -p.vy) * 180) / Math.PI, 0);
    }
  }
  private drawMarkers(){
    const w=this.world!;const g=this.markers;g.clear();
    for(const e of w.enemies){const p=new Vec3();this.cam.convertToUINode(new Vec3(e.x,1.9,-e.y),this.ui,p);
      if(e.hp<e.maxHp||e.kind==='boss'){const width=e.kind==='boss'?95:36;g.fillColor=Color.fromHEX(new Color(),C.ink);g.rect(p.x-width/2,p.y,width,5);g.fill();g.fillColor=Color.fromHEX(new Color(),e.kind==='boss'?C.red:C.green);g.rect(p.x-width/2,p.y,width*e.hp/e.maxHp,5);g.fill();}
      if(e.id===w.focusId&&w.focusUntil>w.time){g.strokeColor=Color.fromHEX(new Color(),C.gold);g.lineWidth=2;g.circle(p.x,p.y-27,24);g.stroke();}
      if(e.kind==='mage'&&e.y<=8&&e.attack<.8){g.fillColor=Color.fromHEX(new Color(),'#F898BA');g.circle(p.x,p.y+12,6+4*Math.sin(this.elapsed*12));g.fill();}
      if(e.freezeUntil>w.time||e.slowUntil>w.time){g.strokeColor=Color.fromHEX(new Color(),'#83E9FA');g.lineWidth=2;g.circle(p.x,p.y-28,19);g.stroke();}
    }
  }
  private feedback(e: Effect) {
    if(e.type==='hit'&&e.value&&e.value>=30&&!this.store.data.low&&this.elapsed-this.lastNumber>.12){this.lastNumber=this.elapsed;const p=new Vec3();this.cam.convertToUINode(new Vec3(e.x,1.8,-e.y),this.ui,p);const l=this.text(this.hud,String(Math.round(e.value)),p.x,p.y,20,skillColor[e.skill||'gun']||C.gold,90);tween(l.node).by(.5,{position:new Vec3(0,32,0)}).call(()=>l.node.destroy()).start();}

    if (e.type === "fire" && e.skill === "gun") this.sound("shot");
    if (e.type === "death") this.sound("impact");
    if (e.type === "ultimate") this.sound("ultimate");
    if (e.type === "explosion" || e.type === "ultimate" || e.type === "death") {
      if (this.store.data.low && e.type === "death") return;
      const n = this.box(
        "Impact",
        e.x,
        0.18,
        -e.y,
        0.2,
        0.06,
        0.2,
        e.type === "explosion"
          ? "#F5AE61"
          : e.type === "ultimate"
            ? "#FFE8B0"
            : "#B6C5AE",
      );
      const ttl = e.type === "ultimate" ? 0.7 : 0.35;
      this.effects.push({ node: n, ttl, max: ttl });
    }
    if (e.type === "lightning") {
      const x2 = e.endX ?? 0,
        y2 = e.endY ?? 0;
      const n = this.box(
        "Lightning",
        (e.x + x2) / 2,
        1,
        -(e.y + y2) / 2,
        0.09,
        0.08,
        Math.hypot(e.x - x2, e.y - y2),
        "#D5AAFF",
      );
      n.setRotationFromEuler(
        0,
        (Math.atan2(x2 - e.x, -y2 + e.y) * 180) / Math.PI,
        0,
      );
      this.effects.push({ node: n, ttl: 0.18, max: 0.18, fixed:true });
    }
  }
  private updateHUD() {
    const w = this.world;
    if (!w) return;
    this.lastRevision = w.revision;
    this.waveLabel.string = `第 ${Math.max(1, w.wave)} 波 / 10   ·   Lv.${w.level}`;
    this.hpLabel.string = `${Math.ceil(w.hp)} / ${w.maxHp}`;
    this.bar(this.health, 280, 20, w.hp / w.maxHp, C.green);
    this.bar(
      this.xpBar,
      650,
      7,
      w.level === 13 ? 1 : w.xp / XP[w.level - 1],
      C.gold,
    );
    this.skillLabel.string =
      SKILLS.filter((s) => w.skills[s])
        .map((s) => `${NAMES[s]} ${w.skills[s]}`)
        .join("  ·  ") || "主武器就绪 · 击杀亡灵获取强化";
    this.status.string = `已击退 ${w.kills}   ·   ${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, "0")}   ·   点击敌人集火`;
    this.ultLabel.string =
      w.ultimate > 0 ? `冲击波\n${Math.ceil(w.ultimate)}s` : "冲击波\n就绪";
  }
  private bar(
    g: Graphics,
    width: number,
    height: number,
    ratio: number,
    color: string,
  ) {
    g.clear();
    g.fillColor = Color.fromHEX(new Color(), "#344A4C");
    g.roundRect(-width / 2, -height / 2, width, height, height / 2);
    g.fill();
    g.fillColor = Color.fromHEX(new Color(), color);
    if (ratio > 0) {
      g.roundRect(
        -width / 2,
        -height / 2,
        Math.max(height, width * Math.min(1, ratio)),
        height,
        height / 2,
      );
      g.fill();
    }
  }
  private upgrade() {
    const w = this.world!;
    this.displayed = "upgrade";
    this.clearOverlay();
    this.panel(this.overlay, 0, 0, 686, 760, C.ink, C.gold);
    this.text(this.overlay, "战 地 补 给", 0, 307, 19, C.muted);
    this.text(this.overlay, "选择你的强化", 0, 251, 39, C.gold);
    this.text(
      this.overlay,
      "战斗已暂停 · 每次选择都改变战局",
      0,
      194,
      20,
      C.muted,
    );
    w.cards.forEach((c, i) => {
      const level = w.skills[c as Skill] || 0;
      const n = this.panel(
        this.overlay,
        0,
        90 - i * 150,
        610,
        132,
        C.panel,
        skillColor[c] || C.gold,
      );
      this.icon(n, c, -248, 0, 70);
      this.text(
        n,
        NAMES[c] +
          (SKILLS.includes(c as Skill)
            ? `  ${level ? "Lv." + (level + 1) : "解锁"}`
            : ""),
        -58,
        30,
        26,
        skillColor[c] || C.gold,
        330,
      );
      this.text(n, cardText(c, level), 15, -24, 19, C.cream, 385);
      this.text(n, "›", 260, 0, 40, C.gold, 50);
      n.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
        e.propagationStopped = true;
        w.choose(c);
        this.sound("choose");
        this.clearOverlay();
        this.displayed = "battle";
        this.updateHUD();
      });
    });
    this.button(
      this.overlay,
      `刷新选项 (${w.refreshes})`,
      0,
      -306,
      300,
      54,
      () => {
        if (w.refresh()) {
          this.displayed = "battle";
          this.upgrade();
        }
      },
      C.panel,
    );
  }
  private pauseGame() {
    const w = this.world;
    if (!w || w.state !== "battle") return;
    w.pause("user", true);
    this.displayed = "pause";
    this.clearOverlay();
    this.panel(this.overlay, 0, 0, 600, 380, C.ink, C.gold);
    this.text(this.overlay, "暂歇片刻", 0, 105, 37, C.gold);
    this.button(this.overlay, "继续守卫", 0, 0, 430, 72, () => {
      w.pause("user", false);
      this.clearOverlay();
      this.displayed = "battle";
    });
    this.button(
      this.overlay,
      "撤回营地",
      0,
      -106,
      430,
      64,
      () => {
        this.store.settle(this.runId, w.stage, false, w.cleared, w.bonusGold);
        this.lobby();
      },
      C.panel,
    );
  }
  private result() {
    const w = this.world!;
    this.displayed = w.state;
    if (w.state === "won") this.sound("victory");
    this.reward = this.store.settle(
      this.runId,
      w.stage,
      w.state === "won",
      w.cleared,
      w.bonusGold,
    );
    this.clearOverlay();
    this.panel(this.overlay, 0, 0, 650, 680, C.ink, C.gold);
    this.text(
      this.overlay,
      w.state === "won" ? "防线屹立" : "防线失守",
      0,
      244,
      46,
      w.state === "won" ? C.gold : C.red,
    );
    this.text(
      this.overlay,
      `击退 ${w.kills} 个亡灵  ·  获得 ${this.reward} 金币`,
      0,
      164,
      23,
    );
    const rows = Object.entries(w.damage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(
        ([k, v]) =>
          `${NAMES[k as Card] || (k === "gun" ? "主武器" : "冲击波")}   ${Math.round(v)}`,
      );
    this.text(
      this.overlay,
      "伤害贡献\n" + rows.join("\n"),
      0,
      30,
      23,
      C.muted,
      500,
    );
    this.button(this.overlay, "返回营地", 0, -173, 500, 78, () => this.lobby());
    this.button(
      this.overlay,
      "再战一次",
      0,
      -270,
      500,
      60,
      () => this.begin(w.stage),
      C.panel,
    );
  }
  private key(e:EventKeyboard){const w=this.world;if(!w)return;if(e.keyCode===KeyCode.SPACE)w.useUltimate();if(e.keyCode===KeyCode.ESCAPE){if(this.displayed==='pause'){w.pause('user',false);this.clearOverlay();this.displayed='battle';}else this.pauseGame();}const i=[KeyCode.DIGIT_1,KeyCode.DIGIT_2,KeyCode.DIGIT_3].indexOf(e.keyCode);if(i>=0&&w.state==='upgrade'&&w.cards[i]){w.choose(w.cards[i]);this.sound('choose');this.clearOverlay();this.displayed='battle';}}
  private hitScreen(x: number, y: number) {
    if (!this.world?.active || this.displayed !== "battle") return;
    let best: Enemy | undefined;
    let dist = 60;
    for (const e of this.world.enemies) {
      const p = this.cam.worldToScreen(new Vec3(e.x, 1, -e.y));
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < dist) {
        best = e;
        dist = d;
      }
    }
    if (best) this.world.focus(best.id);
  }
  private tap(e: EventTouch) {
    const p = e.getLocation();
    this.hitScreen(p.x, p.y);
  }
  private mouse(e: EventMouse) {
    const p = e.getLocation();
    this.hitScreen(p.x, p.y);
  }
  private hide() {
    this.world?.pause("background", true);
  }
  private show() {
    this.acc = 0;
    this.world?.pause("background", false);
  }
  onDestroy() {
    game.off(Game.EVENT_HIDE, this.hide, this);
    game.off(Game.EVENT_SHOW, this.show, this);
    input.off(Input.EventType.TOUCH_END, this.tap, this);
    input.off(Input.EventType.MOUSE_UP, this.mouse, this);
    input.off(Input.EventType.KEY_DOWN,this.key,this);
  }
}
