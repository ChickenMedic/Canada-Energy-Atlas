// map-kit/controls.ts — Pointer-driven spin / pan / zoom controls for a THREE.Group

export interface MapControlOptions {
  spinSpeed?: number
  panSpeed?: number
  zoomSpeed?: number
  minScale?: number
  maxScale?: number
  /** CSS selectors whose elements should NOT trigger map interaction (e.g. '#ui-panel, .overlay') */
  ignoreSelectors?: string
}

export interface MapControls {
  /** Remove all event listeners. Call when tearing down the scene. */
  dispose(): void
}

/**
 * Attach spin (left-click), pan (right-click), and zoom (wheel) controls to a
 * THREE.Group that represents the map.
 *
 * @param mapGroup   The THREE.Group to manipulate
 * @param getCamera  A function returning the active camera (called each frame so it stays current)
 * @param T          THREE namespace (window.THREE)
 * @param opts       Tuning options
 */
export function attachMapControls(
  mapGroup: any,
  getCamera: () => any,
  T: any,
  opts?: MapControlOptions,
): MapControls {
  const spinSpeed = opts?.spinSpeed ?? 0.005
  const panSpeed = opts?.panSpeed ?? 0.002
  const zoomSpeed = opts?.zoomSpeed ?? 0.001
  const minScale = opts?.minScale ?? 0.1
  const maxScale = opts?.maxScale ?? 5.0
  const ignoreSelectors = opts?.ignoreSelectors ?? ''

  let isSpinning = false
  let isPanning = false
  let previousX = 0
  let previousY = 0

  function shouldIgnore(e: Event): boolean {
    if (!ignoreSelectors) return false
    const target = e.target as HTMLElement | null
    if (!target || !target.closest) return false
    return !!target.closest(ignoreSelectors)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (shouldIgnore(e)) return
    if (e.button === 0) isSpinning = true
    else if (e.button === 2) isPanning = true
    previousX = e.clientX
    previousY = e.clientY
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isSpinning && !isPanning) return

    const dx = e.clientX - previousX
    const dy = e.clientY - previousY

    if (isSpinning) {
      // Horizontal spin around world Y
      mapGroup.rotateOnWorldAxis(new T.Vector3(0, 1, 0), dx * spinSpeed)

      // Vertical tilt around camera-relative right axis
      const cam = getCamera()
      if (cam) {
        const rightAxis = new T.Vector3(1, 0, 0)
        rightAxis.applyQuaternion(cam.quaternion)
        rightAxis.y = 0
        if (rightAxis.lengthSq() < 0.001) rightAxis.set(1, 0, 0)
        rightAxis.normalize()
        mapGroup.rotateOnWorldAxis(rightAxis, -dy * spinSpeed)
      }
    } else if (isPanning) {
      mapGroup.translateX(dx * panSpeed)
      mapGroup.translateY(-dy * panSpeed)
    }

    previousX = e.clientX
    previousY = e.clientY
  }

  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) isSpinning = false
    if (e.button === 2) isPanning = false
  }

  const onWheel = (e: WheelEvent) => {
    if (shouldIgnore(e)) return
    let s = mapGroup.scale.x - e.deltaY * zoomSpeed
    s = Math.max(minScale, Math.min(s, maxScale))
    mapGroup.scale.set(s, s, s)
  }

  const onContextMenu = (e: Event) => e.preventDefault()

  window.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointerleave', onPointerUp as EventListener)
  window.addEventListener('wheel', onWheel, {passive: false})

  return {
    dispose() {
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointerleave', onPointerUp as EventListener)
      window.removeEventListener('wheel', onWheel)
    },
  }
}
