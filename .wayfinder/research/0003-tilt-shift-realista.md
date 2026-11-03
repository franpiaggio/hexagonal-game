# Research 0003: Técnicas de tilt-shift realista

Ticket: [0003-tilt-shift-realista](../tickets/0003-tilt-shift-realista.md) · three.js 0.187 · fecha: 2026-11-03

## Resumen

- **El blur tiene que salir de la profundidad, no de una banda fija de pantalla.** Held et al. (2010) muestran que un gradiente lineal vertical solo se parece al blur de una lente tilt-shift real cuando la escena es casi plana. Los edificios que sobresalen del suelo rompen la aproximación. En un juego 3D la profundidad ya está en el depth buffer, así que el blur basado en CoC (círculo de confusión) cuesta casi lo mismo que la banda y queda bien sobre árboles, edificios y relieve.
- **Recomendación: DoF con CoC por profundidad y blur barato a media resolución**, con el foco atado al target de la cámara. Habría dos o tres niveles de calidad. En mobile, un solo blur a media resolución mezclado por CoC (unos 6-10 taps por píxel en pantalla completa). En desktop, el `dof()` de TSL con bokeh (unos 45 taps por píxel). La banda de pantalla queda como fallback mínimo.
- **Cámara: perspectiva con FOV bajo (unos 20-30°)** es mejor que ortográfica para el look miniatura. Conserva algo de convergencia de perspectiva, que es la señal que el sistema visual combina con el blur para inferir la escala. Un FOV bajo mantiene el aspecto "casi isométrico". La ortográfica también funciona con DoF por profundidad, porque la cámara está inclinada y la profundidad varía en la pantalla, pero en three r187 tiene un detalle técnico (ver §4).
- **El resto del look** suma bastante y cuesta casi nada, porque va en el mismo pase de composición: saturación y contraste altos (Held et al. lo sugieren sin haberlo testeado), viñeta suave, luz de sol dura, cámara alta y materiales que parezcan de maqueta.
- **Ruta WebGL**: `pmndrs/postprocessing` v6.39.6 (peer `three >=0.168 <0.188`, compatible con 0.187) trae `DepthOfFieldEffect`, `TiltShiftEffect` (banda), `VignetteEffect`, `HueSaturationEffect` y `BrightnessContrastEffect`, todos fusionables en un `EffectPass`. **Ruta WebGPU** (`WebGPURenderer` + TSL): núcleo oficial con `dof()`, `gaussianBlur()`, `boxBlur()`, `hashBlur()`, `saturation()`, `vignette()` y `cdl()`. pmndrs no documenta soporte para WebGPU.

## 1. Qué hace que algo parezca una miniatura (evidencia perceptual)

Fuente principal: Held, Cooper, O'Brien & Banks, *Using Blur to Affect Perceived Distance and Size*, ACM TOG 29(2), 2010 ([PMC3088122](https://pmc.ncbi.nlm.nih.gov/articles/PMC3088122)).

- **Física del blur.** El diámetro del círculo de blur de un objeto a distancia `z1`, con el foco en `z0` y apertura `A`, es `c1 = |A·(s0/z0)·(1 − z0/z1)|`. Para una misma distancia relativa, el blur crece cuando `z0` baja: *"a small scene imaged from close range generates greater blur"*. Mucho blur relativo comunica entonces "esto está cerca y es chico". Por el mismo motivo, las maquetas de cine se filman con apertura chica para que parezcan grandes.
- **El blur solo no alcanza.** *"blur by itself provides little information about relative or absolute distance"*. El sistema visual lo combina con señales de perspectiva lineal y gradiente de textura.
- **Banda lineal vs blur consistente con la profundidad.** *"linear blur gradients do in fact yield close approximations of tilt-and-shift blur"*, pero solo *"provided that the scenes are roughly planar"*. Las diferencias grandes aparecen por *"the buildings, which protrude from the ground plane"*. El gradiente vertical influye en la escala percibida *"in a less compelling and consistent fashion than consistent blur does"*. Un gradiente no alineado con la profundidad casi no produce el efecto.
- **Color y contraste** (los autores lo proponen pero no lo testearon): *"more saturated objects tend to be perceived as nearer"*. En las miniaturas falsas *"the saturation of the entire image is often increased"*, y *"high-contrast textures are perceived as nearer"*.
- **Alineación con el sujeto.** Meese, Baker & Summers, *Fake Tilt-Shift Miniaturisation Causes Negative D-Prime for Detecting Reality*, i-Perception 3, 2012 ([doi:10.1068/id223](https://journals.sagepub.com/doi/abs/10.1068/id223)): *"the key factor for achieving FTS miniaturization is the correct alignment of the treatment with the subject, not the inclusion of a blur gradient"*. Para el juego, lo que tiene que estar nítido es lo que el jugador mira, o sea el target de la cámara.

**Implicancia para el diseño:** el plano de foco tiene que pasar por el punto de interés y el blur tiene que crecer con la distancia en profundidad a ese plano. Una lente normal tiene el plano de foco perpendicular al eje de visión. Con una cámara inclinada, ese plano corta el suelo en una línea horizontal de pantalla, y así aparece la "banda". Los objetos altos se desenfocan según su profundidad real. Un DoF estándar por `viewZ` ya produce el tilt-shift correcto. No hace falta simular la lente basculante (Scheimpflug).

## 2. Comparación de técnicas

Los costos son estimaciones mías a partir del código fuente: taps de textura por píxel, expresados en "equivalente a pantalla completa" (un pase a media resolución cubre ¼ de los píxeles). No son benchmarks medidos y conviene validarlos en el ticket de presupuesto de performance.

| Técnica | Implementación en three.js | Pases / RTs | Taps/px aprox. (equiv. full-res) | Usa profundidad | Calidad del look miniatura | Mobile 30 fps |
|---|---|---|---|---|---|---|
| A. Banda de pantalla (gauss separable modulado por `|y − r|`) | `HorizontalTiltShiftShader` + `VerticalTiltShiftShader` (WebGL, `ShaderPass`) | 2 pases full-res | 18 (9+9) | No | Bien en terreno plano. Falla con edificios y relieve (Held). | Sí |
| A'. Banda con Kawase a media resolución | pmndrs `TiltShiftEffect` (offset, rotation, focusArea 0.4, feather 0.3, `resolutionScale` 0.5, `KernelSize.MEDIUM`) | Kawase de 4 iteraciones a ½ res + composite | ~4-5 + composite | No | Igual que A, más suave | Sí, muy barato |
| B. CoC por profundidad + un blur mezclado | TSL: `pass()` + `getViewZNode()` + `gaussianBlur(..., {resolutionScale: .5})` o `boxBlur` + `mix(color, blurred, smoothstep(...))` (ejemplo `webgpu_postprocessing_dof_basic`) | Blur separable a ½ res (2 pases) + composite | ~6-10 (gauss σ≈4: 11 taps por pase a ¼ de píxeles) + 2 | Sí | Bueno. Puede haber halo leve: un primer plano nítido "sangra" sobre un fondo borroso. | **Sí. Opción recomendada para mobile.** |
| C. DoF gather con bokeh, campos near/far separados | TSL `dof()` (`DepthOfFieldNode`): CoC full-res (MRT R16F ×2), blur del CoC near, blur64 + blur16 para near y far a ½ res, composite full-res | 7 pases | ~45 (2×64/4 + 2×16/4 + CoC + composite) | Sí | Muy bueno. Kernel de disco (Vogel), sin sangrado near/far. | Justo. Usarlo como nivel "alto" o con `bokehScale` bajo. |
| C'. DoF pmndrs | `DepthOfFieldEffect` (focusDistance, focusRange, bokehScale, `resolutionScale` 0.5): CoC + Kawase sobre el CoC + máscara + 4 pases bokeh (far, CoC y máscara a full-res) | ~7-8 pases, varios full-res | Alto (bokeh far a full-res) | Sí. El CoC detecta ortográfica vía el define `PERSPECTIVE_CAMERA`. | Muy bueno | Caro. Bajar `resolutionScale`. |
| D. BokehPass clásico | `BokehPass` + `BokehShader` (WebGL) | **Re-renderiza la escena** con `MeshDepthMaterial` + 1 pase de 41 taps full-res | 41 + un segundo render de la escena | Sí | Bueno | **No.** Duplica los draw calls con ~10k tiles. Si se usa WebGL, conviene leer un `depthTexture` del render principal. |
| E. Blur "hash" de un solo pase | TSL `hashBlur(tex, amount, {repeats})` (default 45 repeticiones) | 1 pase | 45 por defecto | Lo modula el CoC | Ruidoso con pocas repeticiones | Solo con repeats bajos y TAA |

Notas:
- El costo de B y C escala con la resolución. En mobile conviene renderizar a DPR ≤ 1.5 o 1.0 y aplicar el blur sobre esa resolución. El blur esconde bastante la pérdida de resolución en las zonas desenfocadas.
- Color grading, viñeta y saturación no suman pases. En pmndrs se fusionan dentro de un `EffectPass`. En TSL son operaciones aritméticas dentro del nodo de salida. Costo ≈ 0 taps.

## 3. Cámara: ortográfica vs perspectiva con FOV bajo

| | Ortográfica | Perspectiva FOV bajo (20-30°) |
|---|---|---|
| Profundidad usable para el CoC | Sí. Con la cámara inclinada, `viewZ` varía linealmente de abajo hacia arriba en la pantalla. | Sí, con más rango |
| Señal de escala | Sin convergencia. Equivale a mirar desde distancia infinita, lo que según el modelo de Held se lee como "lejos y grande" y contradice el blur. | Leve convergencia, coherente con "cámara cerca de algo chico" |
| Look de juego isométrico | Exacto (tiles del mismo tamaño en todo el mapa) | Casi isométrico. Las líneas paralelas convergen un poco. |
| Picking y cálculo de la grilla | Más simple | Necesita raycast o desproyección con perspectiva. Sigue siendo analítico contra el plano del suelo. |
| Zoom | Cambia la escala de proyección. El CoC en mundo no cambia solo. | Dolly o cambio de FOV. Hay que ajustar el foco y el rango al zoom. |

La recomendación sale de inferir a partir de Held et al. (no lo testearon con cámaras de juego): **perspectiva con FOV de unos 25° desde una cámara alta**, con `focusDistance` = distancia al target y `focusRange` proporcional a esa distancia. Así el foco y la "apertura" se mantienen coherentes cuando hacés zoom. Las fotos de miniaturas reales se sacan desde cerca y tienen perspectiva visible. Si el gameplay pide isometría exacta, la ortográfica también sirve con DoF por profundidad, aunque transmite algo menos de escala.

## 4. Implementaciones disponibles y detalles por renderer

### Ruta WebGPU (`WebGPURenderer` + TSL, `three/webgpu`)
- `dof(color, viewZ, focusDistance, focalLength, bokehScale)` en `three/addons/tsl/display/DepthOfFieldNode.js`. El CoC es `smoothstep(0, focalLength, |−viewZ − focusDistance|)`, separado en near y far. Los blurs corren a media resolución en RTs HalfFloat. Ejemplo oficial: `webgpu_postprocessing_dof`.
- La versión barata está en el ejemplo oficial `webgpu_postprocessing_dof_basic`: `boxBlur` + `mix(scenePassColor, blurred, smoothstep(minDistance, maxDistance, |viewZ − focusViewZ|))`. Reemplazar `boxBlur` por `gaussianBlur(color, 1, sigma, { resolutionScale: 0.5 })` lo hace más barato.
- Color: `saturation`, `vibrance`, `hue`, `cdl` (slope/offset/power/saturation) en `three/tsl` (`src/nodes/display/ColorAdjustment.js`). Viñeta: `vignette(color, intensity, smoothness)` en `three/addons/tsl/display/CRT.js`. LUT: `Lut3DNode`.
- **Detalle con la cámara ortográfica:** en r187, `PassNode.getViewZNode()` siempre usa `perspectiveDepthToViewZ` (hay un `TODO` en el código fuente). Con `OrthographicCamera` hay que calcular `orthographicDepthToViewZ(scenePass.getTextureNode('depth'), near, far)` a mano. Con perspectiva funciona tal cual.
- `WebGPURenderer` cae a un backend WebGL2 si no hay WebGPU, así que la misma cadena TSL cubre los dos casos.

### Ruta WebGL (`WebGLRenderer`)
- **pmndrs/postprocessing 6.39.6** (peer `three >=0.168.0 <0.188.0`): `EffectComposer` + `RenderPass` + un único `EffectPass(camera, dof, vignette, hueSat, brightnessContrast)`. Según el README, el `EffectPass` *"automatically organizes and merges any given combination of effects"*. El README solo cubre `WebGLRenderer`. No hay soporte para WebGPU documentado.
  - `TiltShiftEffect`: banda de pantalla rotable con Kawase (`TiltShiftBlurPass extends KawaseBlurPass`) a `resolutionScale` 0.5. Presets de Kawase: entre 1 y 10 iteraciones según `KernelSize`.
  - `DepthOfFieldEffect`: CoC (soporta ortográfica), Kawase sobre el CoC para el campo cercano y bokeh en 4 pases. Los buffers far, CoC y máscara quedan a resolución completa para evitar sangrado, y eso lo encarece en mobile.
- **Addons de three** (sin dependencias): `HorizontalTiltShiftShader`/`VerticalTiltShiftShader` (*"Simple fake tilt-shift effect"*, 9 taps por pase), `HueSaturationShader`, `BrightnessContrastShader`, `VignetteShader`. `BokehPass` re-renderiza la escena para obtener la profundidad, así que no conviene con 10k tiles.

## 5. Recomendación

1. **Técnica:** DoF por profundidad, con foco atado al target de la cámara y CoC normalizado en unidades de mundo. Tres niveles:
   - **Mobile (default):** nivel B. CoC desde `viewZ`, un único blur gaussiano separable a ½ resolución (o ¼ si hace falta) y `mix` por CoC. Grading, viñeta y saturación van en el mismo nodo de salida. Objetivo: ≤ 10 taps/px equivalentes.
   - **Desktop:** nivel C (`dof()` de TSL, o `DepthOfFieldEffect` si se queda en WebGL), con bokeh de disco.
   - **Fallback mínimo:** banda de pantalla (A'), solo si el depth buffer no está disponible o el presupuesto es crítico.
2. **Cámara:** perspectiva con FOV de unos 25° y elevación alta. El rango de foco escala con la distancia de la cámara. La ortográfica queda como alternativa aceptable si la decisión de gameplay la exige (ticket 0008).
3. **Look:** saturación +10-25%, contraste levemente alto (con `cdl` o LUT), viñeta suave (~0.2-0.3), sol duro con sombras definidas y AO de contacto. Estos valores son un punto de partida y hay que ajustarlos a ojo.
4. **Elección de renderer (ticket 0002):** las dos rutas tienen todo lo necesario. TSL tiene la ventaja de componer todo en nodos y correr en WebGPU con fallback a WebGL2. pmndrs es más maduro en WebGL pero no corre en `WebGPURenderer`.

## Preguntas abiertas
- Costo real en un dispositivo de gama media (por ejemplo un Adreno 6xx o un Mali-G7x) de los niveles B y C a DPR 1.0 y 1.5. Va al ticket de presupuesto de performance.
- Si TAA/TRAA (necesario para otras cosas) permite usar `hashBlur` con pocas repeticiones como alternativa más barata.

## Fuentes
- Held, Cooper, O'Brien, Banks (2010), *Using Blur to Affect Perceived Distance and Size*, ACM TOG: https://pmc.ncbi.nlm.nih.gov/articles/PMC3088122
- Meese, Baker, Summers (2012), *Fake Tilt-Shift Miniaturisation Causes Negative D-Prime for Detecting Reality*, i-Perception: https://journals.sagepub.com/doi/abs/10.1068/id223
- three.js r187 (fuente local `game/node_modules/three`): `examples/jsm/tsl/display/DepthOfFieldNode.js`, `GaussianBlurNode.js`, `boxBlur.js`, `hashBlur.js`, `CRT.js` (vignette); `src/nodes/display/PassNode.js` (`getViewZNode`), `ViewportDepthNode.js`, `ColorAdjustment.js`; `examples/jsm/postprocessing/BokehPass.js`; `examples/jsm/shaders/BokehShader.js`, `HorizontalTiltShiftShader.js`, `VerticalTiltShiftShader.js`
- Ejemplos oficiales: https://threejs.org/examples/#webgpu_postprocessing_dof · https://threejs.org/examples/#webgpu_postprocessing_dof_basic · https://threejs.org/examples/#webgl_postprocessing_dof
- pmndrs/postprocessing: https://github.com/pmndrs/postprocessing · [TiltShiftEffect.js](https://github.com/pmndrs/postprocessing/blob/main/src/effects/TiltShiftEffect.js) · [DepthOfFieldEffect.js](https://github.com/pmndrs/postprocessing/blob/main/src/effects/DepthOfFieldEffect.js) · [CircleOfConfusionMaterial.js](https://github.com/pmndrs/postprocessing/blob/main/src/materials/CircleOfConfusionMaterial.js) · [KawaseBlurMaterial.js](https://github.com/pmndrs/postprocessing/blob/main/src/materials/KawaseBlurMaterial.js) · [package.json](https://github.com/pmndrs/postprocessing/blob/main/package.json)
- Referencias citadas por el `DepthOfFieldNode` de three: https://pixelmischiefblog.wordpress.com/2016/11/25/bokeh-depth-of-field/ · https://www.adriancourreges.com/blog/2016/09/09/doom-2016-graphics-study/
