import type { SurvivalWorld } from "./SurvivalWorld";
import { MAX_SKILL_LEVEL, SYNTHESIS_RECIPES, Skill } from "./SurvivalConfig";
import type { Effect, Enemy, Point } from "./SurvivalTypes";

export interface CombinationStats { damage: number; triggers: number; }
/** Records only actual extra damage; normal weapon damage keeps its original attribution. */
export class CombinationSystem {
  readonly stats: Partial<Record<Skill, CombinationStats>> = {};
  private marks = new Map<string, { until: number; next: number; enemy: number }>();
  constructor(private world: SurvivalWorld) {}
  ready(main: Skill) {
    const partner = SYNTHESIS_RECIPES[main];
    return !!partner && !!this.world.evolutions[main] && this.world.skills[main] >= MAX_SKILL_LEVEL && this.world.skills[partner] >= MAX_SKILL_LEVEL;
  }
  recordDamage(main: Skill, damage: number) {
    if (damage <= 0) return;
    const stats = this.stats[main] ?? (this.stats[main] = {damage: 0, triggers: 0});
    stats.damage += damage;
  }
  trigger(main: Skill, type: Effect["type"], point: Point, radius: number, visualSkill: Skill = main) {
    const stats = this.stats[main] ?? (this.stats[main] = {damage: 0, triggers: 0});
    stats.triggers++;
    this.world.effects.push({type, x: point.x, y: point.y, radius, skill: visualSkill});
  }
  mark(main: "ghost" | "scythe", enemy: Enemy) {
    if (!this.ready(main) || enemy.hp <= 0 || enemy.state === "arriving") return;
    const key = main + ":" + enemy.id;
    const existing = this.marks.get(key);
    this.marks.set(key, {enemy: enemy.id, until: this.world.time + 2, next: existing?.next ?? -Infinity});
  }
  marked(main: "ghost" | "scythe", enemy: Enemy) {
    return this.ready(main) && enemy.hp > 0 && (this.marks.get(main + ":" + enemy.id)?.until ?? -Infinity) > this.world.time;
  }
  strike(main: "ghost" | "scythe", enemy: Enemy, origin: Point) {
    const mark = this.marks.get(main + ":" + enemy.id);
    if (!mark || !this.marked(main, enemy) || mark.next > this.world.time) return;
    mark.until = 0; mark.next = this.world.time + 0.6;
    if (main === "ghost") {
      this.world.hit(enemy, this.world.attack * 0.9, "ghost", false, origin, true, "ghost");
      this.trigger("ghost", "comboGhost", enemy, 0.7);
    } else {
      for (const target of this.world.near(enemy, 1.25))
        this.world.hit(target, this.world.attack * 0.75, "scythe", false, origin, true, "scythe");
      this.trigger("scythe", "comboReap", enemy, 1.25);
    }
  }
  step() {
    for (const [key, mark] of this.marks) {
      if ((mark.until <= this.world.time && mark.next <= this.world.time) || !this.world.enemies.some(e=>e.id===mark.enemy && e.hp>0)) this.marks.delete(key);
    }
  }
  remove(skill: Skill) {
    if (["ghost", "bat", "scythe", "axe"].includes(skill)) {
      const main = skill === "ghost" || skill === "bat" ? "ghost" : "scythe";
      for (const key of this.marks.keys()) if (key.startsWith(main + ":")) this.marks.delete(key);
    }
  }
}
