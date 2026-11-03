// A small pool of terrain workers. Mountain cells cost ~4× a water cell, so jobs are balanced
// by weight (heaviest first onto the least loaded worker) rather than by count.

import { BufferAttribute, BufferGeometry } from 'three'
import { axialToWorld } from '../../src/shared/hex'
import type { Landscape } from './generator'
import type { CellJob, CellRequest, CellResult, PackedGeometry } from './terrain-worker'

const SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))
const workers = Array.from({ length: SIZE }, () => new Worker(new URL('./terrain-worker.ts', import.meta.url), { type: 'module' }))
const pending = new Map<number, (cells: CellResult[]) => void>()
for (const w of workers) {
  w.onmessage = (e: MessageEvent<{ id: number; cells: CellResult[] }>) => {
    pending.get(e.data.id)?.(e.data.cells)
    pending.delete(e.data.id)
  }
}
let nextId = 0

export function unpack(packed: PackedGeometry) {
  const geometry = new BufferGeometry()
  for (const [name, { array, itemSize }] of Object.entries(packed.attributes)) geometry.setAttribute(name, new BufferAttribute(array, itemSize))
  if (packed.index) geometry.setIndex(new BufferAttribute(packed.index, 1))
  return geometry
}

/** Builds every water and mountain cell of a landscape in parallel; resolves by tile index. */
export async function buildCustomCells(landscape: Landscape, radius: number) {
  const jobs: (CellJob & { w: number })[] = []
  landscape.tiles.forEach((t, i) => {
    if (t.tile !== 'agua' && t.tile !== 'montana') return
    const [x, z] = axialToWorld(t.q, t.r, radius)
    jobs.push({ i, x, z, mountain: t.tile === 'montana', w: t.tile === 'montana' ? 4 : 1 })
  })
  const lots: CellJob[][] = workers.map(() => [])
  const load = workers.map(() => 0)
  for (const job of jobs.sort((a, b) => b.w - a.w)) {
    const k = load.indexOf(Math.min(...load))
    lots[k].push({ i: job.i, x: job.x, z: job.z, mountain: job.mountain })
    load[k] += job.w
  }
  const results = await Promise.all(
    lots.map((lot, k) => {
      if (!lot.length) return Promise.resolve([] as CellResult[])
      const id = nextId++
      return new Promise<CellResult[]>((resolve) => {
        pending.set(id, resolve)
        const request: CellRequest = { id, landscape, radius, jobs: lot }
        workers[k].postMessage(request)
      })
    }),
  )
  return new Map(results.flat().map((c) => [c.i, c]))
}

export type CustomCells = Awaited<ReturnType<typeof buildCustomCells>>
