// Tuning panel (Tweakpane), mounted only with `?debug`. Everything here edits live values that
// main.ts already reads every frame, so changes show at once; "Copiar" buttons export the
// tuned values as code to paste back into the sources.

import { Pane, type FolderApi } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { Color, Vector3, type DirectionalLight, type PerspectiveCamera } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import type { LandscapeSpec, MoodId } from './generator'
import type { Mood } from './moods'
import type { Quality, createGovernor } from './quality'
import { homestead } from './tiles'

type Uniform = { value: number }

export type DebugHooks = {
  renderer: WebGPURenderer
  camera: PerspectiveCamera
  sun: DirectionalLight
  quality: Quality
  governor: ReturnType<typeof createGovernor>
  view: { elevation: number; azimuth: number; sway: number; framing: number }
  grade: { contrast: Uniform; saturation: Uniform; vignette: Uniform; grain: Uniform; ao: Uniform; focal: number }
  bokehScale: Uniform
  aoPass: () => { radius: Uniform; thickness: Uniform } | null
  moods: Record<MoodId, Mood>
  liveMood: () => Mood
  lockMood: (mood: Mood | null) => void
  spec: () => LandscapeSpec | null
  index: () => number
  fullBleed: () => boolean
  autoplay: () => boolean
  setAutoplay: (on: boolean) => void
  goTo: (index: number) => void
  rebuild: () => void
  toggleFullBleed: () => void
  reframe: () => void
  redrawShadows: () => void
  onFrame: (fn: () => void) => void
}

const MOOD_IDS: MoodId[] = ['dia', 'atardecer', 'otono', 'noche', 'invierno']
/** Mood fields that multiply a texture and may exceed 1: edited as three numbers, not a swatch. */
const TINTS = new Set(['grassTint', 'leafTint', 'needleTint'])
const RANGES: Record<string, [number, number]> = {
  sunIntensity: [0, 8],
  hemiIntensity: [0, 3],
  exposure: [0.4, 2],
  snowLine: [0, 3],
  snowCover: [0, 1],
  ice: [0, 1],
  caustics: [0, 2],
  saturation: [0, 2],
  windows: [0, 1],
  bloom: [0, 1],
}

function copyMood(into: Mood, from: Mood) {
  const dst = into as Record<string, unknown>
  for (const [k, v] of Object.entries(from)) {
    if (v instanceof Color) (dst[k] as Color).copy(v)
    else if (v instanceof Vector3) (dst[k] as Vector3).copy(v)
    else dst[k] = v
  }
}

const cloneMood = (m: Mood) => {
  const out = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(m)) out[k] = v instanceof Color || v instanceof Vector3 ? v.clone() : v
  return out as Mood
}

const r2 = (x: number) => Math.round(x * 100) / 100

/** The mood as it would be written in moods.ts. */
function moodSource(id: string, m: Mood) {
  const lines = Object.entries(m).map(([k, v]) => {
    if (v instanceof Vector3) return `    ${k}: dir(${r2(v.x)}, ${r2(v.y)}, ${r2(v.z)}),`
    if (v instanceof Color) return TINTS.has(k) ? `    ${k}: rgb(${r2(v.r)}, ${r2(v.g)}, ${r2(v.b)}),` : `    ${k}: c('#${v.getHexString()}'),`
    return `    ${k}: ${r2(v as number)},`
  })
  return `  ${id}: {\n${lines.join('\n')}\n  },`
}

async function copy(text: string) {
  console.log(text)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard needs focus/permission; the console copy above is the fallback.
  }
}

export function mountDebug(h: DebugHooks) {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;top:8px;right:8px;width:300px;max-height:calc(100vh - 16px);overflow:auto;z-index:20'
  document.body.append(host)
  // The demo hides the cursor when idle; keep it while tuning.
  const style = document.createElement('style')
  style.textContent = 'body.idle { cursor: auto !important } body.idle #next { opacity: 1 !important }'
  document.head.append(style)
  // Panel input must not reach the demo's keyboard shortcuts or wheel zoom.
  for (const type of ['keydown', 'wheel', 'pointerdown'] as const) host.addEventListener(type, (e) => e.stopPropagation())

  const pane = new Pane({ container: host, title: 'Patagonia · debug' })
  pane.registerPlugin(EssentialsPlugin)
  const tabs = pane.addTab({ pages: [{ title: 'Escena' }, { title: 'Ambiente' }, { title: 'Rendimiento' }] })
  const [sceneTab, moodTab, perfTab] = tabs.pages

  // --- Escena ---------------------------------------------------------------------------
  const land = sceneTab.addFolder({ title: 'Paisaje' })
  const info = { variante: 0, semilla: '', ambiente: '' }
  land.addBinding(info, 'variante', { readonly: true, format: (v) => v.toFixed(0) })
  land.addBinding(info, 'semilla', { readonly: true })
  land.addBinding(info, 'ambiente', { readonly: true })
  const jump = { variante: 0 }
  land.addBinding(jump, 'variante', { label: 'ir a', step: 1, min: 0, max: 200 })
  land.addButton({ title: 'Ir a variante' }).on('click', () => h.goTo(jump.variante))
  land.addButton({ title: 'Siguiente' }).on('click', () => h.goTo(h.index() + 1))
  land.addButton({ title: 'Regenerar actual' }).on('click', h.rebuild)
  land.addButton({ title: 'Pantalla completa (F)' }).on('click', h.toggleFullBleed)
  const auto = { autoplay: h.autoplay() }
  land.addBinding(auto, 'autoplay').on('change', (e) => h.setAutoplay(e.value))
  land.addButton({ title: 'Copiar spec (JSON)' }).on('click', () => void copy(JSON.stringify(h.spec())))

  const houses = sceneTab.addFolder({ title: 'Casas', expanded: false })
  houses.addBinding(homestead, 'share', { label: 'casas sueltas', min: 0, max: 1, step: 0.05 })
  houses.addButton({ title: 'Aplicar (regenera)' }).on('click', h.rebuild)

  const cam = sceneTab.addFolder({ title: 'Cámara' })
  cam.addBinding(h.view, 'elevation', { label: 'elevación°', min: 10, max: 85 }).on('change', h.reframe)
  cam.addBinding(h.view, 'azimuth', { label: 'azimut°', min: -180, max: 180 }).on('change', h.reframe)
  cam.addBinding(h.view, 'framing', { label: 'encuadre', min: 0.3, max: 1.5 }).on('change', h.reframe)
  cam.addBinding(h.view, 'sway', { label: 'vaivén', min: 0, max: 0.3 })
  cam
    .addBinding(h.camera, 'fov', { label: 'fov°', min: 8, max: 60 })
    .on('change', () => {
      h.camera.updateProjectionMatrix()
      h.reframe()
    })

  const lens = sceneTab.addFolder({ title: 'Lente (tilt-shift)' })
  lens.addBinding(h.grade, 'focal', { label: 'banda foco ×', min: 0.2, max: 3 })
  lens.addBinding(h.bokehScale, 'value', { label: 'bokeh', min: 0, max: 10 })

  const look = sceneTab.addFolder({ title: 'Color final' })
  look.addBinding(h.grade.contrast, 'value', { label: 'contraste', min: 0.8, max: 1.4 })
  look.addBinding(h.grade.saturation, 'value', { label: 'saturación', min: 0, max: 2 })
  look.addBinding(h.grade.vignette, 'value', { label: 'viñeta', min: 0, max: 0.6 })
  look.addBinding(h.grade.grain, 'value', { label: 'grano', min: 0, max: 0.08 })
  const ao = h.aoPass()
  if (ao) {
    look.addBinding(h.grade.ao, 'value', { label: 'AO fuerza', min: 0, max: 1 })
    look.addBinding(ao.radius, 'value', { label: 'AO radio', min: 0.05, max: 1.5 })
    look.addBinding(ao.thickness, 'value', { label: 'AO grosor', min: 0.05, max: 2 })
  }

  const shadow = sceneTab.addFolder({ title: 'Sombras', expanded: false })
  shadow.addBinding(h.sun.shadow, 'bias', { min: -0.005, max: 0.005, step: 0.0001 }).on('change', h.redrawShadows)
  shadow.addBinding(h.sun.shadow, 'normalBias', { min: 0, max: 0.2 }).on('change', h.redrawShadows)
  shadow.addBinding(h.sun.shadow, 'radius', { label: 'suavizado', min: 0, max: 8 }).on('change', h.redrawShadows)
  const map = { size: h.sun.shadow.mapSize.x }
  shadow
    .addBinding(map, 'size', { label: 'resolución', options: { '512': 512, '1024': 1024, '2048': 2048, '4096': 4096 } })
    .on('change', (e) => {
      h.sun.shadow.mapSize.set(e.value, e.value)
      h.redrawShadows()
    })

  sceneTab.addButton({ title: 'Copiar ajustes de escena' }).on('click', () =>
    void copy(
      JSON.stringify(
        {
          view: h.view,
          fov: h.camera.fov,
          focal: h.grade.focal,
          bokeh: h.bokehScale.value,
          contrast: h.grade.contrast.value,
          saturation: h.grade.saturation.value,
          vignette: h.grade.vignette.value,
          grain: h.grade.grain.value,
          ao: { mix: h.grade.ao.value, radius: ao?.radius.value, thickness: ao?.thickness.value },
          shadow: { bias: h.sun.shadow.bias, normalBias: h.sun.shadow.normalBias, radius: h.sun.shadow.radius },
          homesteadShare: homestead.share,
        },
        null,
        2,
      ),
    ),
  )

  // --- Ambiente: edit a preset while it is forced on every landscape ---------------------------
  const edit = cloneMood(h.moods.dia)
  const pick = { ambiente: 'auto' as MoodId | 'auto' }
  const moodFolders: FolderApi[] = []
  moodTab
    .addBinding(pick, 'ambiente', { options: { 'auto (el del paisaje)': 'auto', ...Object.fromEntries(MOOD_IDS.map((id) => [id, id])) } })
    .on('change', (e) => {
      if (e.value === 'auto') h.lockMood(null)
      else {
        copyMood(edit, h.moods[e.value])
        h.lockMood(edit)
      }
      moodFolders.forEach((f) => (f.disabled = e.value === 'auto'))
      pane.refresh()
    })

  const groups: [string, string[]][] = [
    ['Sol y cielo', ['sunColor', 'sunIntensity', 'sunDir', 'hemiSky', 'hemiGround', 'hemiIntensity', 'bgCenter', 'bgEdge']],
    ['Imagen', ['exposure', 'saturation', 'bloom', 'windows']],
    ['Vegetación', ['grassTint', 'leafTint', 'needleTint']],
    ['Agua', ['waterDeep', 'waterShallow', 'waterSky', 'caustics', 'ice']],
    ['Nieve', ['snowLine', 'snowCover']],
  ]
  const m = edit as Record<string, unknown>
  for (const [title, keys] of groups) {
    const f = moodTab.addFolder({ title, expanded: title === 'Sol y cielo' })
    f.disabled = true
    moodFolders.push(f)
    for (const k of keys) {
      const v = m[k]
      if (v instanceof Vector3) {
        // Sun as altitude / compass angle: easier to aim than a raw vector.
        const sunAngles = {
          get altura() {
            return (Math.asin(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI
          },
          set altura(deg: number) {
            const az = Math.atan2(v.z, v.x)
            const a = (deg * Math.PI) / 180
            v.set(Math.cos(a) * Math.cos(az), Math.sin(a), Math.cos(a) * Math.sin(az))
            h.redrawShadows()
          },
          get rumbo() {
            return (Math.atan2(v.z, v.x) * 180) / Math.PI
          },
          set rumbo(deg: number) {
            const a = Math.asin(Math.max(-1, Math.min(1, v.y)))
            const az = (deg * Math.PI) / 180
            v.set(Math.cos(a) * Math.cos(az), Math.sin(a), Math.cos(a) * Math.sin(az))
            h.redrawShadows()
          },
        }
        f.addBinding(sunAngles, 'altura', { label: 'sol altura°', min: 3, max: 89 })
        f.addBinding(sunAngles, 'rumbo', { label: 'sol rumbo°', min: -180, max: 180 })
      } else if (v instanceof Color && TINTS.has(k)) {
        const tint = {
          get v() {
            return { x: v.r, y: v.g, z: v.b }
          },
          set v(p: { x: number; y: number; z: number }) {
            v.setRGB(p.x, p.y, p.z)
          },
        }
        const axis = { min: 0, max: 1.6, step: 0.01 }
        f.addBinding(tint, 'v', { label: k, x: axis, y: axis, z: axis })
      } else if (v instanceof Color) {
        const swatch = {
          get v() {
            return `#${v.getHexString()}`
          },
          set v(hex: string) {
            v.set(hex)
          },
        }
        f.addBinding(swatch, 'v', { label: k })
      } else {
        const [min, max] = RANGES[k] ?? [0, 2]
        f.addBinding(m, k, { min, max })
      }
    }
  }
  moodTab.addButton({ title: 'Guardar en el preset (sesión)' }).on('click', () => {
    if (pick.ambiente !== 'auto') copyMood(h.moods[pick.ambiente], edit)
  })
  moodTab.addButton({ title: 'Copiar como código (moods.ts)' }).on('click', () => {
    const id = pick.ambiente === 'auto' ? 'actual' : pick.ambiente
    void copy(moodSource(id, pick.ambiente === 'auto' ? h.liveMood() : edit))
  })

  // --- Rendimiento ----------------------------------------------------------------------
  const fps = perfTab.addBlade({ view: 'fpsgraph', label: 'fps', rows: 2 }) as unknown as { begin: () => void; end: () => void }
  const stats = { ms: 0, dpr: 0, escalon: 0, drawCalls: 0, triangulos: 0, gama: h.quality.tier, backend: '' }
  stats.backend = (h.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2'
  perfTab.addBinding(stats, 'ms', { readonly: true, view: 'graph', min: 0, max: 50, label: 'ms/frame' })
  perfTab.addBinding(stats, 'ms', { readonly: true, format: (v) => v.toFixed(1), label: 'ms' })
  perfTab.addBinding(stats, 'dpr', { readonly: true, format: (v) => v.toFixed(2) })
  perfTab.addBinding(stats, 'escalon', { readonly: true, label: 'recortes', format: (v) => v.toFixed(0) })
  perfTab.addBinding(stats, 'drawCalls', { readonly: true, format: (v) => v.toFixed(0) })
  perfTab.addBinding(stats, 'triangulos', { readonly: true, format: (v) => `${(v / 1000).toFixed(0)}k` })
  perfTab.addBinding(stats, 'gama', { readonly: true })
  perfTab.addBinding(stats, 'backend', { readonly: true })

  let last = performance.now()
  let tick = 0
  fps.begin()
  h.onFrame(() => {
    fps.end()
    fps.begin()
    const t = performance.now()
    stats.ms += (t - last - stats.ms) * 0.1
    last = t
    // Cheap fields every frame; the text refresh only a few times a second.
    if (++tick % 15 === 0) {
      stats.dpr = h.governor.dpr
      stats.escalon = h.governor.rung
      stats.drawCalls = h.renderer.info.render.drawCalls
      stats.triangulos = h.renderer.info.render.triangles
      const spec = h.spec()
      info.variante = h.index()
      info.semilla = spec ? String(spec.seed) : ''
      info.ambiente = spec ? `${spec.mood}${pick.ambiente !== 'auto' ? ` → ${pick.ambiente}` : ''}` : ''
    }
  })
  return pane
}
