import type { StoragePort } from "./StoragePort";
import type { ProgressData } from "./ProgressData";
import { decodeProgress, freshProgress } from "./ProgressCodec";
/** Stable account namespace: updates never delete previous saves. */
export const PROGRESS_KEY = "ashen-survivors-armory-progress-v1";
export const RECOVERY_KEY = PROGRESS_KEY + "-recovery";
const SAVE_KEYS = [
  PROGRESS_KEY,
  PROGRESS_KEY + "-backup",
  "ashen-survivors-progress-v1",
  "ashen-survivors-progress-v1-backup",
  "undead-defense-v1",
  "undead-defense-v1-backup",
];
interface PreservedSave {
  key: string;
  raw: string;
}
export interface RecoveryRecord {
  id: string;
  source: string;
  data: ProgressData;
  repaired: boolean;
}
export function rawString(raw: unknown) {
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}
export function recordId(key: string, raw: string) {
  let hash = 2166136261;
  for (const ch of key + raw)
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
/** Raw persistence boundary: selection and preservation never settle rewards. */
export class ProgressRepository {
  constructor(private storage: StoragePort) {}
  load() {
    let data = freshProgress(),
      loadNotice = "",
      readBlocked = false;
    const candidates: RecoveryRecord[] = [];
    let readFailed = false,
      activeUnknown = false;
    for (const key of SAVE_KEYS)
      try {
        const raw = this.storage.getItem(key);
        if (!raw) continue;
        const record = decodeProgress(raw);
        if (record)
          candidates.push({
            id: recordId(key, rawString(raw)),
            source:
              key === PROGRESS_KEY
                ? "主存档"
                : key === PROGRESS_KEY + "-backup"
                  ? "备用存档"
                  : "旧位置",
            ...record,
          });
        else if (key === PROGRESS_KEY || key === PROGRESS_KEY + "-backup")
          activeUnknown = true;
      } catch {
        readFailed = true;
      }
    const current = candidates.filter((v) => v.source !== "旧位置");
    const pool = current.length ? current : candidates;
    if (pool.length) {
      const chosen = pool.sort((a, b) => b.data.revision - a.data.revision)[0];
      data = chosen.data;
      if (chosen.repaired) loadNotice = "已兼容读取旧存档，通关与金币已保留";
      else if (chosen.source !== "主存档")
        loadNotice = "已从" + chosen.source + "读取账户进度";
    } else {
      readBlocked = readFailed || activeUnknown;
      if (readBlocked) loadNotice = "存档读取异常，已暂停覆盖；请打开存档检查";
    }
    return { data, loadNotice, readBlocked };
  }
  private archives(): PreservedSave[] {
    const raw = this.storage.getItem(RECOVERY_KEY);
    if (!raw) return [];
    const v = JSON.parse(rawString(raw));
    if (!Array.isArray(v)) throw Error("Recovery archive unreadable");
    return v.filter(
      (x) => x && typeof x.key === "string" && typeof x.raw === "string",
    );
  }
  private preserveStored() {
    try {
      const old = this.archives(),
        next = [...old];
      for (const key of SAVE_KEYS) {
        const raw = this.storage.getItem(key);
        if (!raw) continue;
        const value = rawString(raw);
        if (!next.some((x) => x.key === key && x.raw === value))
          next.push({ key, raw: value });
      }
      if (next.length === old.length) return true;
      // Preserve the original pair plus ten recent raw snapshots.
      const bounded =
        next.length > 12 ? [...next.slice(0, 2), ...next.slice(-10)] : next;
      this.storage.setItem(RECOVERY_KEY, JSON.stringify(bounded));
      return true;
    } catch {
      return false;
    }
  }
  get recoveryRecords(): RecoveryRecord[] {
    const entries: PreservedSave[] = [];
    for (const key of SAVE_KEYS)
      try {
        const raw = this.storage.getItem(key);
        if (raw) entries.push({ key, raw: rawString(raw) });
      } catch {}
    try {
      entries.push(...this.archives());
    } catch {}
    const records: RecoveryRecord[] = [],
      seen = new Set<string>();
    for (const entry of entries) {
      const value = decodeProgress(entry.raw);
      if (!value) continue;
      const id = recordId(entry.key, entry.raw);
      if (seen.has(id)) continue;
      seen.add(id);
      records.push({
        id,
        source:
          entry.key === PROGRESS_KEY
            ? "主存档副本"
            : entry.key === PROGRESS_KEY + "-backup"
              ? "备用存档副本"
              : "旧位置副本",
        ...value,
      });
    }
    return records.sort(
      (a, b) =>
        b.data.stages.length - a.data.stages.length ||
        b.data.revision - a.data.revision,
    );
  }
  /** Preserve originals before any automatic write or transactional account replacement. */
  writePreserved(data: ProgressData, advanceRevision = false) {
    if (!this.preserveStored()) return false;
    if (advanceRevision) data.revision++;
    const raw = JSON.stringify(data);
    let successes = 0;
    for (const key of [PROGRESS_KEY, PROGRESS_KEY + "-backup"])
      try {
        this.storage.setItem(key, raw);
        successes++;
      } catch {}
    return successes > 0;
  }
}
