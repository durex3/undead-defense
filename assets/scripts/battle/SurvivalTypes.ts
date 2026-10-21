import type { MoonMotion } from "./MoonGeometry";
import { Kind, Skill } from "./SurvivalConfig";
export interface Point {
  x: number;
  y: number;
}
export interface ThunderState {
 action: 'anchor'|'arc'|'saw'|'grid'|'reap'|'beats'|'walls'|'court'|'transition';
 step:number; next:number; points:Point[]; devices:number[]; angle:number;
 launched?:boolean; vulnerable?:boolean; flankUntil?:number; expires?:number;
}
export interface MoonState { direction?:number; action:"blades"|"leaps"|"sweeps"|"transition"; step:number; next:number; recovery:number; cooldown:number; flank?:Point; flankUntil?:number; jumpStart?:Point; jumpEnd?:Point; jumpAt?:number; jumpDue?:number; vulnerable?:boolean; }
export interface Enemy extends Point {
 edge?:import("./EdgeCourtSystem").EdgeState;
 kiln?:import("./KilnSystem").KilnState;
 loom?:import("./LoomSystem").LoomState;
 library?:import("./LibrarySystem").LibraryState;
 wind?:import("./WindSystem").WindState;
 root?:import("./RootSystem").RootState;
 prism?:import("./PrismSystem").PrismState;
 immovable?:boolean;
 tide?:import("./TideSystem").TideState;
 bell?:import("./BellSystem").BellState;
 fracture?:number;fractureUntil?:number;
 moon?:MoonState;
 thunder?: ThunderState;
  sand?: { action: 'roll'|'spit'|'burrow'|'brood'|'break'|'cross'|'scatter'|'transition'; step:number; angle:number; target?:Point; end?:Point; buried?:boolean; hit?:boolean; next?:number; hatch?:number; vulnerable?:boolean; pendingPhase?:boolean; cooldown?:number; transition?:boolean };
  sandXp?: number;

  siegeStep?: number;
  siegeNext?: number;
  siegeWall?: boolean;
  siegeShield?: number;
  siegeShieldUntil?: number;
  siegeShieldReady?: number;
  siegeShieldOwner?: number;
  siegeDodgeReady?: number;
  siegeGroundTime?: number;
  siegeFreezeResist?: number;
  siegeRetry?: number;
  siegeTarget?: Point;
  siegeRouteTime?: number;
  shieldClock?: number;
  shieldPartner?: number;
  bossReinforcement?: boolean;
  frontierTarget?: Point;
  frontierUntil?: number;
  frontierRecovery?: number;
  frontierRetry?: number;
  starTarget?: Point;
  starUntil?: number;
  leapStart?: Point;
  leapEnd?: Point;
  leapDuration?: number;
  starRetry?: number;
  navWaypoint?: Point;
  arsenalTarget?: Point;
  arsenalUntil?: number;
  expires?: number;
  harborWaypoint?: Point;
  harborTarget?: Point;
  harborUntil?: number;
  id: number;
  kind: Kind;
  hp: number;
  maxHp: number;
  attack: number;
  slow: number;
  slowUntil: number;
  freezeUntil: number;
  freezeReady: number;
  burn: number;
  burnUntil: number;
  burnNext: number;
  state: "seek" | "windup" | "charge" | "recover" | "arriving";
  timer: number;
  facing: number;
  lockedAngle: number;
  combo: number;
  pattern: number;
  born: number;
  visibleSince: number;
  hazardId: number;
  summoned: boolean;
  owner: number;
  bossPhase: 1 | 2 | 3;
  bossAction:
    "siegeCharge" | "siegePincer" | "siegeSweep" | "siegeShot" | "frontier" | "none" | "sweep" | "burst" | "summon" | "tombstone" | "transition" | "lance" | "altar" | "bellRing" | "bellPulse" | "anchor" | "harborCharge" | "harborSummon" | "arsenalSweep" | "arsenalBolt" | "arsenalFlag" | "starTrace" | "starBlade" | "starLeap";
}
export interface Effect extends Point {
  form?: string;
  grade?:number;
  final?: boolean;
  id?: number;
  type: "sealBreak" | "boss" | "elite" | "bossPhase" | "summon" | "block" | "cast"

    | "death" | "eliteDown" | "modify" | "explosion" | "heal" | "hit"
    | "poison" | "hazard" | "learn" | "lightning" | "pickup" | "playerHit" | "ultimate" | "supply";
  endX?: number;
  endY?: number;
  value?: number;
  skill?: string;
  radius?: number;
  angle?: number;
}
export interface Hazard extends Point {
 edge?:import("./EdgeCourtGeometry").EdgeHazard;
 kiln?:import("./KilnGeometry").KilnHazard;
 loom?:import("./LoomGeometry").LoomHazard;
 library?:import("./LibraryGeometry").LibraryHazard;
 wind?:import("./WindGeometry").WindHazard;
 root?:import("./RootGeometry").RootHazard;
 prism?:import("./PrismGeometry").PrismHazard;
 tide?:import("./TideGeometry").TideHazard;
 bell?:import("./BellGeometry").BellHazard;
 widthAngle?:number;
 moon?:{motion:MoonMotion; launched:boolean; hits:number; last:number; player:Point; order:number};
 thunder?: {shape:'zone'|'line'|'wall'|'sector'; devices:number[]; speed?:number; travel?:number; gap?:number; tick?:number; residue?:number; launch?:number; hit?:boolean; order?:number; preview?:boolean};
  sandRift?: boolean;
  sandLaunchDelay?: number;
  siegeLaunched?: boolean;
  siegeBallistic?: boolean;
  siegeGround?: boolean;
  siegeRing?: boolean;
  siegeTick?: number;
  siegeCharge?: boolean;
  projectileSpeed?: number;
  sequence?: number;
  endX?: number;
  endY?: number;
  group?: number;
  groupHit?: boolean;
  fixedDamage?: boolean;
  damageLabel?: string;
  id: number;
  source: number;
  kind: "frontierLane" | "frontierImpact" | "circle" | "line" | "sector" | "pool" | "burst" | "arrow" | "flame" | "flameLine" | "bellRing" | "bellPulse" | "starTrace" | "starLeap";
  angle: number;
  radius: number;
  width: number;
  due: number;
  created: number;
  until: number;
  damage: number;
  fired: boolean;
  next: number;
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
export function angleDelta(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
