// Pointy-top axial hex helpers. Edge/direction index k points at angle 60°·k,
// measured from +X towards -Z in three.js world space (matches models/manifest.json).

export type Axial = { q: number; r: number }

export const AXIAL_DIRS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
]

export const mod6 = (n: number) => ((n % 6) + 6) % 6

export const key = (q: number, r: number) => `${q},${r}`

export const neighbor = (c: Axial, dir: number): Axial => {
  const d = AXIAL_DIRS[mod6(dir)]
  return { q: c.q + d.q, r: c.r + d.r }
}

export const hexDistance = (a: Axial, b: Axial) =>
  (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2

/** World-space XZ centre of a cell for a hex of circumradius `radius`. */
export const axialToWorld = (q: number, r: number, radius: number): [number, number] => [
  Math.sqrt(3) * radius * (q + r / 2),
  -1.5 * radius * r,
]

/** All cells within `radius` steps of the origin. */
export function hexRegion(radius: number): Axial[] {
  const cells: Axial[] = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      cells.push({ q, r })
    }
  }
  return cells
}
