// Small deterministic helpers: seeded PRNG and 2D value noise.

export type Rng = {
  (): number
  int: (min: number, maxInclusive: number) => number
  pick: <T>(items: readonly T[]) => T
  chance: (p: number) => boolean
  shuffle: <T>(items: T[]) => T[]
  weighted: <T>(items: readonly T[], weights: readonly number[]) => T
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }) as Rng
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1))
  next.pick = (items) => items[Math.floor(next() * items.length)]
  next.chance = (p) => next() < p
  next.shuffle = (items) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    return items
  }
  next.weighted = (items, weights) => {
    const total = weights.reduce((s, w) => s + w, 0)
    let roll = next() * total
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i]
      if (roll <= 0) return items[i]
    }
    return items[items.length - 1]
  }
  return next
}

function hash2(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

export function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const tx = smooth(x - xi)
  const ty = smooth(y - yi)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

export function fbm(x: number, y: number, seed: number, octaves = 3) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, y, seed + i * 101) * amp
    norm += amp
    x *= 2
    y *= 2
    amp *= 0.5
  }
  return sum / norm
}
