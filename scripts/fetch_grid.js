const fs = require('fs');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching transmission lines >= 150kV from HIFLD...');
  
  const grid = [];
  let count = 0;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0/query?where=VOLTAGE%3E%3D150&outFields=VOLTAGE,TYPE&resultOffset=${offset}&f=geojson`;
    
    console.log(`Fetching offset ${offset}...`);
    const geo = await fetchJson(url);
    
    if (geo.error) {
      console.error('API Error:', geo.error);
      break;
    }

    const features = geo.features || [];
    if (features.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const feature of features) {
      if (!feature.geometry || (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString')) continue;
      
      let coordsRaw = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      
      const voltage = feature.properties.VOLTAGE;
      const type = feature.properties.TYPE;
      
      for (const line of coordsRaw) {
        // Broad bounding box for Canada and northern US
        let inCanada = false;
        for (const pt of line) {
          // Look for anything roughly north of latitude 43
          if (pt[1] > 43 && pt[1] < 85 && pt[0] > -145 && pt[0] < -50) {
            inCanada = true;
            break;
          }
        }
        
        if (!inCanada) continue;

        const simplified = [];
        for (let i = 0; i < line.length; i++) {
           // Simplify to keep file size down, keeping 1/4 of vertices
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
    
    offset += features.length;
    // ArcGIS max record count is typically 2000
    if (features.length < 2000) {
      hasMore = false;
    }
  }
  
  console.log(`Extracted ${count} major transmission segments near Canada.`);
  fs.writeFileSync('./src/data/canada_grid.json', JSON.stringify(grid));
  console.log('Saved to src/data/canada_grid.json');
}

run().catch(console.error);
