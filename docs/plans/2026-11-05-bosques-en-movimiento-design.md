# Bosques en movimiento — cinco miniaturas vivas

## Encargo y fuente

Un único video de unos 25 segundos, sin rótulos ni interfaz, a partir de los cinco `.blend` que originaron las imágenes elegidas de **Bosques y aguas**. Preservar geografía, población, especies, iluminación, proporciones, óptica macro y encuadres reconocibles. Las escenas originales no se sobrescriben.

Orden: costa sin pueblo → punta de arrayanes → sendero del lengal → embarcadero del monte → quebrada sombría. Cada toma dura aproximadamente 5–6 segundos. Transiciones breves y discretas. Entrega objetivo Full HD, 30 fps, sin interpolación artificial de fotogramas; resolución, muestreo y duración se confirman mediante pruebas reales.

## Decisiones visuales

- Agua: conservar el material de profundidad y reflejos aprobado. Animar el relieve real y dos escalas de ondas con velocidades distintas; la línea de costa no se desplaza como una textura.
- Bosque: raíces fijas, flexión pequeña con variación entre ejemplares, ráfagas comunes y movimiento fino de las copas. La silueta y la especie siguen siendo reconocibles.
- Cámara: órbita de pocos grados y desplazamiento suave, sin cambios repentinos de velocidad, sin revelar bordes o la zona fuera del bosque colocado. Foco estable sobre el motivo de cada toma.
- Humo: columna tenue y dispersa desde chimeneas existentes en las tomas habitadas; viento compatible con la vegetación. Sin humo en paisajes sin casas.
- Tiempo: el ambiente tiene una cadencia acelerada moderada; el desplazamiento de cámara es reposado. Evitar vibración, flotación de raíces, crecimiento de árboles y nubes opacas de humo.

Se elige animar la geometría y los materiales nativos. Un montaje con desplazamientos sobre las imágenes no daría paralaje ni viento real. Cambiar de motor solo se considerará si una comparación mantiene el agua, los materiales y la profundidad de campo de los originales; Cycles es la referencia.

## Pasos y aceptación

1/6 Localizar fuentes, inspeccionar dependencias, investigar técnica y registrar el plan.

2/6 Preparar copias animadas y recursos compartidos. Reducir geometría interior de hojas distantes si hace falta, conservando su cantidad, posición y textura. Mantener materiales y texturas empacados o rutas relativas válidas.

3/6 Renderizar pruebas de fotogramas y una secuencia corta. Revisar encuadre, continuidad del agua, viento perceptible y humo proporcionado. Comparar inicio/medio/final.

4/6 Renderizar todas las tomas con proceso reanudable, registro de tiempos, detección de fallos y sin duplicar procesos GPU.

5/6 Montar, codificar y revisar el video completo: ausencia de fotogramas faltantes, parpadeos evidentes, bordes, saltos de cámara y fallos de material.

6/6 Entregar video, escenas editables, scripts, manifiesto y guía reproducible; registrar imágenes de prueba y fotogramas en el histórico existente.

## Directorios

- Fuentes: `models/estudios/bosques_y_aguas_20/`.
- Copias animadas y bibliotecas: `models/estudios/bosques_en_movimiento/`.
- Video, pruebas y fotogramas: `models/video/bosques_en_movimiento/`.
- Scripts: `models/source/bosques_en_movimiento/`.
- Investigación: `docs/investigacion-video/`.

## Estado

Plan inicial. Aún no hay video final; los parámetros definitivos se registrarán después de las pruebas.
