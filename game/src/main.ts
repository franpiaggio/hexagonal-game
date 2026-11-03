import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 8, 10)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5))
const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.position.set(5, 10, 5)
sun.castShadow = true
scene.add(sun)

// Hex grid placeholder: flat-top hexagonal prisms laid out in axial coordinates.
const HEX_RADIUS = 1
const hexGeometry = new THREE.CylinderGeometry(HEX_RADIUS * 0.95, HEX_RADIUS * 0.95, 0.3, 6)
const GRID_RADIUS = 3

for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
  for (let r = Math.max(-GRID_RADIUS, -q - GRID_RADIUS); r <= Math.min(GRID_RADIUS, -q + GRID_RADIUS); r++) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.35 + (q + r) * 0.02, 0.5, 0.45),
    })
    const hex = new THREE.Mesh(hexGeometry, material)
    hex.position.set(HEX_RADIUS * 1.5 * q, 0, HEX_RADIUS * Math.sqrt(3) * (r + q / 2))
    hex.rotation.y = Math.PI / 6
    hex.castShadow = true
    hex.receiveShadow = true
    scene.add(hex)
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
})
