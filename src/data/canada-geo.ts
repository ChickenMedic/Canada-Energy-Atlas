// Simplified GeoJSON-style province boundaries for 3D rendering
// These are simplified polygon outlines projected to a flat coordinate system
// centered on Canada (approx Lambert Conformal Conic)

export interface ProvinceData {
  code: string
  name: string
  center: [number, number]  // [lat, lng]
  // Simplified outline points as [lat, lng] for rendering
  outline: Array<[number, number]>
  // Energy stats
  oil_production_bpd: number
  gas_production_mcfd: number
  coal_production_tpd: number
  primary_energy_source: string
  population: number
}

// Convert lat/lng to a flat X/Z coordinate system for 3D rendering
// Uses a simple equirectangular projection centered on Canada
const CENTER_LAT = 60
const CENTER_LNG = -96
const SCALE = 0.06  // degrees to world units

export function geoToWorld(lat: number, lng: number): [number, number] {
  // Compress extreme northern latitudes to prevent massive islands (Nunavut/NWT)
  let adjustedLat = lat;
  if (adjustedLat > 60) {
    adjustedLat = 60 + (adjustedLat - 60) * 0.5;
  }
  
  const x = (lng - CENTER_LNG) * SCALE
  const latRad = adjustedLat * Math.PI / 180
  const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)))
  
  const centerLatRad = CENTER_LAT * Math.PI / 180
  const centerMercN = Math.log(Math.tan((Math.PI / 4) + (centerLatRad / 2)))
  
  const z = -(mercN - centerMercN) * (180 / Math.PI) * SCALE
  
  return [x, z]
}

export function worldToGeo(x: number, z: number): [number, number] {
  const lng = x / SCALE + CENTER_LNG
  
  const centerLatRad = CENTER_LAT * Math.PI / 180
  const centerMercN = Math.log(Math.tan((Math.PI / 4) + (centerLatRad / 2)))
  
  const mercN = centerMercN - z / ((180 / Math.PI) * SCALE)
  const latRad = 2 * (Math.atan(Math.exp(mercN)) - Math.PI / 4)
  let lat = latRad * 180 / Math.PI
  
  // Reverse compression for interactions to work properly
  if (lat > 60) {
    lat = 60 + (lat - 60) * 2;
  }
  
  return [lat, lng]
}

export const PROVINCES: ProvinceData[] = [
  {
    code: 'AB',
    name: 'Alberta',
    center: [53.93, -116.58],
    outline: [
      [60, -120], [60, -110], [49, -110], [49, -114.07], [49, -120], [54, -120], [60, -120],
    ],
    oil_production_bpd: 3_800_000,
    gas_production_mcfd: 10_200_000,
    coal_production_tpd: 27_000,
    primary_energy_source: 'Oil Sands / Natural Gas',
    population: 4_601_000,
  },
  {
    code: 'BC',
    name: 'British Columbia',
    center: [53.73, -127.65],
    outline: [
      [60, -139], [60, -120], [54, -120], [49, -120], [49, -114.07],
      [49, -123.2], [50, -125.5], [51.5, -128], [54, -130], [54.5, -130.5],
      [56, -131], [59.5, -137], [60, -139],
    ],
    oil_production_bpd: 180_000,
    gas_production_mcfd: 5_800_000,
    coal_production_tpd: 7_000,
    primary_energy_source: 'Hydroelectricity / Natural Gas',
    population: 5_368_000,
  },
  {
    code: 'SK',
    name: 'Saskatchewan',
    center: [52.94, -106.45],
    outline: [
      [60, -110], [60, -102], [49, -102], [49, -110], [60, -110],
    ],
    oil_production_bpd: 480_000,
    gas_production_mcfd: 850_000,
    coal_production_tpd: 14_000,
    primary_energy_source: 'Oil / Coal / Potash',
    population: 1_214_000,
  },
  {
    code: 'MB',
    name: 'Manitoba',
    center: [55.0, -98.0],
    outline: [
      [60, -102], [60, -94.8], [57, -92.1], [56.9, -89], [52.85, -89],
      [51.6, -89.5], [49, -89.5], [49, -95.2], [49, -102], [60, -102],
    ],
    oil_production_bpd: 46_000,
    gas_production_mcfd: 0,
    coal_production_tpd: 0,
    primary_energy_source: 'Hydroelectricity',
    population: 1_444_000,
  },
  {
    code: 'ON',
    name: 'Ontario',
    center: [50.0, -85.0],
    outline: [
      [56.9, -89], [51.5, -79.5], [51.0, -79.5], [48.0, -79.5],
      [46.5, -80], [45.5, -79.5], [44.0, -77], [43.7, -76.5],
      [43.2, -79.1], [42.3, -82.5], [42.0, -83], [46, -84.5],
      [47.5, -85], [48.5, -89.3], [49, -89.5], [51.6, -89.5],
      [52.85, -89], [56.9, -89],
    ],
    oil_production_bpd: 2_000,
    gas_production_mcfd: 15_000,
    coal_production_tpd: 0,
    primary_energy_source: 'Nuclear / Hydroelectricity',
    population: 15_801_000,
  },
  {
    code: 'QC',
    name: 'Quebec',
    center: [52.94, -71.25],
    outline: [
      [62, -79.5], [55, -77.5], [51.5, -79.5], [51.0, -79.5],
      [48.0, -79.5], [46.5, -79.4], [45.5, -74.7], [45.0, -74.3],
      [45.0, -71.5], [46.8, -71.2], [47.0, -70.0], [48.5, -69],
      [49.2, -66], [49.2, -64], [50.2, -63.5], [51.5, -57.1],
      [55, -60], [58.5, -65], [60, -65], [62, -75], [62, -79.5],
    ],
    oil_production_bpd: 0,
    gas_production_mcfd: 0,
    coal_production_tpd: 0,
    primary_energy_source: 'Hydroelectricity',
    population: 8_946_000,
  },
  {
    code: 'NB',
    name: 'New Brunswick',
    center: [46.50, -66.16],
    outline: [
      [48, -66.4], [47.9, -64.8], [46.0, -64.0], [45.0, -66.4],
      [45.1, -67.1], [47.0, -67.8], [47.4, -68.3], [48, -66.4],
    ],
    oil_production_bpd: 0,
    gas_production_mcfd: 2_000,
    coal_production_tpd: 0,
    primary_energy_source: 'Nuclear / Hydro / Natural Gas',
    population: 820_000,
  },
  {
    code: 'NS',
    name: 'Nova Scotia',
    center: [44.68, -63.74],
    outline: [
      [46.0, -61.0], [45.6, -61.5], [43.5, -65.7], [43.8, -66.3],
      [44.6, -66.0], [45.6, -63.0], [46.0, -61.0],
    ],
    oil_production_bpd: 0,
    gas_production_mcfd: 80_000,
    coal_production_tpd: 500,
    primary_energy_source: 'Natural Gas / Wind / Imports',
    population: 1_058_000,
  },
  {
    code: 'NL',
    name: 'Newfoundland and Labrador',
    center: [53.13, -57.66],
    outline: [
      [60, -65], [58.5, -65], [55, -60], [51.5, -57.1],
      [51, -56.5], [47.5, -55.5], [46.6, -53.0], [47.6, -52.6],
      [48.5, -53.0], [49.5, -54.5], [51.5, -55.5], [53.2, -55.5],
      [60, -57], [60, -65],
    ],
    oil_production_bpd: 220_000,
    gas_production_mcfd: 350_000,
    coal_production_tpd: 0,
    primary_energy_source: 'Hydroelectricity / Offshore Oil',
    population: 533_000,
  },
  {
    code: 'PEI',
    name: 'Prince Edward Island',
    center: [46.24, -63.13],
    outline: [
      [46.0, -62.0], [46.45, -63.0], [47.05, -64.4], [46.8, -64.4],
      [46.4, -63.8], [46.0, -62.0],
    ],
    oil_production_bpd: 0,
    gas_production_mcfd: 0,
    coal_production_tpd: 0,
    primary_energy_source: 'Wind / Imports',
    population: 172_000,
  },
  {
    code: 'NT',
    name: 'Northwest Territories',
    center: [64.27, -119.18],
    outline: [
      [70, -141], [70, -120], [68.3, -120], [66, -120], [60, -120],
      [60, -110], [60, -102], [60, -110], [60, -120], [60, -132],
      [60, -141], [70, -141],
    ],
    oil_production_bpd: 15_000,
    gas_production_mcfd: 5_000,
    coal_production_tpd: 0,
    primary_energy_source: 'Diesel / Hydro',
    population: 45_000,
  },
  {
    code: 'YT',
    name: 'Yukon Territory',
    center: [63.0, -135.0],
    outline: [
      [70, -141], [60, -141], [60, -139], [60, -132], [60, -120],
      [66, -120], [68.3, -120], [70, -120], [70, -141],
    ],
    oil_production_bpd: 0,
    gas_production_mcfd: 0,
    coal_production_tpd: 0,
    primary_energy_source: 'Hydroelectricity / Diesel',
    population: 44_000,
  },
  {
    code: 'NU',
    name: 'Nunavut',
    center: [70.45, -86.80],
    outline: [
      [83, -70], [83, -120], [70, -120], [68.3, -120], [66, -120],
      [60, -102], [60, -94.8], [57, -92.1], [56.9, -89], [60, -82],
      [63, -78], [66, -73], [70, -68], [75, -65], [80, -67], [83, -70],
    ],
    oil_production_bpd: 0,
    gas_production_mcfd: 0,
    coal_production_tpd: 0,
    primary_energy_source: 'Diesel',
    population: 40_000,
  },
]

// Distinct premium color palette to separate touching provinces
const PROVINCE_COLORS: Record<string, string> = {
  'AB': '#10b981', // Emerald
  'BC': '#3b82f6', // Bright Blue
  'SK': '#f59e0b', // Amber
  'MB': '#ef4444', // Red
  'ON': '#8b5cf6', // Violet
  'QC': '#0ea5e9', // Cyan
  'NB': '#d946ef', // Fuchsia
  'NL': '#f97316', // Orange
  'NS': '#84cc16', // Lime
  'PEI': '#eab308', // Yellow
  'YT': '#14b8a6', // Teal
  'NT': '#6366f1', // Indigo
  'NU': '#ec4899', // Pink
}

// Color scale for energy production intensity
export function getProvinceColor(province: ProvinceData): string {
  return PROVINCE_COLORS[province.code] || '#4488aa'
}

// Height scale for 3D extrusion based on production
export function getProvinceHeight(province: ProvinceData): number {
  const totalEnergy = province.oil_production_bpd + province.gas_production_mcfd / 6
  return 0.05 + Math.log10(Math.max(totalEnergy, 1)) * 0.08
}
