# Piedras y suelo: fuentes y criterios para la próxima iteración

Investigación: **4 de noviembre de 2026**. Alcance: escenas de Blender de verano patagónico, vistas desde arriba como miniaturas. Este documento reúne referencias y propone criterios; no registra una corrección ya implementada. La auditoría del `.blend` y las comparaciones de render se documentan por separado en esta carpeta.

La prioridad propuesta es **corregir la forma, la escala y la relación entre superficies antes de aumentar la resolución de las texturas**. Una roca necesita apoyarse y romper el terreno de forma convincente; el piso necesita distinguir bosque, claro, camino y costa. Los detalles diminutos vienen después.

## 1. Qué está respaldado por fuentes

### No existe una única superficie «patagónica»

**Hecho.** Nahuel Huapi incluye Bosques Patagónicos, Estepa Patagónica y Altos Andes. La vegetación cambia entre sectores húmedos, bosque oriental y transición a estepa; las costas naturales incluyen vegetación, rocas y troncos. Esto impide usar un mismo suelo verde para todos los ambientes. [APN: ficha de Nahuel Huapi](https://www.argentina.gob.ar/parquesnacionales/regionpatagonia/parque-nacional-nahuel-huapi/ficha-del-area-protegida).

**Hecho.** La Hoja Geológica de San Carlos de Bariloche describe rocas metamórficas, granitoides, conjuntos volcánicos y sedimentarios, además de un paisaje cordillerano marcado por la glaciación pleistocena. Hacia el este aparecen otras formas, incluidas terrazas de grava y planicies basálticas. No hay fundamento para declarar que todas las piedras del proyecto deban ser de granito, basalto o una misma tonalidad. [SEGEMAR: Hoja Geológica 4172-IV](https://repositorio.segemar.gov.ar/handle/308849217/174?show=full).

**Inferencia para el proyecto.** Cada escena necesita una familia de formas coherente con su emplazamiento: afloramiento fracturado en una ladera; fragmentos a su pie; playa de grava o guijarros junto al agua. Podemos combinar estas situaciones, pero deben tener una transición espacial. La litología exacta requiere fijar una localización y consultar su unidad geológica; aquí no se asigna una.

### La cobertura del suelo es una estructura, no sólo un color

**Hecho.** La red MARAS del INTA evalúa, entre otras variables, la cobertura vegetal y el tamaño y estabilidad de las áreas de suelo desnudo. Trabaja sobre ambientes áridos y semiáridos; sus porcentajes no se deben trasladar automáticamente a un bosque húmedo o a una costa lacustre. [INTA: monitoreo de pastizales patagónicos](https://www.argentina.gob.ar/noticias/maras-un-portal-para-seguir-de-cerca-el-estado-de-los-pastizales-en-patagonia).

**Inferencia para el proyecto.** La máscara que distribuye pasto, suelo y grava tiene tanto peso visual como los mapas PBR. Conviene construir parches reconocibles asociados a sombra, pendiente, humedad y tránsito, en lugar de distribuir el mismo ruido por toda la escena. La referencia fotográfica debe decidir su tamaño y continuidad.

### Bump y geometría resuelven problemas diferentes

**Hecho técnico.** El bump cambia el sombreado, pero no la superficie real de la malla. Blender advierte que un bump que intenta separarse demasiado de la forma geométrica puede producir artefactos. El displacement real requiere subdivisión suficiente; se puede combinar con bump para reservar la geometría al relieve mayor y el sombreado a detalles finos. [Blender Manual: Displacement](https://docs.blender.org/manual/en/latest/render/materials/components/displacement.html).

**Inferencia para el proyecto.** Aumentar el bump no resolverá una silueta redonda, una base que parece flotar o un borde de camino perfectamente plano. Las fracturas principales, cambios de plano y contactos deben existir en la forma. La arena, poros y rugosidad fina pueden permanecer en el material.

**Hecho técnico.** Las coordenadas `Generated` recorren de 0 a 1 la caja del objeto sin deformar. Por lo tanto, una frecuencia procedural basada en ellas expresa una proporción del objeto, no una distancia física constante. [Blender Manual: Texture Coordinate](https://docs.blender.org/manual/en/latest/render/shader_nodes/input/texture_coordinate.html).

**Inferencia para el proyecto.** Dos rocas escaladas de manera distinta no deberían ampliar sus granos minerales en la misma proporción. Hay que declarar una convención de metros, comprobar transformaciones y calibrar por separado la forma general, las fracturas y el material superficial.

## 2. Referencias visuales cercanas al resultado buscado

Las dos fotografías siguientes ya estaban en el archivo de investigación del proyecto. Se inspeccionaron como referencias de forma y contacto; no se descargaron imágenes nuevas para este documento. Créditos conservados en [creditos.json](/Users/franciscopiaggio/localwork/hexagonal-game/docs/investigacion-vegetacion/imagenes/creditos.json).

| Referencia original | Qué observar en la imagen | Traducción propuesta a la miniatura |
| --- | --- | --- |
| [Capilla Villa Mascardi, Jmmuguerza](https://commons.wikimedia.org/wiki/File:Capilla_Villa_Mascardi.jpg), CC BY-SA 4.0. [Foto local](/Users/franciscopiaggio/localwork/hexagonal-game/docs/investigacion-vegetacion/imagenes/paisaje/18-capilla-villa-mascardi.jpg). | En el talud se ven caras de roca angulares, tierra expuesta entre ellas y vegetación en matas. El suelo tiene espesor y un corte reconocible. Son observaciones visuales, no una identificación geológica. | Usar un pequeño talud cerca de una capilla o camino como prueba: roca parcialmente enterrada, bolsas de tierra y pasto sobre el borde. No identificar ni replicar todas las especies de la foto sin verificación. |
| [Lago Lolog, Inaragon](https://commons.wikimedia.org/wiki/File:Lago_Lolog.jpg), CC BY-SA 3.0; fotografía de enero de 2017. [Foto local](/Users/franciscopiaggio/localwork/hexagonal-game/docs/investigacion-vegetacion/imagenes/paisaje/04-lago-lolog.jpg). | La costa se lee como una superficie continua de piedras de tamaños diferentes, muchas redondeadas; cerca del agua hay una banda más oscura. | Separar lecho de guijarros, piedras mayores puntuales y transición mojada. Evitar una hilera de rocas idénticas sobre césped. |

Estas imágenes documentan dos casos locales distintos. No prueban que toda costa patagónica sea de guijarros ni que todo terreno tenga el afloramiento de Mascardi.

## 3. Recursos originales para pruebas controladas

Tres candidatos concretos permiten probar forma y material sin inventar todo desde cero. Las dimensiones son las publicadas por el autor/distribuidor; no son una recomendación de escalar todos los objetos a ese tamaño. Ninguno se presenta aquí como captura realizada en Patagonia.

| Recurso y autor | Tipo, escala y licencia | Uso propuesto y límite |
| --- | --- | --- |
| [Boulder 01 — Rico Cilliers](https://polyhaven.com/a/boulder_01) | Modelo 3D con mapas PBR; **1,8 m de ancho**, aproximadamente **124 mil triángulos**, opciones de LOD; **CC0**. | Un único bloque como control visual frente a la roca procedural. Revisar sus vistas de arcilla y ortográficas: la forma debe funcionar sin color. Su malla de máxima calidad no debe multiplicarse indiscriminadamente por el campo. |
| [Rock Surface — Amal Kumar](https://polyhaven.com/a/rock_surface) | Material de roca; **2 m de ancho**; color, roughness, normal y displacement; **CC0**. | Probar grano y variación superficial sobre una forma ya resuelta. La página incluye fotos `context_01` y `context_04` útiles para comparar mapa y superficie real. Su color marrón no define la geología regional. |
| [Forest Ground 04 — Rob Tuytel; ajuste de Rico Cilliers](https://polyhaven.com/a/forest_ground_04) | Suelo fotografiado y procesado, con tierra seca y piedras; **3,2 m** en la ficha redondeada, aproximadamente **3,15 m** en [metadatos originales](https://api.polyhaven.com/info/forest_ground_04); **CC0**. | Ya existe en el proyecto. Primero comprobar sus mapas y mezcla real. Reservarlo para suelo expuesto apropiado, no convertirlo en el único piso de bosque, pradera y costa. |

Poly Haven identifica estos recursos como obras originales de sus colaboradores y publica los assets bajo CC0, permitiendo también su redistribución. Los renders de ejemplo del sitio tienen un régimen diferente: este documento enlaza sus páginas, no redistribuye esas imágenes. [Licencia original de Poly Haven](https://polyhaven.com/license).

**Límite de lo verificado:** se comprobaron autoría, mapas, escala y licencia de los tres recursos. La ficha de Forest Ground 04 explicita fotografía y procesamiento; las otras fichas consultadas no detallan su método de captura. No se presupone una técnica de escaneo específica ni procedencia geográfica. Antes de importar, registrar la versión efectivamente descargada y sus transformaciones.

**Decisión de producción propuesta:** empezar en 2K o 4K y evaluar a la resolución final. Más resolución sólo se justifica si el encuadre revela falta de detalle del mapa; no corrige una forma incorrecta, una mezcla demasiado uniforme o detalles menores que un píxel.

## 4. Criterios artísticos para conservar la estética miniatura

Las siguientes son decisiones de dirección de arte, no valores botánicos o geológicos medidos.

| Elemento | Criterio propuesto | Señal visible de mejora |
| --- | --- | --- |
| Bloques grandes | Variar proporciones; crear caras amplias, quiebres y bordes gastados de distinta intensidad. Mantener algunas zonas relativamente planas. | Se reconocen como roca incluso con material gris neutro. |
| Contacto roca–suelo | Enterrar parte de la base, orientar la pieza según el talud y agregar fragmentos menores o tierra en lugares seleccionados. Evitar repetir el mismo anillo oscuro alrededor de todo. | La piedra parece pertenecer al terreno, con peso y una base estable. |
| Distribución | Pocos bloques dominantes, grupos secundarios y partículas menores. Relacionarlos con costa, pendiente o afloramiento. | No se percibe un dispersor aleatorio de objetos del mismo tamaño. |
| Pastizal | Mezclar matas verdes y secas en parches; dejar transiciones con tierra visible. Concentrar detalle geométrico donde la cámara pueda leerlo. | Se distingue hierba de una alfombra verde sin llenar toda la imagen de ruido. |
| Bosque | Separar claros, suelo bajo copa y bordes; usar restos vegetales, pequeñas ramas y hojarasca sólo donde aporten lectura. | El bosque tiene un piso diferente de la zona abierta. |
| Camino | Variar ancho y borde; interrumpirlo con invasión de pasto, pequeños desniveles y zonas gastadas. Las huellas deben seguir circulación, no ruido omnidireccional. | El recorrido mantiene claridad compositiva y deja de parecer una cinta nueva. |
| Costa | Dar continuidad al material de ribera; reservar la transición húmeda a su contacto con el agua. | Agua y tierra se conectan sin un borde ornamental de piedras. |
| Paleta y acabado | Mantener la luz cálida y los verdes apagados aprobados; conservar diferencias locales de luminosidad y rugosidad. | Sigue pareciendo una miniatura cuidada, pero sus materiales dejan de parecer una única pintura mate. |

El realismo buscado está en las relaciones entre formas, no en ensuciar todo por igual. Una miniatura puede simplificar el número de piedras o de briznas y conservar proporciones, contacto y patrones de desgaste convincentes.

## 5. Orden de pruebas recomendado

1. **Forma:** una pequeña muestra con roca actual, bloque de referencia y afloramiento propio, todos con material gris y la misma luz. Revisar silueta, escala, fracturas y apoyo.
2. **Material:** repetir una sola geometría con material actual y material PBR calibrado. Mantener exposición y cámara; revisar color, normal, alturas y roughness por separado antes de mezclarlos.
3. **Terreno:** comparar una parcela simple con otra que tenga talud, matas, suelo desnudo y camino. El objetivo es leer diferencias a escala media, no contar granos individuales.
4. **Encuadre final:** evaluar las muestras en la cámara real de la escena. Un relieve que sólo se distingue ampliando diez veces el render no debe guiar el presupuesto de detalle.
5. **Óptica:** aprobar primero una toma sin profundidad de campo y luego restituir el tilt-shift. El desenfoque puede contribuir a la miniatura, pero no sustituye la calidad del material enfocado. La posible pérdida por denoise debe juzgarse con comparaciones controladas, sin atribuirle el problema por anticipado.

La primera corrección debería cerrar una sola muestra convincente —por ejemplo, el talud junto a la capilla y un tramo corto de camino— antes de extender la solución a toda la colección.
