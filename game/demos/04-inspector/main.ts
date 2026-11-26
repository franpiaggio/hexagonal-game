// Inspector: one kit piece at a time, its objects (one per material primitive),
// edge types used by the game rules, and basic debug views.

import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { KINDS, edgeOf, tileOf, type Kind } from '../03-pila-de-fichas/rules'
import { HEX_R, APOTHEM, PALETTE } from '../03-pila-de-fichas/kit'

type Piece = { id: string; label: string; url: string; kind?: Kind }

const base = new URL('../../assets/', window.location.href).href
const LABELS: Record<Kind, string> = {
  pradera: 'Pradera',
  bosque: 'Bosque',
  caserio: 'Caserío',
  montana: 'Montaña',
  rio_recto: 'Río recto',
  rio_curvo: 'Río curvo',
  laguna: 'Laguna',
}
const HOUSES = ['01_cabana_alerce', '02_chalet_balcon', '03_casa_piedra', '04_casa_en_l', '05_casa_galeria']
const PIECES: Piece[] = [
  ...KINDS.map((kind) => ({ id: kind, label: LABELS[kind], url: `${base}fichas/${kind}.glb`, kind })),
  ...HOUSES.map((h) => ({
    id: h,
    label: h.slice(3).replace(/_/g, ' '),
    url: `${base}patagonia/casas/${h}.glb`,
  })),
]

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// ---------- scene ----------
const canvas = $<HTMLCanvasElement>('view')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.AgXToneMapping
renderer.toneMappingExposure = 1.15

const labelRenderer = new CSS2DRenderer()
$('labels').appendChild(labelRenderer.domElement)

const scene = new THREE.Scene()
const LIGHT_BG = new THREE.Color('#e4e8e2')
const DARK_BG = new THREE.Color('#1e211f')
scene.background = LIGHT_BG

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

scene.add(new THREE.HemisphereLight('#f4efe2', '#6b7a6a', 1.6))
const sun = new THREE.DirectionalLight('#fff3dc', 2.6)
sun.position.set(4, 8, 3)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.02
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 })
scene.add(sun)

const helpers = new THREE.Group()
const grid = new THREE.GridHelper(8, 16, '#9a9284', '#c9c2b4')
grid.position.y = -0.001
helpers.add(grid, new THREE.AxesHelper(1.2))
scene.add(helpers)

const edgesGroup = new THREE.Group()
scene.add(edgesGroup)

const pivot = new THREE.Group()
scene.add(pivot)
let boxHelper: THREE.Box3Helper | undefined

// ---------- state ----------
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const cache = new Map<string, { scene: THREE.Object3D; bytes: number }>()
let currentPiece: Piece = PIECES[0]
let meshes: THREE.Mesh[] = []
let solo: THREE.Mesh | undefined
let rot = 0

const opt = {
  wire: $<HTMLInputElement>('opt-wire'),
  edges: $<HTMLInputElement>('opt-edges'),
  grid: $<HTMLInputElement>('opt-grid'),
  box: $<HTMLInputElement>('opt-box'),
  dark: $<HTMLInputElement>('opt-dark'),
}

async function load(piece: Piece) {
  let entry = cache.get(piece.id)
  if (!entry) {
    const buffer = await (await fetch(piece.url)).arrayBuffer()
    const gltf = await loader.parseAsync(buffer, piece.url)
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
    })
    entry = { scene: gltf.scene, bytes: buffer.byteLength }
    cache.set(piece.id, entry)
  }
  return entry
}

async function select(piece: Piece) {
  currentPiece = piece
  rot = 0
  solo = undefined
  for (const b of document.querySelectorAll<HTMLButtonElement>('#pieces button')) {
    b.setAttribute('aria-pressed', String(b.dataset.id === piece.id))
  }
  const { scene: model, bytes } = await load(piece)
  if (currentPiece !== piece) return
  pivot.clear()
  pivot.rotation.y = 0
  pivot.add(model)
  meshes = []
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.visible = true
      meshes.push(m)
    }
  })
  applyWire()
  frame(model)
  renderObjects()
  renderStats(bytes)
  renderEdges()
  renderBox()
}

function frame(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const radius = Math.max(size.x, size.y, size.z, 0.5)
  controls.target.copy(centre)
  camera.position.copy(centre).add(new THREE.Vector3(0.9, 0.85, 1.1).normalize().multiplyScalar(radius * 1.9))
  camera.near = radius / 100
  camera.far = radius * 40
  camera.updateProjectionMatrix()
  const s = Math.max(radius, 2) * 1.2
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: s * 10 })
  sun.position.copy(centre).add(new THREE.Vector3(1, 2, 0.8).multiplyScalar(s))
  sun.target.position.copy(centre)
  sun.shadow.camera.updateProjectionMatrix()
  const gridSize = Math.ceil(radius * 2.5)
  grid.scale.setScalar(gridSize / 8)
}

const count = (g: THREE.BufferGeometry) => ({
  tris: (g.index ? g.index.count : g.getAttribute('position').count) / 3,
  verts: g.getAttribute('position').count,
})

const materialsOf = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]

function texturesOf(mat: THREE.MeshStandardMaterial) {
  return (['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const).filter((k) => mat[k])
}

function renderObjects() {
  const ul = $('objects')
  ul.innerHTML = ''
  for (const mesh of meshes) {
    const li = document.createElement('li')
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = mesh.visible
    box.onclick = (e) => {
      e.stopPropagation()
      mesh.visible = box.checked
    }
    const { tris, verts } = count(mesh.geometry)
    const mats = materialsOf(mesh)
    const flags = mats.flatMap((mat) => [
      mat.alphaTest > 0 ? 'alpha test' : '',
      mat.transparent ? 'transparente' : '',
      ...texturesOf(mat),
      mesh.geometry.getAttribute('color') ? 'vertex color' : '',
    ]).filter(Boolean)
    const text = document.createElement('span')
    text.innerHTML = `<span class="name">${mats.map((m) => m.name.replace(/\.\d+$/, '')).join(', ') || '(sin material)'}</span>
      <span class="meta">${mesh.name} · ${tris.toLocaleString('es')} tris · ${verts.toLocaleString('es')} verts</span>
      <span class="meta">${[...new Set(flags)].join(' · ')}</span>`
    li.append(box, text)
    li.onclick = () => {
      solo = solo === mesh ? undefined : mesh
      for (const m of meshes) m.visible = !solo || m === solo
      renderObjects()
    }
    if (solo === mesh) li.classList.add('solo')
    ul.append(li)
  }
}

function renderStats(bytes: number) {
  let tris = 0
  let verts = 0
  const mats = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  for (const m of meshes) {
    const c = count(m.geometry)
    tris += c.tris
    verts += c.verts
    for (const mat of materialsOf(m)) {
      mats.add(mat)
      for (const k of texturesOf(mat)) textures.add(mat[k] as THREE.Texture)
    }
  }
  const box = new THREE.Box3().setFromObject(pivot)
  const size = box.getSize(new THREE.Vector3())
  const rows: [string, string][] = [
    ['Archivo', `${currentPiece.url.split('/assets/')[1]} · ${(bytes / 1024).toFixed(0)} KB`],
    ['Objetos', String(meshes.length)],
    ['Triángulos', tris.toLocaleString('es')],
    ['Vértices', verts.toLocaleString('es')],
    ['Materiales', String(mats.size)],
    ['Texturas', [...textures].map((t) => `${(t.image as { width?: number } | undefined)?.width ?? '?'}px`).join(', ') || '0'],
    ['Tamaño', `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`],
  ]
  if (currentPiece.kind) {
    const def = tileOf(currentPiece.kind, 0)
    const types = def.edges.map((t, k) => `<span title="${t}"><i class="swatch" style="background:${PALETTE[t]}"></i>${k}</span>`).join(' ')
    rows.push(['Bordes', types])
  }
  $('stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
}

function renderEdges() {
  for (const o of [...edgesGroup.children]) {
    o.traverse((c) => {
      if (c instanceof CSS2DObject) c.element.remove()
    })
  }
  edgesGroup.clear()
  $('rot').textContent = String(rot)
  pivot.rotation.y = (rot * Math.PI) / 3
  if (!currentPiece.kind || !opt.edges.checked) return
  const def = tileOf(currentPiece.kind, 0)
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = ((60 * i + 30) * Math.PI) / 180
    return new THREE.Vector3(Math.cos(a) * HEX_R, 0.02, -Math.sin(a) * HEX_R)
  })
  edgesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2c2820' })))
  for (let k = 0; k < 6; k++) {
    const type = edgeOf(def, rot, k)
    const a = (k * Math.PI) / 3
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, HEX_R * 0.85), new THREE.MeshBasicMaterial({ color: PALETTE[type] }))
    bar.position.set(Math.cos(a) * APOTHEM, 0.04, -Math.sin(a) * APOTHEM)
    bar.rotation.y = a
    const el = document.createElement('span')
    el.className = 'edge-label'
    el.textContent = `${k} · ${type}`
    const label = new CSS2DObject(el)
    label.position.set(Math.cos(a) * APOTHEM * 1.22, 0.1, -Math.sin(a) * APOTHEM * 1.22)
    edgesGroup.add(bar, label)
  }
}

function renderBox() {
  if (boxHelper) {
    scene.remove(boxHelper)
    boxHelper = undefined
  }
  if (!opt.box.checked) return
  boxHelper = new THREE.Box3Helper(new THREE.Box3().setFromObject(pivot), '#c0563f')
  scene.add(boxHelper)
}

function applyWire() {
  for (const m of meshes) for (const mat of materialsOf(m)) mat.wireframe = opt.wire.checked
}

// ---------- UI ----------
const piecesEl = $('pieces')
const addGroup = (text: string) => {
  const g = document.createElement('span')
  g.className = 'group'
  g.textContent = text
  piecesEl.append(g)
}
addGroup('Fichas del kit')
PIECES.forEach((p, i) => {
  if (i === KINDS.length) addGroup('Casas')
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = p.label
  b.dataset.id = p.id
  b.onclick = () => select(p)
  piecesEl.append(b)
})

opt.wire.onchange = applyWire
opt.edges.onchange = renderEdges
opt.grid.onchange = () => (helpers.visible = opt.grid.checked)
opt.box.onchange = renderBox
opt.dark.onchange = () => (scene.background = opt.dark.checked ? DARK_BG : LIGHT_BG)
$('rot-ccw').onclick = () => {
  rot = (rot + 1) % 6
  renderEdges()
  renderBox()
}
$('rot-cw').onclick = () => {
  rot = (rot + 5) % 6
  renderEdges()
  renderBox()
}

// Hover readout
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const hover = $('hover')
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect()
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(meshes.filter((m) => m.visible), false)[0]
  hover.hidden = !hit
  if (hit) {
    const mesh = hit.object as THREE.Mesh
    const mat = materialsOf(mesh)[0]
    hover.textContent = `${mesh.name} · ${mat?.name ?? ''} · y ${hit.point.y.toFixed(3)}`
  }
})
canvas.addEventListener('pointerleave', () => (hover.hidden = true))

function resize() {
  const view = canvas.parentElement!
  const w = view.clientWidth
  const h = view.clientHeight
  renderer.setSize(w, h, false)
  labelRenderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
new ResizeObserver(resize).observe(canvas.parentElement!)
resize()

renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
})

const initial = PIECES.find((p) => p.id === new URLSearchParams(location.search).get('pieza')) ?? PIECES[0]
select(initial)
