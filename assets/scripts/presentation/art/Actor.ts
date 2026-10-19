import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { Enemy } from "../../battle/SurvivalTypes";

export interface MotionSpec {
  scale: number;
  motionSpeed: number;
  strideAmp: number;
  bobAmp: number;
}

/**
 * A reusable draw-time pose. One instance is mutated per actor and never
 * retained by the painters, so a 100-enemy frame allocates no poses.
 */
export interface Pose extends MotionSpec {
  x: number;
  y: number;
  face: 1 | -1;
  /** Extra visual height in local pixels (jumping, floating). */
  lift: number;
  alpha: number;
  detail: boolean;
  frozen: boolean;
  slowed: boolean;
  burning: boolean;
  moving: boolean;
  windup: number;
  recover: number;
  crouch: number;
  lean: number;
  stride: number;
  bob: number;
  time: number;
  id: number;
  /** 0 = normal, 1 = bright hit flash. */
  flash: number;
}

export const torsoOffset = (pose: Pose) => -pose.crouch * .75 + pose.lean * .65 + pose.bob * .55;

export function createPose(): Pose {
  return {
    x: 0,
    y: 0,
    scale: 1,
    face: 1,
    lift: 0,
    alpha: 255,
    detail: true,
    frozen: false,
    slowed: false,
    burning: false,
    moving: false,
    windup: 0,
    recover: 0,
    crouch: 0,
    lean: 0,
    stride: 0,
    bob: 0,
    time: 0,
    id: 0,
    flash: 0,
    motionSpeed: 10,
    strideAmp: 3,
    bobAmp: 1.5,
  };
}

export function updatePose(
  pose: Pose,
  world: SurvivalWorld,
  enemy: Enemy,
  spec: MotionSpec,
  reduced: boolean,
  flashUntil = 0,
) {
  const moving = enemy.state === "seek" || enemy.state === "charge";
  const phase = world.time * spec.motionSpeed + enemy.id * 1.7;
  pose.x = enemy.x * 48;
  pose.y = enemy.y * 48;
  pose.scale = spec.scale;
  pose.motionSpeed = spec.motionSpeed;
  pose.strideAmp = spec.strideAmp;
  pose.bobAmp = spec.bobAmp;
  pose.face = Math.cos(enemy.facing) < 0 ? -1 : 1;
  pose.lift = 0;
  const moon = enemy.moon;
  if (moon?.jumpAt !== undefined && moon.jumpDue !== undefined && world.time >= moon.jumpAt && world.time < moon.jumpDue) {
    // The old MoonPainter lifted the body by up to 50 world pixels. Convert
    // that to local units so scaled bosses keep the same visible arc.
    pose.lift = (Math.sin(((world.time - moon.jumpAt) / 0.45) * Math.PI) * 50) / spec.scale;
  }
  pose.alpha = enemy.state === "arriving" ? 150 : 255;
  pose.detail = !reduced;
  pose.frozen = enemy.freezeUntil > world.time;
  pose.slowed = !pose.frozen && enemy.slowUntil > world.time;
  pose.burning = enemy.burnUntil > world.time;
  pose.moving = moving;
  // The simulation owns timing. Only the visible pose eases toward release.
  const releasing = enemy.state === "windup" && world.hazards.some(h =>
    h.source === enemy.id && world.time >= h.due && world.time < h.until);
  const ready = 1 - Math.max(0, Math.min(1, enemy.timer / .45));
  pose.windup = enemy.state === "windup" && !releasing ? .65 + .35 * ready * ready : 0;
  const settle = Math.max(0, Math.min(1, enemy.timer / .35));
  pose.recover = enemy.state === "recover" ? settle * settle : 0;
  pose.crouch = pose.windup * 7 + pose.recover * 4;
  pose.lean = enemy.state === "charge" ? 8 : releasing ? 6 : -pose.windup * 5 - pose.recover * 3;
  pose.stride = pose.frozen ? 0 : moving ? Math.sin(phase) * spec.strideAmp : Math.sin(world.time * 2 + enemy.id) * 0.25;
  pose.bob = pose.frozen ? 0 : moving
    ? Math.abs(Math.cos(phase)) * spec.bobAmp
    : Math.sin(world.time * 2 + enemy.id) * 0.45;
  pose.time = world.time;
  pose.id = enemy.id;
  pose.flash = flashUntil > world.time ? 1 : 0;
}
