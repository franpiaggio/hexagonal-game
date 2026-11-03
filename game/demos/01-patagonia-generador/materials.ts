// TSL materials that replace the kit's originals.
// Everything is shaded in world space so neighbouring tiles read as one continuous landscape,
// and every tint goes through `mood` uniforms so day / dusk / autumn / night / winter blend smoothly.

import { Color, DoubleSide, MeshStandardMaterial, Texture } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  Fn,
  attribute,
  bumpMap,
  color,
  dot,
  float,
  max,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  mx_worley_noise_float,
  normalView,
  normalWorld,
  positionGeometry,
  positionLocal,
  positionViewDirection,
  positionWorld,
  pow,
  saturate,
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
  /** 0..1 blanket of snow over every upward-facing surface (winter). */
  snowCover: uniform(0),
  /** 0..1 frozen water. */
  ice: uniform(0),
  waterDeep: uniform(new Color('#1d4a52')),
  waterShallow: uniform(new Color('#5d9f95')),
  saturation: uniform(1.15),
  /** Colour the water mirrors: a lighter take on the backdrop. */
  waterSky: uniform(new Color('#9fb8c0')),
  /** How much light reaches the lake bed as caustics. */
  caustics: uniform(1),
}

const SNOW = color('#eef1f4')

/** Snow on upward-facing surfaces: above the snow line, or everywhere with `snowCover`. */
const snowMask = Fn(() => {
  // Crisp edges: snow that fades over a wide band reads as blur under the tilt-shift lens.
  const ragged = mx_noise_float(positionWorld.xz.mul(1.7)).mul(0.22)
  const height = smoothstep(mood.snowLine.sub(0.05), mood.snowLine.add(0.05), positionWorld.y.add(ragged))
  const drift = smoothstep(0.25, 0.6, mx_noise_float(positionWorld.xz.mul(0.9)).mul(0.5).add(0.5).add(mood.snowCover.mul(0.9)))
  const blanket = mood.snowCover.mul(drift)
  return max(height, blanket).mul(smoothstep(0.42, 0.55, normalWorld.y))
})

/**
 * Ground: drops the noisy tiled texture + crumpled normal map of the kit.
 * Keeps vertex colours (grass / sand banks / rock) and adds large soft meadow patches,
 * mid-frequency mottling and a fine grain, all continuous across tiles.
 * Below the waterline it becomes a lake bed lit by moving caustics.
 */
export function createGroundMaterial(waterLevel: number) {
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

    // Lake bed: darker with depth, with caustic light lines dancing on it.
    const depth = saturate(float(waterLevel).sub(y).mul(9))
    const cells = mx_worley_noise_float(vec3(p.mul(2.6), time.mul(0.35)))
    const cells2 = mx_worley_noise_float(vec3(p.mul(3.4).add(7), time.mul(0.28)))
    const caustic = pow(saturate(float(1).sub(cells.min(cells2).mul(2.2))), 3).mul(mood.caustics).mul(float(1).sub(mood.ice))
    const bed = surface.mul(mix(float(1), float(0.55), depth)).add(caustic.mul(0.45).mul(depth.mul(1.4).min(1)))
    const wet = surface.mul(0.82)
    const underwater = smoothstep(waterLevel + 0.004, waterLevel - 0.012, y).mul(smoothstep(0.3, 0.6, normalWorld.y))
    const atShore = smoothstep(waterLevel + 0.03, waterLevel + 0.004, y)
    const grounded = mix(mix(surface, wet, atShore), bed, underwater)

    return mix(grounded, SNOW, snowMask().mul(float(1).sub(underwater)))
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
    const lipColor = mix(color('#5d6b48'), SNOW, mood.snowCover)
    return mix(mix(layered, lipColor, lip.mul(0.6)), rock, smoothstep(0.02, 0.12, y))
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
    // Snow only dusts the upper side of the foliage, so woods stay readable in winter.
    const dusting = snowMask().mul(smoothstep(0.1, 0.7, normalWorld.y)).mul(0.6)
    const rgb = mix(leafRgb.mul(tint), SNOW, dusting)
    return vec4(rgb, smoothstep(0.08, 0.45, alpha))
  })()

  // Sway grows with height above the tile; phase varies per tile and across the canopy.
  material.positionNode = Fn(() => {
    const h = positionGeometry.y.max(0)
    // positionLocal is already instance-transformed here, so it varies per tree / per tile.
    const phase = positionLocal.x.mul(0.7).add(positionLocal.z.mul(0.9)).add(positionGeometry.x.mul(3)).add(positionGeometry.z.mul(2))
    const sway = sin(time.mul(1.4).add(phase)).mul(0.012).add(sin(time.mul(2.3).add(phase.mul(1.7))).mul(0.005))
    return positionLocal.add(vec3(sway.mul(h), 0, sway.mul(h).mul(0.6)))
  })()

  return material
}

/** Any other kit surface (rock, wood, roofs): keep texture + vertex colour, let snow settle on it. */
export function createSnowableMaterial(source: MeshStandardMaterial) {
  const map = source.map
  const material = new MeshStandardNodeMaterial({
    roughness: Math.max(source.roughness, 0.7),
    metalness: 0,
    vertexColors: true,
  })
  material.colorNode = Fn(() => {
    const base = map ? texture(map).rgb : vec3(1)
    return mix(base.mul(color(source.color)), SNOW, snowMask())
  })()
  return material
}

/**
 * Water for custom cells.
 * - `depth`: water column under the vertex → colour ramp and see-through shallows.
 * - `shore`: signed distance to the bank → animated foam line.
 * Ripples come from an animated bump so the sun throws glints; a fresnel term mirrors the sky.
 * With `mood.ice` it freezes into pale, cracked ice.
 */
export function createWaterMaterial() {
  const material = new MeshStandardNodeMaterial({ metalness: 0, side: DoubleSide, transparent: true })

  const p = positionWorld.xz
  const ripple = Fn(() => {
    const a = mx_noise_float(vec3(p.mul(2.2), time.mul(0.35)))
    const b = mx_noise_float(vec3(p.mul(5.5).add(3), time.mul(0.6)))
    return a.mul(0.7).add(b.mul(0.3)).mul(float(1).sub(mood.ice))
  })()
  material.normalNode = bumpMap(ripple, float(0.9))
  material.roughnessNode = mix(float(0.05), float(0.35), mood.ice)

  material.colorNode = Fn(() => {
    const depth = attribute('depth', 'float')
    const shore = attribute('shore', 'float')
    const deepness = smoothstep(0.0, 0.11, depth)
    const body = mix(mood.waterShallow, mood.waterDeep, deepness)

    // Fresnel: grazing angles mirror the sky colour.
    const facing = saturate(dot(normalView, positionViewDirection))
    const fresnel = pow(float(1).sub(facing), 4).mul(0.85).add(0.08)
    const mirrored = mix(body, mood.waterSky, fresnel)

    const foamNoise = mx_noise_float(vec3(p.mul(6), time.mul(0.5))).mul(0.5).add(0.5)
    const foam = smoothstep(-0.12, -0.015, shore).mul(smoothstep(0.42, 0.7, foamNoise.add(sin(time.mul(1.3).add(shore.mul(40))).mul(0.15))))
    const water = mix(mirrored, vec3(0.92, 0.96, 0.95), foam.mul(0.6))

    const cracks = smoothstep(0.02, 0.0, mx_worley_noise_float(p.mul(3.2)).sub(0.06).abs())
    const ice = mix(color('#c3dbe4'), color('#7fa7ba'), deepness).mul(float(1).sub(cracks.mul(0.18)))
    return mix(water, ice, mood.ice)
  })()

  material.opacityNode = Fn(() => {
    const depth = attribute('depth', 'float')
    return mix(smoothstep(0.0, 0.07, depth).mul(0.75).add(0.2), float(0.97), mood.ice)
  })()

  return material
}

/** Procedural conifers on mountain slopes: vertex-coloured, mood-tinted, snow-dusted, swaying. */
export function createTreeMaterial() {
  // Vertex colours are read explicitly so snow can fully replace them.
  const material = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 })
  material.colorNode = Fn(() => {
    const drift = mx_noise_float(positionWorld.xz.mul(0.7)).mul(0.5).add(0.5)
    const tint = mix(vec3(0.85, 1.0, 0.92), vec3(1.05, 1.0, 0.85), drift).mul(mood.needleTint)
    return mix(vertexColor(0).rgb.mul(tint), SNOW, snowMask().mul(smoothstep(0.2, 0.8, normalWorld.y)).mul(0.7))
  })()
  material.positionNode = Fn(() => {
    const h = positionGeometry.y.max(0)
    const phase = positionLocal.x.mul(0.9).add(positionLocal.z.mul(1.1))
    const sway = sin(time.mul(1.3).add(phase)).mul(0.03)
    return positionLocal.add(vec3(sway.mul(h), 0, sway.mul(h).mul(0.5)))
  })()
  return material
}
