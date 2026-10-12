import { hordePressure, bossCrowdRules } from "./HordePressure";
import { encounterBeat } from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Kind, ENEMIES, isElite } from "./SurvivalConfig";
export class SpawnDirector {
  restUntil = 0;
  private nextGroup = 0;
  private nextSpecial = 25;
  private boss = false;
  private nextBossWave = 0;
  private elites = [false, false];
  private lastAngle = 0;
  step(w: SurvivalWorld, dt: number) {
    if (!w.active) return;
    if (w.time >= 240 && !this.boss) {
      this.boss = true;
      w.hazards = [];
      let kept = 0;
      w.enemies = w.enemies.filter(
        (e) => e.kind === "minion" && e.hp > 0 && kept++ < bossCrowdRules(w.stageId).target,
      );
      const p = this.position(w, Math.atan2(-w.player.y, -w.player.x), 6.5);
      w.addEnemy("boss", p.x, p.y);
      this.nextBossWave = w.time + 2.5;
      w.effects.push({ type: "boss", ...p });
      return;
    }
    if (this.boss) { this.bossHorde(w); return; }
    for (let i = 0; i < 2; i++) {
      const due = i ? 175 : 90;
      if (!this.elites[i] && w.time >= due) {
        const special = w.enemies.filter(
          (e) => ENEMIES[e.kind].threat > 0,
        ).length;
        if (special > 2 && w.time < due + 10) continue;
        if (w.enemies.some((e) => isElite(e.kind) && e.hp > 0)) continue;
        const p = this.position(w, this.lastAngle + Math.PI, 7);
        const e = w.addEnemy(i ? "charger" : "executioner", p.x, p.y);
        if (e) {
          if (w.stageId >= 5) w.hazards=w.hazards.filter(h=>h.source!==0);
          if (w.stageId >= 2) { e.hp *= i === 0 ? .9 : 1.1; e.maxHp = e.hp; }
          if (w.stageId === 4) w.hazards = w.hazards.filter(h => h.kind !== "bellRing" && h.kind !== "bellPulse");
          if (w.stageId === 3) w.hazards = w.hazards.filter(h => h.kind !== "flame");
          e.state = "arriving";
          e.timer = 1.5;
          this.elites[i] = true;
          w.effects.push({ type: "elite", ...p });
        }
        break;
      }
    }
    if (w.stageId === 3 && w.time >= 230) w.hazards = w.hazards.filter(h => h.kind !== "flame");
    const beat = encounterBeat(w.time);
    if (w.time < this.restUntil || beat.rest) return;
    const elite = w.enemies.some((e) => isElite(e.kind) && e.hp > 0);
    this.nextGroup -= dt;
    if (this.nextGroup <= 0) {
      const early = w.time < 0.1;
      const pressure = hordePressure(w);
      const count = early
        ? 6
        : Math.min(15, 3 + Math.floor(w.time / 40) + (elite ? 0 : pressure.extra) + (beat.harvest ? 2 : 0));
      const base = (this.lastAngle = w.random() * Math.PI * 2);
      for (let i = 0; i < count; i++) {
        const angle = early
          ? (i * Math.PI * 2) / count
          : base +
            (i - count / 2) * 0.16 +
            (beat.harvest && i >= count / 2 ? Math.PI * 0.6 : 0);
        const p = early
          ? { x: Math.cos(angle) * 5.8, y: Math.sin(angle) * 5.8 }
          : this.position(w, angle);
        w.addEnemy("minion", p.x, p.y);
      }
      this.nextGroup =
        Math.max(1.5, 3 - w.time / 200) /
        (elite ? 1 : pressure.rate) /
        (elite ? 0.4 : beat.harvest ? 1.15 : 1);
    }
    if (w.time < this.nextSpecial || w.time >= 230 || elite || beat.harvest)
      return;
    this.nextSpecial = w.time + 8 + w.random() * 4 - (w.time >= 110 ? (w.stageId - 1) * .5 : 0);
    // Each encounter teaches at most two special roles; survivors carry over within the threat budget.
    let allowed: Kind[] =
      w.time < 45
        ? ["rogue"]
        : w.time < 65
          ? ["slime", "archer"]
          : w.time < 85
            ? ["boar", "wisp"]
            : w.time < 110
              ? ["rogue"]
              : w.time < 130
                ? ["shield", "mage"]
                : w.time < 150
                  ? ["banshee", "slime"]
                  : w.time < 175
                    ? ["drummer", "bloater"]
                    : w.time < 205
                      ? ["summoner", "archer"]
                      : Math.floor((w.time - 205) / 9) % 3 === 0
                        ? ["summoner", "wisp"]
                        : Math.floor((w.time - 205) / 9) % 3 === 1
                          ? ["banshee", "drummer"]
                          : ["boar", "bloater"];
    if (w.stageId === 2)
      allowed =
        w.time < 55
          ? ["slime"]
          : w.time < 85
            ? ["wisp", "slime"]
            : w.time < 130
              ? ["banshee", "archer"]
              : w.time < 175
                ? ["drummer", "slime"]
                : ["summoner", "banshee"];
    if (w.stageId === 3)
      allowed = w.time < 60 ? ["shield", "archer"] : w.time < 82 ? ["shield"]
        : w.time < 120 ? ["archer"] : w.time < 150 ? ["drummer", "shield"]
        : w.time < 175 ? ["summoner", "archer"] : ["banshee", "shield", "archer"];
    if (w.stageId === 3 && w.time >= 230) w.hazards = w.hazards.filter(h => h.kind !== "flame");
    if (w.stageId === 4) {
      if(w.time>=60 && w.time<75)return;
      allowed = w.time < 30 ? ["shield"] : w.time < 60 ? ["shield","archer"]
        : w.time < 82 ? ["banshee"] : w.time < 120 ? ["archer"]
        : w.time < 150 ? ["drummer","shield"] : w.time < 175 ? ["summoner","shield"] : ["banshee","archer"];
    }
    if(w.stageId===5){
      if((w.time>=60&&w.time<75)||w.time>=225)return;
      allowed=w.time<60?["shield","archer"]:w.time<82?["shield"]:w.time<120?["drummer"]:w.time<150?["banshee"]:w.time<175?["summoner","shield"]:["archer","banshee"];
    }
    if(w.stageId>=6){
      if((w.time>=60&&w.time<75)||w.time>=225)return;
      allowed=w.stageId===6
        ? (w.time<60?["shield"]:w.time<82?["archer"]:w.time<120?["shield"]:w.time<150?["shield","drummer"]:w.time<175?["bloater"]:["shield","summoner"])
        : (w.time<60?["archer"]:w.time<82?["wisp"]:w.time<120?["archer"]:w.time<150?["mage","slime"]:w.time<175?["banshee"]:["archer","wisp"]);
    }
    const budget = (w.time < 55 ? 2 : w.time < 110 ? 4 : w.time < 175 ? 6 : 8)
      + (w.time >= 110 ? Math.floor((w.stageId - 1) / 2) : 0);
    let used = w.enemies.reduce(
      (sum, e) => sum + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
      0,
    );
    for (let i = 0; i < 3; i++) {
      const kind = allowed[i % allowed.length],
        c = ENEMIES[kind];
      if (w.stageId >= 3 && (kind === "drummer" || kind === "summoner") && w.enemies.some(e => e.hp > 0 && e.kind === kind)) continue;
      if (
        used + c.threat > budget ||
        w.enemies.filter((e) => e.kind === kind && e.hp > 0).length >= c.cap
      )
        continue;
      const p = this.position(w, this.lastAngle + 0.6 + i * (w.stageId===7 ? Math.PI*2/3 : 0.22));
      if (w.addEnemy(kind, p.x, p.y)) used += c.threat;
    }
  }
  private bossHorde(w: SurvivalWorld) {
    const boss=w.enemies.find(e=>e.kind==='boss' && e.hp>0);
    if(!boss || boss.state==='arriving' || (boss.state==='windup' && boss.bossAction==='transition')) {
      this.nextBossWave=Math.max(this.nextBossWave,w.time+.8);
      return;
    }
    if(w.time<this.nextBossWave)return;
    const rules=bossCrowdRules(w.stageId,boss.bossPhase);
    this.nextBossWave=w.time+rules.interval;
    const alive=w.enemies.filter(e=>e.hp>0 && e.kind!=='boss').length;
    const count=Math.min(rules.batch,rules.target-alive);
    // Omit an inward-facing sector so each new wave leaves a movement lane.
    const gap=Math.hypot(w.player.x,w.player.y)>3?Math.atan2(-w.player.y,-w.player.x):Math.atan2(w.lastMove.y,w.lastMove.x);
    for(let i=0;i<count;i++) {
      const angle=gap+.65+(Math.PI*2-1.3)*(i+.5)/count;
      const p=this.position(w,angle);
      if(Math.hypot(p.x-w.player.x,p.y-w.player.y)<4)continue;
      const actual=Math.atan2(p.y-w.player.y,p.x-w.player.x);
      if(Math.abs(Math.atan2(Math.sin(actual-gap),Math.cos(actual-gap)))<.6)continue;
      const e=w.addEnemy('minion',p.x,p.y,true);
      if(!e)break;
      // Reinforcements are distinct from the boss's own capped summon skill.
      e.state='arriving';e.timer=1; e.owner=0;
    }
  }
  private position(w: SurvivalWorld, angle: number, radius?: number) {
    for (let i = 0; i < 16; i++) {
      const a = angle + (i * Math.PI) / 8;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      const r =
        radius ??
        Math.min(
          (w.viewport.x + 0.8) / Math.max(0.01, Math.abs(dx)),
          (w.viewport.y + 0.8) / Math.max(0.01, Math.abs(dy)),
        );
      const center = radius ? w.player : w.camera;
      const x = center.x + dx * r,
        y = center.y + dy * r;
      if (
        Math.abs(x) < 22.8 &&
        Math.abs(y) < 26.8 &&
        Math.hypot(x - w.player.x, y - w.player.y) > 3
      )
        return { x, y };
    }
    return {
      x: w.player.x > 0 ? -21 : 21,
      y: Math.max(-25, Math.min(25, w.player.y)),
    };
  }
}
