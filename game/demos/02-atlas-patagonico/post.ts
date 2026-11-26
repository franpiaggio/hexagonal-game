import { ShaderMaterial, WebGLRenderTarget, Vector2, type Camera, type Scene, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const tiltShader = {
  uniforms: { tDiffuse: { value: null }, direction: { value: new Vector2() }, focus: { value: .49 }, strength: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 direction;
    uniform float focus;
    uniform float strength;
    varying vec2 vUv;
    void main(){
      float mask = pow(smoothstep(.065,.43,abs(vUv.y-focus)),1.45);
      vec2 stepUV = direction * mask * strength;
      // Pair adjacent Gaussian taps using bilinear sampling: 21 weights,
      // 11 fetches, with enough support to avoid repeated tree silhouettes.
      vec4 color = texture2D(tDiffuse,vUv) * .1005898;
      color += (texture2D(tDiffuse,vUv + stepUV*1.47658) + texture2D(tDiffuse,vUv - stepUV*1.47658)) * .1862652;
      color += (texture2D(tDiffuse,vUv + stepUV*3.44553) + texture2D(tDiffuse,vUv - stepUV*3.44553)) * .1369400;
      color += (texture2D(tDiffuse,vUv + stepUV*5.41490) + texture2D(tDiffuse,vUv - stepUV*5.41490)) * .0787101;
      color += (texture2D(tDiffuse,vUv + stepUV*7.38491) + texture2D(tDiffuse,vUv - stepUV*7.38491)) * .0353674;
      color += (texture2D(tDiffuse,vUv + stepUV*9.35577) + texture2D(tDiffuse,vUv - stepUV*9.35577)) * .0124225;
      gl_FragColor = color;
    }
  `,
}
export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const composer = new EffectComposer(renderer)
  composer.renderTarget1.samples = composer.renderTarget2.samples = 2
  const render = new RenderPass(scene, camera), horizontal = new ShaderPass(tiltShader), vertical = new ShaderPass(tiltShader), output = new OutputPass()
  composer.addPass(render); composer.addPass(horizontal); composer.addPass(vertical); composer.addPass(output)
  // Snapshot the outgoing frame once. Only one 3D world is rendered during
  // the dissolve, keeping forest geometry and shadow work at their usual cost.
  const previous = new WebGLRenderTarget(1, 1, { depthBuffer: false })
  const display = new ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { current: { value: composer.readBuffer.texture }, previous: { value: previous.texture }, progress: { value: 1 }, hasPrevious: { value: false }, aspect: { value: 1 } },
    vertexShader: tiltShader.vertexShader,
    fragmentShader: `
      uniform sampler2D current, previous;
      uniform float progress, aspect;
      uniform bool hasPrevious;
      varying vec2 vUv;
      vec3 soften(sampler2D image, float radius) {
        vec2 d = vec2(radius / aspect, radius);
        vec3 c = texture2D(image, vUv).rgb * .24;
        c += (texture2D(image,vUv+vec2(d.x,0)).rgb + texture2D(image,vUv-vec2(d.x,0)).rgb
            + texture2D(image,vUv+vec2(0,d.y)).rgb + texture2D(image,vUv-vec2(0,d.y)).rgb) * .12;
        c += (texture2D(image,vUv+d*.707).rgb + texture2D(image,vUv-d*.707).rgb
            + texture2D(image,vUv+vec2(d.x,-d.y)*.707).rgb + texture2D(image,vUv+vec2(-d.x,d.y)*.707).rgb) * .07;
        return c;
      }
      void main() {
        float p = progress;
        float ease = p*p*p*(p*(p*6.0-15.0)+10.0);
        vec3 incoming = soften(current, .009 * (1.0-ease));
        vec3 outgoing = hasPrevious ? soften(previous, .009 * ease) : vec3(.72,.77,.72);
        gl_FragColor = vec4(mix(outgoing,incoming,ease),1.0);
      }
    `,
  })
  const quad = new FullScreenQuad(display)
  const copy = new ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { source: { value: composer.readBuffer.texture } },
    vertexShader: tiltShader.vertexShader,
    fragmentShader: 'uniform sampler2D source; varying vec2 vUv; void main(){gl_FragColor=texture2D(source,vUv);}',
  })
  const copyQuad = new FullScreenQuad(copy)
  return {
    begin(hasPrevious: boolean) {
      display.uniforms.hasPrevious.value = hasPrevious
      if (hasPrevious) {
        composer.renderToScreen = false; composer.render()
        previous.setSize(composer.readBuffer.width,composer.readBuffer.height)
        copy.uniforms.source.value = composer.readBuffer.texture
        renderer.setRenderTarget(previous); copyQuad.render(renderer); renderer.setRenderTarget(null)
      }
      display.uniforms.progress.value = 0
    },
    transition(progress: number) { display.uniforms.progress.value = progress },
    render() {
      const transitioning = display.uniforms.progress.value < 1
      composer.renderToScreen = !transitioning; composer.render()
      if (transitioning) {
        display.uniforms.current.value = composer.readBuffer.texture
        renderer.setRenderTarget(null); quad.render(renderer)
      }
    },
    resize(width: number, height: number, ratio: number) {
      composer.setPixelRatio(ratio); composer.setSize(width, height)
      display.uniforms.aspect.value = width / height
      horizontal.uniforms.direction.value.set(.0016 * height / width, 0)
      vertical.uniforms.direction.value.set(0, .0016)
    },
    focus(value: number) { horizontal.uniforms.focus.value = vertical.uniforms.focus.value = value },
    enable(enabled: boolean) { horizontal.enabled = vertical.enabled = enabled },
    dispose() { for (const pass of composer.passes) pass.dispose(); composer.dispose(); previous.dispose(); display.dispose(); copy.dispose(); quad.dispose(); copyQuad.dispose() },
  }
}
