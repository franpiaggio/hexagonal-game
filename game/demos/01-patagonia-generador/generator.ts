// Procedural layout of a Patagonia diorama on a pointy-top hex board.
// Pure data: no three.js here. Land cells use kit tiles; water cells (rivers, lakes) are
// described as smooth shapes so the renderer can carve them across cell borders.
// All distances are in "hex units" (circumradius = 1); the renderer scales them.

import { AXIAL_DIRS, axialToWorld, hexDistance, hexRegion, key, mod6, neighbor, type Axial } from '../../src/shared/hex'
import { createRng, fbm, type Rng } from '../../src/shared/random'

export type KitTile = 'pradera' | 'bosque' | 'caserio' | 'montana'
export type TileKind = KitTile | 'agua'
export type MoodId = 'dia' | 'atardecer' | 'otono' | 'noche' | 'invierno'

export type Placement = {
  tile: TileKind
  q: number
  r: number
  /** 60° steps around +Y. */
  rot: number
  /** Mirror across the X axis (scale.z = -1) before rotating. */
  mirror: boolean
  /** Per-tile prop scale (mountains vary the most). */
  scale: [number, number, number]
  /** 0..1, when this tile starts rising in the reveal animation. */
  reveal: number
  /** Overrides the spec's forest / village copies (filler tiles stay light). */
  copies?: number
  /** Filler around a full-bleed board: drawn lighter (no forest trunks under the canopy). */
  lite?: boolean
}

export type River = { points: [number, number][]; halfWidth: number }
export type LakeBlob = { x: number; z: number; r: number }
export type Water = { rivers: River[]; lakes: LakeBlob[] }

export type RevealMode = 'center' | 'spiral' | 'sweep' | 'river'

/** `chain` starts at an existing lake, so lakes and rivers string together. */
type RiverSpec = { from: 'lake' | 'edge' | 'chain'; to: 'lake' | 'edge' | 'any'; minLen: number }

export type LandscapeSpec = {
  seed: number
  radius: number
  /** 0..1, how much the outline departs from a perfect hexagon. */
  ragged: number
  rivers: RiverSpec[]
  /** Standalone lakes (besides those at river ends). */
  lakes: number
  /** Cells per lake, inclusive range. */
  lakeSize: [number, number]
  village: number
  mountains: { ranges: number; size: number }
  /** 0..1 share of the remaining land covered by forest. */
  forest: number
  reveal: RevealMode
  mood: MoodId
  /** Copies of the kit forest per forest cell (1..3): denser woods, same draw calls. */
  forestCopies: number
  /** Standalone houses per homestead cell (1..2); the kit village itself is drawn once. */
  villageCopies: number
  /** Camera distance multiplier: < 1 frames this landscape closer (default 1). */
  zoom?: number
}

export type Landscape = { spec: LandscapeSpec; tiles: Placement[]; water: Water }

/** Hand-tuned variants shown first; afterwards variants are derived from the index. */
export const CURATED: LandscapeSpec[] = [
  { seed: 11, radius: 3, ragged: 0.3, rivers: [{ from: 'lake', to: 'lake', minLen: 4 }], lakes: 0, lakeSize: [1, 3], village: 5, mountains: { ranges: 1, size: 5 }, forest: 0.45, reveal: 'center', mood: 'dia', forestCopies: 2, villageCopies: 2 },
  { seed: 101, radius: 4, ragged: 0.35, rivers: [{ from: 'edge', to: 'lake', minLen: 5 }, { from: 'chain', to: 'edge', minLen: 4 }], lakes: 0, lakeSize: [2, 4], village: 7, mountains: { ranges: 2, size: 6 }, forest: 0.5, reveal: 'sweep', mood: 'invierno', forestCopies: 3, villageCopies: 2 },
  { seed: 23, radius: 4, ragged: 0.4, rivers: [{ from: 'edge', to: 'lake', minLen: 4 }, { from: 'chain', to: 'lake', minLen: 3 }, { from: 'chain', to: 'edge', minLen: 3 }], lakes: 0, lakeSize: [2, 4], village: 10, mountains: { ranges: 1, size: 5 }, forest: 0.35, reveal: 'river', mood: 'atardecer', forestCopies: 2, villageCopies: 2, zoom: 0.8 },
  { seed: 41, radius: 4, ragged: 0.2, rivers: [{ from: 'edge', to: 'lake', minLen: 5 }], lakes: 0, lakeSize: [3, 5], village: 12, mountains: { ranges: 2, size: 7 }, forest: 0.3, reveal: 'center', mood: 'noche', forestCopies: 2, villageCopies: 2, zoom: 0.78 },
  { seed: 37, radius: 3, ragged: 0.55, rivers: [{ from: 'edge', to: 'lake', minLen: 3 }], lakes: 2, lakeSize: [2, 5], village: 3, mountains: { ranges: 1, size: 4 }, forest: 0.65, reveal: 'spiral', mood: 'otono', forestCopies: 3, villageCopies: 1 },
  { seed: 53, radius: 5, ragged: 0.5, rivers: [{ from: 'edge', to: 'lake', minLen: 5 }, { from: 'chain', to: 'lake', minLen: 4 }, { from: 'chain', to: 'edge', minLen: 4 }], lakes: 1, lakeSize: [2, 5], village: 9, mountains: { ranges: 2, size: 8 }, forest: 0.45, reveal: 'center', mood: 'dia', forestCopies: 2, villageCopies: 2 },
  { seed: 79, radius: 3, ragged: 0.45, rivers: [{ from: 'lake', to: 'lake', minLen: 3 }, { from: 'chain', to: 'lake', minLen: 3 }], lakes: 0, lakeSize: [2, 4], village: 5, mountains: { ranges: 1, size: 6 }, forest: 0.6, reveal: 'spiral', mood: 'invierno', forestCopies: 3, villageCopies: 2 },
  { seed: 67, radius: 4, ragged: 0.3, rivers: [{ from: 'edge', to: 'edge', minLen: 7 }], lakes: 1, lakeSize: [3, 6], village: 11, mountains: { ranges: 1, size: 5 }, forest: 0.4, reveal: 'river', mood: 'atardecer', forestCopies: 2, villageCopies: 2, zoom: 0.82 },
  { seed: 97, radius: 5, ragged: 0.35, rivers: [{ from: 'edge', to: 'lake', minLen: 5 }, { from: 'edge', to: 'lake', minLen: 4 }], lakes: 1, lakeSize: [2, 5], village: 10, mountains: { ranges: 2, size: 7 }, forest: 0.5, reveal: 'sweep', mood: 'noche', forestCopies: 3, villageCopies: 2, zoom: 0.8 },
  { seed: 131, radius: 4, ragged: 0.6, rivers: [{ from: 'edge', to: 'lake', minLen: 4 }], lakes: 2, lakeSize: [2, 4], village: 6, mountains: { ranges: 2, size: 5 }, forest: 0.7, reveal: 'center', mood: 'otono', forestCopies: 3, villageCopies: 1 },
]

const MOODS: MoodId[] = ['dia', 'invierno', 'atardecer', 'noche', 'otono']

export function specForIndex(index: number): LandscapeSpec {
  if (index < CURATED.length) return CURATED[index]
  const rng = createRng(1000 + index * 7919)
  const radius = rng.weighted([3, 4, 5], [0.3, 0.45, 0.25])
  const riverCount = rng.weighted([1, 2, 3], [0.45, 0.4, 0.15])
  const rivers: RiverSpec[] = Array.from({ length: riverCount }, (_, i) => ({
    from: i > 0 && rng.chance(0.6) ? 'chain' : rng.pick(['lake', 'edge'] as const),
    to: rng.pick(['lake', 'edge', 'any'] as const),
    minLen: 2 + rng.int(1, radius),
  }))
  return {
    seed: 5000 + index * 31,
    radius,
    ragged: rng() * 0.65,
    rivers,
    lakes: rng.weighted([0, 1, 2], [0.4, 0.4, 0.2]),
    lakeSize: [1 + rng.int(0, 1), 2 + rng.int(1, radius)],
    village: rng.int(2, radius * 3),
    mountains: { ranges: rng.int(1, 2), size: rng.int(3, radius + 4) },
    forest: 0.25 + rng() * 0.45,
    reveal: rng.pick(['center', 'spiral', 'sweep', 'river'] as const),
    mood: MOODS[index % MOODS.length],
    forestCopies: rng.int(1, 3),
    villageCopies: rng.int(1, 2),
    // Drawn last so the other properties keep their values.
    zoom: rng.chance(0.35) ? 0.8 : 1,
  }
}

// ---------------------------------------------------------------------------

type Cell = Axial & { k: string; x: number; z: number }
type Kind = KitTile | 'river' | 'lake'
type Assigned = { kind: Kind; order?: number }

const ORIGIN: Axial = { q: 0, r: 0 }

export function generateLandscape(spec: LandscapeSpec): Landscape {
  const rng = createRng(spec.seed)
  const cells = buildShape(spec, rng)
  const assigned = new Map<string, Assigned>()
  const free = (k: string) => cells.has(k) && !assigned.has(k)
  const lakes: Cell[][] = []
  const rivers: River[] = []
  let order = 0

  const growLake = (seed: Cell, size: number) => {
    const lake = [seed]
    assigned.set(seed.k, { kind: 'lake', order: order++ })
    while (lake.length < size) {
      const frontier: Cell[] = []
      for (const c of lake) {
        for (let d = 0; d < 6; d++) {
          const n = cells.get(key(c.q + AXIAL_DIRS[d].q, c.r + AXIAL_DIRS[d].r))
          if (n && free(n.k) && !frontier.includes(n)) frontier.push(n)
        }
      }
      if (!frontier.length) break
      // Prefer compact lakes: cells touching more of the lake.
      const weights = frontier.map((f) => {
        let touching = 0
        for (let d = 0; d < 6; d++) if (lake.some((c) => c.q === f.q + AXIAL_DIRS[d].q && c.r === f.r + AXIAL_DIRS[d].r)) touching++
        return touching * touching
      })
      const pick = rng.weighted(frontier, weights)
      lake.push(pick)
      assigned.set(pick.k, { kind: 'lake', order: order++ })
    }
    lakes.push(lake)
    return lake
  }
  const lakeSize = () => rng.int(spec.lakeSize[0], spec.lakeSize[1])

  for (const river of spec.rivers) {
    const result = carveRiver(cells, assigned, river, lakes, rng)
    if (!result) continue
    // Claim the channel first so the lakes at either end can't grow over it.
    for (const c of result.path) assigned.set(c.k, { kind: 'river', order: order++ })
    if (result.startLake) growLake(result.startLake, lakeSize())
    let endPoint = result.exitPoint
    if (result.endLake) {
      growLake(result.endLake, lakeSize())
      endPoint = [result.endLake.x, result.endLake.z]
    }
    rivers.push(buildRiverCurve(result, endPoint, rng))
  }

  for (let i = 0; i < spec.lakes; i++) {
    const options = [...cells.values()].filter((c) => free(c.k) && !isBoundary(cells, c))
    if (!options.length) break
    growLake(rng.pick(options), lakeSize())
  }

  const waterKeys = [...assigned.keys()]
  placeVillage(cells, assigned, waterKeys, spec.village, rng)
  for (let i = 0; i < spec.mountains.ranges; i++) placeMountains(cells, assigned, spec.mountains.size, rng)

  // Forest: noise field, biased towards mountains and away from the village.
  const remaining = [...cells.values()].filter((c) => free(c.k))
  const scored = remaining.map((c) => {
    let score = fbm(c.x * 0.4 + 40, c.z * 0.4 - 17, spec.seed + 33)
    for (let d = 0; d < 6; d++) {
      const n = assigned.get(key(c.q + AXIAL_DIRS[d].q, c.r + AXIAL_DIRS[d].r))
      if (n?.kind === 'montana') score += 0.12
      if (n?.kind === 'caserio') score -= 0.2
    }
    return { c, score: score + rng() * 0.08 }
  })
  scored.sort((a, b) => b.score - a.score)
  const forestCount = Math.round(spec.forest * scored.length)
  scored.forEach(({ c }, i) => assigned.set(c.k, { kind: i < forestCount ? 'bosque' : 'pradera' }))

  const water: Water = { rivers, lakes: buildLakeBlobs(cells, assigned, lakes, rng) }

  const ranks = revealRanks(cells, assigned, spec, rng)
  const tiles: Placement[] = []
  for (const c of cells.values()) {
    const a = assigned.get(c.k)!
    const isWater = a.kind === 'river' || a.kind === 'lake'
    const isCustom = isWater || a.kind === 'montana'
    let scale: [number, number, number] = [1, 1, 1]
    if (a.kind === 'bosque') {
      const s = 0.92 + rng() * 0.16
      scale = [s, 0.85 + rng() * 0.35, s]
    }
    tiles.push({
      tile: isWater ? 'agua' : (a.kind as KitTile),
      q: c.q,
      r: c.r,
      rot: isCustom ? 0 : rng.int(0, 5),
      mirror: isCustom ? false : rng.chance(0.5),
      scale,
      reveal: ranks.get(c.k)!,
    })
  }
  return { spec, tiles, water }
}

function makeCell(c: Axial): Cell {
  const [x, z] = axialToWorld(c.q, c.r, 1)
  return { ...c, k: key(c.q, c.r), x, z }
}

function buildShape(spec: LandscapeSpec, rng: Rng): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  const edgeNoise = (c: Cell) => fbm(c.x * 0.45 + 3.1, c.z * 0.45 - 8.7, spec.seed + 7)
  for (const a of hexRegion(spec.radius)) {
    const c = makeCell(a)
    if (spec.ragged > 0 && hexDistance(a, ORIGIN) === spec.radius && edgeNoise(c) < spec.ragged * 0.62) continue
    cells.set(c.k, c)
  }
  if (spec.ragged > 0) {
    for (const a of hexRegion(spec.radius + 1)) {
      if (hexDistance(a, ORIGIN) !== spec.radius + 1) continue
      const c = makeCell(a)
      let support = 0
      for (let d = 0; d < 6; d++) if (cells.has(key(a.q + AXIAL_DIRS[d].q, a.r + AXIAL_DIRS[d].r))) support++
      if (support >= 2 && edgeNoise(c) > 1 - spec.ragged * 0.55 && rng.chance(0.85)) cells.set(c.k, c)
    }
  }
  // Keep only the component connected to the centre.
  const keep = new Map<string, Cell>()
  const queue = [cells.get(key(0, 0))!]
  keep.set(queue[0].k, queue[0])
  while (queue.length) {
    const c = queue.shift()!
    for (let d = 0; d < 6; d++) {
      const n = cells.get(key(c.q + AXIAL_DIRS[d].q, c.r + AXIAL_DIRS[d].r))
      if (n && !keep.has(n.k)) {
        keep.set(n.k, n)
        queue.push(n)
      }
    }
  }
  return keep
}

const isBoundary = (cells: Map<string, Cell>, c: Axial) => {
  for (let d = 0; d < 6; d++) if (!cells.has(key(c.q + AXIAL_DIRS[d].q, c.r + AXIAL_DIRS[d].r))) return true
  return false
}

type RiverResult = {
  path: Cell[]
  /** Where the water comes from: an off-board point or a lake cell centre. */
  startPoint: [number, number]
  startLake: Cell | null
  endLake: Cell | null
  exitPoint: [number, number]
}

function carveRiver(
  cells: Map<string, Cell>,
  assigned: Map<string, Assigned>,
  spec: RiverSpec,
  lakes: Cell[][],
  rng: Rng,
): RiverResult | null {
  const free = (k: string) => cells.has(k) && !assigned.has(k)
  const canEndAtEdge = spec.to !== 'lake'
  const canEndAtLake = spec.to !== 'edge'
  const maxLen = Math.max(spec.minLen + 3, Math.floor(cells.size * 0.35))
  const edgePoint = (c: Cell, d: number, push: number): [number, number] => {
    const n = neighbor(c, d)
    const [nx, nz] = axialToWorld(n.q, n.r, 1)
    const t = 0.5 + push
    return [c.x + (nx - c.x) * t, c.z + (nz - c.z) * t]
  }
  let best: RiverResult | null = null

  for (let attempt = 0; attempt < 300; attempt++) {
    const path: Cell[] = []
    const used = new Set<string>()
    let dir: number
    let startPoint: [number, number]
    let startLake: Cell | null = null
    let reserved: Set<string> | null = null

    const freeCells = [...cells.values()].filter((c) => free(c.k))
    if (!freeCells.length) return null
    const from = spec.from === 'chain' && !lakes.length ? 'lake' : spec.from

    if (from === 'edge') {
      const edgeCells = freeCells.filter((c) => isBoundary(cells, c))
      if (!edgeCells.length) return null
      const c = rng.pick(edgeCells)
      const outs = [0, 1, 2, 3, 4, 5].filter((d) => !cells.has(key(neighbor(c, d).q, neighbor(c, d).r)))
      const enter = rng.pick(outs)
      startPoint = edgePoint(c, enter, 0.35)
      dir = mod6(enter + rng.pick([3, 2, 4]))
      path.push(c)
    } else if (from === 'chain') {
      const lake = rng.pick(lakes)
      const options: { c: Cell; d: number; l: Cell }[] = []
      for (const l of lake) {
        for (let d = 0; d < 6; d++) {
          const n = neighbor(l, d)
          const c = cells.get(key(n.q, n.r))
          if (c && free(c.k)) options.push({ c, d, l })
        }
      }
      if (!options.length) continue
      const { c, d, l } = rng.pick(options)
      startPoint = [l.x, l.z]
      dir = mod6(d + rng.pick([0, 1, -1]))
      path.push(c)
    } else {
      // New lake at the source: reserve a lake cell, the river starts next to it.
      const inner = freeCells.filter((c) => !isBoundary(cells, c))
      const l = rng.pick(inner.length ? inner : freeCells)
      const d = rng.int(0, 5)
      const n = neighbor(l, d)
      const c = cells.get(key(n.q, n.r))
      if (!c || !free(c.k)) continue
      startLake = l
      reserved = new Set([l.k])
      startPoint = [l.x, l.z]
      dir = mod6(d + rng.pick([0, 1, -1]))
      path.push(c)
    }
    used.add(path[0].k)
    if (reserved) for (const k of reserved) used.add(k)

    let lastTurn = 0
    let ok = false
    let endLake: Cell | null = null
    let exitPoint: [number, number] = [0, 0]
    while (path.length < maxLen) {
      const cur = path[path.length - 1]
      const next = neighbor(cur, dir)
      const nk = key(next.q, next.r)
      if (!cells.has(nk)) {
        if (canEndAtEdge && path.length >= spec.minLen) {
          ok = true
          exitPoint = edgePoint(cur, dir, 0.35)
        }
        break
      }
      if (!free(nk) || used.has(nk)) break
      const nextCell = cells.get(nk)!
      if (canEndAtLake && path.length >= spec.minLen && rng.chance(0.3 + (path.length - spec.minLen) * 0.2)) {
        endLake = nextCell
        ok = true
        break
      }
      path.push(nextCell)
      used.add(nk)
      // Meander: favour turning back after a bend so the river snakes instead of spiralling.
      const turns = [0, 1, -1]
      const weights = turns.map((t) => (t === 0 ? 1 : t === lastTurn ? 0.35 : 1.1))
      const t = rng.weighted(turns, weights)
      if (t !== 0) lastTurn = t
      dir = mod6(dir + t)
    }
    if (!ok) continue
    const result = { path, startPoint, startLake, endLake, exitPoint }
    if (!best || path.length > best.path.length) best = result
    if (path.length >= spec.minLen + 1) break
  }
  return best
}

/** Smooth centreline through the cell centres and the shared edges between them. */
function buildRiverCurve(result: RiverResult, endPoint: [number, number], rng: Rng): River {
  const ctrl: [number, number][] = [result.startPoint]
  const jitter = (a: number) => (rng() - 0.5) * 2 * a
  const cells = result.path
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    ctrl.push([c.x + jitter(0.16), c.z + jitter(0.16)])
    if (i < cells.length - 1) {
      const n = cells[i + 1]
      const mx = (c.x + n.x) / 2
      const mz = (c.z + n.z) / 2
      // Slide along the shared edge (perpendicular to the centre-to-centre direction).
      const px = -(n.z - c.z) / Math.sqrt(3)
      const pz = (n.x - c.x) / Math.sqrt(3)
      const s = jitter(0.14)
      ctrl.push([mx + px * s, mz + pz * s])
    }
  }
  ctrl.push(endPoint)
  return { points: catmullRom(ctrl, 7), halfWidth: 0.13 + rng() * 0.07 }
}

function catmullRom(pts: [number, number][], steps: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/**
 * Lakes are unions of circles. Each circle is clamped so it never reaches a land cell,
 * which keeps every shoreline inside water cells (land cells are kit tiles).
 */
function buildLakeBlobs(cells: Map<string, Cell>, assigned: Map<string, Assigned>, lakes: Cell[][], rng: Rng) {
  const land = [...cells.values()].filter((c) => {
    const a = assigned.get(c.k)
    return a && a.kind !== 'lake' && a.kind !== 'river'
  })
  const clamp = (x: number, z: number, r: number) => {
    let limit = r
    for (const l of land) {
      const d = Math.hypot(l.x - x, l.z - z)
      if (d < 3.5) limit = Math.min(limit, d - 1.0 - 0.06)
    }
    return limit
  }
  const blobs: LakeBlob[] = []
  const add = (x: number, z: number, r: number) => {
    const rr = clamp(x, z, r)
    if (rr > 0.12) blobs.push({ x, z, r: rr })
  }
  for (const lake of lakes) {
    for (const c of lake) {
      add(c.x + (rng() - 0.5) * 0.25, c.z + (rng() - 0.5) * 0.25, 0.75 + rng() * 0.3)
      const satellites = rng.int(1, 3)
      for (let i = 0; i < satellites; i++) {
        const a = rng() * Math.PI * 2
        const d = 0.3 + rng() * 0.3
        add(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, 0.35 + rng() * 0.3)
      }
      for (const o of lake) {
        if (o === c || hexDistance(o, c) !== 1 || o.k < c.k) continue
        add((c.x + o.x) / 2, (c.z + o.z) / 2, 0.7)
      }
    }
  }
  return blobs
}

function placeVillage(
  cells: Map<string, Cell>,
  assigned: Map<string, Assigned>,
  waterKeys: string[],
  size: number,
  rng: Rng,
) {
  const free = (k: string) => cells.has(k) && !assigned.has(k)
  const nearWater = (c: Axial) => AXIAL_DIRS.some((d) => waterKeys.includes(key(c.q + d.q, c.r + d.r)))
  const all = [...cells.values()].filter((c) => free(c.k))
  if (!all.length || size <= 0) return
  const seeds = all.filter(nearWater)
  const pool = seeds.length ? seeds : all
  pool.sort((a, b) => hexDistance(a, ORIGIN) + rng() * 1.6 - (hexDistance(b, ORIGIN) + rng() * 1.6))
  const village = [pool[0]]
  assigned.set(pool[0].k, { kind: 'caserio' })
  while (village.length < size) {
    const frontier = new Map<string, { c: Cell; w: number }>()
    for (const v of village) {
      for (let d = 0; d < 6; d++) {
        const n = neighbor(v, d)
        const c = cells.get(key(n.q, n.r))
        if (!c || !free(c.k)) continue
        const entry = frontier.get(c.k) ?? { c, w: 0 }
        entry.w += nearWater(c) ? 2 : 1
        frontier.set(c.k, entry)
      }
    }
    if (!frontier.size) break
    const list = [...frontier.values()]
    const pick = rng.weighted(list, list.map((e) => e.w * e.w))
    village.push(pick.c)
    assigned.set(pick.c.k, { kind: 'caserio' })
  }
}

function placeMountains(cells: Map<string, Cell>, assigned: Map<string, Assigned>, size: number, rng: Rng) {
  const free = (k: string) => cells.has(k) && !assigned.has(k)
  // "Back" of the board relative to the camera, which looks from +X/+Z.
  const back = (c: Cell) => -(c.x + c.z)
  const all = [...cells.values()].filter((c) => free(c.k))
  if (!all.length) return
  const seedScore = (c: Cell) => back(c) + (isBoundary(cells, c) ? 1.5 : 0) + rng() * 2.5
  const seed = all.reduce((best, c) => (seedScore(c) > seedScore(best) ? c : best))
  const range = [seed]
  assigned.set(seed.k, { kind: 'montana' })
  while (range.length < size) {
    const frontier: Cell[] = []
    for (const m of range) {
      for (let d = 0; d < 6; d++) {
        const n = neighbor(m, d)
        const c = cells.get(key(n.q, n.r))
        if (c && free(c.k) && !frontier.includes(c)) frontier.push(c)
      }
    }
    if (!frontier.length) break
    const pick = rng.weighted(frontier, frontier.map((c) => Math.exp(back(c) * 0.6) * (isBoundary(cells, c) ? 1.6 : 1)))
    range.push(pick)
    assigned.set(pick.k, { kind: 'montana' })
  }
}

function revealRanks(
  cells: Map<string, Cell>,
  assigned: Map<string, Assigned>,
  spec: LandscapeSpec,
  rng: Rng,
): Map<string, number> {
  const list = [...cells.values()]
  const score = new Map<string, number>()
  const angleOffset = rng() * Math.PI * 2
  const sweepDir = rng() * Math.PI * 2
  const [sx, sz] = [Math.cos(sweepDir), Math.sin(sweepDir)]

  if (spec.reveal === 'river') {
    // Water first, then the land grows outwards from it.
    const dist = new Map<string, number>()
    const queue: Cell[] = []
    for (const c of list) {
      const a = assigned.get(c.k)!
      if (a.order !== undefined) {
        dist.set(c.k, a.order * 0.3)
        queue.push(c)
      }
    }
    if (!queue.length) {
      dist.set(key(0, 0), 0)
      queue.push(cells.get(key(0, 0))!)
    }
    while (queue.length) {
      const c = queue.shift()!
      for (let d = 0; d < 6; d++) {
        const n = cells.get(key(c.q + AXIAL_DIRS[d].q, c.r + AXIAL_DIRS[d].r))
        if (n && !dist.has(n.k)) {
          dist.set(n.k, dist.get(c.k)! + 1)
          queue.push(n)
        }
      }
    }
    for (const c of list) score.set(c.k, dist.get(c.k)! + rng() * 0.4)
  } else {
    for (const c of list) {
      const ring = hexDistance(c, ORIGIN)
      const angle = (Math.atan2(c.z, c.x) + angleOffset + Math.PI * 4) % (Math.PI * 2)
      let s: number
      if (spec.reveal === 'spiral') s = ring + angle / (Math.PI * 2)
      else if (spec.reveal === 'sweep') s = c.x * sx + c.z * sz + rng() * 0.6
      else s = Math.hypot(c.x, c.z) + rng() * 0.5
      score.set(c.k, s)
    }
  }

  const sorted = [...list].sort((a, b) => score.get(a.k)! - score.get(b.k)!)
  const ranks = new Map<string, number>()
  sorted.forEach((c, i) => ranks.set(c.k, sorted.length > 1 ? i / (sorted.length - 1) : 0))
  return ranks
}

