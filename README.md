# Hexagonal Game · Patagonia en miniatura

Exploración de un paisaje modular patagónico / alpino para Three.js, desarrollada desde un kit de piezas hexagonales hasta una colección de miniaturas renderizadas en Blender Cycles.

El resultado visual aprobado es **Patagonia · diez mundos pequeños**: diez composiciones de verano, con lagos amplios, ríos, bosques detallados y caseríos de 5 a 12 construcciones. La cámara elevada y la profundidad de campo producen la sensación de una maqueta fotografiada.

![Puerto de las Lengas, colección final](models/previews/coleccion_ondas_10/01_puerto_lengas.png)

## Abrir el resultado

| Quiero… | Archivo |
| --- | --- |
| Seguir el video de las cinco escenas elegidas: producción nativa y controles temporales | [Bosques en movimiento · estado, archivos y reproducción](models/video/bosques_en_movimiento/README.md) |
| Comparar veinte paisajes con bosques densos, claros y lagos | [Bosques y aguas · galería](models/previews/bosques_y_aguas_20/galeria.html) · [Escenas y reproducción](models/previews/bosques_y_aguas_20/README.md) |
| Ver lenga postrada, coihues gigantes y cipreses entre rocas | [Portes y hábitat · tres renders](models/previews/portes_y_habitat_03/galeria.html) · [Escenas y reproducción](models/previews/portes_y_habitat_03/README.md) |
| Recorrer todas las pruebas de concepto, incluidas revisiones y borradores | [Histórico de imágenes](pruebas_de_concepto/index.html) · [Cómo se actualiza](pruebas_de_concepto/README.md) |
| Ver las escenas con vegetación patagónica y la biblioteca de nueve árboles | [Vegetación patagónica · Blender](models/vegetacion_patagonica/README.md) |
| Comparar las hojas y copas revisadas de arrayán y coihue | [Antes y después](models/vegetacion_patagonica/revision_follaje_03/previews/comparacion_copas.png) · [Maestros y escena](models/vegetacion_patagonica/revision_follaje_03/README.md) |
| Ver los nuevos ñires, arrayanes y colihues | [Ciclo 2 · nueve variantes](models/vegetacion_patagonica/ciclo_02/README.md) |
| Revisar el diagnóstico de piedras y suelo, pruebas y próximos ajustes | [Investigación de superficies](docs/investigacion-superficies/README.md) |
| Comparar la primera revisión de piedras y suelo con el render anterior | [Ladera · antes y después](models/superficies_patagonicas/01_ladera/comparacion.html) · [Proyecto y reproducción](models/superficies_patagonicas/01_ladera/README.md) |
| Ver el ajuste intermedio con menos trama y cobertura de pasto | [Suelo equilibrado · v02](models/superficies_patagonicas/02_suelo_equilibrado/README.md) |
| Generar y recorrer mapas animados en la web | [Atlas patagónico · demo 02](game/demos/02-atlas-patagonico/README.md) |
| Ver pueblos con iglesias, caminos y suelo natural | [Cuatro miniaturas · revisión del terreno](models/casas_5/iteraciones_pueblos/suelo_natural/README.md) |
| Importar cinco tipos de casas en otro proyecto | [Casas exportables · GLB y Blender](models/casas_5/README.md) |
| Recorrer las diez imágenes | [Galería](models/previews/coleccion_ondas_10/galeria.html) |
| Compararlas juntas | [Vista conjunta](models/previews/coleccion_ondas_10/coleccion_completa.jpg) |
| Llevarme imágenes y escenas editables | [ZIP completo · aproximadamente 352 MB](models/previews/patagonia_coleccion_ondas_10.zip) |
| Editar las diez escenas en Blender | [Colección editable](models/estudios/patagonia_coleccion_ondas_10.blend) |
| Ver la referencia elegida durante el proceso | [estudio_ondas.png](models/previews/pueblo_lago/estudio_ondas.png) |
| Ver la presentación animada corregida | [Video de 12 segundos](models/video/pueblo_miniatura/ver_video.html) |

Las galerías se abren directamente en un navegador. En Blender, abrir el archivo, elegir una escena `01_…` a `10_…` y pulsar **F12**. La vista sólida del editor no muestra el desenfoque final.

## Documentación del recorrido

Leer en este orden para retomar el proyecto sin depender del chat:

1. [Evolución y decisiones](docs/01-evolucion-y-decisiones.md): objetivo original, pasos logrados, correcciones y criterio aprobado.
2. [Resultado final](docs/02-resultado-final.md): las diez variantes, parámetros visuales y verificaciones.
3. [Archivos y dependencias](docs/03-archivos-y-dependencias.md): qué conservar, qué usa cada generador y qué contiene cada entrega.
4. [Reproducir la colección](docs/04-reproducir-coleccion.md): entorno, render desde el editable, reconstrucción, revisión y empaquetado.
5. [Reproducir etapas anteriores y video](docs/05-historico-y-video.md): kit, estudios, panoramas y presentación animada.
6. [Relación con Three.js](docs/06-threejs.md): lo que ya existe en la web y lo que falta para trasladar el acabado de Cycles.
7. [Cinco casas exportables](docs/07-casas-exportables.md): variantes individuales, escala, materiales y reproducción del kit.

## Organización

```text
hexagonal-game/
├── README.md                 Entrada a esta documentación
├── docs/                     Recorrido, resultado y reproducción
├── models/
│   ├── casas_5/              Cinco casas independientes: GLB, Blender, previews y generadores
│   ├── vegetacion_patagonica/ Nueve árboles, biblioteca conjunta y dos escenas de vegetación nativa
│   ├── glb/                  Siete piezas del kit y un paisaje de demostración
│   ├── estudios/             Escenas de Blender, históricas y final
│   ├── previews/             PNG, galerías, manifiestos y ZIP
│   ├── source/               Generadores, renderizadores y recursos de vegetación
│   ├── textures/             Texturas del kit, superficies escaneadas y cielo
│   └── video/                Animaciones, cuadros, audio y paquetes
└── game/                     Demos web con Three.js, TypeScript y Vite
```

La colección final es una entrega de **render y dirección visual**. El kit GLB y las demos web son entregables relacionados; todavía no reproducen automáticamente los materiales volumétricos, la vegetación y la óptica del resultado final de Cycles.

Para iniciar las demos existentes:

```bash
cd game
pnpm install --frozen-lockfile
pnpm dev
```

Detalles de las demos en [DEMOS.md](DEMOS.md) y vocabulario del juego en [GLOSSARY.md](GLOSSARY.md).

La documentación de la colección original corresponde al **3 de noviembre de 2026**. El **4 de noviembre** se añadieron los pueblos con iglesias y su revisión de suelo natural; cada entrega tiene sus escenas, renders e instrucciones de reproducción en su carpeta.

El primer ciclo de vegetación patagónica se completó exclusivamente en Blender: nueve árboles exportables, biblioteca conjunta y dos escenas con cuatro renders finales. Su [registro de seis pasos](models/vegetacion_patagonica/PROGRESO.md) conserva el cierre. El [ciclo 2](models/vegetacion_patagonica/ciclo_02/README.md) suma nueve variantes de ñire, arrayán y colihue, con retratos identificados, biblioteca a escala común, GLB individuales verificados y una escena de bahía con 44 instancias nuevas. La [lámina de dirección](models/vegetacion_patagonica/ciclo_02/previews/nueve_variantes.png) permite pedir ajustes por código; el [registro activo](models/vegetacion_patagonica/ciclo_02/PROGRESO.md) mantiene los seis pasos.
