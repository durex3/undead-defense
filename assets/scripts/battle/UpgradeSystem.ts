import { MAX_PLAYER_LEVEL } from "./EncounterPacing";
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
    // Partner weapons choose their own attack style at rank ten, without another XP roll.
    for (const skill of WEAPONS) {
      if (SYNTHESIS_RECIPES[skill] || EVOLUTIONS[skill].length < 2 || this.world.skills[skill] < MAX_SKILL_LEVEL || this.world.evolutions[skill]) continue;
      this.world.evolutions[skill] = EVOLUTIONS[skill][0].id;
      this.branchQueue.push(skill);
      this.world.cooldowns[skill] = 0;
      this.world.effects.push({type:"evolve",...this.world.player,skill,form:this.world.evolutions[skill],final:false});
    }
  }
  openAutomaticBranch() {
    if (this.world.state !== "battle" || !this.branchQueue.length) return false;
    this.branchQueue = this.branchQueue.filter(s => this.world.skills[s] >= MAX_SKILL_LEVEL && !!this.world.evolutions[s] && (!SYNTHESIS_RECIPES[s] || this.world.skills[SYNTHESIS_RECIPES[s]!] >= MAX_SKILL_LEVEL));
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
    if (this.world.level < MAX_PLAYER_LEVEL && this.world.xp >= this.world.xpNeed) {
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
    const pool = this.legal(), cards: Card[] = [];
    const pair = this.growthPair;
    // Sampling without replacement: a target changes odds, never guarantees a card.
    const weight = (c: Card) => {
      if (!WEAPONS.includes(c as Skill)) return 1;
      const owned = this.world.skills[c as Skill] > 0;
      const recommended = c === pair?.main || c === pair?.partner;
      return (owned ? 1.5 : 1) * (recommended ? (this.buildTarget ? 2 : 1.3) : 1);
    };
    while (cards.length < 3 && pool.length) {
      let roll = this.world.random() * pool.reduce((sum,c)=>sum+weight(c),0);
      let index = pool.length - 1;
      for(let i=0;i<pool.length;i++){roll-=weight(pool[i]);if(roll<0){index=i;break;}}
      cards.push(pool.splice(index,1)[0]);
    }
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
