# 0002 — WebGPURenderer vs WebGLRenderer (three.js r187)

Investigado el 2026-11-03 contra three.js 0.187.0 (instalado en `game/node_modules/three`), las release notes r184–r187, el foro y los issues de three.js, MDN browser-compat-data, caniuse y Chrome for Developers.

## Resumen

- **Recomendación: `WebGPURenderer` + TSL (`three/webgpu`) con el fallback automático a WebGL2**, con dos condiciones. Primero, la escena se arma con pocos draw calls (InstancedMesh/BatchedMesh por chunk, no un `Mesh` por tile). Segundo, ningún sistema crítico depende de compute shaders.
- **Por qué:** el proyecto empieza de cero, sin GLSL heredado ni dependencias de `EffectComposer`. El stack de postprocesado TSL (`RenderPipeline`) ya trae DoF, GTAO/SSAO, bloom, TRAA, SMAA, SSR y SSGI, que es justo lo que pide un tilt-shift realista. Ahí va el desarrollo nuevo de three.js. pmndrs/postprocessing sigue sin soportar WebGPU y su v6 declara `three < 0.188`.
- **Riesgo principal:** `WebGPURenderer` tiene un costo de CPU por objeto unas 2 veces mayor que `WebGLRenderer` en escenas con miles de meshes sueltos (issue #30560, **todavía abierto**). En el backend WebGL2 de fallback es incluso peor. Con instancing/batching ese costo deja de importar. Si se ignora, el presupuesto de 30 fps en mobile está en peligro.
- **Soporte de WebGPU (nov 2026):** alrededor del 88 % global según caniuse. Lo tienen Chrome/Edge desktop, Chrome Android 121+ (Android 12+, GPU Qualcomm/ARM), Safari 26 (macOS e iOS) y Firefox en Windows y macOS con Apple Silicon. **No** lo tienen Firefox en Linux, Firefox en Mac Intel ni Firefox Android. Linux en Chrome es parcial. Esos usuarios caen al backend WebGL2.
- **Plan B:** si un spike de performance en un Android de gama media no llega a 30 fps con el fallback ni con WebGPU, volver a `WebGLRenderer` + `EffectComposer`/pmndrs v6. Con `WebGLNodesHandler` (r187) se pueden reutilizar en ese camino los materiales TSL, pero no el stack de postprocesado.

## Comparación

| Eje | `WebGPURenderer` (+ fallback WebGL2) | `WebGLRenderer` clásico |
|---|---|---|
| Estado | Renderer "nuevo" de three.js, con desarrollo activo en cada release (r184–r187: bind groups, sombras, BatchedMesh). En el foro, la recomendación de la comunidad sigue siendo "usalo si necesitás algo que WebGL no da". | Maduro y estable. Sigue recibiendo features: en r186 se agregó `SunLight` con CSM nativo. No está deprecado. |
| Navegadores | WebGPU donde existe y WebGL2 automático donde no (`getFallback` en `WebGPURenderer.js`). Un solo código para ambos. | WebGL2 en prácticamente todo. |
| Shaders | TSL, que compila a WGSL o GLSL según el backend. `ShaderMaterial`/`onBeforeCompile` en GLSL no sirven. | GLSL, `ShaderMaterial`, `onBeforeCompile`. Desde r187 también acepta NodeMaterials/TSL con `WebGLNodesHandler`, con limitaciones: sin MRT, sin VSM, sin storage textures y sin el stack de postpro WebGPU. |
| Postprocesado | `RenderPipeline` (antes `PostProcessing`, renombrado en r183) con nodos TSL: `DepthOfFieldNode` (bokeh físico, con focusDistance/focalLength/bokehScale), `GTAONode`, `SSAONode`, `BloomNode`, `TRAANode`, `SMAANode`, `FXAANode`, `SSRNode`, `SSGINode`, `GaussianBlurNode`, `Lut3DNode`, `FSR1Node` y `TAAUNode` para upscaling. MRT nativo (normales y velocidad en un solo pase). **No hay un nodo "tilt-shift" listo**: se arma con DoF y una distancia de foco por banda de pantalla, o con un blur gaussiano con máscara en TSL (poco código). | `EffectComposer` con `BokehPass`, `GTAOPass`, `SSAOPass`, `SAOPass`, `UnrealBloomPass`, `SMAAPass` y `TAARenderPass`. pmndrs/postprocessing v6.39.6 (2026-11-01) trae `TiltShiftEffect` y efectos fusionados en un solo pase, que es lo más eficiente en mobile. pmndrs **no soporta `WebGPURenderer`**: el mantenedor dijo que "eventually", y existe una rama `v7` sin release. |
| InstancedMesh / BatchedMesh | Soportados. r187 fusiona draws consecutivos de BatchedMesh que comparten rango de geometría (#35259) y arregla offsets (r186). Hay ejemplos `webgpu_mesh_batch`, `webgpu_instance_mesh` y `webgpu_struct_drawindirect`. | Soportados y maduros (multi-draw en WebGL2 si existe `WEBGL_multi_draw`). |
| Sombras | `ShadowNode`, `CSMShadowNode`, `TileShadowNode` y `SunLightNode`, más VSM y sombras de contacto. Muchos fixes recientes (r185–r187), señal de que sigue madurando. Hay reportes de bias distinto al de WebGL (sugieren alrededor de -0.0005). | `SunLight`/CSM nativo (r186) y el addon CSM clásico. Comportamiento conocido. `PCFSoftShadowMap` se eliminó en r186 y queda PCF/VSM. |
| Compute shaders | `renderer.compute()` con TSL, storage buffers, draw indirect y occlusion queries. **Solo funcionan bien con backend WebGPU**: en el fallback WebGL2 no hay storage textures ni atomics. | No hay. Se hace GPGPU con render-to-texture o transform feedback a mano. |
| Performance medida | CPU por draw alrededor de 2 veces más alta: 4.000 meshes, r183, render de 9,7 ms contra 4,5 ms y primer frame de 167 ms contra 32 ms. Con `forceWebGL` da 10,3 ms y 344 ms. En r186, el backend WebGL2 hace un 80 % más de llamadas GL y tarda un 31 % más de CPU que `WebGLRenderer` por el tráfico de UBOs. Con instancing la brecha es mucho menor (ICS Media). Hubo una regresión en r182, arreglada en r183. | Referencia. Menor overhead por draw y compilación inicial más rápida. |

## Implicancias para este juego (10k tiles, 60/30 fps, tilt-shift realista)

1. **Draw calls:** con 10k tiles y un `Mesh` por tile, el problema de #30560 deja `WebGPURenderer` fuera del presupuesto mobile. Agrupando por chunk y tipo de tile en InstancedMesh o BatchedMesh quedan del orden de 100 a 300 draws, y ahí el overhead por draw de cualquiera de los dos renderers es despreciable. Esto conviene hacerlo igual, se elija el renderer que se elija.
2. **Tilt-shift realista:** es un DoF por profundidad o por banda de pantalla. Los dos caminos lo resuelven. Con TSL, el DoF, el AO (GTAO) y el bloom comparten MRT y se componen en un grafo de nodos. Con pmndrs, `TiltShiftEffect` viene hecho y fusionado. En calidad están parejos. La ventaja de TSL es que el mismo código corre en WebGPU y en WebGL2, y que el futuro del ecosistema va por ese lado.
3. **Compute:** la generación procedural tiene que ser determinista con semilla, así que conviene hacerla en Web Workers en CPU (ver "Generación en workers" en el mapa) y no en GPU. El culling de GPU (indirect draw y occlusion) sirve como optimización progresiva, solo si `renderer.backend.isWebGPUBackend`, nunca como requisito.
4. **Mobile de gama media:** Android 12+ con Chrome tiene WebGPU, y iOS 26 también. El fallback WebGL2 afecta sobre todo a Firefox (Linux y Android) y a iOS/Android viejos. Conviene medir en los dos backends.

## Recomendación y trade-offs

**Usar `WebGPURenderer` (import de `three/webgpu`) + TSL + `RenderPipeline`, con el fallback WebGL2 automático.**

A favor:
- Un solo código de shaders y postpro para WebGPU y WebGL2.
- Acceso a GTAO, TRAA, SSR, SSGI y MRT para el look de maqueta realista.
- Compute disponible para mejoras progresivas.
- Va en línea con el desarrollo activo de three.js. No ata el proyecto a pmndrs v6, que tiene techo de versión (`< 0.188`) y no soporta WebGPU.

En contra:
- Overhead de CPU por draw mayor, que obliga a disciplina de batching.
- Primer frame y compilación más lentos: usar `compileAsync` y precalentar.
- Hay menos ejemplos y librerías de terceros. Algunas utilidades dependen de internals de `WebGLRenderer`.
- Bugs y regresiones entre releases, como la de r182. Conviene fijar la versión exacta de three y actualizar con prueba de performance.
- Hay que armar el tilt-shift a mano en TSL.

Condiciones para confirmar la elección (spike corto antes de cerrar la spec de performance):
- Escena de prueba con alrededor de 10k tiles instanciados, sol con CSM, DoF tilt-shift, GTAO y bloom, en un Android de gama media en los dos backends (`forceWebGL: true` y WebGPU) y en desktop.
- Si no llega a 30 fps en mobile por CPU de render, comparar contra `WebGLRenderer` + pmndrs v6 con la misma escena. Si gana con claridad, cambiar de camino. Los materiales TSL se pueden mantener con `WebGLNodesHandler`, pero el postpro hay que reescribirlo.

## Fuentes

- three.js 0.187.0 local: `src/renderers/webgpu/WebGPURenderer.js` (fallback), `src/renderers/common/PostProcessing.js` (deprecado en r183), `examples/jsm/tsl/display/*` (nodos de postpro), `examples/jsm/tsl/WebGLNodesHandler.js` (limitaciones), `examples/jsm/lights/SunLight*.js`.
- Releases de three.js: [r184](https://github.com/mrdoob/three.js/releases/tag/r184), [r185](https://github.com/mrdoob/three.js/releases/tag/r185), [r186](https://github.com/mrdoob/three.js/releases/tag/r186), [r187](https://github.com/mrdoob/three.js/releases/tag/r187)
- [three.js #30560: UBO system has severe performance issues with many render items (abierto)](https://github.com/mrdoob/three.js/issues/30560)
- [three.js PR #34221: SunLight con CSM en WebGLRenderer](https://github.com/mrdoob/three.js/pull/34221)
- [three.js #30185: Node Materials en WebGLRenderer](https://github.com/mrdoob/three.js/issues/30185)
- [Lista de ejemplos r187 (files.json)](https://github.com/mrdoob/three.js/blob/r187/examples/files.json), por ejemplo [webgpu_postprocessing_dof](https://threejs.org/examples/#webgpu_postprocessing_dof), [webgpu_postprocessing_ao](https://threejs.org/examples/#webgpu_postprocessing_ao), [webgpu_mesh_batch](https://threejs.org/examples/#webgpu_mesh_batch), [webgpu_occlusion](https://threejs.org/examples/#webgpu_occlusion)
- Foro: [WebGPURenderer 2x slower CPU… (r183)](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904), [Regresión de performance y sombras r182 vs r170](https://discourse.threejs.org/t/webgpu-significant-performance-drop-and-shadow-quality-regression-in-r182-vs-webgl-r170/89322), [forceWebGL vs WebGLRenderer](https://discourse.threejs.org/t/webgpurenderer-forcewebgl-true-vs-webglrenderer/87805)
- [ICS Media: Getting started with Three.js on WebGPU (benchmark instanciado vs no instanciado)](https://ics.media/en/entry/250501/) (fuente secundaria)
- pmndrs/postprocessing: [v6.39.6 (requiere three ≥0.168 <0.188)](https://github.com/pmndrs/postprocessing/releases/tag/v6.39.6), [#700 respuesta del mantenedor sobre WebGPU](https://github.com/pmndrs/postprocessing/issues/700), [#643](https://github.com/pmndrs/postprocessing/issues/643)
- Soporte de navegadores: [caniuse WebGPU](https://caniuse.com/webgpu), [MDN browser-compat-data GPU.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json), [Chrome: WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview), [Firefox 147 release notes (WebGPU en Apple Silicon)](https://www.firefox.com/firefox/147.0/releasenotes/)
