/**
 * Lightweight, screen-space miniature effect for an orthographic game camera.
 * This approximates the focused band; it does not reproduce physical lens tilt.
 * Unlike an override depth pass, it preserves the foliage's alpha silhouettes.
 *
 * Add AFTER RenderPass and BEFORE OutputPass:
 * const tilt = createTiltShift({ width, height, strength: 5, focusY: 0.48 });
 * composer.addPass(tilt.horizontal);
 * composer.addPass(tilt.vertical);
 *
 * On resize: tilt.resize(renderTargetWidth, renderTargetHeight).
 * To disable: tilt.horizontal.enabled = tilt.vertical.enabled = false.
 * On teardown: tilt.dispose().
 *
 * strength is a pixel multiplier; focusY is measured from the bottom (0–1).
 * Start with strength 3–5, then tune to viewport resolution and camera framing.
 * Camera blur is not embedded in the GLBs.
 *
 * Based on Three.js' bundled HorizontalTiltShiftShader / VerticalTiltShiftShader.
 * https://github.com/mrdoob/three.js/tree/dev/examples/jsm/shaders
 */
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

export function createTiltShift({ width, height, strength = 5, focusY = .48 }) {
  const horizontal = new ShaderPass(HorizontalTiltShiftShader);
  const vertical = new ShaderPass(VerticalTiltShiftShader);
  horizontal.uniforms.r.value = vertical.uniforms.r.value = focusY;
  function resize(w, h) {
    if (!(w > 0 && h > 0)) throw new Error('Tilt-shift requires positive render dimensions');
    horizontal.uniforms.h.value = strength / w;
    vertical.uniforms.v.value = strength / h;
  }
  resize(width, height);
  return {
    horizontal,
    vertical,
    resize,
    setFocus(y) {
      horizontal.uniforms.r.value = vertical.uniforms.r.value = Math.max(0, Math.min(1, y));
    },
    dispose() {
      horizontal.dispose();
      vertical.dispose();
    },
  };
}
