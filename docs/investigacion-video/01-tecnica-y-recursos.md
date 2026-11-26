# Técnica y recursos para animar las cinco miniaturas

Investigación: 5 de noviembre de 2026. Fuentes primarias: manual y notas de versión oficiales de Blender, priorizando 5.2 LTS. Este documento propone pruebas y recetas; no se ejecutaron Blender ni renders. Los valores de partida son recomendaciones para este proyecto, no resultados medidos ni presets oficiales.

## Punto de partida y decisión que debe resolver el piloto

Según el inventario del estudio: Blender 5.2 en M2 Pro de 16 GB; cinco escenas terminadas; cámaras de perspectiva de 105 mm, sensor de 36 mm y f/2.5–3.6; escala de miniatura 1:500; nueve originales de árboles compartidos por cientos de instancias, con hojas RGBA. El agua ya tiene una cuenca cerrada, grilla de 641 × 641, relieve y bump de dos escalas, absorción volumétrica 19 y HDR seleccionado mediante Light Path.

La propuesta técnica es conservar esa imagen y sumar tres movimientos contenidos: ondas superficiales, viento leve y humo localizado. Cycles sigue siendo la referencia de fidelidad. EEVEE se evalúa en una copia como benchmark de tiempo y apariencia; la investigación no decide sustituir el motor.

25 segundos a 30 fps requieren 750 cuadros; cada plano de 5 segundos, 150. Extrapolar los stills actuales de 40–90 s/cuadro da **8 h 20 min–18 h 45 min** para 750 cuadros, o **1 h 40 min–3 h 45 min por plano**, antes de cambios de calidad, humo, animación, arranques y codificación. Es aritmética sobre la referencia disponible, no una predicción del render animado.

## 1. Muestreo y estabilidad temporal en Cycles

El manual recomienda *Use Animated Seed* porque cambia el patrón de ruido por cuadro y puede hacerlo menos perceptible. También explica que bajar el umbral adaptativo aumenta calidad y tiempo; OpenImageDenoise admite Albedo y Normal, y su prefiltrado Accurate conserva más detalle que Fast. Nada de eso certifica estabilidad temporal para estos árboles y reflejos. [Sampling, Blender 5.2](https://docs.blender.org/manual/ar/5.2/render/cycles/render_settings/sampling.html).

**Aplicación al estudio:** mantener como baseline la semilla fija que funcionó en la prueba anterior y compararla con semilla animada, usando exactamente el mismo recorrido. No reemplazar evidencia local por la recomendación general del manual. Separar esta semilla de las semillas de distribución, viento y materiales: estas últimas deben permanecer deterministas.

Propuesta de prueba, cambiando una variable por vez:

| Variable | Punto de partida | Qué decide si se conserva |
| --- | --- | --- |
| Samples | 32 actuales frente a 64; probar 128 solo si queda un problema visible | Hojas finas, sombras, brillo del agua y humo dejan de fluctuar sin desaparecer sus detalles |
| Adaptive sampling | Umbral 0.01 como candidato, mínimo 16–32; mantener idénticos valores en el A/B de semilla | El tiempo ahorrado no produce variación visible; son valores para medir, no garantía |
| Denoising | OIDN, Albedo + Normal, Accurate, calidad High | No hay manchas que cambien de forma entre cuadros ni pérdida de copas pequeñas |
| Semilla | Fija probada / animada | Reproducción a 30 fps y recortes al 100 %, no elección por el cuadro más limpio |
| Time Limit | Sin límite de tiempo por cuadro durante la comparación | Misma condición de calidad para todos los casos |

El nodo Denoise recibe imagen, albedo y normal; esos pases ayudan a preservar bordes y detalle. Guardar una pequeña secuencia de diagnóstico con Noisy Image y Denoising Data permite distinguir ruido del trazado y cambios introducidos al denoisar. No tratar el Denoise normal como una solución temporal garantizada: su documentación describe procesamiento de imágenes y no establece esa garantía. [Denoise, Blender 5.2](https://docs.blender.org/manual/id/5.2/compositing/types/filter/denoise.html).

Metal y el denoising por GPU están soportados en Apple Silicon; verificar que cada escena use GPU Compute además de seleccionar Metal en preferencias. No proponer OptiX para esta máquina. [GPU Rendering, manual 5.2](https://docs.blender.org/manual/ka/latest/render/cycles/gpu_rendering.html).

Persistent Data puede ahorrar preparación entre cuadros a costa de memoria adicional. Medirlo con varios cuadros de un mismo proceso y vigilar el pico de memoria; no extrapolar desde renders lanzados en procesos independientes. En 16 GB, conservarlo solo si realmente mejora el tiempo sin presión de memoria. [Performance, Blender 5.2](https://docs.blender.org/manual/sl/5.2/render/cycles/render_settings/performance.html).

## 2. Motion blur y foco

El shutter de Cycles se expresa en cuadros. Para estas cámaras de perspectiva, probar un shutter centrado de **0.3–0.5 cuadros**: a 30 fps, 0.5 equivale a una exposición de 1/60 s. Es una elección estética inicial; el movimiento lento debe seguir siendo agradable sin depender de un desenfoque fuerte. La limitación documentada de motion blur de cámara ortográfica no afecta las cámaras actuales, pero importa si se cambia la proyección. [Motion Blur de Cycles, Blender 5.2](https://docs.blender.org/manual/nl/5.2/render/cycles/render_settings/motion_blur.html).

Mantener lente, apertura y tratamiento de color de cada still durante el primer piloto. Mover la cámara y el punto de interés de manera continua, con foco explícito sobre el conjunto protagonista. Un cambio accidental de foco puede parecer un problema de denoising. No presuponer que activar motion blur corrige el parpadeo de un shader animado: comprobar agua y humo a su velocidad final.

Para deformación de árboles, mantener topología constante. Cycles advierte que los modificadores que cambian la topología no pueden producir deformation motion blur correcto; más pasos también consumen más memoria. [Object Motion Blur, manual 5.0](https://docs.blender.org/manual/en/5.0/render/cycles/object_settings/object_data.html).

EEVEE combina acumulación en varios instantes y desenfoque posterior. Cada paso adicional reevalúa la escena y puede tener un costo alto; también reparte las muestras entre pasos y puede empeorar el DOF si no se aumenta el muestreo. Empezar con pocos pasos y juzgar en el render final: el viewport usa un algoritmo más simple. [Motion Blur de EEVEE, Blender 5.2](https://docs.blender.org/manual/nl/5.2/render/eevee/render_settings/motion_blur.html).

## 3. Agua: animar lo que ya funciona

Blender 5.2 incorporó un nodo de tiempo al shader, con el comportamiento del nodo de Geometry Nodes. Permite controlar movimiento procedural sin introducir simulación o secuencias de texturas externas. [Notas de render de Blender 5.2](https://developer.blender.org/docs/release_notes/5.2/rendering/).

**Receta propuesta:** conservar la cuenca cerrada, el relieve grueso, la absorción y la composición material que ya dan profundidad. Animar primero las coordenadas del bump capilar con una traslación lenta y continua; mantener una segunda capa de ondas más ancha con dirección y velocidad distintas. Si se usa Wave Texture, su Phase Offset controla la posición de la onda; sumar dos bandas poco contrastadas evita que toda el agua parezca una cinta uniforme. [Wave Texture, Blender 5.2](https://docs.blender.org/manual/id/5.2/render/shader_nodes/textures/wave.html).

Noise 4D permite variar W además de XYZ. Es útil para una evolución interna leve, pero el manual advierte que más dimensiones aumentan el costo. Preferir traslación de ruido 3D para el movimiento principal y reservar 4D para una variación secundaria de poca amplitud. [Noise Texture, Blender 5.2](https://docs.blender.org/manual/sl/5.2/render/shader_nodes/textures/noise.html).

Criterios artísticos y técnicos propuestos:

- Un lago debe conservar su orilla y su volumen; mover un patrón de normales no obliga a recalcular los 641² vértices por cuadro.
- Evitar ondas que recorran toda la laguna en un segundo. Deben leerse por cambios suaves del reflejo, no por desplazamiento rápido del patrón.
- Bump no cambia la silueta ni produce oleaje, espuma o interacción con la costa. Si una toma exige eso, animar solo una deformación geométrica baja y de topología fija; queda fuera del primer piloto.
- Si aparecen destellos que se encienden y apagan, probar primero menor amplitud/frecuencia del detalle capilar y revisar el reflejo en movimiento; después decidir si necesita más muestras. El denoising no debe borrar las ondas para ocultar el problema.

**Riesgo concreto al pasar a EEVEE:** Light Path no representa los rayos igual que Cycles. Is Reflection/Transmission no tienen equivalencia completa y el comportamiento de Is Glossy está ligado a sondas, no a los reflejos de pantalla. El HDR actual debe comprobarse material por material; cambiar solo el motor no constituye una comparación fiel. [Supported Nodes, Blender 5.2](https://docs.blender.org/manual/en/5.2/render/eevee/limitations/nodes_support.html).

## 4. Viento sin multiplicar millones de triángulos

Las instancias comparten geometría y almacenan transformaciones; el atributo id ayuda a resolver su motion blur. Convertirlas en geometría real consume más memoria y obliga a procesar por separado lo que antes se procesaba una sola vez. [Instances, Blender 5.2](https://docs.blender.org/manual/nl/5.2/modeling/geometry_nodes/instances.html). Realize Instances puede degradar mucho el rendimiento con numerosas copias de geometría compleja. [Realize Instances, Blender 5.2](https://docs.blender.org/manual/en/5.2/modeling/geometry_nodes/instances/realize_instances.html).

**Dos niveles propuestos:**

1. Fondo y arboledas: balanceo casi imperceptible por transformación de instancia, pivote en la base del tronco, amplitud inicial de 0.2–0.8° y ciclos lentos de 3–6 s. Dar fases deterministas distintas a grupos de árboles y una dirección común de viento. Rotate Instances admite pivote y espacio local. [Rotate Instances, Blender 5.2](https://docs.blender.org/manual/es/5.2/modeling/geometry_nodes/instances/rotate_instances.html).
2. Árboles protagonistas: si la rotación rígida se nota, deformar la copa de un original evaluado con peso cero en la raíz y creciente hacia arriba, y luego instanciar ese resultado. Solo añadir unos pocos originales con fases distintas cuando la sincronía resulte visible. Conservar los originales compartidos dentro de cada grupo; no asumir que añadir un modificador diferente a cada objeto conservará la misma economía de geometría.

Los rangos de ángulo y tiempo son decisiones de puesta en escena para medir. El primer nivel no flexiona ramas: sirve cuando la amplitud y la distancia hacen aceptable la aproximación. No animar semillas de distribución, número de árboles, topología o selección aleatoria por cuadro. No realizar todas las instancias para tener viento individual.

## 5. Humo de chimenea procedural, sin simulación pesada

Un volumen puede definirse dentro de una malla cerrada: se elimina el shader de superficie, se conecta uno volumétrico y una textura determina la densidad. La malla debe ser manifold, con normales hacia afuera. [Material Volumes, Blender 5.2](https://docs.blender.org/manual/de/5.2/render/materials/components/volume.html). Principled Volume reúne absorción y dispersión y permite controlar densidad y anisotropía. [Principled Volume, Blender 5.2](https://docs.blender.org/manual/id/5.2/render/shader_nodes/shader/volume_principled.html).

**Receta propuesta:** una envolvente pequeña por chimenea, que comienza apenas dentro de la boca y se ensancha hacia arriba. Multiplicar un ruido suave por una máscara radial y otra vertical, ambas con caída gradual hasta densidad cero antes del borde de la envolvente. Trasladar las coordenadas del ruido hacia arriba y ligeramente a sotavento; usar una evolución 4D lenta únicamente si el patrón se reconoce como una textura deslizándose. Color gris apenas cálido, emisión y blackbody en cero; humo discontinuo y tenue que deje ver la casa detrás.

Calibrar densidad por el grosor visible de la columna a escala de miniatura, sin copiar el valor 19 de absorción del agua. Evitar una caja que abarque toda la escena: el efecto debe ocupar solo el espacio necesario sobre la chimenea. Este procedimiento no calcula flotabilidad, turbulencia real, colisiones ni acumulación; es una aproximación dirigida para una columna pequeña en un plano de cinco segundos.

En EEVEE, la calidad volumétrica depende de texturas 3D y de Resolution/Steps, con costo de memoria. Restringir el rango de profundidad puede concentrar las muestras donde está el humo. [Volumes de EEVEE, Blender 5.2](https://docs.blender.org/manual/en/5.2/render/eevee/render_settings/volumes.html).

## 6. Benchmark EEVEE: fidelidad antes de extrapolar velocidad

5.2 mejoró la gestión de instancias en EEVEE y reporta hasta el doble de velocidad en escenas limitadas por CPU; no es una promesa para este M2 ni para escenas limitadas por volumen/DOF. También cambió el trazado en pantalla y la conservación de energía: escenas antiguas pueden verse más oscuras. Registrar la versión exacta y conservar la referencia Cycles. [EEVEE 5.2: notas oficiales](https://developer.blender.org/docs/release_notes/5.2/eevee/).

Comparar el mismo plano, cámara, resolución final, HDR, luces, exposición, apertura y animación. Registrar por separado cualquier adaptación necesaria de materiales o sondas para saber qué costo visual tiene la aceleración.

| Zona de evaluación | Problema que hay que buscar |
| --- | --- |
| Agua | Cambio de HDR/reflejo, pérdida de profundidad o de absorción, reflejos que desaparecen junto al borde de pantalla |
| Follaje RGBA | Halo en DOF, parpadeo de transparencias, pérdida de hojas finas, sombras que cambian de densidad |
| Casas y terreno | Pérdida de contacto, fuga de luz en esquinas, cambio del rebote cálido bajo aleros |
| Humo | Escalones o pulsación de densidad, discontinuidad al entrar/salir del encuadre |
| Movimiento | Estelas, detalle que cambia al moverse y saltos en reflejos, aunque un still aislado resulte limpio |

Límites documentados relevantes: EEVEE usa información de profundidad de pantalla para varios efectos; no conoce superficies ocultas ni fuera del encuadre. Solo modela correctamente un evento de refracción. Sus volúmenes no aparecen en reflejos/refracciones ni proyectan sombra sobre sólidos. Los materiales Blended pueden fallar con DOF de posproceso; el método basado en muestras evita esa limitación, con otro costo de muestreo. [Limitations, Blender 5.2](https://docs.blender.org/manual/th/5.2/render/eevee/limitations/limitations.html).

La acumulación temporal del ray tracing de EEVEE reproyecta resultados previos y puede reducir ruido, pero introduce sesgo de color; su filtrado puede suavizar de más. El ajuste Thickness también intercambia intersecciones perdidas por reflejos estirados y parpadeo. No activarlos como una solución automática. [Raytracing, Blender 5.2](https://docs.blender.org/manual/id/5.2/render/eevee/render_settings/raytracing.html).

Protocolo mínimo propuesto:

1. Elegir un plano que reúna agua, follaje y casa; agregar el humo y el viento en intensidad final.
2. Comprobar tres posiciones de cámara y después **30–60 cuadros consecutivos** del tramo con más movimiento, a 1920 × 1080 y 30 fps. Resolución reducida sirve para composición, pero no aprueba hojas, DOF o agua fina.
3. En Cycles, resolver primero semilla fija/animada y muestreo. En EEVEE, registrar tiempo, memoria y diferencias de las cinco zonas anteriores.
4. Elegir ajustes por reproducción a velocidad real y recortes al 100 %. Entonces renderizar un plano completo de 150 cuadros como piloto; solo después extrapolar los otros cuatro.
5. Guardar los futuros renders en la carpeta habitual del estudio y registrarlos en el histórico mediante `python3 pruebas_de_concepto/archivar.py --archivo RUTA`, antes de reutilizar una ruta, según AGENTS.md.

## Recursos suficientes

Las escenas, árboles, casas, agua, materiales y HDR ya disponibles son suficientes para el piloto. Los nuevos recursos son grupos de nodos y controles de animación propios: tiempo común, ondas, viento y densidad de humo. No hace falta descargar assets, contratar librerías ni incorporar nuevas licencias para este enfoque.

La decisión pendiente es empírica: cuánto movimiento y muestreo necesitan estas composiciones concretas, y si el ahorro de EEVEE compensa sus diferencias. La documentación permite anticipar dónde mirar; no sustituye esa prueba temporal.
