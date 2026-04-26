# map-kit

Reusable 3D map rendering toolkit for 8th Wall / THREE.js projects. Extracted from the Canadian Energy Atlas so the same projection, shape-rendering, tube, label, and control logic can power other apps (policy viewers, logistics dashboards, etc.).

## Modules

| Module | Purpose |
|--------|---------|
| `projection` | Web Mercator projection centered on any lat/lng |
| `geo-renderer` | GeoJSON Polygon/MultiPolygon to extruded THREE.Mesh (with hole support) |
| `labels` | Canvas-based THREE.Sprite text labels and price-card sprites |
| `tubes` | CatmullRomCurve3 route tubes and QuadraticBezierCurve3 arc lines |
| `controls` | Pointer-driven spin, pan, zoom for a THREE.Group |

## Quick start

```ts
import {
  createProjection,
  renderGeoJsonFeatures,
  renderTube,
  makeLabel,
  attachMapControls,
} from './map-kit'

// 1. Grab THREE from the 8th Wall global
const T = (window as any).THREE

// 2. Create a projection centered on your area of interest
const proj = createProjection(60, -96, 0.06)   // Canada-centered

// 3. Render GeoJSON boundaries
const mapGroup = new T.Group()
const provinces = renderGeoJsonFeatures(T, canadaGeoJson, proj, {
  color: '#4488aa',
  extrudeDepth: 0.05,
})
mapGroup.add(provinces)

// 4. Add a pipeline tube
const tube = renderTube(T, [
  [56.7, -111.4],
  [53.5, -113.5],
  [51.0, -114.1],
  [49.0, -122.8],
], proj, {radius: 0.006, color: '#ff8800'})
mapGroup.add(tube)

// 5. Drop a label
const lbl = makeLabel(T, ['AB', '3.8M bpd'], {fontSize: 28})
const [cx, cz] = proj.geoToWorld(53.93, -116.58)
lbl.position.set(cx, 0.17, cz)
lbl.scale.set(0.45, 0.22, 1)
mapGroup.add(lbl)

// 6. Attach controls (spin, pan, zoom)
const controls = attachMapControls(mapGroup, () => camera, T, {
  ignoreSelectors: '#ui-panel, .overlay',
})

// 7. Add to scene
scene.add(mapGroup)

// Cleanup when done
controls.dispose()
```

## API

### `createProjection(centerLat, centerLng, scale)`

Returns a `Projection` with `geoToWorld(lat, lng)` and `worldToGeo(x, z)`.

### `renderGeoJsonFeatures(T, featureCollection, projection, opts?)`

Renders GeoJSON Polygon/MultiPolygon features as extruded meshes. Feature properties are copied to `mesh.userData`. Returns a `THREE.Group`.

### `renderSimpleOutline(T, coordRings, projection, opts?)`

Renders raw `[lng, lat][]` coordinate rings. Returns a `THREE.Group`.

### `makeLabel(T, lines, opts?)`

Canvas sprite with rounded-rect background. First line bold, rest smaller.

### `makePriceCard(T, data, opts?)`

Commodity price-card sprite with symbol, price, change indicator, and colored border.

### `renderTube(T, route, projection, opts?)`

CatmullRomCurve3 tube along `[lat, lng][]` waypoints.

### `renderArcLine(T, from, to, projection, opts?)`

QuadraticBezierCurve3 arc between two `[lat, lng]` points.

### `attachMapControls(mapGroup, getCamera, T, opts?)`

Attaches spin (left-click), pan (right-click), and zoom (wheel) to a group. Pass `ignoreSelectors` to exclude UI elements. Returns `{ dispose() }`.
