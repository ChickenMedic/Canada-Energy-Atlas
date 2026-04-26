const shapefile = require('shapefile');

async function run() {
  const source = await shapefile.open('../Pipelines_SHP/Pipelines_SHP/Pipelines_GCS_NAD83.shp', '../Pipelines_SHP/Pipelines_SHP/Pipelines_GCS_NAD83.dbf');
  const result = await source.read();
  console.log(Object.keys(result.value.properties));
}
run().catch(console.error);
