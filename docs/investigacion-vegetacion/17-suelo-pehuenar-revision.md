# Suelo del pehuenar: revisión de referencias y escala

Revisión del 9 de noviembre de 2026, motivada por el rechazo del suelo de `pehuenar_06`: parecía césped uniforme, con una franja de tierra demasiado regular. Este documento separa evidencia de campo, lectura de fotografías y decisiones propuestas para el modelo. No se han modificado escenas ni texturas durante esta investigación.

## Qué ambiente estamos representando

La elección útil para la siguiente prueba es **un rodal abierto, relativamente seco, con mosaico de suelo mineral, tierra parda, vegetación baja y acumulaciones orgánicas locales**. «Sólo araucarias» se refiere a la especie arbórea; no exige eliminar hierbas, matas o arbustos bajos del suelo. Tampoco conviene combinar indiscriminadamente una ladera basáltica seca, un mallín húmedo y una pradera de césped continuo.

Hadad y Martínez Carretero estudiaron 120 relevamientos florísticos en Copahue, Caviahue, Rahue y Primeros Pinos. Diferencian bosques secos y húmedos. Entre los secos describen rodales sobre afloramientos aislados y laderas basálticas, con un estrato inferior escaso y variaciones asociadas a fuego y erosión hídrica. Esto respalda una superficie heterogénea, pero no proporciona un porcentaje universal de piedra, pasto o suelo desnudo. [Resumen original en el Boletín de la Sociedad Argentina de Botánica 44, suplemento, p. 110 (2009)](https://botanicaargentina.org.ar/wp-content/uploads/2017/07/Sab_suplemento-Huerta-Grande-_2009-1.pdf), [registro de CONICET](https://bicyt.conicet.gov.ar/fichas/produccion/7019880).

El documento institucional de Primeros Pinos describe afloramientos de distintas litologías, acumulación de finos y cenizas en valles a sotavento, y praderas húmedas localizadas ligadas al deshielo. Enumera vegetación baja como *Festuca scabriuscula*, *Baccharis magellanica* y *Berberis empetrifolia*. También señala pérdida de cobertura y erosión. **No todo material volcánico debe verse como bloques negros ni toda zona verde como pradera húmeda.** El PDF consultado se presenta como proyecto de protocolo: se utiliza su descripción ambiental, no para afirmar un estado jurídico actualizado. [Ministerio de Defensa / APN, Protocolo adicional 19, pp. 2–3](https://sib.gob.ar/archivos/Prot_19_RND_Primeros_Pinos.pdf).

La ficha del SIB sitúa la especie en sustratos arenosos y rocosos, generalmente volcánicos y bien drenados. Es un marco general de hábitat, no una receta de material ni una prueba de que todas las escenas deban ser áridas. [SIB, Administración de Parques Nacionales](https://sib.gob.ar/index.php/especies/araucaria-araucana).

## Qué muestran las fotos que ya tenemos

Estas observaciones son **interpretaciones visuales**, no mediciones ni inventarios. Las fotografías y sus licencias permanecen en [CREDITOS.md](imagenes/CREDITOS.md).

| Referencia local | Lectura útil para la escena | Precaución |
| --- | --- | --- |
| [08 · Batea Mahuida](imagenes/araucaria/08-atravesando-un-bosque-de-pehu-n-araucaria-arauca.jpg) | Tierra oscura expuesta; relieve transversal de raíces y pequeños escalones; matas fibrosas, hojas secas y vegetación baja que ocupan bordes discontinuos. La base de los troncos se integra con el sustrato. | El sendero de la fotografía es transitado: no copiar sus huellas como si fueran una vaguada natural. |
| [13 · Caviahue](imagenes/araucaria/13-caviahue-neuqu-n.jpg) | Suelo con mezcla verde, paja y gris; cubierta baja irregular; piedras parcialmente cubiertas; pequeñas elevaciones y depresiones. Las manchas tienen continuidad espacial. | Hay agua próxima. No extrapolar su humedad a toda una ladera seca. |
| [10 · La Angostura / Villa Pehuenia](imagenes/araucaria/10-villa-pehuenia-un-milenario-rbol-de-pehu-n-araucaria-arauca.jpg) | Contraste claro entre camino de grava mantenido y borde vegetal, con material orgánico y vegetación de alturas distintas. | La calle y los postes son intervención humana. Esta referencia sirve precisamente para distinguir una calle de un accidente natural. |

La escena rechazada se acerca visualmente al suelo de un parque: verde casi continuo, limpieza alrededor de los troncos y detalles pequeños sin relación fuerte con las manchas de material. La corrección debe cambiar esa organización, no añadir ruido uniforme encima.

## Diagnóstico de la implementación actual

Inspección de [`pehuenar_06/source/escena.py`](../../models/vegetacion_patagonica/pehuenar_06/source/escena.py), funciones `ground_material`, `terrain_z` y generación de matas:

1. **Se pierde información de la textura.** `grass_ground_color.jpg` se pasa como valor a una `ColorRamp` que lo sustituye por dos verdes. La luminancia lineal baja puede quedar por debajo del primer umbral y convertirse casi en un color único. La imagen original contiene mezcla de paja, tierra y verde que el material final atenúa.
2. **Se desaprovechan los canales PBR.** El material no conecta los mapas locales `grass_ground_height`, `grass_ground_normal` ni `grass_ground_roughness`; el relieve sombreado proviene sólo de un Noise fino. El escaneo aporta albedo, pero pierde su estructura correlacionada de normal y altura.
3. **La geometría es demasiado gruesa para el detalle pretendido.** El terreno representa 1000 m en 256 intervalos: aproximadamente **3,91 m por celda**. Es adecuado para la forma general; no puede representar bordes erosionados, raíces o montículos de pocos decímetros.
4. **Las unidades se mezclan.** A escala 1:250, una unidad local del terreno equivale a 25 m representados. El `Mapping` con factor 2,4 repite una textura cada **10,42 m representados**. No debe interpretarse como una textura de dos metros sin una conversión explícita.
5. **Las matas no son tan bajas como su nombre.** Una altura local de 0,025–0,075 equivale a **0,625–1,875 m representados**. Su distribución escasa y sus nueve triángulos acentúan la impresión de objetos sueltos en un plano.
6. **La franja clara es continua.** Una curva sinusoidal, ancho casi constante y borde difuminado producen lectura de camino. Un drenaje natural necesita cambios de sección, interrupciones, brazos secundarios y depósitos conectados con la pendiente.

Estos son cálculos del código y una evaluación visual; no son afirmaciones botánicas.

## Recursos disponibles: antes de buscar otra textura

Tenemos canales de color, normal, altura y rugosidad de `grass_ground`, `gravelly_sand` y `forest_ground_04` en [`models/textures/cycles_detail`](../../models/textures/cycles_detail/sources.json), y los de `rock_surface` en el [estudio de superficies](../../models/superficies_patagonicas/01_ladera/textures/sources.json). Sus registros indican Poly Haven / CC0. No hace falta descargar más para comprobar las hipótesis principales.

- **Grass ground:** conservar el contraste paja–verde–tierra y ajustar saturación/valor suavemente. Evitar convertir todo el albedo a una paleta binaria. Usarlo como base de textura, no como sustituto de matas volumétricas.
- **Gravelly sand:** útil para finos y grava, limitado por una máscara mineral. No convertirlo en una autopista clara que atraviesa toda la imagen.
- **Forest ground 04:** revisar visualmente los restos que incluye antes de aplicarlo. Una textura con hojas anchas reconocibles no debería dominar un rodal puro de araucaria. Puede aportar tierra oscura o estructura fina en mezcla; la hojarasca identificable debe ser propia del pehuén.
- **Rock surface:** suficiente para los bloques. Lo que falta es que el color, enterramiento y distribución coincidan con el sustrato vecino, no más resolución de textura.

## Propuesta concreta para Blender

Los rangos siguientes son **valores iniciales de arte para probar**, no medidas tomadas en un pehuenar ni estándares botánicos.

### Un sistema de unidades claro

Crear un espacio de textura expresado en metros representados. Para esta maqueta, un Empty de coordenadas con escala mundial 0,004 convierte coordenadas mundiales a metros del paisaje. Cada textura puede entonces declarar `tile_m`, y las máscaras y alturas dejan de depender de factores opacos.

Separar macrorelieve de relieve superficial. Conservar una malla ligera lejos de cámara y añadir un parche de primer plano más subdividido, sin grietas en la unión. Objetivo de prueba: desplazamientos superficiales de 3–15 cm representados y montículos locales de 15–45 cm, con continuidad de pendientes. No aplicar una onda periódica a toda la superficie.

### Máscaras compartidas, con causas

Usar una misma máscara semántica para controlar material, desplazamiento y distribución de instancias:

- **Bajo las copas y junto al pie:** mezcla de tierra y restos orgánicos, fragmentada por ruido y por la forma de la copa. Evitar círculos oscuros perfectos alrededor de cada tronco.
- **Entre matas:** tierra mineral o compactada con finos, pequeños fragmentos y restos secos.
- **Afloramientos:** grupos ligados a cambios de pendiente; bloques grandes acompañados por fragmentos menores próximos, no idéntica densidad de piedras en todos los lugares.
- **Depresiones:** más finos y una tonalidad moderadamente distinta. No añadir agua ni verde intenso automáticamente: una depresión puede estar seca.

### Geometría que se lea a escala de miniatura

Probar matas irregulares de 12–50 cm representados, con hojas largas curvadas y mezcla paja/verde en cada mata; agruparlas en parches y dejar suelo visible entre grupos. Variar diámetro, altura e inclinación de manera correlacionada. No es necesario resolver cada hoja en el fondo.

Como punto de partida artístico, usar fragmentos de 2–15 cm, piedras de 15–40 cm y unos pocos bloques de 0,5–1,5 m. Reservar afloramientos mayores para lugares de composición específicos. Enterrar parte de la piedra y permitir acumulación de tierra/vegetación a sotavento; no plantar cubos enteros sobre el plano.

Añadir restos orgánicos reconocibles cerca de árboles: pequeñas ramillas, segmentos secos cubiertos de escamas y fragmentos de corteza. No llenar todo el suelo con hojas planas de especie genérica. El patrón debe relacionarse con copas, terreno y acumulación local.

### Si se conserva una vaguada

Elegir entre vaguada natural y sendero: son formas distintas. Para una vaguada seca, variar sección y dirección a varias escalas, añadir brazos cortos que converjan cuesta abajo, estrechamientos y depósitos discontinuos. La vegetación invade algunos bordes y desaparece en otros. El color por sí solo no debe definirla: necesita un perfil geométrico reconocible en el acercamiento.

## Prueba de aceptación visual

Antes de repetir el bosque completo, hacer un parche con suelo, pie de un árbol, un grupo de matas y dos tamaños de piedra, con cámara y luz fijas. Revisarlo nítido primero, y luego con profundidad de campo.

- A tamaño pequeño se deben distinguir tierra, vegetación y mineral por su organización, sin necesitar contornos exagerados.
- En acercamiento, color y normal deben coincidir en la misma estructura; no debe parecer una tela ni una alfombra teñida.
- Un árbol debe apoyarse e integrarse en el suelo, sin halo negro perfecto ni separación visible.
- La escala de piedras y matas debe compararse con el diámetro del tronco, no con un valor local sin convertir.
- Los detalles deben concentrarse en lugares plausibles, dejando áreas tranquilas. Más objetos por sí solos no cuentan como una mejora.

La revisión sigue siendo artística e informada por referencias: no hay datos suficientes para afirmar una densidad de matas, profundidad de hojarasca o granulometría exactas de un sitio determinado.
