// AR Energy Atlas — Main Application Entry
// Uses registerBehavior to get the World object, then builds everything programmatically

import * as ecs from '@8thwall/ecs'
import { PROVINCES, geoToWorld, worldToGeo, getProvinceColor, getProvinceHeight, ProvinceData } from './data/canada-geo'
import { canadaGeoJson } from './data/canada_geojson'
import { northAmericaRegions } from './data/north_america_geo'
import {
  fetchCommodityPrices, fetchEnergyNews, getCancelledPipelines,
  calculateWhatIfRevenue, getHistoricalData, getElectricalGridData,
  getOperationalPipelines, getPriceMarkerLocations, getDataSources,
  runPipelineSimulation, getHistoricalPricing,
  getExportTerminals, getRefineries, getExportRoutes, getImportFlows,
  CommodityPrice, PipelineProject, OperationalPipeline,
  ExportTerminal, RefineryFacility, ExportRoute,
} from './services/api'
import { BASINS, BasinData } from './data/basins-geo'

// ── Globals ──
let world: any = null
let mapGroup: any = null
let oilPipelineGroup: any = null
let gasPipelineGroup: any = null
let cancelledPipelineGroup: any = null
let gridGroup: any = null
let priceMarkerGroup: any = null
let labelGroup: any = null
let exportGroup: any = null
let basinGroup: any = null
let flowTexture: any = null
let flowTextures: any[] = []
let initialized = false
let T: any = null
let activeWorld: any = null

// ── Layer visibility ──
const layerState = {
  oilPipelines: false,
  gasPipelines: false,
  cancelledPipelines: false,
  grid: false,
  prices: false,
  labels: true,
  exports: false,
  basins: false,
}

// ── Simulation State ──
// Original planned completion years (used as reset defaults)
const ORIGINAL_COMPLETION_YEARS: Record<string, number> = {
  'Energy East': 2018,
  'Northern Gateway': 2018,
  'Keystone XL': 2015,
}

const simState = {
  completionYears: { ...ORIGINAL_COMPLETION_YEARS } as Record<string, number>,
  utilizationPercent: 85,
  oilPriceUsd: 71.45,
  exchangeRate: 1.36,
  yearsOperating: 10,
}

// ── Province label config ──
// Hardcoded visual center [lat, lng] for each province label — vertex centroids
// are useless because GeoJSON vertices cluster along complex coastlines.
// These are manually chosen to sit at the visual middle of each province's landmass.
interface LabelConfig { lat: number; lng: number; rot: number; scale: number }
const LABEL_CONFIG: Record<string, LabelConfig> = {
  AB: { lat: 55, lng: -115., rot: 0, scale: 0.8 },        // Center of AB rectangle
  BC: { lat: 55, lng: -124, rot: 0, scale: 0.8 },       // Inland from coast
  SK: { lat: 55, lng: -106, rot: 0, scale: 0.8 },        // Center of SK rectangle
  MB: { lat: 55, lng: -97.0, rot: 0, scale: 0.8 },         // Inland from Hudson Bay
  ON: { lat: 51, lng: -87.0, rot: 0, scale: 0.8 },       // Central Ontario
  QC: { lat: 51, lng: -73.0, rot: 0, scale: 0.8 },       // Southern QC near St Lawrence
  NB: { lat: 46.7, lng: -66.5, rot: 0, scale: 0.4 },        // Center of NB
  NS: { lat: 44.8, lng: -63.0, rot: 0, scale: 0.35 },      // Along peninsula
  NL: { lat: 49.0, lng: -56.5, rot: 0, scale: 0.6 },        // Newfoundland island
  PEI: { lat: 46.5, lng: -63.5, rot: -45, scale: 0.25 },      // PEI center
  NT: { lat: 64.0, lng: -122.0, rot: 0, scale: 0.8 },        // Central NWT
  YT: { lat: 64.0, lng: -136.0, rot: 0, scale: 0.8 },        // Central Yukon
  NU: { lat: 64.0, lng: -96.0, rot: 0, scale: 0.8 },         // Central mainland Nunavut
}

// ══════════════════════════════════════════
// THREE.JS HELPERS
// ══════════════════════════════════════════

function getThree(): boolean {
  if (T) return true
  T = (window as any).THREE
  if (!T) {
    console.error('[Energy Atlas] THREE not on window')
    return false
  }
  const needed = ['Group', 'Mesh', 'BoxGeometry', 'PlaneGeometry', 'MeshStandardMaterial', 'MeshBasicMaterial', 'Color', 'Vector3', 'SphereGeometry', 'BufferGeometry', 'Line', 'CanvasTexture', 'Shape', 'ExtrudeGeometry', 'Path', 'TubeGeometry', 'CatmullRomCurve3', 'Raycaster', 'Vector2', 'Plane', 'DoubleSide', 'LinearFilter']
  const missing = needed.filter(k => !T[k])
  if (missing.length > 0) console.warn('[Energy Atlas] Missing THREE:', missing)
  return true
}

// Create a small inline label for along-pipe naming — FLAT mesh, not camera-facing
// Pill background = pipe color, text = dark for readability
function makePipeNameLabel(name: string, color: number): any {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 768, 160)

  // Pill in the pipeline's color
  const hex = '#' + (color & 0xffffff).toString(16).padStart(6, '0')
  ctx.fillStyle = hex
  ctx.globalAlpha = 0.88
  ctx.beginPath()
  ctx.roundRect(6, 20, 756, 120, 48)
  ctx.fill()
  ctx.globalAlpha = 1.0

  // Dark text for contrast — extra bold
  ctx.fillStyle = '#000000'
  ctx.font = '900 56px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 384, 80, 740)

  const texture = new T.CanvasTexture(canvas)
  texture.minFilter = T.LinearFilter
  const mat = new T.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 0.9,
    depthWrite: false, side: T.DoubleSide,
  })
  const geom = new T.PlaneGeometry(1, 1)
  const mesh = new T.Mesh(geom, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 10
  return mesh
}

// Create a high-res canvas-based label — FLAT mesh on map surface, NOT camera-facing
function makeLabel(lines: string[], opts: { bgColor?: string, textColor?: string, subTextColor?: string, fontSize?: number, subFsMultiplier?: number, width?: number, height?: number, padding?: number } = {}): any {
  const w = opts.width || 1024
  const h = opts.height || 480
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  ctx.fillStyle = opts.bgColor || 'rgba(0, 0, 0, 0.72)'
  ctx.beginPath()
  ctx.roundRect(10, 10, w - 20, h - 20, 16)
  ctx.fill()

  ctx.fillStyle = opts.textColor || '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const fs = opts.fontSize || 88
  const lineH = fs * 1.25
  const startY = (h - lines.length * lineH) / 2 + lineH / 2

  const mainColor = opts.textColor || '#ffffff'
  const subColor = opts.subTextColor || (mainColor === '#000000' ? '#000000' : '#bbddff')
  const subFsMult = opts.subFsMultiplier || 0.72
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? `900 ${fs}px Arial, sans-serif` : `900 ${Math.round(fs * subFsMult)}px Arial, sans-serif`
    ctx.fillStyle = i === 0 ? mainColor : subColor
    ctx.fillText(line, w / 2, startY + i * lineH, w - 40)
  })

  const texture = new T.CanvasTexture(canvas)
  texture.minFilter = T.LinearFilter
  const mat = new T.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 0.85,
    depthWrite: false, side: T.DoubleSide,
  })
  const geom = new T.PlaneGeometry(1, 1)
  const mesh = new T.Mesh(geom, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 20
  return mesh
}

// ══════════════════════════════════════════
// FLAT MAP TEXT — province names laid across polygons
// ══════════════════════════════════════════

function makeFlatText(text: string, opts: { fontSize?: number, color?: string, width?: number, height?: number, opacity?: number, addDepth?: boolean } = {}): any {
  const w = opts.width || 512
  const h = opts.height || 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  const fs = opts.fontSize || 72
  ctx.font = `900 ${fs}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (opts.addDepth) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    // Hard step duplicate the text downwards to fake a literal 3D extrusion chunk
    for (let d = 1; d <= 8; d++) {
      ctx.fillText(text, (w / 2) - (d * 0.5), (h / 2) + d, w - 20)
    }
    // Optional shadow at the base of the extrusion
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowOffsetY = 4
    ctx.shadowBlur = 8
  }

  // Draw the bright face
  ctx.fillStyle = opts.color || 'rgba(255,255,255,0.7)'
  ctx.fillText(text, w / 2, h / 2, w - 20)
  ctx.shadowColor = 'transparent' // reset

  const texture = new T.CanvasTexture(canvas)
  texture.minFilter = T.LinearFilter
  const mat = new T.MeshBasicMaterial({
    map: texture, transparent: true, opacity: opts.opacity ?? 0.6,
    depthWrite: false, side: T.DoubleSide,
  })
  const geom = new T.PlaneGeometry(1, h / w)
  const mesh = new T.Mesh(geom, mat)
  mesh.renderOrder = 10  // render above polygons
  return mesh
}

// ══════════════════════════════════════════
// LABEL COLLISION AVOIDANCE
// ══════════════════════════════════════════

// After all sprites are placed, push overlapping labels apart so nothing stacks
// Works in world-space XZ since the map is roughly flat on that plane
function resolveOverlapsInGroup(group: any, pinTarget?: any) {
  if (!group || !T) return
  const sprites: any[] = []

  // Collect all label objects (flat meshes and sprites) from this group
  group.children.forEach((child: any) => {
    // Pipeline route markers (renderOrder 10) are intentionally left exactly on the curve, shielded from the collision algorithm
    if ((child.userData?.clickType === 'pipeline' || child.userData?.clickType === 'cancelledPipeline') && child.renderOrder === 10) return
    if (child.isSprite || (child.isMesh && child.material && child.material.map)) sprites.push(child)
  })

  if (sprites.length < 2) return

  // Sort by X then Z for deterministic ordering
  sprites.sort((a: any, b: any) => a.position.x - b.position.x || a.position.z - b.position.z)

  // Iterative separation — run multiple passes to settle
  const passes = 6
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < sprites.length; i++) {
      for (let j = i + 1; j < sprites.length; j++) {
        const a = sprites[i]
        const b = sprites[j]

        // Compute overlap in XZ using half-widths from scale
        const aHalfW = a.scale.x * 0.5
        const aHalfH = a.scale.y * 0.5
        const bHalfW = b.scale.x * 0.5
        const bHalfH = b.scale.y * 0.5

        const dx = b.position.x - a.position.x
        const dz = b.position.z - a.position.z

        const overlapX = (aHalfW + bHalfW) - Math.abs(dx)
        const overlapZ = (aHalfH + bHalfH) - Math.abs(dz)

        // If both axes overlap, the labels are colliding
        if (overlapX > 0 && overlapZ > 0) {
          // Push apart along the axis with least overlap (minimum displacement)
          if (overlapZ <= overlapX) {
            // Separate vertically (Z axis in world = vertical on screen roughly)
            const pushZ = (overlapZ / 2) + 0.02
            if (dz >= 0) {
              a.position.z -= pushZ
              b.position.z += pushZ
            } else {
              a.position.z += pushZ
              b.position.z -= pushZ
            }
          } else {
            // Separate horizontally (X axis)
            const pushX = (overlapX / 2) + 0.02
            if (dx >= 0) {
              a.position.x -= pushX
              b.position.x += pushX
            } else {
              a.position.x += pushX
              b.position.x -= pushX
            }
          }
          // Also stagger Y height slightly so they don't z-fight
          b.position.y += 0.02
        }
      }
    }
  }
}

// Run overlap resolution across all visible label groups
function resolveAllLabelOverlaps() {
  // if (labelGroup) resolveOverlapsInGroup(labelGroup) // Disabled to allow strict manual config
  if (oilPipelineGroup) resolveOverlapsInGroup(oilPipelineGroup)
  if (gasPipelineGroup) resolveOverlapsInGroup(gasPipelineGroup)
  if (cancelledPipelineGroup) resolveOverlapsInGroup(cancelledPipelineGroup)
  if (gridGroup) resolveOverlapsInGroup(gridGroup)
  if (priceMarkerGroup) resolveOverlapsInGroup(priceMarkerGroup)
}

// ══════════════════════════════════════════
// NORTH AMERICA CONTEXT SHAPES (US/Mexico/Alaska)
// ══════════════════════════════════════════

function buildContextShapes() {
  if (!T || !mapGroup) return
  const contextGroup = new T.Group()
  contextGroup.name = 'ContextShapes'

  for (const region of northAmericaRegions) {
    try {
      for (const ring of region.coordinates) {
        const shape = new T.Shape()
        if (ring.length < 3) continue
        const [px0, pz0] = geoToWorld(ring[0][1], ring[0][0])
        shape.moveTo(px0, -pz0)
        for (let i = 1; i < ring.length; i++) {
          const [px, pz] = geoToWorld(ring[i][1], ring[i][0])
          shape.lineTo(px, -pz)
        }
        const geometry = new T.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false })
        const material = new T.MeshStandardMaterial({
          color: region.color, metalness: 0.05, roughness: 0.9,
          transparent: true, opacity: region.opacity,
        })
        const mesh = new T.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2
        mesh.userData = { region: region.name, clickType: 'region' }
        contextGroup.add(mesh)
      }
    } catch (e) {
      console.warn(`[Energy Atlas] Context shape ${region.name} error:`, e)
    }
  }

  // Add labels for United States and Mexico
  try {
    const usLabelConfig = { lat: 39.8, lng: -98.5, text: 'UNITED STATES' }
    const [usX, usZ] = geoToWorld(usLabelConfig.lat, usLabelConfig.lng)
    const usText = makeFlatText(usLabelConfig.text, { fontSize: 80, color: 'rgba(200,200,200,0.8)', width: 800, height: 128, opacity: 0.8, addDepth: true })
    usText.rotation.order = 'YXZ'
    usText.rotation.x = -Math.PI / 2
    usText.position.set(usX, 0.05, usZ)
    usText.scale.set(2.0, 2.0, 1)
    usText.userData = { region: 'United States' }
    contextGroup.add(usText)

    const mexLabelConfig = { lat: 23.6, lng: -102.5, text: 'MEXICO' }
    const [mexX, mexZ] = geoToWorld(mexLabelConfig.lat, mexLabelConfig.lng)
    const mexText = makeFlatText(mexLabelConfig.text, { fontSize: 80, color: 'rgba(200,200,200,0.8)', width: 800, height: 128, opacity: 0.8, addDepth: true })
    mexText.rotation.order = 'YXZ'
    mexText.rotation.x = -Math.PI / 2
    mexText.position.set(mexX, 0.05, mexZ)
    mexText.scale.set(2.0, 2.0, 1)
    mexText.userData = { region: 'Mexico' }
    contextGroup.add(mexText)
  } catch (e) {
    console.warn('[Energy Atlas] Region labels error:', e)
  }

  mapGroup.add(contextGroup)
}

// ══════════════════════════════════════════
// CANADA MAP — GeoJSON extruded provinces
// ══════════════════════════════════════════

function buildCanadaMap(scene: any) {
  if (!getThree()) return
  mapGroup = new T.Group()
  mapGroup.name = 'CanadaMap'
  mapGroup.scale.set(0.25, 0.25, 0.25) // Reduce map size by another 50% (25% total)

  // AR Pedestal Base
  const padGeom = new T.CylinderGeometry(3.9, 3.9, 0.02, 64)
  const padMat = new T.MeshBasicMaterial({ color: 0x0066ff, transparent: true, opacity: 0.25, depthWrite: false })
  const padMesh = new T.Mesh(padGeom, padMat)
  padMesh.position.y = -0.06
  mapGroup.add(padMesh)
  labelGroup = new T.Group()
  labelGroup.name = 'ProvinceLabels'

  const extrudeSettings = {
    depth: 0.05, bevelEnabled: true,
    bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2,
  }

  canadaGeoJson.features.forEach((feature: any) => {
    const geoName = feature.properties.name
    const province = PROVINCES.find(p => p.name === geoName)
    if (!province) return
    try {
      const color = getProvinceColor(province)
      const material = new T.MeshStandardMaterial({
        color: new T.Color(color), metalness: 0.1, roughness: 0.8,
        transparent: true, opacity: 0.95,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      })
      const geomType = feature.geometry.type
      const coordinates = feature.geometry.coordinates
      const polygons = geomType === 'Polygon' ? [coordinates] : coordinates

      // Track the largest mesh (most vertices = main landmass) for label placement
      let mainMesh: any = null
      let maxVertCount = 0

      polygons.forEach((rings: number[][][]) => {
        const outerRing = rings[0]
        const shape = new T.Shape()
        if (outerRing.length > 0) {
          const [px0, pz0] = geoToWorld(outerRing[0][1], outerRing[0][0])
          shape.moveTo(px0, -pz0)
          for (let i = 1; i < outerRing.length; i++) {
            const [px, pz] = geoToWorld(outerRing[i][1], outerRing[i][0])
            shape.lineTo(px, -pz)
          }
        }
        for (let h = 1; h < rings.length; h++) {
          const holeRing = rings[h]
          const holePath = new T.Path()
          if (holeRing.length > 0) {
            const [px0, pz0] = geoToWorld(holeRing[0][1], holeRing[0][0])
            holePath.moveTo(px0, -pz0)
            for (let i = 1; i < holeRing.length; i++) {
              const [px, pz] = geoToWorld(holeRing[i][1], holeRing[i][0])
              holePath.lineTo(px, -pz)
            }
          }
          shape.holes.push(holePath)
        }
        const geometry = new T.ExtrudeGeometry(shape, extrudeSettings)
        const mesh = new T.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2
        mesh.userData = { provinceCode: province.code, provinceName: province.name, clickType: 'province', province }
        mapGroup.add(mesh)

        // Track the largest polygon mesh for label centering
        const vertCount = geometry.attributes.position.count
        if (vertCount > maxVertCount) {
          maxVertCount = vertCount
          mainMesh = mesh
        }
      })

      // Province label — placed at manually configured [lat, lng]
      if (mainMesh) {
        const cfg = LABEL_CONFIG[province.code] || { lat: province.center[0], lng: province.center[1], rot: 0, scale: 1.0 }
        const [cx, cz] = geoToWorld(cfg.lat, cfg.lng)

        mainMesh.userData.centroid = [cx, cz]

        // Forced purely bright white font for clarity, combined with 3D text depth
        const textMesh = makeFlatText(province.code, {
          fontSize: 160, color: '#ffffff', width: 512, height: 256, opacity: 1.0, addDepth: true
        })
        textMesh.rotation.order = 'YXZ'
        textMesh.rotation.x = -Math.PI / 2
        textMesh.rotation.y = cfg.rot * Math.PI / 180
        textMesh.position.set(cx, 0.12, cz)
        textMesh.scale.set(cfg.scale, cfg.scale, 1)
        textMesh.renderOrder = 10
        textMesh.userData = { clickType: 'provinceLabel', province, centroid: [cx, cz] }
        labelGroup.add(textMesh)

        console.log(`[Label] ${province.code} at x=${cx.toFixed(3)} z=${cz.toFixed(3)} (centroid)`)
      }
    } catch (e) {
      console.warn(`[Energy Atlas] Province ${geoName} error:`, e)
    }
  })

  labelGroup.visible = true  // visible by default in overview mode
  mapGroup.add(labelGroup)

  // Ocean plane removed to keep background transparent for AR

  scene.add(mapGroup)
}

// ══════════════════════════════════════════
// OPERATIONAL PIPELINES — 3D tubes on map
// ══════════════════════════════════════════

function addPipelineToGroup(pipeline: OperationalPipeline, group: any) {
  const points = pipeline.route.map(([lat, lng]: [number, number]) => {
    const [x, z] = geoToWorld(lat, lng)
    return new T.Vector3(x, 0.06, z)
  })
  if (points.length < 2) return

  let radius = 0.012

  const curve = new T.CatmullRomCurve3(points)
  const geom = new T.TubeGeometry(curve, Math.max(points.length * 6, 20), radius, 8, false)
  const mat = new T.MeshStandardMaterial({
    color: pipeline.color, emissive: new T.Color(pipeline.color),
    emissiveIntensity: 0.8,
    emissiveMap: flowTexture ? flowTexture.clone() : null, transparent: true, opacity: 0.9,
  })
  
  if (mat.emissiveMap) {
    // Lock the dash texture repeat strictly to the physical curve length, not the arbitrary node count
    const totalLenForTex = curve.getLength()
    mat.emissiveMap.repeat.set(totalLenForTex * 15, 1)
    
    // Scale baseline animation tick logically by capacity: 1M bpd = 0.015 delta
    const rawBpd = pipeline.capacity_bpd || (pipeline.capacity_bcfd ? pipeline.capacity_bcfd * 100000 : 300000)
    const velocity = Math.max(0.005, (rawBpd / 1000000.0) * 0.015)
    
    flowTextures.push({ map: mat.emissiveMap, velocity })
  }

  const mesh = new T.Mesh(geom, mat)
  mesh.userData = { pipeline: pipeline.name, product: pipeline.product, clickType: 'pipeline', pipelineData: pipeline }
  group.add(mesh)

  // Endpoint markers to match cancelled pipeline style
  for (const coord of [pipeline.route[0], pipeline.route[pipeline.route.length - 1]]) {
    const [x, z] = geoToWorld(coord[0], coord[1])
    const sphere = new T.Mesh(
      new T.SphereGeometry(0.02, 12, 12),
      new T.MeshStandardMaterial({ color: pipeline.color, emissive: new T.Color(pipeline.color), emissiveIntensity: 0.4 })
    )
    sphere.position.set(x, 0.06, z)
    group.add(sphere)
  }

  const capStr = pipeline.capacity_bpd
    ? `${(pipeline.capacity_bpd / 1000).toFixed(0)}k barrels/day`
    : `${pipeline.capacity_bcfd?.toFixed(1)} Bcf/d`

  // Manually push the massive detail labels towards more logical visual areas
  let mainLabelT = 0.2
  const lowerName = pipeline.name.toLowerCase()
  if (lowerName.includes('keystone')) mainLabelT = 0.85
  else if (lowerName.includes('enbridge mainline')) mainLabelT = 0.65
  else if (lowerName.includes('trans mountain')) mainLabelT = 0.85
  else if (lowerName.includes('northern gateway')) mainLabelT = 0.85
  else if (lowerName.includes('energy east')) mainLabelT = 0.85
  else if (lowerName.includes('coastal gaslink')) mainLabelT = 0.85
  else if (lowerName.includes('alliance')) mainLabelT = 0.65
  else if (lowerName.includes('ngtl')) mainLabelT = 0.5
  else if (lowerName.includes('brunswick')) mainLabelT = 0.5

  const ptMain = curve.getPoint(mainLabelT)

  const pipeHex = '#' + (pipeline.color & 0xffffff).toString(16).padStart(6, '0')
  // Passed strictly pipeHex without the 'cc' transparent alpha blending suffix using the restored black font
  const lbl = makeLabel([pipeline.name, capStr], { fontSize: 72, width: 900, height: 360, bgColor: pipeHex, textColor: '#000000' })
  lbl.position.set(ptMain.x, 0.22, ptMain.z)
  lbl.scale.set(0.85, 0.32, 1)
  lbl.userData = { clickType: 'pipeline', pipelineData: pipeline }
  group.add(lbl)

  const totalLen = curve.getLength()
  // Adjust label count intelligently based on 3D map run length (3D units are ~1.0 for huge distances)
  const labelCount = Math.min(Math.max(Math.floor(totalLen / 0.4), 1), 4) 
  for (let li = 1; li <= labelCount; li++) {
    let t = li / (labelCount + 1)
    
    const pt = curve.getPoint(t)
    const tangent = curve.getTangent(t)
    
    // Explicitly stagger the exact rendering ticks of TMX so it doesn't horizontally collide with the parallel original line
    if (pipeline.name === 'TMX') t += 0.06

    let dx = tangent.x
    let dz = tangent.z
    
    // Core cartographic rule engine: 
    // If the pipeline is steep, firmly force reading Top-To-Bottom (Southward).
    // If it is mostly horizontal, firmly force reading Left-To-Right (Eastward).
    let flip = false
    if (Math.abs(dz) > Math.abs(dx)) {
        if (dz < 0) flip = true // Must read Top-to-Bottom (+Z)
    } else {
        if (dx < 0) flip = true // Must read Left-to-Right (+X)
    }
    
    if (flip) {
        dx = -dx
        dz = -dz
    }
    const rotY = Math.atan2(-dz, dx)

    const nameLbl = makePipeNameLabel(pipeline.name, pipeline.color)
    nameLbl.rotation.order = 'YXZ'
    nameLbl.rotation.y = rotY
    // Physically sit directly over the pipe, just a tiny bit higher so it isn't struck through
    nameLbl.position.set(pt.x, 0.09, pt.z)
    nameLbl.scale.set(0.275, 0.06, 1)
    nameLbl.userData = { clickType: 'pipeline', pipelineData: pipeline }
    group.add(nameLbl)
  }
}

function buildOperationalPipelines() {
  if (!T || !mapGroup) return
  oilPipelineGroup = new T.Group()
  oilPipelineGroup.name = 'OilPipelines'
  oilPipelineGroup.visible = layerState.oilPipelines
  gasPipelineGroup = new T.Group()
  gasPipelineGroup.name = 'GasPipelines'
  gasPipelineGroup.visible = layerState.gasPipelines

  const pipelines = getOperationalPipelines()
  for (const pipeline of pipelines) {
    try {
      let isGas = pipeline.product === 'gas'
      if (pipeline.name.toLowerCase().includes('alliance')) isGas = true
      
      if (!isGas && (pipeline.product === 'oil' || pipeline.product === 'ngl' || pipeline.product === 'mixed')) {
        addPipelineToGroup(pipeline, oilPipelineGroup)
      } else {
        addPipelineToGroup(pipeline, gasPipelineGroup)
      }
    } catch (e) {
      console.warn(`[Energy Atlas] Pipeline ${pipeline.name} error:`, e)
    }
  }
  mapGroup.add(oilPipelineGroup)
  mapGroup.add(gasPipelineGroup)
}

// ══════════════════════════════════════════
// CANCELLED PIPELINE ROUTES
// ══════════════════════════════════════════

function buildCancelledPipelines() {
  if (!T || !mapGroup) return
  cancelledPipelineGroup = new T.Group()
  cancelledPipelineGroup.name = 'CancelledPipelines'
  cancelledPipelineGroup.visible = layerState.cancelledPipelines
  const pipelines = getCancelledPipelines()
  const colors = [0xff4444, 0xff8844, 0xffaa44]

  pipelines.forEach((pipeline, i) => {
    try {
      const points = pipeline.route.map(([lat, lng]: [number, number]) => {
        const [x, z] = geoToWorld(lat, lng)
        // Dropped to 0.06 exactly matching operational geometry so the 0.09-height pipe tags perfectly render cleanly on top
        return new T.Vector3(x, 0.06, z)
      })
      const curve = new T.CatmullRomCurve3(points)
      const geom = new T.TubeGeometry(curve, Math.max(points.length * 4, 20), 0.012, 8, false)
      const mat = new T.MeshStandardMaterial({
        color: colors[i % colors.length], emissive: new T.Color(colors[i % colors.length]),
        emissiveIntensity: 0.8, transparent: true, opacity: 0.9,
        emissiveMap: flowTexture ? flowTexture.clone() : null,
      })
      if (mat.emissiveMap) {
        const totalLenForTex = curve.getLength()
        mat.emissiveMap.repeat.set(totalLenForTex * 15, 1)
        
        const rawBpd = pipeline.capacity_bpd || 300000
        const velocity = Math.max(0.005, (rawBpd / 1000000.0) * 0.015)
        
        flowTextures.push({ map: mat.emissiveMap, velocity })
      }
      const mesh = new T.Mesh(geom, mat)
      mesh.userData = { clickType: 'cancelledPipeline', cancelledData: pipeline }
      cancelledPipelineGroup.add(mesh)

      // Endpoint markers
      for (const coord of [pipeline.route[0], pipeline.route[pipeline.route.length - 1]]) {
        const [x, z] = geoToWorld(coord[0], coord[1])
        const sphere = new T.Mesh(
          new T.SphereGeometry(0.02, 12, 12),
          new T.MeshStandardMaterial({ color: colors[i % colors.length], emissive: new T.Color(colors[i % colors.length]), emissiveIntensity: 0.4 })
        )
        sphere.position.set(x, 0.08, z)
        cancelledPipelineGroup.add(sphere)
      }

      let mainLabelT = 0.2
      const lowerName = pipeline.name.toLowerCase()
      if (lowerName.includes('keystone')) mainLabelT = 0.85
      else if (lowerName.includes('northern gateway')) mainLabelT = 0.85
      else if (lowerName.includes('energy east')) mainLabelT = 0.85
      
      const ptMain = curve.getPoint(mainLabelT)
      const cancelHex = '#' + (colors[i % colors.length] & 0xffffff).toString(16).padStart(6, '0')
      const compYear = simState.completionYears[pipeline.name] || 2018
      const lbl = makeLabel(
        [`${pipeline.name} (${compYear})`, `${(pipeline.capacity_bpd / 1000).toFixed(0)}k bpd`],
        { fontSize: 62, subFsMultiplier: 0.95, bgColor: cancelHex + 'cc', textColor: '#000000', subTextColor: '#000000', width: 900, height: 360 }
      )
      lbl.position.set(ptMain.x, 0.26, ptMain.z)
      lbl.scale.set(0.90, 0.32, 1)
      lbl.userData = { clickType: 'cancelledPipeline', cancelledData: pipeline }
      cancelledPipelineGroup.add(lbl)

      // Distribute labels along the cancelled pipe with a generous physical spacing gap to prevent zigzag overlaps
      const totalLen = curve.getLength()
      const labelCount = Math.min(Math.max(Math.floor(totalLen / 0.7), 1), 3)
      for (let li = 1; li <= labelCount; li++) {
        const t = li / (labelCount + 1)

        const pt = curve.getPoint(t)
        const tangent = curve.getTangent(t)
        
        let dx = tangent.x
        let dz = tangent.z

        let flip = false
        if (Math.abs(dz) > Math.abs(dx)) {
            if (dz < 0) flip = true
        } else {
            if (dx < 0) flip = true
        }

        if (flip) {
            dx = -dx
            dz = -dz
        }
        let rotY = Math.atan2(-dz, dx)

        const nameLbl = makePipeNameLabel(pipeline.name, colors[i % colors.length])
        nameLbl.rotation.order = 'YXZ'
        nameLbl.rotation.y = rotY
        nameLbl.position.set(pt.x, 0.09, pt.z)
        nameLbl.scale.set(0.25, 0.055, 1) // 50% of the previous 0.50/0.11
        nameLbl.userData = { clickType: 'cancelledPipeline', cancelledData: pipeline }
        cancelledPipelineGroup.add(nameLbl)
      }
    } catch (e) { }
  })
  mapGroup.add(cancelledPipelineGroup)
}

// ══════════════════════════════════════════
// SEDIMENTARY BASINS
// ══════════════════════════════════════════

function buildBasins() {
  if (!T || !mapGroup) return
  basinGroup = new T.Group()
  basinGroup.name = 'SedimentaryBasins'
  basinGroup.visible = layerState.basins

  for (const basin of BASINS) {
    try {
      for (const ring of basin.coordinates) {
        const shape = new T.Shape()
        if (ring.length < 3) continue
        const [px0, pz0] = geoToWorld(ring[0][1], ring[0][0])
        shape.moveTo(px0, -pz0)
        for (let i = 1; i < ring.length; i++) {
          const [px, pz] = geoToWorld(ring[i][1], ring[i][0])
          shape.lineTo(px, -pz)
        }
        
        // Extremely shallow depth so it sits like a painted layer on the map surface
        const geometry = new T.ExtrudeGeometry(shape, { depth: 0.005, bevelEnabled: false })
        const material = new T.MeshStandardMaterial({
          color: basin.color, metalness: 0.2, roughness: 0.7,
          transparent: true, opacity: basin.opacity,
        })
        const mesh = new T.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.y = 0.051 // Just slightly above the province geometry to prevent z-fighting

        let cx = 0, cz = 0
        ring.forEach((pt: number[]) => {
           const [wrtdX, wrtdZ] = geoToWorld(pt[1], pt[0])
           cx += wrtdX
           cz += wrtdZ
        })
        cx /= ring.length
        cz /= ring.length

        const lbl = makeFlatText(basin.name, { fontSize: 85, color: '#ffffff', width: 1024, height: 160, opacity: 1.0, addDepth: true })
        lbl.rotation.order = 'YXZ'
        lbl.rotation.x = -Math.PI / 2
        lbl.position.set(cx, 0.08, cz) // Sit well above the polygon to prevent any z-fighting clipping
        lbl.scale.set(1.6, 1.6 * (160/1024), 1) // strictly enforce scaling ratio without distortion

        basinGroup.add(mesh)
        basinGroup.add(lbl)
      }
    } catch (e) {
      console.warn(`[Energy Atlas] Basin ${basin.name} error:`, e)
    }
  }
  mapGroup.add(basinGroup)
}

// ══════════════════════════════════════════
// ELECTRICAL GRID — 3D nodes + arched lines
// ══════════════════════════════════════════

const NODE_COLORS: Record<string, number> = {
  hydro: 0x4488ff, nuclear: 0xffaa00, gas: 0xff6644, coal: 0x666666,
  wind: 0x44ddaa, solar: 0xffdd44, biomass: 0x88aa44,
}

function buildGridOverlay() {
  if (!T || !mapGroup) return
  const { nodes, lines } = getElectricalGridData()
  gridGroup = new T.Group()
  gridGroup.name = 'ElectricalGrid'
  gridGroup.visible = layerState.grid

  for (const node of nodes) {
    try {
      const [x, z] = geoToWorld(node.lat, node.lng)
      const color = NODE_COLORS[node.type] || 0xffffff
      const radius = 0.008 + Math.log10(Math.max(node.capacity_mw, 10)) * 0.006
      const sphere = new T.Mesh(
        new T.SphereGeometry(radius, 10, 10),
        new T.MeshStandardMaterial({ color, emissive: new T.Color(color), emissiveIntensity: 0.4, transparent: true, opacity: 0.9 })
      )
      sphere.position.set(x, 0.15, z)
      sphere.userData = { gridNode: node.name, type: node.type, clickType: 'gridNode', nodeData: node }
      gridGroup.add(sphere)

      if (node.capacity_mw > 2000) {
        const lbl = makeLabel([node.name, `${(node.capacity_mw / 1000).toFixed(1)} GW ${node.type}`], { fontSize: 64, width: 800, height: 300 })
        lbl.position.set(x, 0.28, z)
        lbl.scale.set(0.70, 0.26, 1)
        gridGroup.add(lbl)
      }
    } catch (e) { }
  }

  const interconnects: Record<string, [number, number]> = {
    'Montreal (HQ)': [45.50, -73.57], 'Quebec Interconnect': [46.80, -71.20],
    'Toronto (IESO)': [43.65, -79.38], 'Ontario Interconnect': [46.50, -80.00],
    'Vancouver (BC Hydro)': [49.28, -123.12], 'Manitoba Interconnect': [50.00, -97.00],
    'Saskatchewan Interconnect': [50.50, -105.00], 'Alberta Interconnect': [51.00, -114.00],
    'BC Interconnect': [49.50, -121.00],
  }

  for (const line of lines) {
    try {
      const fromNode = nodes.find(n => n.name === line.from)
      const toNode = nodes.find(n => n.name === line.to)
      const fromPos = fromNode ? [fromNode.lat, fromNode.lng] : interconnects[line.from]
      const toPos = toNode ? [toNode.lat, toNode.lng] : interconnects[line.to]
      if (!fromPos || !toPos) continue
      const [x1, z1] = geoToWorld(fromPos[0], fromPos[1])
      const [x2, z2] = geoToWorld(toPos[0], toPos[1])
      const p1 = new T.Vector3(x1, 0.13, z1)
      const p2 = new T.Vector3(x2, 0.13, z2)
      const mid = new T.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
      mid.y += p1.distanceTo(p2) * 0.15
      const curve = new T.QuadraticBezierCurve3(p1, mid, p2)
      const geom = new T.TubeGeometry(curve, 16, 0.004, 6, false)
      const color = line.voltage_kv > 500 ? 0xffbb44 : 0x44ddaa
      const mat = new T.MeshStandardMaterial({
        color, emissive: new T.Color(color), emissiveIntensity: 0.7,
        transparent: true, opacity: 0.4 + Math.min(line.voltage_kv / 735, 1.0) * 0.5,
      })
      gridGroup.add(new T.Mesh(geom, mat))
    } catch (e) { }
  }
  mapGroup.add(gridGroup)
}

  // Removing Alberta pipelines per user request

// ══════════════════════════════════════════
// PRICE MARKERS — placed at trading hub locations (bigger)
// ══════════════════════════════════════════

let cachedPrices: CommodityPrice[] = []

function buildPriceMarkers() {
  if (!T || !mapGroup) return
  priceMarkerGroup = new T.Group()
  priceMarkerGroup.name = 'PriceMarkers'
  priceMarkerGroup.visible = layerState.prices
  updatePriceMarkerSprites().then(() => {
    // Resolve overlapping price tags (AECO and WCS are very close geographically)
    resolveOverlapsInGroup(priceMarkerGroup)
  })
  mapGroup.add(priceMarkerGroup)
}

async function updatePriceMarkerSprites() {
  if (!T || !priceMarkerGroup) return
  const prices = await fetchCommodityPrices()
  cachedPrices = prices
  const markers = getPriceMarkerLocations()

  while (priceMarkerGroup.children.length > 0) {
    priceMarkerGroup.remove(priceMarkerGroup.children[0])
  }

  for (const marker of markers) {
    const price = prices.find(p => p.symbol === marker.priceKey)
    if (!price) continue
    const [x, z] = geoToWorld(marker.lat, marker.lng)
    const arrow = price.change >= 0 ? '+' : ''
    const changeStr = `${arrow}${price.change.toFixed(2)} (${arrow}${price.changePercent.toFixed(1)}%)`

    // High-res price card (2.5x canvas)
    const canvas = document.createElement('canvas')
    canvas.width = 700
    canvas.height = 350
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 700, 350)

    ctx.fillStyle = 'rgba(5, 10, 25, 0.85)'
    ctx.beginPath()
    ctx.roundRect(8, 8, 684, 334, 16)
    ctx.fill()

    ctx.strokeStyle = price.change >= 0 ? 'rgba(60, 200, 120, 0.6)' : 'rgba(240, 80, 90, 0.6)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(8, 8, 684, 334, 16)
    ctx.stroke()

    ctx.fillStyle = '#7ab3ff'
    ctx.font = '900 56px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(marker.symbol, 350, 70)

    ctx.fillStyle = '#8899aa'
    ctx.font = 'bold 30px Arial, sans-serif'
    ctx.fillText(marker.name, 350, 110)

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 72px Arial, sans-serif'
    ctx.fillText(`$${price.price.toFixed(2)}`, 350, 195)

    ctx.fillStyle = '#667788'
    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.fillText(`${price.currency}/${price.unit}`, 350, 235)

    ctx.fillStyle = price.change >= 0 ? '#3dd884' : '#f05565'
    ctx.font = '900 42px Arial, sans-serif'
    ctx.fillText(changeStr, 350, 300)

    const texture = new T.CanvasTexture(canvas)
    texture.minFilter = T.LinearFilter
    const mat = new T.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide })
    const priceMesh = new T.Mesh(new T.PlaneGeometry(1, 1), mat)
    priceMesh.rotation.x = -Math.PI / 2  // lay flat on map surface
    priceMesh.position.set(x, 0.14, z)
    priceMesh.scale.set(1.10, 0.55, 1)
    priceMesh.renderOrder = 12  // render above provinces and labels
    priceMesh.userData = { clickType: 'price', priceData: price, marker }
    priceMarkerGroup.add(priceMesh)
  }
}

// ══════════════════════════════════════════
// EXPORTS — LNG terminals, refineries, shipping routes with boats
// ══════════════════════════════════════════

const boatObjects: { mesh: any, curve: any, speed: number }[] = []

function buildExportsLayer() {
  if (!T || !mapGroup) return
  exportGroup = new T.Group()
  exportGroup.name = 'ExportsLayer'
  exportGroup.visible = layerState.exports

  const terminals = getExportTerminals()
  const refineries = getRefineries()
  const routes = getExportRoutes()

  // Sub-groups for individual toggle control
  const terminalSubGroup = new T.Group()
  terminalSubGroup.name = 'ExportTerminals'

  // ── Export Terminals — diamond markers ──
  for (const terminal of terminals) {
    const [x, z] = geoToWorld(terminal.lat, terminal.lng)
    const statusColor = terminal.status === 'operational' ? 0x00ff88
      : terminal.status === 'under_construction' ? 0xffcc00 : 0x8888ff
    // Diamond shape (rotated cube)
    const geom = new T.BoxGeometry(0.025, 0.025, 0.025)
    const mat = new T.MeshStandardMaterial({
      color: statusColor, emissive: new T.Color(statusColor),
      emissiveIntensity: 0.5, transparent: true, opacity: 0.9,
    })
    const mesh = new T.Mesh(geom, mat)
    mesh.position.set(x, 0.12, z)
    mesh.rotation.set(Math.PI / 4, 0, Math.PI / 4) // diamond orientation
    mesh.userData = { clickType: 'exportTerminal', terminalData: terminal }
    terminalSubGroup.add(mesh)

    // Label
    const statusStr = terminal.status === 'operational' ? 'ACTIVE'
      : terminal.status === 'under_construction' ? 'BUILDING' : 'PROPOSED'
    const lbl = makeLabel([terminal.name, `${terminal.type.toUpperCase()} — ${statusStr}`], {
      fontSize: 60, width: 900, height: 320,
      bgColor: terminal.type === 'lng' ? 'rgba(0,200,180,0.85)' : 'rgba(200,120,40,0.85)',
      textColor: '#000000',
    })
    lbl.position.set(x, 0.28, z)
    lbl.scale.set(0.75, 0.28, 1)
    lbl.userData = { clickType: 'exportTerminal', terminalData: terminal }
    terminalSubGroup.add(lbl)
  }
  exportGroup.add(terminalSubGroup)

  // ── Refineries — cylinder markers ──
  const refinerySubGroup = new T.Group()
  refinerySubGroup.name = 'ExportRefineries'
  for (const refinery of refineries) {
    const [x, z] = geoToWorld(refinery.lat, refinery.lng)
    const geom = new T.CylinderGeometry(0.012, 0.015, 0.04, 8)
    const mat = new T.MeshStandardMaterial({
      color: 0xff8844, emissive: new T.Color(0xff6622),
      emissiveIntensity: 0.4, transparent: true, opacity: 0.9,
    })
    const mesh = new T.Mesh(geom, mat)
    mesh.position.set(x, 0.10, z)
    mesh.userData = { clickType: 'refinery', refineryData: refinery }
    refinerySubGroup.add(mesh)

    // Label for large refineries
    if (refinery.capacity_bpd > 100_000) {
      const capStr = `${(refinery.capacity_bpd / 1000).toFixed(0)}k bpd`
      const lbl = makeLabel([refinery.name, capStr], {
        fontSize: 54, width: 800, height: 280,
        bgColor: 'rgba(200,100,30,0.8)', textColor: '#000000',
      })
      lbl.position.set(x, 0.22, z)
      lbl.scale.set(0.65, 0.24, 1)
      lbl.userData = { clickType: 'refinery', refineryData: refinery }
      refinerySubGroup.add(lbl)
    }
  }
  exportGroup.add(refinerySubGroup)

  // ── Export Routes — BIG directional arrows + animated ships ──
  const routeSubGroup = new T.Group()
  routeSubGroup.name = 'ExportRoutes'
  const boatSubGroup = new T.Group()
  boatSubGroup.name = 'ExportBoats'

  // Helper: create a big flat arrow pointing from origin in the travel direction
  function buildRouteArrow(route: ExportRoute, isImport: boolean) {
    const [x1, z1] = geoToWorld(route.from_lat, route.from_lng)

    // Determine direction vector toward destination
    let destLng = route.to_lng
    if (destLng > 0 && route.from_lng < -120) destLng -= 360  // west coast → Asia goes west
    const [x2, z2] = geoToWorld(route.to_lat, destLng)
    const dx = x2 - x1, dz = z2 - z1
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len < 0.01) return

    // Normalized direction
    const dirX = dx / len, dirZ = dz / len
    const angle = Math.atan2(dirX, dirZ)  // rotation around Y axis

    // Big arrow shape — stays near the coast, points outward
    const arrowLen = 0.6  // length in world units
    const arrowWidth = 0.18
    const headLen = 0.25
    const headWidth = 0.35

    const arrowShape = new T.Shape()
    // Shaft (pointing up in local space, along +Y of shape, which becomes +Z after rotation)
    arrowShape.moveTo(-arrowWidth / 2, 0)
    arrowShape.lineTo(-arrowWidth / 2, arrowLen - headLen)
    // Arrow head
    arrowShape.lineTo(-headWidth / 2, arrowLen - headLen)
    arrowShape.lineTo(0, arrowLen)
    arrowShape.lineTo(headWidth / 2, arrowLen - headLen)
    arrowShape.lineTo(arrowWidth / 2, arrowLen - headLen)
    arrowShape.lineTo(arrowWidth / 2, 0)
    arrowShape.lineTo(-arrowWidth / 2, 0)

    const arrowGeom = new T.ShapeGeometry(arrowShape)
    const arrowMat = new T.MeshBasicMaterial({
      color: route.color, transparent: true, opacity: isImport ? 0.25 : 0.35,
      side: T.DoubleSide, depthWrite: false,
    })
    const arrowMesh = new T.Mesh(arrowGeom, arrowMat)
    // Lay flat then rotate to point in travel direction
    arrowMesh.rotation.order = 'YXZ'
    arrowMesh.rotation.x = -Math.PI / 2  // lay flat
    arrowMesh.rotation.y = -angle  // point toward destination
    // Position: start from the coast, offset slightly outward
    const offsetDist = 0.05
    arrowMesh.position.set(x1 + dirX * offsetDist, 0.07, z1 + dirZ * offsetDist)
    arrowMesh.userData = { clickType: 'exportRoute', routeData: route }
    routeSubGroup.add(arrowMesh)

    // Label on the arrow
    const labelText = isImport
      ? `← ${route.product} from ${route.from}`
      : `${route.product} → ${route.to_region}`
    const lbl = makePipeNameLabel(labelText, route.color)
    const lblDist = 0.15
    lbl.position.set(x1 + dirX * lblDist, 0.10, z1 + dirZ * lblDist)
    lbl.scale.set(0.45, 0.09, 1)
    routeSubGroup.add(lbl)

    // Animated ship — larger and visible
    const boatGeom = new T.BoxGeometry(0.05, 0.015, 0.025)
    const boatMat = new T.MeshStandardMaterial({
      color: 0xeeeeee, emissive: new T.Color(route.color), emissiveIntensity: 0.4,
      transparent: true, opacity: 1.0,
    })
    const boat = new T.Mesh(boatGeom, boatMat)
    boat.position.set(x1, 0.06, z1)
    boat.userData = { _fadeOnDistance: true, _originX: x1, _originZ: z1 }
    boatSubGroup.add(boat)

    // Create a short travel path (stays near coast, ~1 world unit)
    const travelLen = Math.min(len, 1.5)
    const endX = x1 + dirX * travelLen, endZ = z1 + dirZ * travelLen
    const p1 = new T.Vector3(x1, 0.06, z1)
    const p2 = new T.Vector3(endX, 0.06, endZ)
    const curve = new T.QuadraticBezierCurve3(
      p1,
      new T.Vector3((x1 + endX) / 2, 0.07, (z1 + endZ) / 2),
      p2
    )
    boatObjects.push({ mesh: boat, curve, speed: 0.08 + Math.random() * 0.06 })
  }

  for (const route of routes) { buildRouteArrow(route, false) }
  // Also show import flows
  const imports = getImportFlows()
  for (const imp of imports) { buildRouteArrow(imp, true) }

  exportGroup.add(routeSubGroup)
  exportGroup.add(boatSubGroup)

  // Resolve label overlaps within each sub-group
  resolveOverlapsInGroup(terminalSubGroup)
  resolveOverlapsInGroup(refinerySubGroup)
  resolveOverlapsInGroup(routeSubGroup)

  mapGroup.add(exportGroup)
}

// Animate boat positions along their curves
let boatTime = 0
function animateBoats() {
  if (!exportGroup || !exportGroup.visible) return
  boatTime += 0.002
  for (const { mesh, curve, speed } of boatObjects) {
    const t = ((boatTime * speed) % 1)
    const pt = curve.getPoint(t)
    mesh.position.copy(pt)
    // Orient boat along travel direction
    const tangent = curve.getTangent(t)
    if (tangent.lengthSq() > 0.0001) {
      mesh.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), tangent.normalize())
    }
    // Fade boat based on distance from origin
    if (mesh.userData?._fadeOnDistance) {
      const ox = mesh.userData._originX, oz = mesh.userData._originZ
      const dist = Math.sqrt((pt.x - ox) ** 2 + (pt.z - oz) ** 2)
      const fadeStart = 0.3, fadeEnd = 1.2
      const alpha = dist < fadeStart ? 1.0 : Math.max(0, 1.0 - (dist - fadeStart) / (fadeEnd - fadeStart))
      if (mesh.material) mesh.material.opacity = alpha
    }
  }
}

// ══════════════════════════════════════════
// CLICK-TO-DETAIL — Raycasting + detail panel
// ══════════════════════════════════════════

function setupClickHandler() {
  if (!T) return
  const raycaster = new T.Raycaster()
  const mouse = new T.Vector2()

  const onClick = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('#ea-drawer, #ea-panel-left, #ea-panel-right, #ea-hamburger-left, #ea-hamburger-right, #ea-title, #ea-detail')) return
    if (!mapGroup || !mapGroup.visible) return

    // Dynamically fetch the active camera to ensure we don't use a stale reference
    const currentCam = world?.three?.activeCamera
    if (!currentCam) return

    // Bulletproof coordinate mapping respecting actual canvas styling/bounds
    const canvas = world?.three?.renderer?.domElement || document.querySelector('canvas')
    let cw = window.innerWidth, ch = window.innerHeight, offsetX = 0, offsetY = 0
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      cw = rect.width; ch = rect.height
      offsetX = rect.left; offsetY = rect.top
    }
    const ndcX = ((e.clientX - offsetX) / cw) * 2 - 1
    const ndcY = -((e.clientY - offsetY) / ch) * 2 + 1

    mouse.set(ndcX, ndcY)
    raycaster.setFromCamera(mouse, currentCam)

    // Raycast hit marker for debugging (visual feedback of exactly where the ray hits)
    if (!(window as any)._eaDebugHit) {
      const dbgMat = new T.MeshBasicMaterial({ color: 0xff0000, depthTest: false })
      const dbgMesh = new T.Mesh(new T.SphereGeometry(0.015, 8, 8), dbgMat)
      dbgMesh.renderOrder = 9999
      world?.three?.scene?.add(dbgMesh)
        ; (window as any)._eaDebugHit = dbgMesh
    }

    // Collect clickable meshes from a group (recursive)
    const collectMeshes = (group: any, out: any[]) => {
      if (!group || !group.visible) return
      group.children.forEach((child: any) => {
        if (child.isGroup && child.visible) { collectMeshes(child, out); return }
        if (child.isMesh && child.visible && child.userData?.clickType) out.push(child)
      })
    }

    // Check which overlay layers are actually visible
    const hasActiveOverlays =
      oilPipelineGroup?.visible || gasPipelineGroup?.visible ||
      cancelledPipelineGroup?.visible || gridGroup?.visible ||
      exportGroup?.visible || priceMarkerGroup?.visible

    if (hasActiveOverlays) {
      // ── ONLY active/visible overlay layers respond to clicks ──
      // Province polygons are NOT clickable when any overlay is active
      const layerMeshes: any[] = []
      if (oilPipelineGroup?.visible) collectMeshes(oilPipelineGroup, layerMeshes)
      if (gasPipelineGroup?.visible) collectMeshes(gasPipelineGroup, layerMeshes)
      if (cancelledPipelineGroup?.visible) collectMeshes(cancelledPipelineGroup, layerMeshes)
      if (gridGroup?.visible) collectMeshes(gridGroup, layerMeshes)
      if (exportGroup?.visible) collectMeshes(exportGroup, layerMeshes)
      if (priceMarkerGroup?.visible) {
        priceMarkerGroup.children.forEach((child: any) => {
          if (child.isMesh && child.userData?.clickType) layerMeshes.push(child)
        })
      }

      if (layerMeshes.length > 0) {
        const hits = raycaster.intersectObjects(layerMeshes, false)
        if (hits.length > 0) {
          const hitObj = hits[0].object
          const hitPt = hits[0].point
          if (hitObj.userData?.clickType === 'price' && hitObj.userData?.priceData) {
            showPriceDetail(hitObj.userData.priceData, hitObj.userData.marker)
          } else if (hitObj.userData?.clickType) {
            handleObjectClick(hitObj, hitPt)
          }
        } else {
          closeDetailPanel()
        }
      } else {
        closeDetailPanel()
      }
      // No fallthrough — overlays block province clicks entirely
      return
    }

    // ── No overlay layers active → province/region polygons are clickable ──
    const mapMeshes: any[] = []
    if (mapGroup) {
      mapGroup.children.forEach((child: any) => {
        if (child.isMesh && child.userData?.clickType === 'province') {
          mapMeshes.push(child)
        }
        if (child.isGroup) {
          child.children.forEach((regionChild: any) => {
            if (regionChild.isMesh && regionChild.userData?.clickType === 'region') {
              mapMeshes.push(regionChild)
            }
          })
        }
      })
    }
    // Label group intentionally omitted from mapMeshes so clicks pass through to province polygons

    if (mapMeshes.length > 0) {
      const mapHits = raycaster.intersectObjects(mapMeshes, false)
      if (mapHits.length > 0) {
        const hitObj = mapHits[0].object
        const hitPt = mapHits[0].point



        if ((window as any)._eaDebugHit) {
          (window as any)._eaDebugHit.position.copy(hitPt)
          console.log(`[Raycast] Hit: ${hitObj.userData?.provinceCode} at`, hitPt)
        }
        if (hitObj.userData?.clickType === 'province' && hitObj.userData?.province) {
          showProvinceDetail(hitObj.userData.province)
          return
        }

        if (hitObj.userData?.clickType === 'region' && hitObj.userData?.region) {
          showRegionDetail(hitObj.userData.region)
          return
        }
      }
    }

    // Hit empty space (water)
    closeDetailPanel()
  }

  // Track drag distance to distinguish clicks from drags
  let downX = 0, downY = 0
  window.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY })
  window.addEventListener('pointerup', (e) => {
    const dist = Math.sqrt((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2)
    if (dist < 10) onClick(e)
  })
}

function handleObjectClick(obj: any, hitPt?: any) {
  const data = obj.userData
  if (!data?.clickType) return

  if (data.clickType === 'pipeline' && data.pipelineData) {
    showPipelineDetail(data.pipelineData)
    zoomToPipeline(data.pipelineData, hitPt)
  } else if (data.clickType === 'cancelledPipeline' && data.cancelledData) {
    showCancelledPipelineDetail(data.cancelledData)
    zoomToPipeline(data.cancelledData, hitPt)
  } else if (data.clickType === 'province' && data.province) {
    showProvinceDetail(data.province)
    if (data.centroid) focusOnPoint(data.centroid[0], data.centroid[1], 1.8)
  } else if (data.clickType === 'provinceLabel' && data.province) {
    showProvinceDetail(data.province)
    if (data.centroid) focusOnPoint(data.centroid[0], data.centroid[1], 1.8)
  } else if (data.clickType === 'exportTerminal' && data.terminalData) {
    showExportTerminalDetail(data.terminalData)
  } else if (data.clickType === 'refinery' && data.refineryData) {
    showRefineryDetail(data.refineryData)
  } else if (data.clickType === 'price' && data.priceData) {
    showPriceDetail(data.priceData, data.marker)
  } else if (data.clickType === 'region' && data.region) {
    showRegionDetail(data.region)
  }
}

function focusOnPoint(cx: number, cz: number, targetScale: number = 2.0) {
  if (!mapGroup || !T || !world?.three?.activeCamera) return

  const localCenter = new T.Vector3(cx, 0, cz)

  // Find where a point slightly above center intersects the map plane
  // Offsetting Y to 0.15 targets a comfortable sweet spot above the UI drawer popup
  const currentCam = world.three.activeCamera
  const raycaster = new T.Raycaster()
  raycaster.setFromCamera(new T.Vector2(0, 0.15), currentCam)

  const normal = new T.Vector3(0, 1, 0).applyQuaternion(mapGroup.quaternion).normalize()
  const plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, mapGroup.position)

  const screenCenterWorld = new T.Vector3()
  raycaster.ray.intersectPlane(plane, screenCenterWorld)

  // If no intersection (looking away), fallback to current map position
  if (screenCenterWorld.lengthSq() === 0) screenCenterWorld.copy(mapGroup.position)

  // Desired mapGroup position: so that `localCenter` scaled & rotated ends up exactly at `screenCenterWorld`
  const offset = localCenter.clone().applyQuaternion(mapGroup.quaternion).multiplyScalar(targetScale)
  const targetPos = screenCenterWorld.clone().sub(offset)

  const startPos = mapGroup.position.clone()
  const startScale = mapGroup.scale.x
  const startT = Date.now()
  const duration = 500

  if ((mapGroup as any)._animFrame) cancelAnimationFrame((mapGroup as any)._animFrame)

  function animate() {
    const t = Math.min((Date.now() - startT) / duration, 1)
    const ease = t * (2 - t) // ease-out

    const s = startScale + (targetScale - startScale) * ease
    mapGroup.scale.set(s, s, s)

    mapGroup.position.lerpVectors(startPos, targetPos, ease)

    if (t < 1) {
      (mapGroup as any)._animFrame = requestAnimationFrame(animate)
    }
  }
  animate()
}

function zoomToPipeline(pipeline: any, hitPt?: any) {
  if (hitPt && mapGroup && T) {
    const localPt = mapGroup.worldToLocal(hitPt.clone())
    // Ensure we actually zoom in by checking current scale, capping it to reasonable macro
    const tz = Math.min(Math.max(mapGroup.scale.x * 1.4, 2.6), 4.0)
    focusOnPoint(localPt.x, localPt.z, tz)
    return
  }

  const route = pipeline.route
  let sumX = 0, sumZ = 0
  for (const [lat, lng] of route) {
    const [x, z] = geoToWorld(lat, lng)
    sumX += x; sumZ += z
  }
  focusOnPoint(sumX / route.length, sumZ / route.length, 2.0)
}

// ══════════════════════════════════════════
// DETAIL PANEL — Shows when clicking objects
// ══════════════════════════════════════════

let detailPanel: HTMLElement | null = null
let detailActiveTab = 'overview'

function ensureDetailPanel(): HTMLElement {
  if (detailPanel) return detailPanel
  detailPanel = document.createElement('div')
  detailPanel.id = 'ea-detail'
  document.body.appendChild(detailPanel)
  return detailPanel
}

function closeDetailPanel() {
  if (detailPanel) {
    detailPanel.classList.remove('open')
    setTimeout(() => { if (detailPanel) detailPanel.innerHTML = '' }, 300)
  }
}

function generateYoutubeHtml(videos?: { title: string, url: string }[]): string {
  if (!videos || videos.length === 0) return ''
  const links = videos.map(v => `<a href="${v.url}" target="_blank" style="display:flex;align-items:center;gap:4px;color:#ff4444;text-decoration:none;margin-bottom:4px;"><span style="background:#ff4444;color:white;padding:1px 4px;border-radius:3px;font-size:8px;font-weight:900;">YT</span> ${v.title}</a>`).join('')
  return `<div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);font-size:10px;">
    <div style="color:#d0d8e0;margin-bottom:6px;font-weight:bold;">Related Videos</div>
    ${links}
  </div>`
}

function showPipelineDetail(pipeline: OperationalPipeline) {
  const panel = ensureDetailPanel()
  detailActiveTab = 'overview'
  renderPipelineDetailContent(pipeline, panel)
  setTimeout(() => panel.classList.add('open'), 10)
}

function renderPipelineDetailContent(pipeline: OperationalPipeline, panel: HTMLElement) {
  const capStr = pipeline.capacity_bpd
    ? `${(pipeline.capacity_bpd / 1000).toFixed(0)}k bpd`
    : `${pipeline.capacity_bcfd?.toFixed(1)} Bcf/d`

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'specs', label: 'Specifications' },
    { id: 'history', label: 'Price History' },
  ]

  let tabContent = ''
  if (detailActiveTab === 'overview') {
    tabContent = `
      <div style="font-size:12px;color:#d0d8e0;line-height:1.5;margin-bottom:8px;">${pipeline.summary || 'No summary available.'}</div>
      <div style="font-size:10px;color:#667788;">
        <a href="${pipeline.source_url}" target="_blank" style="color:#5599dd;text-decoration:none;">Learn more →</a>
      </div>
      ${generateYoutubeHtml(pipeline.youtube_videos)}`
  } else if (detailActiveTab === 'specs') {
    tabContent = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div class="spec-item"><span class="spec-lbl">Capacity</span><span class="spec-val">${capStr}</span></div>
        <div class="spec-item"><span class="spec-lbl">Diameter</span><span class="spec-val">${pipeline.diameter_inches}"</span></div>
        <div class="spec-item"><span class="spec-lbl">Length</span><span class="spec-val">${pipeline.length_km.toLocaleString()} km</span></div>
        <div class="spec-item"><span class="spec-lbl">Operator</span><span class="spec-val">${pipeline.operator}</span></div>
        <div class="spec-item"><span class="spec-lbl">Product</span><span class="spec-val">${pipeline.product.toUpperCase()}</span></div>
        <div class="spec-item"><span class="spec-lbl">Built</span><span class="spec-val">${pipeline.year_built}</span></div>
      </div>`
  } else if (detailActiveTab === 'history') {
    const pricing = getHistoricalPricing()
    const maxWti = Math.max(...pricing.map(p => p.wti_usd))
    const bars = pricing.map(p => {
      const pct = (p.wti_usd / maxWti) * 100
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;">
        <div style="width:100%;height:${pct}%;background:${pipeline.product === 'oil' ? '#44aa88' : '#4488ff'};border-radius:1px 1px 0 0;min-height:1px;"></div>
        <div style="font-size:7px;color:#556677;">${String(p.year).slice(2)}</div>
      </div>`
    }).join('')
    tabContent = `
      <div style="font-size:10px;color:#8899aa;margin-bottom:4px;">WTI Price History (USD/bbl)</div>
      <div style="display:flex;align-items:flex-end;height:60px;gap:1px;margin-bottom:4px;">${bars}</div>
      <div style="font-size:9px;color:#556677;text-align:center;">
        <a href="https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm" target="_blank" style="color:#5599dd;text-decoration:none;">Source: US EIA</a>
      </div>`
  }

  panel.innerHTML = `
    <div class="detail-hdr">
      <div>
        <div class="detail-name">${pipeline.name}</div>
        <div class="detail-sub">${capStr} &middot; ${pipeline.operator} &middot; ${pipeline.product}</div>
      </div>
      <button class="drawer-close" id="detail-close">&times;</button>
    </div>
    <div class="detail-tabs">
      ${tabs.map(t => `<button class="dtab ${detailActiveTab === t.id ? 'active' : ''}" data-dtab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div class="detail-body">${tabContent}</div>`

  panel.querySelector('#detail-close')?.addEventListener('click', closeDetailPanel)
  panel.querySelectorAll('.dtab').forEach(btn => {
    btn.addEventListener('click', () => {
      detailActiveTab = (btn as HTMLElement).dataset.dtab || 'overview'
      renderPipelineDetailContent(pipeline, panel)
    })
  })
}

function showCancelledPipelineDetail(pipeline: PipelineProject) {
  const panel = ensureDetailPanel()
  detailActiveTab = 'overview'

  const compYear = simState.completionYears[pipeline.name] || 2018
  const sim = runPipelineSimulation({ pipeline, completionYear: compYear, utilizationPercent: simState.utilizationPercent })

  const maxRev = Math.max(...sim.yearlyBreakdown.map(y => y.revenue_cad))
  const revBars = sim.yearlyBreakdown.map(y => {
    const pct = maxRev > 0 ? (y.revenue_cad / maxRev) * 100 : 0
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;">
      <div style="width:100%;height:${pct}%;background:#ff6655;border-radius:1px 1px 0 0;min-height:1px;"></div>
      <div style="font-size:7px;color:#556677;">${String(y.year).slice(2)}</div>
    </div>`
  }).join('')

  panel.innerHTML = `
    <div class="detail-hdr">
      <div>
        <div class="detail-name" style="color:#ff8888;">${pipeline.name} (CANCELLED)</div>
        <div class="detail-sub">${pipeline.capacity_bpd.toLocaleString()} bpd &middot; ${pipeline.origin} → ${pipeline.destination}</div>
      </div>
      <button class="drawer-close" id="detail-close">&times;</button>
    </div>
    <div class="detail-body">
      <div style="font-size:12px;color:#d0d8e0;line-height:1.5;margin-bottom:8px;">${pipeline.summary || pipeline.cancellation_reason || ''}</div>
      <div style="background:rgba(255,40,40,0.06);border:1px solid rgba(255,70,70,0.15);border-radius:7px;padding:8px;margin:8px 0;">
        <div class="pipe-lbl">Lost Revenue (${compYear}–2025, historical prices)</div>
        <div class="pipe-rev" style="font-size:18px;">${fmtCurrency(sim.total_revenue_cad)} CAD</div>
        <div style="font-size:10px;color:#8899aa;margin-top:2px;">
          Royalties: ${fmtCurrency(sim.total_royalties_cad)} &middot; Tax: ${fmtCurrency(sim.total_taxes_cad)}<br>
          Jobs: ${sim.jobs_construction.toLocaleString()} construction + ${sim.jobs_created.toLocaleString()} permanent
        </div>
      </div>
      <div style="font-size:10px;color:#8899aa;margin-bottom:4px;">Estimated Revenue by Year</div>
      <div style="display:flex;align-items:flex-end;height:60px;gap:1px;margin-bottom:4px;">${revBars}</div>
      <div style="font-size:10px;color:#667788;margin-top:6px;">
        Cancelled: <strong>${pipeline.cancellation_year}</strong><br>
        <em style="color:#776655;">${pipeline.cancellation_reason}</em>
      </div>
      ${pipeline.source_url ? `<div style="margin-top:6px;"><a href="${pipeline.source_url}" target="_blank" style="color:#5599dd;font-size:10px;text-decoration:none;">Learn more →</a></div>` : ''}
      ${generateYoutubeHtml(pipeline.youtube_videos)}
    </div>`

  panel.querySelector('#detail-close')?.addEventListener('click', closeDetailPanel)
  setTimeout(() => panel.classList.add('open'), 10)
}

function showProvinceDetail(province: ProvinceData) {
  const panel = ensureDetailPanel()

  panel.innerHTML = `
    <div class="detail-hdr">
      <div>
        <div class="detail-name">${province.name}</div>
        <div class="detail-sub">${province.primary_energy_source} &middot; Pop. ${(province.population / 1_000_000).toFixed(1)}M</div>
      </div>
      <button class="drawer-close" id="detail-close">&times;</button>
    </div>
    <div class="detail-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div class="spec-item"><span class="spec-lbl">Oil Production</span><span class="spec-val">${province.oil_production_bpd > 0 ? (province.oil_production_bpd / 1000).toFixed(0) + 'k bpd' : 'None'}</span></div>
        <div class="spec-item"><span class="spec-lbl">Gas Production</span><span class="spec-val">${province.gas_production_mcfd > 0 ? (province.gas_production_mcfd / 1000).toFixed(0) + 'k mcf/d' : 'None'}</span></div>
        <div class="spec-item"><span class="spec-lbl">Coal Production</span><span class="spec-val">${province.coal_production_tpd > 0 ? province.coal_production_tpd.toLocaleString() + ' t/d' : 'None'}</span></div>
        <div class="spec-item"><span class="spec-lbl">Primary Source</span><span class="spec-val">${province.primary_energy_source}</span></div>
      </div>
    </div>`

  panel.querySelector('#detail-close')?.addEventListener('click', closeDetailPanel)
  setTimeout(() => panel.classList.add('open'), 10)
}

function showRegionDetail(regionName: string) {
  const panel = ensureDetailPanel()
  const regionData: Record<string, { desc: string, oil: string, gas: string, pop: string }> = {
    'United States': {
      desc: 'The contiguous United States is the world\'s largest oil and gas producer, with major basins in Texas (Permian), North Dakota (Bakken), and the Gulf of Mexico. A key trading partner and destination for Canadian energy exports.',
      oil: '12.9M bpd', gas: '103 Bcf/d', pop: '332M',
    },
    'Alaska': {
      desc: 'Alaska produces approximately 430,000 bpd from the North Slope via the Trans-Alaska Pipeline System (TAPS). Home to vast Arctic reserves and the Prudhoe Bay field.',
      oil: '430k bpd', gas: '0.3 Bcf/d', pop: '733k',
    },
    'Mexico': {
      desc: 'Mexico is a significant oil producer with major offshore fields in the Gulf of Mexico (Cantarell, Ku-Maloob-Zaap). State oil company Pemex operates most production. Growing natural gas imports from the US.',
      oil: '1.9M bpd', gas: '4.5 Bcf/d', pop: '130M',
    },
  }
  const data = regionData[regionName] || { desc: regionName, oil: 'N/A', gas: 'N/A', pop: 'N/A' }

  panel.innerHTML = `
    <div class="detail-hdr">
      <div>
        <div class="detail-name">${regionName}</div>
        <div class="detail-sub">Context Region</div>
      </div>
      <button class="drawer-close" id="detail-close">&times;</button>
    </div>
    <div class="detail-body">
      <div style="font-size:12px;color:#d0d8e0;line-height:1.5;margin-bottom:8px;">${data.desc}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div class="spec-item"><span class="spec-lbl">Oil Production</span><span class="spec-val">${data.oil}</span></div>
        <div class="spec-item"><span class="spec-lbl">Gas Production</span><span class="spec-val">${data.gas}</span></div>
        <div class="spec-item"><span class="spec-lbl">Population</span><span class="spec-val">${data.pop}</span></div>
      </div>
    </div>`

  panel.querySelector('#detail-close')?.addEventListener('click', closeDetailPanel)
  setTimeout(() => panel.classList.add('open'), 10)
}

function showExportTerminalDetail(terminal: ExportTerminal) {
  const panel = ensureDetailPanel()
  const statusLabel = terminal.status === 'operational' ? 'Operational'
    : terminal.status === 'under_construction' ? 'Under Construction' : 'Proposed'
  const statusColor = terminal.status === 'operational' ? '#3dd884'
    : terminal.status === 'under_construction' ? '#ffcc44' : '#8888ff'

  panel.innerHTML = `
    <div class="detail-hdr">
      <div>
        <div class="detail-name">${terminal.name}</div>
        <div class="detail-sub">${terminal.type.toUpperCase()} Terminal &middot; <span style="color:${statusColor}">${statusLabel}</span></div>
      </div>
      <button class="drawer-close" id="detail-close">&times;</button>
    </div>
    <div class="detail-body">
      <div style="font-size:12px;color:#d0d8e0;line-height:1.5;margin-bottom:8px;">${terminal.summary}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div class="spec-item"><span class="spec-lbl">Capacity</span><span class="spec-val">${terminal.capacity_description}</span></div>
        <div class="spec-item"><span class="spec-lbl">Operator</span><span class="spec-val">${terminal.operator}</span></div>
        <div class="spec-item"><span class="spec-lbl">Destinations</span><span class="spec-val">${terminal.destination_regions.join(', ')}</span></div>
        <div class="spec-item"><span class="spec-lbl">Status</span><span class="spec-val" style="color:${statusColor}">${statusLabel}</span></div>
      </div>
      <div style="font-size:10px;"><a href="${terminal.source_url}" target="_blank" style="color:#5599dd;text-decoration:none;">Learn more →</a></div>
      ${generateYoutubeHtml(terminal.youtube_videos)}
    </div>`

  panel.querySelector('#detail-close')?.addEventListener('click', closeDetailPanel)
  setTimeout(() => panel.classList.add('open'), 10)
}

function showRefineryDetail(refinery: RefineryFacility) {
  const panel = ensureDetailPanel()

  panel.innerHTML = `
    <div class="detail-hdr">
      <div>
        <div class="detail-name">${refinery.name}</div>
        <div class="detail-sub">${refinery.type.charAt(0).toUpperCase() + refinery.type.slice(1)} &middot; ${refinery.operator}</div>
      </div>
      <button class="drawer-close" id="detail-close">&times;</button>
    </div>
    <div class="detail-body">
      <div style="font-size:12px;color:#d0d8e0;line-height:1.5;margin-bottom:8px;">${refinery.summary}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div class="spec-item"><span class="spec-lbl">Capacity</span><span class="spec-val">${(refinery.capacity_bpd / 1000).toFixed(0)}k bpd</span></div>
        <div class="spec-item"><span class="spec-lbl">Type</span><span class="spec-val">${refinery.type}</span></div>
        <div class="spec-item"><span class="spec-lbl">Products</span><span class="spec-val">${refinery.products.join(', ')}</span></div>
        <div class="spec-item"><span class="spec-lbl">Operator</span><span class="spec-val">${refinery.operator}</span></div>
      </div>
      <div style="font-size:10px;"><a href="${refinery.source_url}" target="_blank" style="color:#5599dd;text-decoration:none;">Learn more →</a></div>
      ${generateYoutubeHtml(refinery.youtube_videos)}
    </div>`

  panel.querySelector('#detail-close')?.addEventListener('click', closeDetailPanel)
  setTimeout(() => panel.classList.add('open'), 10)
}

function showPriceDetail(price: CommodityPrice, marker: any) {
  const panel = ensureDetailPanel()
  const pricing = getHistoricalPricing()
  const arrow = price.change >= 0 ? '▲' : '▼'
  const changeColor = price.change >= 0 ? '#3dd884' : '#f05565'

  // Time period options
  const periods = [
    { label: 'All', years: 100 },
    { label: '10Y', years: 10 },
    { label: '5Y', years: 5 },
    { label: '2Y', years: 2 },
  ]

  function renderPriceChart(periodYears: number) {
    const currentYear = 2025
    const filtered = pricing.filter(p => p.year >= currentYear - periodYears)
    if (filtered.length === 0) return ''

    // For oil-related commodities, show WTI; for gas-related, show a gas proxy
    const isGas = ['HH', 'DAWN', 'AECO'].includes(price.symbol)
    const maxVal = Math.max(...filtered.map(p => p.wti_usd))
    const bars = filtered.map(p => {
      const val = p.wti_usd
      const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
      const barColor = isGas ? '#00ccff' : '#44aa88'
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;">
        <div style="font-size:7px;color:#8899aa;">$${val.toFixed(0)}</div>
        <div style="width:100%;height:${pct}%;background:${barColor};border-radius:2px 2px 0 0;min-height:2px;"></div>
        <div style="font-size:7px;color:#556677;">${String(p.year).slice(2)}</div>
      </div>`
    }).join('')
    return bars
  }

  const initialBars = renderPriceChart(100)

  panel.innerHTML = `
    <div class="detail-hdr">
      <div>
        <div class="detail-name">${price.name} (${price.symbol})</div>
        <div class="detail-sub">${marker?.name || ''} &middot; ${price.currency}/${price.unit}</div>
      </div>
      <button class="drawer-close" id="detail-close">&times;</button>
    </div>
    <div class="detail-body">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px;">
        <div style="font-size:28px;font-weight:900;color:#ffffff;">$${price.price.toFixed(2)}</div>
        <div style="font-size:14px;font-weight:700;color:${changeColor};">${arrow} ${Math.abs(price.change).toFixed(2)} (${price.changePercent > 0 ? '+' : ''}${price.changePercent.toFixed(1)}%)</div>
      </div>
      <div style="margin-bottom:6px;">
        <div style="display:flex;gap:4px;margin-bottom:8px;" id="price-period-btns">
          ${periods.map(p => `<button class="dtab ${p.years === 100 ? 'active' : ''}" data-period="${p.years}" style="flex:1;">${p.label}</button>`).join('')}
        </div>
        <div style="font-size:10px;color:#8899aa;margin-bottom:4px;">Historical WTI Price (USD/bbl)</div>
        <div style="display:flex;align-items:flex-end;height:80px;gap:1px;" id="price-chart-bars">${initialBars}</div>
      </div>
      <div style="font-size:9px;color:#556677;margin-top:6px;">
        <a href="https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm" target="_blank" style="color:#5599dd;text-decoration:none;">Source: US EIA</a> &middot;
        <a href="https://www.ngx.com" target="_blank" style="color:#5599dd;text-decoration:none;">NGX</a>
      </div>
    </div>`

  // Wire up period buttons
  panel.querySelectorAll('#price-period-btns .dtab').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('#price-period-btns .dtab').forEach((b: any) => b.classList.remove('active'))
      btn.classList.add('active')
      const years = parseInt(btn.dataset.period)
      const barsEl = panel.querySelector('#price-chart-bars')
      if (barsEl) barsEl.innerHTML = renderPriceChart(years)
    })
  })

  panel.querySelector('#detail-close')?.addEventListener('click', closeDetailPanel)
  setTimeout(() => panel.classList.add('open'), 10)
}

// ══════════════════════════════════════════
// HTML UI — Layer toggles + detail drawer
// ══════════════════════════════════════════

type DrawerId = 'news' | 'history' | 'simulation' | 'cancelled' | 'sources'
let activeDrawer: DrawerId | null = null

function injectUI() {
  if (document.getElementById('ea-styles')) return
  const style = document.createElement('style')
  style.id = 'ea-styles'
  style.textContent = `
    * { box-sizing: border-box; touch-action: manipulation; }

    /* ── Title — auto-fades after 30s, click to re-show ── */
    #ea-title {
      position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
      background: rgba(8,12,24,0.82); backdrop-filter: blur(10px);
      border-radius: 8px; border: 1px solid rgba(80,140,255,0.2);
      padding: 5px 16px; pointer-events: all; z-index: 1000; text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 1; transition: opacity 1.5s ease-out; cursor: pointer;
    }
    #ea-title.faded { opacity: 0; pointer-events: none; }
    #ea-title h1 { font-size: 12px; font-weight: 700; color: #7ab3ff; margin: 0; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap; }

    /* ── Hamburger toggle buttons ── */
    .ea-hamburger {
      position: fixed; top: 10px; z-index: 1010;
      height: 32px; border-radius: 6px; padding: 0 12px;
      background: rgba(20,30,50,0.9); border: 1px solid rgba(100,180,255,0.3);
      display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 8px;
      cursor: pointer; pointer-events: all;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #8ac4ff; font-weight: 700; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
    }
    .ea-hamburger span { display: block; width: 16px; height: 2px; background: #8ac4ff; border-radius: 1px; }
    #ea-hamburger-left { left: 10px; }
    #ea-hamburger-right { right: 10px; }

    /* ── LEFT panel — Layer categories ── */
    #ea-panel-left {
      position: fixed; top: 48px; left: 10px;
      display: flex; flex-direction: column; gap: 4px;
      pointer-events: all; z-index: 1005;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.2s ease-out, opacity 0.2s;
    }
    #ea-panel-left.collapsed { transform: translateX(-120%); opacity: 0; pointer-events: none; }

    /* ── RIGHT panel — Sub-options/info ── */
    #ea-panel-right {
      position: fixed; top: 48px; right: 10px;
      display: flex; flex-direction: column; gap: 4px;
      pointer-events: all; z-index: 1005;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.2s ease-out, opacity 0.2s;
    }
    #ea-panel-right.collapsed { transform: translateX(120%); opacity: 0; pointer-events: none; }

    /* ── Bright layer buttons with black text ── */
    .layer-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; background: rgba(220,235,255,0.92); backdrop-filter: blur(8px);
      border: 1px solid rgba(60,130,220,0.4); border-radius: 7px;
      color: #111; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit;
      transition: all 0.15s; white-space: nowrap; user-select: none;
    }
    .layer-btn:hover { background: rgba(200,225,255,1); }
    .layer-btn.active { background: rgba(80,180,255,0.95); border-color: rgba(40,120,240,0.6); color: #000; box-shadow: 0 1px 6px rgba(60,140,255,0.3); }
    .layer-btn.inactive { background: rgba(50,60,80,0.8); color: #8899aa; border-color: rgba(60,80,120,0.3); }
    .layer-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.2); }

    /* ── Drawer ── */
    #ea-drawer {
      position: fixed; bottom: 0; left: 0; right: 0;
      max-height: 45vh; overflow-y: auto;
      background: rgba(8,12,24,0.93); backdrop-filter: blur(14px);
      border-top: 1px solid rgba(80,140,255,0.18);
      border-radius: 14px 14px 0 0;
      pointer-events: all; z-index: 1015;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #d8e2ee;
      transform: translateY(100%); transition: transform 0.25s ease-out;
      scrollbar-width: thin; scrollbar-color: rgba(80,140,255,0.2) transparent;
    }
    #ea-drawer.open { transform: translateY(0); }
    #ea-drawer-inner { padding: 12px 14px 18px; }
    .drawer-handle { width: 32px; height: 4px; background: rgba(100,150,220,0.25); border-radius: 2px; margin: 6px auto 2px; }
    .drawer-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(80,140,255,0.1); position: sticky; top: -12px; background: rgba(12,18,35,0.98); z-index: 10; padding-top: 12px; margin-top: -12px; }
    .drawer-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #7ab3ff; }
    .drawer-close { background: rgba(20,30,50,0.85); border: 1px solid rgba(80,140,255,0.2); color: #aabbcc; font-size: 20px; cursor: pointer; padding: 2px 8px; font-family: inherit; border-radius: 50%; position: sticky; top: 0; z-index: 10; min-width: 28px; min-height: 28px; display: flex; align-items: center; justify-content: center; }
    .drawer-close:hover { color: #ff6666; background: rgba(255,60,60,0.15); }

    /* Detail panel */
    #ea-detail {
      position: fixed; bottom: 0; left: 0; right: 0;
      max-height: 55vh; overflow-y: auto;
      background: rgba(8,12,24,0.95); backdrop-filter: blur(16px);
      border-top: 1px solid rgba(80,140,255,0.25);
      border-radius: 14px 14px 0 0;
      pointer-events: all; z-index: 1025;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #d8e2ee; padding: 12px 14px 18px;
      transform: translateY(100%); transition: transform 0.25s ease-out;
    }
    #ea-detail.open { transform: translateY(0); }
    .detail-hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(80,140,255,0.12); position: sticky; top: -12px; background: rgba(8,12,24,0.98); z-index: 10; padding-top: 12px; margin-top: -12px; }
    .detail-name { font-size: 15px; font-weight: 700; color: #7ab3ff; }
    .detail-sub { font-size: 10px; color: #667788; margin-top: 2px; }
    .detail-tabs { display: flex; gap: 3px; margin-bottom: 8px; }
    .dtab { display: inline-block; padding: 4px 10px; background: transparent; border: 1px solid rgba(80,140,255,0.12); border-radius: 5px; color: #6688aa; font-size: 10px; cursor: pointer; font-family: inherit; transition: all 0.12s; }
    .dtab.active { background: rgba(50,110,230,0.2); border-color: rgba(80,140,255,0.35); color: #fff; }
    .detail-body { }
    .spec-item { background: rgba(30,50,80,0.3); border-radius: 5px; padding: 6px 8px; }
    .spec-lbl { display: block; font-size: 9px; color: #667788; text-transform: uppercase; letter-spacing: 0.5px; }
    .spec-val { display: block; font-size: 13px; font-weight: 600; color: #d0d8e0; margin-top: 2px; }

    .news-item { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
    .news-item:last-child { border-bottom: none; }
    .n-title { font-size: 12px; font-weight: 500; color: #d0d8e0; margin-bottom: 2px; line-height: 1.3; }
    .n-meta { font-size: 10px; color: #556677; }
    .pipe-card { background: rgba(255,40,40,0.06); border: 1px solid rgba(255,70,70,0.15); border-radius: 7px; padding: 9px; margin-bottom: 7px; }
    .pipe-name { font-size: 13px; font-weight: 600; color: #ff8888; margin-bottom: 2px; }
    .pipe-det { font-size: 11px; color: #8899aa; line-height: 1.4; }
    .pipe-rev { font-size: 15px; font-weight: 700; color: #ff6060; margin-top: 4px; }
    .pipe-lbl { font-size: 10px; color: #778; text-transform: uppercase; letter-spacing: 0.5px; }
    .hist-bars { display: flex; align-items: flex-end; gap: 2px; height: 55px; margin-bottom: 4px; }
    .ctrl-group { margin-bottom: 10px; }
    .ctrl-lbl { display: flex; justify-content: space-between; font-size: 11px; color: #7788aa; margin-bottom: 3px; }
    .ctrl-val { color: #aabbdd; font-weight: 600; }
    input[type="range"] { width: 100%; height: 4px; -webkit-appearance: none; appearance: none; background: rgba(80,140,255,0.18); border-radius: 2px; outline: none; }
    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: #4488ff; cursor: pointer; border: 2px solid #fff; }
    .sel-btn { display: inline-block; padding: 3px 9px; background: transparent; border: 1px solid rgba(80,140,255,0.12); border-radius: 5px; color: #6688aa; font-size: 10px; cursor: pointer; font-family: inherit; transition: all 0.12s; }
    .sel-btn.active { background: rgba(50,110,230,0.2); border-color: rgba(80,140,255,0.35); color: #fff; }
    .src-cat { font-size: 11px; font-weight: 600; color: #7ab3ff; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .src-cat:first-child { margin-top: 0; }
    .src-item { padding: 4px 0; font-size: 11px; }
    .src-item a { color: #5599dd; text-decoration: none; }
    .src-item a:hover { text-decoration: underline; }
    .src-desc { color: #667788; font-size: 10px; margin-top: 1px; }

    #ea-place-btn {
      position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
      background: rgba(220, 100, 40, 0.95); color: #fff; border: 2px solid rgba(255, 150, 80, 0.8);
      padding: 14px 32px; border-radius: 24px; font-weight: 700; font-size: 15px; text-transform: uppercase;
      letter-spacing: 1px; cursor: not-allowed; pointer-events: none; opacity: 1;
      transition: all 0.3s ease; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    #ea-place-btn.visible { 
      background: rgba(80, 140, 255, 0.9); color: #fff; border: 1px solid rgba(120, 180, 255, 0.8);
      pointer-events: auto; cursor: pointer;
    }
    #ea-place-btn:hover { background: rgba(100, 160, 255, 1); transform: translateX(-50%) scale(1.05); }

    #ea-orientation-btn {
      position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
      background: rgba(40, 40, 40, 0.9); color: #fff; border: 1px solid rgba(100, 100, 100, 0.8);
      padding: 10px 20px; border-radius: 20px; font-weight: 600; font-size: 13px; text-transform: uppercase;
      letter-spacing: 1px; cursor: pointer; pointer-events: auto; opacity: 1;
      transition: all 0.3s ease; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    #ea-orientation-btn:hover { background: rgba(60, 60, 60, 1); transform: translateX(-50%) scale(1.05); }

    @media (min-width: 768px) {
      #ea-drawer, #ea-detail { left: 50%; right: auto; width: 600px; transform: translateX(-50%) translateY(100%); }
      #ea-drawer.open, #ea-detail.open { transform: translateX(-50%) translateY(0); }
      #ea-panel-left { left: 30px; top: 60px; }
      #ea-panel-right { right: 30px; top: 60px; }
      #ea-hamburger-left { left: 30px; top: 20px; }
      #ea-hamburger-right { right: 30px; top: 20px; }
    }
  `
  document.head.appendChild(style)

  // ── Place Button ──
  const placeBtn = document.createElement('button')
  placeBtn.id = 'ea-place-btn'
  placeBtn.innerText = 'WAITING FOR SURFACE...'
  document.body.appendChild(placeBtn)

  // ── Orientation Button ──
  const orientationBtn = document.createElement('button')
  orientationBtn.id = 'ea-orientation-btn'
  orientationBtn.innerText = 'MODE: FLOOR'
  ;(window as any).currentOrientationMode = 'floor'
  orientationBtn.addEventListener('click', (e) => {
    e.preventDefault()
    ;(window as any).currentOrientationMode = (window as any).currentOrientationMode === 'floor' ? 'wall' : 'floor'
    orientationBtn.innerText = `MODE: ${(window as any).currentOrientationMode.toUpperCase()}`
  })
  document.body.appendChild(orientationBtn)

  // ── Title with auto-fade ──
  const title = document.createElement('div')
  title.id = 'ea-title'
  title.innerHTML = '<h1>Canada Energy Atlas</h1>'
  document.body.appendChild(title)
  // Fade after 30 seconds
  let titleFadeTimer: any = setTimeout(() => title.classList.add('faded'), 30000)
  // Click anywhere to re-show, then re-fade
  document.addEventListener('click', (e) => {
    if (title.classList.contains('faded')) {
      title.classList.remove('faded')
      clearTimeout(titleFadeTimer)
      titleFadeTimer = setTimeout(() => title.classList.add('faded'), 8000)
    }
  })

  // ── LEFT hamburger ──
  const hLeft = document.createElement('div')
  hLeft.id = 'ea-hamburger-left'
  hLeft.className = 'ea-hamburger'
  hLeft.innerHTML = '<div style="display:flex;flex-direction:column;gap:3px"><span></span><span></span><span></span></div> LAYERS'
  hLeft.onclick = () => document.getElementById('ea-panel-left')?.classList.toggle('collapsed')
  document.body.appendChild(hLeft)

  // ── RIGHT hamburger ──
  const hRight = document.createElement('div')
  hRight.id = 'ea-hamburger-right'
  hRight.className = 'ea-hamburger'
  hRight.innerHTML = 'DATA <div style="display:flex;flex-direction:column;gap:3px"><span></span><span></span><span></span></div>'
  hRight.onclick = () => document.getElementById('ea-panel-right')?.classList.toggle('collapsed')
  document.body.appendChild(hRight)

  // ── LEFT panel — Category radio buttons ──
  const leftPanel = document.createElement('div')
  leftPanel.id = 'ea-panel-left'
  type CategoryId = 'oil' | 'gas' | 'electricity' | 'exports' | 'overview'
  const categories: { id: CategoryId, label: string, color: string }[] = [
    { id: 'overview', label: 'Overview', color: '#88bbff' },
    { id: 'oil', label: 'Oil', color: '#ff8844' },
    { id: 'gas', label: 'Natural Gas', color: '#44ccff' },
    { id: 'electricity', label: 'Electricity', color: '#ffaa44' },
    { id: 'exports', label: 'Exports', color: '#00ffcc' },
  ]
  let activeCategory: CategoryId = 'overview'

  function renderLeftPanel() {
    leftPanel.innerHTML = ''
    for (const cat of categories) {
      const btn = document.createElement('button')
      btn.className = `layer-btn ${activeCategory === cat.id ? 'active' : 'inactive'}`
      btn.innerHTML = `<span class="layer-dot" style="background:${cat.color};"></span>${cat.label}`
      btn.onclick = () => { activeCategory = cat.id; renderLeftPanel(); renderRightPanel(); applyCategory() }
      leftPanel.appendChild(btn)
    }
  }
  renderLeftPanel()
  document.body.appendChild(leftPanel)

  // ── RIGHT panel — Sub-options for the selected category ──
  const rightPanel = document.createElement('div')
  rightPanel.id = 'ea-panel-right'

  // Sub-layer state (toggles within categories) — top option ON by default, rest OFF
  const subLayers: Record<string, boolean> = {
    oilPipelines: true, oilRefineries: false, oilCancelled: false,
    gasPipelines: true, lngTerminals: false,
    electricalGrid: true, priceMarkers: false,
    exportTerminals: true, exportRoutes: false, exportBoats: false,
    provinceLabels: false,
    usRegion: true, mexRegion: false,
    basins: false,
  }

  function renderRightPanel() {
    rightPanel.innerHTML = ''
    type SubItem = { key: string, label: string, color: string }
    let items: SubItem[] = []
    let infoTabs: { id: DrawerId, label: string }[] = []

    if (activeCategory === 'overview') {
      items = [
        { key: 'priceMarkers', label: 'Market Prices', color: '#3dd884' },
        { key: 'usRegion', label: 'United States', color: '#4a7c59' },
        { key: 'mexRegion', label: 'Mexico', color: '#ed8936' },
      ]
      infoTabs = [
        { id: 'history', label: 'Historical Data' },
        { id: 'sources', label: 'Data Sources' },
      ]
    } else if (activeCategory === 'oil') {
      items = [
        { key: 'oilPipelines', label: 'Pipelines', color: '#ff6622' },
        { key: 'oilRefineries', label: 'Refineries', color: '#ff8844' },
        { key: 'oilCancelled', label: 'Cancelled Projects', color: '#ff4444' },
        { key: 'basins', label: 'Sedimentary Basins', color: '#8b5a2b' },
      ]
      infoTabs = [
        { id: 'cancelled', label: 'What-If Analysis' },
        { id: 'simulation', label: 'Simulation' },
      ]
    } else if (activeCategory === 'gas') {
      items = [
        { key: 'gasPipelines', label: 'Pipelines', color: '#00ccff' },
        { key: 'lngTerminals', label: 'LNG Terminals', color: '#00ffcc' },
        { key: 'basins', label: 'Sedimentary Basins', color: '#8b5a2b' },
      ]
      infoTabs = [
        { id: 'sources', label: 'Data Sources' },
      ]
    } else if (activeCategory === 'electricity') {
      items = [
        { key: 'electricalGrid', label: 'Electrical Grid', color: '#ffaa44' },
      ]
      infoTabs = [
        { id: 'history', label: 'Historical Data' },
      ]
    } else if (activeCategory === 'exports') {
      items = [
        { key: 'exportTerminals', label: 'Export Terminals', color: '#00ffcc' },
        { key: 'exportRoutes', label: 'Shipping Routes', color: '#44aaff' },
        { key: 'exportBoats', label: 'Active Vessels', color: '#dddddd' },
      ]
      infoTabs = [
        { id: 'sources', label: 'Data Sources' },
      ]
    }

    // Sub-layer toggle buttons
    for (const item of items) {
      if (item.key === 'usRegion') {
        const sep = document.createElement('div')
        sep.style.cssText = 'height:1px;background:rgba(100,150,220,0.2);margin:4px 0;'
        rightPanel.appendChild(sep)
      }
      const btn = document.createElement('button')
      btn.className = `layer-btn ${subLayers[item.key] ? 'active' : 'inactive'}`
      btn.innerHTML = `<span class="layer-dot" style="background:${item.color};"></span>${item.label}`
      btn.onclick = () => { subLayers[item.key] = !subLayers[item.key]; renderRightPanel(); applyCategory() }
      rightPanel.appendChild(btn)
    }

    // Info/drawer tabs
    if (infoTabs.length > 0) {
      const sep = document.createElement('div')
      sep.style.cssText = 'height:1px;background:rgba(100,150,220,0.2);margin:4px 0;'
      rightPanel.appendChild(sep)
      for (const tab of infoTabs) {
        const btn = document.createElement('button')
        btn.className = `layer-btn ${activeDrawer === tab.id ? 'active' : 'inactive'}`
        btn.dataset.rtab = tab.id
        btn.innerHTML = `<span class="layer-dot" style="background:#667788;"></span>${tab.label}`
        btn.onclick = () => { closeDetailPanel(); openDrawer(tab.id) }
        rightPanel.appendChild(btn)
      }
    }
  }
  renderRightPanel()
  document.body.appendChild(rightPanel)

  // Apply category → toggle 3D layer visibility based on active category + sub-layers
  function applyCategory() {
    // Pipelines: show oil or gas pipelines based on category
    if (oilPipelineGroup) {
      oilPipelineGroup.visible = (activeCategory === 'oil' && subLayers.oilPipelines)
    }
    if (gasPipelineGroup) {
      gasPipelineGroup.visible = (activeCategory === 'gas' && subLayers.gasPipelines)
    }
    // Cancelled pipelines are ALL oil — only show under oil category
    if (cancelledPipelineGroup) {
      cancelledPipelineGroup.visible = (activeCategory === 'oil' && subLayers.oilCancelled)
    }
    if (gridGroup) gridGroup.visible = (activeCategory === 'electricity' && subLayers.electricalGrid)
    if (priceMarkerGroup) priceMarkerGroup.visible = (activeCategory === 'overview' && subLayers.priceMarkers)
    // Province names always show in overview mode; optional in other modes
    if (labelGroup) labelGroup.visible = (activeCategory === 'overview')

    // Basins: show if either oil or gas is active and the toggle is on
    if (basinGroup) {
      basinGroup.visible = ((activeCategory === 'oil' || activeCategory === 'gas') && subLayers.basins)
    }

    // Exports: visible when exports category, OR when gas shows LNG, OR oil shows refineries
    const showExports = (activeCategory === 'exports')
    const showLngFromGas = (activeCategory === 'gas' && subLayers.lngTerminals)
    const showRefFromOil = (activeCategory === 'oil' && subLayers.oilRefineries)
    if (exportGroup) {
      exportGroup.visible = showExports || showLngFromGas || showRefFromOil
      // Toggle sub-groups within exportGroup
      exportGroup.children.forEach((child: any) => {
        if (child.name === 'ExportTerminals') {
          child.visible = (showExports && subLayers.exportTerminals) || showLngFromGas
        }
        if (child.name === 'ExportRefineries') {
          child.visible = (showExports && subLayers.exportTerminals) || showRefFromOil
        }
        if (child.name === 'ExportRoutes') child.visible = (showExports && subLayers.exportRoutes)
        if (child.name === 'ExportBoats') child.visible = (showExports && subLayers.exportBoats)
      })
    }

    if (mapGroup && mapGroup.children) {
      const contextGroup = mapGroup.children.find((c: any) => c.name === 'ContextShapes')
      if (contextGroup) {
        contextGroup.children.forEach((child: any) => {
          if (child.userData?.region === 'United States' || child.userData?.region === 'Alaska') {
            child.visible = subLayers.usRegion
          } else if (child.userData?.region === 'Mexico') {
            child.visible = subLayers.mexRegion
          }
        })
      }
    }

    // Update layer state to match (for click handler visibility checks)
    layerState.oilPipelines = oilPipelineGroup?.visible ?? false
    layerState.gasPipelines = gasPipelineGroup?.visible ?? false
    layerState.cancelledPipelines = cancelledPipelineGroup?.visible ?? false
    layerState.grid = gridGroup?.visible ?? false
    layerState.prices = priceMarkerGroup?.visible ?? false
    layerState.labels = labelGroup?.visible ?? false
    layerState.exports = exportGroup?.visible ?? false
  }
  applyCategory()

  // Drawer
  const drawer = document.createElement('div')
  drawer.id = 'ea-drawer'
  drawer.innerHTML = '<div class="drawer-handle"></div><div id="ea-drawer-inner"></div>'
  document.body.appendChild(drawer)

}

function toggleLayer(key: keyof typeof layerState, btn: HTMLElement) {
  layerState[key] = !layerState[key]
  btn.classList.toggle('active', layerState[key])
  btn.classList.toggle('inactive', !layerState[key])
  if (key === 'oilPipelines' && oilPipelineGroup) oilPipelineGroup.visible = layerState.oilPipelines
  if (key === 'gasPipelines' && gasPipelineGroup) gasPipelineGroup.visible = layerState.gasPipelines
  if (key === 'cancelledPipelines' && cancelledPipelineGroup) cancelledPipelineGroup.visible = layerState.cancelledPipelines
  if (key === 'grid' && gridGroup) gridGroup.visible = layerState.grid
  if (key === 'prices' && priceMarkerGroup) priceMarkerGroup.visible = layerState.prices
  if (key === 'labels' && labelGroup) labelGroup.visible = layerState.labels
  if (key === 'exports' && exportGroup) exportGroup.visible = layerState.exports
}

function openDrawer(id: DrawerId) {
  const drawer = document.getElementById('ea-drawer')
  const inner = document.getElementById('ea-drawer-inner')
  if (!drawer || !inner) return

  if (activeDrawer === id) {
    drawer.classList.remove('open')
    activeDrawer = null
    updateTabStates()
    return
  }
  activeDrawer = id
  updateTabStates()

  const titles: Record<DrawerId, string> = {
    news: 'Energy News', cancelled: 'Cancelled Pipelines — What-If',
    history: 'Energy History', simulation: 'Pipeline Simulation', sources: 'Data Sources',
  }
  inner.innerHTML = `<div class="drawer-hdr"><span class="drawer-title">${titles[id]}</span><button class="drawer-close">&times;</button></div><div id="dc"></div>`
  inner.querySelector('.drawer-close')!.addEventListener('click', () => {
    drawer.classList.remove('open')
    activeDrawer = null
    updateTabStates()
  })
  drawer.classList.add('open')

  const fn: Record<DrawerId, () => void> = {
    news: populateNews, cancelled: populateCancelled,
    history: populateHistory, simulation: populateSimulation, sources: populateSources,
  }
  fn[id]()
}

function updateTabStates() {
  // Update right panel info tab buttons
  document.querySelectorAll('[data-rtab]').forEach(btn => {
    const isActive = (btn as HTMLElement).dataset.rtab === activeDrawer
    btn.classList.toggle('active', isActive)
    btn.classList.toggle('inactive', !isActive)
  })
}

// ── NEWS ──
async function populateNews() {
  const el = document.getElementById('dc')
  if (!el) return
  el.innerHTML = '<div style="color:#556677;font-size:11px;">Loading...</div>'
  const news = await fetchEnergyNews()
  el.innerHTML = news.map(item => {
    const ago = getTimeAgo(new Date(item.publishedAt))
    const link = item.url && item.url !== '#' ? `<a href="${item.url}" target="_blank" style="color:#5599dd;font-size:10px;text-decoration:none;margin-left:6px;">Read →</a>` : ''
    return `<div class="news-item">
      <div class="n-title">${item.title}${link}</div>
      <div class="n-meta">${item.source} &middot; ${ago}</div>
      ${item.summary ? `<div style="font-size:10px;color:#778899;margin-top:2px;line-height:1.3;">${item.summary}</div>` : ''}
    </div>`
  }).join('')
}

function getTimeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── CANCELLED PIPELINES (What-If) ──
function populateCancelled() {
  const el = document.getElementById('dc')
  if (!el) return
  if (cancelledPipelineGroup) {
    cancelledPipelineGroup.visible = true
    layerState.cancelledPipelines = true
  }

  const pipelines = getCancelledPipelines()
  let total = 0

  const cards = pipelines.map(p => {
    const completionYear = simState.completionYears[p.name] || 2018
    const sim = runPipelineSimulation({ pipeline: p, completionYear, utilizationPercent: simState.utilizationPercent })
    total += sim.total_revenue_cad
    const yearsActive = sim.endYear - sim.startYear + 1
    return `<div class="pipe-card" style="cursor:pointer;" data-cpipe="${p.name}">
      <div class="pipe-name">${p.name}</div>
      <div class="pipe-det">
        <strong>${p.capacity_bpd.toLocaleString()}</strong> bpd &middot; <strong>${p.length_km.toLocaleString()}</strong> km<br>
        ${p.origin} &rarr; ${p.destination}<br>
        Cancelled: <strong>${p.cancellation_year}</strong> &middot; Could have started: <strong>${completionYear}</strong>
      </div>
      <div class="pipe-lbl">Lost Revenue (${completionYear}–2025, ${yearsActive} yrs)</div>
      <div class="pipe-rev">${fmtCurrency(sim.total_revenue_cad)} CAD</div>
      <div class="pipe-det" style="margin-top:3px;">
        Royalties: ${fmtCurrency(sim.total_royalties_cad)} &middot;
        Tax: ${fmtCurrency(sim.total_taxes_cad)} &middot;
        Jobs: ~${sim.jobs_created.toLocaleString()} + ~${sim.jobs_construction.toLocaleString()} construction
      </div>
      <div style="font-size:9px;color:#5599dd;margin-top:3px;">Tap for full details →</div>
    </div>`
  }).join('')

  el.innerHTML = `${cards}
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,80,80,0.12);">
      <div class="pipe-lbl">Combined Lost Revenue (historical prices, ${simState.utilizationPercent}% utilization)</div>
      <div class="pipe-rev" style="font-size:18px;">${fmtCurrency(total)} CAD</div>
      <div class="pipe-det" style="margin-top:4px;font-size:10px;">
        Using year-by-year WTI averages, WCS differentials, and Bank of Canada exchange rates.
        Adjust in <strong>Simulation</strong> tab.
      </div>
      <div style="margin-top:6px;">
        <a href="https://www.cer-rec.gc.ca/en/data-analysis/facilities-we-regulate/pipeline-profiles/" target="_blank" style="color:#5599dd;font-size:10px;text-decoration:none;">CER Pipeline Profiles</a> &middot;
        <a href="https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm" target="_blank" style="color:#5599dd;font-size:10px;text-decoration:none;">EIA WTI Historical</a> &middot;
        <a href="https://www.bankofcanada.ca/rates/exchange/" target="_blank" style="color:#5599dd;font-size:10px;text-decoration:none;">Bank of Canada FX</a>
      </div>
    </div>`

  // Make cards clickable to show detail
  el.querySelectorAll('[data-cpipe]').forEach(card => {
    card.addEventListener('click', () => {
      const name = (card as HTMLElement).dataset.cpipe
      const p = pipelines.find(pp => pp.name === name)
      if (p) showCancelledPipelineDetail(p)
    })
  })
}

function fmtCurrency(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toLocaleString('en-CA')}`
}

// ── HISTORY ──
let histCountry: 'Canada' | 'United States' = 'Canada'
let histMetric = 'oil'

function populateHistory() {
  const el = document.getElementById('dc')
  if (!el) return
  const allData = getHistoricalData()
  const data = allData.filter(d => d.country === histCountry)
  const metricLabels: Record<string, string> = {
    oil: 'Oil Production',
    gas: 'Natural Gas Production',
    coal: 'Coal Production',
    electricity: 'Electricity Generation',
    renewables: 'Renewable Energy Share',
  }
  const metricDescriptions: Record<string, string> = {
    oil: 'Total daily crude oil & condensate production (million barrels per day)',
    gas: 'Total daily natural gas production (billion cubic feet per day)',
    coal: 'Annual coal production (million tonnes per year)',
    electricity: 'Total annual electricity generation from all sources (terawatt-hours)',
    renewables: 'Percentage of electricity from renewable sources (hydro, wind, solar, biomass)',
  }
  const metrics: Record<string, { key: string, max: number, unit: string, color: string }> = {
    oil: { key: 'oil_production_mbpd', max: Math.max(...allData.map(d => d.oil_production_mbpd)), unit: 'M bpd', color: '#44aa88' },
    gas: { key: 'gas_production_bcfd', max: Math.max(...allData.map(d => d.gas_production_bcfd)), unit: 'Bcf/d', color: '#4488ff' },
    coal: { key: 'coal_production_mt', max: Math.max(...allData.map(d => d.coal_production_mt)), unit: 'Mt/yr', color: '#888' },
    electricity: { key: 'electricity_generation_twh', max: Math.max(...allData.map(d => d.electricity_generation_twh)), unit: 'TWh/yr', color: '#ffaa44' },
    renewables: { key: 'renewable_share_percent', max: 100, unit: '%', color: '#44dd88' },
  }
  const m = metrics[histMetric]
  const latest = (data[data.length - 1] as any)?.[m.key] ?? 0
  const bars = data.map(d => {
    const val = (d as any)[m.key] as number
    const pct = (val / m.max) * 100
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;">
      <div style="font-size:6px;color:#8899aa;">${val < 10 ? val.toFixed(1) : Math.round(val)}</div>
      <div style="width:100%;height:${pct}%;background:${m.color};border-radius:2px 2px 0 0;min-height:2px;"></div>
      <div style="font-size:8px;color:#556677;">${String(d.year).slice(2)}</div>
    </div>`
  }).join('')

  el.innerHTML = `
    <div style="font-size:10px;color:#8899aa;margin-bottom:6px;line-height:1.4;">
      Compare energy production and generation trends for Canada and the US over 55 years.
    </div>
    <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">
      ${['Canada', 'United States'].map(c =>
    `<button class="sel-btn ${histCountry === c ? 'active' : ''}" data-hc="${c}">${c}</button>`
  ).join('')}
    </div>
    <div style="display:flex;gap:3px;margin-bottom:6px;flex-wrap:wrap;">
      ${Object.keys(metrics).map(k =>
    `<button class="sel-btn ${histMetric === k ? 'active' : ''}" data-hm="${k}">${metricLabels[k]}</button>`
  ).join('')}
    </div>
    <div style="text-align:center;margin-bottom:4px;">
      <span style="font-size:18px;font-weight:700;color:${m.color};">${latest < 10 ? latest.toFixed(1) : latest.toFixed(0)}</span>
      <span style="font-size:10px;color:#778899;"> ${m.unit}</span>
    </div>
    <div style="font-size:9px;color:#667788;text-align:center;margin-bottom:4px;">${metricDescriptions[histMetric]}</div>
    <div class="hist-bars">${bars}</div>
    <div style="font-size:9px;color:#556677;text-align:center;margin-top:4px;">
      ${histCountry} (1970–2025) &middot;
      <a href="https://www.eia.gov" target="_blank" style="color:#5599dd;text-decoration:none;">Source: EIA</a> &middot;
      <a href="https://www.nrcan.gc.ca" target="_blank" style="color:#5599dd;text-decoration:none;">NRCan</a>
    </div>`

  el.querySelectorAll('[data-hc]').forEach(btn =>
    btn.addEventListener('click', () => { histCountry = (btn as HTMLElement).dataset.hc as any; populateHistory() })
  )
  el.querySelectorAll('[data-hm]').forEach(btn =>
    btn.addEventListener('click', () => { histMetric = (btn as HTMLElement).dataset.hm!; populateHistory() })
  )
}

// ── SIMULATION ──
function populateSimulation() {
  const el = document.getElementById('dc')
  if (!el) return
  const pipelines = getCancelledPipelines()
  const pricing = getHistoricalPricing()
  const minYear = pricing[0].year
  const maxYear = pricing[pricing.length - 1].year

  const pipelineSliders = pipelines.map(p => {
    const compYear = simState.completionYears[p.name] || 2018
    const sim = runPipelineSimulation({ pipeline: p, completionYear: compYear, utilizationPercent: simState.utilizationPercent })
    const yearsActive = sim.endYear - sim.startYear + 1
    const maxRev = Math.max(...sim.yearlyBreakdown.map(y => y.revenue_cad))
    const miniChart = sim.yearlyBreakdown.map(y => {
      const pct = maxRev > 0 ? (y.revenue_cad / maxRev) * 100 : 0
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;">
        <div style="width:100%;height:${pct}%;background:#ff6655;border-radius:1px 1px 0 0;min-height:1px;"></div>
        <div style="font-size:6px;color:#556677;">${String(y.year).slice(2)}</div>
      </div>`
    }).join('')

    const origYear = ORIGINAL_COMPLETION_YEARS[p.name] || compYear
    return `<div class="pipe-card" style="background:rgba(60,30,30,0.08);border-color:rgba(255,100,80,0.2);">
      <div class="pipe-name" style="font-size:12px;">${p.name}</div>
      <div class="pipe-det" style="font-size:10px;">${p.capacity_bpd.toLocaleString()} bpd &middot; ${p.origin} → ${p.destination}</div>
      <div class="ctrl-group" style="margin:6px 0 2px;">
        <div class="ctrl-lbl"><span>If completed in:</span><span class="ctrl-val" id="cv-yr-${p.name.replace(/\s/g, '')}">${compYear}</span><button id="rst-yr-${p.name.replace(/\s/g, '')}" style="background:none;border:1px solid rgba(80,140,255,0.2);color:#6688aa;font-size:9px;padding:1px 6px;border-radius:4px;cursor:pointer;margin-left:4px;" title="Reset to original planned year (${origYear})">Reset</button></div>
        <input type="range" id="cr-yr-${p.name.replace(/\s/g, '')}" min="${minYear}" max="${maxYear}" step="1" value="${compYear}">
      </div>
      <div style="display:flex;align-items:flex-end;height:35px;gap:1px;margin:4px 0;">${miniChart}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#8899aa;">
        <span>${yearsActive} yrs of revenue</span>
        <span style="color:#ff8866;font-weight:600;">${fmtCurrency(sim.total_revenue_cad)}</span>
      </div>
      <div style="font-size:9px;color:#667788;margin-top:2px;">
        Royalties: ${fmtCurrency(sim.total_royalties_cad)} &middot; Tax: ${fmtCurrency(sim.total_taxes_cad)} &middot;
        ${sim.jobs_construction.toLocaleString()} construction + ${sim.jobs_created.toLocaleString()} permanent jobs
      </div>
    </div>`
  }).join('')

  let combinedTotal = 0, combinedRoyalties = 0, combinedTaxes = 0
  for (const p of pipelines) {
    const sim = runPipelineSimulation({ pipeline: p, completionYear: simState.completionYears[p.name] || 2018, utilizationPercent: simState.utilizationPercent })
    combinedTotal += sim.total_revenue_cad
    combinedRoyalties += sim.total_royalties_cad
    combinedTaxes += sim.total_taxes_cad
  }

  el.innerHTML = `
    <div style="font-size:10px;color:#8899aa;margin-bottom:8px;line-height:1.4;">
      Drag sliders to see what revenue Canada would have earned if each cancelled pipeline had been completed in a given year.
      Uses actual historical WTI prices, WCS differentials, and Bank of Canada exchange rates.
    </div>
    <div class="ctrl-group">
      <div class="ctrl-lbl"><span>Pipeline Utilization</span><span class="ctrl-val" id="cv-util">${simState.utilizationPercent}%</span></div>
      <input type="range" id="cr-util" min="30" max="100" step="1" value="${simState.utilizationPercent}">
    </div>
    ${pipelineSliders}
    <div style="margin-top:8px;padding:8px;border-top:1px solid rgba(255,80,80,0.15);background:rgba(255,40,40,0.04);border-radius:0 0 6px 6px;">
      <div class="pipe-lbl">Combined Lost Opportunity</div>
      <div class="pipe-rev" style="font-size:20px;">${fmtCurrency(combinedTotal)} CAD</div>
      <div style="font-size:10px;color:#8899aa;margin-top:2px;">
        Royalties: ${fmtCurrency(combinedRoyalties)} &middot; Tax Revenue: ${fmtCurrency(combinedTaxes)}
      </div>
    </div>
    <div style="margin-top:8px;padding:8px;border-top:1px solid rgba(60,120,255,0.15);background:rgba(40,80,200,0.04);border-radius:6px;">
      <div class="pipe-lbl">Canadian Federal Debt Context</div>
      <div style="font-size:11px;color:#aabbdd;margin-top:4px;line-height:1.5;">
        Canada's federal debt: <strong style="color:#ff8866;">$1.23 Trillion CAD</strong> (2024)<br>
        Annual deficit: <strong style="color:#ff8866;">~$40B CAD</strong><br>
        Lost revenue from cancelled pipelines represents
        <strong style="color:#ffcc44;">${(combinedTotal / 1.23e12 * 100).toFixed(1)}%</strong> of the federal debt
        and could have covered
        <strong style="color:#ffcc44;">${(combinedTotal / 40e9).toFixed(1)} years</strong> of deficit spending.
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <div style="flex:1;height:12px;background:rgba(255,60,60,0.15);border-radius:6px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(combinedTotal / 1.23e12 * 100, 100).toFixed(1)}%;background:linear-gradient(90deg,#ff6655,#ffaa44);border-radius:6px;"></div>
        </div>
        <span style="font-size:9px;color:#8899aa;">${(combinedTotal / 1.23e12 * 100).toFixed(1)}% of debt</span>
      </div>
      <div style="font-size:9px;color:#556677;margin-top:4px;">
        <a href="https://www.canada.ca/en/department-finance/services/publications/fiscal-reference-tables.html" target="_blank" style="color:#5599dd;text-decoration:none;">Source: Dept. of Finance Canada</a>
      </div>
    </div>
    <div style="margin-top:6px;font-size:9px;color:#556677;">
      <a href="https://www.cer-rec.gc.ca/en/data-analysis/facilities-we-regulate/pipeline-profiles/" target="_blank" style="color:#5599dd;text-decoration:none;">CER Pipeline Profiles</a> &middot;
      <a href="https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm" target="_blank" style="color:#5599dd;text-decoration:none;">EIA WTI Historical</a> &middot;
      <a href="https://www.bankofcanada.ca/rates/exchange/" target="_blank" style="color:#5599dd;text-decoration:none;">Bank of Canada FX</a>
    </div>`

  // LIVE updates: just update the display value while dragging (don't re-render DOM)
  document.getElementById('cr-util')?.addEventListener('input', function () {
    const v = parseInt((this as HTMLInputElement).value)
    document.getElementById('cv-util')!.textContent = `${v}%`
    simState.utilizationPercent = v
  })
  // FULL re-render only on mouse release (change event fires when slider is released)
  document.getElementById('cr-util')?.addEventListener('change', function () {
    simState.utilizationPercent = parseInt((this as HTMLInputElement).value)
    populateSimulation()
  })
  for (const p of pipelines) {
    const id = p.name.replace(/\s/g, '')
    document.getElementById(`cr-yr-${id}`)?.addEventListener('input', function () {
      const v = parseInt((this as HTMLInputElement).value)
      document.getElementById(`cv-yr-${id}`)!.textContent = `${v}`
      simState.completionYears[p.name] = v
    })
    document.getElementById(`cr-yr-${id}`)?.addEventListener('change', function () {
      simState.completionYears[p.name] = parseInt((this as HTMLInputElement).value)
      populateSimulation()
    })
    // Reset button — restore to original planned completion year
    document.getElementById(`rst-yr-${id}`)?.addEventListener('click', () => {
      const origYear = ORIGINAL_COMPLETION_YEARS[p.name]
      if (origYear) {
        simState.completionYears[p.name] = origYear
        populateSimulation()
      }
    })
  }
}

// ── SOURCES ──
function populateSources() {
  const el = document.getElementById('dc')
  if (!el) return
  const sources = getDataSources()
  const byCategory: Record<string, typeof sources> = {}
  for (const s of sources) {
    if (!byCategory[s.category]) byCategory[s.category] = []
    byCategory[s.category].push(s)
  }
  el.innerHTML = Object.entries(byCategory).map(([cat, items]) => `
    <div class="src-cat">${cat}</div>
    ${items.map(s => `
      <div class="src-item">
        <a href="${s.url}" target="_blank">${s.name}</a>
        <div class="src-desc">${s.description}</div>
      </div>
    `).join('')}
  `).join('')
}

// ══════════════════════════════════════════
// BEHAVIOR REGISTRATION (ENTRY POINT)
// ══════════════════════════════════════════

ecs.registerBehavior((w: any) => {
  if (initialized) return
  initialized = true
  world = w
    ; (window as any).__world = w

  try { buildCanadaMap(w.three.scene); (window as any).__mapGroup = mapGroup } catch (e) { console.error('[Energy Atlas] Map build failed:', e) }

  // Setup Flow Animation Texture after T is guaranteed to be hydrated by buildCanadaMap
  try {
    const fc = document.createElement('canvas')
    fc.width = 128
    fc.height = 16
    const fCtx = fc.getContext('2d')!
    const grd = fCtx.createLinearGradient(0, 0, 128, 0)
    grd.addColorStop(0, '#ffffff')     // White head
    grd.addColorStop(0.3, '#dddddd')   // Body
    grd.addColorStop(0.6, '#000000')   // Fade shadow tail
    grd.addColorStop(1, '#000000')     // Black spacer
    fCtx.fillStyle = grd
    fCtx.fillRect(0, 0, 128, 16)
    
    flowTexture = new T.CanvasTexture(fc)
    flowTexture.wrapS = T.RepeatWrapping
    flowTexture.wrapT = T.RepeatWrapping
    flowTexture.repeat.set(50, 1) // Default repeat rate
  } catch (e) { console.error('[Energy Atlas] Flow texture error', e) }

  try { buildContextShapes() } catch (e) { console.error('[Energy Atlas] Context shapes failed:', e) }
  try {
    buildOperationalPipelines()
    buildCancelledPipelines()
    buildGridOverlay()
    buildBasins()
    buildPriceMarkers()
    buildExportsLayer()
  } catch (e) { console.error('[Energy Atlas] Layer build failed:', e) }
  try { resolveAllLabelOverlaps() } catch (e) { console.error('[Energy Atlas] Overlap resolution failed:', e) }
  try { injectUI() } catch (e) { console.error('[Energy Atlas] UI inject failed:', e) }

  // Animation loop for boats and pipelines
  function animationLoop() {
    try {
      animateBoats()
      animateBoats()
    } catch (e) { }
    requestAnimationFrame(animationLoop)
  }
  animationLoop()
})

// Camera placement + controls
ecs.registerBehavior((w: any) => {
  if (!mapGroup || !w.three.activeCamera || mapGroup.userData.initializedControls) return
  mapGroup.userData.initializedControls = true

  const cam = w.three.activeCamera
  
  const isDesktop = !(/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) && navigator.maxTouchPoints <= 1

  let isPlaced = false
  let hasFoundSurfaceEver = false
  let placementReadyTime = 0

  // AR Surface Reticle (White ring for placement)
  const reticleGeom = new T.RingGeometry(0.15, 0.2, 32)
  reticleGeom.rotateX(-Math.PI / 2) // Lay it perfectly flat
  const reticleMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, side: T.DoubleSide })
  const reticle = new T.Mesh(reticleGeom, reticleMat)
  reticle.renderOrder = 999 // Ensure it renders on top
  w.three.scene.add(reticle)
  
  const placeBtn = document.getElementById('ea-place-btn')

  if (isDesktop) {
    isPlaced = true
    reticle.visible = false
    if (placeBtn) placeBtn.style.display = 'none'
    const oBtn = document.getElementById('ea-orientation-btn')
    if (oBtn) oBtn.style.display = 'none'

    const dir = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    mapGroup.position.copy(cam.position).add(dir.multiplyScalar(2.0))
    mapGroup.position.y -= 0.7
    mapGroup.lookAt(cam.position.x, mapGroup.position.y, cam.position.z)
    mapGroup.rotateY(Math.PI)

    mapGroup.userData.originPos = mapGroup.position.clone()

    if (mapGroup.parent !== w.three.scene) w.three.scene.add(mapGroup)
    mapGroup.visible = true
    setupClickHandler()
  } else {
    mapGroup.visible = false

    const updatePlacement = () => {
      if (isPlaced) {
        reticle.visible = false
        return
      }
      
      let hitSuccess = false
      
      if ((window as any).XR8 && (window as any).XR8.XrController) {
        try {
          const HitTypes = (window as any).XR8.XrController.HitTestTypes || {}
          const types = [HitTypes.FEATURE_POINT || 'FEATURE_POINT', HitTypes.ESTIMATED_SURFACE || 'ESTIMATED_SURFACE']
          const hitRes = (window as any).XR8.XrController.hitTest(0.5, 0.5, types)
          if (hitRes && hitRes.length > 0) {
            const hit = hitRes[0]
            const targetPos = new T.Vector3(hit.position.x, hit.position.y, hit.position.z)
            let targetQuat = new T.Quaternion(hit.rotation.x, hit.rotation.y, hit.rotation.z, hit.rotation.w)
            
            let normal = new T.Vector3(0, 1, 0).applyQuaternion(targetQuat)
            
            const worldCamPos = new T.Vector3()
            cam.getWorldPosition(worldCamPos)
            const worldCamQuat = new T.Quaternion()
            cam.getWorldQuaternion(worldCamQuat)
            
            const camLook = new T.Vector3(0, 0, -1).applyQuaternion(worldCamQuat)
            const mode = (window as any).currentOrientationMode || 'floor'

            if (mode === 'wall') {
               normal.set(camLook.x, 0, camLook.z).normalize()
            } else {
               normal.set(0, 1, 0)
            }
            if (normal.lengthSq() < 0.001) normal.set(0, 1, 0)
            
            const yAxis = normal.clone().normalize()
            let zRef = new T.Vector3()
            if (mode === 'floor') {
               zRef.set(worldCamPos.x - hit.position.x, 0, worldCamPos.z - hit.position.z).normalize()
               if (zRef.lengthSq() < 0.001) zRef.set(0, 0, 1)
            } else {
               zRef.set(0, -1, 0)
            }
            
            let zAxis = zRef.projectOnPlane(normal).normalize()
            if (zAxis.lengthSq() < 0.001) zAxis.set(0, 0, 1)
            
            const xAxis = new T.Vector3().crossVectors(yAxis, zAxis).normalize()
            if (xAxis.lengthSq() < 0.001) xAxis.set(1, 0, 0)
            zAxis.crossVectors(xAxis, yAxis).normalize()
            
            targetQuat.setFromRotationMatrix(new T.Matrix4().makeBasis(xAxis, yAxis, zAxis))
            
            reticle.position.lerp(targetPos, 0.1)
            reticle.quaternion.slerp(targetQuat, 0.1)
            hitSuccess = true
            if (!hasFoundSurfaceEver) {
              hasFoundSurfaceEver = true
              placementReadyTime = Date.now() + 2000
            }
          }
        } catch (e) {}
      }
  
      if (!hitSuccess) {
        if (!hasFoundSurfaceEver) {
          const worldCamQuat = new T.Quaternion()
          cam.getWorldQuaternion(worldCamQuat)
          const dir = new T.Vector3(0, 0, -1).applyQuaternion(worldCamQuat)
          
          const worldCamPos = new T.Vector3()
          cam.getWorldPosition(worldCamPos)
          const targetPos = worldCamPos.clone().add(dir.multiplyScalar(1.5))
          targetPos.y -= 1.0
          reticle.position.lerp(targetPos, 0.1)
        }
        reticle.quaternion.slerp(new T.Quaternion(), 0.1)
      }
  
      reticle.visible = true
  
      let isReady = hasFoundSurfaceEver && Date.now() > placementReadyTime && hitSuccess;
      if (placeBtn) {
        if (isReady && !placeBtn.classList.contains('visible')) {
          placeBtn.classList.add('visible')
          placeBtn.innerText = 'TAP TO PLACE MAP'
        } else if (!isReady && placeBtn.classList.contains('visible')) {
          placeBtn.classList.remove('visible')
          placeBtn.innerText = 'WAITING FOR SURFACE...'
        }
      }
      
      requestAnimationFrame(updatePlacement)
    }
    updatePlacement()

    if (placeBtn) {
      placeBtn.addEventListener('click', (e) => {
        e.preventDefault()
        if (!hasFoundSurfaceEver) return
        
        if (isPlaced) {
           isPlaced = false
           mapGroup.visible = false
           reticle.visible = true
           placeBtn.innerText = 'TAP TO PLACE MAP'
           placeBtn.style.backgroundColor = ''
           const oBtn = document.getElementById('ea-orientation-btn')
           if (oBtn) oBtn.style.display = 'block'
           updatePlacement()
           return
        }

        isPlaced = true
        placeBtn.innerText = 'PICK UP MAP'
        placeBtn.style.backgroundColor = '#333333'
        const oBtn = document.getElementById('ea-orientation-btn')
        if (oBtn) oBtn.style.display = 'none'
        reticle.visible = false

        mapGroup.position.copy(reticle.position)
        mapGroup.quaternion.copy(reticle.quaternion)

        mapGroup.userData.originPos = mapGroup.position.clone()

        if (mapGroup.parent !== w.three.scene) w.three.scene.add(mapGroup)
        mapGroup.visible = true
        setupClickHandler()
      })
    }
  }

  // ── MOUSE CONTROLS (XZ Floor plane locked) ──
  let isSpinning = false
  let isPanning = false
  let previousX = 0
  let previousY = 0

  const isUI = (e: PointerEvent | TouchEvent) => {
    const t = 'target' in e ? e.target as HTMLElement : null
    return t?.closest('#ea-drawer, #ea-panel-left, #ea-panel-right, #ea-hamburger-left, #ea-hamburger-right, #ea-detail, #ea-title') !== null
  }

  const downListener = (e: PointerEvent) => {
    if (isUI(e)) return
    if (!isPlaced) return
    if (e.pointerType === 'touch') return
    if (e.button === 0) isSpinning = true
    else if (e.button === 2) isPanning = true
    previousX = e.clientX
    previousY = e.clientY
  }
  const moveListener = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!isPlaced) return
    const dx = e.clientX - previousX
    const dy = e.clientY - previousY

    if (isSpinning) {
      // Left Click spins the map (yaw only)
      mapGroup.rotateY(dx * 0.00375)
    } else if (isPanning) {
      const normal = new T.Vector3(0, 1, 0).applyQuaternion(mapGroup.quaternion)
      const worldCamQuat = new T.Quaternion()
      cam.getWorldQuaternion(worldCamQuat)
      
      const camRight = new T.Vector3(1, 0, 0).applyQuaternion(worldCamQuat)
      const panRight = camRight.projectOnPlane(normal).normalize()
      const camUp = new T.Vector3(0, 1, 0).applyQuaternion(worldCamQuat)
      const panUp = camUp.projectOnPlane(normal).normalize()

      const panSpeed = 0.0125 * mapGroup.scale.x
      mapGroup.position.add(panRight.multiplyScalar(dx * panSpeed))
      mapGroup.position.add(panUp.multiplyScalar(-dy * panSpeed))

      // Clamp distance
      const dist = mapGroup.position.distanceTo(mapGroup.userData.originPos)
      const maxDistance = 2.0 // meters
      if (dist > maxDistance) {
        const clampDir = new T.Vector3().subVectors(mapGroup.position, mapGroup.userData.originPos).normalize()
        mapGroup.position.copy(mapGroup.userData.originPos).add(clampDir.multiplyScalar(maxDistance))
      }
    }
    previousX = e.clientX
    previousY = e.clientY
  }
  const upListener = (e: PointerEvent) => {
    if (isUI(e)) return
    if (e.button === 0) isSpinning = false
    if (e.button === 2) isPanning = false
  }

  const applyZoomAtScreenPoint = (newScale: number, pointerX: number, pointerY: number) => {
    const oldScale = mapGroup.scale.x
    if (oldScale === newScale) return

    const raycaster = new T.Raycaster()
    const currentCam = w.three.camera || w.three.activeCamera || (window as any).XR8.Threejs.xrCamera()
    const nx = (pointerX / window.innerWidth) * 2 - 1
    const ny = -(pointerY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(new T.Vector2(nx, ny), currentCam)

    // Intersect the map's floor plane (Y = mapGroup.y)
    const normal = new T.Vector3(0, 1, 0)
    const plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, mapGroup.position)
    const hitWorld = new T.Vector3()
    raycaster.ray.intersectPlane(plane, hitWorld)

    if (hitWorld.lengthSq() === 0) {
      mapGroup.scale.set(newScale, newScale, newScale)
      return
    }

    const hitLocal = mapGroup.worldToLocal(hitWorld.clone())
    mapGroup.scale.set(newScale, newScale, newScale)
    mapGroup.updateMatrixWorld(true)
    const newHitWorld = mapGroup.localToWorld(hitLocal.clone())

    mapGroup.position.add(hitWorld.sub(newHitWorld))
  }

  const wheelListener = (e: WheelEvent) => {
    if (isUI(e as any)) return
    if (!isPlaced) return
    let s = mapGroup.scale.x - e.deltaY * 0.001
    s = Math.max(0.1, Math.min(s, 5.0))
    applyZoomAtScreenPoint(s, e.clientX, e.clientY)
  }

  window.addEventListener('contextmenu', e => e.preventDefault())
  window.addEventListener('pointerdown', downListener)
  window.addEventListener('pointermove', moveListener)
  window.addEventListener('pointerup', upListener)
  window.addEventListener('pointerleave', upListener)
  window.addEventListener('wheel', wheelListener, { passive: false })

  // ── TOUCH CONTROLS (XZ Floor plane locked) ──
  let touchStartDist = 0
  let touchStartScale = 1
  let lastTouchX = 0
  let lastTouchY = 0
  let lastAvgX = 0
  let lastAvgY = 0
  let touchCount = 0

  window.addEventListener('touchstart', (e: TouchEvent) => {
    if (isUI(e as any)) return
    if (!isPlaced) return
    touchCount = e.touches.length
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchStartDist = Math.sqrt(dx * dx + dy * dy)
      touchStartScale = mapGroup.scale.x
      lastAvgX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      lastAvgY = (e.touches[0].clientY + e.touches[1].clientY) / 2
    } else if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
    }
  }, { passive: true })

  window.addEventListener('touchmove', (e: TouchEvent) => {
    if (isUI(e as any)) return
    if (!isPlaced) return
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (touchStartDist > 0) {
        let s = touchStartScale * (dist / touchStartDist)
        s = Math.max(0.1, Math.min(s, 5.0))
        applyZoomAtScreenPoint(s, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2)
      }

      if (lastAvgX > 0 && lastAvgY > 0) {
        const avgX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const dX = avgX - lastAvgX

        // 2-finger twist to rotate map (yaw only)
        mapGroup.rotateY(dX * 0.01125)

        lastAvgX = avgX
        lastAvgY = avgY
      } else {
        lastAvgX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        lastAvgY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      }

    } else if (e.touches.length === 1 && touchCount === 1) {
      // 1-finger drag to pan across floor (XZ plane)
      const dx = e.touches[0].clientX - lastTouchX
      const dy = e.touches[0].clientY - lastTouchY

      const normal = new T.Vector3(0, 1, 0).applyQuaternion(mapGroup.quaternion)
      const worldCamQuat = new T.Quaternion()
      cam.getWorldQuaternion(worldCamQuat)
      
      const camRight = new T.Vector3(1, 0, 0).applyQuaternion(worldCamQuat)
      const panRight = camRight.projectOnPlane(normal).normalize()
      const camUp = new T.Vector3(0, 1, 0).applyQuaternion(worldCamQuat)
      const panUp = camUp.projectOnPlane(normal).normalize()

      const panSpeed = 0.0125 * mapGroup.scale.x
      mapGroup.position.add(panRight.multiplyScalar(dx * panSpeed))
      mapGroup.position.add(panUp.multiplyScalar(-dy * panSpeed))

      // Clamp distance
      const dist = mapGroup.position.distanceTo(mapGroup.userData.originPos)
      const maxDistance = 2.0 // meters
      if (dist > maxDistance) {
        const clampDir = new T.Vector3().subVectors(mapGroup.position, mapGroup.userData.originPos).normalize()
        mapGroup.position.copy(mapGroup.userData.originPos).add(clampDir.multiplyScalar(maxDistance))
      }

      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
    }
  }, { passive: true })

  window.addEventListener('touchend', (e: TouchEvent) => {
    if (isUI(e as any)) return
    touchCount = e.touches.length
    if (touchCount === 1) {
      lastTouchX = e.touches[0].clientX
      lastTouchY = e.touches[0].clientY
    }
    if (touchCount < 2) touchStartDist = 0
  }, { passive: true })
})
