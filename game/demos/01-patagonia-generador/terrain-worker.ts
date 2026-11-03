// Builds custom terrain cells (water, mountains) off the main thread. Sampling the continuous
// field for a few thousand vertices per cell costs hundreds of milliseconds per landscape; done
// here, a click never freezes the animation of the board that is leaving.

import type { BufferGeometry } from 'three'
import type { Landscape } from './generator'
import { scatterOnField, type Spot } from './props'
import { buildCustomTile, createField } from './terrain'

export type CellJob = { i: number; x: number; z: number; mountain: boolean }
export type PackedGeometry = { attributes: Record<string, { array: Float32Array; itemSize: number }>; index: Uint16Array | Uint32Array | null }
export type TreeSpot = { x: number; z: number; y: number; s: number; r: number }
export type CellResult = {
  i: number
  ground: PackedGeometry
  walls: PackedGeometry
  water: PackedGeometry | null
  waterWalls: PackedGeometry | null
  spots: Spot[]
  trees: TreeSpot[]
}
export type CellRequest = { id: number; landscape: Landscape; radius: number; jobs: CellJob[] }

function pack(geometry: BufferGeometry, transfer: Set<ArrayBuffer>): PackedGeometry {
  const attributes: PackedGeometry['attributes'] = {}
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const array = attr.array as Float32Array
    attributes[name] = { array, itemSize: attr.itemSize }
    transfer.add(array.buffer as ArrayBuffer)
  }
  const index = (geometry.index?.array as Uint16Array | Uint32Array | undefined) ?? null
  if (index) transfer.add(index.buffer as ArrayBuffer)
  return { attributes, index }
}

self.onmessage = (event: MessageEvent<CellRequest>) => {
  const { id, landscape, radius, jobs } = event.data
  const field = createField(landscape, radius)
  const transfer = new Set<ArrayBuffer>()
  const cells: CellResult[] = jobs.map((job) => {
    const geo = buildCustomTile(field, job.x, job.z, radius, job.mountain ? 40 : 18)
    return {
      i: job.i,
      ground: pack(geo.ground, transfer),
      walls: pack(geo.walls, transfer),
      water: geo.water && pack(geo.water, transfer),
      waterWalls: geo.waterWalls && pack(geo.waterWalls, transfer),
      spots: scatterOnField(field, job.x, job.z, radius, job.mountain, landscape.spec.seed),
      trees: job.mountain ? field.mountainTrees(job.x, job.z) : [],
    }
  })
  ;(self as unknown as Worker).postMessage({ id, cells }, [...transfer])
}
