// map-kit/projection.ts — Configurable Web Mercator projection for 3D map rendering

export interface Projection {
  /** Convert geographic coordinates to world-space X/Z. */
  geoToWorld(lat: number, lng: number): [number, number]
  /** Convert world-space X/Z back to geographic coordinates. */
  worldToGeo(x: number, z: number): [number, number]
}

/**
 * Create a Web Mercator projection centered on the given lat/lng.
 *
 * @param centerLat  Latitude of the projection center (degrees)
 * @param centerLng  Longitude of the projection center (degrees)
 * @param scale      Degrees-to-world-units multiplier (e.g. 0.06)
 */
export function createProjection(centerLat: number, centerLng: number, scale: number): Projection {
  const centerLatRad = centerLat * Math.PI / 180
  const centerMercN = Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2))

  return {
    geoToWorld(lat: number, lng: number): [number, number] {
      const x = (lng - centerLng) * scale

      const latRad = lat * Math.PI / 180
      const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2))

      // Negative Z so that north points "up" in the default camera orientation
      const z = -(mercN - centerMercN) * (180 / Math.PI) * scale

      return [x, z]
    },

    worldToGeo(x: number, z: number): [number, number] {
      const lng = x / scale + centerLng

      const mercN = centerMercN - z / ((180 / Math.PI) * scale)
      const latRad = 2 * (Math.atan(Math.exp(mercN)) - Math.PI / 4)
      const lat = latRad * 180 / Math.PI

      return [lat, lng]
    },
  }
}
