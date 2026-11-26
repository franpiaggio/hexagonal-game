import { buildTerrain, generatePlan, type Choice } from './landscape.ts'

self.onmessage = (event: MessageEvent<{ id: number; seed: number; choice: Choice }>) => {
  const { id, seed, choice } = event.data
  try {
    const plan = generatePlan(seed, choice)
    const terrain = buildTerrain(plan)
    self.postMessage({ id, plan, terrain }, { transfer: [terrain.positions.buffer, terrain.colors.buffer, terrain.indices.buffer, terrain.waterColors.buffer, terrain.layers.buffer] })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'No se pudo crear el terreno.' })
  }
}
