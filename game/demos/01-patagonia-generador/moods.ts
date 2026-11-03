// Lighting + colour presets. main.ts eases every value towards the active mood.

import { Color, Vector3 } from 'three'
import type { MoodId } from './generator'

export type Mood = {
  bgCenter: Color
  bgEdge: Color
  sunColor: Color
  sunIntensity: number
  sunDir: Vector3
  hemiSky: Color
  hemiGround: Color
  hemiIntensity: number
  exposure: number
  grassTint: Color
  leafTint: Color
  needleTint: Color
  snowLine: number
  waterDeep: Color
  waterShallow: Color
  waterSky: Color
  saturation: number
  /** Warm light in village houses, 0..1. */
  windows: number
}

const c = (hex: string) => new Color(hex)
const rgb = (r: number, g: number, b: number) => new Color(r, g, b)
const dir = (x: number, y: number, z: number) => new Vector3(x, y, z).normalize()

export const MOODS: Record<MoodId, Mood> = {
  dia: {
    bgCenter: c('#5f7d86'),
    bgEdge: c('#16242a'),
    sunColor: c('#fff1dc'),
    sunIntensity: 3.3,
    sunDir: dir(-0.55, 1, -0.3),
    hemiSky: c('#dce9f0'),
    hemiGround: c('#6e6450'),
    hemiIntensity: 1.2,
    exposure: 1.0,
    grassTint: rgb(1, 1, 1),
    leafTint: rgb(1, 1, 1),
    needleTint: rgb(1, 1, 1),
    snowLine: 1.55,
    waterDeep: c('#1c4a53'),
    waterShallow: c('#5ea296'),
    waterSky: c('#9cc4c9'),
    saturation: 1.28,
    windows: 0,
  },
  atardecer: {
    bgCenter: c('#d99068'),
    bgEdge: c('#2b1825'),
    sunColor: c('#ffb98a'),
    sunIntensity: 3.9,
    sunDir: dir(-1, 0.42, 0.25),
    hemiSky: c('#f6b9a0'),
    hemiGround: c('#3d2836'),
    hemiIntensity: 0.85,
    exposure: 1.02,
    grassTint: rgb(0.97, 1.04, 0.86),
    leafTint: rgb(1.18, 0.96, 0.72),
    needleTint: rgb(1.05, 0.95, 0.85),
    snowLine: 1.4,
    waterDeep: c('#1d3550'),
    waterShallow: c('#5f86a0'),
    waterSky: c('#9fa6cc'),
    saturation: 1.12,
    windows: 0.45,
  },
  otono: {
    bgCenter: c('#a48d63'),
    bgEdge: c('#241b12'),
    sunColor: c('#ffe0b5'),
    sunIntensity: 3.4,
    sunDir: dir(-0.7, 0.8, 0.1),
    hemiSky: c('#f1e2c4'),
    hemiGround: c('#54432f'),
    hemiIntensity: 1.05,
    exposure: 1.0,
    grassTint: rgb(1.18, 1.02, 0.72),
    leafTint: rgb(2.1, 0.78, 0.32),
    needleTint: rgb(1.02, 0.96, 0.84),
    snowLine: 1.15,
    waterDeep: c('#1f414a'),
    waterShallow: c('#6f9c8a'),
    waterSky: c('#a3b9bd'),
    saturation: 1.2,
    windows: 0,
  },
  noche: {
    bgCenter: c('#2b3c66'),
    bgEdge: c('#04060c'),
    sunColor: c('#a9c1ff'),
    sunIntensity: 1.25,
    sunDir: dir(0.35, 1, -0.65),
    hemiSky: c('#3d5288'),
    hemiGround: c('#0b0e18'),
    hemiIntensity: 0.6,
    exposure: 1.18,
    grassTint: rgb(0.78, 0.94, 1.08),
    leafTint: rgb(0.82, 0.95, 1.12),
    needleTint: rgb(0.85, 0.95, 1.1),
    snowLine: 1.3,
    waterDeep: c('#0c2034'),
    waterShallow: c('#36648a'),
    waterSky: c('#4a6496'),
    saturation: 0.95,
    windows: 1,
  },
}
