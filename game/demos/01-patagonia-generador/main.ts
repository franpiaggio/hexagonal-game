import '../../src/shared/base.css'
import {
  AgXToneMapping,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
} from 'three'
import { RenderPipeline, WebGPURenderer } from 'three/webgpu'
import { float, length, mix, nodeObject, pass, screenUV, smoothstep, uniform, vec2, vec4 } from 'three/tsl'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { axialToWorld } from '../../src/shared/hex'
import { generateLandscape, specForIndex } from './generator'
import { mood as moodUniforms } from './materials'
import { MOODS, type Mood } from './moods'
import { createField } from './terrain'
import { loadKit, TILE_RADIUS, type TileInstance } from './tiles'

// --- Renderer -------------------------------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const renderer = new WebGPURenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = AgXToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFShadowMap
await renderer.init()

// --- Scene: floating diorama over a soft radial backdrop --------------------------------

const scene = new Scene()
if (import.meta.env.DEV) Object.assign(window, { __scene: scene })

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
sun.shadow.radius = 3
scene.add(sun, sun.target)

function fitShadow(boardRadius: number) {
  const s = boardRadius + 3
  const cam = sun.shadow.camera
  cam.left = -s
  cam.right = s
  cam.top = s
  cam.bottom = -s
  cam.near = 1
  cam.far = 160
  cam.updateProjectionMatrix()
}

// Fixed pool of warm window lights: changing the light count would recompile every material.
const WINDOW_LIGHTS = Array.from({ length: 8 }, () => {
  const light = new PointLight('#ffb36b', 0, 5, 2)
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

function blendMood(dt: number) {
  const a = 1 - Math.exp(-dt * 1.4)
  const m = current
  const t = targetMood
  m.bgCenter.lerp(t.bgCenter, a)
  m.bgEdge.lerp(t.bgEdge, a)
  m.sunColor.lerp(t.sunColor, a)
  m.sunDir.lerp(t.sunDir, a).normalize()
  m.hemiSky.lerp(t.hemiSky, a)
  m.hemiGround.lerp(t.hemiGround, a)
  m.grassTint.lerp(t.grassTint, a)
  m.leafTint.lerp(t.leafTint, a)
  m.needleTint.lerp(t.needleTint, a)
  m.waterDeep.lerp(t.waterDeep, a)
  m.waterShallow.lerp(t.waterShallow, a)
  m.waterSky.lerp(t.waterSky, a)
  m.sunIntensity += (t.sunIntensity - m.sunIntensity) * a
  m.hemiIntensity += (t.hemiIntensity - m.hemiIntensity) * a
  m.exposure += (t.exposure - m.exposure) * a
  m.snowLine += (t.snowLine - m.snowLine) * a
  m.saturation += (t.saturation - m.saturation) * a
  m.windows += (t.windows - m.windows) * a

  bgCenter.value.copy(m.bgCenter)
  bgEdge.value.copy(m.bgEdge)
  sun.color.copy(m.sunColor)
  sun.intensity = m.sunIntensity
  sun.position.copy(m.sunDir).multiplyScalar(70)
  hemi.color.copy(m.hemiSky)
  hemi.groundColor.copy(m.hemiGround)
  hemi.intensity = m.hemiIntensity
  renderer.toneMappingExposure = m.exposure
  moodUniforms.grassTint.value.copy(m.grassTint)
  moodUniforms.leafTint.value.copy(m.leafTint)
  moodUniforms.needleTint.value.copy(m.needleTint)
  moodUniforms.waterDeep.value.copy(m.waterDeep)
  moodUniforms.waterShallow.value.copy(m.waterShallow)
  moodUniforms.waterSky.value.copy(m.waterSky)
  moodUniforms.snowLine.value = m.snowLine
  moodUniforms.saturation.value = m.saturation
}

// --- Camera: low-FOV perspective sells the miniature ------------------------------------

const camera = new PerspectiveCamera(22, window.innerWidth / window.innerHeight, 1, 500)
const ELEVATION = (36 * Math.PI) / 180
const AZIMUTH = (42 * Math.PI) / 180
const target = new Vector3(0, 0.2, 0)
let distance = 60
let distanceGoal = 60

function distanceFor(boardRadius: number) {
  const halfFov = (camera.fov * Math.PI) / 360
  const fitV = (boardRadius * 0.95) / Math.tan(halfFov)
  const fitH = (boardRadius * 1.0) / (Math.tan(halfFov) * camera.aspect)
  return Math.max(fitV * 0.82, fitH)
}

// --- Post: depth-based tilt-shift + vignette --------------------------------------------

const focusDistance = uniform(60)
const focalLength = uniform(9)
const bokehScale = uniform(5)

const pipeline = new RenderPipeline(renderer)
const scenePass = pass(scene, camera)
// DepthOfFieldNode typings lag the runtime: wrap it so it composes like any vec4 node.
const blurred = nodeObject(
  dof(scenePass.getTextureNode(), scenePass.getViewZNode(), focusDistance, focalLength, bokehScale),
) as unknown as ReturnType<typeof vec4>
const vignette = smoothstep(0.38, 1.0, length(screenUV.sub(0.5).mul(vec2(1.2, 1.0))))
pipeline.outputNode = blurred.mul(mix(float(1), float(0.8), vignette))

// --- Landscapes --------------------------------------------------------------------------

const kit = await loadKit(new URL('../../assets/patagonia/', window.location.href).href)

type Show = { group: Group; tiles: TileInstance[]; start: number; exitStart: number | null; window: number }
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

function boardRadiusOf(tiles: TileInstance[]) {
  let r = 0
  for (const t of tiles) {
    const [x, z] = axialToWorld(t.placement.q, t.placement.r, TILE_RADIUS)
    r = Math.max(r, Math.hypot(x, z))
  }
  return r + TILE_RADIUS
}

function showLandscape(i: number) {
  const landscape = generateLandscape(specForIndex(i))
  const field = createField(landscape, TILE_RADIUS)
  const group = new Group()
  const tiles = landscape.tiles.map((p) => kit.createTile(p, field))
  for (const t of tiles) {
    t.root.userData.tilt = [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3]
    t.root.visible = false
    group.add(t.root)
  }
  scene.add(group)
  const radius = boardRadiusOf(tiles)
  distanceGoal = distanceFor(radius)
  fitShadow(radius)
  focalLength.value = radius * 0.55
  targetMood = MOODS[landscape.spec.mood]

  const lit = tiles.filter((t) => t.lightAnchor)
  WINDOW_LIGHTS.forEach((light, k) => (light.userData.anchor = lit[k]?.lightAnchor ?? null))

  const busy = shows.some((s) => s.exitStart !== null)
  shows.push({ group, tiles, start: now() + (busy ? EXIT_WINDOW * 0.6 : 0.2), exitStart: null, window: 1.6 + tiles.length * 0.028 })
}

function next() {
  for (const s of shows) if (s.exitStart === null) s.exitStart = now()
  index++
  showLandscape(index)
  lastAdvance = now()
}

function animateShow(s: Show, t: number) {
  for (const tile of s.tiles) {
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

    const root = tile.root
    root.visible = size > 0.002
    root.position.y = -RISE_DEPTH * (1 - rise)
    root.scale.setScalar(Math.max(size, 0.001))
    const [tx, tz] = root.userData.tilt as [number, number]
    const wobble = (1 - easeOutCubic(p)) * (s.exitStart === null ? 1 : 0)
    root.rotation.x = tx * wobble
    root.rotation.z = tz * wobble
    for (const prop of tile.props) {
      const [sx, sy, sz] = prop.scale
      prop.object.scale.set(sx, Math.max(grow * sy, 0.0001), sz)
    }
  }
}

function disposeFinished(t: number) {
  for (let i = shows.length - 1; i >= 0; i--) {
    const s = shows[i]
    if (s.exitStart !== null && t - s.exitStart > EXIT_WINDOW + EXIT_TIME + 0.1) {
      scene.remove(s.group)
      s.tiles.forEach((tile) => tile.dispose())
      shows.splice(i, 1)
    }
  }
}

const anchorPos = new Vector3()
function updateWindowLights() {
  for (const light of WINDOW_LIGHTS) {
    const anchor = light.userData.anchor as TileInstance['lightAnchor']
    const root = anchor?.parent
    if (!anchor || !root || !root.visible) {
      light.intensity = 0
      continue
    }
    anchor.getWorldPosition(anchorPos)
    light.position.copy(anchorPos)
    const flicker = 0.92 + Math.sin(performance.now() * 0.006 + anchorPos.x) * 0.05
    light.intensity = current.windows * 9 * flicker * Math.min(1, root.scale.x)
  }
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
  if (live) distanceGoal = distanceFor(boardRadiusOf(live.tiles))
})

// --- Loop --------------------------------------------------------------------------------

let last = now()
showLandscape(index)
current = cloneMood(targetMood)
distance = distanceGoal * 1.15

renderer.setAnimationLoop(() => {
  const t = now()
  const dt = Math.min(0.05, t - last)
  last = t

  if (autoplay && t - lastAdvance > AUTO_SECONDS) next()

  blendMood(dt)
  distance += (distanceGoal - distance) * (1 - Math.exp(-dt * 1.5))
  const az = AZIMUTH + Math.sin(t * 0.06) * 0.07
  camera.position.set(
    target.x + Math.cos(ELEVATION) * Math.cos(az) * distance,
    target.y + Math.sin(ELEVATION) * distance,
    target.z + Math.cos(ELEVATION) * Math.sin(az) * distance,
  )
  camera.lookAt(target)
  focusDistance.value = distance

  for (const s of shows) animateShow(s, t)
  disposeFinished(t)
  updateWindowLights()
  pipeline.render()
})
