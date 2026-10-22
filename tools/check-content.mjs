import fs from "node:fs";
import { auditContent } from "./content-audit.mjs";
const result = auditContent();
fs.mkdirSync("artifacts/verification", { recursive: true });
fs.writeFileSync(
  "artifacts/verification/content.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
