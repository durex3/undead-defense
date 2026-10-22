import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
await withVerificationLock(async () => {
  const rows = [];
  for (const kind of ["duet","hunter","warden","elite"])
    for (const scene of [
      "center",
      "edge",
      "corner",
      "plinth",
      "close",
      "circle",
      "weave",
    ])
      for (const dt of [1 / 30, 0.2]) {
        const w = new SurvivalWorld(31, "ranger", 19);
        w.time = 400;
        w.hp = w.maxHp = 1e8;
        w.player = {
          x: ["edge", "corner"].includes(scene)
            ? 20
            : scene === "plinth"
              ? -7
              : 0,
          y: scene === "corner" ? 24 : scene === "plinth" ? -10 : 0,
        };
        w.camera = { ...w.player };
        w.viewport = { x: (7.5 * 844) / 390, y: 7.5 };
        w.director.step = () => {};
        w.armory.step = () => {};
        let actors;
    if(kind==='elite'){
      const ps=scene==='edge'?[{x:20,y:-3.2},{x:19.9,y:4}]:scene==='corner'?[{x:16,y:21.4},{x:19,y:20}]:scene==='plinth'?[{x:-7,y:-15},{x:-6,y:-10}]:[{x:-3,y:-2},{x:3.5,y:1}];
      actors=['huntermarshal','gateballista'].map((k,i)=>w.addEnemy(k,ps[i].x,ps[i].y));
    }else{
      actors=w.twingate.spawnBosses();if(!actors)throw Error('Pair spawn failed '+scene);
      if(kind!=='duet'){const dead=actors.find(e=>e.twin.role!==kind);dead.state='seek';w.hit(dead,1e9,'blade');w.time=w.twingate.encounter.soloAt;w.twingate.tick();}
      actors=actors.filter(e=>e.hp>0);
    }
    for(const e of actors){e.state='seek';e.attack=0;e.visibleSince=w.time-1;}
    let maxSlots = 0,
          walls = 0,
          maxBodyStep = 0;
        const old = actors.map((e) => ({ x: e.x, y: e.y }));
        for (let t = 0; t < 120; t += dt) {
          if (["circle", "weave"].includes(scene)) {
            const target =
              scene === "circle"
                ? { x: Math.cos(t * 0.5) * 3, y: Math.sin(t * 0.5) * 3 }
                : { x: Math.sin(t * 0.5) * 5, y: Math.sin(t * 0.27) * 2 };
            const d = Math.hypot(target.x - w.player.x, target.y - w.player.y);
            w.setMove(
              d
                ? ((target.x - w.player.x) / d) * Math.min(1, d / dt / w.speed)
                : 0,
              d
                ? ((target.y - w.player.y) / d) * Math.min(1, d / dt / w.speed)
                : 0,
            );
          }
          w.camera = {
            x: Math.max(-512 / 48, Math.min(512 / 48, w.player.x)),
            y: Math.max(-1124 / 48, Math.min(1124 / 48, w.player.y)),
          };
          w.step(dt);
          maxSlots = Math.max(maxSlots, w.twingate.slots);
          actors.forEach((e, i) => {
            if (w.stageStrategy.map.blocked(e, 0.699)) walls++;
            maxBodyStep = Math.max(
              maxBodyStep,
              Math.hypot(e.x - old[i].x, e.y - old[i].y),
            );
            old[i] = { x: e.x, y: e.y };
          });
          w.drain();
        }
        rows.push({
          kind,
          scene,
          dt,
          damage: 1e8 - w.hp,
          maxSlots,
          wallViolations: walls,
          maxBodyStep,
          patterns: { ...w.twingate.stats.patterns },
          eliteCasts: { ...w.twingate.stats.eliteCasts },
          pairs: w.twingate.stats.pairs,
          solo: structuredClone(w.twingate.stats.solo),
          rejected: w.twingate.stats.rejected,
        });
      }
  const issues=rows.filter(r=>r.maxSlots>2||r.wallViolations||r.maxBodyStep>5.1*r.dt+1e-5||(!['circle','weave'].includes(r.scene)&&r.damage===0)||(['duet','elite'].includes(r.kind)&&r.scene==='center'&&!r.pairs));
  fs.mkdirSync("artifacts/stage19-implementation", { recursive: true });
  fs.writeFileSync(
    "artifacts/stage19-implementation/combat.json",
    JSON.stringify(
      {
        scope:
          "Real world, two Boss bodies, either solo survivor or paired elites, no weapons/director, 120s, stationary and moving,30/5fps. Not a win-rate test.",
        rows,
        issues,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ cases: rows.length, issues }, null, 2));
  if (issues.length) throw Error("Stage19 combat diagnostic failed");
});
