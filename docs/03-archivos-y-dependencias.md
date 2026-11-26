# 03 · Archivos y dependencias

[Inicio](../README.md) · [← Resultado](02-resultado-final.md) · [Reproducir →](04-reproducir-coleccion.md)

## Qué conservar según la tarea

| Necesidad | Conservar |
| --- | --- |
| Ver, compartir o volver a renderizar el resultado final | [ZIP completo](../models/previews/patagonia_coleccion_ondas_10.zip). Incluye `escenas.blend` con sus texturas empaquetadas. |
| Ejecutar el renderizador y empaquetador del proyecto | El `.blend` final, `models/source/`, `previews/coleccion_ondas_10/`, la imagen y selección de `pueblo_lago/`, y sus créditos. |
| Generar nuevas distribuciones con la biblioteca existente | Lo anterior, `patagonia_cycles_detallado.blend`, recursos de coníferas y el HDR de cielo. Mantener `source/` y `textures/` completos evita omitir dependencias. |
| Reconstruir también la biblioteca detallada | Todos los scripts, texturas del kit, texturas escaneadas y `source/cycles_assets/` completos. |
| Reproducir las etapas históricas y los videos | Todo `models/`; los cuadros existentes permiten recomponer un video sin volver a renderizar. |
| Trabajar en la web | `game/`, su lockfile y los GLB de `models/`; sumar la documentación y referencias para guiar el acabado. |

Un clon de Git no sustituye la copia de los recursos si los archivos grandes todavía no fueron incorporados al repositorio. Esta documentación no crea commits ni sube archivos: comprobar que los `.blend`, texturas y entregables viajan con el respaldo.

## Entregables por etapa

Todas las rutas de esta tabla parten de `models/`.

| Etapa | Vista o carpeta de resultados | Editable | Paquete |
| --- | --- | --- | --- |
| Kit modular | [glb/](../models/glb/) y [manifest.json](../models/manifest.json) | [patagonia_miniatura.blend](../models/patagonia_miniatura.blend) | Carpeta del kit |
| Primeros diez estudios | [serie_10/galeria.html](../models/previews/serie_10/galeria.html) | [patagonia_10_variantes.blend](../models/estudios/patagonia_10_variantes.blend) | [patagonia_10_estudios.zip](../models/previews/patagonia_10_estudios.zip) |
| Detalle Cycles · tres vistas | [cycles_detallado/galeria.html](../models/previews/cycles_detallado/galeria.html) | [patagonia_cycles_detallado.blend](../models/estudios/patagonia_cycles_detallado.blend) | [patagonia_cycles_detallado.zip](../models/previews/patagonia_cycles_detallado.zip) |
| Tres vistas sin bordes | [cycles_sin_bordes/galeria.html](../models/previews/cycles_sin_bordes/galeria.html) | [patagonia_cycles_sin_bordes.blend](../models/estudios/patagonia_cycles_sin_bordes.blend) | [patagonia_cycles_sin_bordes.zip](../models/previews/patagonia_cycles_sin_bordes.zip) |
| Diez panoramas densos | [cycles_panoramas_10/galeria.html](../models/previews/cycles_panoramas_10/galeria.html) | [patagonia_panoramas_densos_10.blend](../models/estudios/patagonia_panoramas_densos_10.blend) | [patagonia_panoramas_densos_10.zip](../models/previews/patagonia_panoramas_densos_10.zip) |
| Pueblo pequeño | [pueblo_miniatura/puerto_del_bosque.png](../models/previews/pueblo_miniatura/puerto_del_bosque.png) | [patagonia_pueblo_miniatura.blend](../models/estudios/patagonia_pueblo_miniatura.blend) | Incluido con el video corregido |
| Revisión de lago | [pueblo_lago/](../models/previews/pueblo_lago/) | [patagonia_pueblo_lago.blend](../models/estudios/patagonia_pueblo_lago.blend) | Carpeta de resultados |
| Referencia elegida | [estudio_ondas.png](../models/previews/pueblo_lago/estudio_ondas.png) | [patagonia_pueblo_lago_elegido.blend](../models/estudios/patagonia_pueblo_lago_elegido.blend) | Referencia incluida en el ZIP final |
| Colección final · diez escenas | [coleccion_ondas_10/galeria.html](../models/previews/coleccion_ondas_10/galeria.html) | [patagonia_coleccion_ondas_10.blend](../models/estudios/patagonia_coleccion_ondas_10.blend) | [patagonia_coleccion_ondas_10.zip](../models/previews/patagonia_coleccion_ondas_10.zip) |
| Video inicial · 62 edificios | [patagonia_reveal/ver_video.html](../models/video/patagonia_reveal/ver_video.html) | [patagonia_reveal_12s.blend](../models/estudios/patagonia_reveal_12s.blend) | [patagonia_presentacion_12s.zip](../models/video/patagonia_presentacion_12s.zip) |
| Video corregido · 15 edificios | [pueblo_miniatura/ver_video.html](../models/video/pueblo_miniatura/ver_video.html) | [patagonia_pueblo_miniatura_12s.blend](../models/estudios/patagonia_pueblo_miniatura_12s.blend) | [pueblo_miniatura_12s.zip](../models/video/pueblo_miniatura_12s.zip) |

Los ZIP históricos y los de video son paquetes de presentación; consultar sus `LEEME.txt` para su contenido. El ZIP de la colección final sí incluye el editable completo de diez escenas.

## Cadena de construcción de la colección final

```text
build_ondas_collection.py
├── ondas_collection_specs.py        Diez distribuciones, cámara y semilla
│   └── dense_panorama_specs.py      Helpers de especificación
├── build_dense_panorama.py          Terreno, arquitectura, bosque y cámara
│   ├── patagonia_cycles_detallado.blend  Materiales y geometría de biblioteca
│   ├── build_cycles_detail.py       Definición de la clase Geo, leída del código
│   └── cycles_assets/fir_tree_01/   Biblioteca de coníferas + texturas
└── lake_detail.py                   Agua, costa, reflejo y cielo HDR
    └── textures/cycles_detail/sky/kloppenheim_06_puresky_2k.hdr
```

`build_dense_panorama.py` se carga como biblioteca cuando lo invoca la colección: no hace falta construir los diez panoramas densos para generar las diez escenas nuevas. Sí hace falta el `.blend` detallado que abre al iniciar.

Para reconstruir esa biblioteca desde sus fuentes, la dependencia continúa así:

```text
make_textures.py → texturas del kit
build_cycles_detail.py
└── build_variants.py
    └── build_miniatura.py
        ├── base_geometry.py
        └── proportions.py
+ textures/cycles_detail/            Superficies escaneadas
+ source/cycles_assets/              Coníferas, árbol de hoja y helecho
→ estudios/patagonia_cycles_detallado.blend
```

Algunos generadores reutilizan fragmentos de otros scripts mediante `exec`, `runpy` y cortes por texto. Conservar esos archivos completos, incluidos los comentarios que delimitan bloques. Mover o renombrar clases/comentarios puede romper la cadena aunque no se cambien las escenas directamente.

## Scripts operativos de la colección

| Script en `models/source/` | Entrada principal | Salida o función |
| --- | --- | --- |
| [ondas_collection_specs.py](../models/source/ondas_collection_specs.py) | Coordenadas, tipos de edificios, costas, ríos y semillas | Datos de las diez composiciones. |
| [build_ondas_collection.py](../models/source/build_ondas_collection.py) | Especificaciones + biblioteca detallada | `.blend` final y `manifest.json`; `--check` comprueba posiciones sin construir las diez escenas. |
| [render_ondas_collection.py](../models/source/render_ondas_collection.py) | `.blend` + índice 1–10 | Un PNG y un JSON de render; `--draft` o `--cpu` disponibles. |
| [run_ondas_collection.py](../models/source/run_ondas_collection.py) | Manifiesto + renderizador | Lote secuencial, reanudación, registros y `progress.json`. |
| [validate_ondas_scenes.py](../models/source/validate_ondas_scenes.py) | `.blend` final | `scene_validation.json`. |
| [ondas_contact_sheet.py](../models/source/ondas_contact_sheet.py) | PNG + manifiesto | Vista conjunta final o de borradores. |
| [package_ondas_collection.py](../models/source/package_ondas_collection.py) | PNG, informes, revisión visual, `.blend`, referencia y créditos | Galería, documentos de entrega, validación y ZIP portable. |

## Recursos y procedencia

Los registros locales identifican recursos CC0 de Poly Haven:

- Suelo: `grass_ground`, `forest_ground_04`, `gravelly_sand`, `gravel_road`. [Archivos, URLs y hashes de origen](../models/textures/cycles_detail/sources.json).
- Vegetación: `fir_tree_01`, `tree_small_02`, `fern_02`. [Bibliotecas y procedencia](../models/source/cycles_assets/sources.json).
- Cielo: `kloppenheim_06_puresky_2k.hdr`. [Créditos de la entrega](../models/previews/coleccion_ondas_10/creditos.json).
- Geometría propia del proyecto: terrenos, costas, edificios, caminos, puentes, muelles, botes y detalles de distribución.

No hay un instalador único que descargue y prepare todos estos recursos desde cero. Los generadores esperan los archivos ya presentes con los nombres conservados en el proyecto. Para una reproducción sin red, copiar `source/cycles_assets/` y `textures/` junto con los scripts.

## Archivos de evidencia y archivos temporales

Conservar los manifiestos, `seleccion.json`, `visual_review.json`, `scene_validation.json`, `validation.json` y los JSON de cada render: registran qué se construyó, qué se revisó y qué imagen corresponde a qué manifiesto.

`drafts/` y `logs/` explican las pruebas y ayudan a diagnosticar problemas. Los cuadros de `video/*/frames/` permiten recomponer los MP4 sin volver a pasar por Cycles. Los archivos `__pycache__/` y `*.blend1` no son requisitos de reproducción.

El entorno temporal `/tmp/patagonia-materials-venv` se usó durante el trabajo, pero puede desaparecer. La guía siguiente permite crear un entorno nuevo y no depende de esa ruta.
