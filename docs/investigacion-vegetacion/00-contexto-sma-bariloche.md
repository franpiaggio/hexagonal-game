# Contexto: el bosque de San Martín de los Andes y Bariloche

Cómo se reparten las especies en el paisaje real entre San Martín de los Andes (Neuquén, ≈ 40°10' S) y San Carlos de Bariloche (Río Negro, ≈ 41°08' S). Es la base para decidir qué árbol va en cada tile y en qué proporción.

[Volver al índice](README.md)

## 1. Las tres fuerzas que ordenan el paisaje

### Lluvia: oeste húmedo, este seco
El viento del Pacífico descarga casi toda su humedad al cruzar la cordillera. En el Nahuel Huapi, Puerto Blest recibe alrededor de **4000 mm** anuales, y la lluvia disminuye rápido hacia el este. En pocas decenas de kilómetros se pasa del bosque húmedo (más de 3000 mm) al bosque mésico y luego a la estepa (menos de 800 mm). ([Parques Nacionales](https://www.argentina.gob.ar/node/138538), [Dialnet](https://dialnet.unirioja.es/descarga/articulo/5017762.pdf))

Para el juego, esto equivale a un eje oeste–este en el que cambian especies, densidad y color del suelo:

```text
OESTE (cordillera)                                              ESTE (estepa)
Puerto Blest · Hua Hum         Llao Llao · Lácar        Bariloche ciudad · Chapelco bajo
coihue denso, caña colihue  →  coihue + ciprés      →  ciprés abierto, ñire, radal, maitén  →  estepa
arrayán en costas              lenga arriba              pradera entre árboles                coirón
musgo, helechos                notro en bordes           suelo amarillento
```

### Altura: pisos de vegetación
- **Valle y costas de lago**: coihue, ciprés, arrayán junto al agua. En San Martín de los Andes también roble pellín y raulí.
- **Ladera media**: bosque mixto de coihue y lenga, con caña colihue debajo.
- **Ladera alta**: bosque puro de lenga, que forma el límite superior del bosque, generalmente por encima de los 1000 m. ([MMA Chile](https://repositorioambiental.mma.gob.cl/wp-content/uploads/2019/09/Afiche-lenga.pdf))
- **Límite del bosque**: lenga achaparrada y *krummholz*, con troncos que se arrastran sobre el suelo y forman una maraña. En Tierra del Fuego se describe una franja de 20–30 m de ancho de este tipo. Más abajo, la nieve y el deslizamiento del suelo curvan la base de los troncos en forma de "L". ([EcuRed](https://www.ecured.cu/Bosques_de_lenga), [UNLP](https://api.naturalis.fcnym.unlp.edu.ar/server/api/core/bitstreams/b2340ded-c4ea-4fda-83e1-c19a47613aea/content))
- **Por encima**: roca, pastizal de altura y nieve.

### Orientación de la ladera
En un cerro de la zona de Bariloche se describe esta distribución: la **lenga** en la parte superior y las laderas sur (frías), el **ciprés** en los sectores bajos y las laderas norte (soleadas y secas), y el **coihue** en el sudoeste y los cañadones. En la franja de contacto aparecen **maqui** y **maitén**. ([Revista ADBiA](https://revistas.unc.edu.ar/index.php/revistaadbia/article/download/40363/40610/150911))

En el hemisferio sur, la ladera que mira al **norte** recibe más sol. El generador puede usar la normal del terreno: `dot(normal, norte)` alto da ciprés; bajo da lenga o coihue.

## 2. San Martín de los Andes: lo particular

San Martín de los Andes está en el Parque Nacional Lanín (412.000 ha, protegido desde 1937). El parque protege bosques de pehuén, roble pellín y raulí. ([Parques Nacionales · Lanín](https://www.argentina.gob.ar/parquesnacionales/regionpatagonia/parque-nacional-lanin/biodiversidad))

**Lo que tiene San Martín de los Andes y no tiene Bariloche:**

| Especie | Por qué es propio de San Martín de los Andes |
| --- | --- |
| Roble pellín | En Argentina crece **solo en Neuquén**. Unas 26.300 ha, el 90 % dentro de los parques nacionales Lanín y Nahuel Huapi (sector neuquino). Su distribución es muy acotada y fragmentada. ([Desde la Patagonia, Medina 2020](https://desdelapatagonia.uncoma.edu.ar/wp-content/uploads/2020/07/7.-Revista-29_Medina.pdf)) |
| Raulí | Su distribución continua en Argentina va de **39°24' a 40°10' S**, en la ladera oriental de los Andes. San Martín de los Andes está justo en su borde sur. Cerca de 79.600 ha, el 97 % protegidas. ([FAO AGRIS](https://agris.fao.org/search/en/records/675abd790ce2cede71cfa4c0)) |
| Araucaria (pehuén) | En Argentina queda restringida a Neuquén, entre el lago Aluminé y el **lago Lolog**, inmediatamente al norte de San Martín de los Andes. En el norte del Lanín, entre el Ñorquinco y el Huechulafquen, cubre valles y laderas occidentales. ([RBGE](https://threatenedconifers.rbge.org.uk/conifers/araucaria-araucana), [Lacgeo](https://lacgeo.com/node/91)) |

Sobre la nota "no originario pero que hay en San Martín de los Andes": **todas las especies de la lista son nativas**. Ñire, roble pellín, lenga, araucaria y arrayán crecen de forma natural en la zona. Lo que ocurre es que roble pellín, raulí y araucaria tienen su límite sur justo ahí, por eso no se ven en Bariloche, salvo plantados. Las especies realmente introducidas se describen en la sección 5.

**Lugares de referencia en San Martín de los Andes**
- **Lago Lácar**: la ciudad está en su costa este. Hacia el oeste (Hua Hum, Pucará) el bosque es más húmedo, con coihue, roble y raulí.
- **Quila Quina**: costa sur del Lácar, bosque mixto y costas con arrayán.
- **Cerro Chapelco**: lenga en las laderas altas, con el rojo otoñal típico de marzo y abril.
- **Lago Lolog**: transición hacia el norte, con araucaria.
- **Meliquina y valles del este**: ecotono con ciprés, ñire y pradera.
- **Sendero al cerro Chivo**: cañaveral de colihue dentro de bosque de coihue. ([Welcome Argentina](https://www.welcomeargentina.com/sanmartindelosandes/parque-nacional-lanin.html))
- **Bosques de cipreses añosos** con cartelería en senderos del parque. ([Welcome Argentina](https://www.welcomeargentina.com/junindelosandes/parque-nacional-lanin.html))

## 3. Bariloche: lo particular

En el Parque Nacional Nahuel Huapi, **coihue, lenga y ñire ocupan más del 60 % del área protegida**. En el extremo húmedo aparecen alerce, ciprés de las Guaitecas, mañíos y arrayán, sobre todo cerca de ríos y lagos. El ciprés de la cordillera se extiende desde el borde occidental del bosque hasta la estepa, y llega mucho más al este en esta región. ([Parques Nacionales](https://www.argentina.gob.ar/node/138538), [SEDICI](https://sedici.unlp.edu.ar/bitstream/handle/10915/189600/Documento_completo.pdf?sequence=1))

En el borde oriental, el bosque da paso a un **mosaico** de bosques de ciprés, matorrales de ñire y radal, y estepa. En la transición entre lenga y ciprés, el sotobosque incluye caña colihue y laura. ([Fuentes, aacademica](https://www.aacademica.org/ricardo.daniel.fuentes/6.pdf)) El ejido de Bariloche tiene una cartografía de vegetación propia que describe esa transición. ([mapa de vegetación del ejido de Bariloche, revista *Ecología* nº 20, 2006](https://mapa.gob.es/ministerio/pags/Biblioteca/Revistas/pdf%5FREPN%2FECO%5F2006%5F20%5F65%5F88%2Epdf))

**Lugares de referencia en Bariloche**
- **Puerto Blest**: el extremo húmedo. Coihue, caña colihue, helechos y musgos.
- **Llao Llao y Península San Pedro**: bosque mixto de coihue y ciprés con arrayán en la costa.
- **Cerro Campanario y cerro Otto**: coihue en laderas y ciprés en sectores secos. Hay foto de coihues en el Campanario en [`imagenes/coihue/`](imagenes/coihue/).
- **Cerro Catedral y cerro López**: lenga en altura, con krummholz al final.
- **Isla Victoria**: bosque nativo con plantaciones exóticas antiguas, útil como ejemplo de mezcla.
- **Península de Quetrihué** (Villa La Angostura): el **Bosque de Arrayanes**, unas 20 ha dentro de un parque de 1753 ha, con ejemplares de hasta 25 m y 650 años. ([Lacgeo](https://mail.lacgeo.com/node/93))
- **Ciudad y Dina Huapi, hacia el este**: estepa con ciprés aislado, ñire y retama (exótica).

## 4. Composiciones por tipo de tile

Proporciones orientativas, pensadas para el generador y no para un inventario forestal.

| Tile | Dosel | Bajo dosel y sotobosque | Suelo | San Martín de los Andes | Bariloche |
| --- | --- | --- | --- | --- | --- |
| Bosque húmedo | coihue 70 %, raulí/roble 20 % (solo San Martín de los Andes) | caña colihue densa, helechos | oscuro, musgo | Hua Hum, Lácar oeste | Puerto Blest |
| Bosque mixto | coihue 40 %, ciprés 35 %, lenga 15 % | caña colihue, notro, radal | hojarasca | Lácar, Quila Quina | Llao Llao, Otto |
| Costa de lago | arrayán 40 %, coihue 30 %, ciprés 20 % | maqui, chilco (*Fuchsia*) | arena, canto rodado | Lácar | Quetrihué, Nahuel Huapi |
| Ecotono | ciprés 50 % abierto, ñire 20 % | maitén, radal, notro, calafate | pasto amarillo | Meliquina, este | Bariloche ciudad, Dina Huapi |
| Mallín | ñire 70 % en borde | juncos y pastos verdes | verde intenso, húmedo | valles fríos | valles del este |
| Lengal | lenga 90 % | poco sotobosque | hojarasca rojiza | Chapelco | Catedral, López |
| Límite del bosque | lenga achaparrada, krummholz | | roca, nieve | Chapelco alto | Catedral alto |
| Pehuenar | araucaria 50 %, lenga o ñire 40 % | poco | arena volcánica clara | Lolog norte, Lanín | (no corresponde) |

## 5. Especies exóticas que forman parte de la imagen actual

No son nativas, pero una persona que conoce la zona las reconoce. Sirven para tiles de pueblo, chacra o camino, siempre que la escena busque realismo actual y no el bosque original.

- **Pinos**: en la Patagonia andina, el ponderosa representa cerca del 87 % de las plantaciones, seguido por el murrayana (7,5 %) y el oregón (4 %). Los tres son invasores. El oregón avanza sobre el bosque nativo hacia el oeste, y el ponderosa y el contorta se dispersan hacia la estepa. ([CONICET](https://www.conicet.gov.ar/?p=16857), [ANBariloche](https://www.anbariloche.com.ar/noticias/2023/06/27/90076-la-invasion-de-plantas-exoticas-avanza-en-la-montana-y-la-estepa-patagonica))
- **Rosa mosqueta y retama**: de las más conocidas de la región, introducidas con fines ornamentales o de caza. Junto con pino e hiedra, son las que más se observan en la zona de Bariloche. Retama en flor = amarillo intenso al costado de las rutas en primavera. ([ANBariloche](https://www.anbariloche.com.ar/noticias/2023/06/27/90076-la-invasion-de-plantas-exoticas-avanza-en-la-montana-y-la-estepa-patagonica), [IFAB](https://ifab.conicet.gov.ar/wp-content/uploads/sites/200/2024/08/presencia54_compressed.pdf))
- **Álamos y sauces**: hileras en chacras y bordes de río. Amarillo dorado en otoño, típico de los valles del este.
- Las exóticas representan el 17 % de las especies registradas en el Lanín, frente al 31 % en Lago Puelo. ([Bol. Soc. Argent. Bot.](https://revistas.unc.edu.ar/index.php/BSAB/article/download/38419/40495/152419))

Los `fir_0` y `fir_1` actuales del atlas se parecen más a un pino oregón plantado que a una conífera nativa. Si se conservan, conviene reservarlos para tiles de pueblo o forestación.

## 6. Elementos acompañantes que "dicen Patagonia"

- **Caña colihue** (*Chusquea culeou*): bambú nativo de 4–6 m y unos 5 cm de diámetro, con hojas rígidas de 2–8 cm. Forma sotobosques casi impenetrables. Florece de forma masiva cada varias décadas y luego muere. Hubo floraciones en 1939–1942 y en 2010–2011 en el Nahuel Huapi, seguidas por explosiones de roedores ("ratadas"). Un tile de "colihue seco" amarillento es un evento visual real. ([Desde la Patagonia](https://revele.uncoma.edu.ar/index.php/desdelapatagonia/article/download/4046/61043/65049), [EcuRed](https://www.ecured.cu/Caña_coligüe), [Phytotaxa](https://www.mapress.com/phytotaxa/content/2014/f/p00158p274f.pdf))
- **Barba de viejo** (*Usnea*, *Protousnea magellanica*): líquenes colgantes sobre coihue, ñire y lenga. Dominan en rodales de baja precipitación. En los más húmedos predominan líquenes foliosos. ([MMA Chile](https://clasificacionespecies.mma.gob.cl/wp-content/uploads/2019/12/Protousnea_magellanica_16RCE_PAC.pdf))
- **Farolito chino** (*Misodendrum*): muérdago parásito que crece sobre lenga y ñire, a menudo junto a la barba de viejo. ([Alamy, referencia visual](https://alamy.com/stock-photo/mizodendrum.html), [CONICET](https://repositoriosdigitales.mincyt.gob.ar/vufind/Record/INTADig_c6f20f78b569a27919983ca681539de2))
- **Llao llao** (*Cyttaria*): hongo esférico anaranjado sobre ramas de Nothofagus. Da nombre a la península.
- **Arbustos**: maqui, michay, calafate, espino negro, chilco (fucsia de flor roja colgante junto a arroyos). ([Welcome Argentina](https://www.welcomeargentina.com/sanmartindelosandes/parque-nacional-lanin.html))
- **Árboles secos en pie**: coihues y cipreses muertos, grises, en laderas que se quemaron o en costas inundadas. Son muy comunes en la zona.
- **Picaflor rubí**: el único picaflor residente del Nahuel Huapi. Visita el notro y el chilco. Es un buen detalle de animación. ([El Hornero](https://elhornero.avesargentinas.org.ar/index.php/home/article/download/967/942))

## 7. Calendario visual

| Mes | Qué cambia |
| --- | --- |
| Septiembre–octubre | Brotes verde claro en lenga, ñire, roble y raulí. Radal en flor (crema). Notro empieza a florecer en zonas bajas. |
| Noviembre–diciembre | **Pico rojo del notro**. Retama amarilla en rutas. |
| Enero–febrero | Verde pleno. Arrayán florece en blanco. Notro en altura todavía con flores. |
| Marzo–abril | **Otoño**: lenga y ñire rojos en las laderas, raulí naranja y rojo, roble amarillo y naranja. Coihue, ciprés, araucaria y arrayán quedan verdes y forman manchas oscuras dentro del color. |
| Mayo–agosto | Caducifolios sin hojas y grises. Nieve sobre lenga. Los perennifolios dominan. |

Fechas del notro: de septiembre a enero según la altitud, porque la floración se retrasa con la altura, con pico en noviembre y diciembre. ([Patagonia-ar](https://patagonia-ar.com/pages/notro), [Meteored](https://www.meteored.cl/noticias/plantas/cada-noviembre-un-arbol-tine-de-rojo-fuego-la-patagonia-por-una-sorprendente-razon.html)) Radal: octubre y noviembre en el sur de Neuquén. ([MAGyP](https://www.magyp.gob.ar/apicultura/_pdf/Miel%20de%20Radal%20-%20Patagonia.pdf))

Galería de paisajes reales: [`imagenes/paisaje/`](imagenes/paisaje/).
