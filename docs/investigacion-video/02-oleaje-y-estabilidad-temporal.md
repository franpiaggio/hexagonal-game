# Oleaje legible y estabilidad temporal

Investigación del 5 de noviembre de 2026. Objetivo: una toma aérea que registre movimiento natural del lago, sin aprobar un render largo mientras agua, follaje o denoising presenten parpadeo. Este documento no diagnostica el video ya producido: identifica hipótesis y pruebas discriminantes. No se ejecutaron Blender ni renders; los originales permanecen intactos.

Fuentes: Blender 5.2, código de su rama LTS, documentación de Intel Open Image Denoise y el capítulo original de GPU Gems sobre ondas. Las referencias de código se fijan al commit `d81557c1dc57d7b1f31a1d5a367d2f497c71540d`, consultado en `blender-v5.2-release`.

## Decisión inmediata

**Aprobar primero oleaje geométrico sin bump, con la cámara quieta; recuperar después material, movimiento de cámara y DOF por etapas.** Un cambio de brillo puede ser una ola legítima, aliasing especular, ruido del trazado o una transformación del denoiser. Subir muestras simultáneamente con cambiar el agua impediría distinguirlos.

El siguiente ensayo debe reutilizar los cuadros existentes cuando permitan comparar. Para nuevos diagnósticos, usar recortes de agua y follaje a la densidad de píxeles de 1080p, con un margen alrededor: no bajar la resolución de la cámara y considerar ese resultado prueba del antialiasing final. La secuencia larga queda después de los controles de la sección 6.

### Decisión provisional después de los recortes

El estudio ya comparó `original`, `scaled` y `geometry` en recortes de 500 × 475 a densidad de 1920 px, aproximadamente 9 s/cuadro: informa que la reducción ×0.04 perdió carácter, la geometría sola dejó reflejos grandes lisos y el original tuvo brillo excesivamente fragmentado. Es evidencia de apariencia de un cuadro, todavía no una aprobación temporal. No repetir esos ensayos.

La variante **coherent**, ya preparada por el responsable de implementación, conserva la cuenca y las dos ondas geométricas largas. Agrega cuatro ondas analíticas en las normales:

| Parámetro | Onda 1 | Onda 2 | Onda 3 | Onda 4 |
| --- | ---: | ---: | ---: | ---: |
| Longitud real | 3.8 m | 2.35 m | 1.45 m | 0.92 m |
| Amplitud real | 0.065 m | 0.031 m | 0.016 m | 0.006 m |
| Dirección | 65° | 78° | 53° | 91° |

Usa `ω = sqrt(g k)`, Height en metros de mundo (`A_real / 500`), Bump Distance 1 y Filter Width 1 px. El ruido broad baja a Distance 0.00055 y el fino a 0.000025; roughness sube a 0.065. Son valores del candidato concreto, no ajustes ya certificados contra flicker. Con Height expresado así, Distance 1 es un multiplicador correcto: no significa introducir olas de un metro mundial.

**Próximo control autorizado: 24–30 cuadros consecutivos de coherent, con cámara y DOF fijados.** Comparar noisy/denoised si están disponibles y verificar progresión de crestas/reflejos. Si pasa, agregar el recorrido aéreo y evaluar otra secuencia corta; si falla, aislar una capa del material dentro del mismo recorte. No abrir ahora una implementación Ocean paralela. La tapa tiene un espaciado informado de aproximadamente 1 m real: las ondas de 0.92–3.8 m en geometría exigirían más resolución; introducirlas en las normales evita esa ampliación, aunque sigue requiriendo verificar su filtrado en pantalla.

## 1. Bump: unidades y la hipótesis más concreta

El nodo Bump ordinario se exporta a Cycles sin activar `use_object_space`; el valor predeterminado de ese indicador interno es falso. Su implementación SVM construye la perturbación a partir de diferenciales de superficie y solo los transforma al espacio objeto cuando dicho indicador está activo. **Distance corresponde a unidades de mundo en este caso**. Alimentar Height con coordenadas Object cambia el patrón, pero no convierte Distance en unidades locales. No confundirlo con el selector Object/World del nodo Displacement. [Exportación de Bump](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/blender/shader.cpp#L873), [valor predeterminado](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/scene/shader_nodes.cpp#L7210), [cálculo SVM](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/kernel/svm/displace.h#L20).

Con los valores comunicados por el estudio y escala uniforme efectiva 0.04:

| Magnitud | Valor local | Mundo de miniatura | Equivalencia real 1:500 |
| --- | ---: | ---: | ---: |
| Amplitud geométrica 1 | 0.0045 | 0.00018 m | 0.09 m |
| Amplitud geométrica 2 | 0.0018 | 0.000072 m | 0.036 m |
| Distance broad actual | — | 0.004 m | 2 m nominales |
| Distance capillary actual | — | 0.0007 m | 0.35 m nominales |

Las últimas dos filas **no son alturas efectivas de olas**: Distance multiplica las variaciones de Height, el gradiente depende de la frecuencia y Strength mezcla normales. Sí muestran una diferencia de escala que merece aislamiento: el Distance broad es 22.2 veces la primera amplitud geométrica mundial. Una superficie puede parecer plana en silueta mientras sus normales se comportan como un relieve muy pronunciado.

Prueba propuesta: ambos bumps desconectados → solo broad → broad y capillary. Si los Distance se habían elegido suponiendo unidades locales, comparar explícitamente la corrección ×0.04: **0.00016 y 0.000028**, conservando el resto. No adoptar esos números sin mirar el movimiento: son una corrección dimensional candidata, no una receta final. Tampoco compensar con Strength y Distance a la vez.

Bump 5.2 tiene **Filter Width**, en píxeles, y documenta 0.1 como valor predeterminado de filtrado subpíxel. Verificar su valor actual y ensayar un ancho mayor solo si persiste aliasing del relieve; ensancharlo modifica la interpretación de la normal, no equivale a subir muestras ni garantiza antialiasing de todo reflejo. [Bump, manual 5.2](https://docs.blender.org/manual/de/5.2/render/shader_nodes/displacement/bump.html).

Blender advierte que un bump cuya forma aparente difiere demasiado de la geometría puede generar artefactos; recomienda reducirlo o usar desplazamiento real. [Material Displacement](https://docs.blender.org/manual/en/latest/render/materials/components/displacement.html). Esto apoya la prueba de aislamiento, pero no demuestra que sea la causa de un posible parpadeo.

## 2. Ondas actuales: continuidad y velocidad

El código usa denominadores locales 0.70/0.46, pero los vectores `(0.75, 1.3)` y `(-0.38, 1)` no están normalizados. Por eso **14/9.2 m no son las longitudes efectivas**. Ignorando momentáneamente las deformaciones de fase, resultan `14 / hypot(.75, 1.3) = 9.33 m` y `9.2 / hypot(-.38, 1) = 8.60 m`. Las deformaciones hacen variar localmente esas longitudes. Amplitudes nominales: 9/3.6 cm; velocidades angulares: 3.25/4.75 rad/s.

| Onda efectiva aproximada | Período actual `2π/ω` | Velocidad de cresta aproximada `ωλ/2π` | Período gravitatorio en aguas profundas |
| --- | ---: | ---: | ---: |
| 9.33 m | 1.93 s | 4.83 m/s | 2.44 s |
| 8.60 m | 1.32 s | 6.50 m/s | 2.35 s |

Son cálculos, no mediciones del clip. La referencia usa `ω² = g k tanh(k h)`, `k = 2π/λ`, con `g = 9.81 m/s²`; en profundidad suficiente, `tanh(kh) ≈ 1`. Blender Ocean implementa esa relación. [Código de frecuencia de Ocean](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/source/blender/blenkernel/intern/ocean.cc#L80).

Para aparentar un lago real filmado por drone, **calcular en metros reales y segundos reales; reducir después la geometría a 1:500**. No acelerar el reloj porque la maqueta mida menos. Las frecuencias actuales son más rápidas que esa referencia física; revisar si esa elección se desea, sin atribuirle todavía el flicker. A 30 fps estos dos senos están lejos del límite temporal de muestreo; los reflejos estrechos y los detalles procedurales pueden presentar variaciones mucho más rápidas.

Mantener fases, longitudes y direcciones constantes dentro del plano. La traslación de ruido actual es un recurso adicional, no una demostración de oleaje: su velocidad visible depende también del estiramiento y del escalado del vector. Hacer que la progresión de las crestas geométricas sea legible antes de añadir brillo capilar.

## 3. Ocean 5.2 frente a suma de senos/Gerstner

Ocean calcula una superficie espectral evaluada en `Time`; el valor debe animarse. `Spatial Size` define el dominio en metros; `Wind Velocity`, el viento en m/s; `Smallest Wave` elimina detalle de longitudes pequeñas; `Choppiness` añade desplazamiento horizontal. `Generate Normals` crea datos extra para textura/bake: no es el interruptor que vuelve suaves las normales geométricas. TMA/Shallow Water está pensado para profundidad menor a unos 10 m; no elegirlo simplemente porque el recorte represente un lago. [Ocean, manual 5.2](https://docs.blender.org/manual/th/5.2/modeling/modifiers/physics/ocean.html).

| Opción | Ventaja para este plano | Límite relevante |
| --- | --- | --- |
| Conservar los dos senos y ajustar escala/material | Menor cambio; permite aislar el defecto actual | Pocas direcciones pueden mostrar un patrón demasiado regular |
| 4–6 senos o Gerstner controlados | Dirección, longitud, amplitud, velocidad y normales explícitas; fácil mantener cerrada la cuenca | Es una aproximación; requiere controlar pendientes y zonas de costa |
| Ocean como superficie conductora | Espectro amplio y evolución coherente ya implementados | Introduce otro dominio, evaluación FFT y adaptación de la cuenca; no resuelve por sí mismo aliasing o denoising |

**Recomendación actual:** continuar con las cuatro ondas analíticas de normales ya preparadas, separadas de las longitudes geométricas grandes. Ocean queda documentado como alternativa futura de forma/movimiento, no como cura del parpadeo ni como trabajo paralelo al control temporal.

Para Gerstner, una formulación propia en metros reales es:

```text
θᵢ = kᵢ dot(dᵢ, q) − ωᵢ t + φᵢ       kᵢ = 2π / λᵢ
Pxy = q + Σ Qᵢ Aᵢ dᵢ cos(θᵢ)
Pz  = z₀ + Σ Aᵢ sin(θᵢ)
N   = normalize(cross(∂P/∂qx, ∂P/∂qy))
```

`Q=0` conserva senos verticales; aumentar Q concentra vértices en la cresta. Mantener `Σ Qᵢ kᵢ Aᵢ < 1` evita bucles en la formulación sin máscara. Para solo altura, la normal es proporcional a `(-∂h/∂x, -∂h/∂y, 1)`. Si una máscara atenúa ondas en la costa, sus derivadas también afectan la normal; alternativamente recalcular normales de la malla deformada. No reutilizar normales de la superficie plana ni sumar una segunda vez la misma pendiente vía bump. El método y sus límites se describen en el capítulo del implementador original. [Mark Finch, GPU Gems: Effective Water Simulation](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models).

### Si se ensaya Ocean

La API expone `geometry_mode`, `spatial_size`, `resolution`, `viewport_resolution`, `time`, `random_seed`, `wave_scale`, `wave_scale_min`, `wind_velocity`, `choppiness`, `depth`, `spectrum`, `use_normals` y `use_foam`. Mantener fijo `random_seed`; el tiempo continuo produce repetibilidad de estado, no un loop perfecto de cinco segundos. [OceanModifier, API 5.2](https://docs.blender.org/api/5.2/bpy.types.OceanModifier.html).

- **Dominio directo sobre la cuenca:** poner `spatial_size` en metros reales y `size=0.05` para convertir la extensión a unidades locales de 20 m. Por ejemplo, `spatial_size=64`, `size=0.05` corresponde a un dominio periódico de 3.2 unidades locales; el root 0.04 completa 1:500. El código evalúa UV usando `size × spatial_size`. No requiere cambiar `scene.unit_settings.scale_length` ni crear un conductor aparte. [Mapeo del dominio](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/source/blender/modifiers/intern/MOD_ocean.cc#L307).
- **Tiempo:** `t = t₀ + (frame − inicio) / fps`, continuo y sin redondear a enteros. Mantener las mismas condiciones a subcuadros para motion blur.
- **Forma y amplitud:** comenzar sin choppiness, espuma ni normal extra; Wind Velocity/Depth/Smallest Wave permanecen en metros y segundos reales. `size` no reduce la altura: convertir también `wave_scale` por 1/20. Como orden inicial, 0.003–0.006 locales representa 6–12 cm reales nominales; 0.05 sería aproximadamente 1 m real, no 5 cm. Ocean normaliza alturas respecto de un estado de referencia, por lo que medir el resultado y no interpretar Scale como altura pico a pico garantizada. [Normalización](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/source/blender/blenkernel/intern/ocean.cc#L703).
- **Cuenca:** Generate sustituye la malla completa. Displace recorre todos sus vértices y mueve fondo/paredes, pero conserva su conectividad. En esta cuenca de aproximadamente 80 m reales de profundidad, mover el fondo unos centímetros no es por sí mismo un problema visual ni obliga a usar otra malla. Comprobar solo costa, intersecciones y cierre; un conductor con transferencia selectiva se justifica si aparece allí un problema concreto. [Código del modificador](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/source/blender/modifiers/intern/MOD_ocean.cc#L420).
- **Repetición:** Ocean envuelve UV periódicamente; un dominio de 64 m puede cubrir una cuenca mayor mediante repetición espacial. No implica un salto en la unión, pero el patrón repetido puede reconocerse. No confundir repetición espacial con un loop temporal. [Evaluación UV](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/source/blender/blenkernel/intern/ocean.cc#L192).

**Resolución: el código despeja una ambigüedad del manual.** En 5.2 el lado de la grilla es `resolution × resolution`, no `2^resolution`. En Generate y sin repeticiones, r=12 produce 144² celdas; r=16, 256²; r=20, 400²; r=32, 1024². El número de vértices es `(r²+1)²`. Duplicar r multiplica aproximadamente por 16 los elementos de las grillas. Para el M2 de 16 GB, comparar 12/16 antes de aumentar; no introducir otra malla de millones de caras por defecto. La grilla existente 641² ya contiene 410 881 vértices en su tapa. [Generación de grilla](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/source/blender/modifiers/intern/MOD_ocean.cc#L219), [grillas de simulación](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/source/blender/blenkernel/intern/ocean.cc#L774).

## 4. Reflejos, follaje y DOF: qué aislar

Con roughness 0.035 y normales de alta frecuencia, destellos estrechos son una hipótesis plausible. Prueba propuesta: tras aprobar la geometría, comparar únicamente la capa capilar apagada/encendida; luego únicamente roughness 0.035 frente a una variante algo mayor. Si desaparece el problema, recuperar el mínimo detalle que siga estable. Esto cambia el aspecto, por lo que no debe adoptarse como filtro invisible ni confundirse con diagnóstico confirmado.

El filtro de píxel también importa: Blender indica que Blackman-Harris equilibra suavidad y detalle; reducir Width aumenta nitidez y elevarlo reduce aliasing a costa de suavidad. Registrar el filtro actual y evitar Box o una anchura extrema en el piloto. [Cycles Film](https://docs.blender.org/manual/en/latest/render/cycles/render_settings/film.html).

Para follaje RGBA, separar **hojas quietas + cámara quieta**, **hojas quietas + cámara móvil** y **viento + cámara móvil**. Hacer un A/B de DOF solo en la zona problemática. No modificar materiales del bosque, apertura y muestras simultáneamente. El contraste de cobertura de hojas pequeñas, bokeh y guías de denoising puede producir apariencias similares, pero requiere esta separación para atribuir una causa.

Intel exige beauty y guías con filtrado de píxel coherente; guías aliased pueden introducir artefactos en bordes. Las normales auxiliares deben estar antialiasadas y el prefiltrado de albedo/normal ruidosos mejora el uso final. Usar Denoising Albedo/Normal propios de Cycles; no reemplazarlos por una normal RGB de display o una captura de material. [OIDN: auxiliares y prefiltrado](https://www.openimagedenoise.org/documentation.html#rt).

## 5. Qué denoising temporal existe realmente

**OIDN de Cycles en este Mac no obtiene estabilidad temporal por activar Vector.** El filtro RT de Intel consume color y, opcionalmente, albedo y normal de una imagen; su API pública consultada no tiene entrada de historial o flujo. [Documentación OIDN](https://www.openimagedenoise.org/documentation.html#rt). La implementación GPU/Metal de Blender 5.2 conecta esos mismos buffers; la CPU tampoco consume cuadros previos. [OIDN GPU de Cycles](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/integrator/denoiser_oidn_gpu.cpp#L270), [OIDN CPU](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/integrator/denoiser_oidn.cpp).

La distinción con `bpy.ops.cycles.denoise_animation()` es importante:

- El operador procesa una secuencia EXR multilayer usando ajustes de la escena; si no se especifica salida puede sobrescribir los archivos de entrada. [Operador](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/blender/addon/operators.py#L30).
- Su pipeline carga Vector y la salida del cuadro anterior, y activa una bandera temporal a partir del segundo cuadro. Eso existe y no debe negarse. [Pipeline de animación](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/session/denoising.cpp#L209).
- La ruta que consulta esa bandera y conecta flow corresponde a OptiX. **No equivale a OIDN temporal en Metal**, y no se propone como solución en el M2. [Ruta OptiX](https://github.com/blender/blender/blob/d81557c1dc57d7b1f31a1d5a367d2f497c71540d/intern/cycles/integrator/denoiser_optix.cpp#L58).

Además, el manual indica que Vector queda desactivado al activar Motion Blur. No diseñar un flujo que dé por disponibles ambos sin verificar los canales del EXR. Los vectores son desplazamiento de geometría en pantalla: tampoco describen automáticamente el movimiento de un reflejo o un ruido animado sobre una superficie quieta. [Passes, Blender 5.2](https://docs.blender.org/manual/id/5.2/render/layers/passes.html).

No se recomienda comprar un denoiser ni implementar acumulación temporal casera para ocultar este defecto. Primero entregar una señal estable al OIDN existente. Comparar Noisy Image y su salida filtrada: si solo la segunda tiene manchas que cambian de forma, el tratamiento debe centrarse en denoising y guías; si el fenómeno ya está en el original, no atribuirlo exclusivamente a OIDN.

## 6. Controles antes de otro lote largo

Propuesta de diagnóstico escalonado, no un lote de todas las variantes. Usar como lista de decisiones: los controles equivalentes ya ejecutados no se repiten. Detenerse en el primer control que falle. Conservar motor, resolución, color, luces y semillas fijas salvo la variable indicada. Los recortes deben incluir margen para evitar que el borde altere el denoising.

| Control | Ensayo mínimo | Resultado que permite avanzar |
| --- | --- | --- |
| Repetibilidad | Renderizar dos veces el mismo cuadro y semilla, con todo congelado | Diferencia despreciable; si cambia, revisar estado/semillas/dependencias antes de animar |
| Material estático | Misma escena congelada en varios cuadros; sin bump, DOF ni blur; guardar noisy y denoised | Edificios y agua estable; separa render/denoiser de animación |
| Onda geométrica | Cámara fija, 12 cuadros consecutivos, solo geometría animada y normales suaves | Crestas progresan continuamente; no saltos de topología, normales o estado |
| Bump | El mismo tramo, agregar broad y luego capillary solo si broad pasa | Cada capa agrega detalle estable; si falla, corregir amplitud/frecuencia/filtrado de esa capa |
| Cámara y DOF | Geometría aprobada; agregar recorrido y luego DOF | No aparece shimmering en agua ni copas por el movimiento/foco |
| Convergencia | Solo el recorte que todavía falle: comparar N y 2N muestras con todo lo demás idéntico | Mejora clara del ruido y estabilidad; si no mejora, volver a material, movimiento o denoising |
| Aprobación temporal | 30 cuadros consecutivos a 1080p/30 fps con efectos finales | Reproducción limpia a velocidad real y al 100 %, con oleaje perceptible |
| Piloto de plano | 150 cuadros únicamente después del control anterior | Sin problemas que aparezcan por el recorrido completo o la evolución del oleaje |

El A/B N/2N debe fijar el muestreo efectivo: desactivar temporalmente adaptive sampling en ese recorte, o registrar el número de muestras alcanzado. Si ambos alcanzan el mismo umbral adaptativo antes del máximo, cambiar Max Samples no mide convergencia. Conservar el mismo patrón y semilla; después repetir con otra semilla para comprobar que el resultado favorable no depende de un patrón particular. No seleccionar el cuadro más limpio y extrapolarlo al plano.

Para no confundir movimiento legítimo con flicker, comparar cuadros iguales entre variantes. Las diferencias entre cuadros consecutivos de una toma aérea contienen desplazamiento real y no son por sí mismas una métrica de defecto. En controles congelados sí sirven diferencias de luminancia/imagen para detectar inestabilidad. En movimiento, mirar trayectorias continuas de crestas, reflejos y siluetas, además de la comparación noisy/denoised.

## Inspección bpy sin render

Fragmento de diagnóstico para ejecutar posteriormente en una copia abierta por el responsable de implementación; aquí no se ejecutó. Recorre grupos de nodos y solo imprime parámetros relevantes. No cambia la escena ni inicia un render.

```python
import bpy

def inspect_bumps(tree, seen=None):
    seen = set() if seen is None else seen
    if tree is None or tree.as_pointer() in seen:
        return
    seen.add(tree.as_pointer())
    for n in tree.nodes:
        if n.bl_idname == 'ShaderNodeBump':
            print(tree.name, n.name, {
                key: (n.inputs[key].default_value, n.inputs[key].is_linked)
                for key in ('Strength', 'Distance', 'Filter Width')
                if key in n.inputs
            })
        if n.type == 'GROUP':
            inspect_bumps(n.node_tree, seen)

for mat in bpy.data.materials:
    if mat.use_nodes:
        inspect_bumps(mat.node_tree)

for obj in bpy.context.scene.objects:
    for mod in obj.modifiers:
        if mod.type == 'OCEAN':
            keys = ('geometry_mode', 'resolution', 'viewport_resolution',
                    'spatial_size', 'size', 'time', 'random_seed',
                    'wave_scale', 'wave_scale_min', 'choppiness',
                    'wind_velocity', 'depth', 'spectrum', 'use_normals')
            print(obj.name, 'world_scale', tuple(obj.matrix_world.to_scale()),
                  {key: getattr(mod, key) for key in keys})
```

No se necesitan assets externos ni imágenes de referencia con permisos inciertos. Los recursos propios bastan para estas pruebas. Registrar cada futuro export visual en la carpeta habitual y el histórico del estudio antes de reutilizar rutas, conforme a AGENTS.md.
