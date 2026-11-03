// Loads the optimized Patagonia kit and builds a board for one landscape.
//
// Draw-call budget: every kit part (forest canopy, houses, ground, soil block, slope conifers…)
// is ONE InstancedMesh for the whole board; per-tile animation only rewrites instance matrices.
// Only the custom terrain cells (water, mountains) are individual meshes.

import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
} from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { axialToWorld } from '../../src/shared/hex'
import type { KitTile, Landscape, Placement } from './generator'
import {
  createFoliageMaterial,
  createGroundMaterial,
  createPropMaterial,
  createSnowableMaterial,
  createSoilMaterial,
  createTreeMaterial,
  createWaterMaterial,
  mood,
} from './materials'
import { BASE_TOP, WATER_LEVEL } from './terrain'
import { createPropGeometries, scatterOnKit, type PropKind, type Spot } from './props'
import { unpack, type CustomCells } from './terrain-pool'
import type { Quality } from './quality'

export const TILE_RADIUS = 2
const BASE_HEIGHT = 1.6
// Mountains are fully procedural (terrain.ts): the kit's peak model is not loaded.
const KIT: KitTile[] = ['pradera', 'bosque', 'caserio']
const Y_AXIS = new Vector3(0, 1, 0)
const X_AXIS = new Vector3(1, 0, 0)
const Z_AXIS = new Vector3(0, 0, 1)

type Part = { geometry: BufferGeometry; material: Material; ground: boolean }

/** Animation state the caller writes each frame; `sync()` turns it into matrices. */
export type TileState = {
  placement: Placement
  x: number
  z: number
  y: number
  scale: number
  tiltX: number
  tiltZ: number
  grow: number
  /** Custom terrain cells own real meshes. */
  root: Group | null
  /** Tile-local spot for a warm window light (village cells). */
  light: Vector3 | null
}

export type Board = {
  group: Group
  tiles: TileState[]
  sync: () => void
  warmup: () => () => void
  lightPosition: (index: number, out: Vector3) => Vector3
  dispose: () => void
}

/**
 * Meshopt quantizes positions to int16 and stores the dequantization in the mesh transform.
 * Bake it into float geometry so parts can be instanced and scaled from the ground.
 */
function bakeQuantization(mesh: Mesh) {
  const geometry = mesh.geometry
  for (const name of ['position', 'normal', 'tangent'] as const) {
    const attr = geometry.getAttribute(name)
    if (!attr || attr.array instanceof Float32Array) continue
    const floats = new Float32Array(attr.count * attr.itemSize)
    for (let i = 0; i < attr.count; i++) {
      for (let c = 0; c < attr.itemSize; c++) floats[i * attr.itemSize + c] = attr.getComponent(i, c)
    }
    geometry.setAttribute(name, new BufferAttribute(floats, attr.itemSize))
  }
  geometry.applyMatrix4(mesh.matrixWorld)
}

const baseName = (name: string) => name.replace(/^Miniatura · /, '').replace(/\.\d+$/, '')

/**
 * A bush from a chunk of a kit tree's foliage: the `count` leaf triangles nearest to a seed
 * triangle (picked at `seedFrac` through the mesh), re-based on the ground and scaled to `height`.
 */
function harvestFoliage(source: BufferGeometry, seedFrac: number, count: number, height: number) {
  const g = source.index ? source.toNonIndexed() : source
  const pos = g.getAttribute('position')
  const tris = Math.floor(pos.count / 3)
  const v = new Vector3()
  const centre = (t: number, out: Vector3) => {
    out.set(0, 0, 0)
    for (let k = 0; k < 3; k++) out.add(v.fromBufferAttribute(pos, t * 3 + k))
    return out.divideScalar(3)
  }
  const seed = centre(Math.floor(seedFrac * tris), new Vector3())
  const c = new Vector3()
  const picked = Array.from({ length: tris }, (_, t) => ({ t, d: centre(t, c).distanceToSquared(seed) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((e) => e.t)
  const out = new BufferGeometry()
  for (const [name, attr] of Object.entries(g.attributes)) {
    const size = attr.itemSize
    const data = new Float32Array(picked.length * 3 * size)
    picked.forEach((t, j) => {
      for (let k = 0; k < 3; k++) for (let s = 0; s < size; s++) data[(j * 3 + k) * size + s] = attr.getComponent(t * 3 + k, s)
    })
    out.setAttribute(name, new BufferAttribute(data, size))
  }
  out.computeBoundingBox()
  const box = out.boundingBox!
  out.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
  // Scale by the largest extent (a flat chunk must not be blown up to the target height).
  const scale = height / Math.max(1e-3, box.max.y - box.min.y, (box.max.x - box.min.x) * 0.6, (box.max.z - box.min.z) * 0.6)
  out.scale(scale, scale, scale)
  // Sit slightly into the ground so the lowest cards never float.
  out.translate(0, -height * 0.12, 0)
  out.computeBoundingBox()
  return out
}

/**
 * Slender lenga/cypress-style conifer (~300 triangles), vertex coloured to sit next to the kit's
 * needle trees: many short drooping tiers with a jagged rim, a thin spire and muted olive needles.
 */
function createConiferGeometry() {
  const paint = (g: BufferGeometry, inner: Color, rim: Color) => {
    const pos = g.getAttribute('position')
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const c = Math.hypot(pos.getX(i), pos.getZ(i)) > 0.01 ? rim : inner
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new BufferAttribute(colors, 3))
    g.deleteAttribute('uv')
    return g.toNonIndexed()
  }
  const parts: BufferGeometry[] = []
  const bark = new Color('#3b2f25')
  parts.push(paint(new CylinderGeometry(0.006, 0.014, 0.74, 4).translate(0, 0.37, 0), bark, bark))
  const TIERS = 7
  const low = new Color('#26341f')
  const high = new Color('#435533')
  const tip = new Color('#5d6c3f')
  for (let k = 0; k < TIERS; k++) {
    const f = k / (TIERS - 1)
    const r = 0.012 + 0.085 * (1 - f) ** 0.85
    const h = 0.17 - 0.05 * f
    const y = 0.13 + f * 0.5
    const segments = 9
    const tier = new ConeGeometry(r, h, segments, 1, true)
    // Jagged, drooping rim: alternate rim vertices reach out and sag, others tuck in.
    const pos = tier.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > -h / 2 + 1e-4) continue
      const ang = Math.atan2(pos.getZ(i), pos.getX(i)) + k * 0.7
      const seg = Math.round((ang / (Math.PI * 2)) * segments)
      const out = seg % 2 ? 1.12 : 0.72
      pos.setXYZ(i, pos.getX(i) * out, pos.getY(i) - (out > 1 ? 0.025 : 0), pos.getZ(i) * out)
    }
    tier.rotateY(k * 0.9).translate(0, y + h / 2, 0)
    parts.push(paint(tier, low.clone().lerp(high, f), high.clone().lerp(tip, f)))
  }
  const merged = mergeGeometries(parts)!
  merged.computeVertexNormals()
  return merged
}

export async function loadKit(baseUrl: string, quality: Pick<Quality, 'props' | 'forestCopiesMax'> = { props: 1, forestCopiesMax: 3 }) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const shared = new Map<string, Material>()
  const ground = createGroundMaterial(WATER_LEVEL)
  const soil = createSoilMaterial()
  const water = createWaterMaterial()
  const treeMaterial = createTreeMaterial()
  const smallWater = new MeshStandardNodeMaterial({ roughness: 0.08, metalness: 0 })
  smallWater.colorNode = mood.waterShallow
  const parts = new Map<KitTile, Part[]>()

  const replace = (mat: Material): Material => {
    const name = baseName(mat.name)
    const cached = shared.get(name)
    if (cached) return cached
    const std = mat as MeshStandardMaterial
    let next: Material
    if (name === 'suelo y pasto') next = ground
    else if (name === 'agua') next = smallWater
    else if (std.alphaTest > 0 || std.transparent) next = createFoliageMaterial(std, name.includes('lenga'))
    else next = createSnowableMaterial(std)
    next.name = name
    shared.set(name, next)
    return next
  }

  await Promise.all(
    KIT.map(async (id) => {
      const gltf = await loader.loadAsync(`${baseUrl}${id}.glb`)
      const list: Part[] = []
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse((node) => {
        const mesh = node as Mesh
        if (!mesh.isMesh) return
        bakeQuantization(mesh)
        const material = replace(mesh.material as Material)
        const isGround = material.name === 'suelo y pasto'
        list.push({ geometry: mesh.geometry, material, ground: isGround || material.name === 'agua' })
      })
      parts.set(id, list)
    }),
  )

  const baseGeometry = new CylinderGeometry(TILE_RADIUS * 0.999, TILE_RADIUS * 0.999, BASE_HEIGHT, 6)
  baseGeometry.translate(0, BASE_TOP - BASE_HEIGHT / 2, 0)
  const conifer = createConiferGeometry()

  // Ground clutter spots per kit tile, found once by raycasting the tile's own meshes.
  // Bushes are cut from the kit's own lenga canopy (real leaf cards, texture and material), so
  // they match the trees instead of looking like a different, smoother art style.
  const lengaPart = parts.get('bosque')!.find((p) => p.material.name === 'hojas de lenga')!
  const propGeometry: Record<PropKind, BufferGeometry> = {
    ...createPropGeometries(),
    tuft: harvestFoliage(lengaPart.geometry, 0.37, 60, 0.09),
    shrub: harvestFoliage(lengaPart.geometry, 0.71, 160, 0.17),
  }
  const propMaterial = createPropMaterial()
  const leafy = (kind: PropKind) => kind === 'tuft' || kind === 'shrub'
  const KIT_PROPS: Partial<Record<KitTile, number>> = { pradera: 150, caserio: 110, bosque: 30 }
  const kitSpots = new Map<KitTile, Spot[]>()
  for (const [id, count] of Object.entries(KIT_PROPS) as [KitTile, number][]) {
    const solid = parts.get(id)!.filter((p) => !(p.material.alphaTest > 0 || p.material.transparent))
    const meshes = solid.map((p) => new Mesh(p.geometry))
    const groundMeshes = new Set(meshes.filter((_, j) => solid[j].material === ground))
    kitSpots.set(id, scatterOnKit(meshes, groundMeshes, TILE_RADIUS, Math.round(count * quality.props), KIT.indexOf(id) + 1))
  }

  /** `cells` holds the prebuilt water and mountain cells (see terrain-pool.ts). */
  function buildBoard(landscape: Landscape, cells: CustomCells): Board {
    const group = new Group()
    const owned: BufferGeometry[] = []
    type Entry = { tile: number; pre: Matrix4; prop: [number, number, number] | null }
    type Bucket = { geometry: BufferGeometry; material: Material; entries: Entry[]; cast: boolean; top: number; mesh?: InstancedMesh }
    const buckets = new Map<string, Bucket>()
    const add = (k: string, geometry: BufferGeometry, material: Material, entry: Entry, cast = true) => {
      let b = buckets.get(k)
      if (!b) {
        geometry.boundingBox ?? geometry.computeBoundingBox()
        buckets.set(k, (b = { geometry, material, entries: [], cast, top: Math.max(0, geometry.boundingBox!.max.y) }))
      }
      b.entries.push(entry)
    }
    const { villageCopies } = landscape.spec
    // Extra forest copies are the heaviest geometry on the board; weaker tiers draw fewer.
    const forestCopies = Math.min(landscape.spec.forestCopies, quality.forestCopiesMax)
    const hash = (q: number, r: number, n: number) => {
      const v = Math.sin((q * 127.1 + r * 311.7 + n * 74.7 + landscape.spec.seed) * 43758.5453)
      return v - Math.floor(v)
    }

    const rot = new Quaternion()
    const addProps = (i: number, placement: Placement, spots: Spot[], turn: number) => {
      const around = new Matrix4().makeRotationY(turn)
      spots.forEach((sp, j) => {
        // Each cell keeps its own subset so neighbouring meadows don't repeat.
        if (hash(placement.q, placement.r, 20 + j) < 0.2) return
        const local = new Matrix4().compose(
          new Vector3(sp.x, sp.y, sp.z),
          rot.setFromAxisAngle(Y_AXIS, sp.r),
          new Vector3(sp.s, sp.s, sp.s),
        )
        const material = leafy(sp.kind) ? lengaPart.material : propMaterial
        add(`prop:${sp.kind}`, propGeometry[sp.kind], material, { tile: i, pre: around.clone().multiply(local), prop: [1, 1, 1] }, leafy(sp.kind))
      })
    }

    const tiles: TileState[] = landscape.tiles.map((placement, i) => {
      const [x, z] = axialToWorld(placement.q, placement.r, TILE_RADIUS)
      const state: TileState = { placement, x, z, y: 0, scale: 0, tiltX: 0, tiltZ: 0, grow: 0, root: null, light: null }
      add('base', baseGeometry, soil, { tile: i, pre: new Matrix4(), prop: null }, false)

      if (placement.tile === 'agua' || placement.tile === 'montana') {
        const isMountain = placement.tile === 'montana'
        const root = new Group()
        root.matrixAutoUpdate = false
        const cell = cells.get(i)!
        const geo = {
          ground: unpack(cell.ground),
          walls: unpack(cell.walls),
          water: cell.water && unpack(cell.water),
          waterWalls: cell.waterWalls && unpack(cell.waterWalls),
        }
        const surface = new Mesh(geo.ground, ground)
        surface.receiveShadow = true
        surface.castShadow = isMountain
        const walls = new Mesh(geo.walls, soil)
        walls.receiveShadow = true
        root.add(surface, walls)
        owned.push(geo.ground, geo.walls)
        if (geo.water) {
          const w = new Mesh(geo.water, water)
          w.receiveShadow = true
          root.add(w)
          owned.push(geo.water)
        }
        if (geo.waterWalls) {
          root.add(new Mesh(geo.waterWalls, water))
          owned.push(geo.waterWalls)
        }
        group.add(root)
        state.root = root
        addProps(i, placement, cell.spots, 0)

        if (isMountain) {
          for (const t of cell.trees) {
            const pre = new Matrix4().compose(
              new Vector3(t.x, t.y, t.z),
              new Quaternion().setFromAxisAngle(Y_AXIS, t.r),
              new Vector3(t.s, t.s * (0.9 + (t.r % 0.4)), t.s),
            )
            add('conifer', conifer, treeMaterial, { tile: i, pre, prop: [1, 1, 1] })
          }
        }
        return state
      }

      const tile = placement.tile as KitTile
      const copies = placement.copies ?? (tile === 'bosque' ? forestCopies : tile === 'caserio' ? villageCopies : 1)
      for (let c = 0; c < copies; c++) {
        const turn = tile === 'caserio' ? Math.PI * c : ((Math.PI * 2) / 3) * c
        // No mirroring: a negative-determinant instance flips winding, and InstancedMesh can't
        // compensate per instance (the tile would render inside-out). Rotations give variety.
        const pre = new Matrix4().makeRotationY((placement.rot * Math.PI) / 3 + turn)
        const s = c === 0 ? 1 : 0.9
        parts.get(tile)!.forEach((part, p) => {
          if (part.ground && c > 0) return
          // Extra forest copies skip the trunks (~12k tris each), mostly hidden by the needles.
          if (c > 0 && tile === 'bosque' && part.material.name === 'madera') return
          add(`${tile}:${p}`, part.geometry, part.material, {
            tile: i,
            pre,
            prop: part.ground ? null : [s, placement.scale[1] * s, s],
          })
        })
      }
      const spots = kitSpots.get(tile)
      if (spots) addProps(i, placement, spots, (placement.rot * Math.PI) / 3)
      if (tile === 'caserio') state.light = new Vector3(0, 0.32, 0)
      return state
    })

    for (const [k, b] of buckets) {
      const mesh = new InstancedMesh(b.geometry, b.material, b.entries.length)
      mesh.frustumCulled = false
      mesh.name = k
      mesh.castShadow = b.cast
      mesh.receiveShadow = true
      b.mesh = mesh
      group.add(mesh)
    }

    const tileMatrices = tiles.map(() => new Matrix4())
    const zero = new Matrix4().makeScale(0, 0, 0)
    const m = new Matrix4()
    const s = new Matrix4()
    const s2 = new Matrix4()
    const q = new Quaternion()
    const qz = new Quaternion()
    const pos = new Vector3()
    const scl = new Vector3()

    // Last synced animation state per tile: a frame where nothing moved skips all the work.
    const lastState = new Float32Array(tiles.length * 6).fill(NaN)

    function sync() {
      let moved = false
      tiles.forEach((t, i) => {
        const k = i * 6
        if (lastState[k] === t.scale && lastState[k + 1] === t.y && lastState[k + 2] === t.tiltX && lastState[k + 3] === t.tiltZ && lastState[k + 4] === t.grow) return
        lastState.set([t.scale, t.y, t.tiltX, t.tiltZ, t.grow], k)
        moved = true
      })
      if (!moved) return
      tiles.forEach((t, i) => {
        if (t.scale <= 0.002) {
          tileMatrices[i].copy(zero)
        } else {
          q.setFromAxisAngle(X_AXIS, t.tiltX).multiply(qz.setFromAxisAngle(Z_AXIS, t.tiltZ))
          tileMatrices[i].compose(pos.set(t.x, t.y, t.z), q, scl.setScalar(t.scale))
        }
        if (t.root) {
          t.root.visible = t.scale > 0.002
          t.root.matrix.copy(tileMatrices[i])
          t.root.matrixWorldNeedsUpdate = true
        }
      })
      // Only visible instances are packed and drawn: while boards swap, hidden cells (not yet
      // risen, or already sunk) cost no vertex work in the colour, normal and shadow passes.
      for (const b of buckets.values()) {
        const mesh = b.mesh!
        let n = 0
        for (const e of b.entries) {
          const tile = tiles[e.tile]
          if (tile.scale <= 0.002 || (e.prop && tile.grow <= 0.001)) continue
          m.multiplyMatrices(tileMatrices[e.tile], e.pre)
          if (e.prop) {
            // Grow by rising out of the ground with a gentle stretch, never by flattening: a
            // squashed house lies coplanar with the grass and z-fights (flicker) as it emerges.
            const g = tile.grow
            const sink = (1 - Math.min(g, 1)) * (b.top * e.prop[1] + 0.01)
            m.multiply(s.makeTranslation(0, -sink, 0)).multiply(s2.makeScale(e.prop[0], e.prop[1] * (0.5 + 0.5 * g), e.prop[2]))
          }
          mesh.setMatrixAt(n++, m)
        }
        mesh.count = n
        mesh.visible = n > 0
        if (n > 0) {
          mesh.instanceMatrix.clearUpdateRanges()
          mesh.instanceMatrix.addUpdateRange(0, n * 16)
          mesh.instanceMatrix.needsUpdate = true
        }
      }
    }

    /** Makes every part drawable so its pipelines can be compiled ahead; call the result to re-hide. */
    function warmup() {
      for (const b of buckets.values()) {
        b.mesh!.count = Math.min(1, b.entries.length)
        b.mesh!.visible = true
      }
      for (const t of tiles) if (t.root) t.root.visible = true
      return () => {
        lastState.fill(NaN)
        sync()
      }
    }

    const lightPosition = (index: number, out: Vector3) =>
      out.copy(tiles[index].light ?? pos.set(0, 0, 0)).applyMatrix4(tileMatrices[index])

    function dispose() {
      owned.forEach((g) => g.dispose())
      for (const b of buckets.values()) b.mesh?.dispose()
    }

    sync()
    return { group, tiles, sync, warmup, lightPosition, dispose }
  }

  return { buildBoard }
}

export type Kit = Awaited<ReturnType<typeof loadKit>>
