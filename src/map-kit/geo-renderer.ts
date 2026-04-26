// map-kit/geo-renderer.ts — Render GeoJSON or raw coordinate rings as extruded THREE meshes

import type {Projection} from './projection'

export interface GeoRenderOptions {
  color?: string | number
  opacity?: number
  extrudeDepth?: number
  bevelEnabled?: boolean
  bevelThickness?: number
  metalness?: number
  roughness?: number
}

const DEFAULTS: Required<GeoRenderOptions> = {
  color: '#4488aa',
  opacity: 0.95,
  extrudeDepth: 0.05,
  bevelEnabled: true,
  bevelThickness: 0.003,
  metalness: 0.1,
  roughness: 0.8,
}

/**
 * Render a GeoJSON FeatureCollection of Polygon / MultiPolygon features as
 * extruded THREE.Mesh objects.  Supports holes via THREE.Path.
 *
 * @param T               The THREE namespace (window.THREE in 8th Wall)
 * @param featureCollection  A GeoJSON FeatureCollection
 * @param projection       Projection returned by createProjection()
 * @param opts             Rendering options
 * @returns                A THREE.Group containing all meshes
 */
export function renderGeoJsonFeatures(
  T: any,
  featureCollection: any,
  projection: Projection,
  opts?: GeoRenderOptions,
): any {
  const o = {...DEFAULTS, ...opts}
  const group = new T.Group()
  group.name = 'GeoJsonFeatures'

  const extrudeSettings = {
    depth: o.extrudeDepth,
    bevelEnabled: o.bevelEnabled,
    bevelThickness: o.bevelThickness,
    bevelSize: o.bevelThickness,
    bevelSegments: 2,
  }

  const material = new T.MeshStandardMaterial({
    color: new T.Color(o.color),
    metalness: o.metalness,
    roughness: o.roughness,
    transparent: o.opacity < 1,
    opacity: o.opacity,
  })

  for (const feature of featureCollection.features) {
    try {
      const geomType = feature.geometry.type
      const coordinates = feature.geometry.coordinates
      // Normalise to an array of polygon ring-sets
      const polygons: number[][][][] =
        geomType === 'Polygon' ? [coordinates] : coordinates

      for (const rings of polygons) {
        const outerRing = rings[0]
        if (!outerRing || outerRing.length < 3) continue

        const shape = new T.Shape()
        const [px0, pz0] = projection.geoToWorld(outerRing[0][1], outerRing[0][0])
        shape.moveTo(px0, -pz0)
        for (let i = 1; i < outerRing.length; i++) {
          const [px, pz] = projection.geoToWorld(outerRing[i][1], outerRing[i][0])
          shape.lineTo(px, -pz)
        }

        // Holes
        for (let h = 1; h < rings.length; h++) {
          const holeRing = rings[h]
          if (!holeRing || holeRing.length < 3) continue
          const holePath = new T.Path()
          const [hx0, hz0] = projection.geoToWorld(holeRing[0][1], holeRing[0][0])
          holePath.moveTo(hx0, -hz0)
          for (let i = 1; i < holeRing.length; i++) {
            const [hx, hz] = projection.geoToWorld(holeRing[i][1], holeRing[i][0])
            holePath.lineTo(hx, -hz)
          }
          shape.holes.push(holePath)
        }

        const geometry = new T.ExtrudeGeometry(shape, extrudeSettings)
        const mesh = new T.Mesh(geometry, material.clone())
        mesh.rotation.x = -Math.PI / 2
        // Copy over feature properties for downstream hit-testing / tooltips
        mesh.userData = {...(feature.properties || {})}
        group.add(mesh)
      }
    } catch (e) {
      console.warn('[map-kit] renderGeoJsonFeatures error:', e)
    }
  }

  return group
}

/**
 * Render simple coordinate rings (arrays of [lng, lat]) as extruded shapes.
 * Useful for context regions that aren't full GeoJSON.
 *
 * @param T            THREE namespace
 * @param coordRings   Array of rings, each ring is [lng, lat][]
 * @param projection   Projection
 * @param opts         Rendering options
 */
export function renderSimpleOutline(
  T: any,
  coordRings: Array<Array<[number, number]>>,
  projection: Projection,
  opts?: GeoRenderOptions,
): any {
  const o = {...DEFAULTS, ...opts}
  const group = new T.Group()
  group.name = 'SimpleOutline'

  for (const ring of coordRings) {
    if (ring.length < 3) continue
    try {
      const shape = new T.Shape()
      const [px0, pz0] = projection.geoToWorld(ring[0][1], ring[0][0])
      shape.moveTo(px0, -pz0)
      for (let i = 1; i < ring.length; i++) {
        const [px, pz] = projection.geoToWorld(ring[i][1], ring[i][0])
        shape.lineTo(px, -pz)
      }

      const geometry = new T.ExtrudeGeometry(shape, {
        depth: o.extrudeDepth,
        bevelEnabled: o.bevelEnabled,
        bevelThickness: o.bevelThickness,
        bevelSize: o.bevelThickness,
        bevelSegments: 2,
      })
      const material = new T.MeshStandardMaterial({
        color: new T.Color(o.color),
        metalness: o.metalness,
        roughness: o.roughness,
        transparent: o.opacity < 1,
        opacity: o.opacity,
      })
      const mesh = new T.Mesh(geometry, material)
      mesh.rotation.x = -Math.PI / 2
      group.add(mesh)
    } catch (e) {
      console.warn('[map-kit] renderSimpleOutline error:', e)
    }
  }

  return group
}
