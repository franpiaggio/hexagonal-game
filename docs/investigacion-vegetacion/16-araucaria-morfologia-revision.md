# Araucaria: revisión de arquitectura y lectura visual

Investigación del 9 de noviembre de 2026 para corregir el estudio `pehuenar_06`, rechazado porque los árboles no se reconocen bien como araucarias. Este documento distingue **descripción botánica**, **observaciones de fotografías** y **parámetros de arte propuestos**. No reemplaza la [ficha de especie](especies/07-araucaria.md) ni atribuye a toda la especie las proporciones de un ejemplar.

## Conclusión para modelar

El problema principal no es la cantidad de hojas o de árboles. Es la jerarquía de la forma: ramillas demasiado finas y subdivididas, brazos que convergen hacia un borde circular elevado, copas repetidas y troncos despejados casi idénticos. El modelo se lee como una copa hueca de frondas sobre un poste.

La próxima prueba debe construir primero una **ramilla escamosa continua**, después un brazo con sus ramillas y finalmente el árbol. El follaje de pehuén tiene que ofrecer una masa de cordones rígidos y gruesos, con interrupciones entre cordones; no una nube plumosa, ni abanicos planos, ni un pompón esférico. La silueta de cada árbol debe cambiar por su arquitectura, no solamente por escalar una copia.

## Datos respaldados

| Rasgo | Evidencia y consecuencia |
| --- | --- |
| Cobertura de la ramilla | Kew describe hojas rígidas, oscuras y brillantes que cubren por completo las ramas mediante superposición. También describe ramas horizontales dispuestas por pisos, con pocas laterales. La superficie verde debe envolver el eje y ocultar la madera joven. [Kew Species Profiles](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:261681-1/general-information) |
| Hoja | Oregon State da 3–5 cm de largo y 0,8–2,5 cm de ancho basal; son rígidas, espirales, muy próximas y pueden persistir 10–15 años. No son agujas estrechas de abeto. [Oregon State University](https://landscapeplants.oregonstate.edu/plants/araucaria-araucana) |
| Rama principal | RBGE admite ramas verticales, horizontales o dirigidas hacia abajo, frecuentemente limitadas a la parte superior del árbol. Su descripción incluye corteza gris con fisuras y placas hexagonales, altura hasta 50 m y tronco hasta 2 m de diámetro. Ninguna de esas máximas es un objetivo para todos los modelos. [RBGE / Threatened Conifers](https://threatenedconifers.rbge.org.uk/conifers/araucaria-araucana) |
| Aspecto de los pisos | Royal Botanic Gardens Victoria describe copa ampliamente domada, ramas curvadas hacia arriba, normalmente en verticilos de cinco, y hojas triangulares robustas de 3–5 × 1–2 cm. Una cúpula puede conservar orden radial sin convertirse en una circunferencia perfecta. [HortFlora, RBG Victoria](https://hortflora.rbg.vic.gov.au/taxon/ad8a66a8-5340-11e7-b82b-005056b0018f) |
| Jerarquía de ejes | La síntesis arquitectónica de Falaschi y colaboradores distingue, para la mayoría de Araucaria, tronco A1, ramas A2 y ramillas A3 sin ramificación ordinaria adicional. Advierte también la existencia de reiteraciones. Es una guía contra recursión indiscriminada; no prohíbe rebrotes o estructuras secundarias excepcionales. [Falaschi et al., 2011, sección 1.3](https://ri.conicet.gov.ar/bitstream/handle/11336/68407/CONICET_Digital_Nro.445e8062-7264-4541-a0b6-36b7890c095e_J.pdf?sequence=11) |

### Adulto no significa una única forma de paraguas

Barthélémy y Caraglio muestran que la arquitectura de *A. araucana* varía con las condiciones en que crece. Su figura 20 reproduce tres situaciones estudiadas por Grosfeld y colaboradores: árbol de bosque con fuste de 15–20 m y gran copa cónica de hasta 20 pisos vivos; árbol a pleno sol favorable que comienza a fructificar con 6–8 m y copa piramidal; y árbol de sitio restrictivo que puede fructificar con menos de 4 m y porte aparasolado. La figura 22 presenta la unidad de tres categorías de ejes. Por eso no corresponde asignar siempre «adulto = 3 pisos, 75 % de tronco desnudo» ni deducir edad directamente de altura. [Barthélémy & Caraglio, 2007, figs. 20 y 22; PDF de CIRAD](https://amapstudio.cirad.fr/_media/soft/xplo/private/private/barthelemy_caraglio_2007_ann_bot.pdf)

### Medidas de campo disponibles y sus límites

Kutchartt y colaboradores midieron 33 árboles en La Fusta, Chile, abarcando edades y tamaños diferentes. La tabla 1 registra alturas de 3,2–29,5 m, longitudes de copa de 1,7–12,5 m y diámetros de copa de 1,8–14,4 m. Las medias respectivas son 13,6, 5,7 y 6,1 m. **No se deben combinar mínimos y máximos como si pertenecieran al mismo árbol**, ni dividir medias para obtener la proporción de una «araucaria típica». La muestra sí demuestra una variabilidad sustancial y ofrece una comprobación de orden de magnitud. [Kutchartt et al., 2021, tabla 1, artículo de investigación](https://repositorio.uchile.cl/bitstream/handle/2250/183352/Aboveground-tree-biomass.pdf?sequence=1)

## Qué muestran las fotos locales

Estas son observaciones visuales de imágenes, no un inventario ni una medición de árboles. Las licencias y autores siguen en [CREDITOS.md](imagenes/CREDITOS.md); no hace falta incorporar las fotografías a las texturas.

| Referencia inspeccionada | Qué conviene trasladar al modelo |
| --- | --- |
| [11 — ramificación y conos](imagenes/araucaria/11-araucaria-araucana-2944470892.jpg) | Los ejes verdes son continuos, curvos y gruesos. Las bases superpuestas de hojas no dejan una espina de madera visible entre «plumitas». Los remates forman grupos orgánicos, con huecos claros entre ejes. Los conos permiten comparar visualmente la escala de las ramillas. |
| [05 — bosque, varios estados](imagenes/araucaria/05-araucaria-araucana-kz34.jpg) | Hay árboles altos de copas profundas, remates anchos, juveniles cónicos y planos distintos de superposición. No todos los individuos tienen despejada la misma fracción del fuste. La lectura densa proviene del solapamiento de ejes de varios niveles, no de abanicos finos repetidos en un único borde. |
| [10 — ejemplar viejo de Pehuenia](imagenes/araucaria/10-villa-pehuenia-un-milenario-rbol-de-pehu-n-araucaria-arauca.jpg) | El ejemplar dominante tiene brazos gruesos, grupos asimétricos y algunas ramas inferiores péndulas/desnudas. El tronco conserva volumen hasta arriba y cicatrices. No es un poste terminado en un cuenco pequeño. La fotografía es contrapicada: no extraer proporciones métricas directas de ella. |

## Diagnóstico del generador anterior

Observaciones de [generar.py del estudio 04](../../models/vegetacion_patagonica/araucarias_04/source/generar.py) y de la adaptación [pehuenar_06](../../models/vegetacion_patagonica/pehuenar_06/source/escena.py):

1. La elevación de las ramas adultas se calcula para acercar sus puntas a una altura común. Distintos pisos terminan casi en el mismo borde: se forma un recipiente o corona de antenas.
2. El perfil radial se reduce fuertemente entre pisos, y la vegetación se concentra en la parte terminal de los brazos. Queda mucho espacio vacío en la copa interna.
3. A las secundarias se agregan grupos de brotes y hasta doce bifurcaciones en abanico. Son demasiados órdenes visuales finos frente a los cordones simples de las fotos.
4. A distancia, hojas métricas individuales menores que un píxel desaparecen parcialmente. Aumentar su número no vuelve legible un eje que sigue siendo demasiado delgado.
5. La corrección de la escena anterior comprimió y duplicó una copa completa. Aumentó densidad, pero repitió el mismo diseño erróneo. La duplicación circular no equivale a desarrollar otra arquitectura.
6. La misma copia adulta, con rotaciones y pequeñas escalas, domina la población. La variación queda en el tamaño, mientras se repite el patrón de ramas.

## Parámetros para las pruebas, no medidas botánicas nuevas

Los siguientes valores son un punto de partida artístico contrastable. Deben ajustarse mirando la foto y el render a tamaños equivalentes. Las fuentes anteriores no publican un diámetro universal de ramilla ni un número fijo de ramillas por brazo.

### Ramilla y brazo

- Probar primero un cordón de 1–2 m con curva suave, sin subdivisiones recursivas, cubierto de hojas de 3–4 cm de largo y 1,5–2,2 cm de ancho. Hojas largas de 5 cm pueden aparecer, sin convertirlas en el tamaño uniforme.
- Para la prueba cercana, empezar con radio leñoso de 0,8–2 cm y hojas dirigidas oblicuamente hacia el extremo. Una envolvente aproximada de 5–9 cm puede surgir de esa combinación; **es una estimación geométrica de diseño**, no una cifra medida en las fuentes.
- Comprobar la fórmula `diámetro exterior ≈ 2 × (radio del tallo + longitud de hoja × seno del ángulo de salida)`. Un tallo de radio 3–5 cm más hojas salientes no produce una envolvente de sólo 8 cm. Separar grosor de madera, cobertura foliar y exageración de pantalla.
- Agrupar cordones en un brazo grueso. Probar 8–15 terminales con distinta curvatura y largo, conservando intervalos entre ellos. Evitar abanicos de 12 rayos que nazcan repetidamente de un único punto.
- La parte vieja del brazo puede mostrar madera; el cordón joven debe verse verde y continuo. La transición es por edad del eje, no por un porcentaje idéntico de todas las ramas.

### Tres familias necesarias

| Familia de prueba | Regla de construcción artística |
| --- | --- |
| Juvenil piramidal | Copa profunda y ramas bajas conservadas. Eje central evidente, pisos con longitudes decrecientes y cordones verdes gruesos. No es una versión pequeña del adulto despejado. |
| Adulto de bosque | Copa alta pero todavía profunda; probar seis a nueve pisos de distinta extensión. Los brazos inferiores pueden caer antes de levantar sus extremos. Conservar solapamientos de ramas por delante y detrás del tronco. |
| Adulto expuesto / viejo | Domo ancho de tres a cinco grupos principales, con asimetría, vacíos puntuales y uno o dos brazos descendentes. Un remate puede estar roto o reducido. No hacer que todas las puntas terminen a la misma altura ni que todos los árboles viejos sean casi muertos. |

Los rangos de pisos son configuraciones de modelado propuestas, no conteos universales. La regla de 5–7 ramas por verticilo puede dar orden al inicio, pero la supervivencia, curvatura y longitud de brazos deben variar. La irregularidad debe ocurrir por grupos coherentes, sin aplicar ruido a cada vértice.

## Comprobaciones antes de poblar la escena

1. **Ramilla a corta distancia:** el tallo queda cubierto, la hoja parece rígida y ancha, y el perfil no recuerda una pluma ni una hoja de helecho.
2. **Brazo aislado:** se distingue un eje estructural y terminales robustos. Debe poder leerse sin una nube de ramificaciones finísimas.
3. **Árbol frontal y elevado:** copa con volumen interior, más de una profundidad visible y alturas terminales distintas. La vista superior no debe dibujar una roseta perfecta.
4. **Miniatura de 120–200 px de alto:** se reconoce la arquitectura aunque no se distingan hojas individuales. Como ejemplo de proyección, una hoja de 3,5 cm en un árbol de 28 m que ocupa 120 px mide sólo 0,15 px; esa cuenta explica por qué la lectura depende de los conjuntos y de los cordones.
5. **Tres árboles juntos:** joven, adulto de bosque y adulto expuesto deben distinguirse por estructura, incluso con el mismo color y la misma altura en pantalla.
6. **Comparación con la escena rechazada:** misma cámara y luz para separar el cambio geométrico del efecto de iluminación o desenfoque. Primero sin profundidad de campo; recién después añadir el acabado de miniatura.

Una compensación de grosor para un plano lejano puede ser una decisión de LOD, pero debe mantenerse separada del maestro métrico y documentada. No agrandar todas las hojas ni multiplicar copas completas para disimular problemas de escala.

## Referencias prioritarias para continuar

- Kew Species Profiles: descripción directa del revestimiento foliar y ramas por pisos.
- Oregon State University: dimensiones foliares y fotografías de hojas, ramas, hábito y troncos.
- RBGE / Threatened Conifers: diversidad de orientación de ramas, porte y corteza.
- Barthélémy & Caraglio, 2007: figuras 20 y 22; plasticidad y tres categorías de ejes. El texto de Grosfeld et al. 1999 se identifica mediante esa publicación, sin afirmar que se haya consultado su capítulo original completo.
- Kutchartt et al., 2021: dimensiones de campo y variación entre individuos; evitar usar ratios universales inventados.

La identidad debe resolverse primero en el árbol aislado. Una escena con cientos de instancias sólo amplifica los errores de la plantilla si esa comprobación todavía falla.
