# Técnicas de optimización para ~10k tiles en three.js

Ticket: [0005](../tickets/0005-tecnicas-optimizacion-10k-tiles.md) · Fecha: 2026-11-03 · three.js verificado contra `game/node_modules/three` **0.187.0**.

## Resumen

- **El cuello de botella principal es el número de draw calls y de cambios de estado, no los triángulos.** 10k tiles como `Mesh` sueltos son inviables en mobile. Arm recomienda apuntar a **~500 draw calls por frame** en mobile *nativo*. En WebGL/WebGPU desde el navegador el costo por draw es mayor, así que el objetivo realista es **< 100–200 draws** en mobile y **< ~500** en desktop.
- **Patrón recomendado:** dividir el mapa en **chunks** (p. ej. 16×16 o 32×32 tiles). Dentro de cada chunk, un `InstancedMesh` por tipo de tile o prop con pocas variantes, o un `BatchedMesh` cuando hay muchas geometrías distintas con el mismo material. El frustum culling se hace **por chunk**, que es lo que three ya hace por objeto. La geometría mergeada por chunk queda como alternativa para el terreno estático que casi nunca cambia.
- **Materiales:** pocos materiales, con texturas en un **atlas o array** comprimidas a **KTX2/Basis** (transcodifica a ASTC/ETC2/BC según el dispositivo). Geometría con **meshopt** (`EXT_meshopt_compression`) más cuantización, generada con gltfpack o glTF-Transform.
- **Sombras:** una sola `DirectionalLight` con sombra ajustada al área visible (la cámara es isométrica fija, así que el frustum de sombra es chico y estable). Mapa de 2048 en desktop y 1024 en mobile. **Sombra cacheada** con `shadow.autoUpdate = false` y `needsUpdate = true` solo al mover la cámara o cambiar el mapa. Probablemente no hace falta CSM: con una vista isométrica el rango de profundidad es corto. Hay que validarlo.
- **Postprocesado:** cada pass full-screen cuesta ancho de banda, que es lo más caro en GPUs de tiles (mobile). El tilt-shift se puede hacer barato con un blur separable de 2 passes modulado por la Y de pantalla, en la línea de `HorizontalTiltShiftShader` y `VerticalTiltShiftShader`, a **resolución reducida**. Hay que limitar el `pixelRatio` (máx. 2 en desktop, ~1.5 en mobile) y preferir MSAA nativo (o nada en mobile) en vez de FXAA/SMAA.
- **WebGL vs WebGPU:** en three r183, con escenas de muchos meshes **no instanciados**, `WebGPURenderer` midió **~2× más tiempo de CPU** que `WebGLRenderer`. La causa es el issue [#30560](https://github.com/mrdoob/three.js/issues/30560), **abierto** al 2026-11-03. Con instancing o batching la diferencia se reduce porque hay pocos objetos de render. El pipeline de chunks e instancing es el mismo para ambos renderers, así que esta investigación no fuerza la decisión. Sí favorece a WebGL si se pretendiera usar muchos meshes sueltos.
- **Medición:** **stats-gl** (FPS, CPU y GPU con timer queries, compatible con WebGLRenderer y WebGPURenderer), **`renderer.info`** (draw calls, triángulos, memoria), **Spector.js** (captura de frame en WebGL) y **WebGPU Inspector** (captura en WebGPU). Para medir en mobile real: Chrome remote debugging y Safari Web Inspector.

---

## 1. Agrupar geometría: InstancedMesh vs BatchedMesh vs merge por chunk

| Técnica | Qué hace | Cuándo usarla | Costos y límites |
|---|---|---|---|
| `InstancedMesh` | 1 geometría + 1 material, N matrices como atributo de instancia. 1 draw call. | **Una geometría repetida muchas veces**: tile base hexagonal, un tipo de árbol, una roca. Pocas variantes (2–4): un `InstancedMesh` por variante. | Culling de todo el objeto (bounding sphere de todas las instancias), sin culling por instancia. Cambiar una instancia = `setMatrixAt` + `instanceMatrix.needsUpdate`. Color por instancia con `setColorAt`. Sin visibilidad por instancia nativa (se hace con `count` y swap, o con escala 0). |
| `BatchedMesh` | Varias geometrías distintas con el mismo material en un buffer. Se dibujan con `WEBGL_multi_draw` (multiDraw). | **Muchas geometrías distintas con el mismo material**: kit de props variado (decenas de tipos de árboles, rocas y casas). | Culling por instancia (`perObjectFrustumCulled = true` por defecto) y ordenamiento (`sortObjects`), ambos en CPU cada frame. `setVisibleAt`, `setGeometryAt` y `optimize()`. Todas las geometrías deben tener el mismo layout de atributos e índices. En **WebGPU (0.187)** el backend emite un `drawIndexed` por grupo de draw dentro del mismo pass. Las instancias consecutivas de la misma geometría se fusionan (`_mergedDraw*`), así que no es un único draw de GPU. En el foro se reportaron casos más lentos que meshes sueltos (thread 67324). Hay que medir. |
| Geometría mergeada por chunk (`BufferGeometryUtils.mergeGeometries`) | Un `Mesh` por chunk y por material, con los vértices ya en espacio mundo. | Terreno **estático** que cambia poco. Funciona igual en WebGL y WebGPU y no tiene overhead por instancia. | Más memoria: duplica vértices por cada tile. Modificar un tile = reconstruir el chunk, conviene hacerlo en un worker. Sin LOD fino. |

Guía del foro de three.js ([How to choose between InstancedMesh and BatchedMesh](https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221)): 1 geometría → `InstancedMesh`; 2–4 → varios `InstancedMesh`; muchas → `BatchedMesh`. Según agargaro (autor de InstancedMesh2), multiDraw rinde peor que el instancing con cantidades enormes (>100k).

**Recomendación para este proyecto.** Chunk de N×N tiles. Por chunk: tiles base en `InstancedMesh` (una por tipo de bioma o variante) y props en `BatchedMesh` si el kit es variado, o `InstancedMesh` por prop si son pocos. Con 10k tiles visibles y chunks de 16×16, quedan ~40 chunks visibles. Con ~3–5 objetos por chunk son **~120–200 draws**, que está justo para mobile. Con chunks de 32×32 son ~10–12 chunks y ~50 draws. Hay alternativa: **objetos globales** (un `InstancedMesh` o `BatchedMesh` por tipo para todo el mapa) con culling propio por chunk, compactando las instancias visibles. Eso da menos draws, pero el culling queda en CPU y es código propio. El tamaño de chunk se debería decidir en el ticket del modelo de datos.

Librería de terceros a evaluar: **InstancedMesh2** (agargaro), que agrega culling por instancia, LOD, sorting y visibilidad sobre `InstancedMesh`. No es oficial.

`SceneOptimizer` (`three/addons/utils/SceneOptimizer.js`) convierte meshes sueltos en `BatchedMesh` automáticamente. Su documentación dice que es experimental. Sirve para prototipar, no como base.

## 2. Frustum culling por chunk

- three hace culling por objeto con su bounding sphere (`frustumCulled = true` por defecto). Para que funcione con chunks, cada `InstancedMesh` o `BatchedMesh` tiene que cubrir **solo su chunk**. Hay que llamar a `computeBoundingSphere()` y `computeBoundingBox()` al reconstruirlo; si no, el bounding queda viejo y el chunk desaparece o nunca se descarta.
- Con cámara isométrica fija el frustum es una caja ortográfica o una pirámide muy estrecha, y el conjunto visible se puede calcular **analíticamente** en la grilla (rango de chunks bajo el rectángulo proyectado). Es más barato que testear esferas. Además permite poner `visible = false` en chunks enteros, saltear su update y hacer streaming de chunks.
- El **occlusion culling** casi no aporta en vista isométrica de arriba (poca oclusión), así que no vale la pena.

## 3. LOD

- `THREE.LOD` cambia de objeto según la distancia a la cámara, por objeto. Sirve para pocos objetos grandes y es inútil para 10k instancias.
- En isométrica con zoom, la "distancia" efectiva es el **nivel de zoom**. Es más simple tener un **LOD por chunk ligado al zoom**: con zoom lejano, chunk con props simplificados o sin props chicos (hierba, piedritas) y tiles con menos segmentos.
- Para generar los niveles: `meshopt_simplify` (vía gltfpack `-si R` o `gltf-transform simplify`). Ejemplo del README de meshoptimizer: target de 20 % de índices con error de 1 %.
- `BatchedMesh` permite cambiar la geometría de una instancia con `setGeometryIdAt`, lo que da un LOD por instancia barato. InstancedMesh2 trae LOD integrado.

## 4. Impostores

- Billboards o sprites con una imagen pre-renderizada del modelo. Solo sirven si el ángulo de vista cambia poco. Aquí la cámara es isométrica **con rotación en pasos de 60° o 90°**, así que serían 4–6 vistas por prop en un atlas.
- Cuándo usarlos: props muy numerosos y lejanos (vegetación densa en zoom out) si el LOD geométrico no alcanza. En zoom cercano, con el look "realista" de maqueta, se notan; no conviene arrancar con ellos. Son una optimización de fase 2, solo si las mediciones lo piden.
- Ojo: suelen requerir `alphaTest` o `discard`, que en GPUs de tiles (Mali, Adreno, Apple) interfiere con early-Z o HSR. Qualcomm recomienda evitar discard ([Adreno best practices](https://docs.qualcomm.com/doc/80-78185-2/topic/mobile_best_practices.html)).

## 5. Texturas: atlas, arrays y KTX2/Basis

- **Reducir materiales es reducir draws.** Todas las variantes de tile y prop que compartan shader deben compartir material: atlas de texturas o `DataArrayTexture` / `CompressedArrayTexture` indexada por un atributo de instancia.
- **KTX2 + Basis Universal** (`KTX2Loader`): un único archivo `.ktx2` se transcodifica en runtime al formato que soporta la GPU (ASTC en Apple y la mayoría de Android modernos, ETC2 en Android, BC en desktop). Hay que llamar `loader.detectSupport(renderer)` antes de cargar; acepta `WebGLRenderer` y `WebGPURenderer` ([docs KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)). En 0.187 el backend WebGPU pide las features `texture-compression-bc`, `-etc2` y `-astc` si existen (`WebGPUConstants.js`).
  - **ETC1S**: archivos chicos y calidad media. Sirve para albedo de props y para terreno.
  - **UASTC**: más calidad y archivos más grandes. Conviene para normal maps y para texturas cercanas.
- Beneficio: la VRAM baja ~4–8× frente a RGBA8, y el **ancho de banda** baja, que es lo que más importa en mobile. Qualcomm recomienda ASTC en sRGB y mipmaps siempre. También advierte que el anisotrópico 16× puede costar hasta 16× por lookup, aunque en promedio cuesta menos de 2×. Para la vista oblicua, un anisotrópico 4× es un buen compromiso.
- Discover three.js: tamaños potencia de 2 y la textura más chica que sirva. Un JPG y un PNG del mismo tamaño ocupan la misma VRAM ([Tips & Tricks](https://discoverthreejs.com/tips-and-tricks/)).

## 6. Geometría: meshopt vs Draco

- **meshopt** (`EXT_meshopt_compression`, `GLTFLoader.setMeshoptDecoder`): decodificación de 3–6 GB/s en CPU desktop ([README meshoptimizer](https://github.com/zeux/meshoptimizer)). Preserva el orden óptimo para el vertex cache, comprime también animaciones y está pensado para ir debajo de gzip o brotli del servidor ([gltfpack docs](https://meshoptimizer.org/gltf/)). Se combina con `KHR_mesh_quantization` (cuantización por defecto en gltfpack), que además **reduce la memoria de GPU**, no solo la descarga.
- **Draco**: mejor ratio en bruto, pero decodificación más lenta (WASM en worker). Según zeux, desordena vértices e índices y deja meshes menos eficientes de renderizar. No se encontró un benchmark primario Draco vs meshopt. Las cifras como "5–10× más rápido" son de blogs y no están verificadas.
- **Recomendación:** meshopt + cuantización para todos los modelos del kit (muchos modelos chicos, carga rápida, sin el costo de arranque de WASM de Draco). Pipeline: `gltfpack -cc -tc` o `gltf-transform optimize` / `meshopt` / `etc1s` / `uastc` ([CLI glTF-Transform](https://gltf-transform.dev/cli)). `gltf-transform inspect` dice si un modelo pesa por geometría, por texturas o por draw calls.
- La compresión **no** reduce el costo de render (salvo la cuantización). Es para descarga y parse.

## 7. Sombras

- **Una** `DirectionalLight` con sombra. Las sombras de point lights se renderizan 6 veces y conviene evitarlas ([Discover three.js](https://discoverthreejs.com/tips-and-tricks/)).
- **Frustum de sombra ajustado** al área visible. Con cámara isométrica, el área visible es un rombo acotado: el `shadow.camera` ortográfico sigue al target de la cámara, y snapear su posición a texel evita el shimmering. Resolución: 2048² en desktop y 1024² en mobile (estimación propia, a validar).
- **Sombras cacheadas:** en 0.187 `WebGLShadowMap` respeta `renderer.shadowMap.autoUpdate = false` y también `light.shadow.autoUpdate = false` por luz, junto con `needsUpdate = true` para forzar un render. Con mapa y sol estáticos, la sombra solo se re-renderiza al panear o hacer zoom (o con un margen extra para panear sin re-render). Eso **elimina el pass de sombra** (que repite todos los draws) en la mayoría de los frames. Si hay elementos animados (árboles con viento, unidades) hay que separar: sombra estática cacheada más sombra dinámica chica, o aceptar el re-render.
- **CSM** (`three/addons/csm/CSM.js` para WebGL, `CSMShadowNode` para WebGPU/TSL): cada cascada es otro pass con todos los draws. Está pensado para cámaras en perspectiva con gran profundidad. En isométrica con zoom limitado una sola cascada bien ajustada suele alcanzar, así que conviene empezar sin CSM.
- **Baked:** como el mapa es procedural, no hay bake offline. Se puede hornear AO por tile en el modelo (vertex color o textura del kit) y dejar en tiempo real solo la sombra direccional.
- Las sombras **duplican los draw calls** cuando se actualizan. Es una razón más para tener pocos draws.

## 8. Postprocesado (tilt-shift y demás)

- En GPUs de tiles (Mali, Adreno, Apple) cada pass full-screen escribe y lee el framebuffer completo en memoria. Qualcomm recomienda menos render targets, bajar la resolución y escalar, y limpiar o invalidar attachments al empezar los passes. MSAA 2× es "prácticamente gratis" en Adreno, pero en pantallas mobile de alta densidad conviene considerar no usar antialiasing ([Adreno best practices](https://docs.qualcomm.com/doc/80-78185-2/topic/mobile_best_practices.html)).
- **Tilt-shift barato:** `HorizontalTiltShiftShader` y `VerticalTiltShiftShader` (addons) implementan un blur gaussiano de 2 passes, con 9 samples por pass, modulado por la distancia a una línea horizontal de foco. Es un "fake tilt-shift" sin depth, y es el más barato. En WebGPU/TSL se puede componer con `GaussianBlurNode`, que tiene `resolutionScale`, o hacer un DoF real con `DepthOfFieldNode`, que usa viewZ y es más caro. Para el look realista se puede combinar la máscara por Y de pantalla con la profundidad.
- **Bajar la resolución del blur** (½ o ¼): la zona desenfocada no necesita detalle, así que el costo del blur cae 4–16×.
- **Pocos passes y fusionados:** color grading, viñeta y tone mapping en **un solo pass** final junto con el composite del tilt-shift. Bloom, SSAO o GTAO solo en desktop (preset de calidad).
- **Antialiasing:** según Discover three.js, el MSAA nativo es muy barato y FXAA/SMAA bajaron considerablemente el framerate en todas sus pruebas. Si hay postprocesado, MSAA sobre un render target multisample (`samples: 4` en WebGL2) o el MSAA del pipeline de WebGPU. En mobile se puede omitir.
- **pixelRatio:** hay dispositivos con DPR de 3 a 5. Limitarlo con `renderer.setPixelRatio(Math.min(devicePixelRatio, X))` es una de las optimizaciones más grandes en fill-rate ([Discover three.js](https://discoverthreejs.com/tips-and-tricks/)). El blur del tilt-shift además disimula la baja resolución en los bordes.

## 9. Presupuestos aproximados (orientativos, a validar midiendo)

| Métrica | Desktop (60 fps, 16.6 ms) | Mobile gama media (30 fps, 33 ms) | Fuente o razón |
|---|---|---|---|
| Draw calls (pass principal) | ≤ ~300–500 | ≤ ~100–200 | Arm: ~500 en mobile *nativo* ([foro Arm](https://community.arm.com/support-forums/f/graphics-gaming-and-vr-forum/48848/overhead-of-the-driver)). El navegador agrega overhead (validación y traducción ANGLE o Dawn), así que se aplica un margen. Estimación propia. |
| Triángulos visibles | ~2–5 M | ~0.5–1 M | Estimación propia. 10k tiles × 50–300 tris + props. Qualcomm: evitar triángulos de menos de ~4 px, lo que justifica el LOD por zoom. |
| CPU frame (JS + render) | ≤ ~6–8 ms | ≤ ~12–15 ms | Deja margen para lógica y GC. Estimación. |
| Shadow map | 2048², cacheado | 1024², cacheado | Estimación. |
| Passes de post full-screen | ≤ 4–5 | ≤ 2–3 (blur a ½ o ¼) | Ancho de banda en GPUs de tiles. |
| pixelRatio máx. | 2 | 1–1.5 | Discover three.js. |
| VRAM texturas | — | ≤ ~100–200 MB, KTX2 | Estimación. |

Referencia real del costo de CPU por mesh (thread r183, RTX 4090 laptop): 4 000 meshes sueltos = 4.5 ms de CPU con `WebGLRenderer` y 9.7 ms con `WebGPURenderer`. En mobile la CPU es varias veces más lenta, lo que confirma que **hace falta instancing o batching**.

## 10. WebGL vs WebGPU (puntos que afectan la optimización)

- `WebGPURenderer` usa UBO o bind groups por objeto de render. El issue [#30560](https://github.com/mrdoob/three.js/issues/30560) ("Current UBO system has severe performance issues with many render items") sigue **abierto** al 2026-11-03. Thread de medición: [WebGPURenderer 2× slower CPU…](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904). El **primer frame** fue 5–10× más lento (compilación de pipelines), así que conviene precompilar con `renderer.compileAsync(scene, camera)` durante la carga.
- `BatchedMesh` usa `WEBGL_multi_draw` en WebGL. En WebGPU (0.187) itera `drawIndexed` dentro del pass (`WebGPUBackend.js` ~l.2147).
- Ventajas de WebGPU para más adelante: compute shaders (culling en GPU, generación), timestamp queries nativas (`trackTimestamp`, `resolveTimestampsAsync`) y TSL para los postprocesos. Safari 26 trae WebGPU en macOS, iOS, iPadOS y visionOS ([WebKit WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)), y WebKit afirma que mapea mejor a Metal que WebGL.
- Conclusión: con chunks + instancing/batching + pocos materiales, ambos renderers quedan en un régimen de pocos objetos de render. La decisión del renderer se puede tomar en otro ticket con un benchmark propio de esta escena en los dispositivos objetivo.

## 11. Herramientas de medición

| Herramienta | Qué mide | Notas |
|---|---|---|
| [stats-gl](https://github.com/RenaudRohlinger/stats-gl) | FPS, CPU ms y GPU ms | `stats.init(renderer)` + `stats.update()`. `trackGPU: true` usa timer queries (WebGL `EXT_disjoint_timer_query_webgl2`, en Safari detrás de un feature flag) o timestamp queries (WebGPU). Funciona con WebGLRenderer y WebGPURenderer. Tiene paneles custom (por ejemplo, para draw calls). |
| `renderer.info` | `render.calls` / `triangles` (WebGL); `render.drawCalls` / `triangles` y `memory` (WebGPU, `src/renderers/common/Info.js`) | Con varios passes (sombra, post), poner `info.autoReset = false` y llamar `info.reset()` por frame para contar todo. Mostrarlo en un panel de stats-gl. |
| [Spector.js](https://github.com/BabylonJS/Spector.js) | Captura de un frame WebGL: lista de comandos, estado y texturas | Extensión de Chrome/Firefox o `npm i spectorjs`. **Solo WebGL.** Sirve para auditar cuántos draws y cambios de estado hay realmente. |
| [WebGPU Inspector](https://github.com/brendan-duncan/webgpu_inspector) | Captura de frames WebGPU, buffers, texturas y errores de pipeline | Extensión de Chrome. Para el path WebGPU. |
| Chrome DevTools Performance + remote debugging (Android) / Safari Web Inspector (iOS) | CPU del main thread, GC y long tasks en dispositivo real | Lo único confiable para mobile es medir en el dispositivo. |
| Truco: `scene.overrideMaterial = new MeshBasicMaterial()` | Si los FPS suben, el cuello está en la GPU (shading); si no, en la CPU o en los draws | [Discover three.js](https://discoverthreejs.com/tips-and-tricks/) |
| Profilers de vendor (Arm Performance Studio, Snapdragon Profiler, Xcode GPU) | Contadores de GPU | Tienen acceso limitado a navegadores. Opcionales. |

Escena de benchmark sugerida para CI de performance (ticket futuro): 10k tiles + props a zoom máximo, ruta de cámara fija y registro de p50 y p95 de frame time, `render.calls` y `triangles`.

---

## Fuentes

Primarias (código de three.js 0.187.0 en `game/node_modules/three`):
- `src/objects/BatchedMesh.js` (docs de clase, `perObjectFrustumCulled`, `sortObjects`, `optimize`, `setGeometryAt`)
- `src/renderers/webgpu/WebGPUBackend.js` (draw de BatchedMesh, `trackTimestamp`)
- `src/renderers/webgl/WebGLIndexedBufferRenderer.js` (`WEBGL_multi_draw`)
- `src/renderers/webgl/WebGLShadowMap.js` (`autoUpdate` / `needsUpdate` global y por luz)
- `src/renderers/common/Info.js`, `src/renderers/webgpu/utils/WebGPUConstants.js`
- `examples/jsm/shaders/HorizontalTiltShiftShader.js`, `examples/jsm/tsl/display/GaussianBlurNode.js`, `DepthOfFieldNode.js`, `examples/jsm/csm/`, `examples/jsm/utils/SceneOptimizer.js`

Web:
- three.js docs, KTX2Loader: https://threejs.org/docs/pages/KTX2Loader.html
- three.js issue #30560: https://github.com/mrdoob/three.js/issues/30560
- Foro three.js, InstancedMesh vs BatchedMesh: https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221
- Foro three.js, slowdown con BatchedMesh: https://discourse.threejs.org/t/significant-performance-drop-and-high-cpu-usage-with-batchedmesh/67324
- Foro three.js, WebGPURenderer vs WebGLRenderer con muchos meshes (r183): https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904
- Discover three.js, Tips & Tricks: https://discoverthreejs.com/tips-and-tricks/
- Qualcomm Adreno, Mobile Best Practices: https://docs.qualcomm.com/doc/80-78185-2/topic/mobile_best_practices.html
- Arm (Peter Harris), presupuesto de draw calls: https://community.arm.com/support-forums/f/graphics-gaming-and-vr-forum/48848/overhead-of-the-driver
- meshoptimizer: https://github.com/zeux/meshoptimizer · gltfpack: https://meshoptimizer.org/gltf/
- glTF-Transform CLI: https://gltf-transform.dev/cli
- stats-gl: https://github.com/RenaudRohlinger/stats-gl
- Spector.js: https://github.com/BabylonJS/Spector.js
- WebGPU Inspector: https://github.com/brendan-duncan/webgpu_inspector
- WebKit, Safari 26 / WebGPU: https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/

Limitaciones: no se pudo leer el texto completo de la guía Arm Mali Best Practices ni de las guías de Apple sobre TBDR (las páginas no devolvieron contenido). Lo dicho sobre GPUs de tiles se apoya en la guía de Qualcomm. Los presupuestos de triángulos, VRAM y shadow map son estimaciones propias, no cifras de vendor.
