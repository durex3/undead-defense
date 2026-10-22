import { withVerificationLock } from "./verification-lock.mjs";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

/**
 * Transpile the pure battle/platform code and the presentation layer into
 * temp/tests so Node can run unit tests and the offline art preview.
 *
 * Presentation modules import "cc"; a tiny stub is installed under
 * temp/tests/node_modules/cc so bare-specifier resolution works from the
 * transpiled files. The real Cocos Creator build never sees temp/.
 */
await withVerificationLock(async () => {
  const root = path.resolve("assets/scripts");
  const outRoot = path.resolve("temp/tests");
  const stubSource = path.resolve("tools/cc-stub.mjs");

  fs.rmSync(outRoot, { recursive: true, force: true });

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      const relative = path.relative(root, full);
      const out = path.join(outRoot, relative.replace(/\.ts$/, ".mjs"));
      const src = fs.readFileSync(full, "utf8");
      const text = ts
        .transpileModule(src, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.ES2020,
          },
        })
        .outputText.replace(/from ["'](\.{1,2}\/[^"']+)["']/g, 'from "$1.mjs"')
        .replace(/import ["'](\.{1,2}\/[^"']+)["']/g, 'import "$1.mjs"');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, text);
    }
  }

  for (const dir of ["battle", "platform", "presentation"])
    walk(path.join(root, dir));

  const ccDir = path.join(outRoot, "node_modules", "cc");
  fs.mkdirSync(ccDir, { recursive: true });
  fs.copyFileSync(stubSource, path.join(ccDir, "index.mjs"));
  fs.writeFileSync(
    path.join(ccDir, "package.json"),
    JSON.stringify(
      {
        name: "cc",
        version: "0.0.0",
        type: "module",
        main: "index.mjs",
        exports: { ".": "./index.mjs" },
      },
      null,
      2,
    ) + "\n",
  );
});
