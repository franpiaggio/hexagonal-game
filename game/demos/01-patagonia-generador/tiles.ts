// Loads the optimized Patagonia kit and builds a board for one landscape.
//
// Draw-call budget: every kit part (forest canopy, houses, ground, soil block, slope conifers…)
// is ONE InstancedMesh for the whole board; per-tile animation only rewrites instance matrices.
// Only the custom terrain cells (water, mountains) are individual meshes.

import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
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
import { BASE_TOP, WATER_LEVEL, buildCustomTile, type Field } from './terrain'
import { createPropGeometries, scatterOnField, scatterOnKit, type Spot } from './props'

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

/** ~60-triangle conifer: trunk + three stacked cones, vertex coloured. */
function createConiferGeometry() {
  const paint = (g: BufferGeometry, r: number, gr: number, b: number) => {
    const colors = new Float32Array(g.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) colors.set([r, gr, b], i)
    g.setAttribute('color', new BufferAttribute(colors, 3))
    g.deleteAttribute('uv')
    return g
  }
  const trunk = paint(new CylinderGeometry(0.022, 0.03, 0.14, 5).translate(0, 0.07, 0), 0.16, 0.1, 0.06)
  const tiers = [
    [0.17, 0.26, 0.2, 0.09, 0.2, 0.12],
    [0.13, 0.22, 0.33, 0.1, 0.23, 0.13],
    [0.08, 0.18, 0.46, 0.12, 0.27, 0.15],
  ].map(([r, h, y, cr, cg, cb]) => paint(new ConeGeometry(r, h, 7).translate(0, y, 0), cr, cg, cb))
  const merged = mergeGeometries([trunk, ...tiers])!
  merged.computeVertexNormals()
  return merged
}

export async function loadKit(baseUrl: string) {
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
  const propGeometry = createPropGeometries()
  const propMaterial = createPropMaterial()
  const KIT_PROPS: Partial<Record<KitTile, number>> = { pradera: 150, caserio: 110, bosque: 30 }
  const kitSpots = new Map<KitTile, Spot[]>()
  for (const [id, count] of Object.entries(KIT_PROPS) as [KitTile, number][]) {
    const solid = parts.get(id)!.filter((p) => !(p.material.alphaTest > 0 || p.material.transparent))
    const meshes = solid.map((p) => new Mesh(p.geometry))
    const groundMeshes = new Set(meshes.filter((_, j) => solid[j].material === ground))
    kitSpots.set(id, scatterOnKit(meshes, groundMeshes, TILE_RADIUS, count, KIT.indexOf(id) + 1))
  }

  function buildBoard(landscape: Landscape, field: Field): Board {
    const group = new Group()
    const owned: BufferGeometry[] = []
    type Entry = { tile: number; pre: Matrix4; prop: [number, number, number] | null }
    type Bucket = { geometry: BufferGeometry; material: Material; entries: Entry[]; cast: boolean; mesh?: InstancedMesh }
    const buckets = new Map<string, Bucket>()
    const add = (k: string, geometry: BufferGeometry, material: Material, entry: Entry, cast = true) => {
      let b = buckets.get(k)
      if (!b) buckets.set(k, (b = { geometry, material, entries: [], cast }))
      b.entries.push(entry)
    }
    const { forestCopies, villageCopies } = landscape.spec
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
        add(`prop:${sp.kind}`, propGeometry[sp.kind], propMaterial, { tile: i, pre: around.clone().multiply(local), prop: [1, 1, 1] }, false)
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
        const geo = buildCustomTile(field, x, z, TILE_RADIUS, isMountain ? 40 : 18)
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
        addProps(i, placement, scatterOnField(field, x, z, TILE_RADIUS, isMountain, landscape.spec.seed), 0)

        if (isMountain) {
          for (const t of field.mountainTrees(x, z)) {
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
    const q = new Quaternion()
    const qz = new Quaternion()
    const pos = new Vector3()
    const scl = new Vector3()

    function sync() {
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
      for (const b of buckets.values()) {
        b.entries.forEach((e, j) => {
          m.multiplyMatrices(tileMatrices[e.tile], e.pre)
          if (e.prop) m.multiply(s.makeScale(e.prop[0], e.prop[1] * Math.max(tiles[e.tile].grow, 0.0001), e.prop[2]))
          b.mesh!.setMatrixAt(j, m)
        })
        b.mesh!.instanceMatrix.needsUpdate = true
      }
    }

    const lightPosition = (index: number, out: Vector3) =>
      out.copy(tiles[index].light ?? pos.set(0, 0, 0)).applyMatrix4(tileMatrices[index])

    function dispose() {
      owned.forEach((g) => g.dispose())
      for (const b of buckets.values()) b.mesh?.dispose()
    }

    sync()
    return { group, tiles, sync, lightPosition, dispose }
  }

  return { buildBoard }
}

export type Kit = Awaited<ReturnType<typeof loadKit>>
