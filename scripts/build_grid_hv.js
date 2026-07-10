// Derives the bundled transmission-line file from the full OSM-sourced grid dump.
//
// src/data/canada_grid.json is the raw ~41k-line extract (33 MB) and is NOT imported
// by the app — only the high-voltage subset written here is. Re-run this whenever
// canada_grid.json is regenerated.
//
//   node scripts/build_grid_hv.js

const fs = require('fs');
const path = require('path');

// Lines below this are not rendered in AR — see buildGridLines() in src/app.ts.
const MIN_KV = 450;

const SRC = path.join(__dirname, '..', 'src', 'data', 'canada_grid.json');
const OUT = path.join(__dirname, '..', 'src', 'data', 'canada_grid_hv.json');

// Runs as a prebuild step. The raw dump is large and may be absent from a shallow
// checkout; the derived file is committed, so fall back to it rather than failing.
if (!fs.existsSync(SRC)) {
  if (fs.existsSync(OUT)) {
    console.warn(`${path.basename(SRC)} not found — keeping the committed ${path.basename(OUT)}.`);
    process.exit(0);
  }
  console.error(`Neither ${SRC} nor ${OUT} exists; cannot build the grid data.`);
  process.exit(1);
}

const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const kept = all.filter(line => (
  typeof line.voltage === 'number' &&
  line.voltage >= MIN_KV &&
  Array.isArray(line.route) &&
  line.route.length >= 2
));

fs.writeFileSync(OUT, JSON.stringify(kept));

const srcMb = (fs.statSync(SRC).size / 1e6).toFixed(1);
const outMb = (fs.statSync(OUT).size / 1e6).toFixed(1);
console.log(`${all.length} lines (${srcMb} MB) -> ${kept.length} lines >=${MIN_KV}kV (${outMb} MB)`);
