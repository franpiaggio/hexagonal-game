// Device-adaptive quality. A tier is picked once at start from what the browser reveals about
// the device (backend, touch, cores, memory); while running, the render resolution follows
// the real frame rate, so a struggling GPU sheds pixels before it drops frames.

export type Tier = 'high' | 'medium' | 'low'

export type Quality = {
  tier: Tier
  /** Render-resolution range (device pixels per CSS pixel); the governor moves inside it. */
  maxDpr: number
  minDpr: number
  /** MSAA on the scene pass: 4× samples over a two-target MRT is a big share of fill cost. */
  antialias: boolean
  shadowMap: number
  /** Screen-space AO resolution scale; 0 disables AO (and the normal render target it needs). */
  ao: number
  /** Share of ground clutter kept (grass tufts, flowers, pebbles). */
  props: number
  forestCopiesMax: number
  /** Terrain cell subdivision (vertices per hex edge) for mountains and water. */
  mountainDetail: number
  waterDetail: number
  /** Warm window lights: each one is shaded on every lit pixel, so weak GPUs get fewer. */
  windowLights: number
  workers: number
}

// Resolution is budgeted in physical pixels, not as a multiple of CSS pixels: a phone has a small
// CSS viewport on a 3× screen, so "1×" there is a third of its real resolution (badly pixelated),
// while the same pixel count on a desktop is plenty. MSAA stays on everywhere: it is nearly free
// on the tile-based GPUs of phones, and aliasing reads as pixelation on small screens.
const TIERS: Record<Tier, Omit<Quality, 'tier' | 'maxDpr' | 'minDpr' | 'workers'> & { pixels: number; workersCap: number }> = {
  high: { pixels: 3.6e6, antialias: true, shadowMap: 4096, ao: 0.5, props: 1, forestCopiesMax: 3, mountainDetail: 40, waterDetail: 18, windowLights: 10, workersCap: 4 },
  medium: { pixels: 2.2e6, antialias: true, shadowMap: 2048, ao: 0.5, props: 0.65, forestCopiesMax: 2, mountainDetail: 32, waterDetail: 14, windowLights: 6, workersCap: 3 },
  low: { pixels: 1.4e6, antialias: true, shadowMap: 1024, ao: 0, props: 0.35, forestCopiesMax: 2, mountainDetail: 24, waterDetail: 12, windowLights: 4, workersCap: 2 },
}

function detectTier(webgpu: boolean): Tier {
  const forced = new URLSearchParams(window.location.search).get('quality')
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced
  // The WebGL2 fallback runs the same post stack noticeably slower.
  if (!webgpu) return 'low'
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency || 4
  const memory = nav.deviceMemory ?? 8
  const touch = window.matchMedia('(pointer: coarse)').matches
  const mobile = touch && Math.min(screen.width, screen.height) < 900
  if (mobile) return cores >= 8 && memory >= 6 ? 'medium' : 'low'
  if (cores <= 4 || memory <= 4) return 'medium'
  return 'high'
}

export function pickQuality(webgpu: boolean, hq: boolean): Quality {
  const tier = detectTier(webgpu)
  const { pixels, workersCap, ...rest } = TIERS[tier]
  const cores = navigator.hardwareConcurrency || 4
  const device = window.devicePixelRatio || 1
  const cssArea = Math.max(1, window.innerWidth * window.innerHeight)
  // Highest ratio that fits the tier's pixel budget, never above the screen's own density
  // (nor 2×), never below 1× unless the screen itself is below 1×.
  const budgeted = Math.sqrt(pixels / cssArea)
  const maxDpr = hq ? Math.min(device, 2) : Math.min(device, 2, Math.max(1, budgeted))
  return {
    tier,
    ...rest,
    maxDpr,
    // The governor may go down to ~2/3 of that before cutting effects instead.
    minDpr: Math.min(maxDpr, Math.max(0.75, maxDpr * 0.65)),
    workers: Math.max(1, Math.min(workersCap, cores - 1)),
  }
}

/**
 * Frame-rate governor. Every window of frames it compares the mean frame time with the budget.
 * Running late, it first lowers the render resolution; once that is at the tier's floor, it climbs
 * a ladder of heavier cuts (`degrade`, cheapest-looking first), one rung per slow window. With
 * comfortable headroom for a while, only the resolution climbs back: the cuts stay for the session
 * so the scene never oscillates between looks. Steps are rate-limited (each one costs a hitch).
 */
export function createGovernor(q: Quality, apply: (dpr: number) => void, degrade: (() => void)[] = []) {
  let dpr = q.maxDpr
  let sum = 0
  let frames = 0
  let windowStart = 0
  let calm = 0
  let lastStep = 0
  let rung = 0
  /** Slowest frame interval the governor asks for (a frame-rate cap raises it). */
  let floorInterval = 1 / 60
  /**
   * Shortest frame ever seen ≈ the display's refresh interval (60, 90, 120 Hz…). It only ever
   * shrinks: letting it drift up would make sustained slow frames look like a slow display.
   * Starts high so a display capped at 30 Hz (battery saver) settles at its own rate.
   */
  let refresh = 1 / 20

  return {
    get dpr() {
      return dpr
    },
    get rung() {
      return rung
    },
    /** A frame-rate cap changes what "on time" means (1/30 when rendering every other frame). */
    setFloorInterval(seconds: number) {
      floorInterval = seconds
      sum = 0
      frames = 0
      windowStart = 0
    },
    /** Call once per rendered frame with the time since the previous one; `busy` skips the sample. */
    frame(t: number, dt: number, busy: boolean) {
      if (dt > 0.004) refresh = Math.min(refresh, Math.max(1 / 144, dt))
      if (busy || dt <= 0 || dt > 0.25) return
      if (!windowStart) windowStart = t
      sum += dt
      frames++
      if (t - windowStart < 1.5) return
      const mean = sum / frames
      sum = 0
      frames = 0
      windowStart = t
      // Budget: hold the display rate, with slack for its jitter; never demand more than 60 fps.
      const budget = Math.max(refresh, floorInterval)
      if (t - lastStep < 2.5) return
      if (mean > budget * 1.3) {
        calm = 0
        if (dpr > q.minDpr) {
          dpr = Math.max(q.minDpr, dpr - (mean > budget * 1.8 ? 0.25 : 0.125))
          apply(dpr)
          lastStep = t
        } else if (rung < degrade.length) {
          degrade[rung++]()
          lastStep = t
        }
      } else if (mean < budget * 1.08 && dpr < q.maxDpr) {
        // Climb back only after sustained headroom, so it doesn't oscillate.
        if (++calm >= 3) {
          dpr = Math.min(q.maxDpr, dpr + 0.125)
          calm = 0
          lastStep = t
          apply(dpr)
        }
      } else calm = 0
    },
  }
}
