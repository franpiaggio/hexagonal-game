import { createRng, fbm, valueNoise } from '../../src/shared/random.ts'

export const EXTENT = 72
export const FAMILIES = ['bahia', 'rio', 'bosque', 'peninsula', 'confluencia', 'ladera'] as const
export type Family = (typeof FAMILIES)[number]
export type Choice = Family | 'sorpresa'
export type Prop = { kind: string; x: number; z: number; y: number; scale: number; angle: number; tint: number }
export type Plan = { seed: number; family: Family; phase: number; title: string; houses: Prop[]; trees: Prop[]; rocks: Prop[]; grass: Prop[]; bridge: boolean; focus: [number, number, number] }
export const FAMILY_LABELS: Record<Family, string> = { bahia: 'Lago & bosque', rio: 'Valle del río', bosque: 'Refugio del bosque', peninsula: 'Pueblo en la península', confluencia: 'Encuentro de ríos', ladera: 'Costa de la ladera' }
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }

type FieldPlan = Pick<Plan, 'seed' | 'family' | 'phase'> & Partial<Pick<Plan, 'houses'>>
export function shoreline(p: FieldPlan, x: number) {
  // A broad bay with an offset headland, plus small shoreline irregularities.
  return -8 + Math.exp(-(((x-6)/16)**2))*7 + Math.sin(x*.13+p.phase)*1.25 + Math.sin(x*.48+p.phase*.4)*.32
}
export function riverline(p: FieldPlan, x: number) { return -2 + Math.sin(x * .082 + p.phase) * 3.2 + Math.sin(x * .18) * .65 }
export function roadPoint(p: FieldPlan, t: number): [number, number] {
  if (p.family === 'peninsula') return [Math.sin(t * .12 + p.phase) * 1.1, t]
  if (p.family === 'bahia' || p.family === 'ladera') return [t, shoreline(p, t) + 5.4]
  if (p.family === 'bosque') return [t, Math.sin(t * .12 + p.phase) * 2]
  return [t, riverline(p, t) + 6.1]
}
/** Signed shore distance: positive land, negative water; continuous across the map. */
export function waterDistance(p: FieldPlan, x: number, z: number) {
  switch (p.family) {
    case 'bahia': case 'ladera': return z - shoreline(p, x)
    case 'peninsula': {
      const width = 5.7 + smooth(-15,20,z)*4.5 + Math.sin(z*.13+p.phase)*.6
      const peninsula = width - Math.hypot(x-Math.sin(z*.075)*1.5,Math.max(0,-z-10)*.7)
      const mainland = z-18, maximum = Math.max(mainland,peninsula)
      return maximum + 3*Math.log1p(Math.exp(-Math.abs(mainland-peninsula)/3))
    }
    case 'rio': return Math.abs(z - riverline(p, x)) - 1.35 - Math.sin(x*.31+p.phase)*.15
    case 'confluencia': {
      const a = Math.abs(z - riverline(p, x)) - 1.1
      const b = Math.max(Math.abs(x - 7 - Math.sin(z * .1) * 2) - .8, z - riverline(p, x))
      return Math.min(a, b)
    }
    case 'bosque': return Math.abs(x + 17 + Math.sin(z * .13 + p.phase) * 3.5) - .65
  }
}
function naturalHeightAt(p: FieldPlan, x: number, z: number) {
  const shore = waterDistance(p, x, z)
  if (shore < 0) return Math.max(-2.8, shore * .6) - .025
  const broad = fbm(x * .037, z * .037, p.seed, 3)
  const folds = fbm((x+23) * .095, (z-14) * .095, p.seed+781, 3)
  const upland = smooth(3,18,shore)
  const slope = p.family === 'ladera' ? Math.max(0,z-9)*.12 : 0
  // Low terraces by the water, rounded glacial hills inland, smaller folds
  // between them. Keep the water plane level and the shoreline continuous.
  const hills = .3 + broad*3.3 + upland*(broad*4.5 + folds*3.6 + slope)
  const small = (valueNoise(x*.42,z*.42,p.seed+142)-.5)*.28
  const lane = 1-smooth(.5,1.6,roadDistance(p,x,z))
  return .018 + smooth(0,4.4,shore)*(hills + small*(1-lane))
}
export function heightAt(p: FieldPlan, x: number, z: number) {
  let height = naturalHeightAt(p,x,z)
  // Flat construction pads blend into the slope; upright houses never float
  // over hills or sink into them. Terrain and prop placement share this field.
  for (const house of p.houses ?? []) {
    const dx=x-house.x, dz=z-house.z, c=Math.cos(house.angle), s=Math.sin(house.angle)
    const localX=Math.abs(dx*c-dz*s), localZ=Math.abs(dx*s+dz*c)
    const edge=Math.max(localX/1.65,localZ/1.35)
    const pad=(1-smooth(.85,1.7,edge))*smooth(0,1.2,waterDistance(p,x,z))
    height += (house.y-height)*pad
  }
  return height
}
export function roadDistance(p: FieldPlan, x: number, z: number) {
  return p.family === 'peninsula' ? Math.abs(x - roadPoint(p, z)[0]) : Math.abs(z - roadPoint(p, x)[1])
}
export function forestAt(p: FieldPlan, x: number, z: number) {
  const patches = fbm(x * .055, z * .055, p.seed + 913, 3)
  return smooth(.31, .64, patches) * (p.family === 'bosque' ? 1.12 : 1)
}

export function generatePlan(seed: number, choice: Choice = 'sorpresa'): Plan {
  seed = Math.floor(seed) >>> 0
  const rng = createRng(seed)
  const family = choice === 'sorpresa' ? FAMILIES[seed % FAMILIES.length] : choice
  const nouns = ['de las Lengas', 'del Ciprés', 'del Viento', 'del Alerce', 'del Sur', 'de la Ribera', 'del Arrayán', 'de los Coihues']
  const prefix: Record<Family, string> = { bahia: 'Bahía', rio: 'Paso', bosque: 'Refugio', peninsula: 'Punta', confluencia: 'Encuentro', ladera: 'Mirador' }
  const plan: Plan = { seed, family, phase: rng() * 6.28, title: `${prefix[family]} ${rng.pick(nouns)}`, houses: [], trees: [], rocks: [], grass: [], bridge: family === 'rio' || family === 'confluencia', focus: [0, 0, 2] }
  const count = family === 'bosque' ? 5 : rng.int(7, 11)
  for (let i = 0; i < count; i++) {
    const spread = family === 'bosque' ? 11 : 13.5
    const t = -spread + i / (count - 1) * spread * 2 + (rng()-.5)*1.1
    const point = roadPoint(plan, t)
    const side = i % 2 ? 1 : -1
    let x = point[0], z = point[1]
    if (family === 'peninsula') x += side * (2.3 + rng() * .35)
    else z += side * (side > 0 ? 2.6 + rng()*1.45 : 2.4 + rng()*.45)
    if (waterDistance(plan, x, z) < 1.65) continue
    plan.houses.push({ kind: i === 0 && count > 6 ? 'chapel' : rng.pick(['cabin', 'cabin', 'chalet', 'stone', 'inn', 'shed']), x, z, y: naturalHeightAt(plan, x, z), scale: 3.3 + rng() * .45, angle: family === 'peninsula' ? side * Math.PI / 2 : (side > 0 ? 0 : Math.PI) + (rng() - .5) * .25, tint: .9 + rng() * .18 })
  }
  const center = plan.houses.reduce((a, h) => [a[0] + h.x, a[1] + h.z], [0, 0])
  plan.focus = [center[0] / plan.houses.length, plan.houses.reduce((sum,h)=>sum+h.y,0)/plan.houses.length+.7, center[1] / plan.houses.length]
  // One small grid is jittered, giving separation without quadratic tree collision tests.
  for (let iz = -37; iz <= 37; iz++) for (let ix = -37; ix <= 37; ix++) {
    const x = ix * 1.75 + (rng() - .5) * 1.25, z = iz * 1.75 + (rng() - .5) * 1.25
    if (waterDistance(plan, x, z) < .9 || roadDistance(plan, x, z) < 1.0) continue
    if (plan.houses.some(h => Math.hypot(x - h.x, z - h.z) < 2.0)) continue
    if ((family==='bahia' || family==='ladera') && Math.abs(x-5)<1 && Math.abs(z-shoreline(plan,5))<2) continue
    const density = forestAt(plan, x, z)
    const far = Math.hypot(x, z) > 44
    if (rng() > (far ? .18 + density * .4 : .30 + density * .55)) continue
    const y = heightAt(plan, x, z)
    plan.trees.push({ kind: rng() < .16 ? 'leaf_0' : rng() < .5 ? 'fir_0' : 'fir_1', x, z, y, scale: 2.65 + rng() * 2.7, angle: rng() * Math.PI * 2, tint: .80 + rng() * .30 })
  }
  for (let i = 0; i < 4800; i++) {
    const x = (rng() - .5) * 100, z = (rng() - .5) * 100, shore = waterDistance(plan, x, z)
    if (shore < -.22 || shore > .8 || rng() > .55) continue
    plan.rocks.push({ kind: 'rock', x, z, y: heightAt(plan, x, z), scale: .12 + rng() * .27, angle: rng() * Math.PI * 2, tint: .75 + rng() * .35 })
  }
  const coverRng=createRng(seed+4921)
  for(let i=0;i<22000;i++) {
    const x=(coverRng()-.5)*88,z=(coverRng()-.5)*88
    if(waterDistance(plan,x,z)<1.3 || roadDistance(plan,x,z)<.9) continue
    if(plan.houses.some(h=>Math.hypot(x-h.x,z-h.z)<2)) continue
    if(coverRng()>smooth(.25,.7,fbm(x*.2,z*.2,seed+562,2))*.8) continue
    plan.grass.push({kind:'grass',x,z,y:heightAt(plan,x,z)-.018,scale:.65+coverRng()*.75,angle:coverRng()*Math.PI*2,tint:.75+coverRng()*.4})
  }
  return plan
}

export type TerrainData = { positions: Float32Array; colors: Float32Array; indices: Uint32Array; waterColors: Float32Array; layers: Float32Array }
const srgb = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
export function buildTerrain(plan: Plan, segments = 240): TerrainData {
  const vertices = (segments + 1) ** 2
  const positions = new Float32Array(vertices * 3), colors = new Float32Array(vertices * 3)
  const waterColors = new Float32Array(vertices * 3), layers = new Float32Array(vertices * 3), indices = new Uint32Array(segments * segments * 6)
  const hues = { meadow: [.52,.57,.34], forest: [.30,.37,.20], road: [.66,.57,.45], bank: [.60,.58,.48], deep: [.16,.28,.34], shallow: [.31,.43,.39] }
  const shade = new Float32Array(vertices)
  const step=EXTENT*2/segments
  // Rasterize small contact shadows in the worker; cost depends on local
  // footprints, rather than comparing every terrain vertex with every tree.
  for (const prop of [...plan.trees,...plan.houses]) {
    const tree=prop.kind.startsWith('fir') || prop.kind.startsWith('leaf')
    const radius=tree ? prop.scale*.26 : 1.5
    const cx=(prop.x+EXTENT)/step,cz=(prop.z+EXTENT)/step,r=radius/step
    for(let z=Math.max(0,Math.floor(cz-r));z<=Math.min(segments,Math.ceil(cz+r));z++) for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(segments,Math.ceil(cx+r));x++) {
      const d=Math.hypot(x-cx,z-cz)/r
      if(d<1) shade[z*(segments+1)+x]=Math.max(shade[z*(segments+1)+x],(1-d*d)*(tree ? .21 : .25))
    }
  }
  for (let j = 0; j <= segments; j++) for (let i = 0; i <= segments; i++) {
    const k = j * (segments + 1) + i, x = -EXTENT + i / segments * EXTENT * 2, z = -EXTENT + j / segments * EXTENT * 2
    const shore = waterDistance(plan, x, z), y = heightAt(plan, x, z)
    positions.set([x, y, z], k * 3)
    const forest = forestAt(plan, x, z) * .47
    const variation = .70 + fbm(x*.18,z*.18,plan.seed+419,3)*.53 + valueNoise(x * .8, z * .8, plan.seed)*.07
    const dryMeadow = smooth(.38,.72,fbm(x*.12,z*.12,plan.seed+53,3))*.3
    const roadEdge=(valueNoise(x*1.7,z*1.7,plan.seed+57)-.5)*.18
    let road = 1 - smooth(.25, .68, roadDistance(plan, x, z)+roadEdge)
    // Short footpaths connect each entrance to the rural lane.
    for (const house of plan.houses) {
      const p = roadPoint(plan, plan.family === 'peninsula' ? house.z : house.x)
      const dx = house.x - p[0], dz = house.z - p[1]
      const t = clamp(((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz))
      road = Math.max(road, 1 - smooth(.11, .28, Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t)))
    }
    const bank = 1 - smooth(.25, 1.45, shore)
    layers.set([road,clamp(forest*1.3+shade[k]*2)*(1-road),bank],k*3)
    for (let c = 0; c < 3; c++) {
      let v = hues.meadow[c] * (1 - forest) + hues.forest[c] * forest
      v = v*(1-dryMeadow) + [.65,.58,.37][c]*dryMeadow
      v = v * (1 - road) + hues.road[c] * road
      v = v * (1 - bank) + hues.bank[c] * bank
      colors[k * 3 + c] = srgb(v * variation) * (1-shade[k])
      const deep = smooth(0, 3.2, -shore)
      waterColors[k * 3 + c] = srgb(hues.shallow[c] * (1 - deep) + hues.deep[c] * deep)
    }
    if (i < segments && j < segments) {
      const q = (j * segments + i) * 6
      indices.set([k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2], q)
    }
  }
  return { positions, colors, indices, waterColors, layers }
}
