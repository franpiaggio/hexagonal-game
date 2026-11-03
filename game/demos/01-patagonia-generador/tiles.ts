// Loads the optimized Patagonia kit and builds animatable tile instances:
// kit tiles for meadows / forest / village, custom terrain for water and mountains.

import { BufferAttribute, BufferGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, type Material } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { axialToWorld } from '../../src/shared/hex'
import { createRng } from '../../src/shared/random'
import type { KitTile, Placement } from './generator'
import {
  createFoliageMaterial,
  createGroundMaterial,
  createRockMaterial,
  createSoilMaterial,
  createWaterMaterial,
  mood,
} from './materials'
import { BASE_TOP, buildCustomTile, type Field } from './terrain'

export const TILE_RADIUS = 2
const BASE_HEIGHT = 1.6
const KIT: KitTile[] = ['pradera', 'bosque', 'caserio', 'montana']

export type Prop = { object: Object3D; scale: [number, number, number] }

/** A placed tile: `root` rises out of the void, `props` grow upwards from the ground. */
export type TileInstance = {
  placement: Placement
  root: Group
  props: Prop[]
  /** Where a warm window light goes at night (village tiles only). */
  lightAnchor: Object3D | null
  dispose: () => void
}

/**
 * Meshopt quantizes positions to int16 and stores the dequantization in the mesh transform.
 * Bake it into float geometry so props can be scaled from the ground without losing it.
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
  mesh.updateMatrix()
  geometry.applyMatrix4(mesh.matrix)
  mesh.position.set(0, 0, 0)
  mesh.rotation.set(0, 0, 0)
  mesh.scale.set(1, 1, 1)
}

const baseName = (name: string) => name.replace(/^Miniatura · /, '').replace(/\.\d+$/, '')

export async function loadKit(baseUrl: string) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const templates = new Map<KitTile, Group>()
  const shared = new Map<string, Material>()
  const ground = createGroundMaterial()
  const soil = createSoilMaterial()
  const water = createWaterMaterial()
  const smallWater = new MeshStandardNodeMaterial({ roughness: 0.08, metalness: 0 })
  smallWater.colorNode = mood.waterShallow

  const replace = (mat: Material): Material => {
    const name = baseName(mat.name)
    const cached = shared.get(name)
    if (cached) return cached
    const std = mat as MeshStandardMaterial
    let next: Material
    if (name === 'suelo y pasto') next = ground
    else if (name === 'agua') next = smallWater
    else if (std.alphaTest > 0 || std.transparent) next = createFoliageMaterial(std, name.includes('lenga'))
    else if (name.startsWith('roca')) next = createRockMaterial(std)
    else {
      // Keep the kit's textured PBR but drop its noisy normal maps.
      std.normalMap = null
      std.roughness = Math.max(std.roughness, 0.7)
      next = std
    }
    next.name = name
    shared.set(name, next)
    return next
  }

  await Promise.all(
    KIT.map(async (id) => {
      const gltf = await loader.loadAsync(`${baseUrl}${id}.glb`)
      const drop: Object3D[] = []
      gltf.scene.traverse((node) => {
        const mesh = node as Mesh
        if (!mesh.isMesh) return
        bakeQuantization(mesh)
        mesh.material = replace(mesh.material as Material)
        // Mountains: only the peak is reused; the massif under it is custom terrain.
        if (id === 'montana' && (mesh.material as Material).name === 'suelo y pasto') drop.push(mesh)
        mesh.castShadow = true
        mesh.receiveShadow = true
      })
      for (const d of drop) d.removeFromParent()
      templates.set(id, gltf.scene)
    }),
  )

  const baseGeometry = new CylinderGeometry(TILE_RADIUS * 0.999, TILE_RADIUS * 0.999, BASE_HEIGHT, 6)
  baseGeometry.translate(0, BASE_TOP - BASE_HEIGHT / 2, 0)

  function propsOf(model: Object3D, scale: [number, number, number]): Prop[] {
    const props: Prop[] = []
    model.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      if ((mesh.material as Material).name === 'suelo y pasto') return
      props.push({ object: mesh, scale })
    })
    return props
  }

  function createTile(placement: Placement, field: Field): TileInstance {
    const root = new Group()
    const [x, z] = axialToWorld(placement.q, placement.r, TILE_RADIUS)
    root.position.set(x, 0, z)

    const base = new Mesh(baseGeometry, soil)
    base.receiveShadow = true
    root.add(base)

    const owned: BufferGeometry[] = []
    let props: Prop[] = []
    let lightAnchor: Object3D | null = null

    if (placement.tile === 'agua' || placement.tile === 'montana') {
      const isMountain = placement.tile === 'montana'
      const geo = buildCustomTile(field, x, z, TILE_RADIUS, isMountain ? 22 : 18)
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
      if (isMountain) {
        const rng = createRng(placement.q * 7349 + placement.r * 31337 + 17)
        const peaks = rng.chance(0.4) ? 2 : 1
        for (let i = 0; i < peaks; i++) {
          const peak = templates.get('montana')!.clone(true)
          const jx = (rng() - 0.5) * (peaks > 1 ? 1.6 : 0.7)
          const jz = (rng() - 0.5) * (peaks > 1 ? 1.6 : 0.7)
          const h = field.mountainHeight(x + jx, z + jz)
          const k = i === 0 ? 1 : 0.55 + rng() * 0.25
          const [sx, sy, sz] = placement.scale
          peak.position.set(jx, h - 0.3 * sy * k, jz)
          peak.rotation.y = rng() * Math.PI * 2
          const holder = new Group()
          holder.add(peak)
          root.add(holder)
          props.push({ object: holder, scale: [sx * k, sy * k, sz * k] })
        }
      }
    } else {
      const model = templates.get(placement.tile)!.clone(true)
      root.add(model)
      model.rotation.y = (placement.rot * Math.PI) / 3
      if (placement.mirror) model.scale.z = -1
      props = propsOf(model, [1, placement.scale[1], 1])
      if (placement.tile === 'bosque') {
        // Denser woods: a second, rotated copy of the forest props.
        const extra = templates.get('bosque')!.clone(true)
        extra.rotation.y = model.rotation.y + Math.PI * (2 / 3)
        extra.scale.z = placement.mirror ? 1 : -1
        extra.traverse((node) => {
          const mesh = node as Mesh
          if (mesh.isMesh && (mesh.material as Material).name === 'suelo y pasto') mesh.visible = false
        })
        root.add(extra)
        props.push(...propsOf(extra, [0.92, placement.scale[1] * 0.9, 0.92]))
      }
      if (placement.tile === 'caserio') {
        lightAnchor = new Object3D()
        lightAnchor.position.set(0, 0.55, 0)
        root.add(lightAnchor)
      }
    }

    return {
      placement,
      root,
      props,
      lightAnchor,
      dispose: () => owned.forEach((g) => g.dispose()),
    }
  }

  return { createTile }
}

export type Kit = Awaited<ReturnType<typeof loadKit>>
