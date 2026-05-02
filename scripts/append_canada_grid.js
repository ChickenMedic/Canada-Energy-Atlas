const fs = require('fs');

const hifld = JSON.parse(fs.readFileSync('./src/data/canada_grid.json', 'utf8'));

const canadaMajorLines = [
  // BC
  { name: 'Mica to Lower Mainland', type: 'AC', voltage: 500, route: [[52.06, -118.58], [50.7, -120.3], [49.2, -122.8]] },
  { name: 'Revelstoke to Nicola', type: 'AC', voltage: 500, route: [[51.05, -118.19], [50.1, -120.8]] },
  { name: 'Vancouver Island Cable', type: 'HVDC', voltage: 230, route: [[49.0, -123.1], [48.8, -123.4], [48.4, -123.3]] },
  
  // Alberta
  { name: 'Athabasca to Edmonton', type: 'AC', voltage: 500, route: [[57.0, -111.6], [54.5, -113.0], [53.5, -113.5]] },
  { name: 'Genesee to Langdon (Edm-Cal)', type: 'AC', voltage: 500, route: [[53.3, -114.3], [52.2, -113.8], [50.9, -113.8]] },
  { name: 'Calgary to Lethbridge', type: 'AC', voltage: 240, route: [[50.9, -113.9], [49.7, -112.8]] },
  
  // Sask
  { name: 'Boundary Dam to Regina', type: 'AC', voltage: 230, route: [[49.1, -103.0], [50.4, -104.6]] },
  { name: 'Regina to Saskatoon', type: 'AC', voltage: 230, route: [[50.4, -104.6], [51.5, -105.5], [52.1, -106.6]] },
  { name: 'Island Falls to Saskatoon', type: 'AC', voltage: 230, route: [[55.5, -102.3], [53.2, -104.6], [52.1, -106.6]] },
  
  // Manitoba
  { name: 'Bipole I & II', type: 'HVDC', voltage: 500, route: [[56.4, -94.1], [53.0, -97.0], [49.9, -97.1]] },
  { name: 'Bipole III', type: 'HVDC', voltage: 500, route: [[56.4, -94.1], [54.0, -101.0], [50.0, -98.0], [49.8, -97.0]] },
  
  // Ontario
  { name: 'Bruce to Toronto', type: 'AC', voltage: 500, route: [[44.3, -81.6], [43.8, -80.0], [43.6, -79.4]] },
  { name: 'Darlington to Toronto', type: 'AC', voltage: 500, route: [[43.8, -78.7], [43.7, -79.2]] },
  { name: 'Otter Rapids to Sudbury', type: 'AC', voltage: 500, route: [[50.1, -81.6], [48.4, -81.3], [46.5, -81.0]] },
  { name: 'Sudbury to Toronto', type: 'AC', voltage: 500, route: [[46.5, -81.0], [44.4, -79.7], [43.8, -79.5]] },
  { name: 'Thunder Bay to Sudbury', type: 'AC', voltage: 230, route: [[48.4, -89.2], [48.8, -85.9], [46.5, -84.3], [46.5, -81.0]] },
  
  // Quebec
  { name: 'James Bay Network', type: 'AC', voltage: 735, route: [[53.7, -77.6], [51.5, -76.0], [49.0, -74.0], [45.6, -73.6]] },
  { name: 'Manicouagan to Quebec City', type: 'AC', voltage: 735, route: [[50.6, -68.7], [48.4, -71.2], [46.8, -71.2]] },
  { name: 'Churchill Falls to Quebec', type: 'AC', voltage: 735, route: [[53.5, -63.9], [50.2, -66.5], [48.4, -69.0], [46.8, -71.2], [45.5, -73.5]] },
  
  // Maritimes & NL
  { name: 'Point Lepreau to Moncton', type: 'AC', voltage: 345, route: [[45.0, -66.4], [45.3, -66.0], [46.1, -64.8]] },
  { name: 'Moncton to Halifax', type: 'AC', voltage: 345, route: [[46.1, -64.8], [45.8, -64.2], [44.6, -63.6]] },
  { name: 'Cape Breton to Halifax', type: 'AC', voltage: 345, route: [[46.2, -60.0], [45.5, -62.0], [44.6, -63.6]] },
  { name: 'Maritime Link (NL-NS)', type: 'HVDC', voltage: 500, route: [[47.6, -59.3], [46.2, -60.2]] },
  { name: 'Muskrat Falls to St. Johns', type: 'HVDC', voltage: 350, route: [[53.2, -60.7], [48.5, -58.0], [47.5, -54.0], [47.5, -52.7]] }
];

// Deduplicate existing lines with same name to avoid doubling up if script run twice
const filteredHifld = hifld.filter(h => !canadaMajorLines.some(c => c.name === h.name));

const combined = [...canadaMajorLines, ...filteredHifld];

fs.writeFileSync('./src/data/canada_grid.json', JSON.stringify(combined, null, 2));
console.log('Appended comprehensive Canada grid to src/data/canada_grid.json');
