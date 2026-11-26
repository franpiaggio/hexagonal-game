# Investigación: vegetación de San Martín de los Andes y Bariloche

Investigación visual y botánica de los árboles nativos de la Patagonia norte, pensada para generar assets con más identidad patagónica en otras sesiones del proyecto. El foco geográfico es **San Martín de los Andes** (Lanín, Lácar) y **San Carlos de Bariloche** (Nahuel Huapi).

Cada ficha reúne datos de forma, color y hábitat con su fuente, fotos de referencia con licencia libre y una sección "Para el asset" con silueta, colores y reglas de distribución.

Fecha de la investigación: 3 de noviembre de 2026.

## Cómo usar esta carpeta

1. Para entender **qué va dónde**, leer [00 · Contexto regional](00-contexto-sma-bariloche.md).
2. Para **modelar** una especie, abrir su ficha y luego [Generación de assets](generacion-de-assets.md).
3. Para **mirar referencias**, ver las hojas de contacto en [`imagenes/hojas/`](imagenes/hojas/) o la [galería de paisajes](galeria-paisajes.md).

## Documentos

| Documento | Contenido |
| --- | --- |
| [00 · Contexto regional](00-contexto-sma-bariloche.md) | Gradiente oeste-este, pisos de altura, orientación de ladera, diferencias entre San Martín de los Andes y Bariloche, composiciones por tile, especies exóticas, acompañantes y calendario visual |
| [Generación de assets](generacion-de-assets.md) | Qué hay hoy en el proyecto, tabla de siluetas, paleta, recetas por especie, distribución por bioma, herramientas, papers y flujo de trabajo |
| [Paletas medidas](paletas.md) | Colores dominantes medidos sobre las fotografías |
| [Galería de paisajes](galeria-paisajes.md) | Fotos de Lácar, Lolog, Chapelco, Llao Llao, Catedral, Gutiérrez, Mascardi y especies acompañantes |
| [Fuentes y recursos](fuentes-y-recursos.md) | Bibliografía, portales de imágenes y datos con conflicto entre fuentes |
| [Contraste de portes y hábitat](14-contraste-portes-y-habitat.md) | Revisión del 5 de noviembre de 2026 sobre lenga achaparrada, grandes coihues y ciprés en roca, contrastada con los modelos y las veinte escenas |
| [Araucaria: revisión de morfología](16-araucaria-morfologia-revision.md) | Jerarquía de ramas, escamas, portes y diagnóstico del estudio 06 |
| [Suelo del pehuenar: revisión](17-suelo-pehuenar-revision.md) | Referencias, escala, materiales y pruebas del terreno |
| [Créditos de imágenes](imagenes/CREDITOS.md) | Autor y licencia de cada foto |

## Especies

| # | Especie | Nombre científico | Hoja | Rol en el paisaje | San Martín de los Andes | Bariloche |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | [Coihue](especies/01-coihue.md) | *Nothofagus dombeyi* | perenne | Dominante del bosque húmedo; emergente con copa en pisos | sí | sí |
| 02 | [Lenga](especies/02-lenga.md) | *Nothofagus pumilio* | caduca | Bosque de altura y límite del bosque; rojo en otoño | sí | sí |
| 03 | [Ñire](especies/03-nire.md) | *Nothofagus antarctica* | caduca | Matorral retorcido de mallines y ecotono | sí | sí |
| 04 | [Roble pellín](especies/04-roble-pellin.md) | *Nothofagus obliqua* | caduca | Bosque bajo del Lanín; corteza en placas | sí | no |
| 05 | [Raulí](especies/05-rauli.md) | *Nothofagus alpina* | caduca | Bosque húmedo del Lanín; hojas largas, otoño rojo | sí (límite sur) | no |
| 06 | [Ciprés de la cordillera](especies/06-cipres-cordillera.md) | *Austrocedrus chilensis* | perenne | Conífera de laderas secas y ecotono | sí | sí |
| 07 | [Araucaria (pehuén)](especies/07-araucaria.md) | *Araucaria araucana* | perenne | Hito; paraguas sobre laderas volcánicas | norte (Lolog hacia el norte) | no (solo plantada) |
| 08 | [Arrayán](especies/08-arrayan.md) | *Luma apiculata* | perenne | Costa de lago; troncos canela | sí | sí (Quetrihué) |
| 09 | [Maitén](especies/09-maiten.md) | *Maytenus boaria* | perenne | Árbol llorón de pradera y ecotono | sí | sí |
| 10 | [Notro](especies/10-notro.md) | *Embothrium coccineum* | perenne | Acento rojo de primavera en bordes | sí | sí |
| 11 | [Radal](especies/11-radal.md) | *Lomatia hirsuta* | perenne | Matorral del ecotono; hoja grande | sí | sí |

Nota sobre la lista original: ñire, roble pellín, lenga, araucaria y arrayán son **nativos** de la zona de San Martín de los Andes. Roble pellín, raulí y araucaria tienen ahí su límite sur en Argentina, y por eso no aparecen en Bariloche. Las especies introducidas (pinos, rosa mosqueta, retama, álamos) están en la sección 5 del [contexto regional](00-contexto-sma-bariloche.md#5-especies-exóticas-que-forman-parte-de-la-imagen-actual).

## Conclusiones para el proyecto

- **Reemplazar los `fir`** del atlas (un abeto del hemisferio norte de Poly Haven) por **ciprés de la cordillera** como conífera general, y usar la **araucaria** solo como hito en mapas del norte de San Martín de los Andes.
- **El coihue con copa en pisos horizontales** es la silueta que más diferencia este bosque de uno europeo.
- **La lenga necesita un gradiente de forma** con la altura (árbol, árbol torcido con base en "L", krummholz) y variantes de color otoñal mezcladas por ruido.
- **El color estacional es la mayor oportunidad**: lenga, ñire y raulí rojos sobre el verde oscuro de coihue y ciprés en otoño; notro rojo en primavera; arrayán canela todo el año.
- **San Martín de los Andes y Bariloche pueden ser biomas distintos**: San Martín de los Andes con roble, raulí y araucaria; Bariloche con más ciprés hacia el este y el bosque de arrayanes de Quetrihué.
- **Los acompañantes dan la firma**: caña colihue, barba de viejo, farolito chino y árboles secos en pie.

## Estructura

```text
docs/investigacion-vegetacion/
├── README.md                     este índice
├── 00-contexto-sma-bariloche.md
├── generacion-de-assets.md
├── paletas.md
├── galeria-paisajes.md
├── fuentes-y-recursos.md
├── especies/                     una ficha por especie (01–11)
├── scripts/                      descarga de Commons y armado de galerías/paletas
│   ├── fetch_commons.py          python3 -I scripts/fetch_commons.py imagenes [especie…]
│   └── build_docs.py             python3 -I scripts/build_docs.py docs/investigacion-vegetacion (requiere ffmpeg)
└── imagenes/
    ├── CREDITOS.md · creditos.json
    ├── hojas/                    hojas de contacto por especie
    └── <especie>/                fotos de Wikimedia Commons (1280 px)
```

Las imágenes son de Wikimedia Commons con licencias CC BY, CC BY-SA, CC0 o dominio público. Sirven como referencia; si alguna se incluye en el juego o en material público, hay que citar al autor según [CREDITOS.md](imagenes/CREDITOS.md).

## Estudios de modelado

- [Estudio singular de araucarias](15-estudio-araucarias.md): siete portes, cuatro detalles botánicos, modelos Blender/GLB y renders individuales del estudio 04.
