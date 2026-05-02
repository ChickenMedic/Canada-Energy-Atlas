const fs = require('fs');

const osmData = JSON.parse(fs.readFileSync('./osm_canada.json', 'utf8'));
let gridLines = JSON.parse(fs.readFileSync('./src/data/canada_grid.json', 'utf8'));

console.log(`Initial canada_grid.json has ${gridLines.length} lines.`);

// Keep US lines, drop Canadian ones from the curated/HIFLD set if we want? 
// The user previously wanted "the canadian provinces to match the level of detail".
// If we just add OSM to the HIFLD data, we might get duplicates near the border.
// We can just keep HIFLD and add OSM lines that are purely in Canada, or just add all OSM lines.
// It's safer to just drop any HIFLD line that is ENTIRELY inside Canada (lat > 49 or specific regions), 
// and replace with OSM, but let's just combine them for maximum density since 3D tubes overlapping slightly is fine.

let count = 0;

for (const way of osmData.elements) {
  if (way.type !== 'way' || !way.geometry) continue;

  let voltageRaw = way.tags.voltage || '150000';
  // voltage can be "230000;138000" or "735000"
  let maxVoltage = 150000;
  const match = voltageRaw.match(/\d+/g);
  if (match) {
    for (const v of match) {
      const num = parseInt(v, 10);
      if (num > maxVoltage) maxVoltage = num;
    }
  }

  const voltageKv = Math.round(maxVoltage / 1000);
  
  if (voltageKv < 100) continue; // Skip sub-transmission

  const route = [];
  for (let i = 0; i < way.geometry.length; i++) {
    // Simplify 1 in 3 points for performance
    if (i === 0 || i === way.geometry.length - 1 || i % 3 === 0) {
      route.push([way.geometry[i].lat, way.geometry[i].lon]);
    }
  }

  if (route.length > 1) {
    gridLines.push({
      name: way.tags.name || `Transmission Line (${voltageKv} kV)`,
      type: (way.tags.line === 'hvdc' || way.tags.current === 'dc') ? 'HVDC' : 'AC',
      voltage: voltageKv,
      route: route
    });
    count++;
  }
}

fs.writeFileSync('./src/data/canada_grid.json', JSON.stringify(gridLines, null, 2));
console.log(`Added ${count} OSM lines. Total in canada_grid.json is now ${gridLines.length}.`);
