const fs = require('fs');

const tsFile = 'src/data/north_america_geo.ts';
let code = fs.readFileSync(tsFile, 'utf8');

// Find the Alaska region
const alaskaStart = code.indexOf("name: 'Alaska',");
const coordsStart = code.indexOf("coordinates: [[", alaskaStart);
const arraysStart = code.indexOf("[-130.5", coordsStart);
const coordsEnd = code.indexOf("]],", coordsStart);

const alaskaDump = fs.readFileSync('alaska_dump.txt', 'utf8');
// remove the outer brackets from the dump
let inner = alaskaDump.trim();
inner = inner.substring(1, inner.length - 1).trim();

// The existing file uses a specific BC border matching prefix
const bcBorder = "[-130.5, 54.5], [-131.0, 56.0], [-137.0, 59.5], [-139.0, 60.0],\n      [-141.0, 60.0], [-141.0, 69.65],\n";

const newCoords = bcBorder + "      " + inner + ",\n      [-130.5, 54.5]\n    ";

const newCode = code.substring(0, arraysStart) + newCoords + code.substring(coordsEnd);

fs.writeFileSync(tsFile, newCode);
console.log("Successfully replaced Alaska coordinates.");
