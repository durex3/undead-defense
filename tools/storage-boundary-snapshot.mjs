import { createHash } from "node:crypto";
import {
  ProgressStore,
  PROGRESS_KEY,
  RECOVERY_KEY,
  createRepairCode,
} from "../temp/tests/platform/ProgressStore.mjs";
import { STAGE_CLEAR_IDS } from "../temp/tests/battle/UnlockConfig.mjs";
/** Compare IO order and serialized bytes as well as account state under injected failures. */
export function captureStorageBoundaries(Store = ProgressStore) {
  const rows = [],
    now = Date.now;
  Date.now = () => 1750000000000;
  try {
    for (const mode of [
      "ok",
      "primary-write",
      "backup-write",
      "archive-write",
      "all-write",
      "primary-read",
      "all-read",
    ])
      for (const seed of ["valid", "optional-corrupt", "unknown"]) {
        const values = new Map(),
          io = [];
        const storage = {
          getItem: (key) => {
            io.push(["get", key]);
            if (
              mode === "all-read" ||
              (mode === "primary-read" && key === PROGRESS_KEY)
            )
              throw Error("read");
            return values.get(key) || null;
          },
          setItem: (key, value) => {
            io.push(["set", key, value]);
            if (
              mode === "all-write" ||
              (mode === "primary-write" && key === PROGRESS_KEY) ||
              (mode === "backup-write" && key === PROGRESS_KEY + "-backup") ||
              (mode === "archive-write" && key === RECOVERY_KEY)
            )
              throw Error("quota");
            values.set(key, value);
          },
        };
        const d = {
          version: 1,
          rules: "armory-v1",
          revision: 10,
          coins: 2000,
          purchasedWeapons: [],
          achievements: [STAGE_CLEAR_IDS[1], STAGE_CLEAR_IDS[2]],
          settledRuns: [],
          stages: [1, 2],
          stageBest: {},
          best: { kills: 0, time: 0, weapons: 0 },
        };
        values.set(
          PROGRESS_KEY,
          JSON.stringify(
            seed === "unknown"
              ? { ...d, version: 99 }
              : seed === "optional-corrupt"
                ? {
                    ...d,
                    grades: { blade: 99 },
                    achievements: [...d.achievements, "removed"],
                  }
                : d,
          ),
        );
        const p = new Store(storage),
          outcomes = [];
        outcomes.push(p.buyHammer(), p.evolveWeapon("blade", 1));
        const slot = p.manualSaves[0];
        outcomes.push(p.saveManual(1, slot.token, p.data.revision));
        const saved = p.manualSaves[0];
        outcomes.push(
          p.loadManual(1, saved.token, p.data.revision),
          p.deleteManual(1, saved.token),
        );
        const records = p.recoveryRecords;
        if (records.length)
          outcomes.push(p.restoreRecord(records[0].id, p.data.revision));
        const repair = createRepairCode(4, 400, "1750000000000");
        outcomes.push(p.applyRepairCode(repair, p.data.revision));
        p.pending = true;
        outcomes.push(p.flush());
        const reopened = new Store(storage);
        const result = {
          outcomes,
          data: p.data,
          pending: p.pending,
          blocked: p.readBlocked,
          notice: p.loadNotice,
          reopened: reopened.data,
          readBlocked: reopened.readBlocked,
          values: Array.from(values),
          io,
        };
        rows.push({
          mode,
          seed,
          outcomes,
          coins: p.coins,
          blocked: p.readBlocked,
          digest: createHash("sha256")
            .update(JSON.stringify(result))
            .digest("hex"),
        });
      }
  } finally {
    Date.now = now;
  }
  return rows;
}
