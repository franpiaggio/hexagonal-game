# 02 · Atlas patagónico

Generador web de pequeños paisajes animados. Mantiene la dirección de las miniaturas aprobadas: verano patagónico, naturaleza dominante, caseríos pequeños, agua extensa y cámara elevada. Vive en una subcarpeta independiente; las demos 00 y 01 conservan su implementación.

## Ejecutar

Desde la raíz del proyecto:

```bash
cd game
pnpm install --frozen-lockfile
pnpm dev
```

Abrir `/demos/02-atlas-patagonico/` en la dirección que muestre Vite. También aparece como primera opción en el índice. Los assets necesarios ya están incluidos; **Blender no es necesario para abrir la web**. Requiere un navegador con WebGL 2.

```bash
pnpm test:atlas
pnpm build
pnpm preview
```

La compilación genera un sitio estático en `game/dist/`, sin backend, API, cuenta ni conexión al MCP. Servir por HTTP; `file://` no permite cargar correctamente los módulos y workers. Vite usa rutas relativas para permitir un despliegue en una subruta.

## Interfaz mínima

El paisaje ocupa toda la pantalla. Solo hay un botón circular, sin texto visible, para generar otro mapa. El tilt-shift queda activo y la calidad se ajusta automáticamente. No hay encabezados, contadores, selectores ni paneles sobre la escena.

| Acción | Resultado |
| --- | --- |
| Botón circular / N | Genera otra semilla y elige entre las seis familias. |
| Arrastrar / flechas | Rota la cámara horizontal y verticalmente. |
| Rueda, pellizco, + y − | Acerca o aleja con límites de encuadre. |
| 0 | Regresa suavemente a la vista inicial. |
| R | Repite el suave cambio de foco del paisaje actual. |

El mismo botón indica carga mediante el icono y permite reintentar si falla el motor. Su nombre accesible y los anuncios de estado quedan disponibles para lectores de pantalla sin texto visible. Los atajos funcionan con el paisaje enfocado. La preferencia del sistema de movimiento reducido elimina el fundido, las transiciones de cámara y el movimiento del agua.

## Familias y semillas

| Valor en URL | Paisaje |
| --- | --- |
| `bahia` | Costa de lago amplio, bosque y caserío rural. |
| `rio` | Río sinuoso, puente y pueblo sobre una margen. |
| `bosque` | Refugio de cinco construcciones entre árboles, con arroyo lateral. |
| `peninsula` | Lengua de tierra con agua a ambos lados y camino longitudinal. |
| `confluencia` | Encuentro de dos cursos de agua. |
| `ladera` | Costa con terreno que asciende hacia el interior. |
| `sorpresa` | La semilla elige una de las seis familias. |

Ejemplo reproducible: `/demos/02-atlas-patagonico/?seed=73020&paisaje=bahia`. La dirección se actualiza al generar. Guardarla permite regresar al mismo mapa con **esta versión del generador**. La familia indicada en la URL se usa al abrir el mapa; cada pulsación del botón vuelve a elegir una familia mediante la nueva semilla. El encuadre no se guarda en la URL. Una revisión futura del algoritmo puede cambiar el resultado de una semilla.

## Archivos y recorrido de datos

```text
landscape.ts → terrain.worker.ts → main.ts → world.ts → post.ts
      plan + terreno                 escena    GPU       imagen
```

| Archivo | Responsabilidad |
| --- | --- |
| [index.html](index.html), [style.css](style.css) | Canvas, único botón, estados accesibles y adaptación móvil. |
| [main.ts](main.ts) | Cámara, gestos, cambios de mapa, animación y calidad automática. |
| [lighting.ts](lighting.ts) | Sol, luz ambiente y reflejos de un cielo calculado una sola vez. |
| [landscape.ts](landscape.ts) | Semillas, costa, ríos, relieve, caminos, distribución y colores del suelo. Funciones sin dependencia de Three.js. |
| [terrain.worker.ts](terrain.worker.ts) | Calcula la geografía fuera del hilo de la interfaz y transfiere sus buffers. |
| [world.ts](world.ts) | Carga la biblioteca GLB, crea instancias por sectores y materiales de suelo/agua. |
| [post.ts](post.ts) | Tilt-shift, captura de la vista saliente, fundido óptico y salida de color. |
| [atlas.glb](../../public/assets/atlas/atlas.glb) | Biblioteca compartida, aproximadamente **1,07 MB**: dos coníferas, una lenga, seis edificios y cuatro materiales de suelo con mapas de color y normales. |
| [asset-manifest.json](../../public/assets/atlas/asset-manifest.json) | Procedencia y geometría de cada pieza. |
| [fonts](../../public/assets/atlas/fonts/) | Fuentes de la interfaz anterior, conservadas con licencias OFL; la interfaz mínima no las carga. |
| [atlas-generator.test.ts](../../scripts/atlas-generator.test.ts) | UV de las piezas texturizadas, determinismo, caseríos, ubicaciones y validez de terreno. |

## Optimización aplicada

- Una sola descarga GLB, Meshopt y texturas WebP embebidas de hasta 512 px. No se cargan las escenas grandes de Cycles.
- Coníferas de **5.435 y 5.523 triángulos**, derivadas de los árboles de la referencia de Blender conservando ramas completas y sus UV. Lenga de **916**, con ramas texturizadas recortadas por alfa; los edificios van de 1.066 a 9.272 triángulos.
- Instancias agrupadas en sectores de 24 unidades, para descartar sectores fuera de cámara. Las zonas lejanas usan menor densidad de árboles.
- Transformaciones de instancias calculadas al crear el mapa, siempre a escala completa. El cambio de paisaje usa una captura de la vista saliente y un fundido de 1,35 s con desenfoque breve y curva quíntica; solo se renderiza un mundo 3D. La entrada inicial dura 0,85 s. El ángulo y la distancia de cámara se conservan entre mapas.
- Suelo de 240 × 240 segmentos generado en worker. Lomas y pliegues reales, plataformas horizontales bajo las casas y orillas continuas. Colores por vértice y máscaras mezclan pasto, hojarasca, ripio y arena, con mapas escaneados de color y normales incluidos en el GLB. Pequeños grupos de pasto instanciados añaden volumen a corta distancia, sin transparencias ni animación.
- Cielo y reflejos precalculados con PMREM al iniciar; no se recalculan por cuadro ni se descarga un HDRI.
- Sombras de 2.048 px calculadas al reemplazar el mapa y conservadas después; el fundido no obliga a recalcularlas.
- Dos pasadas de desenfoque, 11 lecturas bilineales por pasada; antialiasing MSAA de dos muestras.
- Resolución adaptativa automática, con tope de 1,65 millones de píxeles. Hay un mínimo de escala 0,65; los topes pueden superarse en pantallas extraordinariamente grandes.
- La animación se detiene cuando la pestaña queda oculta. Geometrías, materiales y buffers del mapa anterior se liberan al reemplazarlo; la biblioteca y sus texturas se reutilizan.
- Sin descarga de tipografías ni servicios externos durante el uso.

El rendimiento depende de GPU, navegador, resolución, cantidad visible de bosque y estado de la animación. Las mediciones y el alcance de las pruebas están en [VERIFICACION.md](VERIFICACION.md).

## Regenerar los modelos web

Este paso solo es necesario al cambiar los modelos. Desde `game/`:

```bash
pnpm assets:atlas
```

En otro sistema, indicar la ruta de Blender:

```bash
BLENDER_BIN=/ruta/a/blender pnpm assets:atlas
```

El [script de exportación](../../scripts/export-atlas-assets.py) ejecuta Blender en segundo plano y lee las fuentes existentes. Requiere Blender con exportador glTF y los siguientes recursos del proyecto:

- `models/estudios/patagonia_cycles_detallado.blend`.
- `models/source/build_dense_panorama.py`, `dense_panorama_specs.py` y `build_cycles_detail.py`, para la arquitectura.
- `models/source/build_miniatura.py` y `base_geometry.py`, para la lenga y el exportador con colores por vértice.
- `models/source/cycles_assets/fir_tree_01/`, incluido su `.blend` y texturas: las dos coníferas web se derivan de las variantes `c_LOD2` y `b_LOD2`.
- `models/textures/cycles_detail/`: mapas `color` y `normal` de `grass_ground`, `forest_ground_04`, `gravel_road` y `gravelly_sand`, para el terreno.
- Los PNG de `models/textures/`: suelo, madera, piedra, agua, conífera y lenga, con los mapas normales que usa el kit.

Los materiales procedurales de arquitectura se convierten en colores por vértice. El archivo intermedio queda en `game/.cache/atlas/`; el script aplica `dequantize` antes de Meshopt para conservar los colores exportados por Blender y escribe el GLB final en `game/public/assets/atlas/`. No guarda cambios en los `.blend` originales ni modifica la colección aprobada.

La exportación promueve el atributo genérico `UVMap` de los árboles a una capa UV de Blender. Es necesario para que glTF conserve las coordenadas de las hojas; una prueba comprueba que ninguna pieza texturizada pierda `TEXCOORD_0`. El empaquetado actual de color y alfa de las coníferas produce RGB lineal: `world.ts` marca esa textura como `LinearSRGBColorSpace` para evitar oscurecerla dos veces. Revisar esta corrección si cambia el exportador o se reemplaza la textura. Árboles y suelo escaneado proceden de Poly Haven bajo CC0; las URLs están en el manifiesto.

## Alcance visual

Es una adaptación interactiva de la dirección artística, con geografía continua y sin bordes de fichas visibles. No implementa colocación de hexágonos, reglas del juego, edición manual ni exportación del mapa generado.

El desenfoque activo es una **aproximación de tilt-shift en pantalla**, centrada sobre el caserío. No simula una lente inclinada ni calcula desenfoque físico por profundidad. El agua usa color de profundidad y normales animadas, sin refracción volumétrica. Los materiales, vegetación e iluminación de Cycles siguen siendo la referencia de mayor detalle; esta versión prioriza poder generar y recorrer paisajes en tiempo real.
