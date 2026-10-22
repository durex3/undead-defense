import type { StoragePort } from "./StoragePort";
import type { ProgressData } from "./ProgressData";
import { PROGRESS_KEY, rawString, recordId } from "./ProgressRepository";
import { decodeProgress } from "./ProgressCodec";
export const MANUAL_SAVE_LIMIT = 3;
export interface ManualSave {
  slot: number;
  token: string;
  state: "empty" | "saved" | "invalid" | "unreadable";
  savedAt?: number;
  data?: ProgressData;
}
export class ManualSaveSlots {
  constructor(private storage: StoragePort) {}
  private manualKey(slot: number) {
    return PROGRESS_KEY + "-manual-" + slot;
  }
  get manualSaves(): ManualSave[] {
    return [1, 2, 3].map<ManualSave>((slot) => {
      const key = this.manualKey(slot);
      try {
        const raw = this.storage.getItem(key),
          token = recordId(key, raw ? rawString(raw) : "");
        if (!raw) return { slot, token, state: "empty" };
        let v: any;
        try {
          v = JSON.parse(rawString(raw));
        } catch {
          return { slot, token, state: "invalid" };
        }
        if (v?.version === 1 && v.deleted === true)
          return { slot, token, state: "empty" };
        const record =
          v?.version === 1 && Number.isSafeInteger(v.savedAt)
            ? decodeProgress(v.data)
            : null;
        return record
          ? {
              slot,
              token,
              state: "saved",
              savedAt: v.savedAt,
              data: record.data,
            }
          : { slot, token, state: "invalid" };
      } catch {
        return { slot, token: "", state: "unreadable" };
      }
    });
  }
  saveManual(
    slot: number,
    token: string,
    revision: number,
    data: ProgressData,
    readBlocked: boolean,
  ) {
    const entry = this.manualSaves.find((v) => v.slot === slot);
    if (!entry) return "missing";
    if (entry.state === "unreadable" || readBlocked) return "save-failed";
    if (entry.token !== token || data.revision !== revision) return "stale";
    try {
      this.storage.setItem(
        this.manualKey(slot),
        JSON.stringify({ version: 1, savedAt: Date.now(), data: data }),
      );
      return "saved";
    } catch {
      return "save-failed";
    }
  }
  deleteManual(slot: number, token: string) {
    const entry = this.manualSaves.find((v) => v.slot === slot);
    if (!entry || entry.state === "empty") return "missing";
    if (entry.state === "unreadable") return "save-failed";
    if (entry.token !== token) return "stale";
    try {
      // A single-key tombstone cannot be resurrected from automatic backups.
      this.storage.setItem(
        this.manualKey(slot),
        JSON.stringify({ version: 1, deleted: true }),
      );
      return "deleted";
    } catch {
      return "save-failed";
    }
  }
}
