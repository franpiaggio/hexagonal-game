import './style.css'
import { AgXToneMapping, PCFShadowMap, PerspectiveCamera, Scene, Spherical, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FAMILIES, FAMILY_LABELS, clamp, type Choice, type Plan, type TerrainData } from './landscape.ts'
import { createWorld, disposeLibrary, loadLibrary, type Library, type World } from './world.ts'
import { createPost } from './post.ts'
import { lightLandscape } from './lighting.ts'

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const canvas = element<HTMLCanvasElement>('landscape'), generate = element<HTMLButtonElement>('generate')
const announce = element('announcement')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const events = new AbortController(), eventOptions = { signal: events.signal }
const params = new URLSearchParams(location.search)
const inputSeed = Number(params.get('seed'))
let seed = Number.isInteger(inputSeed) && inputSeed > 0 && inputSeed < 4294967296 ? inputSeed : 73020
const inputFamily = params.get('paisaje')
const initialChoice: Choice = inputFamily && ['sorpresa', ...FAMILIES].includes(inputFamily) ? inputFamily as Choice : 'sorpresa'
const assetUrl = new URL('../../assets/atlas/atlas.glb', location.href).href
let busy = true, world: World | null = null, library: Library | null = null
let elapsed = 0, lastTime = performance.now(), dynamicRatio = 1.25
let disposed = false, frameCount = 0, sampleStarted = performance.now(), fps = 60, generationMS = 0
let lastCalls = 0, lastTriangles = 0
let renderer: WebGLRenderer
let worker: Worker | null = null
let requestId = 0
let onGenerate = () => {}
const pending = new Map<number, { resolve: (value: { plan: Plan; terrain: TerrainData }) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()

function showError(error: unknown) {
  console.error(error)
  announce.textContent = 'No pudimos preparar el paisaje. Activá el botón para volver a intentarlo.'
  busy = false; generate.disabled = false
  generate.setAttribute('aria-busy','false')
  generate.setAttribute('aria-label','Volver a intentar')
  generate.dataset.error = 'true'
  onGenerate = () => location.reload()
}
generate.addEventListener('click', () => onGenerate(), eventOptions)

async function boot() {
  generate.disabled = true
  renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.toneMapping = AgXToneMapping; renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.info.autoReset = false
  const scene = new Scene(), disposeLighting = lightLandscape(renderer,scene)
  const camera = new PerspectiveCamera(28, innerWidth / innerHeight, .2, 240)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true; controls.dampingFactor = .065; controls.enablePan = false
  controls.minDistance = 38; controls.maxDistance = 92
  controls.minPolarAngle = .40; controls.maxPolarAngle = .98
  controls.rotateSpeed = .55; controls.zoomSpeed = .65
  const post = createPost(renderer, scene, camera)
  const focus = new Vector3(0,.9,2), projected = new Vector3()
  let tween: { start: number; position: Vector3; target: Vector3; end: Vector3; aim: Vector3 } | null = null
  let transition: { start: number; duration: number; done: () => void } | null = null

  function finishTransition() {
    const done = transition?.done
    transition = null; post.transition(1); controls.enabled = true
    done?.()
  }
  function dissolve(initial: boolean) {
    if (reducedMotion.matches) return Promise.resolve()
    controls.enabled = false
    return new Promise<void>(done => { transition = { start: elapsed, duration: initial ? .85 : 1.35, done } })
  }

  function resize() {
    const pixels = innerWidth * innerHeight
    const ratio = Math.max(.65, Math.min(devicePixelRatio, dynamicRatio, Math.sqrt(1.65e6 / pixels)))
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix()
    renderer.setPixelRatio(ratio); renderer.setSize(innerWidth,innerHeight)
    post.resize(innerWidth,innerHeight,ratio)
  }
  addEventListener('resize', resize, eventOptions)
  resize()

  function home(immediate = false) {
    const aim = focus.clone()
    const distance = innerWidth < 700 ? 91 : 88
    const phi = .75, theta = -.24
    const position = new Vector3().setFromSpherical(new Spherical(distance,phi,theta)).add(aim)
    if (immediate || reducedMotion.matches) { camera.position.copy(position); controls.target.copy(aim); controls.update(); tween = null }
    else tween = { start: elapsed, position: camera.position.clone(), target: controls.target.clone(), end: position, aim }
  }
  function orbit(angle: number, vertical = 0) {
    tween = null
    const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    spherical.theta += angle; spherical.phi = clamp(spherical.phi + vertical, controls.minPolarAngle, controls.maxPolarAngle)
    camera.position.setFromSpherical(spherical).add(controls.target); controls.update()
  }
  function zoom(factor: number) {
    tween = null
    const offset = camera.position.clone().sub(controls.target)
    offset.setLength(clamp(offset.length() * factor, controls.minDistance, controls.maxDistance))
    camera.position.copy(controls.target).add(offset); controls.update()
  }
  async function replay() {
    if (!world || busy || reducedMotion.matches) return
    busy = true; generate.disabled = true; tween = null
    post.begin(true); await dissolve(false)
    if (disposed) return
    busy = false; generate.disabled = false
    announce.textContent = 'Paisaje enfocado.'
  }
  controls.addEventListener('start', () => { tween = null })
  addEventListener('keydown', event => {
    const target = event.target as HTMLElement
    if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return
    const key = event.key.toLowerCase()
    if (['arrowleft','arrowright','arrowup','arrowdown','+','=','-','0','n','r'].includes(key)) event.preventDefault()
    if (transition) return
    if (key === 'arrowleft') orbit(-.12)
    if (key === 'arrowright') orbit(.12)
    if (key === 'arrowup') orbit(0,-.06)
    if (key === 'arrowdown') orbit(0,.06)
    if (key === '+' || key === '=') zoom(.91)
    if (key === '-') zoom(1.10)
    if (key === '0') home()
    if (key === 'n') onGenerate()
    if (key === 'r') void replay()
  }, eventOptions)
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) finishTransition()
  }, eventOptions)

  worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<{ id: number; error?: string; plan: Plan; terrain: TerrainData }>) => {
    const request = pending.get(event.data.id); if (!request) return
    pending.delete(event.data.id); clearTimeout(request.timer)
    if (event.data.error) request.reject(new Error(event.data.error)); else request.resolve(event.data)
  }
  worker.onerror = () => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('No se pudo preparar el terreno. Recargá para volver a intentarlo.')) }
    pending.clear()
  }
  function requestTerrain(nextSeed: number, choice: Choice) {
    return new Promise<{ plan: Plan; terrain: TerrainData }>((resolve,reject) => {
      const id = ++requestId
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('El terreno tardó más de lo esperado. Volvé a intentarlo.')) }, 25000)
      pending.set(id,{resolve,reject,timer}); worker!.postMessage({id,seed:nextSeed,choice})
    })
  }
  async function replaceMap(nextSeed: number, initial = false) {
    busy = true; generate.disabled = true
    generate.setAttribute('aria-busy','true')
    generate.removeAttribute('data-error')
    const requestedChoice = initial ? initialChoice : 'sorpresa'
    announce.textContent = 'Preparando un nuevo paisaje.'
    const started = performance.now()
    try {
      const data = await requestTerrain(nextSeed,requestedChoice)
      if (disposed) return
      const next = createWorld(data.plan,data.terrain,library!)
      if (!reducedMotion.matches) post.begin(!initial)
      const offset = camera.position.clone().sub(controls.target)
      tween = null
      world?.dispose(); world = next; scene.add(world.group)
      seed = nextSeed; focus.fromArray(world.plan.focus)
      if (initial) home(true)
      else {
        // Preserve the viewer's angle and distance. The focus moves to the
        // next village under the dissolve, without an automatic camera swing.
        controls.target.copy(focus); camera.position.copy(focus).add(offset); controls.update()
      }
      renderer.shadowMap.needsUpdate = true
      const url = new URL(location.href); url.searchParams.set('seed',String(seed)); url.searchParams.set('paisaje',requestedChoice)
      history.replaceState(null,'',url)
      generationMS = Math.round(performance.now() - started)
      await dissolve(initial)
      if (disposed) return
      announce.textContent = `${world.plan.title}. ${FAMILY_LABELS[world.plan.family]}. Paisaje listo.`
      generate.setAttribute('aria-busy','false')
      busy = false; generate.disabled = false
      sampleStarted = performance.now(); frameCount = 0
    } catch(error) { finishTransition(); showError(error) }
  }
  async function newMap() {
    if (busy) return
    const values = crypto.getRandomValues(new Uint32Array(1))
    await replaceMap(values[0] || 1)
  }
  onGenerate = () => { void newMap() }

  function frame(now: number) {
    const dt = Math.min(.05,(now - lastTime) / 1000); lastTime = now; elapsed += dt
    if (tween) {
      const t = clamp((elapsed - tween.start) / 1.2), e = t * t * t * (t * (t * 6 - 15) + 10)
      camera.position.lerpVectors(tween.position,tween.end,e); controls.target.lerpVectors(tween.target,tween.aim,e)
      if (t === 1) tween = null
    }
    controls.update(dt)
    if (transition) {
      const progress = clamp((elapsed-transition.start) / transition.duration)
      post.transition(progress)
      if (progress === 1) finishTransition()
    }
    if (world) {
      world.time.value = reducedMotion.matches ? 0 : elapsed
      projected.copy(focus).project(camera); post.focus(clamp(projected.y * .5 + .5,.28,.68))
    }
    renderer.info.reset(); post.render()
    lastCalls = renderer.info.render.calls; lastTriangles = renderer.info.render.triangles
    frameCount++
    if (now - sampleStarted > 2500) {
      fps = frameCount / ((now - sampleStarted) / 1000)
      if (import.meta.env.DEV) canvas.dataset.performance = JSON.stringify({ seed, family: world?.plan.family, trees: world?.plan.trees.length, fps: Math.round(fps), pixelRatio: renderer.getPixelRatio(), drawCalls: lastCalls, triangles: lastTriangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, generationMS, camera: camera.position.toArray(), transitioning: !!transition })
      if (!busy) {
        if (fps < 50 && dynamicRatio > .78) { dynamicRatio = Math.max(.75,dynamicRatio - .15); resize() }
        else if (fps > 58 && dynamicRatio < 1.25) { dynamicRatio = Math.min(1.25,dynamicRatio + .05); resize() }
      }
      frameCount = 0; sampleStarted = now
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.setAnimationLoop(null)
    else { lastTime = sampleStarted = performance.now(); frameCount = 0; renderer.setAnimationLoop(frame) }
  }, eventOptions)
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); renderer.setAnimationLoop(null); showError(new Error('La conexión con el motor gráfico se interrumpió. Recargá para recuperar el paisaje.')) }, eventOptions)
  // Read-only diagnostics for reproducible QA; no per-frame DOM updates or analytics.
  Object.defineProperty(window,'__atlas',{ configurable:true, value: {
    snapshot: () => ({ seed, family: world?.plan.family, houses: world?.plan.houses.length, trees: world?.plan.trees.length, fps: Math.round(fps), pixelRatio: renderer.getPixelRatio(), drawCalls: lastCalls, triangles: lastTriangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, generationMS, busy, camera: camera.position.toArray(), target: controls.target.toArray(), transitioning: !!transition }),
  } })
  const cleanup = () => {
    if (disposed) return; disposed = true
    finishTransition()
    events.abort()
    renderer.setAnimationLoop(null); worker?.terminate()
    for (const request of pending.values()) clearTimeout(request.timer)
    pending.clear(); controls.dispose(); world?.dispose(); if (library) disposeLibrary(library)
    post.dispose(); disposeLighting(); renderer.dispose(); removeEventListener('resize',resize)
  }
  if (import.meta.hot) import.meta.hot.dispose(cleanup)
  addEventListener('pagehide', event => { if (!event.persisted) cleanup() },{once:true})
  library = await loadLibrary(assetUrl)
  home(true); renderer.setAnimationLoop(frame)
  await replaceMap(seed,true)
}
void boot().catch(showError)
