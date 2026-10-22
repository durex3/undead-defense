import { windMove } from "./WindGeometry";
import type { Kind } from "./SurvivalConfig";
import {
  siegeCombat,
  legacyCombat,
  armoredCombat,
  StageCombat,
} from "./StageCombat";
import { graveMap } from "./EchoGraveMap";
import { graveEnemy } from "./EchoGraveSystem";
import { leadMap } from "./LeadFoundryMap";
import { leadEnemy } from "./LeadFoundrySystem";
import { eclipseMap } from "./EclipseMap";
import { eclipseEnemy } from "./EclipseSystem";
import { edgeMap } from "./EdgeCourtMap";
import { edgeEnemy } from "./EdgeCourtSystem";
import { kilnMap } from "./KilnMap";
import { kilnEnemy } from "./KilnSystem";
import { loomMap } from "./LoomMap";
import { loomEnemy } from "./LoomSystem";
import { libraryMap } from "./LibraryMap";
import { libraryEnemy } from "./LibrarySystem";
import { windMap } from "./WindMap";
import { windEnemy } from "./WindSystem";
import { rootMap } from "./RootMap";
import { rootEnemy } from "./RootSystem";
import { prismMap } from "./PrismMap";
import { prismEnemy, prismDevice } from "./PrismSystem";
import { TideSystem, tideEnemy } from "./TideSystem";
import { tideMap } from "./TideMap";
import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Hazard, Point } from "./SurvivalTypes";
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
  readonly adaptiveBossPositioning?: boolean;
  bossPosition?(e:Enemy):Point|undefined;
  movePlayer?(dt: number): void;
  readonly combat: StageCombat;
  targetPriority?(e: Enemy): number;
  /** false delegates the shared legacy 1/2 wave scheduler. */
  director(dt: number): boolean;
  stepEnemy(enemy: Enemy, dt: number): boolean;
  stepBoss(enemy: Enemy, dt: number): void;
  clean(): void;
  lifecycle?: {
    initialize?(e: Enemy): void;
    tick(): void;
    keep(e: Enemy): boolean;
    onHit(e: Enemy, source: string, dealt: number): void;
    supplies(e: Enemy): void;
  };
  onDeath(enemy: Enemy): boolean;
  stepHazard(hazard: Hazard): boolean;
}
interface ManagedStageSystem {
  bossPosition?(e:Enemy):Point|undefined;
  director(dt: number): void;
  stepEnemy(e: Enemy, dt: number): void;
  clean(): void;
  onDeath(e: Enemy): boolean | void;
  stepHazard(h: Hazard): void;
}
type HazardKey =
  | "bell"
  | "tide"
  | "prism"
  | "root"
  | "wind"
  | "library"
  | "loom"
  | "kiln"
  | "edge"
  | "eclipse"
  | "lead"
  | "grave";
/** Common adapter owns plumbing only; each system retains its encounter rules. */
function managedStage(
  map: StageStrategy["map"],
  system: ManagedStageSystem,
  isEnemy: (kind: Kind) => boolean,
  hazard: HazardKey,
  combat: StageCombat,
  extra: Partial<
    Pick<StageStrategy, "movePlayer" | "lifecycle" | "targetPriority">
  > = {},
): StageStrategy {
  return {
    map,
    combat,
    resolveCrowd: true,
    adaptiveBossPositioning:true,
    bossPosition:system.bossPosition?.bind(system),
    ...extra,
    director: (dt) => {
      system.director(dt);
      return true;
    },
    stepEnemy: (e, dt) => {
      if (!isEnemy(e.kind)) return false;
      system.stepEnemy(e, dt);
      return true;
    },
    stepBoss: (e, dt) => system.stepEnemy(e, dt),
    clean: () => system.clean(),
    onDeath: (e) => system.onDeath(e) === true,
    stepHazard: (h) => {
      if (!h[hazard]) return false;
      system.stepHazard(h);
      return true;
    },
  };
}
/** Stage registration is the sole dispatch point, built once per world. Systems retain their own state. */
export function createStageStrategy(w: SurvivalWorld): StageStrategy {
  const noop = () => {};
  const entries: Record<StageId, () => StageStrategy> = {
    1: () => ({
      map: siegeMap,
      combat: siegeCombat(w),
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
      adaptiveBossPositioning: true,
      map: sandMap,
      combat: legacyCombat(w, (e) => !!e.sand?.vulnerable),
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
      combat: legacyCombat(w, (e) => !!e.thunder?.vulnerable, true),
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
      adaptiveBossPositioning: true,
      map: moonMap,
      combat: legacyCombat(w, (e) => !!e.moon?.vulnerable, true),
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
    5: () =>
      managedStage(
        bellMap,
        w.bell,
        bellEnemy,
        "bell",
        armoredCombat(w, bellEnemy, (e) => !!e.bell?.vulnerable),
      ),
    6: () =>
      managedStage(
        tideMap,
        w.tide,
        tideEnemy,
        "tide",
        armoredCombat(w, tideEnemy, (e) => !!e.tide?.vulnerable),
      ),
    7: () =>
      managedStage(
        prismMap,
        w.prism,
        prismEnemy,
        "prism",
        armoredCombat(
          w,
          (k) => prismEnemy(k) && !prismDevice(k),
          (e) => !!e.prism?.vulnerable,
        ),
      ),
    8: () =>
      managedStage(
        rootMap,
        w.root,
        rootEnemy,
        "root",
        armoredCombat(w, rootEnemy, (e) => !!e.root?.vulnerable),
      ),
    9: () =>
      managedStage(
        windMap,
        w.wind,
        windEnemy,
        "wind",
        armoredCombat(w, windEnemy, (e) => !!e.wind?.vulnerable),
        {
          movePlayer: (dt) => {
            w.wind.clean();
            windMove(
              w.player,
              { x: w.move.x * w.speed, y: w.move.y * w.speed },
              dt,
              0.3,
              w.hazards,
              w.time,
            );
          },
        },
      ),
    10: () =>
      managedStage(
        libraryMap,
        w.library,
        libraryEnemy,
        "library",
        armoredCombat(w, libraryEnemy, (e) => !!e.library?.vulnerable),
        { movePlayer: (dt) => w.library.movePlayer(dt) },
      ),
    11: () =>
      managedStage(
        loomMap,
        w.loom,
        loomEnemy,
        "loom",
        armoredCombat(w, loomEnemy, (e) => !!e.loom?.vulnerable),
        { movePlayer: (dt) => w.loom.movePlayer(dt) },
      ),
    12: () =>
      managedStage(
        kilnMap,
        w.kiln,
        kilnEnemy,
        "kiln",
        armoredCombat(
          w,
          (k) => kilnEnemy(k) && k !== "kilnvalve",
          (e) => !!e.kiln?.vulnerable,
        ),
        {
          movePlayer: (dt) => w.kiln.movePlayer(dt),
          targetPriority: (e) =>
            e.kind === "kilnvalve" &&
            e.hp > 0 &&
            Math.hypot(e.x - w.player.x, e.y - w.player.y) <= 4.5
              ? 1
              : 0,
        },
      ),
    13: () =>
      managedStage(
        edgeMap,
        w.edge,
        edgeEnemy,
        "edge",
        armoredCombat(
          w,
          edgeEnemy,
          (e) => !!e.edge?.vulnerable,
          (e, source, dealt) => w.edge.onHit(e, source, dealt),
        ),
        { movePlayer: (dt) => w.edge.movePlayer(dt) },
      ),
    14: () =>
      managedStage(
        eclipseMap,
        w.eclipse,
        eclipseEnemy,
        "eclipse",
        armoredCombat(w, eclipseEnemy, (e) => !!e.eclipse?.vulnerable),
        { movePlayer: (dt) => w.eclipse.movePlayer(dt) },
      ),
    15: () =>
      managedStage(
        leadMap,
        w.lead,
        leadEnemy,
        "lead",
        armoredCombat(w, leadEnemy, (e) => !!e.lead?.vulnerable),
        { movePlayer: (dt) => w.lead.movePlayer(dt) },
      ),
    16: () =>
      managedStage(
        graveMap,
        w.grave,
        graveEnemy,
        "grave",
        armoredCombat(w, graveEnemy, (e) => !!e.grave?.vulnerable),
        { movePlayer: (dt) => w.grave.movePlayer(dt), lifecycle: w.grave },
      ),
  };
  return entries[w.stageId]();
}
