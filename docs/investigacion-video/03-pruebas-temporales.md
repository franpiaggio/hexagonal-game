# Pruebas de oleaje y estabilidad temporal

Este documento conserva el historial de pruebas de la etapa **3/6**. El estado actual está en [PROGRESO.md](../../models/video/bosques_en_movimiento/PROGRESO.md): la producción nativa v03 está en **4/6**, con controles iniciales por toma; todavía no hay un video final revisado. El lote v01 se había detenido después de 38 cuadros Full HD de Punta de arrayanes. Esos cuadros y las cinco escenas originales se conservan.

## Por qué cambió el control

La comprobación anterior detectaba cuadros faltantes, duplicados, negros o grandes saltos de brillo. No bastaba para descartar vibración fina en hojas y reflejos. El usuario pidió explícitamente oleaje legible y sensación de una toma de drone, sin flicker ni artefactos.

Se agregó un control local con flujo óptico, residuos de luminancia después de compensar movimiento y cortes de espacio/tiempo. El detector se comprueba con una traslación conocida y ruido independiente añadido: debe distinguir el segundo caso. **Los residuos no equivalen automáticamente a ruido**: reflejos y deformaciones también cambian físicamente entre cuadros.

`control_temporal.json` impide iniciar la producción hasta registrar evidencia y hashes de las copias Blender revisadas. Es un control interno de calidad, no una solicitud de autorización al usuario.

## Ensayo controlado del agua

Se abrió la copia Blender de Punta de arrayanes y se renderizó un recorte de 500 × 475 píxeles conservando la proyección de una imagen 1920 × 1080. Cámara fija, DOF desactivado, Cycles/Metal, 48 muestras fijas, semilla fija y OIDN High/Accurate. Se ocultaron árboles y edificios para aislar el agua y reducir el costo; el terreno, luces, cielo, cuenca y material de absorción se conservaron. Estas imágenes **no sustituyen la revisión de la escena completa**.

Primeros controles estáticos:

- `original`: relieve del material de la versión inicial.
- `scaled`: distancias de bump multiplicadas por 0.04. Perdió demasiado carácter superficial.
- `geometry`: relieve de material desactivado. Permite ver las ondas geométricas por separado, pero queda demasiado liso para la dirección visual elegida.
- `coherent`: cuatro frentes de onda analíticos con longitudes y velocidades definidas; detalle irregular original atenuado y filtrado. Conserva las ondas geométricas y la absorción de la cuenca.

Después se renderizaron **30 cuadros consecutivos por variante**, del 70 al 99, para `original` y `coherent`. Los parámetros completos están en `models/source/bosques_en_movimiento/oleaje.py` y en el informe de investigación anterior.

| Mediana, escala de luminancia 0–255 salvo indicación | Original | Coherent |
| --- | ---: | ---: |
| Diferencia absoluta sin compensación | 7.834 | 4.419 |
| Diferencia después de compensar movimiento | 7.427 | 4.254 |
| Residuo de frecuencia alta | 5.598 | 2.868 |
| Movimiento estimado, píxeles/cuadro | 0.295 | 0.454 |

La reducción del residuo fino es aproximadamente 49 %. Es evidencia comparativa favorable, **no una certificación de ausencia de flicker**. La magnitud del flujo tampoco mide por sí sola si una ola resulta convincente.

Evidencia: `models/video/bosques_en_movimiento/diagnostico/oleaje/comparacion.json`, los dos `movimiento_local.json` y sus láminas, y `comparacion_original_izquierda_ondas_derecha.mp4`. El MP4 dura un segundo y contiene los dos recortes nativos; no es el montaje final.

## Muestreo y denoising

Se compararon los cuadros 81–83 de la misma variante con 48 muestras sin denoising, 48 con denoising y 192 con denoising. Sin denoising aparece mucho más residuo de ruido. Con 192 se conserva más detalle que con 48, pero el residuo temporal fino no disminuye: incluye movimiento físico del reflejo. Por eso no se decidió multiplicar por cuatro el costo de toda la película basándose solo en esa métrica.

La diferencia media de RGB entre 48 y 192 es aproximadamente 6.87/255 en esos recortes. No implica un cambio de luz o de animación: es una prueba de convergencia de imagen. Véase `diagnostico/oleaje/convergencia.json`.

## Prueba integrada y siguiente control

Se renderizaron 12 cuadros consecutivos de un recorte de la escena completa con 128 muestras, cámara animada, DOF, viento, humo y agua revisada, en `05_punta_de_arrayanes/integracion_oleaje_v02/frames/`. Incluye arrayanes enfocados, edificios, humo y parte de la costa. Conserva la densidad de píxel Full HD. El mismo recorte de arrayanes pasó de 3.573 a 2.689/255 en diferencia de luminancia compensada y de 2.131 a 1.832/255 en residuo de frecuencia alta. Se eligieron 128 muestras fijas para el siguiente piloto. La comparación es corta y el denoising de un recorte puede diferir del de la imagen completa; falta comprobar ese encuadre.

Se preparó la copia nativa candidata de Punta y se guardó la revisión anterior al lado, con sufijo `.revision01.blend`. `piloto_fullhd.py` renderiza 30 cuadros de encuadre completo en cinco bloques de seis y se detiene para revisión. Todavía falta comprobar las cinco copias. No se deben mezclar cuadros de la animación inicial con una revisión del agua.

## Reproducir los diagnósticos

- Blender: `probar_agua.py -- --mode original|scaled|geometry|coherent --frames 70,71,...,99 --label ETIQUETA`.
- Python con NumPy, Pillow y OpenCV: `analizar_movimiento.py CARPETA --first 70 --count 30`.
- `pruebas_temporales.py` ejecuta secuencialmente los controles sin denoising, con 192 muestras y la integración con 128. Ejecutarlo únicamente cuando no haya otro Blender de render activo.
- `renderizar.py` acepta `--border x0,y0,x1,y1`, `--water-revision coherent` y `--fixed-samples` para pruebas identificadas con `--label`; estos cambios de prueba no se permiten en una salida etiquetada `final`.

Los controles no guardan cambios en los Blender fuente. Cada PNG y lámina se registra en el histórico antes de poder reutilizar su ruta. Las imágenes usadas para métricas permanecen disponibles junto a los informes.

Para repetir pruebas después de preparar la revisión 02, `probar_agua.py` usa automáticamente `.revision01.blend`. Las pruebas integradas deben pasar esa fuente con `--blend` y una etiqueta nueva. Nunca reutilizar una carpeta para otro preset. `render_config.json` registra el hash de la fuente y los parámetros, y rechaza mezclas.


## Rechazo visual de las bandas lejanas en el primer encuadre completo

El primer cuadro Full HD de la revisión 02 tardó 206.46 s. Mostró frentes demasiado regulares en el agua lejana desenfocada: el recorte central no lo había revelado. Por eso se detuvo el piloto antes de completarlo; sus cuadros terminados se conservaron y no se aprobó la revisión 02 para producción.

La siguiente prueba mantiene amplitudes, velocidades y muestreo, y cambia solamente la fase espacial con curvatura continua. La fase temporal sigue avanzando sin resembrar ruido. Se prueba primero el encuadre completo a 960 × 540 para evaluar la forma global antes de repetir la comprobación temporal a densidad Full HD. La copia nativa candidata actual todavía es revisión 02; los ensayos de curvatura cargan la revisión 01 con un cambio temporal de material, sin reescribirla.


La secuencia v03 de 30 recortes terminó: residuo fino mediano **2.921/255**, frente a 2.868 en v02 y 5.598 en la versión inicial. Mantiene prácticamente la mejora temporal medida, con frentes menos rectos. Se inspeccionó su lámina de espacio/tiempo y se preparó la copia nativa v03 de Punta. El nuevo piloto Full HD está en `05_punta_de_arrayanes/piloto_fullhd_v03/`. Las copias v01 y v02 permanecen al lado de la canónica; los cuadros v02 no se reutilizan.

El primer cuadro Full HD v03 terminó en **241,81 s** y se inspeccionó. Se acepta la composición de esta candidata para continuar el piloto acotado; la revisión temporal queda pendiente. Evidencia: `diagnostico/v03_primer_encuadre.json`.


## Piloto completo v03 y color de entrega

El piloto terminó con 30 cuadros nativos 1920 × 1080 a 128 muestras fijas. La diferencia global mediana fue 2.188/255, sin huecos, duplicados ni saltos globales detectados. El residuo fino local mediano fue 1.891/255 en agua y 1.843/255 en arrayanes. Se inspeccionaron imágenes y láminas temporales; no se afirma reproducción visual en una app. Informe: `diagnostico/v03_piloto_completo_revision.json`.

Las cinco copias animadas ya tienen `curved_v03`; las cuatro nuevas pasaron reapertura, recursos presentes, raíces/escalas fijas y drivers válidos. Queda inspeccionar sus encuadres Full HD antes del lote largo. Los 42 cuadros v01 quedaron separados en carpetas `revision_v01_preservada/frames`.

El encoder anterior convertía matriz y rango, pero el flujo retenía transferencia sRGB. Se corrigió usando `colorspace` para transformar también la curva sRGB a BT.709, con un intermedio de 12 bits y salida YUV420. No se limitó a cambiar etiquetas. La documentación de FFmpeg distingue esta conversión completa de su opción rápida que omite corrección gamma. [Documentación oficial del filtro](https://ffmpeg.org/ffmpeg-filters.html#colorspace).

Una prueba codificada y luego devuelta a sRGB tuvo diferencia media RGB de 1.681/255 y sesgo máximo de canal de 0.416/255. Se inspeccionó la imagen recuperada. El piloto completo y una prueba de fundido RGB de 48 cuadros se decodificaron sin errores, con matriz, primarias y transferencia BT.709 verificadas. Evidencia: `diagnostico/prueba_transfer.json`, `diagnostico/prueba_transicion_bt709.json` y `piloto_fullhd_v03/codec.json`. Esto controla la cadena de color; no sustituye la revisión temporal de las escenas restantes.
