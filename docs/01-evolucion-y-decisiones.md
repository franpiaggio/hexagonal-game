# 01 · Evolución y decisiones

[Inicio](../README.md) · [Resultado final →](02-resultado-final.md)

## Punto de partida

El encargo comenzó con un set base de piezas que encajaran como en Dorfromantik, destinadas a un proyecto web en Three.js. La temática sería patagónica / alpina y la vista elevada, cercana a la isométrica. Se eligió **verano patagónico**, con verdes apagados, madera cálida y nieve donde correspondiera a las cumbres.

El [documento de referencia original](referencias/dorfromantik-estilo-visual.md) describía la composición rural, las piezas hexagonales y la lectura de miniatura. La imagen de casas alpinas y montañas era ilustrativa. Las indicaciones posteriores del usuario definieron una evolución propia: más realismo en proporciones, vegetación y materiales, con sensación de miniatura fotografiada.

## Pasos logrados

| Paso | Pedido o aprendizaje | Resultado conservado |
| --- | --- | --- |
| 1. Kit modular | Crear una estética inicial y piezas compatibles para la web | Siete GLB: pradera, bosque, caserío, montaña, río recto, río curvo y laguna; más un paisaje de demostración. |
| 2. Miniatura más natural | Evitar árboles de copas poligonales evidentes; mejorar materiales y proporciones | Follaje con recorte alfa, texturas, puertas y casas dimensionadas, proporción entre árboles y edificios. Editable `patagonia_miniatura.blend`. |
| 3. Efecto de cámara | Hacer visible la sensación de maqueta | Escala física de presentación, foco y profundidad de campo en Blender; comparativas con y sin desenfoque. |
| 4. Diez estudios | Explorar lago, bosque, pueblo y río | Primera serie de diez composiciones en `previews/serie_10/`. |
| 5. Más detalle con Blender | Explorar el potencial del motor de render | Estudio Cycles con tres cámaras, superficies escaneadas, vegetación detallada, arquitectura y detalles del suelo. |
| 6. Quitar el borde | Hacer que el paisaje continuara fuera de cámara | Tres vistas sin perímetro visible, verificadas mediante rayos de cámara y margen de encuadre. |
| 7. Abrir el paisaje | Más bosque y más variedad de poblados | Diez panoramas de 3840 × 2560, con edificios y árboles compartiendo geometría entre instancias. |
| 8. Presentación breve | Mostrar cómo se construye el mundo con movimiento suave | Animación de 12 s / 30 fps, aparición progresiva de terreno, bosque y poblado, movimiento de cámara y curvas quínticas. |
| 9. Recuperar el pueblo pequeño | Los poblados densos parecían barrios y se alejaban de la intención | Revisión a 15 edificios, caminos rurales curvos, cámara más abierta a 43° y desenfoque más marcado; imagen y video corregidos. |
| 10. Resolver el lago | El agua se percibía como un charco | Cuenca profunda, costa irregular, volumen cerrado de agua, refracción, absorción, ondulación y reflejos de cielo. |
| 11. Elegir la referencia | El usuario señaló que `estudio_ondas.png` había sido el mejor | Se conservó un `.blend` específico y un registro de selección; esa imagen pasó a ser la referencia estética vigente. |
| 12. Nueva colección | Crear variantes siguiendo los últimos ajustes | Diez escenas nuevas en 2048 × 1152, con 5–12 edificios, bosques dominantes, lagos o ríos, sin bordes visibles y con efecto miniatura. |

El pedido inicial de conectar Blender y crear una esfera fue una prueba de arranque, no un entregable de la colección. La reproducción documentada depende de los archivos y de Blender en modo background; no requiere una conexión MCP activa.

## Correcciones que fijaron el rumbo

### El bosque debía ganar presencia sin convertir el pueblo en un barrio

Los panoramas densos exploraban una mayor cantidad de construcciones; la escena del primer video tenía 62. El usuario prefirió recuperar la escala íntima de un caserío. La revisión intermedia bajó a 15 edificios; la colección final contiene entre 5 y 12 por escena.

Se mantuvieron los bosques extensos y la variedad arquitectónica. Los edificios finales se ubicaron individualmente, con caminos curvos, separaciones y orientaciones variadas. La densidad visual proviene principalmente de la naturaleza.

### El lago debía sentirse grande

La corrección no consistió solo en cambiar el color. Se trabajaron la forma de la costa, la profundidad del lecho, la continuidad del agua fuera del encuadre y la respuesta a la luz. La referencia elegida combina agua azul grisácea, ondas contenidas y reflejos suaves.

Durante la nueva colección, los ríos poco profundos se veían demasiado grises. Se oscureció su lecho mineral sumergido, conservando el material y la iluminación del agua. Se volvieron a revisar los borradores afectados antes del render final.

### El desenfoque debía reforzar la miniatura

Se ajustaron conjuntamente escala, distancia de cámara, focal, apertura y punto de enfoque. La colección usa una cámara en perspectiva de 105 mm, elevación de 43–44° y apertura f/1.5. El pueblo permanece legible mientras el primer plano y el fondo pierden nitidez.

En el proyecto se llamó “tilt-shift” a este aspecto visual. La implementación final es profundidad de campo óptica de Cycles sobre una escena a escala de miniatura; no incorpora un mecanismo de inclinación física del plano de la lente.

## Qué versión tiene prioridad

1. **Colección final:** [las diez variantes nuevas](../models/previews/coleccion_ondas_10/galeria.html).
2. **Referencia estética:** [estudio_ondas.png](../models/previews/pueblo_lago/estudio_ondas.png), seleccionada explícitamente por el usuario.
3. **Editable de esa referencia:** [patagonia_pueblo_lago_elegido.blend](../models/estudios/patagonia_pueblo_lago_elegido.blend).
4. **Histórico:** las restantes pruebas, panoramas y videos explican la evolución.

El [registro de selección](../models/previews/pueblo_lago/seleccion.json) declara que `estudio_ondas.png` tiene prioridad estética sobre `previews/pueblo_lago/puerto_del_bosque.png`, aunque este último sea una salida de mayor resolución. “Más reciente” o “más grande” no identifica por sí solo la versión elegida.

El video corregido utiliza la revisión de pueblo pequeño anterior al lago elegido. No existe una nueva animación de la colección final de diez escenas; esa entrega contiene imágenes fijas y escenas editables.
