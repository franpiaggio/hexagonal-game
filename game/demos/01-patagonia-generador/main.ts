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
  colorToDirection,
  directionToColor,
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
import { createField } from './terrain'
import { loadKit, type Board } from './tiles'

// --- Renderer -------------------------------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const renderer = new WebGPURenderer({ canvas, antialias: true })
// The post stack (AO + DoF + bloom) is fill-bound: 1.5× by default, full 2× with ?hq for recordings.
const HQ = new URLSearchParams(window.location.search).has('hq')
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

function fitShadow(boardRadius: number) {
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
  const a = 1 - Math.exp(-dt * 1.4)
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
const target = new Vector3(0, 0.3, 0)
let distance = 60
let distanceGoal = 60
/** Point of interest the lens focuses on (the village, if any). */
const focus = new Vector3()
const focusGoal = new Vector3()

function distanceFor(boardRadius: number) {
  const halfFov = (camera.fov * Math.PI) / 360
  const fitV = (boardRadius * 0.95) / Math.tan(halfFov)
  const fitH = (boardRadius * 1.0) / (Math.tan(halfFov) * camera.aspect)
  return Math.max(fitV * 0.8, fitH)
}

// --- Post: contact AO → depth-of-field tilt-shift → bloom → display-space grade ----------

const focusDistance = uniform(60)
const focalLength = uniform(6)
const bokehScale = uniform(6.5)

const pipeline = new RenderPipeline(renderer)
pipeline.outputColorTransform = false
const scenePass = pass(scene, camera)
scenePass.setMRT(mrt({ output, normal: directionToColor(normalView) }))
const sceneColor = scenePass.getTextureNode('output')
const normalTexture = scenePass.getTextureNode('normal')
const sceneNormal = sample((uv) => colorToDirection(normalTexture.sample(uv)))
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

// --- Landscapes --------------------------------------------------------------------------

const kit = await loadKit(new URL('../../assets/patagonia/', window.location.href).href)

type Show = { board: Board; start: number; exitStart: number | null; window: number; tilts: [number, number][] }
const shows: Show[] = []
const params = new URLSearchParams(window.location.search)
let index = Number(params.get('v') ?? 0) || 0

const RISE_DEPTH = 3.2
const RISE_TIME = 1.35
const GROW_DELAY = 0.45
const GROW_TIME = 1.0
const EXIT_TIME = 0.65
const EXIT_WINDOW = 0.8

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5)
const easeInCubic = (x: number) => x * x * x
// Soft overshoot: rises a hair above its rest height and settles.
const easeOutBack = (x: number, s = 1.15) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)

const now = () => performance.now() / 1000

const boardRadiusOf = (board: Board) => Math.max(...board.tiles.map((t) => Math.hypot(t.x, t.z))) + 2

function showLandscape(i: number) {
  const landscape = generateLandscape(specForIndex(i))
  const field = createField(landscape, 2)
  const board = kit.buildBoard(landscape, field)
  scene.add(board.group)

  const radius = boardRadiusOf(board)
  distanceGoal = distanceFor(radius)
  fitShadow(radius)
  focalLength.value = radius * 0.32
  targetMood = MOODS[landscape.spec.mood]

  // Focus on the village (the story of the shot); fall back to the board centre.
  const village = board.tiles.filter((t) => t.placement.tile === 'caserio')
  focusGoal.set(0, 0.2, 0)
  if (village.length) {
    for (const t of village) focusGoal.add(new Vector3(t.x, 0, t.z).divideScalar(village.length))
    focusGoal.multiplyScalar(0.7)
  }

  lastChange = now()
  const busy = shows.some((s) => s.exitStart !== null)
  shows.push({
    board,
    start: now() + (busy ? EXIT_WINDOW * 0.6 : 0.2),
    exitStart: null,
    window: 1.6 + board.tiles.length * 0.022,
    tilts: board.tiles.map(() => [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3]),
  })
}

// The diorama is static once built: only re-render the 4K shadow map while things move.
let lastChange = 0
sun.shadow.autoUpdate = false
const SETTLE_SECONDS = 7

function next() {
  for (const s of shows) if (s.exitStart === null) s.exitStart = now()
  index++
  showLandscape(index)
  lastAdvance = now()
}

function animateShow(s: Show, t: number) {
  s.board.tiles.forEach((tile, i) => {
    const delay = s.window * easeInOutSine(tile.placement.reveal)
    const p = clamp01((t - s.start - delay) / RISE_TIME)
    const g = clamp01((t - s.start - delay - GROW_DELAY) / GROW_TIME)

    let rise = p > 0 ? easeOutBack(p) : 0
    let size = easeOutQuint(clamp01(p * 1.6))
    let grow = g > 0 ? easeOutBack(g, 1.7) : 0
    if (s.exitStart !== null) {
      const exitDelay = EXIT_WINDOW * (1 - tile.placement.reveal)
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
    }
  }
}

function updateWindowLights() {
  const live = shows.find((s) => s.exitStart === null)
  const lit = live ? live.board.tiles.map((t, i) => [t, i] as const).filter(([t]) => t.light) : []
  WINDOW_LIGHTS.forEach((light, k) => {
    const entry = lit[k]
    if (!live || !entry || entry[0].scale < 0.01) {
      light.intensity = 0
      return
    }
    live.board.lightPosition(entry[1], light.position)
    const flicker = 0.93 + Math.sin(performance.now() * 0.006 + light.position.x) * 0.04
    light.intensity = current.windows * 2.2 * flicker * Math.min(1, entry[0].grow)
  })
}

// --- Input: click / tap anywhere, space / arrows; A toggles autoplay -----------------------

let autoplay = params.has('auto')
const AUTO_SECONDS = Number(params.get('auto')) || 7
let lastAdvance = now()

let downAt: { x: number; y: number } | null = null
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }))
canvas.addEventListener('pointerup', (e) => {
  if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8) next()
  downAt = null
})
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') next()
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
  if (live) distanceGoal = distanceFor(boardRadiusOf(live.board))
})

// --- Loop --------------------------------------------------------------------------------

let last = now()
showLandscape(index)
current = cloneMood(targetMood)
distance = distanceGoal * 1.15
focus.copy(focusGoal)
const forward = new Vector3()

renderer.setAnimationLoop(() => {
  const t = now()
  const dt = Math.min(0.05, t - last)
  last = t

  if (autoplay && t - lastAdvance > AUTO_SECONDS) next()

  blendMood(dt)
  distance += (distanceGoal - distance) * (1 - Math.exp(-dt * 1.5))
  focus.lerp(focusGoal, 1 - Math.exp(-dt * 1.2))
  const az = AZIMUTH + Math.sin(t * 0.06) * 0.07
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
