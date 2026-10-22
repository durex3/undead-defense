import { freshProgress } from "./ProgressCodec";
import type { ProgressData } from "./ProgressData";
import { STAGE_IDS } from "../battle/ProgressionConfig";
import { STAGE_CLEAR_IDS } from "../battle/UnlockConfig";
function repairChecksum(body: string) {
  let hash = 2166136261;
  for (let i = 0; i < body.length; i++)
    hash = Math.imul(hash ^ body.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
/** Local account correction, with a checksum against copy errors; not cloud authentication. */
export function createRepairCode(
  cleared: number,
  coins: number,
  nonce: string,
) {
  const body = `ASR1-${cleared}-${coins}-${nonce}`;
  return body + "-" + repairChecksum(body);
}
export function previewRepairCode(
  text: string,
): { data: ProgressData; id: string } | null {
  const code = text.trim();
  if (code.length > 160) return null;
  const match = /^(ASR1-(\d{1,2})-(\d{1,8})-(\d{8,16}))-([a-z0-9]+)$/.exec(
    code,
  );
  if (!match || repairChecksum(match[1]) !== match[5]) return null;
  const cleared = Number(match[2]),
    coins = Number(match[3]);
  if (
    cleared < 0 ||
    cleared > Math.max(...STAGE_IDS) ||
    !Number.isSafeInteger(coins) ||
    coins > 10000000
  )
    return null;
  const data = freshProgress();
  data.stages = STAGE_IDS.filter((id) => id <= cleared);
  data.coins = coins;
  data.achievements = data.stages.map((id) => STAGE_CLEAR_IDS[id]);
  return { data, id: "repair:" + code };
}
