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
  /** 0..1 snow blanket over everything (winter). */
  snowCover: number
  /** 0..1 frozen lakes and rivers. */
  ice: number
  caustics: number
  waterDeep: Color
  waterShallow: Color
  waterSky: Color
  saturation: number
  /** Warm light in village houses, 0..1. */
  windows: number
  bloom: number
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
    snowLine: 2.0,
    snowCover: 0,
    ice: 0,
    caustics: 1,
    waterDeep: c('#14505a'),
    waterShallow: c('#62b2a4'),
    waterSky: c('#b9d7dc'),
    saturation: 1.28,
    windows: 0,
    bloom: 0.05,
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
    snowLine: 1.85,
    snowCover: 0,
    ice: 0,
    caustics: 0.6,
    waterDeep: c('#1d3550'),
    waterShallow: c('#5f86a0'),
    waterSky: c('#f0b496'),
    saturation: 1.12,
    windows: 0.35,
    bloom: 0.12,
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
    snowLine: 1.6,
    snowCover: 0,
    ice: 0,
    caustics: 0.8,
    waterDeep: c('#153d4b'),
    waterShallow: c('#5c9aa2'),
    waterSky: c('#a8c4c8'),
    saturation: 1.2,
    windows: 0,
    bloom: 0.05,
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
    snowLine: 1.7,
    snowCover: 0,
    ice: 0,
    caustics: 0.25,
    waterDeep: c('#0c2034'),
    waterShallow: c('#36648a'),
    waterSky: c('#5a76a8'),
    saturation: 0.95,
    windows: 1,
    bloom: 0.3,
  },
  invierno: {
    bgCenter: c('#eef2f5'),
    bgEdge: c('#8794a1'),
    sunColor: c('#fff5e8'),
    sunIntensity: 2.7,
    sunDir: dir(-0.5, 0.75, -0.45),
    hemiSky: c('#e9f1f7'),
    hemiGround: c('#8a96a3'),
    hemiIntensity: 1.45,
    exposure: 1.0,
    grassTint: rgb(0.95, 1, 1.02),
    leafTint: rgb(0.88, 0.94, 1.0),
    needleTint: rgb(0.9, 0.97, 1.0),
    snowLine: 0.6,
    snowCover: 1,
    ice: 0.85,
    caustics: 0,
    waterDeep: c('#4a7584'),
    waterShallow: c('#9cc1c8'),
    waterSky: c('#e3eef2'),
    saturation: 1.0,
    windows: 0.3,
    bloom: 0.06,
  },
}
