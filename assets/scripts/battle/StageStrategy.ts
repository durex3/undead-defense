import {kilnMap} from "./KilnMap";
import {kilnEnemy} from "./KilnSystem";
import {loomMap} from "./LoomMap";
import {loomEnemy} from "./LoomSystem";
import {libraryMap} from "./LibraryMap";
import {libraryEnemy} from "./LibrarySystem";
import {windMap} from "./WindMap";
import {windEnemy} from "./WindSystem";
import {rootMap} from "./RootMap";
import {rootEnemy} from "./RootSystem";
import {prismMap} from "./PrismMap";
import {prismEnemy} from "./PrismSystem";
import { TideSystem, tideEnemy } from "./TideSystem";
import { tideMap } from "./TideMap";
import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Hazard } from "./SurvivalTypes";
import type { StageId } from "./ProgressionConfig";
import { siegeMap } from "./SiegeMap";
import { sandMap } from "./SandMap";
import { thunderMap } from "./ThunderMap";
import { moonMap } from "./MoonMap";
import { bellMap } from "./BellMap";
import { siegeEnemy } from "./SiegeSystem";
import { sandEnemy } from "./SandSystem";
import { thunderEnemy, thunderDevice } from "./ThunderSystem";
import { moonEnemy } from "./MoonSystem";
import { bellEnemy } from "./BellSystem";
export interface StageStrategy {
  readonly map: typeof siegeMap;
  readonly resolveCrowd?: boolean;
  movePlayer?(dt:number):void;
  vulnerable?(e: Enemy): boolean;
  /** false delegates the shared legacy 1/2 wave scheduler. */
  director(dt: number): boolean;
  stepEnemy(enemy: Enemy, dt: number): boolean;
  stepBoss(enemy: Enemy, dt: number): void;
  clean(): void;
  onDeath(enemy: Enemy): boolean;
  stepHazard(hazard: Hazard): boolean;
}
/** Stage registration is the sole dispatch point, built once per world. Systems retain their own state. */
export function createStageStrategy(w: SurvivalWorld): StageStrategy {
  const noop = () => {};
  const entries: Record<StageId, () => StageStrategy> = {
    1: () => ({
      map: siegeMap,
      director: () => false,
      stepEnemy: (e, dt) => {
        if (!siegeEnemy(e.kind)) return false;
        w.siege.stepEnemy(e, dt);
        return true;
      },
      stepBoss: (e, dt) => w.siege.stepBoss(e, dt),
      clean: noop,
      onDeath: () => false,
      stepHazard: () => false,
    }),
    2: () => ({
      map: sandMap,
      director: () => false,
      stepEnemy: (e, dt) => {
        if (!sandEnemy(e.kind)) return false;
        w.sand.stepEnemy(e, dt);
        return true;
      },
      stepBoss: (e, dt) => w.sand.stepEnemy(e, dt),
      clean: () => w.sand.clean(),
      onDeath: (e) => {
        w.sand.onDeath(e);
        return false;
      },
      stepHazard: () => false,
    }),
    3: () => ({
      map: thunderMap,
      director: (dt) => {
        w.thunder.director(dt);
        return true;
      },
      stepEnemy: (e, dt) => {
        if (!thunderEnemy(e.kind)) return false;
        w.thunder.stepEnemy(e, dt);
        return true;
      },
      stepBoss: (e, dt) => w.thunder.stepEnemy(e, dt),
      clean: () => w.thunder.clean(),
      onDeath: (e) => {
        w.thunder.onDeath(e);
        return thunderDevice(e.kind);
      },
      stepHazard: (h) => {
        if (!h.thunder) return false;
        w.thunder.stepHazard(h);
        return true;
      },
    }),
    4: () => ({
      map: moonMap,
      director: (dt) => {
        w.moon.director(dt);
        return true;
      },
      stepEnemy: (e, dt) => {
        if (!moonEnemy(e.kind)) return false;
        w.moon.stepEnemy(e, dt);
        return true;
      },
      stepBoss: (e, dt) => w.moon.stepEnemy(e, dt),
      clean: () => w.moon.clean(),
      onDeath: (e) => {
        w.moon.onDeath(e);
        return false;
      },
      stepHazard: (h) => {
        if (!h.moon) return false;
        w.moon.stepHazard(h);
        return true;
      },
    }),
    12:()=>({map:kilnMap,resolveCrowd:true,movePlayer:dt=>w.kiln.movePlayer(dt),vulnerable:e=>!!e.kiln?.vulnerable&&e.state==='recover',director:dt=>{w.kiln.director(dt);return true;},stepEnemy:(e,dt)=>{if(!kilnEnemy(e.kind))return false;w.kiln.stepEnemy(e,dt);return true;},stepBoss:(e,dt)=>w.kiln.stepEnemy(e,dt),clean:()=>w.kiln.clean(),onDeath:e=>w.kiln.onDeath(e),stepHazard:h=>{if(!h.kiln)return false;w.kiln.stepHazard(h);return true;}}),
    11:()=>({map:loomMap,resolveCrowd:true,movePlayer:dt=>w.loom.movePlayer(dt),vulnerable:e=>!!e.loom?.vulnerable&&e.state==='recover',director:dt=>{w.loom.director(dt);return true;},stepEnemy:(e,dt)=>{if(!loomEnemy(e.kind))return false;w.loom.stepEnemy(e,dt);return true;},stepBoss:(e,dt)=>w.loom.stepEnemy(e,dt),clean:()=>w.loom.clean(),onDeath:e=>w.loom.onDeath(e),stepHazard:h=>{if(!h.loom)return false;w.loom.stepHazard(h);return true;}}),
    10:()=>({map:libraryMap,resolveCrowd:true,movePlayer:dt=>w.library.movePlayer(dt),vulnerable:e=>!!e.library?.vulnerable&&e.state==='recover',
      director:dt=>{w.library.director(dt);return true;},stepEnemy:(e,dt)=>{if(!libraryEnemy(e.kind))return false;w.library.stepEnemy(e,dt);return true;},
      stepBoss:(e,dt)=>w.library.stepEnemy(e,dt),clean:()=>w.library.clean(),onDeath:e=>w.library.onDeath(e),stepHazard:h=>{if(!h.library)return false;w.library.stepHazard(h);return true;}}),
    9:()=>({map:windMap,resolveCrowd:true,vulnerable:e=>!!e.wind?.vulnerable&&e.state==='recover',
      director:dt=>{w.wind.director(dt);return true;},stepEnemy:(e,dt)=>{if(!windEnemy(e.kind))return false;w.wind.stepEnemy(e,dt);return true;},
      stepBoss:(e,dt)=>w.wind.stepEnemy(e,dt),clean:()=>w.wind.clean(),onDeath:e=>w.wind.onDeath(e),stepHazard:h=>{if(!h.wind)return false;w.wind.stepHazard(h);return true;}}),
    8:()=>({map:rootMap,resolveCrowd:true,vulnerable:e=>!!e.root?.vulnerable&&e.state==='recover',
      director:dt=>{w.root.director(dt);return true;},stepEnemy:(e,dt)=>{if(!rootEnemy(e.kind))return false;w.root.stepEnemy(e,dt);return true;},
      stepBoss:(e,dt)=>w.root.stepEnemy(e,dt),clean:()=>w.root.clean(),onDeath:e=>w.root.onDeath(e),stepHazard:h=>{if(!h.root)return false;w.root.stepHazard(h);return true;}}),
    7:()=>({map:prismMap,resolveCrowd:true,vulnerable:e=>!!e.prism?.vulnerable&&e.state==='recover',
      director:dt=>{w.prism.director(dt);return true;},stepEnemy:(e,dt)=>{if(!prismEnemy(e.kind))return false;w.prism.stepEnemy(e,dt);return true;},
      stepBoss:(e,dt)=>w.prism.stepEnemy(e,dt),clean:()=>w.prism.clean(),onDeath:e=>w.prism.onDeath(e),stepHazard:h=>{if(!h.prism)return false;w.prism.stepHazard(h);return true;}}),
    6: () => ({
      map: tideMap,
      resolveCrowd: true,
      vulnerable: (e) => !!e.tide?.vulnerable && e.state === "recover",
      director: (dt) => {
        w.tide.director(dt);
        return true;
      },
      stepEnemy: (e, dt) => {
        if (!tideEnemy(e.kind)) return false;
        w.tide.stepEnemy(e, dt);
        return true;
      },
      stepBoss: (e, dt) => w.tide.stepEnemy(e, dt),
      clean: () => w.tide.clean(),
      onDeath: (e) => {
        w.tide.onDeath(e);
        return false;
      },
      stepHazard: (h) => {
        if (!h.tide) return false;
        w.tide.stepHazard(h);
        return true;
      },
    }),
    5: () => ({
      map: bellMap,
      resolveCrowd: true,
      director: (dt) => {
        w.bell.director(dt);
        return true;
      },
      stepEnemy: (e, dt) => {
        if (!bellEnemy(e.kind)) return false;
        w.bell.stepEnemy(e, dt);
        return true;
      },
      stepBoss: (e, dt) => w.bell.stepEnemy(e, dt),
      clean: () => w.bell.clean(),
      onDeath: (e) => {
        w.bell.onDeath(e);
        return false;
      },
      stepHazard: (h) => {
        if (!h.bell) return false;
        w.bell.stepHazard(h);
        return true;
      },
    }),
  };
  return entries[w.stageId]();
}
