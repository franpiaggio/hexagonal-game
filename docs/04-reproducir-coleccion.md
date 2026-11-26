# 04 · Reproducir la colección

[Inicio](../README.md) · [← Archivos](03-archivos-y-dependencias.md) · [Histórico y video →](05-historico-y-video.md)

## Elegir el recorrido

| Objetivo | Recorrido |
| --- | --- |
| Obtener las mismas escenas sin reconstruir nada | Abrir el `.blend` final o el `escenas.blend` del ZIP y renderizar. |
| Volver a generar los diez PNG con sus informes | Preparar el entorno y ejecutar el renderizador sobre el `.blend` final existente. |
| Cambiar costas, pueblos, bosques o cámara | Conservar una copia de la entrega, editar las especificaciones y reconstruir. |
| Regenerar también los recursos de biblioteca | Seguir primero la reconstrucción de biblioteca de la guía histórica. |

Los generadores escriben sobre sus rutas de salida fijas. Para experimentar, usar una copia del proyecto que incluya los recursos de `models/`, o conservar el ZIP y los editables aprobados fuera de esas rutas antes de reconstruir. El renderizador individual también reemplaza el PNG de su índice.

## 1. Abrir y renderizar sin scripts

1. Abrir [patagonia_coleccion_ondas_10.blend](../models/estudios/patagonia_coleccion_ondas_10.blend) en Blender.
2. Elegir una escena numerada en el selector de escenas. Cada una contiene su propia cámara y punto de foco.
3. Ir a vista de cámara y pulsar **F12**. El modo sólido no muestra el resultado de la profundidad de campo.
4. Guardar el render con **Image → Save As** en una carpeta nueva.

El archivo lleva 45 imágenes de recursos empaquetadas y no necesita los generadores para renderizar. El archivo extraído del ZIP se llama `escenas.blend`. Algunos campos de salida conservan rutas del equipo original: elegir un destino nuevo al guardar.

Para verificar una escena por CLI y guardar una copia independiente:

```bash
cd /Users/franciscopiaggio/localwork/hexagonal-game
BLENDER='/Applications/Blender.app/Contents/MacOS/Blender'
PROJECT_DIR="$PWD"
mkdir -p "$PROJECT_DIR/models/previews/reproducciones"
"$BLENDER" --background "$PROJECT_DIR/models/estudios/patagonia_coleccion_ondas_10.blend" \
  --scene 01_puerto_lengas \
  --render-output "$PROJECT_DIR/models/previews/reproducciones/puerto_lengas_####" \
  --render-format PNG --render-frame 1
```

Este comando usa la configuración guardada del archivo y no crea los JSON del lote. Para la entrega automatizada, usar los pasos siguientes.

## 2. Entorno de trabajo

Configuración observada durante la entrega:

| Herramienta | Versión / configuración |
| --- | --- |
| Blender | 5.2.0 LTS, hash `fbe6228777e7`. |
| Equipo de render | macOS, Apple M2 Pro, 16 GB de RAM; Cycles con Metal. |
| Python externo | 3.14.4. |
| Pillow | 13.0.0. |
| NumPy | 2.5.4. |
| Fuentes para la vista conjunta | Arial y Georgia en las rutas de sistema de macOS. |

Los scripts que importan `bpy` se ejecutan **dentro de Blender**. Su Python ya aporta las bibliotecas de Blender y NumPy. Los scripts de lote, imágenes y empaquetado usan Python externo.

Crear un entorno persistente fuera del repositorio:

```bash
cd /Users/franciscopiaggio/localwork/hexagonal-game
BLENDER='/Applications/Blender.app/Contents/MacOS/Blender'
ART_ENV="$HOME/.venvs/hexagonal-game"
python3 -m venv "$ART_ENV"
ART_PY="$ART_ENV/bin/python"
"$ART_PY" -m pip install 'Pillow==13.0.0' 'numpy==2.5.4'
```

En otra máquina, ajustar el `cd` y la ubicación de Blender. Para usar el lote automático, también ajustar `BLENDER` dentro de `run_ondas_collection.py`, que tiene la ruta de la aplicación de macOS escrita en el código.

En Linux o Windows se pueden renderizar las escenas con CPU, pero la hoja de contacto necesita sustituir las rutas de Arial y Georgia en `ondas_contact_sheet.py`. El renderizador GPU está escrito para Metal; no selecciona CUDA/OptiX automáticamente.

## 3. Comprobar dependencias y posiciones

Antes de construir deben existir:

- `models/estudios/patagonia_cycles_detallado.blend`.
- `models/source/`, incluidos los scripts de biblioteca y especificaciones.
- `models/source/cycles_assets/fir_tree_01/`, con el `.blend` y sus texturas.
- `models/textures/cycles_detail/sky/kloppenheim_06_puresky_2k.hdr`.
- Para empaquetar: `models/previews/pueblo_lago/estudio_ondas.png` y `creditos.json`.

Comprobar los diez planos de distribución:

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_ondas_collection.py -- --check
```

Debe emitir diez líneas `LAYOUT_OK`. Esta comprobación abre la biblioteca e identifica edificios superpuestos o incompatibles con la costa. No sustituye la revisión visual del render.

## 4. Construir y validar las escenas

Este paso es necesario si se cambiaron las especificaciones o no existe el `.blend` final. Se puede omitir para volver a renderizar el editable aprobado.

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/build_ondas_collection.py

"$BLENDER" --background --python-exit-code 1 \
  --python models/source/validate_ondas_scenes.py
```

Salidas: `models/estudios/patagonia_coleccion_ondas_10.blend`, `manifest.json` y `scene_validation.json` en `models/previews/coleccion_ondas_10/`.

La construcción comprueba los edificios, crea cada paisaje, verifica el encuadre, empaqueta las imágenes y guarda las diez escenas. La validación posterior revisa recursos empaquetados, agua cerrada y compartida, conteos, apertura y luz de reflejo.

Si se trabaja sobre una variante nueva, reiniciar el registro de revisión visual: vaciar `drafts_inspected`, `finals_inspected` e `images` de `visual_review.json` y registrar la nueva fecha/alcance. Conservar el registro anterior con la entrega aprobada. Los campos históricos de revisión no deben tomarse como aprobación de imágenes recién generadas.

## 5. Borradores y revisión visual

```bash
"$ART_PY" models/source/run_ondas_collection.py --draft
"$ART_PY" models/source/ondas_contact_sheet.py --draft
```

Genera borradores de 1024 × 576, hasta 24 muestras, en `drafts/`, y `contacto_pruebas.jpg`. Para una selección:

```bash
"$ART_PY" models/source/run_ondas_collection.py --draft --indices 2 7 --overwrite
```

Revisar que el lago tenga extensión, que los ríos se lean como agua, que puentes y muelles alcancen la costa, que las casas tengan espacio, que el bosque domine y que el foco deje legible la zona principal. Comprobar que ningún borde exterior aparezca en cámara.

Anotar las imágenes realmente inspeccionadas en `visual_review.json`. Si una composición falla, corregir las especificaciones o el material y repetir desde la construcción.

## 6. Render final y reanudación

Lote completo con GPU Metal, un proceso de Blender por imagen:

```bash
"$ART_PY" models/source/run_ondas_collection.py
```

El lote recorre las diez escenas secuencialmente. Al repetir el comando, omite únicamente las imágenes que ya tienen PNG e informe JSON con el mismo hash del manifiesto. `--overwrite` fuerza su regeneración. El estado queda en `progress.json` y los registros en `logs/`.

Una imagen individual:

```bash
"$BLENDER" --background --python-exit-code 1 \
  --python models/source/render_ondas_collection.py -- --index 4
```

Alternativa CPU para las diez imágenes, también secuencial:

```bash
for scene_index in 1 2 3 4 5 6 7 8 9 10; do
  "$BLENDER" --background --python-exit-code 1 \
    --python models/source/render_ondas_collection.py -- --index "$scene_index" --cpu || break
done
```

El renderizador CPU fija 12 hilos; ajustar ese valor en el script si se necesita. El bucle manual no actualiza `progress.json` ni omite imágenes existentes. Conservar ese archivo del proyecto o crear uno que describa el lote manual antes de empaquetar, porque el empaquetador lo lee al finalizar.

No ejecutar otro proceso de Blender simultáneo en el equipo de 16 GB usado para esta entrega: se observó presión de memoria y paginación al mezclar render GPU y otro proceso pesado. El lote aislado también evita problemas de sombreado por datos persistentes de Cycles.

## 7. Revisar y empaquetar

Inspeccionar los diez PNG finales a su tamaño completo y completar las notas de `visual_review.json`. Solo al terminar deben figurar los índices 1–10 en `finals_inspected`.

```bash
"$ART_PY" models/source/package_ondas_collection.py
```

El empaquetador requiere `manifest.json`, los diez PNG y sus JSON, `scene_validation.json`, `visual_review.json`, `progress.json`, el `.blend`, la referencia elegida y los créditos. Comprueba dimensiones, hashes, correspondencia del render, conteos y evidencia de revisión; genera la galería, la vista conjunta, documentación de entrega y ZIP. Después verifica CRC y enlaces.

El resultado esperado es `status: complete`, `images: 10` y `gallery_links: passed`. Abrir `models/previews/coleccion_ondas_10/galeria.html` para revisar la presentación.

## 8. Cambiar una variante conservando el estilo

Editar [ondas_collection_specs.py](../models/source/ondas_collection_specs.py):

| Campo | Controla |
| --- | --- |
| `house_layout` | Posiciones, tipo, variante y ángulo de cada edificio. |
| `lake_outline`, `land_outlines` | Contorno de costa y porciones de tierra, como una península. |
| `rivers`, `roads` | Recorridos y anchos de agua y caminos. |
| `forest`, `forest_base`, `tree_spacing`, `broadleaf` | Masas, densidad y mezcla del bosque. |
| `width`, `aim`, `az`, `el`, `focus`, `fstop` | Encuadre y profundidad de campo. |
| `docks`, `bridges`, `boats` | Embarcaderos, puentes y botes. |
| `seed` | Variación reproducible de la distribución procedural. |

El helper `h()` guarda ángulos de edificios que la planificación convierte desde grados. Los ángulos de puentes y botes que aparecen en las especificaciones usan radianes. Seguir los ejemplos del archivo para no mezclar unidades.

La colección aprobada usa 5–12 edificios, f/1.5 y cámara a 43–44°. Conservar `lake_detail.py` como referencia del agua y de la luz. Las cantidades de árboles pueden variar al modificar la costa porque se excluyen zonas de agua, caminos y edificios.

## Reproducción y límites prácticos

- **Fidelidad al estado aprobado:** usar el `.blend` final. La reconstrucción desde scripts usa semillas, pero una actualización de Blender o de recursos puede modificar el resultado.
- **Hash del manifiesto:** incluye valores como tiempos de construcción. Una reconstrucción puede cambiarlo aunque la distribución sea equivalente; el lote entonces vuelve a renderizar.
- **Ediciones manuales del `.blend`:** la reanudación solo compara el manifiesto, no calcula un hash del editable. Usar `--overwrite` después de una edición manual para evitar reutilizar PNG anteriores.
- **Trasladar el proyecto:** los generadores calculan casi todas las rutas desde `__file__`, pero el manifiesto contiene una ruta absoluta al `.blend`. Reconstruir en el nuevo destino genera el manifiesto correcto. Si se lo cambia manualmente, los informes de render dejan de coincidir con su hash y deben regenerarse.
- **Referencia original:** `render_lake.py` abre `patagonia_pueblo_lago.blend`, no `patagonia_pueblo_lago_elegido.blend`. Para reproducir exactamente el estado elegido, abrir el editable con sufijo `_elegido` directamente y guardar el render con otro nombre.
