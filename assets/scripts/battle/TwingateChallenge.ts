import type { Skill } from "./SurvivalConfig";
export type GateRole = "hunter" | "warden";
export type GateOrder = "hunter_first" | "warden_first";
export const GATE_OPENERS: readonly Skill[] = [
  "blade",
  "fire",
  "water",
  "frost",
  "lightning",
  "ghost",
  "bone",
  "mine",
  "void",
  "holy",
  "hammer",
  "wheel",
  "lamp",
  "needle",
];
export const GATE_ORDERS: readonly GateOrder[] = [
  "hunter_first",
  "warden_first",
];
export const validGateOrder = (v: unknown): v is GateOrder =>
  GATE_ORDERS.includes(v as GateOrder);
