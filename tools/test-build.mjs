import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("assets/scripts");
for (const dir of ["battle", "platform", "presentation"])
  for (const file of fs
    .readdirSync(path.join(root, dir))
    .filter((x) => x.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(root, dir, file), "utf8");
    const out = ts
      .transpileModule(src, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ES2020,
        },
      })
      .outputText.replace(/from ["'](\.{1,2}\/[^"']+)["']/g, 'from "$1.mjs"');
    fs.mkdirSync(`temp/tests/${dir}`, { recursive: true });
    fs.writeFileSync(`temp/tests/${dir}/${file.replace(".ts", ".mjs")}`, out);
  }
