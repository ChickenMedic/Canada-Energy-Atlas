const https = require('https');
const fs = require('fs');

// Query HIFLD for transmission lines crossing or in Canada (using BBOX or just a subset of high voltage)
// Since Canada is roughly lat 42 to 83, lng -141 to -52.
// The HIFLD dataset has NAICS_DESC = 'ELECTRIC BULK POWER TRANSMISSION AND CONTROL'
// We can just query WHERE VOLTAGE >= 345 to get major North American lines.
const url = 'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0/query?where=VOLTAGE%3E%3D345&outFields=VOLTAGE,TYPE&f=geojson';

console.log('Fetching transmission lines from HIFLD...');

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const geo = JSON.parse(data);
      if (geo.error) {
        console.error('API Error:', geo.error);
        return;
      }
      
      console.log(`Fetched ${geo.features?.length} transmission line features.`);
      
      const grid = [];
      let count = 0;
      
      for (const feature of geo.features || []) {
        if (!feature.geometry || feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString') continue;
        
        let coordsRaw = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        
        const voltage = feature.properties.VOLTAGE;
        const type = feature.properties.TYPE; // e.g. "AC", "DC"
        
        for (const line of coordsRaw) {
          // Check if any point is in/near Canada (lat > 42)
          let inCanada = false;
          for (const pt of line) {
            if (pt[1] > 42 && pt[1] < 85 && pt[0] > -145 && pt[0] < -50) {
              inCanada = true;
              break;
            }
          }
          
          if (!inCanada) continue;

          // Convert to [lat, lng]
          const simplified = [];
          for (let i = 0; i < line.length; i++) {
             if (i === 0 || i === line.length - 1 || i % 4 === 0) {
                simplified.push([line[i][1], line[i][0]]);
             }
          }
          
          if (simplified.length > 1) {
            grid.push({
              name: `Transmission Line (${voltage} kV)`,
              type: type === 'DC' ? 'HVDC' : 'AC',
              voltage: voltage,
              route: simplified
            });
            count++;
          }
        }
      }
      
      console.log(`Extracted ${count} major transmission segments near Canada.`);
      fs.writeFileSync('./src/data/canada_grid.json', JSON.stringify(grid));
      console.log('Saved to src/data/canada_grid.json');

    } catch (e) {
      console.error('Parse error:', e);
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e);
});
