// Full-bleed mode: grow a landscape past the edges of the screen so no board border shows.
// The composed landscape stays untouched in the middle; extra rings are filled around it:
// rivers that ran off the board keep flowing, water that touched the edge keeps its shape,
// mountain ranges continue outwards and the rest becomes meadow and forest.

import { AXIAL_DIRS, axialToWorld, hexDistance, hexRegion, key } from '../../src/shared/hex'
import { createRng, fbm } from '../../src/shared/random'
import type { Landscape, Placement, River } from './generator'
import { createField } from './terrain'

const SQRT3 = Math.sqrt(3)

/** Fractional axial coords (hex units, circumradius 1) → nearest cell. */
function cellAt(x: number, z: number) {
  const r = -z / 1.5
  const q = x / SQRT3 - r / 2
  // Cube rounding.
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(-q - r)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs + q + r)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return { q: rq, r: rr }
}

export function padLandscape(landscape: Landscape, pad: number): Landscape {
  const { spec } = landscape
  const rng = createRng(spec.seed + 4242)
  const original = new Map(landscape.tiles.map((t) => [key(t.q, t.r), t]))
  const onBoundary = (q: number, r: number) => AXIAL_DIRS.some((d) => !original.has(key(q + d.q, r + d.r)))
  const inLake = (x: number, z: number) => landscape.water.lakes.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + 0.3)

  // 1. Rivers that leave the board keep going, with a lazy meander, until well off-screen.
  const reach = pad + 3
  const rivers: River[] = landscape.water.rivers.map((river) => {
    let pts = river.points.slice()
    const extend = (end: [number, number], prev: [number, number]) => {
      const c = cellAt(end[0], end[1])
      if (inLake(end[0], end[1]) || !onBoundary(c.q, c.r)) return []
      let dx = end[0] - prev[0]
      let dz = end[1] - prev[1]
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      const out: [number, number][] = []
      let [x, z] = end
      const phase = rng() * Math.PI * 2
      for (let i = 1; i <= reach * 2; i++) {
        const bend = Math.sin(phase + i * 0.7) * 0.18
        const nx = dx * Math.cos(bend) - dz * Math.sin(bend)
        const nz = dx * Math.sin(bend) + dz * Math.cos(bend)
        dx = nx
        dz = nz
        x += dx * 0.75
        z += dz * 0.75
        out.push([x, z])
      }
      return out
    }
    if (pts.length >= 2) {
      const tail = extend(pts[pts.length - 1], pts[pts.length - 2])
      const head = extend(pts[0], pts[1])
      pts = [...head.reverse(), ...pts, ...tail]
    }
    return { ...river, points: pts }
  })
  const water = { ...landscape.water, rivers }

  // 2. Classify every new cell.
  const field = createField({ ...landscape, water }, 1)
  const originalList = [...original.values()]
  const nearest = (q: number, r: number) => {
    let best = originalList[0]
    let bestD = Infinity
    for (const t of originalList) {
      const d = hexDistance(t, { q, r })
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    return { tile: best, d: bestD }
  }

  const added: Placement[] = []
  for (const c of hexRegion(spec.radius + 1 + pad)) {
    if (original.has(key(c.q, c.r))) continue
    const [x, z] = axialToWorld(c.q, c.r, 1)
    let wet = field.waterSdf(x, z)
    for (let a = 0; a < 6; a++) {
      const ang = (a * Math.PI) / 3 + Math.PI / 6
      wet = Math.min(wet, field.waterSdf(x + Math.cos(ang) * 0.95, z - Math.sin(ang) * 0.95))
    }
    const near = nearest(c.q, c.r)
    let tile: Placement['tile']
    if (wet < 0.25) tile = 'agua'
    else if (near.tile.tile === 'montana' && near.d <= 2) tile = 'montana'
    else {
      const forest = fbm(x * 0.4 + 40, z * 0.4 - 17, spec.seed + 33) + rng() * 0.08
      tile = forest > 0.62 - spec.forest * 0.3 ? 'bosque' : 'pradera'
    }
    const isCustom = tile === 'agua' || tile === 'montana'
    let scale: [number, number, number] = [1, 1, 1]
    if (tile === 'bosque') {
      const s = 0.92 + rng() * 0.16
      scale = [s, 0.85 + rng() * 0.35, s]
    }
    added.push({
      tile,
      q: c.q,
      r: c.r,
      rot: isCustom ? 0 : rng.int(0, 5),
      mirror: false,
      scale,
      copies: 1,
      // After the composed landscape, rippling outwards.
      reveal: 0.86 + 0.14 * Math.min(1, near.d / (pad + 1)),
    })
  }

  const tiles = [...landscape.tiles.map((t) => ({ ...t, reveal: t.reveal * 0.86 })), ...added]
  return { spec, tiles, water }
}
