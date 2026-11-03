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
  // One peak per mountain cell, jittered and of random height: neighbouring peaks merge into ranges.
  const peaks: { x: number; z: number; h: number; s: number }[] = []
  for (const t of landscape.tiles) {
    const [cx, cz] = axialToWorld(t.q, t.r, R)
    if (t.tile !== 'montana') {
      nonMountain.push([cx, cz])
      continue
    }
    const hash = (n: number) => {
      const v = Math.sin((t.q * 127.1 + t.r * 311.7 + seed * 0.13 + n * 74.7) * 43758.5453)
      return v - Math.floor(v)
    }
    peaks.push({
      x: cx + (hash(1) - 0.5) * R * 0.7,
      z: cz + (hash(2) - 0.5) * R * 0.7,
      h: 1.5 + hash(3) * 1.6,
      s: R * (0.62 + hash(4) * 0.3),
    })
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

  function mountainMask(x: number, z: number) {
    let d = Infinity
    for (const [cx, cz] of nonMountain) {
      const dd = (cx - x) ** 2 + (cz - z) ** 2
      if (dd < d) d = dd
    }
    // Wide foothill band: lone mountain cells become rounded hills, not steep cones.
    return smoothstep(0.82 * R, 2.6 * R, Math.sqrt(d))
  }

  function mountainHeight(x: number, z: number) {
    if (!peaks.length) return 0
    const m = mountainMask(x, z)
    if (m <= 0) return 0
    // Smooth max of gaussian peaks: close peaks fuse into ridges instead of standing alone.
    let sum = 0
    for (const p of peaks) {
      const dd = (p.x - x) ** 2 + (p.z - z) ** 2
      if (dd > 16 * p.s * p.s) continue
      sum += Math.exp(((p.h * Math.exp(-dd / (2 * p.s * p.s))) - 3) * 2.2)
    }
    const peak = sum > 0 ? Math.log(sum) / 2.2 + 3 : 0
    // Domain warp bends the ridges so they don't follow the noise lattice.
    const wx = x + (fbm(x * 0.4, z * 0.4, seed + 31, 2) - 0.5) * 1.6
    const wz = z + (fbm(x * 0.4 + 7, z * 0.4 - 3, seed + 32, 2) - 0.5) * 1.6
    const n = fbm(wx * 0.35 + 11, wz * 0.35 - 5, seed + 21, 4)
    const ridged = 1 - Math.abs(2 * fbm(wx * 0.55, wz * 0.55, seed + 22, 3) - 1)
    let body = Math.max(0, peak) * (0.72 + 0.45 * ridged * ridged) + 0.18 + 0.35 * n
    // Sharp crests and gullies: ridged octaves whose strength grows with altitude,
    // so foothills stay soft and the summits get craggy.
    const alt = smoothstep(0.3, 2.2, body)
    let crag = 0
    let amp = 0.32
    let f = 1.15
    for (let o = 0; o < 2; o++) {
      // Rounded ridge: |v| with a soft knee, so crests are bevelled instead of knife-edged.
      const v = 2 * fbm(wx * f, wz * f, seed + 50 + o, 2) - 1
      const r = 1 - Math.sqrt(v * v + 0.015)
      crag += (r * r - 0.3) * amp
      amp *= 0.5
      f *= 2.1
    }
    body += crag * (0.25 + alt)
    // Rock strata: soft terraces on the flanks read as layered cliffs.
    const step = 0.22
    const t = body / step
    const fl = Math.floor(t)
    const terr = (fl + smoothstep(0.1, 0.9, t - fl)) * step
    body = body + (terr - body) * 0.3 * smoothstep(0.35, 1.0, body)
    return Math.pow(m, 1.4) * Math.max(0, body)
  }

  function sample(x: number, z: number) {
    const s = waterSdf(x, z)
    const hm = mountainHeight(x, z)
    const carve = smoothstep(0.1, -0.28, s)
    const y = hm + (BED_DEPTH - hm) * carve + (fbm(x * 2.2, z * 2.2, seed + 1, 2) - 0.5) * 0.02 * (1 - carve)
    return { y, s, hm }
  }

  /** Conifer spots on a mountain cell: low and mid slopes, gentle enough, in noisy groves. */
  function mountainTrees(cx: number, cz: number) {
    const out: { x: number; z: number; y: number; s: number; r: number }[] = []
    const hash = (n: number) => {
      const v = Math.sin((cx * 12.9898 + cz * 78.233 + n * 37.719 + seed) * 43758.5453)
      return v - Math.floor(v)
    }
    for (let i = 0; i < 70; i++) {
      const a = hash(i * 3) * Math.PI * 2
      const d = Math.sqrt(hash(i * 3 + 1)) * R * 0.92
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      const y = mountainHeight(x, z)
      if (y < 0.05 || y > 1.25) continue
      const e = 0.05
      const gx = (mountainHeight(x + e, z) - mountainHeight(x - e, z)) / (2 * e)
      const gz = (mountainHeight(x, z + e) - mountainHeight(x, z - e)) / (2 * e)
      if (Math.hypot(gx, gz) > 1.25) continue
      if (fbm(x * 0.9, z * 0.9, seed + 40, 2) < 0.42) continue
      out.push({ x: x - cx, z: z - cz, y: y - 0.02, s: 0.75 + hash(i * 3 + 2) * 0.6 * (1.2 - y / 1.25), r: hash(i + 99) * Math.PI * 2 })
    }
    return out
  }

  /**
   * Surface normal straight from the field. Neighbouring cells sample the same function, so
   * shading runs seamlessly across cell borders (per-mesh vertex normals would crease there).
   */
  function normal(x: number, z: number, y = sample(x, z).y) {
    const e = 0.035
    const nx = y - sample(x + e, z).y
    const nz = y - sample(x, z + e).y
    const l = Math.hypot(nx, e, nz)
    return [nx / l, e / l, nz / l] as const
  }

  return { sample, waterSdf, mountainHeight, mountainTrees, normal }
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
  const nrm = new Float32Array(count * 3)
  pts.forEach(([x, z], i) => nrm.set(field.normal(cx + x, cz + z, heights[i]), i * 3))
  ground.setAttribute('normal', new BufferAttribute(nrm, 3))

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
      const steep = smoothstep(0.86, 0.62, normals.getY(i))
      // Height feeds the noise domain too, so cliff faces get bands instead of vertical smears.
      const wx = cx + x + y * 0.7
      const wz = cz + z - y * 0.5
      const warm = fbm(wx * 0.8, wz * 0.8, 77, 2)
      const strata = 0.5 + 0.5 * Math.sin(y * 9 + fbm(wx * 0.6, wz * 0.6, 79, 2) * 4)
      const rock = ROCK.clone()
        .lerp(ROCK_WARM, warm)
        .lerp(SCREE, smoothstep(0.3, 0.9, fbm(wx * 2.5, wz * 2.5, 78, 2)) * 0.4)
        .multiplyScalar(0.92 + strata * 0.12)
      const rocky = Math.max(steep, smoothstep(0.7, 1.5, mount[i]))
      c.lerp(rock, rocky)
    }
    colors.set([c.r, c.g, c.b], i * 3)
  }
  ground.setAttribute('color', new BufferAttribute(colors, 3))
  const surface = ground

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
    // Real water column under each vertex: drives colour, transparency and foam.
    water.setAttribute('depth', new BufferAttribute(heights.map((h) => Math.max(0, WATER_LEVEL - h)), 1))
    water.setIndex(tris)
    water.computeVertexNormals()
    if (waterWallPos.length) {
      waterWalls = new BufferGeometry()
      waterWalls.setAttribute('position', new BufferAttribute(new Float32Array(waterWallPos), 3))
      waterWalls.setAttribute('shore', new BufferAttribute(new Float32Array(waterWallPos.length / 3).fill(-1), 1))
      waterWalls.setAttribute('depth', new BufferAttribute(new Float32Array(waterWallPos.length / 3).fill(0.2), 1))
      waterWalls.setIndex(waterWallIdx)
      waterWalls.computeVertexNormals()
    }
  }
  return { ground: surface, walls, water, waterWalls }
}

export { key }
