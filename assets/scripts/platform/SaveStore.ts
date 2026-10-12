export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface SaveData {
  version: 1;
  coins: number;
  weapon: number;
  wall: number;
  unlocked: number;
  first: number[];
  settled: string[];
  muted: boolean;
  low: boolean;
}
export const fresh = (): SaveData => ({
  version: 1,
  coins: 0,
  weapon: 0,
  wall: 0,
  unlocked: 1,
  first: [],
  settled: [],
  muted: false,
  low: false,
});
export class SaveStore {
  data: SaveData;
  private key = "undead-defense-v1";
  constructor(private storage: StoragePort) {
    this.data = this.read();
  }
  private valid(x: any): x is SaveData {
    return (
      x?.version === 1 &&
      Number.isInteger(x.coins) &&
      x.coins >= 0 &&
      ["weapon", "wall"].every(
        (k) => Number.isInteger(x[k]) && x[k] >= 0 && x[k] <= 20,
      ) &&
      Number.isInteger(x.unlocked) &&
      x.unlocked >= 1 &&
      x.unlocked <= 3 &&
      Array.isArray(x.first) &&
      x.first.every((n: any) => Number.isInteger(n) && n >= 1 && n <= 3) &&
      Array.isArray(x.settled) &&
      x.settled.every((id: any) => typeof id === "string") &&
      typeof x.muted === "boolean" &&
      typeof x.low === "boolean"
    );
  }
  private read() {
    for (const key of [this.key, this.key + "-backup"])
      try {
        const v = JSON.parse(this.storage.getItem(key) || "null");
        if (this.valid(v)) return v;
      } catch {}
    return fresh();
  }
  private commit(next: SaveData) {
    const old = JSON.stringify(this.data);
    this.storage.setItem(this.key + "-backup", old);
    this.storage.setItem(this.key, JSON.stringify(next));
    this.data = next;
  }
  cost(kind: "weapon" | "wall") {
    return Math.round(100 * Math.pow(1.18, this.data[kind]));
  }
  buy(kind: "weapon" | "wall") {
    const cost = this.cost(kind);
    if (this.data[kind] >= 20 || this.data.coins < cost) return false;
    const n = {
      ...this.data,
      coins: this.data.coins - cost,
      [kind]: this.data[kind] + 1,
    };
    this.commit(n);
    return true;
  }
  settings(muted: boolean, low: boolean) {
    this.commit({ ...this.data, muted, low });
  }
  settle(id: string, stage: number, won: boolean, cleared: number, bonus = 0) {
    if (this.data.settled.includes(id)) return 0;
    if (stage < 1 || stage > 3 || !Number.isInteger(stage))
      throw Error("Invalid stage");
    const n = JSON.parse(JSON.stringify(this.data)) as SaveData;
    const base = 100 + 15 * (stage - 1);
    let reward = won
      ? base
      : Math.floor((0.5 * base * Math.max(0, Math.min(10, cleared))) / 10);
    if (won && !n.first.includes(stage)) {
      reward += base * 2;
      n.first.push(stage);
    }
    reward += Math.max(0, Math.floor(bonus));
    n.coins += reward;
    n.settled.push(id);
    if (won) n.unlocked = Math.max(n.unlocked, Math.min(3, stage + 1));
    this.commit(n);
    return reward;
  }
}
