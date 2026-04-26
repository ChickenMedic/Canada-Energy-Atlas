// API Service Layer — Fetches live prices, news, and production data

export interface CommodityPrice {
  name: string
  symbol: string
  price: number
  change: number
  changePercent: number
  unit: string
  currency: string
  timestamp: string
}

export interface NewsItem {
  title: string
  source: string
  url: string
  publishedAt: string
  summary: string
}

export interface ProductionData {
  province: string
  product: string
  date: string
  volume_m3: number
}

export interface YoutubeVideo {
  title: string
  url: string
}

export interface PipelineProject {
  name: string
  status: 'cancelled' | 'operational' | 'proposed'
  capacity_bpd: number
  length_km: number
  origin: string
  destination: string
  cancellation_year?: number
  cancellation_reason?: string
  estimated_revenue_loss_cad: number
  route: Array<[number, number]>  // [lat, lng] pairs
  summary?: string
  source_url?: string
  youtube_videos?: YoutubeVideo[]
}

export interface WhatIfScenario {
  pipeline: string
  years_active: number
  oil_price_usd: number
  exchange_rate: number
  utilization: number  // 0-1
  revenue_cad: number
  jobs_created: number
  royalties_cad: number
}

// ── Commodity Prices ──
// In production, these would hit real APIs (e.g., EIA, Bank of Canada, ICE)
// For now, we use realistic seed data that can be swapped for live endpoints

const PRICE_API_BASE = 'https://api.canadaenergyatlas.com'

let cachedPrices: CommodityPrice[] | null = null
let priceLastFetch = 0
const PRICE_CACHE_MS = 60_000  // refresh every 60s

export async function fetchCommodityPrices(): Promise<CommodityPrice[]> {
  const now = Date.now()
  if (cachedPrices && now - priceLastFetch < PRICE_CACHE_MS) {
    return cachedPrices
  }

  try {
    const res = await fetch(`${PRICE_API_BASE}/api/prices`)
    if (res.ok) {
      cachedPrices = await res.json()
      priceLastFetch = now
      return cachedPrices!
    }
  } catch {
    // API unavailable — fall through to seed data
  }

  // Seed data with realistic values
  cachedPrices = [
    {
      name: 'WTI Crude',
      symbol: 'WTI',
      price: 71.45,
      change: -0.82,
      changePercent: -1.13,
      unit: 'bbl',
      currency: 'USD',
      timestamp: new Date().toISOString(),
    },
    {
      name: 'Western Canadian Select',
      symbol: 'WCS',
      price: 57.20,
      change: -1.15,
      changePercent: -1.97,
      unit: 'bbl',
      currency: 'USD',
      timestamp: new Date().toISOString(),
    },
    {
      name: 'Henry Hub Natural Gas',
      symbol: 'HH',
      price: 2.34,
      change: 0.08,
      changePercent: 3.54,
      unit: 'MMBtu',
      currency: 'USD',
      timestamp: new Date().toISOString(),
    },
    {
      name: 'Dawn Natural Gas',
      symbol: 'DAWN',
      price: 2.18,
      change: 0.05,
      changePercent: 2.35,
      unit: 'GJ',
      currency: 'CAD',
      timestamp: new Date().toISOString(),
    },
    {
      name: 'AECO Natural Gas',
      symbol: 'AECO',
      price: 1.95,
      change: -0.03,
      changePercent: -1.52,
      unit: 'GJ',
      currency: 'CAD',
      timestamp: new Date().toISOString(),
    },
    {
      name: 'Brent Crude',
      symbol: 'BRENT',
      price: 75.30,
      change: -0.65,
      changePercent: -0.86,
      unit: 'bbl',
      currency: 'USD',
      timestamp: new Date().toISOString(),
    },
  ]
  priceLastFetch = now
  return cachedPrices
}

// ── News Feed ──

let cachedNews: NewsItem[] | null = null
let newsLastFetch = 0
const NEWS_CACHE_MS = 300_000  // 5 min

export async function fetchEnergyNews(): Promise<NewsItem[]> {
  const now = Date.now()
  if (cachedNews && now - newsLastFetch < NEWS_CACHE_MS) {
    return cachedNews
  }

  try {
    const res = await fetch(`${PRICE_API_BASE}/api/news`)
    if (res.ok) {
      cachedNews = await res.json()
      newsLastFetch = now
      return cachedNews!
    }
  } catch {
    // fall through
  }

  cachedNews = [
    {
      title: 'Trans Mountain Expansion begins commercial operations',
      source: 'Reuters',
      url: '#',
      publishedAt: '2026-04-15T14:00:00Z',
      summary: 'The expanded Trans Mountain pipeline system has begun full commercial operations, tripling capacity to 890,000 bpd.',
    },
    {
      title: 'Alberta royalty revenues exceed $12B forecast',
      source: 'CBC News',
      url: '#',
      publishedAt: '2026-04-14T09:30:00Z',
      summary: 'Higher-than-expected oil prices and increased production have pushed Alberta royalty revenues past the $12 billion mark.',
    },
    {
      title: 'BC LNG Canada Phase 2 reaches final investment decision',
      source: 'Financial Post',
      url: '#',
      publishedAt: '2026-04-13T16:00:00Z',
      summary: 'Shell-led LNG Canada consortium approves Phase 2, adding 14 million tonnes per annum of LNG export capacity.',
    },
    {
      title: 'Federal carbon price reaches $95/tonne',
      source: 'Globe and Mail',
      url: '#',
      publishedAt: '2026-04-12T11:00:00Z',
      summary: 'Canada\'s escalating carbon price continues to reshape the economics of oil sands production and pipeline competitiveness.',
    },
    {
      title: 'Saskatchewan potash and oil output hit record highs',
      source: 'StarPhoenix',
      url: '#',
      publishedAt: '2026-04-11T08:00:00Z',
      summary: 'Saskatchewan resource extraction hits all-time production records amid favorable global commodity prices.',
    },
  ]
  newsLastFetch = now
  return cachedNews
}

// ── Cancelled Pipelines ──

export function getCancelledPipelines(): PipelineProject[] {
  return [
    {
      name: 'Energy East',
      status: 'cancelled',
      capacity_bpd: 1_100_000,
      length_km: 4_600,
      origin: 'Hardisty, Alberta',
      destination: 'Saint John, New Brunswick',
      cancellation_year: 2017,
      cancellation_reason: 'TransCanada withdrew application after NEB expanded review scope to include upstream/downstream emissions',
      summary: 'Energy East would have been Canada\'s longest pipeline at 4,600 km, converting an existing natural gas line and building new sections to carry 1.1 million barrels per day of crude from Alberta and Saskatchewan to refineries in Quebec and a marine terminal in Saint John, NB. It would have given Eastern Canada access to domestic crude instead of imported oil, and enabled tanker exports to Europe and India. TransCanada withdrew the application in 2017 after the NEB announced it would assess upstream and downstream greenhouse gas emissions — a policy change that made the regulatory timeline and outcome unpredictable.',
      source_url: 'https://www.cer-rec.gc.ca/en/applications-hearings/view-applications-projects/energy-east/',
      estimated_revenue_loss_cad: 182_000_000_000,
      route: [
        [52.67, -111.68],  // Hardisty AB
        [50.45, -104.62],  // Regina SK
        [49.88, -97.14],   // Winnipeg MB
        [48.50, -89.30],   // Thunder Bay ON (Northern edge of Great Lakes)
        [46.50, -84.50],   // Sault Ste. Marie ON (Wrapping the coast)
        [46.49, -80.99],   // Sudbury ON
        [45.42, -75.69],   // Ottawa ON
        [45.50, -73.57],   // Montreal QC
        [47.00, -69.00],   // Edmundston NB area
        [46.10, -67.80],   // Fredericton NB area
        [45.27, -66.06],   // Saint John NB
      ],
      youtube_videos: [
        { title: 'Energy East Pipeline Explained', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: 'Why Energy East was Cancelled', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      ]
    },
    {
      name: 'Northern Gateway',
      status: 'cancelled',
      capacity_bpd: 525_000,
      length_km: 1_177,
      origin: 'Bruderheim, Alberta',
      destination: 'Kitimat, British Columbia',
      cancellation_year: 2016,
      cancellation_reason: 'Federal government rejected after Federal Court of Appeal overturned approval, citing inadequate Indigenous consultation',
      summary: 'Northern Gateway was a $7.9 billion twin pipeline that would have carried 525,000 bpd of diluted bitumen from Bruderheim, AB to a marine terminal in Kitimat, BC, with a condensate return line. It would have opened Asian export markets for Canadian crude via supertanker. After 7 years of regulatory review, the project was approved with 209 conditions in 2014, but the Federal Court of Appeal overturned the approval in 2016 citing insufficient Indigenous consultation. The Trudeau government formally rejected it with an oil tanker ban on BC\'s north coast.',
      source_url: 'https://www.cer-rec.gc.ca/en/applications-hearings/view-applications-projects/northern-gateway/',
      estimated_revenue_loss_cad: 96_000_000_000,
      route: [
        [53.80, -112.93],  // Bruderheim AB
        [54.23, -116.49],  // Edson AB
        [54.05, -122.75],  // Prince George BC
        [54.00, -128.65],  // Kitimat BC
      ],
      youtube_videos: [
        { title: 'The Story of Northern Gateway', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      ]
    },
    {
      name: 'Keystone XL',
      status: 'cancelled',
      capacity_bpd: 830_000,
      length_km: 1_897,
      origin: 'Hardisty, Alberta',
      destination: 'Steele City, Nebraska',
      cancellation_year: 2021,
      cancellation_reason: 'US President Biden revoked presidential permit on first day in office, citing climate concerns',
      summary: 'Keystone XL was a proposed 1,897 km shortcut pipeline that would have carried 830,000 bpd of crude from Hardisty, AB directly to Steele City, Nebraska, bypassing the longer existing Keystone route. First proposed in 2008, it became a political flashpoint in US climate politics. Obama rejected it in 2015, Trump approved it in 2017, and Biden revoked the presidential permit on his first day in office in January 2021. Alberta had invested $1.3 billion in the project through the KXL Investment Partnership. TC Energy formally abandoned it in June 2021.',
      source_url: 'https://www.tcenergy.com/operations/oil-and-liquids/keystone-xl/',
      estimated_revenue_loss_cad: 145_000_000_000,
      route: [
        [52.67, -111.68],  // Hardisty AB
        [50.00, -110.00],  // SE Alberta
        [49.00, -109.00],  // Border crossing
        [48.00, -107.50],  // Montana
        [45.00, -105.00],  // South Dakota
        [40.33, -96.77],   // Steele City NE
      ],
      youtube_videos: [
        { title: 'Keystone XL Timeline', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: 'Political Impact of KXL Cancellation', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      ]
    },
  ]
}

// ── What-If Revenue Calculator ──

export function calculateWhatIfRevenue(params: {
  pipeline: PipelineProject
  oilPriceUsd: number
  exchangeRate: number
  utilizationPercent: number
  yearsOperating: number
}): WhatIfScenario {
  const { pipeline, oilPriceUsd, exchangeRate, utilizationPercent, yearsOperating } = params

  const dailyBarrels = pipeline.capacity_bpd * (utilizationPercent / 100)
  const dailyRevenueCad = dailyBarrels * oilPriceUsd * exchangeRate
  const annualRevenueCad = dailyRevenueCad * 365
  const totalRevenueCad = annualRevenueCad * yearsOperating

  // Rough estimate: ~8% royalty rate on gross, ~2 jobs per 1000 bpd during operation
  const royaltiesCad = totalRevenueCad * 0.08
  const jobsCreated = Math.round(dailyBarrels / 1000 * 2)

  return {
    pipeline: pipeline.name,
    years_active: yearsOperating,
    oil_price_usd: oilPriceUsd,
    exchange_rate: exchangeRate,
    utilization: utilizationPercent / 100,
    revenue_cad: totalRevenueCad,
    jobs_created: jobsCreated,
    royalties_cad: royaltiesCad,
  }
}

// ── Historical Oil Prices & Exchange Rates (annual averages) ──
// Used by the simulation to calculate revenue from a specific start year

export interface HistoricalPricing {
  year: number
  wti_usd: number         // WTI annual average $/bbl
  wcs_discount_pct: number // WCS discount as % of WTI
  cad_usd: number          // CAD per USD exchange rate
}

export function getHistoricalPricing(): HistoricalPricing[] {
  return [
    { year: 2005, wti_usd: 56.64,  wcs_discount_pct: 22, cad_usd: 1.21 },
    { year: 2006, wti_usd: 66.05,  wcs_discount_pct: 20, cad_usd: 1.13 },
    { year: 2007, wti_usd: 72.34,  wcs_discount_pct: 24, cad_usd: 1.07 },
    { year: 2008, wti_usd: 99.67,  wcs_discount_pct: 21, cad_usd: 1.07 },
    { year: 2009, wti_usd: 61.95,  wcs_discount_pct: 18, cad_usd: 1.14 },
    { year: 2010, wti_usd: 79.48,  wcs_discount_pct: 15, cad_usd: 1.03 },
    { year: 2011, wti_usd: 94.88,  wcs_discount_pct: 19, cad_usd: 0.99 },
    { year: 2012, wti_usd: 94.05,  wcs_discount_pct: 23, cad_usd: 1.00 },
    { year: 2013, wti_usd: 97.98,  wcs_discount_pct: 27, cad_usd: 1.03 },
    { year: 2014, wti_usd: 93.17,  wcs_discount_pct: 20, cad_usd: 1.10 },
    { year: 2015, wti_usd: 48.66,  wcs_discount_pct: 28, cad_usd: 1.28 },
    { year: 2016, wti_usd: 43.29,  wcs_discount_pct: 30, cad_usd: 1.32 },
    { year: 2017, wti_usd: 50.80,  wcs_discount_pct: 25, cad_usd: 1.30 },
    { year: 2018, wti_usd: 65.23,  wcs_discount_pct: 38, cad_usd: 1.30 },
    { year: 2019, wti_usd: 56.99,  wcs_discount_pct: 22, cad_usd: 1.33 },
    { year: 2020, wti_usd: 39.16,  wcs_discount_pct: 30, cad_usd: 1.34 },
    { year: 2021, wti_usd: 67.99,  wcs_discount_pct: 17, cad_usd: 1.25 },
    { year: 2022, wti_usd: 94.53,  wcs_discount_pct: 21, cad_usd: 1.30 },
    { year: 2023, wti_usd: 77.61,  wcs_discount_pct: 19, cad_usd: 1.35 },
    { year: 2024, wti_usd: 75.89,  wcs_discount_pct: 18, cad_usd: 1.37 },
    { year: 2025, wti_usd: 71.45,  wcs_discount_pct: 20, cad_usd: 1.36 },
  ]
}

// Calculate cumulative revenue if a pipeline had been completed at a given year,
// using actual historical WTI prices, WCS discounts, and exchange rates from that year forward
export interface SimulationResult {
  pipeline: string
  startYear: number
  endYear: number
  utilizationPercent: number
  yearlyBreakdown: { year: number, wti: number, netPrice: number, fx: number, revenue_cad: number }[]
  total_revenue_cad: number
  total_royalties_cad: number
  total_taxes_cad: number
  jobs_created: number
  jobs_construction: number
}

export function runPipelineSimulation(params: {
  pipeline: PipelineProject
  completionYear: number
  utilizationPercent: number
}): SimulationResult {
  const { pipeline, completionYear, utilizationPercent } = params
  const pricing = getHistoricalPricing()
  const endYear = 2025

  const yearlyBreakdown: SimulationResult['yearlyBreakdown'] = []
  let totalRevenue = 0

  for (let year = completionYear; year <= endYear; year++) {
    // Find pricing for this year (use closest available if exact year missing)
    let p = pricing.find(pr => pr.year === year)
    if (!p) {
      const closest = pricing.reduce((a, b) => Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a)
      p = closest
    }

    const wti = p.wti_usd
    // For crude oil pipelines, apply WCS discount; for export pipelines, use WTI
    const netPrice = pipeline.destination.includes('Nebraska') || pipeline.destination.includes('Kitimat')
      ? wti  // Export gets closer to world price
      : wti * (1 - p.wcs_discount_pct / 100)

    const dailyBarrels = pipeline.capacity_bpd * (utilizationPercent / 100)
    const annualRevenue = dailyBarrels * netPrice * p.cad_usd * 365
    totalRevenue += annualRevenue

    yearlyBreakdown.push({
      year,
      wti,
      netPrice,
      fx: p.cad_usd,
      revenue_cad: annualRevenue,
    })
  }

  const dailyBarrels = pipeline.capacity_bpd * (utilizationPercent / 100)

  return {
    pipeline: pipeline.name,
    startYear: completionYear,
    endYear,
    utilizationPercent,
    yearlyBreakdown,
    total_revenue_cad: totalRevenue,
    total_royalties_cad: totalRevenue * 0.08,  // ~8% royalty rate
    total_taxes_cad: totalRevenue * 0.04,       // ~4% corporate tax contribution
    jobs_created: Math.round(dailyBarrels / 1000 * 2),  // operational jobs
    jobs_construction: Math.round(pipeline.length_km * 8),  // ~8 workers per km during construction
  }
}

// ── Operational Pipeline Network ──

export interface OperationalPipeline {
  name: string
  product: 'oil' | 'gas' | 'ngl' | 'mixed'
  capacity_bpd?: number      // barrels per day (oil/ngl)
  capacity_bcfd?: number     // billion cubic feet per day (gas)
  diameter_inches: number
  length_km: number
  operator: string
  route: Array<[number, number]>  // [lat, lng]
  color: number
  year_built: number
  summary: string
  source_url: string
  youtube_videos?: YoutubeVideo[]
}

export function getOperationalPipelines(): OperationalPipeline[] {
  return [
    {
      name: 'Trans Mountain',
      product: 'oil', capacity_bpd: 300_000, diameter_inches: 24, length_km: 1150,
      operator: 'Trans Mountain Corp.', year_built: 1953,
      summary: 'The historic Trans Mountain pipeline originally scaled in 1953, opening the interior of Alberta up to the Pacific coast. Before the expansion project, it operated constantly near total maximum capacity constraints carrying 300k bpd over the Rocky Mountain ranges into British Columbia.',
      source_url: 'https://www.transmountain.com',
      color: 0x2e5984, // Slate blue
      route: [[53.54, -113.49], [52.87, -115.76], [51.38, -116.85], [51.05, -118.18], [50.37, -119.34], [49.88, -119.49], [49.27, -121.76], [49.28, -122.80], [49.29, -123.00], [48.90, -123.37]],
      youtube_videos: [
        { title: 'The Original Trans Mountain', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      ]
    },
    {
      name: 'TMX',
      product: 'oil', capacity_bpd: 590_000, diameter_inches: 36, length_km: 1150,
      operator: 'Trans Mountain Corp.', year_built: 2024,
      summary: 'The massive $34B twin-pipeline expansion built directly parallel to the historic original line. The TMX adds 590,000 bpd of massive new capacity natively unlocking Asian port exports to reduce absolute reliance on US Midwest refineries.',
      source_url: 'https://www.transmountain.com',
      color: 0xb22222, // Firebrick heavy red
      // Shifted by exactly +1.0 degree strictly North in Latitude so the twin pipe draws visibly parallel in 3D without physically clipping
      route: [[54.54, -113.49], [53.87, -115.76], [52.38, -116.85], [52.05, -118.18], [51.37, -119.34], [50.88, -119.49], [50.27, -121.76], [50.28, -122.80], [50.29, -123.00], [49.90, -123.37]],
      youtube_videos: [
        { title: 'TMX Megaproject Completion', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      ]
    },
    {
      name: 'Enbridge Mainline',
      product: 'oil', capacity_bpd: 3_100_000, diameter_inches: 48, length_km: 3100,
      operator: 'Enbridge Inc.', year_built: 1950,
      summary: 'The Enbridge Mainline (formerly Interprovincial Pipeline) is the longest and largest crude oil pipeline in the world. Originating in Edmonton, it carries over 3 million barrels per day across the prairies to refineries in Ontario, Quebec, and the US Midwest. It is the backbone of Canadian oil transportation and handles roughly 70% of all Canadian crude exports.',
      source_url: 'https://www.enbridge.com/projects-and-infrastructure/public-awareness/mainline-system',
      color: 0x228b22, // Forest Green
      route: [[53.54, -113.49], [52.20, -110.50], [50.45, -104.62], [49.88, -97.14], [48.60, -89.30], [46.80, -84.50], [43.00, -79.50], [45.00, -74.00], [45.50, -73.57]],
    },
    {
      name: 'Keystone Pipeline',
      product: 'oil', capacity_bpd: 590_000, diameter_inches: 30, length_km: 3460,
      operator: 'TC Energy', year_built: 2010,
      summary: 'The Keystone Pipeline System carries Alberta crude south to US Gulf Coast refineries in Texas. Phase 1 (2010) runs from Hardisty, AB to Illinois; the Cushing Extension (2011) reaches Oklahoma; and the Gulf Coast segment (2014) connects to Port Arthur, TX. It is a critical US-Canada cross-border energy link, though its proposed XL expansion was cancelled in 2021.',
      source_url: 'https://www.tcenergy.com/operations/oil-and-liquids/keystone-pipeline-system/',
      color: 0xd2691e, // Chocolate / Burnt Orange
      route: [[52.67, -111.68], [50.00, -108.00], [49.00, -106.00], [48.00, -104.00], [45.00, -97.00], [42.00, -96.50], [40.00, -96.50], [38.00, -97.00], [36.00, -97.00], [29.76, -95.37]],
    },
    {
      name: 'Express Pipeline',
      product: 'oil', capacity_bpd: 310_000, diameter_inches: 24, length_km: 2735,
      operator: 'Enbridge Inc.', year_built: 1997,
      summary: 'The Express-Platte system carries crude oil from Hardisty, Alberta to refineries in the US Rocky Mountain and Midwest regions. Express (Hardisty to Casper, Wyoming) connects to the Platte Pipeline (Casper to Wood River, Illinois). It provides Canadian producers access to inland US refining markets that are otherwise difficult to reach.',
      source_url: 'https://www.enbridge.com/projects-and-infrastructure/public-awareness/express-platte-system',
      color: 0xdaa520, // Goldenrod
      route: [[52.67, -111.68], [49.00, -110.00], [47.50, -108.00], [46.00, -108.00], [44.00, -107.00], [42.80, -108.70]],
    },
    // ── Major Gas Pipelines ──
    {
      name: 'NOVA Gas Transmission (NGTL)',
      product: 'gas', capacity_bcfd: 14.5, diameter_inches: 42, length_km: 24500,
      operator: 'TC Energy', year_built: 1957,
      summary: 'NGTL is Alberta\'s natural gas gathering and transmission backbone, connecting thousands of gas wells across the Western Canadian Sedimentary Basin to processing plants and export pipelines. With over 24,000 km of pipeline, it is one of the largest gas gathering systems in North America and feeds into the TransCanada Mainline, Alliance Pipeline, and BC export routes.',
      source_url: 'https://www.tcenergy.com/operations/natural-gas/ngtl-system/',
      color: 0x1e90ff, // Dodger Blue
      route: [[57.00, -120.50], [56.00, -118.50], [54.50, -116.50], [53.54, -113.49], [52.00, -111.50], [51.00, -110.00], [49.50, -110.50]],
    },
    {
      name: 'TransCanada Mainline',
      product: 'gas', capacity_bcfd: 6.8, diameter_inches: 42, length_km: 14100,
      operator: 'TC Energy', year_built: 1958,
      summary: 'The TransCanada Mainline is one of North America\'s longest natural gas pipeline systems, stretching from the Alberta-Saskatchewan border to Quebec City. Built in the late 1950s as a nation-building project, it supplies natural gas to millions of homes and businesses across the prairies, Ontario, and Quebec. It connects to the Dawn Hub, one of North America\'s largest gas trading points.',
      source_url: 'https://www.tcenergy.com/operations/natural-gas/canadian-mainline/',
      color: 0x4682b4, // Steel Blue
      route: [[53.54, -113.49], [52.00, -110.00], [50.45, -104.62], [49.88, -97.14], [48.50, -89.30], [46.50, -84.50], [43.65, -79.38], [45.50, -75.69], [45.50, -73.57], [46.80, -71.20]],
    },
    {
      name: 'Alliance Pipeline',
      product: 'ngl', capacity_bcfd: 1.56, diameter_inches: 36, length_km: 3848,
      operator: 'Pembina / Enbridge', year_built: 2000,
      summary: 'Alliance Pipeline is unique — it transports rich, liquids-laden natural gas from BC and Alberta all the way to the Chicago market hub without extracting NGLs first. This "bullet line" design bypasses traditional processing in Alberta, instead delivering rich gas to the Aux Sable plant in Illinois where NGLs are extracted and sold at higher US market prices. It provides Canadian producers direct access to premium US petrochemical markets.',
      source_url: 'https://www.alliancepipeline.com',
      color: 0x00ced1, // Dark Turquoise
      route: [[57.50, -120.00], [54.50, -116.50], [53.54, -113.49], [52.00, -110.00], [49.00, -106.00], [48.00, -100.00], [45.00, -95.00], [41.88, -87.63]],
    },
    {
      name: 'Westcoast Energy',
      product: 'gas', capacity_bcfd: 2.8, diameter_inches: 36, length_km: 2960,
      operator: 'Enbridge Inc.', year_built: 1957,
      summary: 'The Westcoast Energy system gathers and processes natural gas from northeastern BC\'s prolific Montney formation and delivers it to markets in BC, the US Pacific Northwest, and to LNG Canada\'s export terminal in Kitimat. It is the main gas artery for BC\'s growing LNG export industry and plays a key role in Canada\'s emerging position as a Pacific Rim energy supplier.',
      source_url: 'https://www.enbridge.com/projects-and-infrastructure/public-awareness/bc-pipeline-and-field-services',
      color: 0x5f9ea0, // Cadet Blue
      route: [[59.00, -124.00], [57.00, -122.00], [54.50, -122.50], [52.50, -122.00], [49.28, -122.80], [49.00, -122.50]],
    },
    // ── Cross-Border ──
    {
      name: 'Maritimes & Northeast',
      product: 'gas', capacity_bcfd: 0.55, diameter_inches: 30, length_km: 1400,
      operator: 'Enbridge Inc.', year_built: 1999,
      summary: 'The Maritimes & Northeast Pipeline transports natural gas from offshore Nova Scotia (Sable Island, Deep Panuke) to markets in New Brunswick, Nova Scotia, and New England. While offshore production has declined, the pipeline now increasingly flows imported LNG from the Canaport terminal in Saint John, NB, to serve regional demand in Atlantic Canada and the northeastern US.',
      source_url: 'https://www.enbridge.com/projects-and-infrastructure/public-awareness/maritimes-northeast-pipeline',
      color: 0x6495ed, // Cornflower Blue
      route: [[44.63, -63.57], [45.60, -64.30], [45.80, -66.50], [45.50, -67.50], [44.65, -68.70], [43.35, -70.80], [42.36, -71.06]],
    },
  ]
}

// ── Geographic Price Markers ──
// Placed at or near the physical trading hubs

export interface PriceMarker {
  symbol: string
  name: string
  lat: number
  lng: number
  priceKey: string  // matches CommodityPrice.symbol
}

export function getPriceMarkerLocations(): PriceMarker[] {
  return [
    {symbol: 'AECO', name: 'AECO Hub', lat: 52.27, lng: -113.81, priceKey: 'AECO'},        // Near Suffield, AB
    {symbol: 'DAWN', name: 'Dawn Hub', lat: 42.70, lng: -81.96, priceKey: 'DAWN'},           // Dawn Township, ON
    {symbol: 'HH', name: 'Henry Hub', lat: 30.12, lng: -93.31, priceKey: 'HH'},              // Erath, Louisiana
    {symbol: 'WTI', name: 'WTI Cushing', lat: 35.98, lng: -96.77, priceKey: 'WTI'},          // Cushing, Oklahoma
    {symbol: 'WCS', name: 'Western Canadian Select', lat: 52.67, lng: -111.68, priceKey: 'WCS'}, // Hardisty, AB
  ]
}

// ── Data Sources ──

export interface DataSource {
  category: string
  name: string
  url: string
  description: string
}

export function getDataSources(): DataSource[] {
  return [
    {category: 'Production', name: 'Alberta Energy Regulator (AER)', url: 'https://www.aer.ca', description: 'Alberta oil & gas production volumes, well data, and regulatory filings'},
    {category: 'Production', name: 'BC Oil & Gas Commission (BCOGC)', url: 'https://www.bcogc.ca', description: 'British Columbia natural gas and oil production data'},
    {category: 'Production', name: 'Canada Energy Regulator (CER)', url: 'https://www.cer-rec.gc.ca', description: 'National pipeline throughput, energy supply/demand, and export data'},
    {category: 'Production', name: 'Statistics Canada', url: 'https://www150.statcan.gc.ca', description: 'National energy production and consumption statistics'},
    {category: 'Pricing', name: 'Natural Gas Exchange (NGX)', url: 'https://www.ngx.com', description: 'AECO and Dawn natural gas spot and forward pricing'},
    {category: 'Pricing', name: 'CME Group / NYMEX', url: 'https://www.cmegroup.com', description: 'Henry Hub natural gas futures and WTI crude oil futures'},
    {category: 'Pricing', name: 'US EIA', url: 'https://www.eia.gov', description: 'US energy production, consumption, pricing, and forecasts'},
    {category: 'Pricing', name: 'Bank of Canada', url: 'https://www.bankofcanada.ca', description: 'USD/CAD exchange rates (noon rate)'},
    {category: 'Pipelines', name: 'CER Pipeline Profiles', url: 'https://www.cer-rec.gc.ca/en/data-analysis/facilities-we-regulate/pipeline-profiles/', description: 'Throughput, capacity, and tolling data for federally regulated pipelines'},
    {category: 'Pipelines', name: 'Enbridge Investor Relations', url: 'https://www.enbridge.com/investor-relations', description: 'Enbridge Mainline, Express, and other pipeline operational data'},
    {category: 'Pipelines', name: 'TC Energy Investor Relations', url: 'https://www.tcenergy.com/investors', description: 'Keystone, NGTL, and TransCanada Mainline operational data'},
    {category: 'Electrical Grid', name: 'IESO (Ontario)', url: 'https://www.ieso.ca', description: 'Ontario real-time demand, generation mix, and interconnection flows'},
    {category: 'Electrical Grid', name: 'AESO (Alberta)', url: 'https://www.aeso.ca', description: 'Alberta electricity generation, demand, and market pricing'},
    {category: 'Electrical Grid', name: 'Hydro-Quebec', url: 'https://www.hydroquebec.com', description: 'Quebec hydroelectric generation and interprovincial exports'},
    {category: 'Electrical Grid', name: 'BC Hydro', url: 'https://www.bchydro.com', description: 'British Columbia hydroelectric generation and demand'},
    {category: 'Historical', name: 'IEA World Energy Statistics', url: 'https://www.iea.org', description: 'International energy production and consumption data since 1970'},
    {category: 'Historical', name: 'NRCan Energy Fact Book', url: 'https://www.nrcan.gc.ca', description: 'Natural Resources Canada annual energy statistics and fact sheets'},
    {category: 'Maps', name: 'Natural Earth Data', url: 'https://www.naturalearthdata.com', description: 'Public domain geographic boundary data used for province/country outlines'},
  ]
}

// ── Historical Energy Data ──

export interface HistoricalDataPoint {
  year: number
  country: 'Canada' | 'United States'
  oil_production_mbpd: number       // million barrels per day
  gas_production_bcfd: number       // billion cubic feet per day
  coal_production_mt: number        // million tonnes
  electricity_generation_twh: number
  renewable_share_percent: number
}

export function getHistoricalData(): HistoricalDataPoint[] {
  return [
    // Canada
    { year: 1970, country: 'Canada', oil_production_mbpd: 1.26, gas_production_bcfd: 6.5, coal_production_mt: 15, electricity_generation_twh: 205, renewable_share_percent: 65 },
    { year: 1980, country: 'Canada', oil_production_mbpd: 1.44, gas_production_bcfd: 7.8, coal_production_mt: 36, electricity_generation_twh: 375, renewable_share_percent: 62 },
    { year: 1990, country: 'Canada', oil_production_mbpd: 1.55, gas_production_bcfd: 10.3, coal_production_mt: 68, electricity_generation_twh: 482, renewable_share_percent: 60 },
    { year: 2000, country: 'Canada', oil_production_mbpd: 1.90, gas_production_bcfd: 16.8, coal_production_mt: 69, electricity_generation_twh: 587, renewable_share_percent: 59 },
    { year: 2005, country: 'Canada', oil_production_mbpd: 2.37, gas_production_bcfd: 17.0, coal_production_mt: 67, electricity_generation_twh: 610, renewable_share_percent: 58 },
    { year: 2010, country: 'Canada', oil_production_mbpd: 2.74, gas_production_bcfd: 14.3, coal_production_mt: 67, electricity_generation_twh: 588, renewable_share_percent: 61 },
    { year: 2015, country: 'Canada', oil_production_mbpd: 3.85, gas_production_bcfd: 14.5, coal_production_mt: 57, electricity_generation_twh: 632, renewable_share_percent: 64 },
    { year: 2020, country: 'Canada', oil_production_mbpd: 4.10, gas_production_bcfd: 15.4, coal_production_mt: 35, electricity_generation_twh: 620, renewable_share_percent: 67 },
    { year: 2023, country: 'Canada', oil_production_mbpd: 4.91, gas_production_bcfd: 16.8, coal_production_mt: 22, electricity_generation_twh: 645, renewable_share_percent: 68 },
    { year: 2025, country: 'Canada', oil_production_mbpd: 5.20, gas_production_bcfd: 17.5, coal_production_mt: 15, electricity_generation_twh: 660, renewable_share_percent: 70 },
    // United States
    { year: 1970, country: 'United States', oil_production_mbpd: 9.64, gas_production_bcfd: 61.0, coal_production_mt: 560, electricity_generation_twh: 1640, renewable_share_percent: 15 },
    { year: 1980, country: 'United States', oil_production_mbpd: 8.60, gas_production_bcfd: 54.7, coal_production_mt: 710, electricity_generation_twh: 2290, renewable_share_percent: 12 },
    { year: 1990, country: 'United States', oil_production_mbpd: 7.36, gas_production_bcfd: 51.2, coal_production_mt: 930, electricity_generation_twh: 2808, renewable_share_percent: 11 },
    { year: 2000, country: 'United States', oil_production_mbpd: 5.82, gas_production_bcfd: 54.4, coal_production_mt: 1020, electricity_generation_twh: 3593, renewable_share_percent: 9 },
    { year: 2005, country: 'United States', oil_production_mbpd: 5.18, gas_production_bcfd: 52.3, coal_production_mt: 1026, electricity_generation_twh: 3902, renewable_share_percent: 9 },
    { year: 2010, country: 'United States', oil_production_mbpd: 5.48, gas_production_bcfd: 62.2, coal_production_mt: 985, electricity_generation_twh: 4091, renewable_share_percent: 10 },
    { year: 2015, country: 'United States', oil_production_mbpd: 9.43, gas_production_bcfd: 79.1, coal_production_mt: 813, electricity_generation_twh: 4077, renewable_share_percent: 13 },
    { year: 2020, country: 'United States', oil_production_mbpd: 11.31, gas_production_bcfd: 93.1, coal_production_mt: 489, electricity_generation_twh: 3858, renewable_share_percent: 20 },
    { year: 2023, country: 'United States', oil_production_mbpd: 12.93, gas_production_bcfd: 104.0, coal_production_mt: 406, electricity_generation_twh: 4052, renewable_share_percent: 23 },
    { year: 2025, country: 'United States', oil_production_mbpd: 13.40, gas_production_bcfd: 108.0, coal_production_mt: 350, electricity_generation_twh: 4200, renewable_share_percent: 26 },
  ]
}

// ── Electrical Grid Data ──

export interface GridNode {
  name: string
  province: string
  lat: number
  lng: number
  type: 'hydro' | 'nuclear' | 'gas' | 'coal' | 'wind' | 'solar' | 'biomass'
  capacity_mw: number
}

export interface TransmissionLine {
  from: string
  to: string
  voltage_kv: number
  capacity_mw: number
}

export function getElectricalGridData(): { nodes: GridNode[], lines: TransmissionLine[] } {
  return {
    nodes: [
      // Major generation facilities
      { name: 'Churchill Falls', province: 'NL', lat: 53.54, lng: -64.10, type: 'hydro', capacity_mw: 5428 },
      { name: 'Robert-Bourassa', province: 'QC', lat: 53.78, lng: -77.45, type: 'hydro', capacity_mw: 5616 },
      { name: 'La Grande-4', province: 'QC', lat: 53.76, lng: -73.67, type: 'hydro', capacity_mw: 2779 },
      { name: 'Manic-5', province: 'QC', lat: 51.04, lng: -68.73, type: 'hydro', capacity_mw: 2660 },
      { name: 'Bruce Nuclear', province: 'ON', lat: 44.33, lng: -81.60, type: 'nuclear', capacity_mw: 6232 },
      { name: 'Darlington Nuclear', province: 'ON', lat: 43.87, lng: -78.72, type: 'nuclear', capacity_mw: 3512 },
      { name: 'Pickering Nuclear', province: 'ON', lat: 43.81, lng: -79.07, type: 'nuclear', capacity_mw: 3094 },
      { name: 'Niagara Falls (Beck)', province: 'ON', lat: 43.11, lng: -79.06, type: 'hydro', capacity_mw: 2038 },
      { name: 'Sundance', province: 'AB', lat: 53.53, lng: -114.56, type: 'coal', capacity_mw: 2141 },
      { name: 'Genesee', province: 'AB', lat: 53.32, lng: -114.23, type: 'gas', capacity_mw: 1400 },
      { name: 'Shepard Energy Centre', province: 'AB', lat: 50.98, lng: -113.90, type: 'gas', capacity_mw: 800 },
      { name: 'WAC Bennett Dam', province: 'BC', lat: 56.02, lng: -122.20, type: 'hydro', capacity_mw: 2730 },
      { name: 'Revelstoke Dam', province: 'BC', lat: 51.05, lng: -118.18, type: 'hydro', capacity_mw: 2480 },
      { name: 'Mica Dam', province: 'BC', lat: 52.08, lng: -118.56, type: 'hydro', capacity_mw: 2805 },
      { name: 'Site C Dam', province: 'BC', lat: 56.17, lng: -121.70, type: 'hydro', capacity_mw: 1100 },
      { name: 'Point Lepreau Nuclear', province: 'NB', lat: 45.07, lng: -66.45, type: 'nuclear', capacity_mw: 660 },
      { name: 'Boundary Dam', province: 'SK', lat: 49.07, lng: -103.00, type: 'coal', capacity_mw: 813 },
      { name: 'SaskPower Chinook', province: 'SK', lat: 50.56, lng: -108.49, type: 'wind', capacity_mw: 350 },
      { name: 'Riviere-du-Moulin Wind', province: 'QC', lat: 48.40, lng: -70.70, type: 'wind', capacity_mw: 350 },
      { name: 'Blackspring Ridge Wind', province: 'AB', lat: 49.95, lng: -113.30, type: 'wind', capacity_mw: 300 },
    ],
    lines: [
      { from: 'Robert-Bourassa', to: 'Montreal (HQ)', voltage_kv: 735, capacity_mw: 5000 },
      { from: 'Churchill Falls', to: 'Quebec Interconnect', voltage_kv: 735, capacity_mw: 5000 },
      { from: 'Bruce Nuclear', to: 'Toronto (IESO)', voltage_kv: 500, capacity_mw: 4000 },
      { from: 'Niagara Falls (Beck)', to: 'Toronto (IESO)', voltage_kv: 500, capacity_mw: 2000 },
      { from: 'WAC Bennett Dam', to: 'Vancouver (BC Hydro)', voltage_kv: 500, capacity_mw: 3000 },
      { from: 'Quebec Interconnect', to: 'Ontario Interconnect', voltage_kv: 450, capacity_mw: 2600 },
      { from: 'Ontario Interconnect', to: 'Manitoba Interconnect', voltage_kv: 500, capacity_mw: 1500 },
      { from: 'Manitoba Interconnect', to: 'Saskatchewan Interconnect', voltage_kv: 230, capacity_mw: 150 },
      { from: 'Saskatchewan Interconnect', to: 'Alberta Interconnect', voltage_kv: 230, capacity_mw: 150 },
      { from: 'Alberta Interconnect', to: 'BC Interconnect', voltage_kv: 500, capacity_mw: 1200 },
    ],
  }
}

// ── Export Terminals & Refining ──

export interface ExportTerminal {
  name: string
  type: 'lng' | 'oil' | 'refined'
  lat: number
  lng: number
  capacity_description: string
  status: 'operational' | 'under_construction' | 'proposed'
  destination_regions: string[] // e.g. ['Asia', 'Europe']
  operator: string
  summary: string
  source_url: string
  youtube_videos?: YoutubeVideo[]
}

export interface RefineryFacility {
  name: string
  type: 'refinery' | 'upgrader' | 'processing'
  lat: number
  lng: number
  capacity_bpd: number
  products: string[]
  operator: string
  summary: string
  source_url: string
  youtube_videos?: YoutubeVideo[]
}

export interface ExportRoute {
  from: string
  from_lat: number
  from_lng: number
  to_region: string
  to_lat: number
  to_lng: number
  product: string
  volume_description: string
  color: number
}

export function getExportTerminals(): ExportTerminal[] {
  return [
    {
      name: 'LNG Canada',
      type: 'lng',
      lat: 54.05,
      lng: -128.68,
      capacity_description: '14 MTPA (Phase 1)',
      status: 'under_construction',
      destination_regions: ['Asia'],
      operator: 'Shell / Petronas / PetroChina / Mitsubishi / KOGAS',
      summary: 'Canada\'s first large-scale LNG export facility, located in Kitimat, BC. Phase 1 will process natural gas from the Montney basin delivered via the Coastal GasLink pipeline.',
      source_url: 'https://www.lngcanada.ca',
      youtube_videos: [
        { title: 'LNG Canada Project Overview', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      ]
    },
    {
      name: 'Woodfibre LNG',
      type: 'lng',
      lat: 49.68,
      lng: -123.15,
      capacity_description: '2.1 MTPA',
      status: 'under_construction',
      destination_regions: ['Asia'],
      operator: 'Woodfibre LNG Limited',
      summary: 'A smaller-scale floating LNG facility near Squamish, BC, using electric-drive liquefaction to reduce emissions. It will be one of the lowest-carbon LNG plants globally.',
      source_url: 'https://www.woodfibrelng.ca',
    },
    {
      name: 'Cedar LNG',
      type: 'lng',
      lat: 54.00,
      lng: -128.70,
      capacity_description: '3 MTPA',
      status: 'proposed',
      destination_regions: ['Asia'],
      operator: 'Pembina Pipeline / Haisla Nation',
      summary: 'A floating LNG facility proposed for Kitimat, BC, majority-owned by the Haisla Nation. It would be the largest Indigenous-owned infrastructure project in Canada.',
      source_url: 'https://www.cedarlng.com',
    },
    {
      name: 'Goldboro LNG',
      type: 'lng',
      lat: 45.15,
      lng: -61.70,
      capacity_description: '10 MTPA',
      status: 'proposed',
      destination_regions: ['Europe'],
      operator: 'Pieridae Energy',
      summary: 'A proposed LNG terminal on Nova Scotia\'s Atlantic coast, positioned to supply European markets with a shorter shipping route than Gulf Coast competitors.',
      source_url: 'https://www.pierideaenergy.com',
    },
    {
      name: 'Westridge Marine Terminal',
      type: 'oil',
      lat: 49.28,
      lng: -122.95,
      capacity_description: '300,000 bpd (via Trans Mountain Expansion)',
      status: 'operational',
      destination_regions: ['Asia', 'US West Coast'],
      operator: 'Trans Mountain Corporation',
      summary: 'The Pacific tidewater terminal for the Trans Mountain pipeline in Burnaby, BC. The expansion project tripled tanker loading capacity, enabling crude oil exports to Asian markets.',
      source_url: 'https://www.transmountain.com',
    },
    {
      name: 'Canaport',
      type: 'oil',
      lat: 45.22,
      lng: -66.02,
      capacity_description: 'Import/export terminal handling crude and refined products',
      status: 'operational',
      destination_regions: ['US East Coast', 'Europe'],
      operator: 'Irving Oil',
      summary: 'A deep-water marine terminal in Saint John, NB, serving the adjacent Irving Oil refinery. It handles both crude oil imports and refined product exports to the US East Coast and Europe.',
      source_url: 'https://www.irvingoil.com',
    },
    // ── US Export Terminals ──
    {
      name: 'Sabine Pass LNG',
      type: 'lng',
      lat: 29.77,
      lng: -93.85,
      capacity_description: '30 MTPA',
      status: 'operational',
      destination_regions: ['Asia', 'Europe', 'Latin America'],
      operator: 'Cheniere Energy',
      summary: 'The first large-scale LNG export terminal in the contiguous United States, located in Cameron Parish, Louisiana. Sabine Pass has six liquefaction trains and is the largest LNG facility in North America, exporting to markets worldwide.',
      source_url: 'https://www.cheniere.com/terminals/sabine-pass',
    },
    {
      name: 'Freeport LNG',
      type: 'lng',
      lat: 28.94,
      lng: -95.31,
      capacity_description: '15 MTPA',
      status: 'operational',
      destination_regions: ['Asia', 'Europe'],
      operator: 'Freeport LNG Development',
      summary: 'A three-train LNG liquefaction facility on Quintana Island near Freeport, Texas. It draws natural gas from multiple Gulf Coast pipeline interconnects and exports LNG to global markets.',
      source_url: 'https://www.freeportlng.com',
    },
    {
      name: 'Cameron LNG',
      type: 'lng',
      lat: 29.77,
      lng: -93.33,
      capacity_description: '12 MTPA',
      status: 'operational',
      destination_regions: ['Asia', 'Europe'],
      operator: 'Sempra Energy',
      summary: 'A three-train LNG export facility in Hackberry, Louisiana. Originally built as an import terminal, it was converted to liquefaction and export in 2019, serving long-term offtake agreements with Japanese and European buyers.',
      source_url: 'https://www.sempra.com/cameron-lng',
    },
    {
      name: 'LOOP (Louisiana Offshore Oil Port)',
      type: 'oil',
      lat: 28.88,
      lng: -90.03,
      capacity_description: '1.2M bpd — largest US oil import terminal',
      status: 'operational',
      destination_regions: ['US Gulf Coast Refineries'],
      operator: 'LOOP LLC',
      summary: 'The only US deepwater oil port capable of offloading ultra-large crude carriers (ULCCs). Located 18 miles offshore Louisiana, LOOP handles roughly 15% of all US oil imports and also provides offshore storage via underground salt dome caverns.',
      source_url: 'https://www.loopllc.com',
    },
    {
      name: 'Corpus Christi LNG',
      type: 'lng',
      lat: 27.83,
      lng: -97.12,
      capacity_description: '15 MTPA',
      status: 'operational',
      destination_regions: ['Asia', 'Europe', 'Latin America'],
      operator: 'Cheniere Energy',
      summary: 'Cheniere\'s second major LNG export facility, located near Corpus Christi, Texas. It has three operational trains with additional capacity under construction, drawing gas from the prolific Permian and Eagle Ford basins.',
      source_url: 'https://www.cheniere.com/terminals/corpus-christi',
    },
  ]
}

export function getRefineries(): RefineryFacility[] {
  return [
    {
      name: 'Sturgeon Refinery',
      type: 'upgrader',
      lat: 53.75,
      lng: -113.22,
      capacity_bpd: 79_000,
      products: ['synthetic crude', 'diesel'],
      operator: 'North West Redwater Partnership',
      summary: 'Alberta\'s first greenfield refinery in decades, designed to process bitumen into synthetic crude and ultra-low-sulphur diesel. It captures CO2 for injection into the Redwater storage hub.',
      source_url: 'https://www.nwrpartnership.com',
    },
    {
      name: 'Irving Oil Refinery',
      type: 'refinery',
      lat: 45.25,
      lng: -66.05,
      capacity_bpd: 320_000,
      products: ['gasoline', 'diesel', 'jet fuel', 'heating oil'],
      operator: 'Irving Oil',
      summary: 'Canada\'s largest refinery by throughput, located in Saint John, NB. It processes both domestic and imported crude, supplying fuel across Atlantic Canada and the US Northeast.',
      source_url: 'https://www.irvingoil.com',
    },
    {
      name: 'Suncor Montreal Refinery',
      type: 'refinery',
      lat: 45.42,
      lng: -73.52,
      capacity_bpd: 137_000,
      products: ['gasoline', 'diesel', 'jet fuel', 'petrochemicals'],
      operator: 'Suncor Energy',
      summary: 'A major refinery in Montreal\'s east end, processing crude oil delivered via the Enbridge Mainline and Portland-Montreal pipeline to serve Quebec and northeastern markets.',
      source_url: 'https://www.suncor.com',
    },
    {
      name: 'Imperial Oil Strathcona Refinery',
      type: 'refinery',
      lat: 53.52,
      lng: -113.38,
      capacity_bpd: 187_000,
      products: ['gasoline', 'diesel', 'jet fuel', 'asphalt', 'lubricants'],
      operator: 'Imperial Oil',
      summary: 'One of Alberta\'s largest refineries, located near Edmonton. It processes a mix of conventional crude and oil sands production to supply fuels across Western Canada.',
      source_url: 'https://www.imperialoil.ca',
    },
    {
      name: 'Co-op Refinery Complex',
      type: 'refinery',
      lat: 50.44,
      lng: -104.58,
      capacity_bpd: 130_000,
      products: ['gasoline', 'diesel', 'jet fuel', 'propane'],
      operator: 'Federated Co-operatives Limited',
      summary: 'A major refinery in Regina, SK, supplying fuel to the Co-op retail network across Western Canada. It completed a major expansion in 2012 to increase diesel production capacity.',
      source_url: 'https://www.fcl.crs',
    },
    {
      name: 'Come By Chance Refinery',
      type: 'refinery',
      lat: 47.82,
      lng: -53.95,
      capacity_bpd: 130_000,
      products: ['gasoline', 'diesel', 'jet fuel', 'renewable diesel'],
      operator: 'Braya Renewable Fuels',
      summary: 'Newfoundland\'s sole refinery, now transitioning to produce renewable diesel from bio-feedstocks alongside conventional fuels. Its Atlantic location gives it advantageous access to European and eastern seaboard markets.',
      source_url: 'https://www.bfrfuels.com',
    },
  ]
}

export function getExportRoutes(): ExportRoute[] {
  return [
    {
      from: 'Kitimat, BC',
      from_lat: 54.05,
      from_lng: -128.68,
      to_region: 'Tokyo, Japan',
      to_lat: 35.68,
      to_lng: 139.69,
      product: 'LNG',
      volume_description: 'Up to 7 MTPA (LNG Canada allocation)',
      color: 0x00ffcc,
    },
    {
      from: 'Kitimat, BC',
      from_lat: 54.05,
      from_lng: -128.68,
      to_region: 'Shanghai, China',
      to_lat: 31.23,
      to_lng: 121.47,
      product: 'LNG',
      volume_description: 'Up to 5 MTPA (PetroChina offtake)',
      color: 0x00ddaa,
    },
    {
      from: 'Burnaby, BC',
      from_lat: 49.28,
      from_lng: -122.95,
      to_region: 'Busan, South Korea',
      to_lat: 35.18,
      to_lng: 129.08,
      product: 'Crude Oil',
      volume_description: 'Up to 300,000 bpd via Trans Mountain',
      color: 0xff8844,
    },
    {
      from: 'Saint John, NB',
      from_lat: 45.22,
      from_lng: -66.02,
      to_region: 'Rotterdam, Netherlands',
      to_lat: 51.92,
      to_lng: 4.47,
      product: 'Refined Products',
      volume_description: 'Gasoline and diesel exports from Irving refinery',
      color: 0x4488ff,
    },
    {
      from: 'Goldboro, NS',
      from_lat: 45.15,
      from_lng: -61.70,
      to_region: 'London, UK',
      to_lat: 51.51,
      to_lng: -0.13,
      product: 'LNG',
      volume_description: 'Up to 10 MTPA (proposed Goldboro LNG)',
      color: 0x44aaff,
    },
    {
      from: 'Kitimat, BC',
      from_lat: 54.05,
      from_lng: -128.68,
      to_region: 'Mumbai, India',
      to_lat: 19.08,
      to_lng: 72.88,
      product: 'LNG',
      volume_description: 'Spot and contract LNG cargoes',
      color: 0x22cc88,
    },
  ]
}

export function getImportFlows(): ExportRoute[] {
  return [
    {
      from: 'Ras Tanura, Saudi Arabia',
      from_lat: 26.64,
      from_lng: 50.16,
      to_region: 'LOOP, Louisiana',
      to_lat: 28.88,
      to_lng: -90.03,
      product: 'Crude Oil',
      volume_description: '~500,000 bpd Saudi crude imports',
      color: 0x7a8b99,
    },
    {
      from: 'Hardisty, Alberta',
      from_lat: 52.67,
      from_lng: -111.68,
      to_region: 'Chicago, US Midwest',
      to_lat: 41.88,
      to_lng: -87.63,
      product: 'Crude Oil',
      volume_description: '~2.5M bpd via Enbridge Mainline',
      color: 0x8899aa,
    },
    {
      from: 'Dawson Creek, BC',
      from_lat: 55.76,
      from_lng: -120.24,
      to_region: 'Seattle, US Pacific NW',
      to_lat: 47.61,
      to_lng: -122.33,
      product: 'Natural Gas',
      volume_description: 'BC Montney gas via Westcoast/Sumas interconnect',
      color: 0x6b8fa3,
    },
    {
      from: 'Dos Bocas, Mexico',
      from_lat: 18.44,
      from_lng: -93.19,
      to_region: 'Houston, US Gulf Coast',
      to_lat: 29.76,
      to_lng: -95.37,
      product: 'Crude Oil',
      volume_description: 'Mexican heavy crude imports to Gulf Coast refineries',
      color: 0x9a9aab,
    },
    {
      from: 'Valdez, Alaska',
      from_lat: 61.13,
      from_lng: -146.35,
      to_region: 'Long Beach, California',
      to_lat: 33.77,
      to_lng: -118.19,
      product: 'Crude Oil',
      volume_description: 'Alaska North Slope crude via tanker to West Coast refineries',
      color: 0x7090a0,
    },
  ]
}
