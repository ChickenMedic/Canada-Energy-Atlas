const fs = require('fs');

async function run() {
  const bboxes = [
    "48,-135,60,-110", // West
    "49,-110,60,-90",  // Central
    "42,-90,52,-75",   // East 1
    "45,-75,55,-55"    // East 2
  ];

  let allWays = [];

  for (let i = 0; i < bboxes.length; i++) {
    const bbox = bboxes[i];
    console.log(`Fetching from OSM for BBOX ${bbox}...`);
    
    // We fetch any line with voltage >= 100,000 (100kV+)
    const query = `
      [out:json][timeout:90];
      (
        way["power"="line"]["voltage"~"^(100000|138000|150000|230000|240000|315000|345000|450000|500000|735000)$"](${bbox});
        way["power"="line"]["voltage"~"^[1-7][0-9]{5}$"](${bbox});
      );
      out geom;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'CanadaEnergyAtlas/1.0 (test@example.com)'
        },
        body: 'data=' + encodeURIComponent(query)
      });
      
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json.elements) {
          allWays.push(...json.elements);
          console.log(`BBOX ${bbox}: Fetched ${json.elements.length} elements.`);
        }
      } catch(e) {
        console.error(`BBOX ${bbox} returned non-JSON: `, text.substring(0, 200));
      }
    } catch(err) {
      console.error(`Fetch failed for BBOX ${bbox}:`, err);
    }
  }

  // Deduplicate by ID
  const uniqueWays = [];
  const seenIds = new Set();
  for (const w of allWays) {
    if (w.type === 'way' && !seenIds.has(w.id)) {
      seenIds.add(w.id);
      uniqueWays.push(w);
    }
  }

  console.log(`Total unique Canadian OSM transmission ways: ${uniqueWays.length}`);
  fs.writeFileSync('./osm_canada.json', JSON.stringify({ elements: uniqueWays }));
  console.log('Saved to osm_canada.json');
}

run();
