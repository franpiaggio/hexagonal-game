# Generar los assets de vegetación

Guía práctica para convertir la investigación botánica en modelos para el proyecto. Las fichas de cada especie, en [`especies/`](especies/), contienen los datos de forma y color. Este documento explica cómo llevarlos a geometría, materiales e instancias.

[Volver al índice](README.md)

> **Estado de implementación, 4 de noviembre de 2026:** esta guía conserva las recetas técnicas iniciales orientadas al atlas web. El trabajo vigente se centra en miniaturas detalladas de Blender: coihue, ciprés y lenga, con tres variantes por especie. Los entregables, reproducción y avance están en [vegetación patagónica](../../models/vegetacion_patagonica/README.md) y su [registro de seis pasos](../../models/vegetacion_patagonica/PROGRESO.md). Los presupuestos low-poly y la integración Three.js descritos más abajo son antecedentes, no los requisitos del ciclo actual.

## 1. Punto de partida: lo que el proyecto ya tiene

| Pieza actual | Dónde está | Observación |
| --- | --- | --- |
| `fir_0`, `fir_1` | `game/public/assets/atlas/atlas.glb` (5.4k–5.5k triángulos cada uno) | Derivan de [Poly Haven fir_tree_01](https://polyhaven.com/a/fir_tree_01), un abeto del hemisferio norte. Ninguna conífera nativa de la zona tiene esa forma. El ciprés de la cordillera es su reemplazo natural, y la araucaria es la conífera emblemática. |
| `leaf_0` | mismo GLB (916 triángulos) | Latifoliada genérica. Puede convertirse en lenga, ñire o roble cambiando silueta y color. |
| `lenga()` | `models/source/base_geometry.py:155` y copias en `build_miniatura.py`, `proportions.py` | Tronco más tres lóbulos de 7 lados. Es una buena base para una "nube" de Nothofagus caducifolio. |
| `conifer()`, `lenga()` | `models/source/make_textures.py:42` y `:70` | Texturas procedurales de follaje. |
| Instanciado | `game/demos/02-atlas-patagonico/world.ts:147-180` | `InstancedMesh` por tipo, con `setColorAt` para tinte. El tinte por instancia permite variar color otoñal sin más materiales. |

La forma más rápida de ganar identidad patagónica:

1. Reemplazar los `fir` por **ciprés de la cordillera**: más angosto, más oscuro, en grupos sobre laderas secas.
2. Sumar **coihue** como árbol dominante del bosque húmedo, con copa en pisos horizontales.
3. Usar **lenga** en altura, con versión achaparrada cerca del límite del bosque.
4. Agregar acentos de color: notro rojo en primavera, lenga y ñire rojos en otoño, tronco anaranjado del arrayán junto al agua.
5. Usar la **araucaria** como hito y solo en mapas "San Martín de los Andes norte" (Lolog, Lanín). No corresponde a Bariloche.

## 2. Siluetas: lo que debe leerse desde la cámara elevada

En la cámara de maqueta, la silueta y el color importan más que la hoja. Esta tabla resume la lectura mínima de cada especie. Las alturas son relativas a un coihue adulto (1.0).

| Especie | Altura rel. | Silueta clave | Tronco visible | Color de copa en verano | Color estacional |
| --- | --- | --- | --- | --- | --- |
| Coihue | 1.0 | Columna con 3–5 "bandejas" horizontales separadas por huecos; emergente sobre el resto | Recto, gris, alto antes de la primera rama | Verde oscuro brillante, algo grisáceo | Perenne |
| Raulí | 0.9 | Copa ovalada alta, más abierta que el roble; hojas grandes = textura más "suave" | Recto, gris oscuro | Verde claro intenso | Naranja, dorado y rojo en otoño |
| Roble pellín | 0.9 | Copa amplia, ramas gruesas casi perpendiculares al tronco | Recto, corteza gruesa en placas, gris-pardo | Verde medio | Amarillo, naranja y rojo |
| Lenga | 0.7 (bosque) / 0.1 (krummholz) | Nube irregular ensanchada; en altura: tronco en "L" y matas rastreras | Gris, a veces curvado en la base | Verde medio claro | Amarillo, naranja y rojo intenso |
| Ñire | 0.3–0.5 | Arbusto o arbolito retorcido, multitronco, ramas en zigzag | Torcido, oscuro | Verde claro, hoja pequeña | Amarillo a rojo; muy temprano |
| Ciprés de la cordillera | 0.6 | Cono angosto y denso de joven; adulto con copa más ancha y aplanada arriba | Pardo-rojizo fibroso | Verde amarillento a verde oscuro | Perenne |
| Araucaria | 0.9–1.0 | Joven: pirámide. Adulta: fuste desnudo y "paraguas" de ramas en verticilos al tope | Gris, en placas hexagonales | Verde oscuro brillante | Perenne |
| Arrayán | 0.4–0.6 | Troncos múltiples y retorcidos, copa densa y baja | **Canela/anaranjado** con manchas blancas | Verde oscuro, hoja diminuta | Perenne; flor blanca en verano |
| Maitén | 0.4–0.5 | Copa redonda y densa con ramillas colgantes, tipo sauce llorón pequeño | Corto, gris | Verde claro | Perenne |
| Notro | 0.3–0.5 | Arbolito angosto o multitronco, copa rala | Delgado | Verde oscuro | **Rojo bermellón** de septiembre a enero |
| Radal | 0.4 | Copa irregular y abierta; hojas grandes y duras | Gris pardo | Verde oscuro brillante | Flor crema en primavera |

### Reglas de silueta que diferencian la región

- **Pisos horizontales en el coihue.** Las fichas describen ramificación "estratificada, en planos horizontales". Es lo que más diferencia el bosque andino de un bosque europeo. Implementación: 3–5 discos o elipsoides aplanados (altura/radio ≈ 0.25–0.35) desplazados del eje, con huecos que dejen ver el tronco.
- **Emergentes.** El coihue sobresale por encima del dosel de otras especies. En un tile de bosque mixto, 1–2 coihues deben ser 20–30 % más altos que los demás.
- **Paraguas de la araucaria.** Fuste desnudo de 60–70 % de la altura, copa con 2–4 verticilos de 5–7 ramas horizontales que se curvan hacia arriba en la punta, como candelabro. Cada rama es un tubo grueso y "escamoso", no un plano de hojas.
- **Gradiente de forma de la lenga.** La misma especie aparece como árbol de 25–30 m en el valle, árbol bajo y retorcido cerca del límite, y krummholz rastrero en el límite superior. Basta un parámetro `exposicion` 0–1 para interpolar altura, curvatura en "L" de la base y densidad.
- **Cono angosto del ciprés.** Proporción altura/ancho ≈ 3:1 de joven y 2:1 de adulto. Hojas en abanicos aplanados, por lo que la superficie se puede resolver con capas de "ramilletes" planos, no con aguja tipo pino.

## 3. Paletas de referencia

Colores aproximados a partir de las fotografías de [`imagenes/`](imagenes/) y de las descripciones. Están en sRGB y sirven de punto de partida. Hay que ajustarlos bajo la iluminación del juego, porque el proyecto aplica un tinte de `.9, 1.02, .76` al follaje en `world.ts:33`.

Las paletas medidas automáticamente sobre las fotos están en [paletas.md](paletas.md).

| Uso | Hex | Nota |
| --- | --- | --- |
| Coihue, copa sombra | `#2E3B22` | Verde oscuro, casi negro en masa |
| Coihue, copa luz | `#5E6E3C` | Brillo grisáceo de hoja coriácea |
| Lenga/roble/raulí, verano | `#6E8A3A` | Verde medio claro |
| Lenga, otoño amarillo | `#D9A331` | |
| Lenga, otoño naranja | `#C8622A` | |
| Lenga/ñire, otoño rojo | `#9E2B22` | Típico de laderas altas |
| Ñire, verano | `#8BA04A` | Más claro y amarillento |
| Ciprés | `#46552C` | Verde amarillento oscuro |
| Araucaria | `#26361E` | Muy oscuro, brillante |
| Corteza arrayán | `#C9743A` | Canela |
| Manchas arrayán | `#E8D9BC` | Zonas claras al descascararse |
| Corteza Nothofagus | `#6B6760` | Gris |
| Corteza ciprés | `#6E4A36` | Pardo rojizo |
| Notro, flor | `#D2321E` | Rojo bermellón |
| Maitén | `#8DA457` | Verde claro |
| Caña colihue | `#9AA65A` | Amarillo-verdoso |
| Barba de viejo (liquen) | `#B9BFA0` | Verde grisáceo pálido |

## 4. Recetas de modelado por especie

Todas siguen el estilo del proyecto: geometría propia con colores por vértice y un número bajo de triángulos. El presupuesto sugerido toma como referencia `leaf_0` (≈ 900 triángulos) y los `fir` (≈ 5.5k).

### Coihue (≈ 1.2k triángulos)
- Tronco: tubo de 6–8 lados, alto, apenas cónico.
- Copa: 4 elipsoides aplanados escalonados en altura, rotados al azar alrededor del eje y con desplazamiento lateral de 0.1–0.2 del radio. El superior más chico.
- Color: dos tonos (sombra abajo, luz arriba) por vértice según la normal en Y.
- Variantes: `coihue_joven` (cónico, 2 pisos), `coihue_emergente` (5 pisos, más alto), `coihue_seco` (tronco gris claro sin copa, muy común en Bariloche tras incendios y en lagos).

### Lenga (≈ 900 triángulos, reutilizar `lenga()`)
- Base actual: tronco más tres lóbulos. Añadir:
  - parámetro `estacion` para elegir el color (verano, amarillo, naranja, rojo, sin hojas);
  - parámetro `exposicion` para curvar la base en "L" y bajar la altura;
  - variante `lenga_krummholz`: 4–6 lóbulos aplastados a ras del suelo, sin tronco visible.
- Distribución: franja superior de las laderas; en otoño mezclar tintes por instancia (`setColorAt`) con ruido de baja frecuencia para formar manchas, como se ve en el cerro Chapelco o el Catedral.

### Ñire (≈ 600 triángulos)
- 2–4 troncos finos que salen del mismo punto, con quiebres en zigzag (3–4 segmentos por tronco).
- Copa en pequeños lóbulos sueltos (5–8), dejando ver ramas.
- Distribución: bordes de mallines (zonas húmedas planas), fondo de valles fríos y ecotono con la estepa. En grupos densos ("ñirantales").

### Roble pellín y raulí (≈ 1k triángulos)
- Comparten base: tronco recto y copa de 4–6 lóbulos en una elipse alta.
- Roble: ramas principales visibles casi horizontales y copa más ancha; corteza con textura de placas.
- Raulí: copa más alta y ordenada, lóbulos más grandes y suaves, verde más claro.
- Solo en mapas de San Martín de los Andes (Lácar, Hua Hum, Lolog). No corresponden a Bariloche.

### Ciprés de la cordillera (≈ 800 triángulos)
- Reutilizar la lógica de `conifer()` y de los anillos de `base_geometry.py:140`, con más anillos (5–6), menos radio y punta algo inclinada.
- Adulto: anillos superiores más anchos, punta roma.
- Distribución: laderas norte y secas, afloramientos rocosos, ecotono con la estepa. Bosques abiertos en el este, con árboles separados y suelo claro entre ellos.

### Araucaria (≈ 1.5k triángulos, hito)
- Fuste: tubo de 8 lados, 60–70 % de la altura, con textura hexagonal en vértices (alternar tono).
- Copa: verticilos de 5–7 ramas. Cada rama es un tubo de 4–5 segmentos que sale horizontal y se curva hacia arriba en el último tercio. 2–4 verticilos.
- Variante joven: pirámide completa con verticilos hasta el suelo.
- Distribución: solo norte de San Martín de los Andes (Lolog hacia el norte, Lanín, Aluminé, Pehuenia). En grupos abiertos sobre ladera volcánica, a menudo junto a lenga o ñire.

### Arrayán (≈ 900 triángulos)
- 3–6 troncos retorcidos (tubos con 5–6 segmentos y torsión), color canela con parches claros por vértice.
- Copa baja y densa con lóbulos pequeños; muy verde oscura.
- Distribución: orillas de lagos y arroyos, en grupos apretados. Un bosque de arrayanes debe mostrar los troncos, como en Quetrihué, así que la copa empieza alta y deja un "salón" de troncos naranjas.

### Maitén (≈ 700 triángulos)
- Copa redonda con "flecos": varias tiras verticales colgando del borde del lóbulo (planos o tubos finos).
- Distribución: aislado en praderas, bordes de chacras, ecotono. Árbol de pradera, no de bosque denso.

### Notro (≈ 500 triángulos)
- Tronco delgado y copa rala de 3–4 lóbulos.
- Variante `notro_flor`: lóbulos con 30–50 % de vértices en rojo, concentrados arriba.
- Distribución: bordes de bosque, claros, caminos y bosques en regeneración tras incendios. Funciona como acento de primavera.

### Radal (≈ 600 triángulos)
- Copa irregular de 3–5 lóbulos con hueco central, verde oscuro brillante.
- Distribución: matorrales del ecotono junto a ñire, laderas secas, bordes de camino.

### Elementos acompañantes
- **Caña colihue**: matas densas de 1.5–5 m en el sotobosque. Planos verticales cruzados con tinte amarillo-verdoso. Bajo coihue y en bordes de arroyo.
- **Barba de viejo** (*Usnea*, *Protousnea*): tiras colgantes gris-verdosas en ramas de lenga y ñire. Unas pocas tiras por árbol bastan para "decir Patagonia" en primer plano.
- **Farolito chino** (*Misodendrum*): bolas parásitas en ramas de lenga y ñire. Pequeñas esferas amarillo-anaranjadas.
- **Árboles secos**: coihues y cipreses muertos en pie, grises, en laderas quemadas.

## 5. Distribución por bioma

Ver [00-contexto-sma-bariloche.md](00-contexto-sma-bariloche.md) para el detalle. Resumen como reglas para el generador:

```text
bioma "bosque-humedo-oeste" (Puerto Blest, Lácar oeste, Hua Hum)
  coihue 45%  caña-colihue (sotobosque denso)  arrayán junto al agua
  raulí/roble 25% (solo SMA)  lenga en altura

bioma "bosque-mixto" (Llao Llao, Lácar, Quila Quina)
  coihue 30%  ciprés 25%  lenga en altura  arrayán en costas
  notro y radal en bordes  roble/raulí solo SMA

bioma "ecotono-este" (Bariloche ciudad, Chapelco bajo, Meliquina)
  ciprés 45% (abierto)  ñire 25%  maitén 10%  radal 10%  notro 5%
  pradera y estepa entre árboles

bioma "altura" (Catedral, Chapelco, López)
  lenga 80% con gradiente a krummholz  ñire en matas
  nieve y roca arriba

bioma "araucaria" (Lolog norte, Lanín, Aluminé)
  araucaria 40%  lenga 30%  ñire 20%
  suelo volcánico claro, pocos arbustos
```

Detalle de orientación de ladera, observado alrededor de Bariloche: la lenga ocupa la parte alta y las laderas sur, el ciprés las partes bajas y las laderas norte, y el coihue el sudoeste y los cañadones. Maqui y maitén aparecen en el ecotono entre ellos. ([revistas.unc.edu.ar](https://revistas.unc.edu.ar/index.php/revistaadbia/article/download/40363/40610/150911))

## 6. Herramientas y técnicas

### Generadores procedurales
- **EZ-Tree** (Three.js, MIT): [github.com/dgreenheck/ez-tree](https://github.com/dgreenheck/ez-tree) · [npm](https://npmjs.com/package/@dgreenheck/ez-tree). Más de 50 parámetros, semilla reproducible, `generateLODs()`, exporta GLB y PNG. Sus mallas son pesadas (decenas de miles de triángulos), así que conviene usarlo para referencia o para hornear impostores, no para instanciar directo. Nota de lanzamiento: [digitalproduction.com](https://digitalproduction.com/2026/01/13/free-browser-based-procedural-tree-generator-released/), [CG Channel](https://www.cgchannel.com/?p=166833).
- **Sapling Tree Gen** (Blender): implementación del modelo de Weber y Penn. Desde Blender 4.2 se instala como extensión (Edit > Preferences > Extensions), y luego Shift+A > Curves > Sapling Tree Gen. Útil para troncos y ramas de araucaria o roble. [Guía](https://cgdivetest.super.site/tools/sapling-tree-gen-pre-installed-addon), [tutorial](https://lesterbanks.com/2014/03/creating-trees-sapling-tree-generator-addon-blender/).
- **Procedural Trees (Geometry Nodes, gratis)**: [vincentgeffroy.itch.io/procedural-trees](https://vincentgeffroy.itch.io/procedural-trees).
- **Combinar Sapling y Geometry Nodes**: [BlenderNation Bazaar](https://bazaar.blendernation.com/listing/tree-generator-geometry-nodes-more-power/).

### Papers base
- Weber y Penn, *Creation and Rendering of Realistic Trees*, SIGGRAPH 1995: [archivo SIGGRAPH](https://history.siggraph.org/?p=118727). Modelo recursivo por parámetros, con degradación por distancia. Sirve para araucaria (verticilos regulares) y ciprés.
- Runions, Lane y Prusinkiewicz, *Modeling Trees with a Space Colonization Algorithm*, 2007: [PDF](https://www.algorithmicbotany.org/papers/colonization.egwnp2007.pdf). La forma surge de la competencia por espacio. Sirve para ñire, arrayán y lenga retorcida: se define el volumen de copa y el algoritmo genera ramas creíbles.
- Patrick, Rege y Bailey, 2014, extensión de *space colonization* con control artístico e interacción con el entorno: [PDF](https://www.scitepress.org/Papers/2014/46905/46905.pdf).
- [algorithmicbotany.org](https://www.algorithmicbotany.org/papers/): biblioteca completa de Prusinkiewicz (L-systems).

### Viento y shaders
- [Polygon Wind](https://www.github.com/RenanBomtempo/polygon-wind): canal rojo del color por vértice para mover ramas y azul para el temblor de hojas. Se adapta a `onBeforeCompile` en Three.js.
- [Interactive 3D falling leaves shader](https://freefrontend.com/code/interactive-3d-falling-leaves-shader-2026-01-21/): `InstancedMesh` y ruido en el vertex shader. Útil para hojas de lenga cayendo en otoño.
- [Low-Poly Terrain Demo](https://discourse.threejs.org/t/low-poly-terrain-demo-wip/33859): árboles instanciados con viento por shader.
- Sugerencia: guardar en el GLB un atributo de color secundario (o usar el canal alfa del color por vértice) con 0 en la base del tronco y 1 en la punta de la copa, para escalar el desplazamiento del viento. La caña colihue y el maitén deberían moverse más que el ciprés y la araucaria.

### Texturas CC0 útiles
- [Poly Haven](https://polyhaven.com/textures): cortezas, suelo de bosque, roca. El proyecto ya usa `forest_ground_04` y `grass_ground`.
- [ambientCG](https://ambientcg.com/): cortezas y musgos CC0.
- Para la corteza del arrayán no hay equivalentes directos. Es mejor generarla con ruido (manchas claras sobre canela) en `make_textures.py`.

## 7. Flujo recomendado para una sesión de assets

1. Leer la ficha de la especie y mirar sus imágenes en `imagenes/<especie>/`.
2. Bocetar la silueta en `models/source/` como función `def <especie>(m, x, y, h, **params)`, al estilo de `lenga()`.
3. Validar en una hoja de contacto con las especies lado a lado y a la misma escala, renderizada desde la cámara del juego.
4. Exportar al atlas con `game/scripts/export-atlas-assets.py` y registrar el nombre en `ASSET_NAMES` de `world.ts`.
5. Añadir la regla de distribución en el plan del mundo (`landscape.ts`), usando los biomas de la sección 5.
6. Comprobar triángulos e instancias en el HUD de la demo.
