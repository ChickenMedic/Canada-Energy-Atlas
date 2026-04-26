const fs = require('fs');

const tsFile = 'src/data/north_america_geo.ts';
let code = fs.readFileSync(tsFile, 'utf8');

// Find the Alaska region
const alaskaStart = code.indexOf("name: 'Alaska',");
const coordsStart = code.indexOf("coordinates: [[", alaskaStart);
const arraysStart = code.indexOf("[-130.5", coordsStart); // this was my hand-drawn start
if (arraysStart === -1 || arraysStart > code.indexOf("]],", coordsStart)) {
    console.error("Couldn't find start array");
}

let arraysEnd = code.indexOf("]],", coordsStart);
let actualOldStart = coordsStart + "coordinates: [[".length;

const alaskaDump = fs.readFileSync('alaska_dump.txt', 'utf8');
// remove the outer brackets from the dump
let inner = alaskaDump.trim();
inner = inner.substring(1, inner.length - 1).trim();

// Use ONLY the US Census data without drawing a line to my Canada border stick
const newCoords = "\n      " + inner + "\n    ";

const newCode = code.substring(0, actualOldStart) + newCoords + code.substring(arraysEnd);

fs.writeFileSync(tsFile, newCode);
console.log("Successfully replaced Alaska coordinates with native polygon.");
