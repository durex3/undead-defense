import {BOSS_REINFORCEMENT_XP} from "./HordePressure";
import {frontierEnemy} from "./FrontierSystem";
import {experienceRequired} from "./ExperienceCurve";
import {ObservatoryPath} from "./ObservatoryPath";
import { furnaceRoute } from "./FurnaceEncounters";
import { LateStageDirector, lateStageDamage } from "./LateStageSystem";
import { CombinationSystem } from "./CombinationSystem";
import { UpgradeSystem } from "./UpgradeSystem";
import { rankDamage } from "./BuildProgression";
import { ArsenalWeapons, ARSENAL_SKILLS } from "./ArsenalWeapons";
import { CrownDirector } from "./CrownSystem";
import { ChurchSystem } from "./ChurchSystem";
import { STAGES } from "./StageRules";
import { AltarSystem } from "./AltarSystem";
import { stepGarden } from "./GardenMap";
import { CHARACTERS, CharacterId, StageId } from "./ProgressionConfig";
import { bossExposed } from "./BossSystem";
import { MAX_ENEMIES, Card, Skill, Passive, WEAPONS, MAX_SKILL_LEVEL, Kind, ENEMIES, isElite, isLarge, EVOLUTIONS, WEAPON_TAGS } from "./SurvivalConfig";
import {
  Enemy,
  Shot,
  Effect,
  Zone,
  Ring,
  Hazard,
  Blade,
  ScheduledCast,
  Point,
  distance,
  segmentDistance,
} from "./SurvivalTypes";
import { SpawnDirector } from "./SpawnDirector";
import { stepEnemies, stepHazards } from "./EnemySystem";
import { ExpansionWeapons, EXPANSION_SKILLS } from "./ExpansionWeapons";
export type { Enemy, Shot, Effect } from "./SurvivalTypes";
export class SurvivalWorld {
  starPath=new ObservatoryPath();
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  effects: Effect[] = [];
  zones: Zone[] = [];
  rings: Ring[] = [];
  hazards: Hazard[] = [];
  gems: { id: number; x: number; y: number; value: number }[] = [];
  potions: { id: number; x: number; y: number; expires?: number }[] = [];
  private upgrades = new UpgradeSystem(this, (message, ok) => this.shopResult(message, ok));
  private crown = new CrownDirector();
  private church = new ChurchSystem();
  private lateStages = new LateStageDirector();
  private altar = new AltarSystem();
  get reinforcementRestUntil() { return this.director.restUntil; }
  lastHurt = -Infinity;
  lastDamageSource = "";
  healing = { potion: 0, repair: 0 };
  state: "starting" | "battle" | "upgrade" | "evolution" | "won" | "lost" = "battle";
  pauses = new Set<string>();
  hp = 100;
  maxHp = 100;
  attack = 20;
  time = 0;
  level = 1;
  xp = 0;
  kills = 0;
  gold = 0;
  shopOpen = false;
  private shopInitialized = false;
  shopMessage = "";
  shopItems: Skill[] = [];
  shopLocked: Skill[] = [];
  shopRefreshes = 2;
  eliteKills = 0;
  ultimate = 0;
  invulnerable = 0;
  revision = 0;
  seed: number;
  player = { x: 0, y: 0 };
  combinations = new CombinationSystem(this);
  expansion = new ExpansionWeapons(this);
  arsenal = new ArsenalWeapons(this);
  move = { x: 0, y: 0 };
  lastMove = { x: 1, y: 0 };
  camera = { x: 0, y: 0 };
  viewport = { x: 13.3, y: 7.5 };
  orbitAngle = 0;
  skills: Record<Skill, number> = {
    blade: 1,
    fire: 0,
    ice: 0,
    lightning: 0,
    scythe: 0,
    ghost: 0,
    water: 0,
    poison: 0,
    bone: 0,
    mine: 0,
    void: 0,
    bat: 0,
    axe: 0, chain: 0, pillar: 0, totem: 0, soul: 0, meteor: 0,
  };
  cooldowns: Record<Skill, number> = {
    blade: 0,
    fire: 0,
    ice: 0,
    lightning: 0,
    scythe: 0,
    ghost: 0,
    water: 0,
    poison: 0,
    bone: 0,
    mine: 0,
    void: 0,
    bat: 0,
    axe: 0, chain: 0, pillar: 0, totem: 0, soul: 0, meteor: 0,
  };
  passives: Record<Passive, number> = { magnet: 0, boots: 0, hourglass: 0 };
  evolutions: Partial<Record<Skill, string>> = {};
  cards: Card[] = [];
  pendingEvolution: Skill | null = null;
  refreshes = 2;
  damage: Record<string, number> = {};
  weaponKills: Record<string, number> = {};
  losses: Record<string, number> = {};
  castCounts: Record<string, number> = {};
  scheduled: ScheduledCast[] = [];
  readonly furnaceRoute: number;
  private nextId = 1;
  private bladeHits = new Map<number, number>();
  private bladePhases = new Map<string, number>();
  private director = new SpawnDirector();
  constructor(
    seed = 12345,
    public character: CharacterId = "ranger",
    public stageId: StageId = 1,
    public weaponSlots = 4,
  ) {
    this.furnaceRoute = furnaceRoute(seed);
    this.seed = seed;
    this.skills.blade = 0;
    this.skills[CHARACTERS[character].weapon] = 1;
  }
  startingWeapons: Skill[] = [];
  offerStartingWeapons() {
    if(this.time!==0 || this.state!=="battle")return false;
    for(const skill of WEAPONS)this.skills[skill]=0;
    const groups: Skill[][] = [["blade","scythe","axe"],["fire","lightning","ghost","bone"],["water","poison","meteor"]];
    this.startingWeapons=groups.map(group=>group[Math.floor(this.random()*group.length)]);
    this.state="starting";this.setMove(0,0);this.touch();return true;
  }
  chooseStartingWeapon(skill: Skill) {
    if(this.state!=="starting" || !this.startingWeapons.includes(skill))return false;
    this.skills[skill]=1;this.startingWeapons=[];this.state="battle";
    this.effects.push({type:"learn",...this.player,skill});this.touch();return true;
  }
  cooldownFactor(skill: Skill) {
    return (
      (1 - [0, 0.1, 0.18][this.passives.hourglass]) *
      (this.character === "necromancer" &&
      (skill === "ghost" || skill === "bat")
        ? 0.9
        : 1)
    );
  }

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
  get shopCanOpen() { return this.state === "battle" && this.pauses.has("menu"); }
  get tagBonus() {
    const tags = ["melee", "projectile", "area", "summon", "elemental", "control", "leech"] as const;
    return Object.fromEntries(tags.map((tag) => [tag, Math.min(0.2, Math.max(0, WEAPONS.filter((s) => this.skills[s] > 0 && (WEAPON_TAGS[s] as readonly string[]).includes(tag)).length - 1) * 0.05)]));
  }
  private shopResult(message: string, ok = false) {
    this.shopMessage = message; this.touch(); return ok;
  }
  get shopActive() { return this.shopCanOpen && this.shopOpen; }
  shopCost(skill: Skill) { return this.skills[skill] ? 3 + this.skills[skill] * 2 : 5; }
  shopBuyReason(skill: Skill) {
    if (!this.shopItems.includes(skill)) return "商品已售出";
    if (this.skills[skill] >= MAX_SKILL_LEVEL) return "已满级";
    if (!this.skills[skill] && this.weaponCount >= this.weaponSlots) return "装备位已满";
    if (this.gold < this.shopCost(skill)) return "金币不足";
    return "";
  }
  openShop() {
    if (!this.shopCanOpen) return false;
    if (!this.shopInitialized) { this.rollShop(); this.shopInitialized = true; }
    this.shopOpen = true;
    return this.shopResult("商品与锁定在本局保留；只有付费刷新才换货", true);
  }
  closeShop() {
    if (!this.shopActive) return false;
    this.shopOpen = false; this.touch(); return true;
  }
  private rollShop() {
    const pool = WEAPONS.filter(s => this.skills[s] < MAX_SKILL_LEVEL);
    const keep = this.shopLocked.filter(s => pool.includes(s));
    this.shopLocked = keep;
    const rest = pool.filter(s => !keep.includes(s));
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.shopItems = [...keep, ...rest].slice(0, 4);
  }
  toggleShopLock(skill: Skill) {
    if (!this.shopActive || !this.shopItems.includes(skill)) return false;
    if (this.shopLocked.includes(skill)) {
      this.shopLocked = this.shopLocked.filter(s => s !== skill);
      return this.shopResult("已取消锁定", true);
    }
    if (this.shopLocked.length >= 2) return this.shopResult("最多锁定两件商品");
    this.shopLocked.push(skill); return this.shopResult("已锁定，付费刷新时保留", true);
  }
  private removeWeapon(skill: Skill) {
    this.skills[skill] = 0; delete this.evolutions[skill]; this.cooldowns[skill] = 0;
    this.shopLocked = this.shopLocked.filter(s => s !== skill);
    this.shots = this.shots.filter(p => p.skill !== skill);
    this.scheduled = this.scheduled.filter(p => p.skill !== skill);
    if (skill === "ice") this.rings = [];
    if (skill === "fire") this.zones = [];
    this.expansion.remove(skill);
    this.combinations.remove(skill);
    this.arsenal.remove(skill);
  }
  sellShop(skill: Skill) {
    if (!this.shopActive) return false;
    if (!this.skills[skill]) return this.shopResult("这把武器已不在装备中");
    if (this.weaponCount <= 1) return this.shopResult("最后一把武器不能回收");
    this.removeWeapon(skill); this.upgrades.reconcileTarget(); this.gold += 3;
    return this.shopResult("回收完成，获得3金币并释放装备位", true);
  }
  refreshShop() {
    if (!this.shopActive) return false;
    if (this.shopRefreshes <= 0) return this.shopResult("本局刷新次数已用完");
    if (this.gold < 2) return this.shopResult("金币不足，刷新需要2金币");
    this.gold -= 2; this.shopRefreshes--; this.rollShop();
    return this.shopResult("刷新完成，锁定商品已保留", true);
  }
  buyShop(skill: Skill) {
    if (!this.shopActive) return false;
    const reason = this.shopBuyReason(skill);
    if (reason) return this.shopResult(reason);
    this.gold -= this.shopCost(skill); this.skills[skill]++;
    this.shopItems = this.shopItems.filter(s => s !== skill);
    this.shopLocked = this.shopLocked.filter(s => s !== skill);
    this.cooldowns[skill] = 0; this.expansion.refresh(skill);
    this.effects.push({type: this.skills[skill] === 7 || this.skills[skill] === 10 ? "evolve" : "learn", ...this.player, skill, value: this.skills[skill]});
    this.autoSynthesize();
    this.upgrades.reconcileTarget();
    return this.shopResult("购买成功，继续冒险后立即生效", true);
  }
  get speed() {
    return 4.2 * (1 + [0, 0.1, 0.18][this.passives.boots]);
  }
  get magnetRadius() {
    return 2.7 * (1 + [0, 0.35, 0.7][this.passives.magnet]);
  }
  /** Rank seven unlocks the signature mechanic; rank ten permits final branching. */
  weaponEvolution(skill: Skill) {
    return this.evolutions[skill] || (this.skills[skill] >= 7 ? EVOLUTIONS[skill][0].id : undefined);
  }
  get ghostCount() {
    return !this.skills.ghost
      ? 0
      : this.weaponEvolution("ghost") === "hunters" ? 2
      : this.weaponEvolution("ghost")
        ? this.skills.ghost >= 10 ? 4 : 3
        : this.skills.ghost >= 2
          ? 2
          : 1;
  }
  get bladeCount() {
    if (!this.skills.blade) return 0;
    return this.weaponEvolution("blade") === "ring"
      ? this.skills.blade >= 10 ? 6 : 5
      : this.skills.blade >= 5
        ? 4
        : this.skills.blade >= 4
          ? 3
          : this.skills.blade >= 2
          ? 2
          : 1;
  }
  get bladeRadius() {
    if (this.weaponEvolution("blade") === "ring") return this.skills.blade>=10?2.4:2.2;
    if (this.weaponEvolution("blade") === "return") {
      const phase = this.time % 3;
      return phase < 1.2 ? 1.7 + 2.3 * Math.sin((phase / 1.2) * Math.PI) : 1.7;
    }
    return this.skills.blade >= 3 ? 2.2 : 1.7;
  }
  get blades(): Blade[] {
    const form=this.weaponEvolution("blade");
    const target=form ? this.priorityTarget(form==="return"?6:3.8) : undefined;
    const aim=target?Math.atan2(target.y-this.player.y,target.x-this.player.x):this.orbitAngle;
    const expansion=form==="return" && this.time%3<1.2;
    const reach=expansion && target ? 1.7+Math.min(3.6,Math.max(2.3,distance(this.player,target)-1.7))*Math.sin((this.time%3)/1.2*Math.PI) : this.bladeRadius;
    const offset=form==="ring" && target ? .65 : 0;
    return Array.from({ length: this.bladeCount }, (_, index) => {
      const angle = expansion && target ? aim+(index-(this.bladeCount-1)/2)*.16 : this.orbitAngle + (index * Math.PI * 2) / this.bladeCount;
      return {
        index,
        angle,
        x: this.player.x + Math.cos(aim)*offset + Math.cos(angle) * reach,
        y: this.player.y + Math.sin(aim)*offset + Math.sin(angle) * reach,
        phase: this.time % 3 < 0.6 ? 0 : 1,
      };
    });
  }
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
        ? c.health * STAGES[this.stageId].bossHealth * 8
        : 30 * (1 + Math.min(this.time, ["forgeguard","mirrorguard","ferryguard","minion","sailor","drowned","boneguard","warflag","starpatrol"].includes(kind) ? 90 : 240) / 300) * c.health *
          (isElite(kind) ? STAGES[this.stageId].elite : STAGES[this.stageId].health) *
          (this.stageId <= 2 && ["mage", "archer"].includes(kind)
            ? 1 + Math.min(2, Math.max(0, this.time - 90) / 90) : 1);
    const e: Enemy = {
      id: this.id(),
      kind,
      x,
      y,
      hp,
      maxHp: hp,
      attack: kind === "mage" ? 1.5 : kind === "boss" ? 2 : 2.2,
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
          distance(e, origin) < range &&
          !exclude.includes(e.id),
      )
      .sort((a, b) =>
        Number(b.kind === "boss") - Number(a.kind === "boss") ||
        distance(a, origin) - distance(b, origin) || a.id - b.id,
      )[0];
  }
  near(p: Point, r: number) {
    return this.enemies.filter((e) => e.hp > 0 && distance(e, p) <= r);
  }
  hurt(amount: number, source: string, scale = true) {
    if (this.invulnerable > 0 || this.hp <= 0) return;
    amount *= scale ? STAGES[this.stageId].damage : 1;
    const lost = Math.min(this.hp, amount);
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
  ) {
    if (e.hp <= 0 || e.state === "arriving") return;
    let amount = base * (bossExposed(this, e) ? 1.25 : 1);
    if (WEAPONS.includes(source as Skill)) {
      const rank = this.skills[source as Skill];
      amount *= rankDamage(rank);
      if (this.evolutions[source as Skill] && rank >= MAX_SKILL_LEVEL) amount *= e.kind === "boss" ? 1.25 : 1.8;
      const tags = WEAPON_TAGS[source as Skill];
      const bonus = Math.max(...tags.map((tag) => (this.tagBonus as Record<string, number>)[tag] || 0), 0);
      amount *= 1 + bonus;
    }
    if (this.character === "necromancer" && source === "ghost") amount *= 1.2;
    if (e.kind === "shield" && direct) {
      const angle = Math.atan2(origin.y - e.y, origin.x - e.x);
      if (
        Math.abs(
          Math.atan2(Math.sin(angle - e.facing), Math.cos(angle - e.facing)),
        ) <
        (Math.PI * 100) / 360
      ) {
        amount *= 0.5;
        this.effects.push({ type: "block", x: e.x, y: e.y });
      }
    }
    amount *= lateStageDamage(this, e, direct);
    const dealt = Math.min(e.hp, amount);
    e.hp -= amount;
    if (combination) this.combinations.recordDamage(combination, Math.max(0, dealt - amount * (1 - extraFraction)));
    const attribution = source === "poisonBurst" ? "poison" : source;
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
      if(e.kind === "warflag"){this.effects.push({type:"death",x:e.x,y:e.y});this.touch();return;}
      this.kills++;
      this.gold += e.summoned ? 0 : 1;
      this.weaponKills[attribution] = (this.weaponKills[attribution] || 0) + 1;
      this.expansion.onDeath(e, source);
      this.combinations.onDeath(e);
      if (e.kind === "slime")
        for (let i = 0; i < 2; i++) {
          const child = this.addEnemy(
            "slimeling",
            e.x + (i ? 0.4 : -0.4),
            e.y,
            true,
          );
          if (child) {
            child.state = "arriving";
            child.timer = 0.6;
          }
        }
      if (e.kind === "bloater" && this.hazards.length < 2) {
        this.hazards.push({
          id: this.id(),
          source: 0,
          kind: "pool",
          x: e.x,
          y: e.y,
          angle: 0,
          radius: 1.4,
          width: 0,
          created: this.time,
          due: this.time + 1,
          until: this.time + 4,
          damage: 10,
          fired: false,
          next: this.time + 2,
        });
      }
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
      } else if (!e.summoned || e.bossReinforcement) {
        const value = ENEMIES[e.kind].xp * STAGES[this.stageId].xp * (e.bossReinforcement ? BOSS_REINFORCEMENT_XP : 1);
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
    this.touch();
  }
  slow(e: Enemy, freeze = false) {
    e.slow = isLarge(e.kind) ? 0.2 : 0.4;
    e.slowUntil = this.time + 1.5;
    if (freeze && e.kind !== "boss" && e.freezeReady <= this.time) {
      e.freezeUntil = this.time + (isElite(e.kind) ? 0.25 : 0.5);
      e.freezeReady = this.time + 3;
      if (e.state === "windup" && !frontierEnemy(e.kind) && !["starpatrol","starweaver","starpuppet"].includes(e.kind)) {
        this.hazards = this.hazards.filter((h) => h.source !== e.id);
        e.state = "recover";
        e.timer = 0.5;
        e.attack = 1;
      }
    }
  }
  step(dt: number) {
    if (!this.active) return;
    this.autoSynthesize();
    if (this.openAutomaticBranch()) return;
    this.time += dt;
    this.combinations.step(dt);
    if (!this.active) return;
    this.ultimate = Math.max(0, this.ultimate - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.player.x = Math.max(
      -22,
      Math.min(22, this.player.x + this.move.x * this.speed * dt),
    );
    this.player.y = Math.max(
      -26,
      Math.min(26, this.player.y + this.move.y * this.speed * dt),
    );
    this.orbitAngle +=
      (dt * Math.PI * 2) /
      (this.weaponEvolution("blade") === "ring"
        ? 1.6
        : this.skills.blade >= 4
          ? 2
          : 2.4);
    this.director.step(this, dt);
    stepGarden(this, 0);
    if(this.stageId===10)this.starPath.sample(this.time,this.player);
    this.altar.step(this);
    this.church.step(this);
    this.crown.step(this);
    this.lateStages.step(this);
    stepEnemies(this, dt);
    stepGarden(this, dt);
    stepHazards(this);
    this.collect(dt);
    this.stepWeapons(dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const id of this.bladeHits.keys())
      if (!this.enemies.some((e) => e.id === id)) {
        this.bladeHits.delete(id);
      }
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
        this.xp += g.value;
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
  private stepWeapons(dt: number) {
    for (const blade of this.blades)
      for (const e of this.near(blade, this.skills.blade >= 3 ? 0.9 : 0.75)) {
        const expansion =
          this.weaponEvolution("blade") === "return" && this.time % 3 < 1.2;
        const key = `${e.id}:${Math.floor(this.time / 3)}:${blade.index}:${blade.phase}`;
        if (
          expansion
            ? !this.bladePhases.has(key)
            : (this.bladeHits.get(e.id) || 0) <= this.time
        ) {
          this.hit(
            e,
            this.attack * (this.weaponEvolution("blade") === "ring" ? 0.7 : 1),
            "blade",
            false,
            blade,
          );
          this.bladeHits.set(
            e.id,
            this.time + (this.weaponEvolution("blade") === "ring" ? 0.35 : 0.45),
          );
          if (expansion) this.bladePhases.set(key, this.time + 3);
        }
      }
    for (const [key, until] of this.bladePhases)
      if (until < this.time) this.bladePhases.delete(key);
    if (this.weaponEvolution("ice") === "domain")
      for (const e of this.near(this.player, 3.5)) {
        e.slow = isLarge(e.kind) ? 0.2 : 0.4;
        e.slowUntil = this.time + 0.15;
      }
    for (const s of WEAPONS.filter(
      (s) => s !== "blade" && !EXPANSION_SKILLS.includes(s) && !ARSENAL_SKILLS.includes(s),
    )) {
      this.cooldowns[s] = Math.max(0, this.cooldowns[s] - dt);
      if (
        this.skills[s] &&
        this.cooldowns[s] <= 0 &&
        this.target(
          this.player,
          s === "ice"
            ? this.weaponEvolution("ice") === "icicle" ? 14 : this.weaponEvolution("ice")
              ? 3.5
              : this.skills.ice >= 2
                ? 3.2
                : 2.4
            : s === "scythe" || s === "axe" ? this.returningRange(s) : 14,
        )
      ) {
        this.cast(s);
        const interval =
          s === "fire"
            ? 3
            : s === "ice"
              ? 4
              : s === "lightning"
                ? 2.6
                : s === "axe" ? (this.weaponEvolution("axe") === "execution" ? 3 : this.skills.axe >= 4 ? 2.2 : 2.8) : s === "scythe"
                  ? this.skills.scythe >= 4
                    ? 1.8
                    : 2.5
                  : this.skills.ghost >= 4
                    ? 0.9
                    : 1.2;
        this.cooldowns[s] = interval * this.cooldownFactor(s);
      }
    }
    this.expansion.step(dt);
    this.arsenal.step(dt);
    const queued = this.scheduled.filter((c) => c.due <= this.time);
    this.scheduled = this.scheduled.filter((c) => c.due > this.time);
    for (const q of queued) this.castPart(q);
    for (const ring of this.rings) {
      ring.age += dt;
      ring.radius = Math.min(ring.maxRadius, (ring.age / 0.5) * ring.maxRadius);
      for (const e of this.near(ring, ring.radius))
        if (!ring.hit.includes(e.id)) {
          ring.hit.push(e.id);
          this.hit(e, this.attack * (this.weaponEvolution("ice") ? 1 : 0.5), "ice");
          this.slow(e, ring.freeze);
        }
    }
    this.rings = this.rings.filter((r) => r.age < 0.65);
    for (const p of this.shots) this.stepShot(p, dt);
    this.shots = this.shots.filter((p) => p.left > 0 && p.ttl > 0);
    for (const z of this.zones)
      if (z.until > this.time && z.next <= this.time) {
        z.next = this.time + 1;
        for (const e of this.near(z, z.radius))
          this.hit(e, z.damage, "fire", false, z, false);
      }
    this.zones = this.zones.filter((z) => z.until > this.time);
    for (const e of this.enemies)
      if (e.hp > 0 && e.burnUntil > this.time && e.burnNext <= this.time) {
        e.burnNext = this.time + 1;
        this.hit(e, e.burn, "fire", false, e, false);
      }
  }
  private cast(s: Skill) {
    this.castCounts[s] = (this.castCounts[s] || 0) + 1;
    this.effects.push({ type: "cast", ...this.player, skill: s });
    if (s === "ice") {
      if (this.weaponEvolution("ice") === "icicle") {
        const target=this.priorityTarget();
        if (!target) return;
        const angle=Math.atan2(target.y-this.player.y,target.x-this.player.x);
        for(let i=0;i<5;i++) {
          const a=angle+(i-2)*.045;
          this.shots.push({id:this.id(),skill:"ice",form:"icicle",...this.player,
            vx:Math.cos(a)*18,vy:Math.sin(a)*18,damage:this.attack*1.3,left:2,hit:[],target:target.id,
            ttl:14/18,age:0,range:14,returning:false,width:.22,extra:0,excursion:0});
        }
        return;
      }
      this.ring(true);
      if (this.skills.ice >= 3 && !this.weaponEvolution("ice"))
        this.scheduled.push({
          skill: s,
          due: this.time + 0.5,
          index: 1,
          targets: [],
        });
      return;
    }
    if (s === "lightning") {
      this.lightning();
      return;
    }
    const count =
      s === "fire"
        ? this.weaponEvolution("fire") === "inferno" ? 6 : this.weaponEvolution("fire")
          ? this.skills.fire>=10?3:1
          : this.skills.fire >= 10 ? 6 : this.skills.fire >= 7 ? 5 : this.skills.fire >= 4
            ? 3
            : this.skills.fire >= 2
              ? 2
              : 1
        : s === "axe" ? (this.weaponEvolution("axe") === "execution" ? 1 : this.skills.axe >= 2 ? 2 : 1)
        : s === "scythe"
          ? this.weaponEvolution("scythe") === "cross" ? 2 : this.weaponEvolution("scythe")
            ? 1
            : this.skills.scythe >= 7 ? 4 : this.skills.scythe >= 2
              ? 2
              : 1
          : this.ghostCount;
    const targets: number[] = [];
    for (let index = 0; index < count; index++)
      this.scheduled.push({
        skill: s,
        due: this.time + (s === "fire" ? index * 0.18 : 0),
        index,
        targets,
      });
  }
  private ring(first: boolean) {
    this.rings.push({
      id: this.id(),
      ...this.player,
      age: 0,
      radius: 0,
      maxRadius: this.weaponEvolution("ice") ? 3.5 : this.skills.ice >= 10 ? 5.2 : this.skills.ice >= 7 ? 4.3 : this.skills.ice >= 4 ? 3.6 : this.skills.ice >= 2 ? 3.2 : 2.4,
      hit: [],
      freeze: first && this.skills.ice >= 4,
    });
  }
  private lightning() {
    const used: number[] = [];
    if (this.weaponEvolution("lightning") === "thunder") {
      for (let i = 0; i < (this.skills.lightning>=10?5:3); i++) {
        const e = this.near(this.player, 14).filter(e => e.state !== "arriving" && !used.includes(e.id))
          .sort((a,b) => Number(b.kind === "boss") - Number(a.kind === "boss") || Number(isElite(b.kind)) - Number(isElite(a.kind)) || distance(a,this.player) - distance(b,this.player))[0];
        if (!e) break;
        used.push(e.id);
        this.effects.push({type: "lightning", ...this.player, endX: e.x, endY: e.y, skill: "lightning"});
        this.hit(e, this.attack * (i<3?3.5:2.5), "lightning");
        this.iceLightning(e);
      }
      return;
    }
    const blasts: Point[] = [];
    for (let chain = 0; chain < (this.skills.lightning >= 3 ? 2 : 1); chain++) {
      let e = this.target(this.player, 14, used),
        from: Point = this.player;
      let amount = this.attack * (this.skills.lightning < 7 ? 1.3 : 1.1);
      for (
        let i = 0;
        e &&
        i <
          (this.skills.lightning >= 10 ? 10 : this.skills.lightning >= 7 ? 8 : this.skills.lightning >= 4 ? 6 : this.skills.lightning >= 2 ? 5 : 3);
        i++
      ) {
        this.effects.push({
          type: "lightning",
          x: from.x,
          y: from.y,
          endX: e.x,
          endY: e.y,
          skill: "lightning",
        });
        this.hit(e, amount, "lightning", false, from);
        this.iceLightning(e);
        used.push(e.id);
        from = { x: e.x, y: e.y };
        amount *= 0.85;
        e = this.target(from, this.skills.lightning >= 4 ? 3.5 : 2.8, used);
      }
      blasts.push(from);
    }
    if (this.weaponEvolution("lightning")) {
      const hit = new Set<number>();
      for (const p of blasts) {
        this.effects.push({
          type: "explosion",
          ...p,
          radius: 1.2,
          skill: "lightning",
        });
        for (const e of this.near(p, 1.2))
          if (!hit.has(e.id)) {
            hit.add(e.id);
            this.hit(e, this.attack * 0.8, "lightning", false, p);
          }
      }
    }
  }
  private iceLightning(e: Enemy) {
    if (!this.combinations.ready("lightning") ||
        (e.freezeUntil <= this.time && e.slowUntil <= this.time)) return;
    this.hit(e, this.attack * 0.8, "lightning", false, e, true, "lightning");
    this.combinations.trigger("lightning", "comboIce", e, 0.8, "ice");
  }
  private returningRange(skill: "scythe" | "axe") {
    return skill === "axe" ? (this.weaponEvolution("axe")==="execution"?6:this.skills.axe>=3?7:5)
      : this.weaponEvolution("scythe")==="cross"?5.5:this.skills.scythe>=3?8:6;
  }
  private priorityTarget(range = 14) {
    return this.near(this.player,range).filter(e=>e.state!=="arriving")
      .sort((a,b)=>Number(b.kind==="boss")-Number(a.kind==="boss") || Number(isElite(b.kind))-Number(isElite(a.kind)) || distance(a,this.player)-distance(b,this.player))[0];
  }
  private castPart(q: ScheduledCast) {
    const s = q.skill;
    if (s === "ice") {
      this.ring(false);
      return;
    }
    let origin = { ...this.player };
    if (s === "ghost") {
      const angle = (q.index * Math.PI * 2) / this.ghostCount + this.time * 0.7;
      origin = {
        x: this.player.x + Math.cos(angle) * 0.85,
        y: this.player.y + Math.sin(angle) * 0.85,
      };
    }
    let target = this.target(origin, 14, q.targets) || this.target(origin, 14);
    if (!target) return;
    if (s === "ghost") {
      target =
        this.enemies
          .filter(
            (e) =>
              e.hp > 0 &&
              e.state !== "arriving" &&
              distance(e, origin) < 14 &&
              (this.weaponEvolution("ghost") === "hunters" || !q.targets.includes(e.id)),
          )
          .sort(
            (a, b) =>
              Number(b.kind === "boss") - Number(a.kind === "boss") ||
              Number(this.combinations.marked("ghost", b)) - Number(this.combinations.marked("ghost", a)) ||
              (this.weaponEvolution("ghost") === "hunters" ? Number(isElite(b.kind)) - Number(isElite(a.kind)) : 0) ||
              Number(b.kind === "mage") - Number(a.kind === "mage") ||
              a.hp - b.hp,
          )[0] || target;
    }
    if (s === "fire" && this.skills.fire>=10 && this.weaponEvolution("fire")==="meteor" && q.index>0 && !this.enemies.some(e=>e.hp>0 && e.state!=="arriving" && distance(e,this.player)<14 && !q.targets.includes(e.id))) return;
    if (s === "fire")
      target =
        this.enemies
          .filter(
            (e) =>
              e.hp > 0 &&
              e.state !== "arriving" &&
              distance(e, this.player) < 14 &&
              !q.targets.includes(e.id),
          )
          .sort(
            (a, b) => Number(b.kind === "boss") - Number(a.kind === "boss") || this.near(b, 1.5).length - this.near(a, 1.5).length,
          )[0] || target;
    if(s === "scythe" || s === "axe") {
      const inRange=this.priorityTarget(this.returningRange(s));
      if(!inRange)return;
      target=inRange;
    }
    q.targets.push(target.id);
    let angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const speed = s === "fire" ? 10 : s === "scythe" || s === "axe" ? 10 : s === "ghost" && this.weaponEvolution("ghost") === "hunters" ? 17 : 13;
    if (s === "scythe") {
      // Aim the curved sweep through the chosen enemy, rather than behind movement.
      // Opposite cross arcs share a target but travel along distinct paths.
      const arc=this.weaponEvolution("scythe")==="cross" ? (q.index===0?1.5:-1.5) : 1.15;
      angle -= Math.asin(Math.min(.8,distance(origin,target)*Math.abs(arc)/(2*speed))) * Math.sign(arc);
      if(!this.weaponEvolution("scythe") && this.skills.scythe>=2)
        angle += ((q.index-.5)*Math.PI)/9;
    } else if(s === "axe" && this.weaponEvolution("axe")!=="execution" && this.skills.axe>=2) {
      angle += ((q.index-.5)*Math.PI)/9;
    }
    this.shots.push({
      id: this.id(),
      skill: s,
      form: this.weaponEvolution(s),
      ...origin,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage:
        this.attack *
        (s === "fire"
          ? this.weaponEvolution("fire")
            ? this.weaponEvolution("fire") === "inferno" ? 1.25 : q.index>0?1.5:3
            : 1.6
          : s === "axe" ? (this.weaponEvolution("axe") === "execution" ? 3 : .95) : s === "scythe"
            ? this.weaponEvolution("scythe") === "cross" ? 1.15 : this.weaponEvolution("scythe")
              ? 2
              : 0.9
            : this.weaponEvolution("ghost") === "hunters" ? 3.2 : 0.7),
      left:
        s === "scythe" || s === "axe" ? 99 : s === "ghost" && this.weaponEvolution("ghost") !== "hunters" && this.skills.ghost >= 3 ? 2 : 1,
      hit: [],
      target: target.id,
      ttl: 4,
      age: 0,
      range: s === "axe" || s === "scythe" ? this.returningRange(s) : 0,
      returning: false,
      width:
        s === "scythe" || s === "axe"
          ? s === "axe" && this.weaponEvolution("axe") === "execution" ? .55 : s === "scythe" && this.weaponEvolution("scythe") === "cross" ? 0.8 : this.weaponEvolution(s)
            ? 1.2
            : this.skills[s] >= 3
              ? 0.65
              : 0.5
          : 0.35,
      extra: s === "scythe" && this.weaponEvolution("scythe") === "cross" ? q.index : 0,
      excursion: 0,
    });
  }
  private stepShot(p: Shot, dt: number) {
    const old = { x: p.x, y: p.y };
    p.ttl -= dt;
    p.age += dt;
    if (p.skill === "fire" || p.skill === "ghost") {
      let t = this.enemies.find((e) => e.id === p.target && e.hp > 0);
      if(!t && p.skill==='ghost') {
        t=this.enemies.filter(e=>e.hp>0&&e.state!=='arriving'&&!p.hit.includes(e.id)&&distance(e,p)<14)
          .sort((a,b)=>Number(b.kind==='boss')-Number(a.kind==='boss')||distance(a,p)-distance(b,p))[0];
        if(t)p.target=t.id;
      }
      if (t) {
        const d = distance(t, p);
        const speed=p.skill === "ghost" ? (p.form === "hunters" ? 17 : 13) : 10;
        p.vx = ((t.x - p.x) / Math.max(0.01, d)) * speed;
        p.vy = ((t.y - p.y) / Math.max(0.01, d)) * speed;
      }
    }
    if (p.skill === "scythe" || p.skill === "axe") {
      if (!p.returning && p.age * 10 >= p.range) {
        p.returning = true;
        p.hit = [];
      }
      if (p.returning) {
        const marked = p.skill === "scythe" ? this.enemies.filter(e => !p.hit.includes(e.id) && this.combinations.marked("scythe", e) && distance(e,p)<4)
          .sort((a,b)=>distance(a,p)-distance(b,p))[0] : undefined;
        const destination = marked || this.player;
        const d = distance(p, destination);
        if (!marked && d < 0.4) {
          p.left = 0;
          return;
        }
        const direction = !marked && p.excursion > 0 ? -1 : 1;
        p.excursion = Math.max(0, p.excursion - 10 * dt);
        p.vx = ((destination.x - p.x) / Math.max(0.01, d)) * 10 * direction;
        p.vy = ((destination.y - p.y) / Math.max(0.01, d)) * 10 * direction;
      }
      // 镰刀扫出宽幅弧线；战斧保持直线往返，形成清晰的武器差异。
      if (p.skill === "scythe" && !p.returning) {
        const arc = p.form === "cross" ? (p.extra === 0 ? 1.5 : -1.5) : 1.15;
        const vx = p.vx;
        const vy = p.vy;
        const c = Math.cos(arc * dt);
        const s = Math.sin(arc * dt);
        p.vx = vx * c - vy * s;
        p.vy = vx * s + vy * c;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.skill === "bone") this.expansion.queueMinesOnSegment(old, p);
    const hits = this.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          e.state !== "arriving" &&
          !p.hit.includes(e.id) &&
          segmentDistance(e, old, p) < p.width + (isLarge(e.kind) ? 0.65 : 0.3),
      )
      .sort((a, b) => distance(a, old) - distance(b, old));
    for (const e of hits) {
      if (p.skill === "fire") {
        this.explode(p);
        p.left = 0;
        break;
      }
      if (p.skill === "ice") this.slow(e, p.form === "icicle");
      if (p.skill === "axe") this.combinations.mark("scythe", e);
      if (p.skill === "ghost") this.combinations.strike("ghost", e, old);
      if (p.skill === "scythe" && p.returning) this.combinations.strike("scythe", e, old);
      this.hit(e, p.damage * (p.skill === "axe" && p.returning ? (p.form === "execution" ? 1.15 : p.form ? 1.7 : this.skills.axe >= 4 ? 1.35 : 1) : p.skill === "scythe" && p.form === "cross" && p.returning ? 1.5 : 1), p.skill, false, old);
      if (p.skill === "bone" && p.form === "ram" && e.kind !== "boss" && e.kind !== "warflag") {
        const push = isLarge(e.kind) ? 0.35 : 0.7;
        e.x = Math.max(-22.7, Math.min(22.7, e.x + (p.vx / 13) * push));
        e.y = Math.max(-26.7, Math.min(26.7, e.y + (p.vy / 13) * push));
      }
      if ((p.form === "cross" && p.returning) || (p.form === "execution" && p.returning)) {
        const radius=p.form==="cross"?1.1:1.5;
        for(const other of this.near(e,radius))if(other.id!==e.id)this.hit(other,this.attack*(p.form==="cross"?.35:.65),p.skill,false,e);
        this.effects.push({type:"explosion",x:e.x,y:e.y,radius,skill:p.skill});
      }
      if(p.form==="hunters"&&e.hp<=0){
        for(const other of this.near(e,1.3))this.hit(other,this.attack,"ghost",false,e);
        this.effects.push({type:"explosion",x:e.x,y:e.y,radius:1.3,skill:"ghost"});
      }
      p.hit.push(e.id);
      p.left--;
      if (p.skill === "ghost" && (p.form ?? this.weaponEvolution("ghost")) && (p.form ?? this.weaponEvolution("ghost")) !== "hunters") {
        for (const other of this.near(e, 0.8).filter(other => other.id !== e.id))
          this.hit(other, this.attack * 0.3, "ghost", false, e);
        this.effects.push({
          type: "explosion",
          x: e.x,
          y: e.y,
          radius: 0.8,
          skill: "ghost",
        });
      }
      if (
        p.skill === "scythe" &&
        p.returning &&
        (p.form ?? this.weaponEvolution("scythe")) === "reaper" &&
        e.hp <= 0 &&
        p.extra < 3
      ) {
        p.extra++;
        p.excursion += 1;
        p.ttl += 0.2;
      }
      if (p.skill === "bone" && p.form === "ricochet") {
        const next=this.target(e,4,p.hit);
        if(next && p.left>0){const d=Math.max(.01,distance(next,e));p.x=e.x;p.y=e.y;p.vx=(next.x-e.x)/d*13;p.vy=(next.y-e.y)/d*13;p.target=next.id;p.damage*=.85;}
        else p.left=0;
        break;
      }
      if (p.left <= 0) break;
    }
    if (p.skill === "fire" && p.ttl <= 0 && p.left > 0) {
      this.explode(p);
      p.left = 0;
    }
  }
  private explode(p: Shot) {
    const radius = this.weaponEvolution("fire")
      ? this.weaponEvolution("fire") === "inferno" ? 1.5 : 2.3
      : this.skills.fire >= 3
        ? 1.7
        : 1.2;
    for (const e of this.near(p, radius)) {
      this.hit(e, p.damage, "fire", false, p);
      if (this.skills.fire >= 3) {
        e.burn = this.attack * 0.25;
        e.burnUntil = this.time + 2;
        e.burnNext = this.time + 1;
      }
    }
    if (this.combinations.ready("fire")) {
      for (const e of this.near(p, radius + 1.2))
        this.hit(e, this.attack * 0.45, "fire", false, p, true, "fire");
      this.combinations.trigger("fire", "comboFire", p, radius + 1.2, "blade");
    }
    if (this.weaponEvolution("fire"))
      this.zones.push({
        x: p.x,
        y: p.y,
        radius,
        form: p.form || this.weaponEvolution("fire"),
        until: this.time + (this.weaponEvolution("fire") === "inferno" ? 6 : 2),
        next: this.time + 1,
        damage: this.attack * 0.4,
      });
    this.effects.push({
      type: this.weaponEvolution("fire") ? "fireImpact" : "explosion",
      form: p.form || this.weaponEvolution("fire"),
      x: p.x,
      y: p.y,
      radius,
      skill: "fire",
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

  synthesisOptions() { return this.upgrades.synthesisOptions(); }
  synthesize(skill: Skill) { return this.upgrades.synthesize(skill); }
  private autoSynthesize() { this.upgrades.autoSynthesize(); }
  private openAutomaticBranch() { return this.upgrades.openAutomaticBranch(); }
  get buildTarget() { return this.upgrades.buildTarget; }
  get growthProgress() { return this.upgrades.growthProgress; }
  targetReason(main: Skill) { return this.upgrades.targetReason(main); }
  setBuildTarget(main: Skill | null) { return this.upgrades.setBuildTarget(main); }
  get growthPair() { return this.upgrades.growthPair; }
  get buildWeapons() { return this.upgrades.buildWeapons; }
  private checkUpgrade() { this.upgrades.checkUpgrade(); }
  legal() { return this.upgrades.legal(); }
  private roll() { this.upgrades.roll(); }
  refresh() { return this.upgrades.refresh(); }
  choose(card: Card) { return this.upgrades.choose(card); }
  evolve(id: string) { return this.upgrades.evolve(id); }
  back() { this.upgrades.back(); }
}
