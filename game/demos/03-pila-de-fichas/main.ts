import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { axialToWorld, key, type Axial } from '../../src/shared/hex'
import { createRng } from '../../src/shared/random'
import { Board, EDGE_TYPES, makeDeck, makeTile, tileOf, type TileDef } from './rules'
import { HEX_R, PALETTE, drawTileIcon, edgeMarkers, loadKit, slotOutline, tileObject } from './kit'

const DECK_SIZE = 40
const NAMES = { pradera: 'Pradera', bosque: 'Bosque', caserio: 'Caserío', montana: 'Montaña', agua: 'Agua' }
const EDGE_COLOR = { match: '#5fbf6a', miss: '#e0a43a', blocked: '#d65a4a' }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// ---------- renderer / scene ----------
const canvas = $<HTMLCanvasElement>('game')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.AgXToneMapping
renderer.toneMappingExposure = 1.15

const scene = new THREE.Scene()
scene.background = new THREE.Color('#d9e1dc')
scene.fog = new THREE.Fog('#d9e1dc', 60, 130)

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 200)
camera.position.set(0, 15, 14)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.screenSpacePanning = false
controls.minDistance = 8
controls.maxDistance = 80
controls.minPolarAngle = 0.25
controls.maxPolarAngle = 1.15
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }

scene.add(new THREE.HemisphereLight('#f4efe2', '#6b7a6a', 1.6))
const sun = new THREE.DirectionalLight('#fff3dc', 2.6)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.02
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 })
scene.add(sun, sun.target)

// Soft ground disc that catches shadows under the board.
const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.ShadowMaterial({ opacity: 0.12 }))
ground.rotation.x = -Math.PI / 2
ground.position.y = -0.13
ground.receiveShadow = true
scene.add(ground)

// ---------- game state ----------
type Drop = { group: THREE.Group; t: number }
let board: Board
let deck: TileDef[]
let current: TileDef | undefined
let rot = 0
let shownAngle = 0
let score = 0
let seed = 0
let nextId = 0
let deckRng = createRng(1)
const tilesGroup = new THREE.Group()
const slotsGroup = new THREE.Group()
scene.add(tilesGroup, slotsGroup)
const drops: Drop[] = []

let preview: THREE.Group | undefined
const markers = new THREE.Group()
for (const m of edgeMarkers()) markers.add(m)
scene.add(markers)
let hovered: Axial | undefined

const outlineProto = slotOutline()

function cellPos(c: Axial) {
  const [x, z] = axialToWorld(c.q, c.r, HEX_R)
  return new THREE.Vector3(x, 0, z)
}

function worldToCell(x: number, z: number): Axial {
  const r = -z / (1.5 * HEX_R)
  const q = x / (Math.sqrt(3) * HEX_R) - r / 2
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return { q: rq, r: rr }
}

function newGame(newSeed = Math.floor(Math.random() * 1e6)) {
  seed = newSeed
  const url = new URL(location.href)
  url.searchParams.set('seed', String(seed))
  history.replaceState(null, '', url)

  tilesGroup.clear()
  drops.length = 0
  deckRng = createRng(seed)
  deck = makeDeck(deckRng, DECK_SIZE + 1)
  nextId = deck.length
  board = new Board()
  score = 0
  rot = 0
  shownAngle = 0

  // Start from a plain meadow so any first tile fits.
  deck.shift()
  addTile(tileOf('pradera', -1), 0, { q: 0, r: 0 }, false)
  takeNext()
  $<HTMLElement>('over').hidden = true
  controls.target.set(0, 0, 0)
  camera.position.set(0, 15, 14)
  refresh()
}

function addTile(def: TileDef, r: number, cell: Axial, animate: boolean) {
  board.place(def, r, cell)
  const group = tileObject(def)
  group.rotation.y = (r * Math.PI) / 3
  group.position.copy(cellPos(cell))
  tilesGroup.add(group)
  if (animate) {
    group.position.y = 1.2
    drops.push({ group, t: 0 })
  }
}

function takeNext() {
  current = deck.shift()
  // Discard tiles that cannot go anywhere (water facing land on every open slot).
  while (current && !board.fitsAnywhere(current)) {
    toast('Ficha sin lugar · se descarta')
    current = deck.shift()
  }
  if (preview) {
    scene.remove(preview)
    preview = undefined
  }
  if (current) {
    preview = tileObject(current)
    preview.visible = false
    scene.add(preview)
  }
}

function rotate(step: number) {
  if (!current) return
  rot += step
  refresh()
}

function place() {
  if (!current || !hovered || !board.isOpen(hovered)) return
  const ev = board.evaluate(current, rot, hovered)
  if (!ev.valid) {
    toast('El agua tiene que seguir en agua')
    return
  }
  addTile(current, rot, hovered, true)
  score += ev.points
  for (let i = 0; i < ev.bonusTiles; i++) deck.push(makeTile(deckRng, nextId++))
  if (ev.closed) toast(`Hexágono cerrado · +${ev.points} · +${ev.bonusTiles} fichas`)
  else if (ev.perfect) toast(`Encaje perfecto · +${ev.points} · +1 ficha`)
  else if (ev.points > 0) toast(`+${ev.points}`)
  takeNext()
  hovered = undefined
  refresh()
  if (!current) {
    $<HTMLElement>('final').textContent = String(score)
    $<HTMLElement>('over').hidden = false
  }
}

// ---------- HUD ----------
let toastTimer = 0
function toast(text: string) {
  const el = $<HTMLElement>('toast')
  el.textContent = text
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600)
}

const ctxOf = (id: string) => $<HTMLCanvasElement>(id).getContext('2d')!

function refresh() {
  $<HTMLElement>('score').textContent = String(score)
  $<HTMLElement>('left').textContent = String(deck.length + (current ? 1 : 0))

  const cur = ctxOf('current')
  if (current) drawTileIcon(cur, current, rot, 60)
  else cur.clearRect(0, 0, cur.canvas.width, cur.canvas.height)
  const n1 = ctxOf('next1')
  const n2 = ctxOf('next2')
  if (deck[0]) drawTileIcon(n1, deck[0], 0, 26)
  else n1.clearRect(0, 0, 64, 64)
  if (deck[1]) drawTileIcon(n2, deck[1], 0, 26)
  else n2.clearRect(0, 0, 64, 64)

  const zones = board.largestZones()
  $<HTMLElement>('zones').innerHTML =
    '<span class="label" style="grid-column: span 2">Zona más grande</span>' +
    EDGE_TYPES.map(
      (t) => `<span><i class="swatch" style="background:${PALETTE[t]}"></i>${NAMES[t]}</span><b>${(zones[t] / 6).toFixed(1)}</b>`,
    ).join('')

  // Open slots
  slotsGroup.clear()
  if (current) {
    for (const c of board.open()) {
      const o = new THREE.LineLoop(outlineProto.geometry, outlineProto.material)
      o.position.copy(cellPos(c))
      slotsGroup.add(o)
    }
  }
  updatePreview()
}

function updatePreview() {
  const show = !!(current && preview && hovered && board.isOpen(hovered))
  markers.visible = show
  if (preview) preview.visible = show
  if (!show || !current || !hovered) return
  const ev = board.evaluate(current, rot, hovered)
  const p = cellPos(hovered)
  preview!.position.set(p.x, 0.35, p.z)
  markers.position.set(p.x, 0, p.z)
  markers.children.forEach((m, k) => {
    const state = ev.edges[k]
    const mesh = m as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
    mesh.visible = state !== null
    if (state) mesh.material.color.set(EDGE_COLOR[state])
  })
}

// ---------- input ----------
const raycaster = new THREE.Raycaster()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const pointer = new THREE.Vector2()
let down: { x: number; y: number; button: number } | undefined

function pick(e: PointerEvent) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(plane, hit)) return undefined
  return worldToCell(hit.x, hit.z)
}

canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, button: e.button }
})
canvas.addEventListener('pointermove', (e) => {
  const c = pick(e)
  const changed = !hovered || !c || key(c.q, c.r) !== key(hovered.q, hovered.r)
  hovered = c && board.isOpen(c) ? c : undefined
  if (changed) updatePreview()
})
canvas.addEventListener('pointerup', (e) => {
  if (!down) return
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
  if (moved < 6) {
    if (down.button === 0) {
      const c = pick(e)
      if (c && board.isOpen(c)) {
        hovered = c
        place()
      }
    } else if (down.button === 2) rotate(-1)
  }
  down = undefined
})
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

window.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'Q') rotate(1)
  else if (e.key === 'e' || e.key === 'E' || e.key === 'r' || e.key === 'R') rotate(-1)
  else if (e.key === 'n' || e.key === 'N') newGame()
})
$<HTMLButtonElement>('ccw').onclick = () => rotate(1)
$<HTMLButtonElement>('cw').onclick = () => rotate(-1)
$<HTMLButtonElement>('again').onclick = () => newGame()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---------- loop ----------
const clock = new THREE.Clock()
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05)
  const time = clock.elapsedTime
  controls.update()

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]
    d.t = Math.min(1, d.t + dt / 0.35)
    d.group.position.y = 1.2 * (1 - easeOutBack(d.t))
    if (d.t >= 1) {
      d.group.position.y = 0
      drops.splice(i, 1)
    }
  }

  const target = (rot * Math.PI) / 3
  shownAngle += (target - shownAngle) * Math.min(1, dt * 14)
  if (preview?.visible) {
    preview.rotation.y = shownAngle
    preview.position.y = 0.35 + Math.sin(time * 3) * 0.04
  }

  const t = controls.target
  sun.position.set(t.x + 16, 32, t.z + 12)
  sun.target.position.copy(t)

  renderer.render(scene, camera)
})

await loadKit(new URL('../../assets/fichas/', window.location.href).href)
const urlSeed = Number(new URLSearchParams(location.search).get('seed'))
newGame(Number.isFinite(urlSeed) && urlSeed > 0 ? urlSeed : undefined)
