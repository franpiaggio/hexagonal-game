# 05 · Reproducir etapas anteriores y video

[Inicio](../README.md) · [← Colección](04-reproducir-coleccion.md) · [Three.js →](06-threejs.md)

Estas recetas reconstruyen las etapas conservadas del proyecto. Para reproducir el resultado aprobado, empezar por la guía anterior. Los scripts actuales pueden incorporar ajustes posteriores a una imagen histórica: para conservar exactamente una iteración, usar su `.blend` guardado.

## Preparación común

Usar el entorno explicado en [reproducción de la colección](04-reproducir-coleccion.md). Los ejemplos parten de la raíz del proyecto, con `BLENDER` apuntando al ejecutable de Blender y `ART_PY` al Python externo con Pillow y NumPy.

Trabajar en una copia si se quiere preservar los archivos aprobados: estos comandos construyen o reemplazan salidas. Se ejecutan por CLI en procesos separados de la aplicación abierta y no necesitan MCP.

## 1. Kit modular y proporciones

```bash
"$ART_PY" models/source/make_textures.py
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_miniatura.py
```

`make_textures.py` crea texturas de suelo, corteza, piedra, agua y follaje. `build_miniatura.py` reutiliza `base_geometry.py`, aplica `proportions.py`, exporta el kit y guarda `models/patagonia_miniatura.blend` y `models/manifest.json`.

No ejecutar `base_geometry.py` directamente como receta actual: conserva una ruta histórica hacia `Documents/Foto Project/assets/patagonia_base`. El generador de miniatura sustituye esa ruta por `models/` al cargar sus definiciones.

Resultados del kit: siete piezas GLB y `paisaje_demo.glb`. El manifiesto fija radio 2, altura de base 0.12, orientación pointy-top, eje Y en glTF, conexiones de agua y proporciones. Las montañas usan una compresión cartográfica del relieve; no representan una montaña completa a escala arquitectónica literal.

Las comparativas existentes se conservan en [miniatura_tiltshift.png](../models/previews/miniatura_tiltshift.png), [miniatura_sin_desenfoque.png](../models/previews/miniatura_sin_desenfoque.png) y [detalle_proporciones.png](../models/previews/detalle_proporciones.png). El generador guarda las escenas; los renders se pueden obtener con F12 desde el editable.

El informe [models/validation.json](../models/validation.json) registra cero errores y cero advertencias del validador para los ocho GLB entregados, con mensajes informativos sobre tangentes no utilizadas. Ese informe es evidencia de la entrega existente y debe renovarse si se vuelven a exportar los archivos; la generación no lo revalida automáticamente.

## 2. Primera serie de diez estudios

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_variants.py -- --all --build-only

for scene_index in 1 2 3 4 5 6 7 8 9 10; do
  "$BLENDER" --background --python-exit-code 1 \
    --python models/source/render_variants.py -- --index "$scene_index" || break
done
```

Editable: `models/estudios/patagonia_10_variantes.blend`. Imágenes: `models/previews/serie_10/`. El renderizador abre una escena por proceso para contener el uso de memoria.

## 3. Biblioteca detallada de Cycles

Esta etapa es una dependencia de construcción de los panoramas y de la colección final. Si el `.blend` detallado ya existe, no es necesario regenerarla.

Requiere texturas del kit, las superficies de `models/textures/cycles_detail/` y las bibliotecas con texturas de `fir_tree_01`, `tree_small_02` y `fern_02` dentro de `models/source/cycles_assets/`.

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_cycles_detail.py -- --build-only

for camera_index in 1 2 3; do
  "$BLENDER" --background --python-exit-code 1 \
    --python models/source/render_cycles_detail.py -- --view "$camera_index" || break
done
```

Editable: `models/estudios/patagonia_cycles_detallado.blend`. Tres PNG de 3840 × 2560 en `previews/cycles_detallado/`; la primera vista usa hasta 256 muestras y las otras dos hasta 128.

Para generar la colección final solo hace falta la construcción con `--build-only`; estos tres renders históricos no son un requisito.

## 4. Tres vistas sin bordes

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/render_borderless.py -- --build --build-only

for camera_index in 1 2 3; do
  "$BLENDER" --background --python-exit-code 1 \
    --python models/source/render_borderless.py -- --view "$camera_index" || break
done
```

Construye `patagonia_cycles_sin_bordes.blend` a partir de la escena detallada, oculta elementos de estudio y ajusta cámaras para mantener el terreno dentro del encuadre. Las imágenes de 3840 × 2560 quedan en `previews/cycles_sin_bordes/`.

## 5. Diez panoramas densos

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_dense_panorama.py

for scene_index in 1 2 3 4 5 6 7 8 9 10; do
  "$BLENDER" --background --python-exit-code 1 \
    --python models/source/render_dense_panorama.py -- --index "$scene_index" --safe-metal || break
done
```

Distribuciones: `dense_panorama_specs.py`. Editable: `patagonia_panoramas_densos_10.blend`. Salida: `previews/cycles_panoramas_10/`, 3840 × 2560.

Después de revisar las diez imágenes y actualizar su `visual_review.json`, ejecutar `"$ART_PY" models/source/package_dense_panorama.py`. Esta etapa documenta la exploración de mayor densidad; el criterio final de pueblo pequeño está en la colección nueva.

## 6. Pueblo pequeño y revisión del lago

Revisión del pueblo a 15 edificios:

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_small_village.py
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/render_small_village.py -- --final
```

Revisión de la bahía:

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_small_village.py -- --lake
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/render_lake.py -- --final
```

El render del lago admite `--cpu`; sin `--final` produce una prueba de 1280 × 720. `--name nombre` permite dar otro nombre al PNG. Los comandos de reconstrucción usan la versión actual de `lake_detail.py`, restaurada al agua y luz preferidas.

La prueba seleccionada tiene su propio archivo `patagonia_pueblo_lago_elegido.blend`, con 105 mm, f/1.5 y resolución de prueba 1280 × 720. Para reproducir ese estado concreto, usar directamente ese editable, en lugar de inferirlo a partir del nombre de la última imagen renderizada.

## 7. Presentación animada de 12 segundos

Hay dos versiones guardadas: la inicial de 62 edificios y la revisión de pueblo pequeño de 15. La siguiente receta corresponde a la revisión:

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_teaser.py -- --village

"$BLENDER" --background --python-exit-code 1 \
  --python models/source/render_teaser.py -- --village --gpu --fresh-data

"$ART_PY" models/source/compose_teaser.py --village
cp models/previews/pueblo_miniatura/puerto_del_bosque.png \
  models/video/pueblo_miniatura/puerto_del_bosque.png
"$ART_PY" models/source/finalize_teaser.py --village
```

`build_teaser.py` usa `patagonia_pueblo_miniatura.blend` y guarda `patagonia_pueblo_miniatura_12s.blend`. La animación queda en keyframes normales, sin depender de handlers de Python para reproducirse.

El render genera 360 cuadros de 1280 × 720, a 30 fps y hasta 12 muestras con denoising. Usa curvas quínticas para entrada y salida suaves, crecimiento escalonado de elementos y un pequeño movimiento de cámara.

| Tiempo | Etapa |
| --- | --- |
| 0–1.3 s | Terreno y agua. |
| 0.3–4.2 s | Aparición del bosque. |
| 3.2–6.4 s | Aparición del poblado. |
| 6.4–12 s | Contemplación del paisaje completo. |

El compositor requiere **FFmpeg y ffprobe** disponibles en PATH —se usó FFmpeg 8.0.1—, Pillow, NumPy y las fuentes Georgia y Avenir Next de macOS. Los scripts prueban también `/opt/homebrew/bin/` para localizar FFmpeg. La música y el ambiente se sintetizan en `compose_teaser.py`.

El resultado incluye `patagonia_reveal_12s.mp4` con títulos y sonido, `patagonia_reveal_limpio.mp4` sin títulos ni audio, portada, secuencia de momentos y reproductor HTML. Codificación H.264, yuv420p, Rec.709 y audio AAC. El finalizador comprueba los 360 cuadros, duración, resolución y decodificación del video.

Para cerrar el paquete, conservar los documentos ya entregados en `video/pueblo_miniatura/`: `ver_video.html`, `LEEME.txt`, `creditos.json`, `visual_review.json` y `texto_para_x.txt`. El finalizador los incorpora, pero no los crea desde cero. Actualizar las notas de revisión al cambiar la animación. Los cuadros necesitan su `render_times.jsonl`, generado por el renderizador. La copia del PNG anterior incorpora la imagen fija revisada al paquete del video.

### Pruebas, reanudación y cambios

Para probar momentos sueltos:

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/render_teaser.py -- \
  --village --gpu --fresh-data --frames 1,90,180,300,360 --preview
```

`--start` y `--end` limitan un tramo; `--overwrite` reemplaza cuadros existentes. Para CPU, omitir `--gpu` y usar, por ejemplo, `--cpu-threads 12`.

El renderizador de video omite PNG existentes por nombre, sin comparar el estado de la escena. **Después de reconstruir o editar la animación, usar `--overwrite` para regenerar todos los cuadros afectados** y evitar mezclar versiones. La variante `--village` desactiva los datos persistentes; `--fresh-data` hace explícito ese ajuste. Se adoptó tras observar sombreado incorrecto en una sesión prolongada.

Para la presentación inicial, omitir `--village` en los cuatro comandos principales; requiere `patagonia_panoramas_densos_10.blend` y utiliza la escena `08_villa_laguna`. Mantener `--fresh-data` al renderizar.

Los videos quedaron como archivos locales; no se publicaron en redes. La colección nueva no reconstruyó estas animaciones.

## Registros de diseño conservados

- [Exploración de panoramas](../models/source/panoramas_10_design.md).
- [Revisión de pueblo y óptica](../models/source/pueblo_miniatura_design.md).
- [Diseño de la presentación](../models/source/teaser_design.md).
- [Diseño de la colección final](../models/source/coleccion_ondas_design.txt).
