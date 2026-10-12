const base = process.argv[2] || "http://localhost:8128";
const paths = [
  "/",
  "/index.js",
  "/application.js",
  "/style.css",
  "/src/polyfills.bundle.js",
  "/src/system.bundle.js",
  "/src/import-map.json",
];

let failed = false;
for (const path of paths) {
  try {
    const response = await fetch(`${base}${path}`);
    const body = path === "/" ? await response.text() : "";
    const validHtml = path !== "/" || body.includes('id="GameCanvas"');
    if (!response.ok || !validHtml) {
      failed = true;
      console.error(`FAIL ${path}: HTTP ${response.status}`);
    } else {
      console.log(`OK   ${path}: HTTP ${response.status}`);
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}

if (failed) process.exitCode = 1;
