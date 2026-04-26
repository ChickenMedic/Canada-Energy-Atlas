const shapefile = require('shapefile');
const fs = require('fs');

const shpPath = '../Pipelines_SHP/Pipelines_SHP/Pipelines_GCS_NAD83.shp';
const dbfPath = '../Pipelines_SHP/Pipelines_SHP/Pipelines_GCS_NAD83.dbf';

async function run() {
  console.log('Starting shapefile processing...');
  
  // Highlighting the massive size of the AER database
  const source = await shapefile.open(shpPath, dbfPath);
  
  const pipelines = [];
  let count = 0;

  while (true) {
    const result = await source.read();
    if (result.done) break;
    
    count++;
    if (count % 10000 === 0) console.log(`Processed ${count} records...`);

    const feature = result.value;
    const props = feature.properties;
    
    const status = props['SEG_STATUS'];
    const diameter = parseFloat(props['OUT_DIAMET'] || 0);

    // Keep pipelines that are currently operating and are massive transmission lines (>= 600mm / 24 inches)
    if (status && status.trim() === 'Operating' && diameter >= 600) {
      const geomType = feature.geometry.type;
      let coordsRaw = [];
      
      if (geomType === 'LineString') {
         coordsRaw = [feature.geometry.coordinates];
      } else if (geomType === 'MultiLineString') {
         coordsRaw = feature.geometry.coordinates;
      }

      const substance = props['SUBSTANCE1'] ? props['SUBSTANCE1'].trim().toLowerCase() : '';
      let product = 'gas';
      if (substance.includes('oil') || substance.includes('crude') || substance.includes('lvp')) {
        product = 'oil';
      }

      for (const line of coordsRaw) {
        // Simplify geometry to save memory on mobile device
        const simplified = [];
        for (let i = 0; i < line.length; i++) {
           // keeping 1 out of 8 points + endpoints
           if (i === 0 || i === line.length - 1 || i % 8 === 0) {
              // Convert to [lat, lng]
              simplified.push([line[i][1], line[i][0]]);
           }
        }

        if (simplified.length > 1) {
            pipelines.push({
              name: props['COMP_NAME'] ? props['COMP_NAME'].trim() : 'Pipeline',
              product: product,
              diameter: diameter,
              route: simplified
            });
        }
      }
    }
  }

  console.log(`Finished processing ${count} total records.`);
  console.log(`Extracted ${pipelines.length} major pipeline segments.`);
  
  fs.writeFileSync('./src/data/ab_major_pipelines.json', JSON.stringify(pipelines));
  console.log('Saved to src/data/ab_major_pipelines.json');
}

run().catch(console.error);
