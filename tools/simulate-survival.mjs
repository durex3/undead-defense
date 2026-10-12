import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { EVOLUTIONS, WEAPONS, SYNTHESIS_RECIPES } from "../temp/tests/battle/SurvivalConfig.mjs";
const profiles = {
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
const profile = process.argv[2] || "classic";
for (const mode of profile === "classic"
  ? ["stationary", "collector"]
  : ["collector"])
  for (const seed of [1, 19, 72]) {
    const w = new SurvivalWorld(
      seed,
      process.argv[3] || "ranger",
      Number(process.argv[4] || 1),
    );
    const checkpoints = [];
    const comboTriggers = {};
    const requestedMain = profile.startsWith("pair:") ? profile.slice(5) : null;
    if (requestedMain && !SYNTHESIS_RECIPES[requestedMain]) throw new Error(`Unknown recipe ${requestedMain}`);
    const recipeMain = requestedMain || {scythes:"scythe",bonepair:"bone",chainpair:"chain",soulpair:"totem"}[profile] || {ranger:"fire",alchemist:"water",necromancer:"ghost"}[w.character];
    const recipePair = [recipeMain,SYNTHESIS_RECIPES[recipeMain]];
    if (locked) w.setBuildTarget(recipeMain);
    let firstCombo = null;
    let firstUpgrade = 0,
      firstEvolution = 0,
      next = 30;
    for (
      let i = 0;
      i < 60 * 400 && w.state !== "lost" && w.state !== "won";
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
      if (firstCombo === null && w.evolutions[recipeMain]) firstCombo = Math.round(w.time);
      if (mode === "collector") {
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
        for (const e of w.enemies) {
          const d = distance(e),
            r = cautious && ["executioner","charger","boss"].includes(e.kind) ? 3.4 : e.kind === "boss" ? 2.1 : 1.4;
          if (d < r) {
            dx += ((w.player.x - e.x) / Math.max(0.01, d)) * (r - d) * 3;
            dy += ((w.player.y - e.y) / Math.max(0.01, d)) * (r - d) * 3;
          }
        }
        for (const h of w.hazards) {
          const d = distance(h);
          if (["circle", "pool", ...(cautious ? ["flame", "sector"] : [])].includes(h.kind) && d < h.radius + 1) {
            dx += ((w.player.x - h.x) / Math.max(0.1, d)) * 2;
            dy += ((w.player.y - h.y) / Math.max(0.1, d)) * 2;
          }
          if (cautious && (h.kind === "bellRing" || h.kind === "bellPulse") && d < h.radius + .5 && d >= h.width) {
            const inward = h.width > 0 && d - h.width < h.radius - d;
            const sign = inward ? -1 : 1;
            dx += sign * ((w.player.x-h.x)/Math.max(.1,d))*3;
            dy += sign * ((w.player.y-h.y)/Math.max(.1,d))*3;
          }
          if (h.kind === "line" || (cautious && h.kind === "flameLine")) {
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
        if (w.enemies.filter((e) => distance(e) < 3).length > 5)
          w.useUltimate();
      }
      w.camera = {
        x: Math.max(-512 / 48, Math.min(512 / 48, w.player.x)),
        y: Math.max(-984 / 48, Math.min(984 / 48, w.player.y)),
      };
      w.step(1 / 60);
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
        mode,
        seed,
        state: w.state,
        time: Math.round(w.time),
        hp: w.hp,
        kills: w.kills,
        level: w.level,
        firstCombo,
        comboBeforeBoss: firstCombo !== null && firstCombo < 240,
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
