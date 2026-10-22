import type { ProgressData } from "../platform/ProgressData";
/** Read-only progress projection, independent of persistence and settlement. */
export function achievementProgress(data: Readonly<ProgressData>, id: string) {
  if (data.achievements?.includes(id)) return "已完成";
  if (id === "grave_twelve_paths")
    return `断棺起手 ${Object.values(data.graveQualified ?? {}).filter((v) => v && v.length >= 5).length}/12 · 每种起手5组双改`;
  if (id === "lead_twelve_paths")
    return `踏空起手 ${Object.values(data.leadQualified ?? {}).filter((v) => v && v.length >= 4).length}/12 · 每种起手4组双改`;
  if (id === "eclipse_twelve_paths")
    return `逐晖起手 ${Object.values(data.eclipseQualified ?? {}).filter((v) => v && v.length >= 3).length}/12 · 每种起手3组双改`;
  if (id === "edge_twelve_paths")
    return `双改起手 ${Object.values(data.edgeQualified ?? {}).filter((v) => v && v.length >= 2).length}/12 · 三阶段交棒反击且Boss无伤`;
  if (id === "kiln_ten_paths")
    return `双路线起手 ${Object.values(data.kilnQualified ?? {}).filter((v) => v && v.length >= 2).length}/10 · 三阶段断源且Boss无伤`;
  if (id === "loom_eight_paths")
    return `合格起手 ${data.loomQualifiedOpeners?.length ?? 0}/8 · 三阶段双线且Boss无伤`;
  if (id === "seal_pathfinder")
    return `合格起手 ${data.sealOpeners?.length ?? 0}/6 · 从本版开始统计`;
  if (id === "five_openers")
    return `起手 ${new Set(data.openerWins?.map((v) => v.skill)).size}/5 · 关卡 ${new Set(data.openerWins?.map((v) => v.stage)).size}/3`;
  return "以胜利结算验证；新挑战从本版开始统计";
}
