// Sedimentary Basin polygon coordinates [lng, lat]
// Used for visualizing the major geological foundations of Canada's oil & gas industry

export interface BasinData {
  name: string
  color: number
  opacity: number
  coordinates: number[][][] // Array of polygon rings (outer + holes). Each point is [lng, lat]
}

export const BASINS: BasinData[] = [
  {
    name: "Athabasca Oil Sands",
    color: 0xf59e0b, // Vibrant Amber / Gold for heavy oil
    opacity: 0.8,
    coordinates: [
      [
        [-113.5, 58.0],
        [-110.0, 58.0], 
        [-110.0, 55.4],
        [-113.8, 55.4],
        [-114.2, 56.5],
        [-113.5, 58.0],
      ]
    ]
  },
  {
    name: "Montney Formation",
    color: 0x10b981, // Vibrant Emerald Green
    opacity: 0.7,
    coordinates: [
      [
        [-122.5, 57.5], // North BC edge
        [-119.0, 56.0], 
        [-117.0, 54.0], // South AB edge
        [-118.5, 54.0],
        [-120.0, 55.5],
        [-123.0, 57.0],
        [-122.5, 57.5],
      ]
    ]
  },
  {
    name: "Jeanne d'Arc Basin",
    color: 0x3b82f6, // Bright Marine Blue
    opacity: 0.7,
    coordinates: [
      [
        [-48.5, 47.0], // East of NL
        [-47.0, 48.0],
        [-46.0, 47.0],
        [-46.5, 46.0],
        [-48.5, 46.5],
        [-48.5, 47.0],
      ]
    ]
  },
  {
    name: "St. Lawrence Lowlands",
    color: 0x8b5cf6, // Sharp Purple
    opacity: 0.6,
    coordinates: [
      [
        [-73.5, 45.5], // Montreal Area
        [-71.0, 46.8], // Quebec City Area
        [-67.0, 49.0], // Up river towards Anticosti
        [-61.0, 49.5], // Past Anticosti Island
        [-61.0, 48.5], 
        [-66.0, 48.0], // Gaspé area
        [-70.5, 46.0],
        [-73.5, 45.0],
        [-73.5, 45.5],
      ]
    ]
  }
]
