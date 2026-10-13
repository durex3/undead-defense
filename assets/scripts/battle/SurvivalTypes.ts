import { Kind, Skill } from "./SurvivalConfig";
export interface Point {
  x: number;
  y: number;
}
export interface Enemy extends Point {
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
    "none" | "sweep" | "burst" | "summon" | "tombstone" | "transition" | "lance" | "altar" | "bellRing" | "bellPulse" | "anchor" | "harborCharge" | "harborSummon" | "arsenalSweep" | "arsenalBolt" | "arsenalFlag" | "starTrace" | "starBlade" | "starLeap";
}
export interface Shot extends Point {
  form?: string;
  id: number;
  skill: Skill;
  vx: number;
  vy: number;
  damage: number;
  left: number;
  hit: number[];
  target: number;
  ttl: number;
  age: number;
  range: number;
  returning: boolean;
  width: number;
  extra: number;
  excursion: number;
}
export interface Effect extends Point {
  form?: string;
  final?: boolean;
  id?: number;
  type: "boss" | "elite" | "bossPhase" | "summon" | "block" | "cast"
    | "comboGhost" | "comboReap" | "comboCollapse" | "comboBone" | "comboJudgment" | "comboSoul" | "comboPurify" | "comboFire" | "comboIce" | "fireImpact"
    | "death" | "eliteDown" | "evolve" | "explosion" | "heal" | "hit"
    | "poison" | "hazard" | "learn" | "lightning" | "pickup" | "playerHit" | "ultimate" | "supply" | "comboReady";
  endX?: number;
  endY?: number;
  value?: number;
  skill?: string;
  radius?: number;
  angle?: number;
}
export interface Zone extends Point {
  form?: string;
  until: number;
  next: number;
  damage: number;
  radius: number;
}
export interface Ring extends Point {
  id: number;
  age: number;
  radius: number;
  maxRadius: number;
  hit: number[];
  freeze: boolean;
}
export interface Hazard extends Point {
  endX?: number;
  endY?: number;
  group?: number;
  groupHit?: boolean;
  fixedDamage?: boolean;
  damageLabel?: string;
  id: number;
  source: number;
  kind: "circle" | "line" | "sector" | "pool" | "burst" | "arrow" | "flame" | "flameLine" | "bellRing" | "bellPulse" | "starTrace" | "starLeap";
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
export interface Blade extends Point {
  angle: number;
  index: number;
  phase: number;
}
export interface ScheduledCast {
  skill: Skill;
  due: number;
  index: number;
  targets: number[];
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
