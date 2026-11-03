// Continuous terrain for the cells the kit can't express: carved rivers/lakes and rocky massifs.
// One world-space field is sampled by every custom tile, so shapes flow across cell borders.

import { BufferAttribute, BufferGeometry, Color } from 'three'
import { axialToWorld, key } from '../../src/shared/hex'
import { fbm } from '../../src/shared/random'
import type { Landscape } from './generator'

export const WATER_LEVEL = -0.045
/** Top of the soil block every tile sits on. Overlaps the kit tiles' thin side faces. */
export const BASE_TOP = -0.06
const BED_DEPTH = -0.14

const GRASS = new Color('#8e9a75')
const SAND = new Color('#b9ae8c')
const MUD = new Color('#6b6250')
const ROCK = new Color('#8a8b86')
const ROCK_WARM = new Color('#857a6a')
const SCREE = new Color('#9a9686')

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export type Field = ReturnType<typeof createField>

export function createField(landscape: Landscape, R: number) {
  const seed = landscape.spec.seed
  const rivers = landscape.water.rivers.map((r) => ({
    pts: r.points.map(([x, z]) => [x * R, z * R] as [number, number]),
    hw: r.halfWidth * R,
  }))
  const lakes = landscape.water.lakes.map((b) => ({ x: b.x * R, z: b.z * R, r: b.r * R }))
  const nonMountain: [number, number][] = []
  for (const t of landscape.tiles) {
    if (t.tile !== 'montana') nonMountain.push(axialToWorld(t.q, t.r, R))
  }

  function waterSdf(x: number, z: number) {
    let s = Infinity
    for (const river of rivers) {
      let d = Infinity
      const p = river.pts
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i]
        const [bx, bz] = p[i + 1]
        const dx = bx - ax
        const dz = bz - az
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
        d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t))
      }
      const w = river.hw * (0.78 + 0.5 * fbm(x * 0.35, z * 0.35, seed + 9, 2))
      s = smin(s, d - w, 0.5)
    }
    if (lakes.length) {
      let l = Infinity
      for (const b of lakes) l = smin(l, Math.hypot(x - b.x, z - b.z) - b.r, 1.3)
      l += (fbm(x * 0.7, z * 0.7, seed + 3, 3) - 0.5) * 0.34
      s = smin(s, l, 0.6)
    }
    return s
  }

  function mountainHeight(x: number, z: number) {
    let d = Infinity
    for (const [cx, cz] of nonMountain) {
      const dd = (cx - x) ** 2 + (cz - z) ** 2
      if (dd < d) d = dd
    }
    d = Math.sqrt(d)
    const m = smoothstep(0.92 * R, 1.9 * R, d)
    if (m <= 0) return 0
    const n = fbm(x * 0.22 + 11, z * 0.22 - 5, seed + 21, 4)
    const ridged = 1 - Math.abs(2 * fbm(x * 0.42, z * 0.42, seed + 22, 3) - 1)
    return m * m * (0.12 + 0.7 * n + 0.55 * ridged * ridged) * 1.25
  }

  function sample(x: number, z: number) {
    const s = waterSdf(x, z)
    const hm = mountainHeight(x, z)
    const carve = smoothstep(0.1, -0.28, s)
    const y = hm + (BED_DEPTH - hm) * carve + (fbm(x * 2.2, z * 2.2, seed + 1, 2) - 0.5) * 0.02 * (1 - carve)
    return { y, s, hm }
  }

  return { sample, waterSdf, mountainHeight }
}

/** Barycentric subdivision of a pointy-top hexagon; returns local XZ points and triangle indices. */
function hexGrid(R: number, n: number) {
  const corners: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    corners.push([Math.cos(a) * R, -Math.sin(a) * R])
  }
  const pts: [number, number][] = []
  const index = new Map<string, number>()
  const tris: number[] = []
  const boundary: number[][] = [[], [], [], [], [], []]
  const id = (x: number, z: number) => {
    const k = `${x.toFixed(4)},${z.toFixed(4)}`
    let i = index.get(k)
    if (i === undefined) {
      i = pts.length
      pts.push([x, z])
      index.set(k, i)
    }
    return i
  }
  for (let s = 0; s < 6; s++) {
    const [ax, az] = corners[s]
    const [bx, bz] = corners[(s + 1) % 6]
    const at = (i: number, j: number) => id((ax * i + bx * j) / n, (az * i + bz * j) / n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; i + j < n; j++) {
        tris.push(at(i, j), at(i + 1, j), at(i, j + 1))
        if (i + j < n - 1) tris.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1))
      }
    }
    for (let i = n; i >= 0; i--) boundary[s].push(at(i, n - i))
  }
  return { pts, tris, boundary }
}

const GRID_CACHE = new Map<string, ReturnType<typeof hexGrid>>()
const grid = (R: number, n: number) => {
  const k = `${R}:${n}`
  if (!GRID_CACHE.has(k)) GRID_CACHE.set(k, hexGrid(R, n))
  return GRID_CACHE.get(k)!
}

export type CustomTileGeometry = {
  ground: BufferGeometry
  walls: BufferGeometry
  water: BufferGeometry | null
  waterWalls: BufferGeometry | null
}

/** Geometry for one custom cell centred at world (cx, cz), in tile-local coordinates. */
export function buildCustomTile(field: Field, cx: number, cz: number, R: number, detail: number): CustomTileGeometry {
  const { pts, tris, boundary } = grid(R, detail)
  const count = pts.length
  const pos = new Float32Array(count * 3)
  const shore = new Float32Array(count)
  const heights = new Float32Array(count)
  const mount = new Float32Array(count)
  let hasWater = false
  pts.forEach(([x, z], i) => {
    const s = field.sample(cx + x, cz + z)
    pos.set([x, s.y, z], i * 3)
    shore[i] = s.s
    heights[i] = s.y
    mount[i] = s.hm
    if (s.s < 0.1) hasWater = true
  })

  const ground = new BufferGeometry()
  ground.setAttribute('position', new BufferAttribute(pos, 3))
  ground.setIndex(tris)
  ground.computeVertexNormals()

  // Vertex colours: grass, sandy banks, wet mud below the waterline, rock on steep slopes.
  const normals = ground.getAttribute('normal')
  const colors = new Float32Array(count * 3)
  const c = new Color()
  for (let i = 0; i < count; i++) {
    const s = shore[i]
    const y = heights[i]
    const [x, z] = pts[i]
    c.copy(GRASS)
    const bank = smoothstep(0.22, 0.02, s)
    c.lerp(SAND, bank * 0.9)
    c.lerp(MUD, smoothstep(WATER_LEVEL + 0.01, WATER_LEVEL - 0.05, y))
    if (mount[i] > 0.02) {
      const steep = smoothstep(0.92, 0.7, normals.getY(i))
      const warm = fbm((cx + x) * 0.8, (cz + z) * 0.8, 77, 2)
      const rock = ROCK.clone().lerp(ROCK_WARM, warm).lerp(SCREE, smoothstep(0.3, 0.9, fbm((cx + x) * 2.5, (cz + z) * 2.5, 78, 2)) * 0.4)
      const rocky = Math.max(steep, smoothstep(0.25, 0.75, mount[i]))
      c.lerp(rock, rocky)
    }
    colors.set([c.r, c.g, c.b], i * 3)
  }
  ground.setAttribute('color', new BufferAttribute(colors, 3))

  // Soil walls around the cell, from the surface down to the soil block.
  const wallPos: number[] = []
  const wallIdx: number[] = []
  const waterWallPos: number[] = []
  const waterWallIdx: number[] = []
  for (const edge of boundary) {
    for (let k = 0; k < edge.length - 1; k++) {
      const a = edge[k]
      const b = edge[k + 1]
      const [ax, az] = pts[a]
      const [bx, bz] = pts[b]
      const base = wallPos.length / 3
      wallPos.push(ax, heights[a], az, bx, heights[b], bz, bx, BASE_TOP - 0.02, bz, ax, BASE_TOP - 0.02, az)
      wallIdx.push(base, base + 2, base + 1, base, base + 3, base + 2)
      if (heights[a] < WATER_LEVEL || heights[b] < WATER_LEVEL) {
        const wb = waterWallPos.length / 3
        const ay = Math.min(heights[a], WATER_LEVEL)
        const by = Math.min(heights[b], WATER_LEVEL)
        waterWallPos.push(ax, WATER_LEVEL, az, bx, WATER_LEVEL, bz, bx, by, bz, ax, ay, az)
        waterWallIdx.push(wb, wb + 2, wb + 1, wb, wb + 3, wb + 2)
      }
    }
  }
  const walls = new BufferGeometry()
  walls.setAttribute('position', new BufferAttribute(new Float32Array(wallPos), 3))
  walls.setIndex(wallIdx)
  walls.computeVertexNormals()

  let water: BufferGeometry | null = null
  let waterWalls: BufferGeometry | null = null
  if (hasWater) {
    const wpos = new Float32Array(count * 3)
    pts.forEach(([x, z], i) => wpos.set([x, WATER_LEVEL, z], i * 3))
    water = new BufferGeometry()
    water.setAttribute('position', new BufferAttribute(wpos, 3))
    water.setAttribute('shore', new BufferAttribute(shore, 1))
    water.setIndex(tris)
    water.computeVertexNormals()
    if (waterWallPos.length) {
      waterWalls = new BufferGeometry()
      waterWalls.setAttribute('position', new BufferAttribute(new Float32Array(waterWallPos), 3))
      waterWalls.setAttribute('shore', new BufferAttribute(new Float32Array(waterWallPos.length / 3).fill(-1), 1))
      waterWalls.setIndex(waterWallIdx)
      waterWalls.computeVertexNormals()
    }
  }
  return { ground, walls, water, waterWalls }
}

export { key }
