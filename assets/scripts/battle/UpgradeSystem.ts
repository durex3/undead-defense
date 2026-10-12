import type { SurvivalWorld } from "./SurvivalWorld";
import { CHARACTERS } from "./ProgressionConfig";
import { Card, Skill, Passive, WEAPONS, MAX_SKILL_LEVEL, SYNTHESIS_RECIPES, PASSIVES, EVOLUTIONS } from "./SurvivalConfig";

/** Owns upgrade choices and automatic fusion; the world owns combat state. */
export class UpgradeSystem {
  private target: Skill | null = null;
  private branchQueue: Skill[] = [];
  private automaticBranch = false;
  private specialIndex = 0;
  constructor(private world: SurvivalWorld, private result: (message: string, ok?: boolean) => boolean) {}
  targetReason(main: Skill): string {
    const partner = SYNTHESIS_RECIPES[main];
    if (!partner) return "没有对应组合";
    if (this.world.skills[main] >= MAX_SKILL_LEVEL && this.world.skills[partner] >= MAX_SKILL_LEVEL) return "组合已达成";
    const missing = Number(!this.world.skills[main]) + Number(!this.world.skills[partner]);
    return missing > this.world.weaponSlots - this.world.weaponCount ? `需要${missing}个空余武器位` : "";
  }
  get buildTarget(): Skill | null {
    return this.target && !this.targetReason(this.target) ? this.target : null;
  }
  setBuildTarget(main: Skill | null) {
    if (this.world.state !== "upgrade" && !(this.world.state === "battle" && (this.world.time === 0 || this.world.pauses.has("menu")))) return false;
    if (main !== null && this.targetReason(main)) return false;
    this.target = main;
    if (main && this.world.state === "upgrade") {
      // Keep existing alternatives; changing targets never rerolls random rewards.
      const legal = this.legal();
      const pair: Card[] = [main, SYNTHESIS_RECIPES[main]!];
      const candidates = pair.concat(this.world.cards, legal);
      this.world.cards = candidates.filter((c, index) => legal.includes(c) && candidates.indexOf(c) === index).slice(0, 3);
    }
    this.world.touch();
    return true;
  }
  reconcileTarget() {
    if (this.target && this.targetReason(this.target)) this.target = null;
  }
  get growthProgress() {
    const pair = this.growthPair;
    return pair ? {...pair, remaining: Math.max(0, MAX_SKILL_LEVEL - this.world.skills[pair.main]) + Math.max(0, MAX_SKILL_LEVEL - this.world.skills[pair.partner]), locked: !!this.buildTarget} : null;
  }
  synthesisOptions() {
    return WEAPONS.filter(s => { const other = SYNTHESIS_RECIPES[s];
      return !!other && this.world.skills[s] >= MAX_SKILL_LEVEL && this.world.skills[other] >= MAX_SKILL_LEVEL && !this.world.evolutions[s];
    });
  }
  synthesize(skill: Skill) {
    if (!this.synthesisOptions().includes(skill)) return this.result("两把配方武器都需要10级，且尚未组合进化");
    // Both weapons remain equipped and keep their independent attacks.
    this.world.evolutions[skill] = EVOLUTIONS[skill][0].id;
    if (this.target === skill) this.target = null;
    if (EVOLUTIONS[skill].length > 1) this.branchQueue.push(skill);
    this.world.cooldowns[skill] = 0; this.world.expansion.refresh(skill);
    this.world.effects.push({ type: "evolve", ...this.world.player, skill, form: this.world.evolutions[skill], final: EVOLUTIONS[skill].length === 1 });
    return this.result("组合超武觉醒，两把武器均保留", true);
  }
  autoSynthesize() {
    for (const skill of this.synthesisOptions()) this.synthesize(skill);
  }
  openAutomaticBranch() {
    if (this.world.state !== "battle" || !this.branchQueue.length) return false;
    this.branchQueue = this.branchQueue.filter(s => this.world.skills[s] >= MAX_SKILL_LEVEL && !!this.world.evolutions[s] && this.world.skills[SYNTHESIS_RECIPES[s]!] >= MAX_SKILL_LEVEL);
    if (!this.branchQueue.length) return false;
    this.world.pendingEvolution = this.branchQueue.shift()!;
    this.automaticBranch = true;
    this.world.state = "evolution";
    this.world.setMove(0, 0);
    this.world.touch();
    return true;
  }
  /** Recommend the unfinished recipe with the most existing investment. */
  get growthPair(): { main: Skill; partner: Skill } | null {
    const target = this.buildTarget;
    if (target) return {main: target, partner: SYNTHESIS_RECIPES[target]!};
    const starter = CHARACTERS[this.world.character].weapon;
    const pairs = Object.entries(SYNTHESIS_RECIPES).map(([main, partner]) => ({main: main as Skill, partner: partner!}))
      .filter(({main, partner}) => {
        const a = this.world.skills[main], b = this.world.skills[partner];
        return a + b > 0 && (a < MAX_SKILL_LEVEL || b < MAX_SKILL_LEVEL) &&
          ((a > 0 && b > 0) || this.world.weaponCount < this.world.weaponSlots);
      })
      .sort((a,b) => (this.world.skills[b.main] + this.world.skills[b.partner]) - (this.world.skills[a.main] + this.world.skills[a.partner]) ||
        Number(b.main === starter || b.partner === starter) - Number(a.main === starter || a.partner === starter));
    return pairs[0] || null;
  }
  get buildWeapons(): Skill[] {
    const starter = CHARACTERS[this.world.character].weapon;
    return WEAPONS.filter(s => this.world.skills[s] > 0).sort((a,b) => this.world.skills[b]-this.world.skills[a] || Number(b===starter)-Number(a===starter));
  }
  checkUpgrade() {
    if (this.world.level < 50 && this.world.xp >= this.world.xpNeed) {
      this.world.xp -= this.world.xpNeed;
      this.world.level++;
      this.world.hp = Math.min(this.world.maxHp, this.world.hp + 5);
      this.world.state = "upgrade";
      this.world.setMove(0, 0);
      this.roll();
    }
  }
  legal(): Card[] {
    const pool: Card[] = WEAPONS.filter(
      (s) =>
        (this.world.skills[s] < MAX_SKILL_LEVEL || (!SYNTHESIS_RECIPES[s] && !this.world.evolutions[s])) && (this.world.skills[s] > 0 || this.world.weaponCount < this.world.weaponSlots),
    );
    const slots = PASSIVES.filter((p) => this.world.passives[p] > 0).length;
    pool.push(
      ...PASSIVES.filter(
        (p) => this.world.passives[p] < 2 && (this.world.passives[p] > 0 || slots < 2),
      ),
    );
    if (this.world.hp < 80) pool.push("repair");
    return pool;
  }
  roll() {
    const pool = this.legal(),
      cards: Card[] = [];
    const pick = (c?: Card) => {
      if (cards.length < 3 && c && pool.includes(c) && !cards.includes(c)) {
        cards.push(c);
        pool.splice(pool.indexOf(c), 1);
      }
    };
    const randomPick = (p: Card[]) => {
      if (p.length) pick(p[Math.floor(this.world.random() * p.length)]);
    };
    const target = this.buildTarget;
    if (target) { pick(target); pick(SYNTHESIS_RECIPES[target]); }
    const evolutions = pool.filter(
      (c) => WEAPONS.includes(c as Skill) && this.world.skills[c as Skill] >= MAX_SKILL_LEVEL && !this.world.evolutions[c as Skill],
    );
    if (evolutions.length) {
      pick(evolutions[this.specialIndex++ % evolutions.length]);
    } else if (this.world.level === 2) pick(this.buildWeapons[0]);
    const owned = pool.filter((c) => WEAPONS.includes(c as Skill) && this.world.skills[c as Skill] > 0);
    const fresh = pool.filter((c) => WEAPONS.includes(c as Skill) && !this.world.skills[c as Skill]);
    // Keep the invested weapon and its legal recipe partner available.
    // Remaining slots can offer a different build or a passive.
    const focused = this.buildWeapons.filter(s => owned.includes(s));
    const pair = this.growthPair;
    pick(pair?.main);
    pick(pair?.partner);
    pick(focused[0]);
    pick(focused[1]);
    if (this.world.weaponCount < this.world.weaponSlots && fresh.length && (this.world.level <= 4 || this.world.random() < 0.35)) randomPick(fresh);
    while (cards.length < 3 && pool.length) randomPick(pool);
    this.world.cards = cards.length ? cards : ["repair"];
    this.world.touch();
  }
  refresh() {
    if (this.world.state !== "upgrade" || !this.world.refreshes) return false;
    this.world.refreshes--;
    this.roll();
    return true;
  }
  choose(c: Card) {
    if (this.world.state !== "upgrade" || !this.world.cards.includes(c)) return false;
    if (WEAPONS.includes(c as Skill)) {
      const s = c as Skill;
      if (this.world.skills[s] >= MAX_SKILL_LEVEL && SYNTHESIS_RECIPES[s]) return false;
      if (this.world.skills[s] >= MAX_SKILL_LEVEL && !this.world.evolutions[s]) {
        this.world.pendingEvolution = s;
        this.world.state = "evolution";
        this.world.touch();
        return true;
      }
      this.world.skills[s]++;
      this.world.cooldowns[s] = 0;
      this.world.expansion.refresh(s);
      this.world.effects.push({ type: "learn", ...this.world.player, skill: s });
      // Late ranks are explicit breakthrough beats even before the branch
      // evolution: the battlefield gets a burst and the player gets a clear
      // confirmation that the weapon changed tier.
      if (this.world.skills[s] === 4 || this.world.skills[s] === 7 || this.world.skills[s] === 10) {
        this.world.effects.push({ type: "evolve", ...this.world.player, skill: s, value: this.world.skills[s] });
        this.world.cooldowns[s] = 0;
      }
    } else if (c === "repair") {
      this.world.healing.repair += Math.min(20, this.world.maxHp - this.world.hp);
      this.world.hp = Math.min(this.world.maxHp, this.world.hp + 20);
    }
    else this.world.passives[c as Passive]++;
    this.autoSynthesize();
    this.reconcileTarget();
    this.completeChoice();
    return true;
  }
  evolve(id: string) {
    const s = this.world.pendingEvolution;
    if (
      this.world.state !== "evolution" ||
      !s ||
      this.world.skills[s] < MAX_SKILL_LEVEL ||
      (!!SYNTHESIS_RECIPES[s] && this.world.skills[SYNTHESIS_RECIPES[s]!] < MAX_SKILL_LEVEL) ||
      !EVOLUTIONS[s].some((e) => e.id === id)
    )
      return false;
    this.world.evolutions[s] = id;
    this.world.cooldowns[s] = 0;
    this.world.expansion.refresh(s);
    this.world.pendingEvolution = null;
    this.automaticBranch = false;
    this.world.effects.push({ type: "evolve", ...this.world.player, skill: s, form: id, final: true });
    this.completeChoice();
    return true;
  }
  back() {
    if (this.world.state === "evolution") {
      if (this.automaticBranch && this.world.pendingEvolution) {
        this.evolve(EVOLUTIONS[this.world.pendingEvolution][0].id);
        return;
      }
      this.world.pendingEvolution = null;
      this.world.state = "upgrade";
      this.world.touch();
    }
  }
  completeChoice() {
    this.world.cards = [];
    this.world.state = "battle";
    this.world.setMove(0, 0);
    this.world.touch();
    this.checkUpgrade();
    this.openAutomaticBranch();
  }
}
