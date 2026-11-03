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

const TIERS: Record<Tier, Omit<Quality, 'tier' | 'maxDpr' | 'workers'> & { dprCap: number; workersCap: number }> = {
  high: { dprCap: 1.5, minDpr: 1, antialias: true, shadowMap: 4096, ao: 0.5, props: 1, forestCopiesMax: 3, mountainDetail: 40, waterDetail: 18, windowLights: 10, workersCap: 4 },
  medium: { dprCap: 1.25, minDpr: 0.85, antialias: true, shadowMap: 2048, ao: 0.5, props: 0.65, forestCopiesMax: 2, mountainDetail: 32, waterDetail: 14, windowLights: 6, workersCap: 3 },
  low: { dprCap: 1, minDpr: 0.7, antialias: false, shadowMap: 1024, ao: 0, props: 0.35, forestCopiesMax: 2, mountainDetail: 24, waterDetail: 12, windowLights: 4, workersCap: 2 },
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
  const { dprCap, workersCap, ...rest } = TIERS[tier]
  const cores = navigator.hardwareConcurrency || 4
  return {
    tier,
    ...rest,
    maxDpr: Math.min(window.devicePixelRatio || 1, hq ? 2 : dprCap),
    workers: Math.max(1, Math.min(workersCap, cores - 1)),
  }
}

/**
 * Frame-rate governor for the render resolution. Every window of frames it compares the mean
 * frame time with the budget: well over it, it steps the resolution down; comfortably under it
 * for a while, it steps back up. Steps are rate-limited, since each one reallocates targets.
 */
export function createGovernor(q: Quality, apply: (dpr: number) => void) {
  let dpr = q.maxDpr
  let sum = 0
  let frames = 0
  let windowStart = 0
  let calm = 0
  let lastStep = 0
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
    /** Call once per rendered frame with its duration in seconds; `busy` skips the sample. */
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
      const budget = Math.max(refresh, 1 / 60)
      if (t - lastStep < 2.5) return
      if (mean > budget * 1.3 && dpr > q.minDpr) {
        dpr = Math.max(q.minDpr, dpr - (mean > budget * 1.8 ? 0.25 : 0.125))
        calm = 0
        lastStep = t
        apply(dpr)
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
