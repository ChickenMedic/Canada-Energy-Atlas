const fs = require('fs');

async function run() {
  const bboxes = [
    "45,-75,50,-70",   // South Quebec (Montreal, Quebec City)
    "50,-75,55,-70",   // Mid-North Quebec (James Bay east)
    "45,-70,55,-65",   // East Quebec (Manicouagan, North Shore)
    "43,-65,48,-60",   // Maritimes (NB, NS, PEI)
    "47,-60,55,-55"    // NL (Newfoundland & Labrador)
  ];

  let allWays = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < bboxes.length; i++) {
    const bbox = bboxes[i];
    console.log(`Fetching from OSM for BBOX ${bbox}...`);
    
    const query = `
      [out:json][timeout:90];
      (
        way["power"="line"]["voltage"~"^(100000|138000|150000|230000|240000|315000|345000|450000|500000|735000)$"](${bbox});
        way["power"="line"]["voltage"~"^[1-7][0-9]{5}$"](${bbox});
      );
      out geom;
    `;

    try {
      const response = await fetch('https://lz4.overpass-api.de/api/interpreter', {
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
    
    await sleep(3000);
  }

  const prev = JSON.parse(fs.readFileSync('./osm_canada.json', 'utf8'));
  allWays.push(...prev.elements);

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
