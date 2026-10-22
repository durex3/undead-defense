/** Characterization captured before the behavior-preserving refactor. */
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  ENEMY_KINDS,
  ALL_WEAPONS,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { battleHud } from "../temp/tests/presentation/BattleHud.mjs";
export function captureArchitecture() {
  const result = { combat: [], hud: [], progress: [] };
  for (let stage = 1; stage <= 16; stage++)
    for (const kind of ENEMY_KINDS.filter(k=>!["gategrub","shorthorn","bowwatch","splitblade","huntermarshal","gateballista","chimeshard","forklancer","pipereader","resonancebearer","broadcantor","needleconductor","shackleshard","fettersprinter","trailhound","turnwarden","trailmarshal","reversejailer"].includes(k)))
      for (const exposed of [false, true])
        for (const fracture of [0, 2]) {
          const w = new SurvivalWorld(19, "ranger", stage);
          w.enemies = [];
          w.player = { x: 0, y: 0 };
          const e = w.addEnemy(kind, 3, 0);
          if (!e) continue;
          e.hp = e.maxHp = 1e7;
          e.state = exposed ? "recover" : "seek";
          e.fracture = fracture;
          e.fractureUntil = 10;
          for (const field of [
            "sand",
            "thunder",
            "moon",
            "bell",
            "tide",
            "prism",
            "root",
            "wind",
            "library",
            "loom",
            "kiln",
            "edge",
            "eclipse",
            "lead",
            "grave",
          ])
            e[field] = { ...e[field], vulnerable: exposed };
          w.hit(e, 100, "blade");
          result.combat.push([stage, kind, exposed, fracture, 1e7 - e.hp]);
        }
  for (let stage = 1; stage <= 16; stage++)
    for (const state of ["none", "seek", "recover", "windup"]) {
      const w = new SurvivalWorld(19, "ranger", stage);
      w.player = { x: 0, y: 0 };
      w.enemies = [];
      w.time = state === "none" ? 10 : 360;
      if (state !== "none") {
        const e = w.addEnemy("boss", 3, 0);
        e.state = state;
        for (const phase of [1, 2, 3]) {
          e.bossPhase = phase;
          result.hud.push([stage, state, phase, battleHud(w, false, [], 400)]);
        }
      } else result.hud.push([stage, state, battleHud(w, false, [], 400)]);
    }
  for (let stage = 1; stage <= 16; stage++)
    for (const outcome of ["lost", "won"]) {
      const m = new Map(),
        p = new ProgressStore({
          getItem: (k) => m.get(k) ?? null,
          setItem: (k, v) => m.set(k, v),
        }),
        w = new SurvivalWorld(19, "ranger", stage);
      w.runId = `parity-${stage}-${outcome}`;
      w.time = 420;
      w.state = outcome;
      w.startingWeapon = "blade";
      w.skills.blade = 8;
      w.mods.blade = ["hunt", "return"];
      for (const key of [
        "bossSealPhases",
        "loomPhases",
        "kilnPhases",
        "edgePhases",
        "eclipsePhases",
        "leadPhases",
      ])
        w.challenge[key] = new Set([1, 2, 3]);
      w.challenge.graveGroups = new Set(["1A", "1B", "2B"]);
      w.challenge.devices = new Set([1, 2, 3, 4]);
      p.observe(w);
      p.observe(w);
      result.progress.push([
        stage,
        outcome,
        p.data,
        new ProgressStore({
          getItem: (k) => m.get(k) ?? null,
          setItem: (k, v) => m.set(k, v),
        }).data,
      ]);
    }
  return result;
}

export function captureActiveHud(hud = battleHud) {
  const rows = [];
  const fields = {
    10: "library",
    11: "loom",
    12: "kiln",
    13: "edge",
    14: "eclipse",
    15: "lead",
    16: "grave",
  };
  for (const [stage, key] of Object.entries(fields))
    for (const phase of stage === "16" ? [1, 2] : [1, 2, 3])
      for (const action of ["A", "B", "C"]) {
        const w = new SurvivalWorld(19, "ranger", Number(stage));
        w.enemies = [];
        w.time = 360;
        w.player = { x: 0, y: 0 };
        w.camera = { x: 0, y: 0 };
        const e = w.addEnemy("boss", -3, 0);
        e.state = "windup";
        e.bossPhase = phase;
        const s = w[key].state(e);
        s.action = action;
        if (key === "grave") {
          s.life = phase;
          s.scar = {
            x: -3,
            y: 2,
            angle: 0,
            radius: 4.2,
            half: Math.PI / 4,
            due: 0,
            end: 0,
            old: false,
            hit: false,
          };
          s.scarUntil = 400;
        }
        w.hazards = w[key].plan(e);
        for (const offset of [0, 2.5, 4]) {
          w.time = 360 + offset;
          rows.push([stage, phase, action, offset, hud(w, false, [], 400)]);
        }
      }
  const w = new SurvivalWorld(19, "ranger", 16);
  w.enemies = [];
  w.time = 360;
  const e = w.addEnemy("boss", -3, 0);
  e.state = "seek";
  w.hit(e, 1e9, "blade");
  rows.push(["revival", hud(w, false, [], 400)]);
  return rows;
}
