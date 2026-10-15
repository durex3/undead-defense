import { MAX_PLAYER_LEVEL } from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import {
  Card,
  Skill,
  Passive,
  WEAPONS,
  MAX_SKILL_LEVEL,
  PASSIVES,
  PASSIVE_MAX,
} from "./SurvivalConfig";
import { MODS, modReason } from "./ArmoryConfig";
export class UpgradeSystem {
  constructor(private w: SurvivalWorld) {}
  options() {
    const s = this.w.pendingModification;
    return s ? MODS[s].filter((m) => !this.w.mods[s].includes(m.id)) : [];
  }
  openNode() {
    const w = this.w;
    if (w.state !== "battle") return false;
    const s = WEAPONS.find(
      (s) =>
        w.skills[s] >= (w.mods[s].length === 0 ? 4 : 8) && w.mods[s].length < 2,
    );
    if (!s) return false;
    w.pendingModification = s;
    w.state = "modification";
    w.setMove(0, 0);
    w.touch();
    return true;
  }
  checkUpgrade() {
    const w = this.w;
    if (!w.active) return;
    if (this.openNode()) return;
    if (w.level < MAX_PLAYER_LEVEL && w.xp >= w.xpNeed) {
      w.xp -= w.xpNeed;
      w.level++;
      w.state = "upgrade";
      w.setMove(0, 0);
      this.roll();
    }
  }
  legal(): Card[] {
    const w = this.w;
    const cards: Card[] = WEAPONS.filter(
      (s) =>
        w.skills[s] < MAX_SKILL_LEVEL &&
        (w.skills[s] > 0 || w.weaponCount < w.weaponSlots),
    );
    const slots = PASSIVES.filter((p) => w.passives[p] > 0).length;
    cards.push(
      ...PASSIVES.filter(
        (p) =>
          w.passives[p] < PASSIVE_MAX[p] && (w.passives[p] > 0 || slots < 4),
      ),
    );
    if (!cards.length) cards.push(w.hp < w.maxHp ? "repair" : "continue");
    return cards;
  }
  roll() {
    const w = this.w,
      pool = this.legal(),
      cards: Card[] = [];
    const group = (c: Card) =>
      WEAPONS.includes(c as Skill)
        ? w.skills[c as Skill] > 0
          ? 0
          : 1
        : PASSIVES.includes(c as Passive)
          ? w.passives[c as Passive] > 0
            ? 2
            : 3
          : 4;
    while (cards.length < 3 && pool.length) {
      const groups = [0, 1, 2, 3, 4].map((g) =>
        pool.filter((c) => group(c) === g),
      );
      const weights = [55, 20, 15, 10, 1].map((n, i) =>
        groups[i].length ? n : 0,
      );
      let r = w.random() * weights.reduce((a, b) => a + b, 0),
        g = 4;
      for (let i = 0; i < 5; i++) {
        r -= weights[i];
        if (r < 0) {
          g = i;
          break;
        }
      }
      const items = groups[g],
        c = items[Math.floor(w.random() * items.length)];
      cards.push(c);
      pool.splice(pool.indexOf(c), 1);
    }
    w.cards = cards;
    w.touch();
  }
  refresh() {
    if (this.w.state !== "upgrade" || !this.w.refreshes) return false;
    this.w.refreshes--;
    this.roll();
    return true;
  }
  choose(c: Card) {
    const w = this.w;
    if (
      w.state !== "upgrade" ||
      !w.cards.includes(c) ||
      !this.legal().includes(c)
    )
      return false;
    if (WEAPONS.includes(c as Skill)) {
      w.skills[c as Skill]++;
      w.effects.push({ type: "learn", ...w.player, skill: c });
    } else if (PASSIVES.includes(c as Passive)) {
      w.passives[c as Passive]++;
      if (c === "vitality") {
        w.maxHp += 15;
        w.hp += 15;
      }
    } else if (c === "repair") {
      const heal = Math.min(20, w.maxHp - w.hp);
      w.hp += heal;
      w.healing.repair += heal;
    }
    this.complete();
    return true;
  }
  chooseMod(id: string) {
    const w = this.w,
      s = w.pendingModification;
    if (
      w.state !== "modification" ||
      !s ||
      w.skills[s] < (w.mods[s].length === 0 ? 4 : 8) ||
      modReason(w, s, id)
    )
      return false;
    w.mods[s].push(id);
    w.effects.push({
      type: "modify",
      ...w.player,
      skill: s,
      form: id,
      final: true,
    });
    w.pendingModification = null;
    this.complete();
    return true;
  }
  private complete() {
    const w = this.w;
    w.cards = [];
    w.state = "battle";
    w.setMove(0, 0);
    w.touch();
    if (!this.openNode()) this.checkUpgrade();
  }
}
