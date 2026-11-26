# Metal: especialización y caché en el piloto v03

Investigado el 5 de noviembre de 2026. Alcance: lectura de código oficial de Blender 5.2 y antecedentes corregidos; no se ejecutaron Blender ni renders, ni se modificaron assets. Referencia de código: rama `blender-v5.2-release`, commit `d81557c1dc57d7b1f31a1d5a367d2f497c71540d`.

## Decisión inicial

**Mantener el piloto v03 en curso. Al terminar, tiene fundamento probar un único cuadro con `FULL`, conservando todos los demás ajustes.** El helper actual fuerza `OFF`, mientras Blender 5.2 usa `FULL` por defecto. La especialización optimiza el código GPU según la escena; no cambia el integrador elegido, materiales, muestras ni calidad solicitada. Hay evidencia suficiente de una oportunidad de rendimiento, pero ninguna medición que permita anticipar su magnitud en este M2 Pro o garantizar imágenes idénticas bit a bit. [Preferencia oficial y valor predeterminado](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/blender/addon/properties.py#L1695), [especialización por constantes de escena](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/device/metal/device_impl.mm#L389).

Contexto comunicado: M2 Pro, 16 GB, Metal, 1920 × 1080, 128 muestras fijas, aproximadamente 245 s/cuadro. Lectura local `sw_vers`: **macOS 15.6.1, build 24G90**. No se verificó el hash del ejecutable instalado.

## Qué cambia cada opción

| Opción | Trabajo que especializa | Coste esperado según Blender |
| --- | --- | --- |
| `OFF` | Ninguno; usa kernels genéricos. | Evita compilación adicional por escena; es la opción de menor rendimiento descrita por la interfaz. |
| `INTERSECT` | Intersecciones de rayos. | Compilación relativamente rápida y poco trabajo adicional de CPU. |
| `FULL` | Intersecciones y sombreado. | Mayor oportunidad de acelerar el render; puede añadir trabajo de CPU al compilar. Es el valor predeterminado. |

Las especializaciones se solicitan al comenzar y normalmente se compilan en segundo plano. Mientras faltan, el render puede continuar con kernels genéricos y sustituirlos cuando estén disponibles. La interfaz advierte de decenas de segundos de CPU adicional; el coste real depende de escena, cachés y sistema. Por ello, el primer cuadro puede mezclar compilación y trazado con distintos kernels. El viewport limita la especialización a intersecciones para conservar respuesta interactiva. [Definición de opciones](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/blender/addon/properties.py#L1695), [compilación asíncrona y tratamiento de benchmarks](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/device/metal/device_impl.mm#L965).

**Memoria:** existen variantes adicionales de pipelines y trabajo del compilador; no encontré un incremento máximo documentado para M2 Pro. La caché limita a tres variantes del mismo tipo de especialización por kernel, no a tres kernels totales. En 16 GB conviene registrar presión de memoria y swap durante la prueba; no asumir que ese límite garantiza cabida. [Caché en memoria](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/device/metal/kernel.mm#L219).

## Qué desactiva realmente el flag

`CYCLES_METAL_DISABLE_BINARY_ARCHIVES=1` hace que Cycles omita su vía **`MTLBinaryArchive` de lectura y escritura de pipelines compilados en disco**. Sin el flag, se archivan kernels genéricos y determinados kernels de sombreado costosos; hay exclusiones para intersecciones MetalRT. Los archivos se guardan bajo la caché `kernels`, identificados por dispositivo, kernel, especialización, versión del sistema y otros parámetros. [Selección](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/device/metal/kernel.mm#L402), [lectura y ruta](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/device/metal/kernel.mm#L668), [serialización](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/device/metal/kernel.mm#L826).

**No desactiva toda caché Metal:** siguen existiendo `ShaderCache` dentro del proceso y la caché del sistema. Su impacto principal es reutilización y compilación, especialmente entre procesos; no hay base para atribuirle por sí solo una aceleración del trazado una vez cargados los mismos pipelines. Blender 5.2 ya evita esos archives por debajo de macOS 15.4. En este macOS 15.6.1, el flag fuerza una restricción adicional. Mantenerlo durante la prueba de `FULL` aísla una sola variable. [Condiciones y referencia a caché del sistema](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/device/metal/kernel.mm#L402).

## Antecedentes: existentes, corregidos y sin atribución local

- Enero de 2025: cierre inesperado al serializar `MTLBinaryArchive`; el commit indica arreglo del sistema desde macOS 15.4 y añade la restricción por versión. [Corrección #131458](https://github.com/blender/blender/commit/fd06944d154d41a8f12282fef652fb616d242cdd).
- Septiembre de 2024: cierre ocasional al finalizar renders CLI mientras seguía activo el hilo de especialización; corregido coordinando su finalización. [Corrección](https://github.com/blender/blender/commit/95f361ac316963f91d031789846bea76e411855b).
- Febrero de 2023: renders multipass incorrectos por constantes de especialización obsoletas; corregido el seguimiento de hashes. Esto acredita un antecedente, no un fallo actual demostrado de `FULL`. [Corrección #105100](https://github.com/blender/blender/commit/482fb791ceada4f2344ccd041ec4d81d83439cc6).

En el proyecto, [el histórico](../05-historico-y-video.md) documenta que `--fresh-data` se adoptó tras sombreado incorrecto en una sesión prolongada. [render_teaser.py](../../models/source/render_teaser.py) desactiva datos persistentes y repite `OFF` + archives desactivados, pero no documenta por qué eligió esos dos ajustes. Tampoco el helper [arboles.py](../../models/vegetacion_patagonica/source/arboles.py) aporta esa explicación. **No atribuir el incidente local a `FULL` ni tratar el nombre `safe_metal` como evidencia causal.** Conservar `use_persistent_data=False`.

## Benchmark inicial propuesto: FULL, después del piloto

1. Tomar el mismo archivo y número de cuadro ya producido con `OFF`; conservar cámara, animación, seed, denoiser, MetalRT, resolución, 128 muestras y datos persistentes desactivados. No ejecutar simultáneamente con el piloto.
2. En un proceso separado, después de cualquier helper que vuelva a imponer `OFF`, asignar únicamente `bpy.context.preferences.addons['cycles'].preferences.kernel_optimization_level = 'FULL'`. Conservar archives desactivados. No guardar preferencias ni sobrescribir el `.blend` original.
3. Renderizar ese cuadro en una salida nueva y registrar tiempo total, mensajes de compilación/sustitución de kernels y presión de memoria/swap. Comparar con el mismo cuadro `OFF`, incluyendo agua, follaje, colores y materiales. Archivar la prueba con el flujo habitual del estudio.
4. Si los kernels especializados no llegaron a utilizarse, marcar el resultado **inconcluso** para rendimiento estable. Si hay artefactos, error o presión de memoria problemática, conservar `OFF`. Si mejora claramente sin regresión visible, queda justificado considerar `FULL` para el siguiente tramo; **un cuadro no certifica estabilidad temporal ni ausencia de fallos en sesiones largas**. No ampliar automáticamente a otros parámetros o benchmarks.

Esta prueba mide una oportunidad concreta sin cambiar el muestreo ni el aspecto intencional de la escena. Su duración de arranque debe distinguirse del rendimiento sostenido; no se propone aumentar muestras ni prometer un porcentaje de mejora.

## Actualización: tiles de 256 y ocupación observada

Tras finalizar los 30 cuadros del piloto, el coordinador informa que el benchmark `FULL` muestra reinicios de lotes de muestras por tile, aproximadamente 6.5 s para el primer tile completo y `occupancy ≈ 0.045`. El renderizador impone `tile_size=256`; los contadores comunicados tras optimizar geometría son 1.21 GB de datos host y 1.76 GB de pico reportado. Son observaciones del proceso en curso, no mediciones realizadas por esta investigación.

**En 5.2 el valor predeterminado es 2048.** `use_auto_tile` está obsoleto: el render final activa tiling internamente y `tile_size` determina su división. Con 1920 × 1080, 256 produce 40 tiles; 1024 produce 4; 2048 permite un único buffer de imagen. Los tiles de almacenamiento son distintos de los pequeños grupos que Cycles programa dentro de la GPU. [Propiedades](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/blender/addon/properties.py#L1080), [sincronización del render final](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/blender/sync.cpp#L1132), [cálculo del tamaño efectivo](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/session/session.cpp#L499), [arquitectura de tiling](https://developer.blender.org/docs/features/cycles/tiling/).

**`occupancy` no mide porcentaje de utilización física de la GPU.** Cycles calcula el promedio, por iteración del planificador, de paths principales activos dividido por su máximo de estados disponibles; no es una medida ponderada por tiempo. El valor 0.045 indica escaso llenado de esa reserva durante ese lote, compatible con falta de trabajo suficiente, pero no identifica por sí solo la causa. El planificador se reinicia al avanzar de tile: volver a lotes pequeños no implica perder muestras ya renderizadas. [Cálculo exacto](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/integrator/path_trace_work_gpu.cpp#L348), [reinicio por tile](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/integrator/render_scheduler.cpp#L180).

**Hipótesis acotada:** 1024 ofrece más píxeles disponibles y menos reinicios/vaciados de colas, por lo que podría mejorar el llenado y reducir costes repetidos. Los 40 × 6.5 s son compatibles con el tiempo observado, pero no demuestran una ganancia: los tiles grandes también contienen más trabajo. El buffer máximo de píxeles por tile crece 16 veces; la geometría y la memoria total del proceso no se multiplican por 16. Los contadores comunicados tampoco garantizan margen total de memoria unificada del sistema. [Objetivos del planificador](https://developer.blender.org/docs/features/cycles/render_scheduling/).

**Denoising final global:** cuando hay varios tiles, Cycles omite expresamente denoising por tile, reconstruye el buffer completo desde disco y aplica el denoiser a ese cuadro. Cambiar 256 por 1024 no divide OIDN en cuatro tratamientos independientes ni cambia su calidad configurada. [Condición que evita denoising por tile](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/integrator/render_scheduler.cpp#L1027), [denoising del buffer completo](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/integrator/path_trace.cpp#L1095).

**Esta evidencia nueva justifica una sola prueba adicional al terminar `FULL`: `OFF` + tile 1024**, con el mismo cuadro del piloto `OFF` + 256, 128 muestras fijas, seed, materiales, denoising, archives y datos persistentes intactos. Comparar con `OFF` + 256 aísla el tamaño del tile; comparar directamente con `FULL` + 256 mezclaría dos variables. Registrar tiempo total y de trazado, ocupación por lote y presión de memoria/swap, y revisar igualdad visual y bordes de tiles. Conservar una salida nueva y archivarla. No se propone probar 2048 ni una matriz de configuraciones. Se espera conservar el cálculo de imagen y muestras, pero debe verificarse el resultado; no se promete identidad binaria ni mejora de velocidad.


## Resultado de los dos ensayos locales

Ambos terminaron sin error y conservaron prácticamente la misma imagen del cuadro 1. Frente a 241.808 s del cuadro base OFF/256, FULL/256 tardó 229.06 s y OFF/1024 tardó 218.591 s. Diferencia RGB media contra la base: 0.0080/255 y 0.000071/255, respectivamente; máximos 9 y 1. El pico físico reportado fue aproximadamente 8.60 y 8.55 GB. Son cuadros fríos aislados, con presión de memoria del sistema variable; no establecen rendimiento sostenido.

**Decisión:** conservar OFF/256 del piloto de 30 cuadros, con datos persistentes desactivados. No extender la matriz de benchmarks ni cambiar la calidad para perseguir estas diferencias puntuales. Informes: `benchmark_metal_full/comparacion.json` y `benchmark_tiles1024/comparacion.json` dentro de Punta.
