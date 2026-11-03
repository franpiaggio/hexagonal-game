// TSL materials that replace the kit's originals.
// Everything is shaded in world space so neighbouring tiles read as one continuous landscape,
// and every tint goes through `mood` uniforms so day / dusk / autumn / night / winter blend smoothly.

import { Color, DoubleSide, MeshStandardMaterial, Texture } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  Fn,
  If,
  attribute,
  bumpMap,
  color,
  dot,
  fwidth,
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
  const ragged = mx_noise_float(positionWorld.mul(1.7)).mul(0.22)
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

    // Domain warp (shader-bible 04): patch edges bend into organic shapes instead of following
    // the noise lattice, so dry and lush grass meander like real pasture.
    const warp = vec2(mx_noise_float(p.mul(0.35)), mx_noise_float(p.mul(0.35).add(vec2(5.2, 1.3))))
    const patches = mx_fractal_noise_float(p.mul(0.11).add(warp.mul(0.7)), 3, 2.0, 0.5).mul(0.5).add(0.5)
    // Turf: anisotropic fine noise, stretched along a slowly turning direction, reads as grass
    // combed by the wind at miniature scale (sharp where the lens focuses, blurred elsewhere).
    const angle = warp.x.mul(1.6)
    const ca = angle.cos()
    const sa = angle.sin()
    const along = p.x.mul(ca).add(p.y.mul(sa))
    const across = p.y.mul(ca).sub(p.x.mul(sa))
    const turf = mx_noise_float(vec2(across.mul(58), along.mul(13))).mul(0.5).add(0.5)
    // Clumps: small soft tufts of denser, darker grass scattered through the meadow.
    const clumps = smoothstep(0.58, 0.82, mx_noise_float(p.mul(5.5).add(warp.mul(2.0))).mul(0.5).add(0.5))
    // 3D noise: on steep rock a top-down (xz) pattern would smear into vertical streaks.
    const q = positionWorld
    const mottling = mx_noise_float(q.mul(0.9)).mul(0.5).add(0.5)
    const grain = mx_noise_float(q.mul(7.0)).mul(0.5).add(0.5)
    const speckle = mx_noise_float(q.mul(23.0)).mul(0.5).add(0.5)

    // Grassiness: vertex colours that are clearly greener than they are red.
    const grassy = smoothstep(0.0, 0.06, base.g.sub(base.r))

    const lush = vec3(0.84, 1.03, 0.88)
    const dry = vec3(1.12, 1.04, 0.82)
    const tint = mix(lush, dry, smoothstep(0.32, 0.78, patches)).mul(mood.grassTint)
    const grassTint = mix(vec3(1), tint, grassy)

    // Stronger mottling + fine grain: at miniature scale the meadow should read as textured turf.
    const lum = mix(float(0.82), float(1.1), mottling)
      .mul(mix(float(0.9), float(1.07), grain))
      .mul(mix(float(0.92), float(1.06), speckle))

    // Turf and clumps only on open, upward-facing grass.
    const meadow = grassy.mul(smoothstep(0.75, 0.95, normalWorld.y))
    const sward = mix(float(1), mix(float(0.9), float(1.08), turf).mul(mix(float(1), float(0.84), clumps)), meadow)
    const top = saturation(base.mul(grassTint).mul(lum).mul(sward), mix(float(1.0), mood.saturation, grassy))

    // Kit tiles: soil cut on their thin vertical faces.
    // Geometry space, not instance space: rising or sinking tiles must not read as "underwater".
    const y = positionGeometry.y
    const soil = mix(color('#4a3a2a'), color('#76604a'), smoothstep(-0.12, -0.02, y))
    const side = mix(soil, top, smoothstep(-0.02, -0.004, y))
    const surface = mix(side, top, smoothstep(0.35, 0.75, normalWorld.y))

    // Lake bed: darker with depth, with caustic light lines dancing on it.
    const depth = saturate(float(waterLevel).sub(y).mul(9))
    const underwater = smoothstep(waterLevel + 0.004, waterLevel - 0.012, y).mul(smoothstep(0.3, 0.6, normalWorld.y))
    // Worley noise is the priciest thing in the shader: only pay for it on the lake bed.
    const caustic = float(0).toVar()
    If(underwater.greaterThan(0.001), () => {
      const cells = mx_worley_noise_float(vec3(p.mul(2.6), time.mul(0.15)))
      const cells2 = mx_worley_noise_float(vec3(p.mul(3.4).add(7), time.mul(0.12)))
      caustic.assign(pow(saturate(float(1).sub(cells.min(cells2).mul(2.2))), 3).mul(mood.caustics).mul(float(1).sub(mood.ice)))
    })
    const bed = surface.mul(mix(float(1), float(0.55), depth)).add(caustic.mul(0.45).mul(depth.mul(1.4).min(1)))
    const wet = surface.mul(0.82)
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
    const y = positionGeometry.y
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
    // Deciduous leaves are wide enough not to need dilation (it only fattens cards into squares).
    const o = float(deciduous ? 0 : 0.009)
    // Sample a sharper mip: far away, averaged alpha turns every leaf card into an opaque square.
    const tap = (dx: number, dy: number) => texture(map, uv().add(vec2(o.mul(dx), o.mul(dy)))).bias(float(-1.5))
    const taps = [tap(0, 0), tap(1, 0), tap(-1, 0), tap(0, 1), tap(0, -1)]
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
    // Alpha-to-coverage sharpening (Golus): a crisp, antialiased leaf edge at any distance,
    // instead of a soft threshold that bloats into the card's rectangle.
    const cut = deciduous ? 0.5 : 0.3
    const sharp = saturate(alpha.sub(cut).div(fwidth(alpha).max(0.0001)).add(0.5))
    return vec4(rgb, sharp)
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
  // Calm lake pace: everything on the surface runs on a slowed clock.
  const slow = time.mul(0.4)
  // Two drifting wave trains plus fine chop: enough slope for the sun to break into glints.
  const ripple = Fn(() => {
    const a = mx_noise_float(vec3(p.mul(1.6).add(slow.mul(vec2(0.05, 0.03))), slow.mul(0.3)))
    const b = mx_noise_float(vec3(p.mul(4.2).sub(slow.mul(vec2(0.08, -0.05))), slow.mul(0.55)))
    const c = mx_noise_float(vec3(p.mul(11.0), slow.mul(0.9)))
    return a.mul(0.55).add(b.mul(0.3)).add(c.mul(0.15)).mul(float(1).sub(mood.ice))
  })()
  material.normalNode = bumpMap(ripple, float(1.4))
  material.roughnessNode = mix(float(0.04), float(0.35), mood.ice)

  material.colorNode = Fn(() => {
    const depth = attribute('depth', 'float')
    const shore = attribute('shore', 'float')
    const deepness = smoothstep(0.0, 0.1, depth)
    // Shallow shelf hugging the banks: turquoise rim, then the deep body, then a darker core.
    const shelf = smoothstep(-0.05, -0.45, shore)
    const core = smoothstep(-0.5, -1.6, shore)
    const body = mix(mix(mood.waterShallow, mood.waterDeep, max(deepness.mul(0.6), shelf)), mood.waterDeep.mul(0.72), core)

    // Fresnel: grazing angles mirror the sky colour.
    const facing = saturate(dot(normalView, positionViewDirection))
    const fresnel = pow(float(1).sub(facing), 4).mul(0.75).add(0.06)
    const mirrored = mix(body, mood.waterSky, fresnel)

    // Sun-dappled pattern: thin meandering light lines (ridges of warped noise), like
    // sunlight refracted by ripples. Two layers drifting against each other.
    const warp = mx_noise_float(vec3(p.mul(0.9), slow.mul(0.2))).mul(0.6)
    const r1 = float(1).sub(mx_noise_float(vec3(p.mul(1.9).add(warp), slow.mul(0.28))).abs())
    const r2 = float(1).sub(mx_noise_float(vec3(p.mul(3.7).sub(warp), slow.mul(0.4).add(5))).abs())
    const veins = smoothstep(0.975, 0.997, r1).mul(0.55).add(smoothstep(0.982, 0.998, r2).mul(0.3))
    const patterned = mirrored.add(mood.waterSky.mul(veins).mul(0.13).mul(float(1).sub(core.mul(0.6))))

    // Glints: rare, sharp sparkles drifting on the surface.
    const sparkle = smoothstep(0.82, 0.95, mx_noise_float(vec3(p.mul(9.0), slow.mul(1.4))).mul(0.5).add(0.5))
    const glinted = patterned.add(vec3(1, 0.97, 0.9).mul(sparkle.mul(0.35)))

    // Foam: a broken lip on the bank plus thin wave lines that roll in towards the shore.
    const foamNoise = mx_noise_float(vec3(p.mul(6), slow.mul(0.5))).mul(0.5).add(0.5)
    const lip = smoothstep(-0.09, -0.01, shore).mul(smoothstep(0.35, 0.65, foamNoise))
    const wave = sin(shore.mul(26).add(slow.mul(1.6)).add(foamNoise.mul(2.5)))
    const lines = smoothstep(0.86, 0.97, wave).mul(smoothstep(-0.32, -0.08, shore)).mul(smoothstep(0.3, 0.6, foamNoise))
    const foam = max(lip, lines.mul(0.7))
    const water = mix(glinted, vec3(0.93, 0.97, 0.96), foam.mul(0.75))

    const cracks = smoothstep(0.02, 0.0, mx_worley_noise_float(p.mul(3.2)).sub(0.06).abs())
    const ice = mix(color('#c3dbe4'), color('#7fa7ba'), deepness).mul(float(1).sub(cracks.mul(0.18)))
    return mix(water, ice, mood.ice)
  })()

  // A little self-light keeps the water's own hue under strongly coloured suns
  // (dusk orange × navy albedo otherwise turns lakes brown).
  material.emissiveNode = Fn(() => {
    const shore = attribute('shore', 'float')
    const tone = mix(mood.waterShallow, mood.waterDeep, smoothstep(-0.05, -0.45, shore))
    return tone.mul(0.28).mul(float(1).sub(mood.ice))
  })()

  material.opacityNode = Fn(() => {
    const depth = attribute('depth', 'float')
    return mix(smoothstep(0.0, 0.07, depth).mul(0.75).add(0.2), float(0.97), mood.ice)
  })()

  return material
}

/** Ground clutter (tufts, flowers, pebbles, reeds): vertex colour, meadow tint, snow, breeze. */
export function createPropMaterial() {
  const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: DoubleSide })
  material.colorNode = Fn(() => {
    const base = vertexColor(0).rgb
    const grassy = smoothstep(0.0, 0.08, base.g.sub(base.r))
    const drift = mx_noise_float(positionWorld.xz.mul(0.6)).mul(0.5).add(0.5)
    const tint = mix(vec3(0.85, 1.04, 0.9), vec3(1.12, 1.03, 0.8), drift).mul(mood.grassTint)
    const tinted = base.mul(mix(vec3(1), tint, grassy))
    return mix(tinted, SNOW, mood.snowCover.mul(0.85).max(snowMask().mul(0.8)))
  })()
  material.positionNode = Fn(() => {
    const h = positionGeometry.y.max(0)
    const phase = positionLocal.x.mul(1.3).add(positionLocal.z.mul(0.8))
    const sway = sin(time.mul(1.6).add(phase)).mul(0.12)
    return positionLocal.add(vec3(sway.mul(h), 0, sway.mul(h).mul(0.6)))
  })()
  return material
}

/** Procedural conifers on mountain slopes: vertex-coloured, mood-tinted, snow-dusted, swaying. */
export function createTreeMaterial() {
  // Vertex colours are read explicitly so snow can fully replace them.
  const material = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 })
  material.colorNode = Fn(() => {
    const drift = mx_noise_float(positionWorld.xz.mul(0.7)).mul(0.5).add(0.5)
    const tint = mix(vec3(0.92, 0.97, 0.88), vec3(1.06, 1.0, 0.82), drift).mul(mood.needleTint)
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
