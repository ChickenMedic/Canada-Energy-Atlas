const https = require('https');
const fs = require('fs');

// We'll fetch the 5m resolution US states GeoJSON
const url = 'https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_5m.json';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const geo = JSON.parse(data);
      
      const alaska = geo.features.find(f => f.properties.NAME === 'Alaska');
      const florida = geo.features.find(f => f.properties.NAME === 'Florida');

      // We need just the largest polygon for the mainland of these states
      function getLargestPolygon(feature) {
          let largest = [];
          let maxPts = 0;
          if (feature.geometry.type === 'Polygon') {
              return feature.geometry.coordinates[0];
          } else if (feature.geometry.type === 'MultiPolygon') {
              feature.geometry.coordinates.forEach(poly => {
                  if (poly[0].length > maxPts) {
                      maxPts = poly[0].length;
                      largest = poly[0];
                  }
              });
              return largest;
          }
          return [];
      }

      const akPoints = getLargestPolygon(alaska);
      // Simplify a bit by taking every 3rd point, but keeping 1st and last
      const simplifiedAk = [];
      const step = 5; // The 5m json is VERY huge (1000s of points), let's keep ~300
      for (let i = 0; i < akPoints.length; i += 3) {
          simplifiedAk.push(`[${akPoints[i][0].toFixed(3)}, ${akPoints[i][1].toFixed(3)}]`);
      }
      if (simplifiedAk[simplifiedAk.length - 1] !== `[${akPoints[akPoints.length-1][0].toFixed(3)}, ${akPoints[akPoints.length-1][1].toFixed(3)}]`) {
          simplifiedAk.push(`[${akPoints[akPoints.length-1][0].toFixed(3)}, ${akPoints[akPoints.length-1][1].toFixed(3)}]`);
      }

      console.log(`Alaska Points: ${simplifiedAk.length}`);
      
      fs.writeFileSync('alaska_dump.txt', `[\n  ${simplifiedAk.join(', ')}\n]`);
      
      console.log("Done.");

    } catch (e) {
      console.error(e);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
