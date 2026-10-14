import {FrontierDirector} from "./FrontierSystem";
import {isFrontier,frontierMap} from "./FrontierMaps";
import {ObservatoryDirector} from "./ObservatorySystem";
import {observatoryBlocked} from "./ObservatoryMap";
import {ArsenalDirector} from "./ArsenalSystem";
import {arsenalBlocked} from "./ArsenalMap";
import {HarborDirector} from "./HarborSystem";
import {harborBlocked} from "./HarborMap";
import { FURNACE_STONES, furnaceEncounter, furnaceRest } from "./FurnaceEncounters";
import { midgameEncounter, midgameRest } from "./MidgameEncounters";
import { ALTAR_STONES, CHURCH_STONES } from "./GardenMap";
import { CROWN_STONES } from "./CrownSystem";
import { hordePressure, bossCrowdRules } from "./HordePressure";
import { encounterBeat, encounterTime, BOSS_TIME } from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Kind, ENEMIES, isElite } from "./SurvivalConfig";
export class SpawnDirector {
  private frontier=new FrontierDirector();
  private observatory=new ObservatoryDirector();
  private arsenal=new ArsenalDirector();
  private harbor=new HarborDirector();
  restUntil = 0;
  private nextGroup = 0;
  private nextSpecial = 25;
  private specialWave = 0;
  private boss = false;
  private nextBossWave = 0;
  private elites = [false, false];
  private lastAngle = 0;
  step(w: SurvivalWorld, dt: number) {
    if (!w.active) return;
    const t = encounterTime(w.time);
    if (w.time >= BOSS_TIME && !this.boss) {
      this.boss = true;
      if(w.stageId===10)w.starPath.clear();
      w.hazards = [];
      let kept = 0;
      w.enemies = w.enemies.filter(
        (e) => e.kind === "minion" && e.hp > 0 && kept++ < bossCrowdRules(w.stageId).target,
      );
      const p = this.position(w, Math.atan2(-w.player.y, -w.player.x), 6.5);
      w.addEnemy("boss", p.x, p.y);
      this.nextBossWave = w.time + 1.5;
      w.effects.push({ type: "boss", ...p });
      return;
    }
    if (this.boss) { this.bossHorde(w); return; }
    for (let i = 0; i < 2; i++) {
      if(w.time>=BOSS_TIME-20)break;
      const due = i ? 350 : 180;
      if (!this.elites[i] && w.time >= due) {
        const special = w.enemies.filter(
          (e) => ENEMIES[e.kind].threat > 0,
        ).length;
        if (special > 2 && w.time < due + 20) continue;
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
    if (w.stageId === 3 && t >= 230) w.hazards = w.hazards.filter(h => h.kind !== "flame");
    if(isFrontier(w.stageId)){this.frontier.step(w,dt,(a,r)=>this.position(w,a,r));return;}
    if(w.stageId===10){this.observatory.step(w,dt,(a,r)=>this.position(w,a,r));return;}
    if(w.stageId===9){this.arsenal.step(w,dt,(a,r)=>this.position(w,a,r));return;}
    if(w.stageId===8){this.harbor.step(w,dt,(a,r)=>this.position(w,a,r));return;}
    const beat = encounterBeat(w.time);
    const furnace = w.stageId===6 ? furnaceEncounter(w.time,w.furnaceRoute) : null;
    const midgame = midgameEncounter(w.stageId,w.time);
    const encounter = furnace || midgame;
    if (w.time < this.restUntil || beat.rest || midgameRest(w.stageId,w.time) || (w.stageId===6 && furnaceRest(w.time))) return;
    const elite = w.enemies.some((e) => isElite(e.kind) && e.hp > 0);
    this.nextGroup -= dt;
    if (this.nextGroup <= 0) {
      const early = w.time < 0.1;
      const pressure = hordePressure(w);
      const count = early
        ? 6
        : Math.min(22, 5 + Math.floor(w.time / 55) + (elite ? 0 : pressure.extra) + (beat.harvest ? 2 : 0));
      const base = (this.lastAngle = w.random() * Math.PI * 2);
      for (let i = 0; i < count; i++) {
        const angle = early
          ? (i * Math.PI * 2) / count
          : base +
            (i - count / 2) * 0.16 +
            (w.time>=120 && i >= count / 2 ? Math.PI * .85 : 0);
        const p = early
          ? { x: Math.cos(angle) * 5.8, y: Math.sin(angle) * 5.8 }
          : this.position(w, angle);
        w.addEnemy("minion", p.x, p.y);
      }
      this.nextGroup =
        Math.max(.9, 2.7 - w.time / 250) /
        (elite ? 1 : pressure.rate) /
        (elite ? 0.4 : beat.harvest ? 1.15 : 1);
    }
    if (w.time < this.nextSpecial || t >= 230 || elite || (beat.harvest && !encounter && (w.time < 240 || Math.floor(w.time / 20) % 2 === 0)))
      return;
    this.nextSpecial = w.time + (encounter || (w.stageId <= 2 && w.time >= 120) ? 9 : 12) + w.random() * 6 - (t >= 110 ? (w.stageId - 1) * .5 : 0);
    this.specialWave++;
    // Each encounter teaches at most two special roles; survivors carry over within the threat budget.
    let allowed: Kind[] =
      t < 45
        ? ["rogue"]
        : t < 65
          ? ["slime", "archer"]
          : t < 85
            ? ["boar", "wisp"]
            : t < 110
              ? ["rogue"]
              : t < 130
                ? ["shield", "mage"]
                : t < 150
                  ? ["banshee", "slime"]
                  : t < 175
                    ? ["drummer", "bloater"]
                    : t < 205
                      ? ["summoner", "archer"]
                      : Math.floor((t - 205) / 9) % 3 === 0
                        ? ["summoner", "wisp"]
                        : Math.floor((t - 205) / 9) % 3 === 1
                          ? ["banshee", "drummer"]
                          : ["boar", "bloater"];
    if (w.stageId === 2)
      allowed =
        t < 55
          ? ["slime"]
          : t < 85
            ? ["wisp", "slime"]
            : t < 130
              ? ["banshee", "archer"]
              : t < 175
                ? ["drummer", "slime"]
                : ["summoner", "banshee"];
    // Early stages keep their native pack on alternate waves. Ranged pairs ask
    // developed builds to reposition without changing ice or detecting idle input.
    if (w.stageId <= 2 && w.time >= 120 && this.specialWave % 2 === 0)
      allowed = ["archer", "mage"];
    if (w.stageId === 3)
      allowed = t < 60 ? ["shield", "archer"] : t < 82 ? ["shield"]
        : t < 120 ? ["archer"] : t < 150 ? ["drummer", "shield"]
        : t < 175 ? ["summoner", "archer"] : ["banshee", "shield", "archer"];
    if (w.stageId === 3 && t >= 230) w.hazards = w.hazards.filter(h => h.kind !== "flame");
    if (w.stageId === 4) {
      if(t>=60 && t<75)return;
      allowed = t < 30 ? ["shield"] : t < 60 ? ["shield","archer"]
        : t < 82 ? ["banshee"] : t < 120 ? ["archer"]
        : t < 150 ? ["drummer","shield"] : t < 175 ? ["summoner","shield"] : ["banshee","archer"];
    }
    if(w.stageId===5){
      if((t>=60&&t<75)||t>=225)return;
      allowed=t<60?["shield","archer"]:t<82?["shield"]:t<120?["drummer"]:t<150?["banshee"]:t<175?["summoner","shield"]:["archer","banshee"];
    }
    if(w.stageId>=6){
      if((t>=60&&t<75)||t>=225)return;
      allowed=w.stageId===6
        ? (t<60?["shield"]:t<82?["archer"]:t<120?["shield"]:t<150?["shield","drummer"]:t<175?["bloater"]:["shield","summoner"])
        : (t<60?["archer"]:t<82?["wisp"]:t<120?["archer"]:t<150?["mage","slime"]:t<175?["banshee"]:["archer","wisp"]);
    }
    if(encounter)allowed=[...encounter.enemies];
    const budget = (t < 55 ? 2 : t < 110 ? 4 : t < 175 ? 6 : 8)
      + (t >= 110 ? Math.floor((w.stageId - 1) / 2) : 0);
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
      const spread=midgame?.spread ?? (furnace?.id==='pursuit' ? Math.PI : w.stageId===7 ? Math.PI*2/3 : .22);
      const p = this.position(w, this.lastAngle + 0.6 + i * spread);
      // Put the archer behind its shield relative to the player. No teleporting after arrival.
      if((furnace || midgame?.rearGuard) && (kind==='archer'||kind==='summoner')) {
        const shield=w.enemies.find(e=>e.kind==='shield'&&e.hp>0&&e.born===w.time);
        if(shield){const a=Math.atan2(shield.y-w.player.y,shield.x-w.player.x);const x=shield.x+Math.cos(a)*1.8,y=shield.y+Math.sin(a)*1.8;
          const stones=w.stageId===3?ALTAR_STONES:w.stageId===4?CHURCH_STONES:w.stageId===5?CROWN_STONES:FURNACE_STONES;
          if(Math.abs(x)<22.8&&Math.abs(y)<26.8&&!stones.some(s=>Math.hypot(s.x-x,s.y-y)<1.5)){p.x=x;p.y=y;}}
      }
      const spawned=w.addEnemy(kind,p.x,p.y);
      if(spawned){
        if(w.stageId <= 2 && w.time >= 120 && ["archer", "mage"].includes(kind)) {
          spawned.state="arriving"; spawned.timer=1.2; spawned.attack=.6;
        }
        if(encounter){spawned.state='arriving';spawned.timer=1.2;spawned.attack=.6;}
        used+=c.threat;
      }
    }
  }
  private bossHorde(w: SurvivalWorld) {
    const boss=w.enemies.find(e=>e.kind==='boss' && e.hp>0);
    if(!boss || boss.state==='arriving' || (boss.state==='windup' && boss.bossAction==='transition')) {
      this.nextBossWave=Math.max(this.nextBossWave,w.time+.8);
      return;
    }
    // Dense surges alternate with a short clear-and-approach window for close-range builds.
    if((w.time-BOSS_TIME)%14>=9) {
      this.nextBossWave=Math.max(this.nextBossWave,w.time+.3);
      return;
    }
    if(boss.state==='windup'&&boss.bossAction==='harborSummon'){this.nextBossWave=Math.max(this.nextBossWave,w.time+1.5);return;}
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
      e.bossReinforcement=true;
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
        !(isFrontier(w.stageId) && frontierMap(w.stageId).blocked({x,y},.4)) &&
        !(w.stageId===10 && observatoryBlocked({x,y},.4)) &&
        !(w.stageId===9 && arsenalBlocked({x,y},.4)) &&
        !(w.stageId===8 && harborBlocked({x,y},.4)) &&
        !(w.stageId===6 && FURNACE_STONES.some(s=>Math.hypot(s.x-x,s.y-y)<1.5)) &&
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
