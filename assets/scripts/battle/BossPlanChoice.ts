import type { Enemy, Hazard } from "./SurvivalTypes";
export type BossAction = "A" | "B" | "C";
export interface BossProposal {
  action: BossAction;
  items: Hazard[];
  threatens: boolean;
}
/** Pre-publication selection only. Every plan still passes the stage's real escape test. */
export class BossPlanChoice {
  private memory = new WeakMap<
    Enemy,
    { phase: number; used: number; last?: BossAction }
  >();
  readonly stats = { choices: 0, alternatives: 0 };
  choose(
    e: Enemy,
    preferred: BossAction,
    plan: (action: BossAction, turn: number) => Hazard[],
    legal: (items: Hazard[]) => boolean,
    threatens: (items: Hazard[]) => boolean,
  ): BossProposal | undefined {
    const state = this.memory.get(e),
      used = state?.phase === e.bossPhase ? state.used : 0;
    const proposals: BossProposal[] = [];
    for (const action of [
      preferred,
      ...(["A", "B", "C"] as BossAction[]).filter((a) => a !== preferred),
    ]) {
      let fallback: BossProposal | undefined;
      for (const turn of [
        0,
        Math.PI / 6,
        -Math.PI / 6,
        Math.PI / 3,
        -Math.PI / 3,
        Math.PI / 2,
        -Math.PI / 2,
        Math.PI,
      ]) {
        const items = plan(action, turn);
        if (!items.length || items.length > 2 || !legal(items)) continue;
        const p = { action, items, threatens: threatens(items) };
        fallback ??= p;
        if (p.threatens) {
          fallback = p;
          break;
        }
      }
      if (fallback) proposals.push(fallback);
    }
    const unused = proposals.filter(
      (p) => !(used & (1 << "ABC".indexOf(p.action))),
    );
    const choices = unused.length ? unused : proposals;
    choices.sort(
      (a, b) =>
        Number(b.threatens) - Number(a.threatens) ||
        Number(a.action === state?.last) - Number(b.action === state?.last) ||
        Number(b.action === preferred) - Number(a.action === preferred),
    );
    const result = choices[0];
    if (result) {
      this.stats.choices++;
      if (result.action !== preferred) this.stats.alternatives++;
    }
    return result;
  }
  commit(e: Enemy, action: BossAction) {
    const old = this.memory.get(e),
      used = old?.phase === e.bossPhase && old.used !== 7 ? old.used : 0;
    this.memory.set(e, {
      phase: e.bossPhase,
      used: used | (1 << "ABC".indexOf(action)),
      last: action,
    });
  }
}
