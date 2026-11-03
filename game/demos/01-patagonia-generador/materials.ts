// TSL materials that replace the kit's originals.
// Everything is shaded in world space so neighbouring tiles read as one continuous landscape,
// and every tint goes through `mood` uniforms so day / dusk / autumn / night blend smoothly.

import { Color, DoubleSide, MeshStandardMaterial, Texture } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  Fn,
  attribute,
  color,
  float,
  mix,
  modelPosition,
  mx_fractal_noise_float,
  mx_noise_float,
  normalWorld,
  positionGeometry,
  positionLocal,
  positionWorld,
  saturation,
  sin,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  vertexColor,
} from 'three/tsl'

export const mood = {
  grassTint: uniform(new Color(1, 1, 1)),
  leafTint: uniform(new Color(1, 1, 1)),
  needleTint: uniform(new Color(1, 1, 1)),
  snowLine: uniform(1.6),
  waterDeep: uniform(new Color('#1d4a52')),
  waterShallow: uniform(new Color('#5d9f95')),
  saturation: uniform(1.15),
  /** Colour the water mirrors: a lighter take on the backdrop. */
  waterSky: uniform(new Color('#9fb8c0')),
}

/** Snow on upward-facing surfaces above the snow line, with a ragged noisy edge. */
const snowMask = Fn(() => {
  const ragged = mx_noise_float(positionWorld.xz.mul(1.7)).mul(0.22)
  const height = smoothstep(mood.snowLine.sub(0.12), mood.snowLine.add(0.12), positionWorld.y.add(ragged))
  return height.mul(smoothstep(0.35, 0.7, normalWorld.y))
})

const SNOW = color('#eef0f2')

/**
 * Ground: drops the noisy tiled texture + crumpled normal map of the kit.
 * Keeps vertex colours (grass / sand banks / rock) and adds large soft meadow patches,
 * mid-frequency mottling and a fine grain, all continuous across tiles.
 */
export function createGroundMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.93, metalness: 0 })

  material.colorNode = Fn(() => {
    const p = positionWorld.xz
    const base = vertexColor(0).rgb

    const patches = mx_fractal_noise_float(p.mul(0.11), 3, 2.0, 0.5).mul(0.5).add(0.5)
    const mottling = mx_noise_float(p.mul(0.9)).mul(0.5).add(0.5)
    const grain = mx_noise_float(p.mul(7.0)).mul(0.5).add(0.5)
    const speckle = mx_noise_float(p.mul(23.0)).mul(0.5).add(0.5)

    // Grassiness: vertex colours that are clearly greener than they are red.
    const grassy = smoothstep(0.0, 0.06, base.g.sub(base.r))

    const lush = vec3(0.84, 1.03, 0.88)
    const dry = vec3(1.12, 1.04, 0.82)
    const tint = mix(lush, dry, smoothstep(0.32, 0.78, patches)).mul(mood.grassTint)
    const grassTint = mix(vec3(1), tint, grassy)

    const lum = mix(float(0.88), float(1.08), mottling)
      .mul(mix(float(0.95), float(1.04), grain))
      .mul(mix(float(0.96), float(1.04), speckle))

    const top = saturation(base.mul(grassTint).mul(lum), mix(float(1.0), mood.saturation, grassy))

    // Kit tiles: soil cut on their thin vertical faces.
    const y = positionLocal.y
    const soil = mix(color('#4a3a2a'), color('#76604a'), smoothstep(-0.12, -0.02, y))
    const side = mix(soil, top, smoothstep(-0.02, -0.004, y))
    const surface = mix(side, top, smoothstep(0.35, 0.75, normalWorld.y))
    return mix(surface, SNOW, snowMask())
  })()

  return material
}

/** Soil block + cell walls: layered earth, rock where the cut goes above ground level. */
export function createSoilMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0, side: DoubleSide })
  material.colorNode = Fn(() => {
    const y = positionLocal.y
    const p = positionWorld.xz
    const strata = mx_noise_float(vec3(p.x.mul(0.8), y.mul(9), p.y.mul(0.8))).mul(0.5).add(0.5)
    const bands = sin(y.mul(38).add(mx_noise_float(p.mul(1.3)).mul(3))).mul(0.5).add(0.5)
    const earth = mix(color('#21180f'), color('#6a523a'), smoothstep(-1.5, -0.05, y))
    const layered = earth.mul(mix(float(0.82), float(1.12), strata)).mul(mix(float(0.94), float(1.04), bands))
    const rock = mix(color('#5d5a54'), color('#807a70'), strata)
    const lip = smoothstep(-0.07, -0.03, y)
    return mix(mix(layered, color('#5d6b48'), lip.mul(0.6)), rock, smoothstep(0.02, 0.12, y))
  })()
  return material
}

/** Foliage: keeps alpha-tested leaf cards, adds area-wise hue drift and a gentle breeze. */
export function createFoliageMaterial(source: MeshStandardMaterial, deciduous: boolean) {
  const map = source.map as Texture
  const material = new MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0,
    alphaTest: source.alphaTest || 0.5,
    side: source.side,
    vertexColors: true,
  })
  material.alphaToCoverage = true
  const moodTint = deciduous ? mood.leafTint : mood.needleTint

  material.colorNode = Fn(() => {
    const p = positionWorld.xz
    const drift = mx_fractal_noise_float(p.mul(0.16), 2, 2.0, 0.5).mul(0.5).add(0.5)
    const tint = mix(vec3(0.82, 1.0, 0.92), vec3(1.08, 1.02, 0.8), smoothstep(0.3, 0.75, drift)).mul(moodTint)
    // The needle sprigs are a few texels wide: at miniature distance their alpha collapses
    // below the cutoff. Dilate the alpha with a small cross of taps and alpha-weight the colour.
    const o = float(deciduous ? 0.004 : 0.009)
    const taps = [
      texture(map, uv()),
      texture(map, uv().add(vec2(o, 0))),
      texture(map, uv().sub(vec2(o, 0))),
      texture(map, uv().add(vec2(0, o))),
      texture(map, uv().sub(vec2(0, o))),
    ]
    let alpha = taps[0].a
    let weighted = taps[0].rgb.mul(taps[0].a)
    let weight = taps[0].a
    for (const t of taps.slice(1)) {
      alpha = alpha.max(t.a)
      weighted = weighted.add(t.rgb.mul(t.a))
      weight = weight.add(t.a)
    }
    const leafRgb = weighted.div(weight.max(0.0001))
    const rgb = mix(leafRgb.mul(tint), SNOW, snowMask().mul(0.7))
    return vec4(rgb, smoothstep(0.08, 0.45, alpha))
  })()

  // Sway grows with height above the tile; phase varies per tile and across the canopy.
  material.positionNode = Fn(() => {
    const h = positionGeometry.y.max(0)
    const phase = modelPosition.x.mul(0.7).add(modelPosition.z.mul(0.9)).add(positionGeometry.x.mul(3)).add(positionGeometry.z.mul(2))
    const sway = sin(time.mul(1.4).add(phase)).mul(0.012).add(sin(time.mul(2.3).add(phase.mul(1.7))).mul(0.005))
    return positionLocal.add(vec3(sway.mul(h), 0, sway.mul(h).mul(0.6)))
  })()

  return material
}

/** Kit rock / plaster: keep texture + vertex colour, add snow caps above the snow line. */
export function createRockMaterial(source: MeshStandardMaterial) {
  const map = source.map
  const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, vertexColors: true })
  material.colorNode = Fn(() => {
    const base = map ? texture(map).rgb : vec3(1)
    return mix(base, SNOW, snowMask())
  })()
  return material
}

/**
 * Water for custom cells: `shore` is the signed distance to the bank (negative inside).
 * Deep colour in the middle, shallow near banks, a soft animated foam line at the edge.
 */
export function createWaterMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.06, metalness: 0, side: DoubleSide })
  material.colorNode = Fn(() => {
    const p = positionWorld.xz
    const shore = attribute('shore', 'float')
    const depth = smoothstep(-0.02, -0.38, shore)
    const flow = mx_noise_float(vec3(p.mul(1.4), time.mul(0.16))).mul(0.5).add(0.5)
    const ripples = mx_noise_float(vec3(p.mul(5.5), time.mul(0.45))).mul(0.5).add(0.5)
    const body = mix(mood.waterShallow, mood.waterDeep, depth).mul(mix(float(0.92), float(1.1), flow))
    const foamBand = smoothstep(-0.16, -0.02, shore).mul(smoothstep(0.5, 0.75, ripples.add(flow.mul(0.3))))
    // Cheap sky reflection: streaks of the backdrop colour that drift with the ripples.
    const sheen = smoothstep(0.35, 0.85, mx_noise_float(vec3(p.mul(0.9), time.mul(0.1))).mul(0.5).add(0.5))
    const reflected = mix(body, mood.waterSky, float(0.08).add(sheen.mul(0.22)))
    return mix(reflected, vec3(0.9, 0.95, 0.93), foamBand.mul(0.55)).mul(mix(float(0.97), float(1.05), ripples))
  })()
  material.emissiveNode = mood.waterSky.mul(0.08)
  return material
}
