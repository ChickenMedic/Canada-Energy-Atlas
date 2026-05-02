const fs = require('fs');

const hifld = JSON.parse(fs.readFileSync('./src/data/canada_grid.json', 'utf8'));

const grid = [
  {
    name: 'James Bay Transmission System',
    type: 'HVDC',
    voltage: 735,
    route: [
      [53.7, -77.6], // Radisson (James Bay)
      [49.5, -75.0], // Mid Quebec
      [45.5, -73.6]  // Montreal
    ]
  },
  {
    name: 'Churchill Falls to Hydro-Québec',
    type: 'AC',
    voltage: 735,
    route: [
      [53.5, -63.9], // Churchill Falls, NL
      [50.2, -66.5], // Sept-Îles, QC
      [46.8, -71.2], // Quebec City
      [45.5, -73.6]  // Montreal
    ]
  },
  {
    name: 'Bruce to Milton (GTA)',
    type: 'AC',
    voltage: 500,
    route: [
      [44.3, -81.6], // Bruce Nuclear
      [43.8, -80.0], // Orangeville
      [43.5, -79.8]  // Milton / GTA
    ]
  },
  {
    name: 'Nelson River Bipole',
    type: 'HVDC',
    voltage: 500,
    route: [
      [56.4, -94.1], // Gillam (Nelson River)
      [53.0, -97.0], // Interlake
      [49.9, -97.1]  // Winnipeg
    ]
  },
  {
    name: 'Peace River to Lower Mainland',
    type: 'AC',
    voltage: 500,
    route: [
      [56.0, -122.0], // W.A.C. Bennett Dam
      [53.9, -122.7], // Prince George
      [50.7, -120.3], // Kamloops
      [49.2, -122.8]  // Vancouver
    ]
  },
  {
    name: 'Alberta-BC Intertie',
    type: 'AC',
    voltage: 500,
    route: [
      [51.1, -114.1], // Calgary area
      [51.1, -115.3], // Rockies
      [50.7, -120.3]  // Kamloops (connects to BC grid)
    ]
  },
  {
    name: 'Maritime Link (NL to NS)',
    type: 'HVDC',
    voltage: 500,
    route: [
      [47.6, -59.3], // Cape Ray, NL
      [46.2, -60.2], // Cape Breton, NS
      [44.6, -63.6]  // Halifax, NS
    ]
  },
  {
    name: 'Manitoba-Minnesota Intertie',
    type: 'AC',
    voltage: 500,
    route: [
      [49.9, -97.1], // Winnipeg
      [49.0, -96.5], // Border
      [48.0, -96.0]  // US direction
    ]
  },
  {
    name: 'Ontario-NY Intertie (Niagara)',
    type: 'AC',
    voltage: 345,
    route: [
      [43.5, -79.8], // Milton / GTA
      [43.1, -79.0], // Niagara
      [42.9, -78.8]  // NY State
    ]
  },
  {
    name: 'Quebec-New England Intertie',
    type: 'HVDC',
    voltage: 450,
    route: [
      [45.5, -73.6], // Montreal
      [45.0, -73.0], // Border
      [44.5, -72.0]  // US direction
    ]
  }
];

// combine hifld + custom grid
const combined = [...grid, ...hifld];

fs.writeFileSync('./src/data/canada_grid.json', JSON.stringify(combined, null, 2));
console.log('Saved to src/data/canada_grid.json with custom lines appended');
