import { initialGrades } from "./WeaponGrade";
import {LibrarySystem,libraryEnemy} from "./LibrarySystem";
import {WindSystem,windEnemy} from "./WindSystem";
import {windMove} from "./WindGeometry";
import {RootSystem,rootEnemy} from "./RootSystem";
import {PrismSystem,prismEnemy,prismDevice} from "./PrismSystem";
import { TideSystem, tideEnemy } from "./TideSystem";
import { createStageStrategy, StageStrategy } from "./StageStrategy";
import { BellSystem, bellEnemy } from "./BellSystem";
import { MoonSystem, moonEnemy } from "./MoonSystem";
import { ThunderSystem, thunderDevice, thunderEnemy } from "./ThunderSystem";
import { Armory } from "./Armory";
import { weaponStats, playerAttributes } from "./ArmoryConfig";
import { SandSystem, sandEnemy } from "./SandSystem";
import { SiegeSystem, siegeEnemy, siegeProjectileFactor } from "./SiegeSystem";
import {BOSS_REINFORCEMENT_XP} from "./HordePressure";
import {experienceRequired} from "./ExperienceCurve";
import {MAX_WEAPON_SLOTS} from "./EncounterPacing";
import { UpgradeSystem } from "./UpgradeSystem";
import { STAGES } from "./StageRules";
import { CHARACTERS, CharacterId, StageId } from "./ProgressionConfig";
import { bossExposed } from "./BossSystem";
import { MAX_ENEMIES, Card, Skill, Passive, ALL_WEAPONS as WEAPONS, MAX_SKILL_LEVEL, Kind, ENEMIES, isElite, isLarge } from "./SurvivalConfig";
import {
  Enemy,
  Effect,
  Hazard,
  Point,
  distance,
  segmentDistance,
} from "./SurvivalTypes";
import { SpawnDirector } from "./SpawnDirector";
import { stepEnemies, stepHazards } from "./EnemySystem";
export type { Enemy, Effect } from "./SurvivalTypes";
const TACTICAL_BLESSINGS = [
  { id: "skirmisher", name: "游击节奏", effect: "移动中造成的伤害提高25%" },
  { id: "slayer", name: "斩将令", effect: "对精英和首领造成的伤害提高30%" },
  { id: "scavenger", name: "战场回收", effect: "经验吸附范围扩大80%，拾取经验提高25%" },
] as const;
type TacticalBlessing = (typeof TACTICAL_BLESSINGS)[number]["id"];
export class SurvivalWorld {
  private strategy?:StageStrategy;
  get stageStrategy(){return this.strategy??(this.strategy=createStageStrategy(this));}
  library=new LibrarySystem(this);
  wind=new WindSystem(this);
  root=new RootSystem(this);
  prism=new PrismSystem(this);
  tide=new TideSystem(this);
  bell=new BellSystem(this);
  moon=new MoonSystem(this);
  thunder=new ThunderSystem(this);
  siege=new SiegeSystem(this);
  sand=new SandSystem(this);
  enemies: Enemy[] = [];
  effects: Effect[] = [];
  hazards: Hazard[] = [];
  gems: { id: number; x: number; y: number; value: number }[] = [];
  potions: { id: number; x: number; y: number; expires?: number }[] = [];
  private upgrades = new UpgradeSystem(this);
  get reinforcementRestUntil() { return this.director.restUntil; }
  lastHurt = -Infinity;
  lastDamageSource = "";
  healing = { potion: 0, repair: 0 };
  private bossPotionMilestones = new Map<number, number>();
  state: "starting" | "battle" | "upgrade" | "modification" | "tactical" | "won" | "lost" = "battle";
  pauses = new Set<string>();
  hp = 100;
  maxHp = 100;
  attack = 20;
  time = 0;
  level = 1;
  xp = 0;
  kills = 0;
  gold = 0;
  eliteKills = 0;
  bossEliteRestUntil=0;
  ultimate = 0;
  invulnerable = 0;
  revision = 0;
  seed: number;
  player = { x: 0, y: 0 };
  armory = new Armory(this);
  move = { x: 0, y: 0 };
  lastMove = { x: 1, y: 0 };
  camera = { x: 0, y: 0 };
  viewport = { x: 13.3, y: 7.5 };
  skills:Record<Skill,number>=Object.fromEntries(WEAPONS.map(s=>[s,0])) as Record<Skill,number>;
  cooldowns:Record<Skill,number>=Object.fromEntries(WEAPONS.map(s=>[s,0])) as Record<Skill,number>;
  passives:Record<Passive,number>={power:0,hourglass:0,area:0,duration:0,amount:0,boots:0,vitality:0,magnet:0};
  mods:Record<Skill,string[]>=Object.fromEntries(WEAPONS.map(s=>[s,[] as string[]])) as Record<Skill,string[]>;
  cards: Card[] = [];
  tacticalBlessings: TacticalBlessing[] = [];
  tacticalChoices: typeof TACTICAL_BLESSINGS[number][] = [];
  pendingModification: Skill | null = null;
  refreshes = 3;
  damage: Record<string, number> = {};
  weaponKills: Record<string, number> = {};
  losses: Record<string, number> = {};
  castCounts: Record<string, number> = {};
  private nextId = 1;
  private director = new SpawnDirector();
  constructor(
    seed = 12345,
    public character: CharacterId = "ranger",
    public stageId: StageId = 1,
    public weaponSlots = MAX_WEAPON_SLOTS,
  ) {
    this.weaponSlots = Math.max(1, Math.min(MAX_WEAPON_SLOTS, Math.floor(weaponSlots) || MAX_WEAPON_SLOTS));
    if(stageId!==1)this.player={x:0,y:-8};
    this.seed = seed;
    this.skills.blade = 0;
    this.skills[CHARACTERS[character].weapon] = 1;
  }
  availableWeapons: readonly Skill[] = ["blade","fire","water","frost","lightning","ghost","bone","mine","void","holy"];
  readonly runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  weaponGrades = initialGrades();
  startingWeapon: Skill | null = null;
  challenge = { devices: new Set<number>(), seals: new Set<number>(), bossSealPhases: new Set<number>(), bossHits: 0 };
  startingWeapons: Skill[] = [];
  offerStartingWeapons() {
    if(this.time!==0 || this.state!=="battle")return false;
    for(const skill of WEAPONS)this.skills[skill]=0;
    const pool=[...this.availableWeapons];this.startingWeapons=[];while(this.startingWeapons.length<3)this.startingWeapons.push(pool.splice(Math.floor(this.random()*pool.length),1)[0]);
    this.state="starting";this.setMove(0,0);this.touch();return true;
  }
  chooseStartingWeapon(skill: Skill) {
    if(this.state!=="starting" || !this.startingWeapons.includes(skill))return false;
    this.skills[skill]=1;this.startingWeapon=skill;this.startingWeapons=[];this.state="battle";
    this.effects.push({type:"learn",...this.player,skill});this.touch();return true;
  }
  chooseTacticalBlessing(id: TacticalBlessing) {
    if(this.state!=="tactical"||!this.tacticalChoices.some(choice=>choice.id===id))return false;
    this.tacticalBlessings.push(id);this.tacticalChoices=[];this.state="battle";this.touch();return true;
  }
  cooldownFactor(_skill: Skill) { return 1-playerAttributes(this).cooldown; }
  id() {
    return this.nextId++;
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  touch() {
    this.revision++;
  }
  drain() {
    const e = this.effects;
    this.effects = [];
    return e;
  }
  get active() {
    return this.state === "battle" && !this.pauses.size;
  }
  get xpNeed() {
    return experienceRequired(this.level);
  }
  get weaponCount() {
    return WEAPONS.filter((s) => this.skills[s]).length;
  }
  get speed(){return 4.2*(1+playerAttributes(this).move);}
  get magnetRadius(){return 2.7*(1+playerAttributes(this).pickup)*(this.tacticalBlessings.includes("scavenger")?1.8:1);}
  get buildWeapons(){return WEAPONS.filter(s=>this.skills[s]>0);}
  setMove(x: number, y: number) {
    const d = Math.hypot(x, y);
    this.move = { x: x / Math.max(1, d), y: y / Math.max(1, d) };
    if (d > 0.1) this.lastMove = { x: x / d, y: y / d };
  }
  pause(reason: string, on: boolean) {
    on ? this.pauses.add(reason) : this.pauses.delete(reason);
    this.setMove(0, 0);
    this.touch();
  }
  visible(e: Point, margin = 0) {
    return (
      Math.abs(e.x - this.camera.x) < this.viewport.x - margin &&
      Math.abs(e.y - this.camera.y) < this.viewport.y - margin
    );
  }
  addEnemy(kind: Kind, x = 0, y = 18, summoned = false) {
    if (this.enemies.filter((e) => e.hp > 0).length >= MAX_ENEMIES) return undefined;
    const c = ENEMIES[kind];
    const hp =
      kind === "boss"
        ? c.health * STAGES[this.stageId].bossHealth * 3
        : 30 * (1 + Math.min(this.time, ["paperbonegrub","fledglingeffigy","rootshuffler","shardhermit","brineporter","waxbearer","thornrunner","rivetwalker","sandworker","sandlarva","sandegg","siegebone","forgeguard","mirrorguard","ferryguard","minion","sailor","drowned","boneguard","warflag","starpatrol"].includes(kind) ? 90 : 240) / 300) * c.health *
          (isElite(kind) ? STAGES[this.stageId].elite : STAGES[this.stageId].health);
    const e: Enemy = {
      id: this.id(),
      kind,
      x,
      y,
      hp,
      maxHp: hp,
      attack: kind === "boss" ? 2 : 2.2,
      slow: 0,
      slowUntil: 0,
      freezeUntil: 0,
      freezeReady: 0,
      burn: 0,
      burnUntil: 0,
      burnNext: 0,
      state: kind === "boss" ? "arriving" : "seek",
      timer: kind === "boss" ? 2 : 0,
      facing: Math.atan2(this.player.y - y, this.player.x - x),
      lockedAngle: 0,
      combo: 0,
      pattern: 0,
      born: this.time,
      visibleSince: -1,
      hazardId: 0,
      summoned,
      owner: 0,
      bossPhase: 1,
      bossAction: "none",
    };
    this.enemies.push(e);
    return e;
  }
  target(origin: Point = this.player, range = 8, exclude: number[] = []) {
    return this.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried &&
          distance(e, origin) < range &&
          !exclude.includes(e.id),
      )
      .sort((a, b) =>
        Number(b.kind === "boss") - Number(a.kind === "boss") ||
        distance(a, origin) - distance(b, origin) || a.id - b.id,
      )[0];
  }
  near(p: Point, r: number) {
    return this.enemies.filter((e) => e.hp > 0 && !e.sand?.buried && distance(e, p) <= r);
  }
  hurt(amount: number, source: string, scale = true, ownerId?: number) {
    if (this.invulnerable > 0 || this.hp <= 0) return;
    amount *= scale ? STAGES[this.stageId].damage : 1;
    const lost = Math.min(this.hp, amount);
    if (lost > 0 && (source === "boss" || this.enemies.some(e => e.id === ownerId && e.kind === "boss"))) this.challenge.bossHits++;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerable = 0.7;
    this.lastHurt = this.time;
    this.lastDamageSource = source;
    this.losses[source] = (this.losses[source] || 0) + lost;
    const attacker = this.enemies.filter(e => source.startsWith(e.kind))
      .sort((a,b) => distance(a,this.player)-distance(b,this.player))[0];
    this.effects.push({ type: "playerHit", ...this.player, value: lost,
      endX: attacker?.x, endY: attacker?.y });
    this.touch();
  }
  hit(
    e: Enemy,
    base: number,
    source: string,
    _crit = false,
    origin: Point = this.player,
    direct = true,
    combination?: Skill,
    extraFraction = 1,
    projectile = false,
    ongoing = false,
  ) {
    if (e.hp <= 0 || e.state === "arriving" || (e.sand?.buried && !ongoing)) return;
    const soulFactor = source === "needleEcho" ? 1 : this.armory.support.amplification(e);
    let amount = base * soulFactor * (bossExposed(this, e)&&!(this.stageId===1&&e.siegeWall) ? 1.25 : 1);
    if(this.stageId===1&&this.tacticalBlessings.includes("skirmisher")&&Math.hypot(this.move.x,this.move.y)>.1)amount*=1.25;
    if(this.stageId===1&&this.tacticalBlessings.includes("slayer")&&(e.kind==="boss"||isElite(e.kind)))amount*=1.3;
    if(projectile) {
      const factor=siegeProjectileFactor(this,e,origin);
      amount*=factor;if(factor<1)this.effects.push({type:"block",...e});
    }
    if(this.stageId===1){
      if(e.siegeWall&&e.state==='recover'&&isLarge(e.kind))amount*=1.25;
      if((e.siegeShield??0)>0&&(e.siegeShieldUntil??0)>this.time&&this.enemies.some(o=>o.id===e.siegeShieldOwner&&o.hp>0)){
        const absorbed=Math.min(amount,e.siegeShield!);e.siegeShield!-=absorbed;amount-=absorbed;
      }
    }
    if(this.stageId===2&&e.sand?.vulnerable&&e.state==='recover'&&!bossExposed(this,e))amount*=1.25;
    if(this.stageId===4&&isElite(e.kind)&&e.state==='recover'&&e.moon?.vulnerable)amount*=1.25;
    if(this.stageId===3&&isElite(e.kind)&&e.state==='recover'&&e.thunder?.vulnerable)amount*=1.25;
    if(this.stageId===5||this.stageId===6||this.stageId===7||this.stageId===8||this.stageId===9||this.stageId===10){
      const waxKind=this.stageId===5?bellEnemy(e.kind):this.stageId===6?tideEnemy(e.kind):this.stageId===7?prismEnemy(e.kind)&&!prismDevice(e.kind):this.stageId===8?rootEnemy(e.kind):this.stageId===9?windEnemy(e.kind):libraryEnemy(e.kind);
      const exposed=this.stageId===5?e.bell?.vulnerable:this.stageId===6?e.tide?.vulnerable:this.stageId===7?e.prism?.vulnerable:this.stageId===8?e.root?.vulnerable:this.stageId===9?e.wind?.vulnerable:e.library?.vulnerable;
      const baseArmor=e.kind==='boss'?.55:isElite(e.kind)?.5:(e.kind==='waxbearer'||e.kind==='brineporter'||e.kind==='shardhermit'||e.kind==='rootshuffler'||e.kind==='fledglingeffigy'||e.kind==='paperbonegrub')?.2:waxKind?.35:0;
      const fracture=(e.fractureUntil??0)>this.time?(e.fracture??0):0;
      const armor=Math.max(0,baseArmor-fracture*.35);
      amount*=1-Math.min(armor,e.state==='recover'&&exposed?(e.kind==='boss'?.15:.2):1);
      if(this.stageId===5&&isElite(e.kind)&&exposed&&e.state==='recover')amount*=1.25;
    }
    if(isElite(e.kind)&&this.stageStrategy.vulnerable?.(e))amount*=1.25;
    const dealt = Math.min(e.hp, amount);
    e.hp -= amount;
    // Boss fights provide supplies even when their summoned adds cannot drop loot.
    if (e.kind === "boss" && e.hp > 0) {
      let milestones = this.bossPotionMilestones.get(e.id) ?? 0;
      while (milestones < 3 && e.hp <= e.maxHp * (0.75 - milestones * 0.25)) {
        const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x) + Math.PI / 2;
        const p = { x: this.player.x + Math.cos(angle) * 2.2, y: this.player.y + Math.sin(angle) * 2.2 };
        p.x = Math.max(-21, Math.min(21, p.x));
        p.y = Math.max(-25, Math.min(25, p.y));
        this.stageStrategy.map.resolve(p, .3);
        this.dropPotion(p.x, p.y);
        milestones++;
      }
      this.bossPotionMilestones.set(e.id, milestones);
    }
    const attribution = source === "needleEcho" ? "needle" : source === "poisonBurst" ? "poison" : source;
    this.damage[attribution] = (this.damage[attribution] || 0) + dealt;
    this.effects.push({
      type: "hit",
      id: e.id,
      x: e.x,
      y: e.y,
      value: dealt,
      skill: source,
    });
    if (e.hp <= 0) {
      if(this.stageId === 3 && thunderDevice(e.kind)) this.challenge.devices.add(e.id);
      if(this.stageStrategy.onDeath(e)){this.effects.push({type:'death',x:e.x,y:e.y});this.touch();return;}
      this.kills++;
      this.gold += e.summoned ? 0 : 1;
      this.weaponKills[attribution] = (this.weaponKills[attribution] || 0) + 1;
    if (e.kind === "boss") {
        this.enemies.forEach((o) => (o.hp = 0));
        this.hazards = [];
        this.state = "won";
      } else if (isElite(e.kind)) {
        this.eliteKills++;
        const eliteValue = 8 * STAGES[this.stageId].xp;
        const nearbyGem = this.gems.find((g) => distance(g, e) < 0.9);
        if (nearbyGem) nearbyGem.value += eliteValue;
        else this.gems.push({ id: this.id(), x: e.x, y: e.y, value: eliteValue });
        this.dropPotion(e.x, e.y);
        this.director.restUntil = this.time + 6;
        this.effects.push({ type: "eliteDown", x: e.x, y: e.y });
        if(this.stageId===1&&this.eliteKills<=2){
          this.tacticalChoices=TACTICAL_BLESSINGS.filter(choice=>!this.tacticalBlessings.includes(choice.id));
          this.state="tactical";this.setMove(0,0);
        }
      } else if (!e.summoned || e.bossReinforcement || (e.sandXp??0)>0) {
        const value = (e.sandXp??ENEMIES[e.kind].xp) * STAGES[this.stageId].xp * (e.bossReinforcement ? BOSS_REINFORCEMENT_XP : 1);
        const g = this.gems.find((g) => distance(g, e) < 0.9);
        if (g) g.value += value;
        else
          this.gems.push({
            id: this.id(),
            x: e.x,
            y: e.y,
            value,
          });
        if (!e.summoned && this.kills % STAGES[this.stageId].medicine === 0)
          this.dropPotion(e.x, e.y);
      }
      this.effects.push({ type: "death", x: e.x, y: e.y, skill: e.kind });
    }
    if(source !== "needleEcho") this.armory.support.transfer(e, dealt);
    this.touch();
  }
  fracture(e:Enemy,layers=1){
    if(e.hp<=0||e.state==='arriving')return;
    e.fracture=Math.min(2,((e.fractureUntil??0)>this.time?(e.fracture??0):0)+layers);
    e.fractureUntil=this.time+3;
  }
  slow(e: Enemy, freeze = false) {
    if(e.kind==='prismmirror')return;
    if(e.kind==='prismcore'){
      if(freeze&&e.freezeReady<=this.time){e.freezeUntil=this.time+.35;e.freezeReady=this.time+2;}return;
    }
    e.slow = isLarge(e.kind) ? 0.2 : 0.4;
    e.slowUntil = this.time + 1.5;
    if(e.sand?.buried)return;
    if(freeze&&this.stageId>=1&&isLarge(e.kind)){
      if(e.freezeUntil<=this.time&&e.freezeReady<=this.time){
        const duration=(e.kind==='boss'?.5:.25)*((e.siegeFreezeResist??0)>this.time?.35:1);
        e.freezeUntil=this.time+Math.max(.15,duration);e.freezeReady=e.freezeUntil+.05;e.siegeFreezeResist=e.freezeUntil+2;
      }
    }else if (freeze && e.kind !== "boss" && e.freezeReady <= this.time) {
      e.freezeUntil = this.time + (isElite(e.kind) ? 0.25 : 0.5);
      e.freezeReady = this.time + 3;
      if (e.state === "windup" && !siegeEnemy(e.kind) && !sandEnemy(e.kind) && !thunderEnemy(e.kind) && !moonEnemy(e.kind) && !bellEnemy(e.kind) && !tideEnemy(e.kind) && !prismEnemy(e.kind) && !rootEnemy(e.kind) && !windEnemy(e.kind) && !libraryEnemy(e.kind)) {
        this.hazards = this.hazards.filter((h) => h.source !== e.id);
        e.state = "recover";
        e.timer = 0.5;
        e.attack = 1;
      }
    }
  }
  step(dt: number) {
    if (!this.active) return;
    if (this.upgrades.openNode()) return;
    this.time += dt;
    if (!this.active) return;
    this.ultimate = Math.max(0, this.ultimate - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    const arena = this.stageStrategy.map;
    const dx = this.move.x * this.speed * dt, dy = this.move.y * this.speed * dt;
    // Small axis-separated moves prevent tunnelling and allow sliding along faces.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.15));
    if(this.stageStrategy.movePlayer)this.stageStrategy.movePlayer(dt);
    else if(this.stageId===9){this.wind.clean();windMove(this.player,{x:this.move.x*this.speed,y:this.move.y*this.speed},dt,.3,this.hazards,this.time);}
    else for (let i = 0; i < steps; i++) {
      this.player.x = Math.max(-22, Math.min(22, this.player.x + dx / steps));
      arena.resolve(this.player, 0.3);
      this.player.y = Math.max(-26, Math.min(26, this.player.y + dy / steps));
      arena.resolve(this.player, 0.3);
    }
    this.siege.sample();
    this.stageStrategy.clean();
    this.director.step(this, dt);
    stepEnemies(this, dt);
    stepHazards(this);
    this.collect(dt);
    if(this.active)this.armory.step(dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.hp <= 0) {
      this.state = "lost";
      this.touch();
      return;
    }
    if (this.state === "won") return;
    this.checkUpgrade();
  }
  private dropPotion(x: number, y: number) {
    this.potions.push({id: this.id(), x, y, expires: this.time + 25});
    if (this.potions.length > 3) this.potions.shift();
  }
  private collect(dt: number) {
    for (const g of this.gems) {
      let d = distance(g, this.player);
      if (d < this.magnetRadius) {
        const move = Math.min(d, dt * 9);
        g.x += ((this.player.x - g.x) / Math.max(0.01, d)) * move;
        g.y += ((this.player.y - g.y) / Math.max(0.01, d)) * move;
      }
      if (distance(g, this.player) < 0.5) {
        this.xp += g.value*(this.stageId===1&&this.tacticalBlessings.includes("scavenger")?1.25:1);
        g.value = 0;
        this.effects.push({ type: "pickup", x: g.x, y: g.y });
      }
    }
    this.gems = this.gems.filter((g) => g.value > 0);
    this.potions = this.potions.filter((p) => {
      if (p.expires !== undefined && p.expires <= this.time) return false;
      if (
        this.hp > 0 &&
        this.hp < this.maxHp &&
        distance(p, this.player) < 0.9
      ) {
        this.healing.potion += Math.min(20, this.maxHp - this.hp);
        this.hp = Math.min(this.maxHp, this.hp + 20);
        this.effects.push({ type: "heal", ...p });
        return false;
      }
      return true;
    });
  }
  useUltimate() {
    if (!this.active || this.ultimate > 0 || !this.gems.some(g=>g.value>0)) return false;
    let total=0;
    for(const g of this.gems)total+=Math.max(0,g.value);
    this.gems=[];
    this.xp+=total;
    this.ultimate=25;
    this.effects.push({type:"pickup",...this.player,value:total});
    this.checkUpgrade();
    this.touch();
    return true;
  }

  legal(){return this.upgrades.legal();}
  private checkUpgrade(){this.upgrades.checkUpgrade();}
  refresh(){return this.upgrades.refresh();}
  choose(card:Card){return this.upgrades.choose(card);}
  chooseMod(id:string){return this.upgrades.chooseMod(id);}
  modOptions(){return this.upgrades.options();}
}
