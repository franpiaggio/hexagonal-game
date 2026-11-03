// Ground clutter: grass tufts, lupins, daisies, pebbles and reeds scattered over every tile.
// Tiny, cheap instanced geometry (a few dozen triangles each, no shadow casting) that gives the
// lens something crisp to resolve where it focuses, which is what sells the tilt-shift miniature.

import { BufferAttribute, BufferGeometry, ConeGeometry, Color, IcosahedronGeometry, Mesh, Raycaster, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { fbm } from '../../src/shared/random'
import type { Field } from './terrain'
import { WATER_LEVEL } from './terrain'

export type PropKind = 'tuft' | 'lupin' | 'daisy' | 'pebble' | 'reed' | 'shrub'

/** One prop in tile-local space (tile centre at the origin, before the tile's rotation). */
export type Spot = { kind: PropKind; x: number; y: number; z: number; s: number; r: number }

const paint = (g: BufferGeometry, c: Color) => {
  const n = g.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new BufferAttribute(colors, 3))
  g.deleteAttribute('uv')
  return g
}

/** A clump of thin open cones leaning outwards: reads as a grass tuft at miniature scale. */
function clump(blades: number, height: number, spread: number, base: Color, tip: Color, seed: number) {
  const parts: BufferGeometry[] = []
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + seed
    const h = height * (0.7 + 0.3 * Math.sin(seed * 3 + i * 2.1) ** 2)
    const blade = new ConeGeometry(0.018, h, 3, 1, true).translate(0, h / 2, 0)
    blade.rotateZ(Math.cos(a) * 0.35).rotateX(Math.sin(a) * 0.35)
    blade.translate(Math.cos(a) * spread, 0, Math.sin(a) * spread)
    paint(blade, i % 2 ? base : tip)
    parts.push(blade)
  }
  return mergeGeometries(parts)!
}

/** Flower spike: a stem and a few stacked blossoms (lupin) or a flat head (daisy). */
function flowers(kind: 'lupin' | 'daisy') {
  const parts: BufferGeometry[] = []
  const stem = new Color('#4d6b35')
  const petals = kind === 'lupin' ? [new Color('#7e5cc4'), new Color('#c36aa8'), new Color('#9b7be0')] : [new Color('#f4f1e6'), new Color('#f1d561')]
  const n = kind === 'lupin' ? 3 : 4
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4
    const d = 0.03 + (i % 2) * 0.02
    const h = kind === 'lupin' ? 0.09 + (i % 3) * 0.025 : 0.05 + (i % 2) * 0.015
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    parts.push(paint(new ConeGeometry(0.006, h, 3, 1, true).translate(x, h / 2, z), stem))
    const head =
      kind === 'lupin'
        ? new ConeGeometry(0.014, 0.055, 4).translate(x, h + 0.02, z)
        : new IcosahedronGeometry(0.014, 0).scale(1, 0.45, 1).translate(x, h, z)
    parts.push(paint(head, petals[i % petals.length]))
  }
  // A little foliage at the foot.
  parts.push(clump(4, 0.04, 0.02, new Color('#56743a'), new Color('#6f8a45'), 1.3))
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!
}

function pebbles() {
  const parts: BufferGeometry[] = []
  const tones = [new Color('#8d8a80'), new Color('#a29d90'), new Color('#76736b')]
  for (let i = 0; i < 3; i++) {
    const s = 0.035 - i * 0.008
    // Smooth, slightly irregular river stones (rounded, not faceted).
    const rock = new SphereGeometry(s, 7, 4).scale(1, 0.5, 0.8)
    const pos = rock.getAttribute('position')
    for (let v = 0; v < pos.count; v++) {
      const k = 1 + 0.08 * Math.sin(pos.getX(v) * 160 + i) * Math.cos(pos.getZ(v) * 140 - i)
      pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k, pos.getZ(v) * k)
    }
    rock.translate(i * 0.04 - 0.03, s * 0.2, (i % 2) * 0.035)
    rock.computeVertexNormals()
    parts.push(paint(rock, tones[i]))
  }
  return mergeGeometries(parts)!
}

/** Ground clutter built here; the leafy kinds (tuft, shrub) are cut from the kit's own trees. */
export type BuiltPropKind = Exclude<PropKind, 'tuft' | 'shrub'>

export function createPropGeometries(): Record<BuiltPropKind, BufferGeometry> {
  // Thin parts (stems, reeds) stay flat-shaded; rounded parts keep their smooth normals.
  const flat = (g: BufferGeometry) => {
    const out = g.index ? g.toNonIndexed() : g
    out.computeVertexNormals()
    return out
  }
  return {
    lupin: flat(flowers('lupin')),
    daisy: flat(flowers('daisy')),
    pebble: pebbles(),
    reed: flat(clump(6, 0.15, 0.01, new Color('#5a6b3b'), new Color('#8b8350'), 2.1)),
  }
}

const SQRT3 = Math.sqrt(3)
/** Point inside a pointy-top hex of circumradius `R` (with a margin so props never overhang). */
function inHex(x: number, z: number, R: number) {
  const ax = Math.abs(x)
  const az = Math.abs(z)
  return ax <= (SQRT3 / 2) * R && az <= R - ax / SQRT3
}

function pickKind(u: number, flowersShare: number): PropKind {
  if (u < flowersShare * 0.55) return 'lupin'
  if (u < flowersShare) return 'daisy'
  if (u < flowersShare + 0.12) return 'pebble'
  if (u < flowersShare + 0.24) return 'shrub'
  return 'tuft'
}

/**
 * Kit tiles: raycast straight down into the tile's own meshes and keep points whose first hit
 * is open grass (greener than red), so props avoid houses, paths, trunks and sand.
 */
export function scatterOnKit(meshes: Mesh[], groundMeshes: Set<Mesh>, R: number, count: number, seed: number) {
  const raycaster = new Raycaster()
  const down = new Vector3(0, -1, 0)
  const origin = new Vector3()
  const colour = new Color()
  const out: Spot[] = []
  let k = seed
  const rand = () => {
    const v = Math.sin(++k * 91.345 + seed * 17.13) * 43758.5453
    return v - Math.floor(v)
  }
  for (let i = 0; i < count * 4 && out.length < count; i++) {
    const x = (rand() * 2 - 1) * R
    const z = (rand() * 2 - 1) * R
    if (!inHex(x, z, R * 0.9)) continue
    raycaster.set(origin.set(x, 5, z), down)
    const hit = raycaster.intersectObjects(meshes, false)[0]
    if (!hit || !groundMeshes.has(hit.object as Mesh) || !hit.face || hit.face.normal.y < 0.8) continue
    const attr = (hit.object as Mesh).geometry.getAttribute('color')
    if (attr) {
      colour.setRGB(0, 0, 0)
      for (const v of [hit.face.a, hit.face.b, hit.face.c]) colour.r += attr.getX(v) / 3, colour.g += attr.getY(v) / 3, colour.b += attr.getZ(v) / 3
      if (colour.g - colour.r < 0.02) continue
    }
    // Flowers drift in patches rather than being sprinkled evenly.
    const patch = fbm(x * 0.9 + seed, z * 0.9 - seed, seed + 7, 2)
    const kind = pickKind(rand(), patch > 0.55 ? 0.45 : 0.08)
    out.push({ kind, x, y: hit.point.y - 0.006, z, s: 0.8 + rand() * 0.5, r: rand() * Math.PI * 2 })
  }
  return out
}

/** Custom cells (river banks, lake shores, mountains): place from the terrain field directly. */
export function scatterOnField(field: Field, cx: number, cz: number, R: number, mountain: boolean, seed: number, density = 1) {
  const out: Spot[] = []
  let k = 0
  const rand = () => {
    const v = Math.sin((cx * 12.9898 + cz * 78.233 + ++k * 37.719 + seed) * 43758.5453)
    return v - Math.floor(v)
  }
  const tries = Math.round((mountain ? 90 : 170) * density)
  for (let i = 0; i < tries; i++) {
    const x = (rand() * 2 - 1) * R
    const z = (rand() * 2 - 1) * R
    if (!inHex(x, z, R * 0.92)) continue
    const wx = cx + x
    const wz = cz + z
    const { y, s, hm } = field.sample(wx, wz)
    const e = 0.06
    const slope = Math.hypot(field.sample(wx + e, wz).y - field.sample(wx - e, wz).y, field.sample(wx, wz + e).y - field.sample(wx, wz - e).y) / (2 * e)
    let kind: PropKind
    // Reeds stand in the shallows right at the waterline.
    if (s > -0.08 && s < 0.12 && y > WATER_LEVEL - 0.05 && y < WATER_LEVEL + 0.04 && rand() < 0.75) kind = 'reed'
    else if (s < 0.12 || y < WATER_LEVEL + 0.01) continue
    else if (mountain || hm > 0.15) {
      if (slope > 1.6) continue
      kind = y > 0.55 || slope > 0.7 || rand() < 0.45 ? 'pebble' : 'tuft'
    } else {
      if (s < 0.3 && rand() < 0.3) kind = 'pebble'
      else kind = pickKind(rand(), fbm(wx * 0.9, wz * 0.9, seed + 7, 2) > 0.55 ? 0.4 : 0.07)
    }
    const big = kind === 'pebble' && (mountain || hm > 0.15) ? 1.6 : 1
    out.push({ kind, x, y: y - 0.008, z, s: (0.8 + rand() * 0.5) * big, r: rand() * Math.PI * 2 })
  }
  return out
}
