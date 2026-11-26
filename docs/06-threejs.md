# 06 · Relación con Three.js

[Inicio](../README.md) · [← Histórico y video](05-historico-y-video.md)

## Estado actual

El proyecto tiene dos entregas que se complementan: un **kit modular para tiempo real** y unas **escenas detalladas de Blender para explorar el acabado final**. La colección de diez renders establece la dirección visual aprobada. La demo web existente usa el kit y sus propios materiales y efectos; aún no reproduce esa colección con fidelidad equivalente.

| Elemento | Ya disponible | Relación con el resultado final |
| --- | --- | --- |
| Piezas modulares | Siete GLB y paisaje de demostración en `models/glb/`. | Base de geometría y conexiones para el juego. |
| Demos web | Vite, TypeScript y Three.js en `game/`. | Generación procedural y presentación interactiva. |
| Colección final | Diez escenas en Blender, PNG y galería. | Referencia visual de agua, proporciones, composición y enfoque. |
| Materiales de agua Cycles | Refracción y absorción volumétrica en el `.blend`. | Requieren una solución de agua propia para tiempo real. |
| Desenfoque final | Cámara y profundidad de campo en Blender. | Debe ajustarse con el posprocesado de la web. |
| Vegetación detallada | Bibliotecas y geometría compartida entre instancias. | Requiere selección de LOD, presupuesto y materiales adecuados al navegador. |

## Ejecutar la demo existente

### Nueva demo 02: Atlas patagónico

La [demo independiente Atlas patagónico](../game/demos/02-atlas-patagonico/README.md) adapta la dirección aprobada a un generador continuo: seis familias de paisajes, caseríos pequeños, vegetación texturizada, cámara orbital, fundido entre paisajes completos, semillas en URL y efecto miniatura. Se abre desde el índice de Vite o en `/demos/02-atlas-patagonico/`.

Usa una biblioteca web propia de aproximadamente 1,07 MB, coníferas derivadas de los árboles de Blender, suelo con mapas escaneados, instancias por sectores, cálculo de terreno en worker, sombras conservadas y resolución adaptativa. El desenfoque es una aproximación en pantalla y los materiales se simplificaron para tiempo real. No sustituye el render de Cycles ni incorpora las reglas de colocación hexagonal. Su README detalla archivos, regeneración de assets y límites; [VERIFICACION.md](../game/demos/02-atlas-patagonico/VERIFICACION.md) registra las pruebas.

### Arranque común

```bash
cd game
pnpm install --frozen-lockfile
pnpm dev
```

Abrir la URL que indique Vite y elegir la demo Patagonia. Para compilar:

```bash
pnpm build
pnpm preview
```

El entorno local observado usa Node 22.23.1 y pnpm 10.27.0. El proyecto declara Three.js `^0.187.0`, Vite `^8.3.5` y TypeScript `~7.0.2`; `game/pnpm-lock.yaml` conserva la resolución de dependencias. Estas instrucciones describen el código local; no implican una nueva medición de rendimiento de la demo durante la documentación.

La [documentación de la demo](../game/demos/01-patagonia-generador/README.md) detalla controles, variantes, terreno, materiales, climas y animación. [DEMOS.md](../DEMOS.md) organiza las etapas del prototipo web y [GLOSSARY.md](../GLOSSARY.md) define Celda, Mapa, Terreno y Prop.

## Kit hexagonal y coordenadas

Fuente: [models/manifest.json](../models/manifest.json) y [threejs-example.mjs](../models/threejs-example.mjs).

| Propiedad del kit | Valor |
| --- | --- |
| Orientación | Pointy-top. |
| Radio | 2 unidades de grilla. |
| Apotema | √3 ≈ 1.73205. |
| Base | Suelo en Y = 0; espesor 0.12 hacia abajo. |
| Eje vertical glTF | Y. |
| Posición axial | `[sqrt(3) * R * (q + r / 2), 0, -1.5 * R * r]`. |
| Rotación | `rotation.y = rotationSteps * PI / 3`. |
| Agua por borde | Índices `waterEdges` por pieza, ajustados por la rotación. |
| Escala representada | 20 m por unidad de diseño; independiente de la escala óptica usada al fotografiar la miniatura en Blender. |

Las piezas `rio_recto`, `rio_curvo` y `laguna` tienen conectores de agua. Pradera, bosque, caserío y montaña no. El ejemplo conserva materiales, colores por vértice y geometría compartidos entre clones.

## Optimizar el kit para la demo

Desde `game/`:

```bash
pnpm assets:patagonia
```

El [script actual](../game/scripts/build-patagonia-assets.sh) toma **pradera, bosque, caserío y montaña** desde `models/glb/`, aplica dequantize y luego compresión Meshopt / WebP, con un límite de textura de **1024 px**, y copia el manifiesto a `game/public/assets/patagonia/`.

El paso de dequantize se incorporó porque la recuantización de los colores `COLOR_0` normalizados del export de Blender podía convertirlos en blanco. El script preserva las partes separadas para que la demo pueda reemplazar materiales.

La demo construye agua y terreno con su propio código; ese script no copia los GLB de río o laguna. El manifiesto copiado sigue enumerando el kit completo, por lo que no se debe asumir que todos sus archivos están presentes en la carpeta optimizada. Para usar `threejs-example.mjs` sin cambios, servir el kit completo con su estructura `manifest.json` + `glb/`.

El README histórico de la demo menciona 512 px y un peso medido en una versión anterior. Para regenerar assets, prevalecen las opciones del script actual y el tamaño real de los archivos resultantes.

## Qué trasladar del resultado aprobado

1. **Composición:** naturaleza dominante, casas separadas en grupos pequeños, caminos rurales y agua extensa. Las diez especificaciones de Blender son referencias de distribución, no mapas ya conectados al generador web.
2. **Proporción:** conservar la relación entre altura de árboles, tamaño de casas, ancho de accesos y costa. Evitar agrandar edificios para llenar un encuadre más lejano.
3. **Cámara:** partir de una perspectiva comprimida y elevación próxima a 43–44°. Calibrar el campo de visión y el foco en las unidades de la web.
4. **Profundidad de campo:** mantener legible el centro de interés y desenfocar primer plano y fondo. La demo ya contiene un efecto de profundidad; debe ajustarse contra los PNG aprobados.
5. **Agua:** recrear profundidad aparente, transición de orilla, reflejo de cielo y ondas finas. Los nodos volumétricos de Cycles no se convierten directamente en un shader equivalente al exportar GLB.
6. **Vegetación y suelo:** seleccionar LOD e instancias para conservar siluetas naturales, variación de follaje y lectura de superficies sin trasladar toda la geometría de render al navegador.

La demo 02 ya adapta composición, proporciones, cámara, desenfoque y vegetación con soluciones propias para tiempo real. Sigue pendiente la equivalencia de acabado con Cycles; la colección no se ha convertido automáticamente a Three.js. El PNG incluye el resultado de la luz y el desenfoque; un GLB individual no contiene ese efecto de cámara aplicado a la imagen.

## Referencias de implementación existentes

- [main.ts](../game/demos/01-patagonia-generador/main.ts): escena, cámara, render y posprocesado.
- [generator.ts](../game/demos/01-patagonia-generador/generator.ts): distribución procedural de mapas.
- [terrain.ts](../game/demos/01-patagonia-generador/terrain.ts): terreno y agua continuos.
- [materials.ts](../game/demos/01-patagonia-generador/materials.ts): materiales y efectos propios de la demo.
- [tiles.ts](../game/demos/01-patagonia-generador/tiles.ts): carga y reutilización de piezas.
- [ondas_collection_specs.py](../models/source/ondas_collection_specs.py): distribuciones aprobadas de la exploración en Blender.
