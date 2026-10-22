import type { Skill } from "../battle/SurvivalConfig";
import type { WeaponGrade } from "../battle/WeaponGrade";
/** Stable persisted account schema; optional progress fields retain their existing names. */
export interface StageBest {
  form?: number;
  livesRemaining?: number;
  time: number;
  phase: number;
  bossRemaining: number | null;
  won: boolean;
}
export interface ProgressData {
  grades?: Partial<Record<Skill, WeaponGrade>>;
  openerWins?: { skill: Skill; stage: number }[];
  modWins?: Partial<Record<Skill, Record<string, number[]>>>;
  sealOpeners?: Skill[];
  loomQualifiedOpeners?: Skill[];
  graveQualifiedVersion?: 1;
  graveQualified?: Partial<Record<Skill, string[]>>;
  leadQualified?: Partial<Record<Skill, string[]>>;
  eclipseQualified?: Partial<Record<Skill, string[]>>;
  edgeQualified?: Partial<Record<Skill, string[]>>;
  kilnQualified?: Partial<Record<Skill, string[]>>;
  coins?: number;
  purchasedWeapons?: string[];
  achievements?: string[];
  settledRuns?: string[];
  version: 1;
  rules: "armory-v1";
  revision: number;
  stages: number[];
  stageBest: Record<string, StageBest>;
  best: { kills: number; time: number; weapons: number };
}
