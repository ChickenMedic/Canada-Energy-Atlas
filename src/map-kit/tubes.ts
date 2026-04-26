// map-kit/tubes.ts — 3D tube and arc-line rendering along geographic routes

import type {Projection} from './projection'

export interface TubeOptions {
  radius?: number
  color?: string | number
  emissive?: string | number
  emissiveIntensity?: number
  opacity?: number
  segments?: number
  /** Y-height of the tube above the map plane */
  height?: number
}

const TUBE_DEFAULTS: Required<TubeOptions> = {
  radius: 0.005,
  color: '#44aaff',
  emissive: '#44aaff',
  emissiveIntensity: 0.35,
  opacity: 0.8,
  segments: 8,
  height: 0.06,
}

/**
 * Render a CatmullRomCurve3 tube along a geographic route.
 *
 * @param T           THREE namespace
 * @param route       Array of [lat, lng] waypoints
 * @param projection  Projection instance
 * @param opts        Visual options
 */
export function renderTube(
  T: any,
  route: Array<[number, number]>,
  projection: Projection,
  opts?: TubeOptions,
): any {
  const o = {...TUBE_DEFAULTS, ...opts}
  const group = new T.Group()
  group.name = 'Tube'

  const points = route.map(([lat, lng]) => {
    const [x, z] = projection.geoToWorld(lat, lng)
    return new T.Vector3(x, o.height, z)
  })

  if (points.length < 2) return group

  const curve = new T.CatmullRomCurve3(points)
  const tubularSegments = Math.max(points.length * 6, 20)
  const geometry = new T.TubeGeometry(curve, tubularSegments, o.radius, o.segments, false)
  const material = new T.MeshStandardMaterial({
    color: new T.Color(o.color),
    emissive: new T.Color(o.emissive),
    emissiveIntensity: o.emissiveIntensity,
    transparent: o.opacity < 1,
    opacity: o.opacity,
  })
  group.add(new T.Mesh(geometry, material))

  return group
}

export interface ArcLineOptions {
  radius?: number
  color?: string | number
  emissive?: string | number
  emissiveIntensity?: number
  opacity?: number
  segments?: number
  /** Base Y-height of arc endpoints */
  height?: number
  /** Extra height added at the arc midpoint (proportional scaling also applied) */
  arcHeight?: number
}

const ARC_DEFAULTS: Required<ArcLineOptions> = {
  radius: 0.004,
  color: '#44ddaa',
  emissive: '#44ddaa',
  emissiveIntensity: 0.7,
  opacity: 0.7,
  segments: 6,
  height: 0.13,
  arcHeight: 0.15,
}

/**
 * Render a QuadraticBezierCurve3 arc between two geographic points.
 * The midpoint is raised above the map to form a visible arc.
 *
 * @param T           THREE namespace
 * @param from        [lat, lng] start
 * @param to          [lat, lng] end
 * @param projection  Projection instance
 * @param opts        Visual options
 */
export function renderArcLine(
  T: any,
  from: [number, number],
  to: [number, number],
  projection: Projection,
  opts?: ArcLineOptions,
): any {
  const o = {...ARC_DEFAULTS, ...opts}
  const group = new T.Group()
  group.name = 'ArcLine'

  const [x1, z1] = projection.geoToWorld(from[0], from[1])
  const [x2, z2] = projection.geoToWorld(to[0], to[1])

  const p1 = new T.Vector3(x1, o.height, z1)
  const p2 = new T.Vector3(x2, o.height, z2)
  const mid = new T.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
  mid.y += p1.distanceTo(p2) * o.arcHeight

  const curve = new T.QuadraticBezierCurve3(p1, mid, p2)
  const geometry = new T.TubeGeometry(curve, 16, o.radius, o.segments, false)
  const material = new T.MeshStandardMaterial({
    color: new T.Color(o.color),
    emissive: new T.Color(o.emissive),
    emissiveIntensity: o.emissiveIntensity,
    transparent: o.opacity < 1,
    opacity: o.opacity,
  })
  group.add(new T.Mesh(geometry, material))

  return group
}
