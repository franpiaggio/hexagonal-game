// Game rules without three.js. Tiles are the seven pieces of the Blender kit (models/glb).
// Edge k points at 60°·k (src/shared/hex.ts, models/manifest.json). Each edge has a type:
// 'agua' where the kit tile has water (manifest waterEdges), otherwise the tile's land type.

import { key, mod6, neighbor, AXIAL_DIRS, type Axial } from '../../src/shared/hex'
import type { Rng } from '../../src/shared/random'

export const KINDS = ['pradera', 'bosque', 'caserio', 'montana', 'rio_recto', 'rio_curvo', 'laguna'] as const
export type Kind = (typeof KINDS)[number]

export const EDGE_TYPES = ['pradera', 'bosque', 'caserio', 'montana', 'agua'] as const
export type EdgeType = (typeof EDGE_TYPES)[number]

/** Water edges from models/manifest.json. */
const WATER_EDGES: Partial<Record<Kind, number[]>> = { rio_recto: [0, 3], rio_curvo: [1, 3], laguna: [0] }
/** Land type of the non-water edges. River and lagoon tiles have meadow banks. */
const LAND: Record<Kind, EdgeType> = {
  pradera: 'pradera',
  bosque: 'bosque',
  caserio: 'caserio',
  montana: 'montana',
  rio_recto: 'pradera',
  rio_curvo: 'pradera',
  laguna: 'pradera',
}
const WEIGHTS: Record<Kind, number> = { pradera: 9, bosque: 9, caserio: 4, montana: 5, rio_recto: 4, rio_curvo: 4, laguna: 2 }

export type TileDef = { id: number; kind: Kind; edges: EdgeType[] }
export type Placed = { def: TileDef; rot: number; cell: Axial }
export type EdgeState = 'match' | 'miss' | 'blocked' | null

/** Edge type on world edge k of a tile rotated `rot` steps counter-clockwise. */
export const edgeOf = (def: TileDef, rot: number, k: number): EdgeType => def.edges[mod6(k - rot)]

export function tileOf(kind: Kind, id: number): TileDef {
  const water = WATER_EDGES[kind] ?? []
  return { id, kind, edges: Array.from({ length: 6 }, (_, k) => (water.includes(k) ? 'agua' : LAND[kind])) }
}

export function makeTile(rng: Rng, id: number): TileDef {
  return tileOf(rng.weighted(KINDS, KINDS.map((k) => WEIGHTS[k])), id)
}

export function makeDeck(rng: Rng, size: number): TileDef[] {
  return Array.from({ length: size }, (_, i) => makeTile(rng, i))
}

export type Evaluation = {
  edges: EdgeState[]
  /** Water may only meet water. */
  valid: boolean
  matches: number
  neighbors: number
  /** Every touching edge matches and the tile touches at least three neighbours. */
  perfect: boolean
  /** All six neighbours present and matching. */
  closed: boolean
  points: number
  bonusTiles: number
}

export class Board {
  readonly cells = new Map<string, Placed>()

  get(c: Axial) {
    return this.cells.get(key(c.q, c.r))
  }

  /** Empty cells next to at least one placed tile. */
  open(): Axial[] {
    const out = new Map<string, Axial>()
    for (const p of this.cells.values()) {
      for (let k = 0; k < 6; k++) {
        const n = neighbor(p.cell, k)
        const id = key(n.q, n.r)
        if (!this.cells.has(id)) out.set(id, n)
      }
    }
    return [...out.values()]
  }

  isOpen(c: Axial) {
    if (this.get(c)) return false
    return AXIAL_DIRS.some((_, k) => this.get(neighbor(c, k)))
  }

  evaluate(def: TileDef, rot: number, cell: Axial): Evaluation {
    const edges: EdgeState[] = []
    let matches = 0
    let misses = 0
    let blocked = 0
    for (let k = 0; k < 6; k++) {
      const other = this.get(neighbor(cell, k))
      if (!other) {
        edges.push(null)
        continue
      }
      const mine = edgeOf(def, rot, k)
      const theirs = edgeOf(other.def, other.rot, k + 3)
      if (mine === theirs) {
        edges.push('match')
        matches++
      } else if (mine === 'agua' || theirs === 'agua') {
        edges.push('blocked')
        blocked++
      } else {
        edges.push('miss')
        misses++
      }
    }
    const neighbors = matches + misses + blocked
    const valid = blocked === 0
    const perfect = valid && misses === 0 && neighbors >= 3
    const closed = valid && misses === 0 && neighbors === 6
    const points = valid ? matches * 10 + (perfect ? 20 : 0) + (closed ? 60 : 0) : 0
    const bonusTiles = (perfect ? 1 : 0) + (closed ? 2 : 0)
    return { edges, valid, matches, neighbors, perfect, closed, points, bonusTiles }
  }

  /** True if the tile fits somewhere on the board in some rotation. */
  fitsAnywhere(def: TileDef) {
    return this.open().some((c) => [0, 1, 2, 3, 4, 5].some((r) => this.evaluate(def, r, c).valid))
  }

  place(def: TileDef, rot: number, cell: Axial): Placed {
    const placed = { def, rot: mod6(rot), cell }
    this.cells.set(key(cell.q, cell.r), placed)
    return placed
  }

  /** Largest connected zone per edge type, in sectors (6 = one full tile). Water sectors of a tile are all connected. */
  largestZones(): Record<EdgeType, number> {
    const best = Object.fromEntries(EDGE_TYPES.map((t) => [t, 0])) as Record<EdgeType, number>
    const seen = new Set<string>()
    for (const p of this.cells.values()) {
      for (let k = 0; k < 6; k++) {
        const start = `${key(p.cell.q, p.cell.r)}|${k}`
        if (seen.has(start)) continue
        const type = edgeOf(p.def, p.rot, k)
        let size = 0
        const stack: [Placed, number][] = [[p, k]]
        seen.add(start)
        while (stack.length) {
          const [tile, s] = stack.pop()!
          size++
          const inside = type === 'agua' ? [0, 1, 2, 3, 4, 5] : [mod6(s + 1), mod6(s - 1)]
          const next: [Placed | undefined, number][] = [
            ...inside.map((ns): [Placed, number] => [tile, ns]),
            [this.get(neighbor(tile.cell, s)), mod6(s + 3)],
          ]
          for (const [t, ns] of next) {
            if (!t || edgeOf(t.def, t.rot, ns) !== type) continue
            const id = `${key(t.cell.q, t.cell.r)}|${ns}`
            if (seen.has(id)) continue
            seen.add(id)
            stack.push([t, ns])
          }
        }
        best[type] = Math.max(best[type], size)
      }
    }
    return best
  }
}
