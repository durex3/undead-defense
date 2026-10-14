import { sandMap } from "../temp/tests/battle/SandMap.mjs";
import { siegeMap } from "../temp/tests/battle/SiegeMap.mjs";
import {isFrontier,frontierMap} from "../temp/tests/battle/FrontierMaps.mjs";
import {MAX_PLAYER_LEVEL} from "../temp/tests/battle/EncounterPacing.mjs";
import {observatoryHeading} from "../temp/tests/battle/ObservatoryMap.mjs";
import {arsenalHeading} from "../temp/tests/battle/ArsenalMap.mjs";
import {harborHeading} from "../temp/tests/battle/HarborMap.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { EVOLUTIONS, WEAPONS, SYNTHESIS_RECIPES } from "../temp/tests/battle/SurvivalConfig.mjs";
const profiles = {
  icecamp: ["lightning", "ice", "ghost", "fire", "blade", "water"],
  focused: ["blade", "fire"],
  scythes: ["scythe", "axe"],
  bonepair: ["bone", "mine"],
  chainpair: ["chain", "pillar"],
  soulpair: ["totem", "soul"],
  classic: ["blade", "lightning", "fire", "ghost", "ice", "scythe"],
  ground: ["water", "poison", "mine", "blade"],
  bone: ["bone", "mine", "water", "blade"],
  swarm: ["void", "bat", "bone", "blade"],
};
const locked = process.argv[7] === "locked";
const alternate = process.argv[6] === "alternate";
const cautious = process.argv[5] === "cautious";
const campStart = Number(process.argv[11] || 60);
const profile = process.argv[2] || "classic";
// Optional final argument: collector,camp (move for 60s, stand until boss),stationary.
for (const mode of process.argv[10] ? process.argv[10].split(",") : profile === "classic"
  ? ["stationary", "collector"]
  : ["collector"])
  for (const seed of process.argv[9] ? process.argv[9].split(",").map(Number) : [1, 19, 72]) {
    const w = new SurvivalWorld(
      seed,
      process.argv[3] || "ranger",
      Number(process.argv[4] || 1),
      Number(process.argv[8] || 6),
    );
    w.offerStartingWeapons();
    const preferred={ranger:"blade",alchemist:"water",necromancer:"ghost"}[w.character];
    w.chooseStartingWeapon(w.startingWeapons.includes(preferred)?preferred:w.startingWeapons[1]);
    const navigation={x:0,y:0};
    const checkpoints = [];
    const comboTriggers = {};
    const requestedMain = profile.startsWith("pair:") ? profile.slice(5) : null;
    if (requestedMain && !SYNTHESIS_RECIPES[requestedMain]) throw new Error(`Unknown recipe ${requestedMain}`);
    const recipeMain = requestedMain || {scythes:"scythe",bonepair:"bone",chainpair:"chain",soulpair:"totem"}[profile] || {ranger:"fire",alchemist:"water",necromancer:"ghost"}[w.character];
    const recipePair = [recipeMain,SYNTHESIS_RECIPES[recipeMain]];
    if (locked) w.setBuildTarget(recipeMain);
    let firstCombo = null;
    let firstMaxLevel = null;
    let firstUpgrade = 0,
      firstEvolution = 0,
      next = 30;
    for (
      let i = 0;
      i < 60 * 720 && w.state !== "lost" && w.state !== "won";
      i++
    ) {
      if (w.state === "upgrade") {
        if (!firstUpgrade) firstUpgrade = w.time;
        const priority = (profile === "recipe" || requestedMain) ? recipePair.slice().sort((a,b)=>w.skills[a]-w.skills[b]) : profiles[profile];
        const c =
          (w.hp < 45 && w.cards.includes("repair") ? "repair" : null) ||
          w.cards.find((c) => WEAPONS.includes(c) && w.skills[c] === 10) ||
          (profile === "focused" ? w.buildWeapons.find(c=>w.cards.includes(c)) : null) ||
          priority.find((c) => w.cards.includes(c)) ||
          w.cards[0];
        w.choose(c);
      }
      if (w.state === "evolution") {
        const forms = EVOLUTIONS[w.pendingEvolution];
        w.evolve(forms[alternate ? forms.length - 1 : 0].id);
        if (!firstEvolution) firstEvolution = w.time;
      }
      if (firstCombo === null && w.combinations.ready(recipeMain)) firstCombo = Math.round(w.time);
      const camping = mode === "camp" && w.time >= campStart && w.time < 480;
      if (camping) { w.setMove(0, 0); w.useUltimate(); }
      if (mode === "collector" || (mode === "camp" && !camping)) {
        const distance = (p) => Math.hypot(p.x - w.player.x, p.y - w.player.y);
        const near = (list) =>
          list.slice().sort((a, b) => distance(a) - distance(b))[0];
        const target = (w.hp < 70 ? near(w.potions) : null) ||
          near(w.gems) ||
          near(w.enemies) || {
            x: Math.cos(w.time * 0.1) * 8,
            y: Math.sin(w.time * 0.1) * 8,
          };
        let dx = (target.x - w.player.x) / Math.max(1, distance(target)),
          dy = (target.y - w.player.y) / Math.max(1, distance(target));
        if(w.stageId>=14||isFrontier(w.stageId)||w.stageId===8||w.stageId===9||w.stageId===10){Object.assign(navigation,w.player);const a=(w.stageId===15?sandMap.heading:w.stageId===14?siegeMap.heading:isFrontier(w.stageId)?frontierMap(w.stageId).heading:w.stageId===10?observatoryHeading:w.stageId===9?arsenalHeading:harborHeading)(navigation,target);dx=Math.cos(a);dy=Math.sin(a);}
        for (const e of w.enemies) {
          const d = distance(e),
            r = cautious && profile === "pair:water" && e.kind === "boss" ? 2.1 : cautious && ["executioner","charger","boss"].includes(e.kind) ? 3.4 : e.kind === "boss" ? 2.1 : 1.4;
          if (d < r) {
            dx += ((w.player.x - e.x) / Math.max(0.01, d)) * (r - d) * 3;
            dy += ((w.player.y - e.y) / Math.max(0.01, d)) * (r - d) * 3;
          }
        }
        for (const h of w.hazards) {
          const d = distance(h);
          if (["circle", "pool", "starLeap", "frontierImpact", ...(cautious ? ["flame", "sector"] : [])].includes(h.kind) && d < h.radius + 1) {
            dx += ((w.player.x - h.x) / Math.max(0.1, d)) * 2;
            dy += ((w.player.y - h.y) / Math.max(0.1, d)) * 2;
          }
          if (cautious && (h.kind === "bellRing" || h.kind === "bellPulse") && d < h.radius + .5 && d >= h.width) {
            const inward = h.width > 0 && d - h.width < h.radius - d;
            const sign = inward ? -1 : 1;
            dx += sign * ((w.player.x-h.x)/Math.max(.1,d))*3;
            dy += sign * ((w.player.y-h.y)/Math.max(.1,d))*3;
          }
          if(h.kind === "starTrace" || h.kind === "frontierLane") {
            const vx=(h.endX??h.x)-h.x,vy=(h.endY??h.y)-h.y,len=Math.hypot(vx,vy);
            const t=Math.max(0,Math.min(1,((w.player.x-h.x)*vx+(w.player.y-h.y)*vy)/(len*len||1)));
            const rx=w.player.x-h.x-vx*t,ry=w.player.y-h.y-vy*t,d=Math.hypot(rx,ry);
            if(d<h.width+.8){const nx=d>.05?rx/d:-vy/(len||1),ny=d>.05?ry/d:vx/(len||1);dx+=nx*3;dy+=ny*3;}
          }
          if (h.kind === "arrow" || h.kind === "line" || (cautious && h.kind === "flameLine")) {
            const rx = w.player.x - h.x,
              ry = w.player.y - h.y,
              side = -rx * Math.sin(h.angle) + ry * Math.cos(h.angle),
              along = rx * Math.cos(h.angle) + ry * Math.sin(h.angle);
            if (along > 0 && along < h.radius && Math.abs(side) < 1.2) {
              dx -= Math.sin(h.angle) * Math.sign(side || 1) * 2;
              dy += Math.cos(h.angle) * Math.sign(side || 1) * 2;
            }
          }
        }
        if (Math.abs(w.player.x) > 20) dx -= Math.sign(w.player.x) * 2;
        if (Math.abs(w.player.y) > 24) dy -= Math.sign(w.player.y) * 2;
        w.setMove(dx, dy);
        if (w.gems.length>=8 || w.gems.reduce((sum,g)=>sum+g.value,0)>=w.xpNeed)
          w.useUltimate();
      }
      w.camera = {
        x: Math.max(-512 / 48, Math.min(512 / 48, w.player.x)),
        y: Math.max(-984 / 48, Math.min(984 / 48, w.player.y)),
      };
      w.step(1 / 60);
      if(firstMaxLevel===null&&w.level>=MAX_PLAYER_LEVEL)firstMaxLevel=Math.round(w.time);
      for (const event of w.drain()) if (event.type.startsWith("combo")) comboTriggers[event.type] = (comboTriggers[event.type] || 0) + 1;
      if (w.time >= next) {
        checkpoints.push({ t: next, level: w.level, hp: w.hp, kills: w.kills });
        next += 30;
      }
    }
    console.log(
      JSON.stringify({
        profile,
        cautious,
        locked,
        alternate,
        character: w.character,
        stage: w.stageId,
        siegeStats: w.stageId===14 ? w.siege.stats : null,
        sandStats:w.stageId===15?w.sand.stats:null,
        furnaceRoute: w.stageId===6 ? w.furnaceRoute : null,
        losses: w.losses,
        lastDamageSource: w.lastDamageSource,
        bossRemaining: (()=>{const b=w.enemies.find(e=>e.kind==="boss"&&e.hp>0);return b?Math.ceil(b.hp/b.maxHp*100):null;})(),
        mode,
        campStart: mode === "camp" ? campStart : null,
        seed,
        state: w.state,
        time: Math.round(w.time),
        hp: w.hp,
        kills: w.kills,
        level: w.level,
        firstCombo,
        firstMaxLevel,
        comboBeforeBoss: firstCombo !== null && firstCombo < 480,
        firstUpgrade: Math.round(firstUpgrade),
        firstEvolution: Math.round(firstEvolution),
        skills: w.skills,
        evolutions: w.evolutions,
        checkpoints,
        comboTriggers,
        combinationStats: w.combinations?.stats || {},
      }),
    );
  }
