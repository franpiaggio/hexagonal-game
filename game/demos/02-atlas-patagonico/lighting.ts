import { Color, DirectionalLight, Fog, HemisphereLight, PMREMGenerator, Scene, type WebGLRenderer } from 'three'
import { Sky } from 'three/addons/objects/Sky.js'

/** Build the sky reflection once; only water normals move during playback. */
export function lightLandscape(renderer: WebGLRenderer, scene: Scene) {
  scene.background = new Color('#b8c9c7')
  scene.fog = new Fog('#b8c9c7', 115, 185)
  scene.add(new HemisphereLight('#d9e8f5', '#544b31', .8))
  const sun = new DirectionalLight('#fff0d1', 3.7)
  sun.position.set(-40,48,25); sun.castShadow = true
  sun.shadow.mapSize.set(2048,2048)
  sun.shadow.camera.left = sun.shadow.camera.bottom = -43
  sun.shadow.camera.right = sun.shadow.camera.top = 43
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 150
  sun.shadow.bias = -.0003; sun.shadow.normalBias = .08
  scene.add(sun,sun.target)

  const sky = new Sky(), skyScene = new Scene()
  sky.scale.setScalar(1000)
  sky.material.uniforms.turbidity.value = 2.4
  sky.material.uniforms.rayleigh.value = 1.3
  sky.material.uniforms.mieCoefficient.value = .003
  sky.material.uniforms.mieDirectionalG.value = .78
  sky.material.uniforms.sunPosition.value.copy(sun.position).normalize()
  skyScene.add(sky)
  const generator = new PMREMGenerator(renderer)
  const environment = generator.fromScene(skyScene,.035,.1,1500,{size:128})
  scene.environment = environment.texture
  scene.environmentIntensity = .025
  generator.dispose(); sky.geometry.dispose(); sky.material.dispose()
  return () => { scene.environment = null; environment.dispose() }
}
