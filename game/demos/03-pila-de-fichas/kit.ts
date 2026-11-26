// Loads the seven kit tiles (public/assets/fichas, built from models/glb) and draws
// the small overlays the game needs: slot outlines, edge markers and the HUD icon.
// Tiles are rendered with their own exported materials, unchanged.

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { KINDS, edgeOf, type EdgeType, type Kind, type TileDef } from './rules'

/** Kit circumradius (models/manifest.json `radius`). */
export const HEX_R = 2
export const APOTHEM = (HEX_R * Math.sqrt(3)) / 2

/** HUD colours, taken from the kit palette in models/manifest.json. */
export const PALETTE: Record<EdgeType, string> = {
  pradera: '#98a47e',
  bosque: '#476d5d',
  caserio: '#995f4b',
  montana: '#969b98',
  agua: '#678f89',
}

const masters = new Map<Kind, THREE.Object3D>()

export async function loadKit(baseUrl: string) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  await Promise.all(
    KINDS.map(async (kind) => {
      const gltf = await loader.loadAsync(`${baseUrl}${kind}.glb`)
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
      })
      masters.set(kind, gltf.scene)
    }),
  )
}

/** Clone of a kit tile. Geometry and materials are shared, so nothing needs disposing. */
export function tileObject(def: TileDef): THREE.Group {
  const group = new THREE.Group()
  group.add(masters.get(def.kind)!.clone(true))
  return group
}

const corner = (i: number, r: number) => {
  const a = ((60 * i + 30) * Math.PI) / 180
  return new THREE.Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r)
}

/** Flat hex outline for open slots. */
export function slotOutline(): THREE.LineLoop {
  const pts = Array.from({ length: 6 }, (_, i) => corner(i, HEX_R * 0.92).setY(0.01))
  const g = new THREE.BufferGeometry().setFromPoints(pts)
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: '#3b3428', transparent: true, opacity: 0.35 }))
}

/** Six bars on the tile rim, coloured by edge state while previewing. */
export function edgeMarkers(): THREE.Mesh[] {
  const geo = new THREE.BoxGeometry(0.09, 0.05, HEX_R * 0.8)
  return Array.from({ length: 6 }, (_, k) => {
    const bar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    const a = (k * Math.PI) / 3
    bar.position.set(Math.cos(a) * APOTHEM * 0.97, 0.45, -Math.sin(a) * APOTHEM * 0.97)
    bar.rotation.y = a
    return bar
  })
}

/** 2D icon: one wedge per edge, coloured by edge type. Canvas y grows towards +Z. */
export function drawTileIcon(ctx: CanvasRenderingContext2D, def: TileDef, rot: number, size: number) {
  const s = ctx.canvas.width
  ctx.clearRect(0, 0, s, s)
  const cx = s / 2
  const cy = s / 2
  const pt = (deg: number, r = size) => {
    const a = (deg * Math.PI) / 180
    return [cx + Math.cos(a) * r, cy - Math.sin(a) * r] as const
  }
  for (let k = 0; k < 6; k++) {
    const [x1, y1] = pt(60 * k - 30)
    const [x2, y2] = pt(60 * k + 30)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.closePath()
    ctx.fillStyle = PALETTE[edgeOf(def, rot, k)]
    ctx.fill()
  }
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const [x, y] = pt(60 * i + 30)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.strokeStyle = 'rgba(40,34,26,0.55)'
  ctx.lineWidth = 2
  ctx.stroke()
}
