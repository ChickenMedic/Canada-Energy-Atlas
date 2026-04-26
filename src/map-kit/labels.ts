// map-kit/labels.ts — Canvas-based THREE.Sprite labels and price-card sprites

export interface LabelOptions {
  width?: number
  height?: number
  fontSize?: number
  bgColor?: string
  textColor?: string
}

/**
 * Create a canvas-based THREE.Sprite with a rounded-rect background.
 * The first line is rendered bold; subsequent lines are smaller and tinted.
 *
 * @param T      THREE namespace (window.THREE)
 * @param lines  Array of text lines to render
 * @param opts   Visual options
 */
export function makeLabel(T: any, lines: string[], opts: LabelOptions = {}): any {
  const w = opts.width ?? 256
  const h = opts.height ?? 128
  const fs = opts.fontSize ?? 24

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  // Rounded-rect background
  ctx.fillStyle = opts.bgColor ?? 'rgba(0, 0, 0, 0.55)'
  ctx.beginPath()
  ctx.roundRect(4, 4, w - 8, h - 8, 6)
  ctx.fill()

  // Text
  ctx.fillStyle = opts.textColor ?? '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineH = fs * 1.3
  const startY = (h - lines.length * lineH) / 2 + lineH / 2

  lines.forEach((line, i) => {
    ctx.font = i === 0
      ? `bold ${fs}px Arial, sans-serif`
      : `${fs * 0.7}px Arial, sans-serif`
    if (i > 0) ctx.fillStyle = '#bbddff'
    ctx.fillText(line, w / 2, startY + i * lineH)
  })

  const texture = new T.CanvasTexture(canvas)
  const mat = new T.SpriteMaterial({map: texture, transparent: true, depthTest: false})
  return new T.Sprite(mat)
}

// ── Price card ──

export interface PriceCardData {
  symbol: string
  name: string
  price: number
  unit: string
  currency: string
  change: number
  changePercent: number
}

export interface PriceCardOptions {
  width?: number
  height?: number
  fontSize?: number
  bgColor?: string
  textColor?: string
}

/**
 * Create a price-card sprite (commodity ticker style).
 *
 * @param T     THREE namespace
 * @param data  Price data to display
 * @param opts  Visual options
 */
export function makePriceCard(T: any, data: PriceCardData, opts: PriceCardOptions = {}): any {
  const w = opts.width ?? 280
  const h = opts.height ?? 140
  const baseFontSize = opts.fontSize ?? 22

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  // Background
  ctx.fillStyle = opts.bgColor ?? 'rgba(5, 10, 25, 0.8)'
  ctx.beginPath()
  ctx.roundRect(4, 4, w - 8, h - 8, 8)
  ctx.fill()

  // Border — green if positive, red if negative
  const positive = data.change >= 0
  ctx.strokeStyle = positive
    ? 'rgba(60, 200, 120, 0.5)'
    : 'rgba(240, 80, 90, 0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(4, 4, w - 8, h - 8, 8)
  ctx.stroke()

  const cx = w / 2

  // Symbol
  ctx.fillStyle = opts.textColor ?? '#7ab3ff'
  ctx.font = `bold ${baseFontSize}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(data.symbol, cx, 30)

  // Name
  ctx.fillStyle = '#8899aa'
  ctx.font = `${Math.round(baseFontSize * 0.55)}px Arial, sans-serif`
  ctx.fillText(data.name, cx, 48)

  // Price
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(baseFontSize * 1.27)}px Arial, sans-serif`
  ctx.fillText(`$${data.price.toFixed(2)}`, cx, 80)

  // Unit
  ctx.fillStyle = '#667788'
  ctx.font = `${Math.round(baseFontSize * 0.55)}px Arial, sans-serif`
  ctx.fillText(`${data.currency}/${data.unit}`, cx, 98)

  // Change
  const arrow = positive ? '+' : ''
  const changeStr = `${arrow}${data.change.toFixed(2)} (${arrow}${data.changePercent.toFixed(1)}%)`
  ctx.fillStyle = positive ? '#3dd884' : '#f05565'
  ctx.font = `bold ${Math.round(baseFontSize * 0.73)}px Arial, sans-serif`
  ctx.fillText(changeStr, cx, 122)

  const texture = new T.CanvasTexture(canvas)
  const mat = new T.SpriteMaterial({map: texture, transparent: true, depthTest: false})
  return new T.Sprite(mat)
}
