import '../../src/shared/base.css'
import {
  AgXToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
} from 'three'
import { RenderPipeline, WebGPURenderer } from 'three/webgpu'
import {
  unpackRGBToNormal,
  packNormalToRGB,
  float,
  hash,
  length,
  mix,
  mrt,
  nodeObject,
  normalView,
  output,
  pass,
  renderOutput,
  sample,
  saturation,
  screenUV,
  smoothstep,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { generateLandscape, specForIndex } from './generator'
import { mood as moodUniforms } from './materials'
import { MOODS, type Mood } from './moods'
import { buildCustomCells } from './terrain-pool'
import { padLandscape } from './fullscreen'
import { TILE_RADIUS, loadKit, type Board } from './tiles'

// --- Renderer -------------------------------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
// A stalled GPU process can leave requestAdapter() pending forever (seen in Chrome under memory
// pressure): give WebGPU a few seconds, then start on the WebGL2 backend instead of a black page.
const webgpuReady = await Promise.race([
  navigator.gpu?.requestAdapter().then((a) => !!a, () => false) ?? Promise.resolve(false),
  new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 6000)),
])
const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: !webgpuReady })
// The post stack (AO + DoF + bloom) is fill-bound: 1.5× by default, full 2× with ?hq for recordings.
const HQ = new URLSearchParams(window.location.search).has('hq')
/** Camera framing: < 1 is closer (crops the board edges), 1 fits the whole board. `?zoom=0.9` overrides. */
const ZOOM = Number(new URLSearchParams(window.location.search).get('zoom')) || 0.64
/** Full-bleed: the landscape runs past every screen edge. `?full` or the F key. */
let fullBleed = new URLSearchParams(window.location.search).has('full')
renderer.setPixelRatio(Math.min(window.devicePixelRatio, HQ ? 2 : 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = AgXToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFShadowMap
await renderer.init()

// --- Scene: floating diorama over a soft radial backdrop --------------------------------

const scene = new Scene()
if (import.meta.env.DEV) Object.assign(window, { __scene: scene, __renderer: renderer })

const bgCenter = uniform(new Color('#5f7d86'))
const bgEdge = uniform(new Color('#16242a'))
const bgDistance = length(screenUV.sub(vec2(0.5, 0.45)).mul(vec2(1.15, 1.0)))
scene.backgroundNode = mix(bgCenter, bgEdge, smoothstep(0.05, 0.85, bgDistance))

// --- Lights ----------------------------------------------------------------------------

const hemi = new HemisphereLight('#dce9f0', '#6e6450', 1.2)
scene.add(hemi)

const sun = new DirectionalLight('#fff1dc', 3.3)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.03
sun.shadow.radius = 2
scene.add(sun, sun.target)

let shadowRadius = 0
let liveShadowRadius = 0
function fitShadow(boardRadius: number) {
  shadowRadius = boardRadius
  const s = boardRadius + 4
  const cam = sun.shadow.camera
  cam.left = -s
  cam.right = s
  cam.top = s
  cam.bottom = -s
  cam.near = 1
  cam.far = 200
  cam.updateProjectionMatrix()
}

// Fixed pool of warm window lights: changing the light count would recompile every material.
const WINDOW_LIGHTS = Array.from({ length: 10 }, () => {
  const light = new PointLight('#ffb36b', 0, 2.6, 2)
  scene.add(light)
  return light
})

// --- Mood blending ---------------------------------------------------------------------------

const cloneMood = (m: Mood): Mood => {
  const out = { ...m }
  for (const k of Object.keys(out) as (keyof Mood)[]) {
    const v = out[k]
    if (v instanceof Color || v instanceof Vector3) (out as Record<string, unknown>)[k] = v.clone()
  }
  return out
}
let targetMood: Mood = MOODS.dia
let current: Mood = cloneMood(targetMood)
const bloomStrength = uniform(0.05)

function blendMood(dt: number) {
  // Fast: the new season must be in place before the next board rises out of the void.
  const a = 1 - Math.exp(-dt * 4.5)
  const m = current as Record<string, unknown>
  const t = targetMood as Record<string, unknown>
  for (const k of Object.keys(t)) {
    const from = m[k]
    const to = t[k]
    if (from instanceof Color && to instanceof Color) from.lerp(to, a)
    else if (from instanceof Vector3 && to instanceof Vector3) from.lerp(to, a).normalize()
    else m[k] = (from as number) + ((to as number) - (from as number)) * a
  }
  const c = current
  bgCenter.value.copy(c.bgCenter)
  bgEdge.value.copy(c.bgEdge)
  sun.color.copy(c.sunColor)
  sun.intensity = c.sunIntensity
  sun.position.copy(c.sunDir).multiplyScalar(80)
  hemi.color.copy(c.hemiSky)
  hemi.groundColor.copy(c.hemiGround)
  hemi.intensity = c.hemiIntensity
  renderer.toneMappingExposure = c.exposure
  bloomStrength.value = c.bloom
  moodUniforms.grassTint.value.copy(c.grassTint)
  moodUniforms.leafTint.value.copy(c.leafTint)
  moodUniforms.needleTint.value.copy(c.needleTint)
  moodUniforms.waterDeep.value.copy(c.waterDeep)
  moodUniforms.waterShallow.value.copy(c.waterShallow)
  moodUniforms.waterSky.value.copy(c.waterSky)
  moodUniforms.snowLine.value = c.snowLine
  moodUniforms.snowCover.value = c.snowCover
  moodUniforms.ice.value = c.ice
  moodUniforms.caustics.value = c.caustics
  moodUniforms.saturation.value = c.saturation
}

// --- Camera: high, low-FOV perspective sells the miniature -------------------------------

const camera = new PerspectiveCamera(22, window.innerWidth / window.innerHeight, 1, 600)
const ELEVATION = (40 * Math.PI) / 180
const AZIMUTH = (42 * Math.PI) / 180
/** Viewer orbit around the board (scroll wheel / drag); eased towards the goal. */
let yaw = 0
let yawGoal = 0
const target = new Vector3(0, 0.3, 0)
/** Where the camera aims for the live landscape: nudged towards the village. */
const targetGoal = new Vector3(0, 0.3, 0)
let distance = 60
let distanceGoal = 60
/** Point of interest the lens focuses on (the village, if any). */
const focus = new Vector3()
const focusGoal = new Vector3()

function distanceFor(boardRadius: number, zoom = 1) {
  const halfFov = (camera.fov * Math.PI) / 360
  const fitV = (boardRadius * 0.95) / Math.tan(halfFov)
  const fitH = (boardRadius * 1.0) / (Math.tan(halfFov) * camera.aspect)
  return Math.max(fitV * 0.8, fitH) * ZOOM * zoom
}

/**
 * Full-bleed framing: the farthest camera whose four screen corners still land on the
 * composed landscape (hex radius `cells`, world units per cell `R`), across the camera sway.
 */
function distanceInside(cells: number, R: number) {
  const probe = camera.clone()
  const ray = new Vector3()
  const hit = new Vector3()
  const fits = (d: number) => {
    for (const az of [AZIMUTH + yawGoal - 0.08, AZIMUTH + yawGoal + 0.08]) {
      probe.position.set(
        targetGoal.x + Math.cos(ELEVATION) * Math.cos(az) * d,
        targetGoal.y + Math.sin(ELEVATION) * d,
        targetGoal.z + Math.cos(ELEVATION) * Math.sin(az) * d,
      )
      probe.lookAt(targetGoal)
      probe.updateMatrixWorld()
      for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ray.set(nx, ny, 0.5).unproject(probe).sub(probe.position).normalize()
        if (ray.y >= -1e-3) return false
        const k = -probe.position.y / ray.y
        hit.copy(probe.position).addScaledVector(ray, k)
        const r = -hit.z / (1.5 * R)
        const q = hit.x / (Math.sqrt(3) * R) - r / 2
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > cells) return false
      }
    }
    return true
  }
  let lo = 4
  let hi = 200
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return lo
}

// --- Post: contact AO → depth-of-field tilt-shift → bloom → display-space grade ----------

const focusDistance = uniform(60)
const focalLength = uniform(6)
/** The focus band eases between landscapes instead of snapping. */
let focalGoal = 6
const bokehScale = uniform(3.6)

const pipeline = new RenderPipeline(renderer)
pipeline.outputColorTransform = false
const scenePass = pass(scene, camera)
scenePass.setMRT(mrt({ output, normal: packNormalToRGB(normalView) }))
const sceneColor = scenePass.getTextureNode('output')
const normalTexture = scenePass.getTextureNode('normal')
const sceneNormal = sample((uv) => unpackRGBToNormal(normalTexture.sample(uv)))
const aoPass = ao(scenePass.getTextureNode('depth'), sceneNormal, camera)
aoPass.resolutionScale = 0.5
aoPass.radius.value = 0.35
aoPass.thickness.value = 0.6
const occlusion = nodeObject(aoPass).getTextureNode().r
const occluded = vec4(sceneColor.rgb.mul(mix(float(1), occlusion, 0.75)), sceneColor.a)
// DepthOfFieldNode typings lag the runtime: wrap it so it composes like any vec4 node.
const blurred = nodeObject(dof(occluded, scenePass.getViewZNode(), focusDistance, focalLength, bokehScale)) as unknown as ReturnType<typeof vec4>
const glow = nodeObject(bloom(blurred, 1, 0.55, 0.82)) as unknown as ReturnType<typeof vec4>
const hdr = blurred.add(glow.mul(bloomStrength))
// Tone map first, then grade in display space: miniature photos read punchy and contrasty.
const display = renderOutput(hdr)
const contrasted = display.rgb.sub(0.5).mul(1.08).add(0.5)
const graded = saturation(contrasted, 1.08)
const vignette = smoothstep(0.38, 1.0, length(screenUV.sub(0.5).mul(vec2(1.2, 1.0))))
// hash() takes a scalar: fold both screen axes and time into one seed (a vec2 would only use x → stripes).
const grain = hash(screenUV.x.mul(1913.7).add(screenUV.y.mul(7919.3)).add(time.mul(13.17))).sub(0.5).mul(0.016)
pipeline.outputNode = vec4(graded.mul(mix(float(1), float(0.82), vignette)).add(vec3(grain)), 1)
if (import.meta.env.DEV) Object.assign(window, { __post: { pipeline, sceneColor, occluded, blurred, hdr, aoPass, renderOutput, focusDistance, focalLength, camera, scene, sun } })

// --- Landscapes --------------------------------------------------------------------------

const kit = await loadKit(new URL('../../assets/patagonia/', window.location.href).href)

type Show = {
  board: Board
  start: number
  exitStart: number | null
  window: number
  tilts: [number, number][]
  /** 0 at the centre … 1 at the rim: exits always sink centre-out, whatever the reveal pattern. */
  ring: number[]
  /** Per tile: earliest rise time, once the leaving board has cleared that spot. */
  notBefore: number[]
}
const shows: Show[] = []
const params = new URLSearchParams(window.location.search)
let index = Number(params.get('v') ?? 0) || 0

const RISE_DEPTH = 3.2
const RISE_TIME = 1.0
const GROW_DELAY = 0.3
const GROW_TIME = 0.75
const EXIT_TIME = 0.7
const EXIT_WINDOW = 1.0
/** How far a leaving cell has sunk before the new one may rise there (deep and small by then). */
const EXIT_GATE = EXIT_TIME * 0.7

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5)
const easeInCubic = (x: number) => x * x * x
// Soft overshoot: rises a hair above its rest height and settles.
const easeOutBack = (x: number, s = 1.15) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)

const now = () => performance.now() / 1000

const boardRadiusOf = (board: Board) => Math.max(...board.tiles.map((t) => Math.hypot(t.x, t.z))) + 2

/** Camera distance for the live landscape; recomputed on resize. */
let frame = () => distanceGoal

let buildToken = 0
async function showLandscape(i: number) {
  const token = ++buildToken
  const requested = now()
  const composed = generateLandscape(specForIndex(i))
  const PAD = 3
  const landscape = fullBleed ? padLandscape(composed, PAD) : composed
  // Terrain cells build in workers while the old board sinks; a newer click supersedes this one.
  const cells = await buildCustomCells(landscape, TILE_RADIUS)
  if (token !== buildToken) return
  const board = kit.buildBoard(landscape, cells)
  scene.add(board.group)

  const radius = boardRadiusOf(board)
  // Lens depth follows the composed landscape, not the full-bleed filler around it.
  const storyRadius = boardRadiusOf({ ...board, tiles: board.tiles.slice(0, composed.tiles.length) })
  targetMood = MOODS[landscape.spec.mood]

  // Focus on the village (the story of the shot); fall back to the board centre.
  const village = board.tiles.filter((t) => t.placement.tile === 'caserio')
  const centroid = new Vector3()
  for (const t of village) centroid.add(new Vector3(t.x, 0, t.z).divideScalar(village.length))
  focusGoal.copy(centroid).multiplyScalar(0.85).setY(0.2)
  // The camera leans towards the houses too, without losing the rest of the board.
  targetGoal.copy(centroid).multiplyScalar(0.45).setY(0.3)

  const full = fullBleed
  // Some variants frame closer (spec.zoom); moving in never uncovers a full-bleed edge.
  const zoom = composed.spec.zoom ?? 1
  frame = () => (full ? distanceInside(composed.spec.radius + PAD + 0.3, 2) * zoom : distanceFor(radius + targetGoal.length() * 0.5, zoom))
  distanceGoal = frame()
  // Shadow frustum only ever grows mid-transition (the old board still casts); it is
  // tightened again once the old board is gone. Snapping it would pop every shadow.
  liveShadowRadius = radius + targetGoal.length()
  fitShadow(Math.max(shadowRadius, liveShadowRadius))
  focalGoal = storyRadius * 0.48

  lastChange = now()
  const leaving = shows.filter((s) => s.exitStart !== null)
  const busy = leaving.length > 0
  shows.push({
    board,
    // No global wait for the old board: `notBefore` already holds each tile until its cell is clear.
    start: busy ? Math.max(now(), requested + 0.1) : now() + 0.2,
    exitStart: null,
    window: 0.9 + board.tiles.length * 0.012,
    tilts: board.tiles.map(() => [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3]),
    ring: board.tiles.map((t) => Math.hypot(t.x, t.z) / Math.max(1e-3, radius - 2)),
    // A tile rises only after every leaving board has sunk the ring it sits on, so the
    // new wave chases the old one outwards and the two never share a cell on screen.
    notBefore: board.tiles.map((t) => {
      const d = Math.hypot(t.x, t.z) + 2.5
      let at = 0
      for (const o of leaving) {
        const r = boardRadiusOf(o.board) - 2
        at = Math.max(at, o.exitStart! + EXIT_WINDOW * Math.min(1, d / Math.max(1e-3, r)) + EXIT_GATE)
      }
      return at
    }),
  })
}

// The diorama is static once built: only re-render the 4K shadow map while things move.
let lastChange = 0
sun.shadow.autoUpdate = false
const SETTLE_SECONDS = 7

function next() {
  for (const s of shows) if (s.exitStart === null) s.exitStart = now()
  index++
  void showLandscape(index)
  lastAdvance = now()
  lastChange = now()
}

function animateShow(s: Show, t: number) {
  s.board.tiles.forEach((tile, i) => {
    const begin = Math.max(s.start + s.window * easeInOutSine(tile.placement.reveal), s.notBefore[i])
    const p = clamp01((t - begin) / RISE_TIME)
    const g = clamp01((t - begin - GROW_DELAY) / GROW_TIME)

    let rise = p > 0 ? easeOutBack(p) : 0
    let size = easeOutQuint(clamp01(p * 1.6))
    let grow = g > 0 ? easeOutBack(g, 1.7) : 0
    if (s.exitStart !== null) {
      const exitDelay = EXIT_WINDOW * Math.min(1, s.ring[i])
      const e = clamp01((t - s.exitStart - exitDelay) / EXIT_TIME)
      rise *= 1 - easeInCubic(e)
      size *= 1 - easeInCubic(clamp01(e * 1.2))
      grow *= 1 - easeOutCubic(clamp01(e * 1.8))
    }
    const wobble = (1 - easeOutCubic(p)) * (s.exitStart === null ? 1 : 0)
    tile.y = -RISE_DEPTH * (1 - rise)
    tile.scale = size
    tile.grow = grow
    tile.tiltX = s.tilts[i][0] * wobble
    tile.tiltZ = s.tilts[i][1] * wobble
  })
  s.board.sync()
}

function disposeFinished(t: number) {
  for (let i = shows.length - 1; i >= 0; i--) {
    const s = shows[i]
    if (s.exitStart !== null && t - s.exitStart > EXIT_WINDOW + EXIT_TIME + 0.1) {
      scene.remove(s.board.group)
      s.board.dispose()
      shows.splice(i, 1)
      if (!shows.some((o) => o.exitStart !== null)) {
        fitShadow(liveShadowRadius)
        sun.shadow.needsUpdate = true
      }
    }
  }
}

/**
 * Each light stays bound to one house until that house has shrunk away, then goes to a house
 * that is still dark. Lights never jump while lit, and the leaving village dims out with its houses.
 */
const lightSlots: ({ board: Board; tile: number } | null)[] = WINDOW_LIGHTS.map(() => null)
function updateWindowLights() {
  const boards = new Set(shows.map((s) => s.board))
  const taken = new Set<string>()
  lightSlots.forEach((slot, k) => {
    const tile = slot && boards.has(slot.board) ? slot.board.tiles[slot.tile] : null
    if (!slot || !tile || (tile.grow < 0.005 && shows.find((s) => s.board === slot.board)?.exitStart != null)) lightSlots[k] = null
    else taken.add(`${slot.board.group.id}:${slot.tile}`)
  })
  const live = shows.find((s) => s.exitStart === null)
  if (live) {
    live.board.tiles.forEach((t, i) => {
      if (!t.light || taken.has(`${live.board.group.id}:${i}`)) return
      const free = lightSlots.indexOf(null)
      if (free < 0) return
      lightSlots[free] = { board: live.board, tile: i }
      taken.add(`${live.board.group.id}:${i}`)
    })
  }
  WINDOW_LIGHTS.forEach((light, k) => {
    const slot = lightSlots[k]
    if (!slot) {
      light.intensity = 0
      return
    }
    const tile = slot.board.tiles[slot.tile]
    slot.board.lightPosition(slot.tile, light.position)
    const flicker = 0.93 + Math.sin(performance.now() * 0.006 + light.position.x) * 0.04
    light.intensity = current.windows * 2.2 * flicker * clamp01(tile.grow) * (tile.scale > 0.01 ? 1 : 0)
  })
}

// --- Input: click / tap anywhere, space / arrows; A toggles autoplay -----------------------

let autoplay = params.has('auto')
const AUTO_SECONDS = Number(params.get('auto')) || 7
let lastAdvance = now()

// Orbiting changes what the corners see in full-bleed mode: refit the distance, at most once a frame.
let refit = false
function orbit(radians: number) {
  yawGoal += radians
  if (!refit) {
    refit = true
    requestAnimationFrame(() => {
      refit = false
      if (fullBleed) distanceGoal = frame()
    })
  }
}

// Scroll (wheel or two-finger swipe) orbits the camera instead of scrolling the page.
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
    const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit
    orbit(Math.max(-0.4, Math.min(0.4, delta * 0.0025)))
  },
  { passive: false },
)

// Click / tap advances; dragging orbits (a drag never counts as a click).
let downAt: { x: number; y: number } | null = null
let dragX = 0
canvas.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY }
  dragX = e.clientX
  canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointermove', (e) => {
  if (!downAt) return
  orbit((e.clientX - dragX) * -0.006)
  dragX = e.clientX
})
canvas.addEventListener('pointerup', (e) => {
  if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8) next()
  downAt = null
})
canvas.addEventListener('pointercancel', () => (downAt = null))
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') next()
  if (e.code === 'KeyF') {
    fullBleed = !fullBleed
    index--
    next()
  }
  if (e.code === 'KeyA') {
    autoplay = !autoplay
    lastAdvance = now()
  }
})

// Hide the cursor while idle so screen recordings stay clean.
let cursorTimer = 0
window.addEventListener('pointermove', () => {
  canvas.style.cursor = 'pointer'
  clearTimeout(cursorTimer)
  cursorTimer = window.setTimeout(() => (canvas.style.cursor = 'none'), 1200)
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  const live = shows.find((s) => s.exitStart === null)
  if (live) distanceGoal = frame()
})

// --- Loop --------------------------------------------------------------------------------

let last = now()
await showLandscape(index)
current = cloneMood(targetMood)
distance = distanceGoal * 1.15
focus.copy(focusGoal)
target.copy(targetGoal)
focalLength.value = focalGoal
const forward = new Vector3()

renderer.setAnimationLoop(() => {
  const t = now()
  const dt = Math.min(0.05, t - last)
  last = t

  if (autoplay && t - lastAdvance > AUTO_SECONDS) next()

  blendMood(dt)
  distance += (distanceGoal - distance) * (1 - Math.exp(-dt * 1.5))
  focus.lerp(focusGoal, 1 - Math.exp(-dt * 1.2))
  target.lerp(targetGoal, 1 - Math.exp(-dt * 1.2))
  focalLength.value += (focalGoal - focalLength.value) * (1 - Math.exp(-dt * 1.2))
  yaw += (yawGoal - yaw) * (1 - Math.exp(-dt * 6))
  const az = AZIMUTH + yaw + Math.sin(t * 0.06) * 0.07
  camera.position.set(
    target.x + Math.cos(ELEVATION) * Math.cos(az) * distance,
    target.y + Math.sin(ELEVATION) * distance,
    target.z + Math.cos(ELEVATION) * Math.sin(az) * distance,
  )
  camera.lookAt(target)
  // Focal plane through the point of interest, measured along the view axis.
  camera.getWorldDirection(forward)
  focusDistance.value = forward.dot(focus.clone().sub(camera.position))

  const settled = t - lastChange > SETTLE_SECONDS + (shows.at(-1)?.window ?? 0)
  if (!settled) {
    for (const s of shows) animateShow(s, t)
    sun.shadow.needsUpdate = true
  }
  disposeFinished(t)
  updateWindowLights()
  pipeline.render()
})
