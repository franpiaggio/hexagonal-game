# 02 · Resultado final

[Inicio](../README.md) · [← Evolución](01-evolucion-y-decisiones.md) · [Archivos →](03-archivos-y-dependencias.md)

## Patagonia · diez mundos pequeños

Diez composiciones nuevas de verano patagónico, renderizadas en **Blender Cycles**, siguiendo el agua, la luz y la sensación de miniatura de `estudio_ondas.png`.

[Galería](../models/previews/coleccion_ondas_10/galeria.html) · [ZIP completo](../models/previews/patagonia_coleccion_ondas_10.zip) · [Blender editable](../models/estudios/patagonia_coleccion_ondas_10.blend)

![Las diez composiciones](../models/previews/coleccion_ondas_10/coleccion_completa.jpg)

## Las variantes

Los conteos incluyen los objetos situados fuera del encuadre que aportan sombras, reflejos o continuidad. El ancho representado es aproximado, calculado desde el parámetro de cámara; no es una medición cartográfica.

| # | Escena | Construcciones | Árboles | Ancho representado | Composición |
| --- | --- | ---: | ---: | ---: | --- |
| 01 | [Puerto de las Lengas](../models/previews/coleccion_ondas_10/01_puerto_lengas.png) | 12 | 2442 | 450 m | Bahía extensa, puerto pequeño y claro junto al bosque. |
| 02 | [Paso del Río](../models/previews/coleccion_ondas_10/02_paso_del_rio.png) | 11 | 2896 | 450 m | Un puente de madera conecta dos grupos de casas. |
| 03 | [Refugio del Bosque](../models/previews/coleccion_ondas_10/03_refugio_del_bosque.png) | 5 | 4616 | 440 m | Bosque dominante, arroyo y un claro muy pequeño. |
| 04 | [Punta del Ciprés](../models/previews/coleccion_ondas_10/04_punta_del_cipres.png) | 8 | 793 | 460 m | Península rodeada por un lago abierto. |
| 05 | [Claro de la Capilla](../models/previews/coleccion_ondas_10/05_claro_de_la_capilla.png) | 12 | 3141 | 460 m | Pradera, capilla y río al fondo. |
| 06 | [Orilla de la Ladera](../models/previews/coleccion_ondas_10/06_orilla_de_ladera.png) | 10 | 1732 | 470 m | Lago a la izquierda y casas al pie de una ladera boscosa. |
| 07 | [Confluencia de las Lengas](../models/previews/coleccion_ondas_10/07_confluencia.png) | 9 | 3265 | 480 m | Dos cursos de agua, dos puentes y viviendas dispersas. |
| 08 | [Muelle entre Bosques](../models/previews/coleccion_ondas_10/08_muelle_entre_bosques.png) | 6 | 2540 | 450 m | Refugio junto al lago, embarcadero y dos botes. |
| 09 | [Valle de los Dos Caseríos](../models/previews/coleccion_ondas_10/09_dos_caserios.png) | 11 | 3453 | 500 m | Grupos de cinco y seis edificios unidos por un camino rural. |
| 10 | [Abra del Lago](../models/previews/coleccion_ondas_10/10_abra_del_lago.png) | 7 | 2792 | 500 m | Bahía amplia, viviendas separadas y bosque en las laderas. |

## Parámetros que definen el acabado

| Elemento | Configuración entregada |
| --- | --- |
| Imágenes | Diez PNG RGB de 2048 × 1152, relación 16:9. |
| Render | Cycles; hasta 64 muestras, mínimo adaptativo 24, umbral 0.025, denoising. |
| Cámara | Perspectiva, focal 105 mm, sensor horizontal de 36 mm, elevación 43–44°. |
| Miniatura | 20 metros representados por unidad de diseño; objetos presentados con escala 0.04, equivalente a 1:500. |
| Enfoque | f/1.5, punto de foco ajustado por composición, profundidad de campo activa. |
| Color | AgX, contraste Medium High Contrast, exposición +0.35. |
| Luz principal | Sol cálido suave; energía 1.8 y elevación de diseño de 36°. |
| Agua | Volumen cerrado, IOR 1.333, transmisión 1, rugosidad 0.035, absorción por profundidad y ondas en geometría y normales. |
| Reflejo | Cielo fotográfico sin tinte azul adicional; intensidad del cielo reflejado 1.2; luz de área suave de 7 W. |
| Vegetación | Instancias de geometría detallada de coníferas y árboles de hoja; alturas y orientaciones variadas. |
| Suelo | Superficies escaneadas de pradera, bosque, grava y camino; variación adicional de color y detalles geométricos. |
| Encuadre | Terreno y agua prolongados más allá de cámara; sin contorno de tablero visible. |
| Editable | Diez escenas en un `.blend`, 45 imágenes de recursos empaquetadas, agua compartida entre escenas. |

Las intensidades, densidad del volumen y distancias de bump están calibradas para esta escala. Copiar solo el valor f/1.5 o el color del agua a una escena con otra escala no reproduce el acabado.

Los nombres “lengas”, “ciprés” y los lugares son nombres artísticos. Los recursos de vegetación utilizados están identificados como `fir_tree_01` y `tree_small_02` en los créditos.

## Verificaciones realizadas

- Diez imágenes decodificadas, con resolución y modo de color correctos; diez huellas SHA-256 diferentes.
- Revisión visual de los diez borradores y los diez renders finales, registrada en [visual_review.json](../models/previews/coleccion_ondas_10/visual_review.json).
- Escenas con profundidad de campo activa, apertura f/1.5, iluminación del agua elegida y texturas empaquetadas.
- Volumen de agua cerrado: cero aristas no manifold en la comprobación guardada.
- 551 rayos por encuadre, con 8 % de margen, sin rayos que salieran del terreno comprobado.
- Cada render vinculado al manifiesto de construcción mediante `manifest_sha256`.
- ZIP comprobado mediante CRC y enlaces locales de ambas galerías verificados.

Evidencia: [manifiesto](../models/previews/coleccion_ondas_10/manifest.json), [validación de escenas](../models/previews/coleccion_ondas_10/scene_validation.json), [validación de entrega](../models/previews/coleccion_ondas_10/validation.json) y [estado del lote](../models/previews/coleccion_ondas_10/progress.json).

Los tiempos registrados suman **26 min 29 s de render** para las diez imágenes, con aproximadamente 89–226 s por imagen en este equipo. Excluyen la construcción, apertura de procesos, revisión y empaquetado; sirven como referencia de esta ejecución, no como tiempo garantizado en otro equipo.

## Alcance de la entrega

El ZIP incluye imágenes, galería, vista conjunta, referencia elegida, créditos, manifiestos, verificaciones y `escenas.blend`. El archivo de Blender contiene el estado necesario para volver a renderizar las escenas. Los generadores y bibliotecas fuente permanecen en el proyecto; no están todos incluidos en ese ZIP.

La colección no contiene un nuevo video ni diez nuevos mapas GLB. El traslado del acabado a Three.js se explica en [la guía de integración](06-threejs.md).
