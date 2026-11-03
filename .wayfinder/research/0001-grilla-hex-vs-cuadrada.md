# 0001 — Grilla hexagonal vs cuadrada (incluida offset)

## Resumen

- **Recomendación: grilla hexagonal.** Usar coordenadas **axiales/cúbicas** en los algoritmos y guardar el mapa en un **array rectangular con offset** ("odd-r" o "odd-q"). Es lo que recomienda Red Blob Games para mapas rectangulares. La cámara rota en pasos de **60°** (6 vistas).
- **Por qué:** los 6 vecinos están a la misma distancia, así que no hay que resolver diagonales y A* queda simple. Las costas y los biomas se ven más orgánicos, que es lo que pide el look de maqueta realista. Hay kits CC0 hexagonales en glTF para arrancar (KayKit Medieval Hexagon, Kenney Hexagon Kit). Con la grilla no cambia nada el rendimiento: ~10k tiles cuestan lo mismo con instancing en las dos.
- **Qué cuesta:** hacen falta **más variantes de pieza** si se ensamblan por bordes (Wang/WFC): con 2 terrenos, 13–14 piezas únicas contra 6 en cuadrada, y con 3 terrenos, 92–130 contra 21–24. Los edificios y las calles rectangulares encajan peor. Las coordenadas offset confunden si se usan para la lógica en vez de solo para guardar.
- **Mitigación clave:** no modelar una pieza por cada combinación de vecinos. Se hacen dos cosas: (a) el terreno base se genera como malla continua con mezclas en bordes y esquinas, como en el tutorial Hex Map de Catlike Coding; (b) las piezas discretas de WFC se definen en la **grilla dual** (triángulos con vértices en los centros de los hex), que con 2 terrenos baja a **4 piezas** contando rotaciones y espejos.
- **Si el gameplay termina siendo city-builder con edificios rectangulares**, conviene volver a evaluar la cuadrada. Esta decisión se cierra en el ticket 0007.

## 1. Sistemas de coordenadas

| Sistema | Qué es | Pros | Contras |
|---|---|---|---|
| **Cuadrada (x, y)** | Trivial | Suma/resta de vectores, array directo | 4 u 8 vecinos con distancias distintas (diagonal √2) |
| **Hex offset** (odd-r / even-r / odd-q / even-q) | Filas o columnas alternas desplazadas medio tile | Se guarda en array rectangular, que es intuitivo | La tabla de vecinos depende de la paridad de la fila. **No se pueden sumar ni restar coordenadas.** |
| **Hex cúbica (q, r, s)**, q+r+s=0 | Tres ejes | Álgebra vectorial, simetría hexagonal; "la mayoría de los algoritmos son más simples" | Una coordenada redundante |
| **Hex axial (q, r)** | Cúbica sin s (s = −q−r) | Igual que la cúbica, pero guarda 2 números | Hay que calcular s cuando se necesita |
| **Hex doubled** | Uno de los ejes avanza de a 2 | Vecinos iguales en todos lados y mapa rectangular | Es menos común |

Red Blob recomienda textualmente: *"Store coordinates as Axial, and calculate s in algorithms that need it"*. Para mapas rectangulares sugiere offset o doubled como almacenamiento. Un rectángulo en axial se indexa como `array[r][q + floor(r/2)]`, que equivale a odd-r. Fuente: [Red Blob – Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/).

**"Cuadrada con offset":** si cada fila de cuadrados se corre medio tile (patrón de ladrillos), cada celda queda con **6 vecinos**. Topológicamente es una grilla hexagonal con celdas cuadradas: tiene los costos de la hex en lógica y ninguna ventaja visual. Si en cambio se refiere al "staggered isometric" de los editores 2D, como los mapas *staggered isometric* de Tiled ([Tiled manual](https://doc.mapeditor.org/en/stable/manual/introduction/)), solo cambia el almacenamiento de un mapa isométrico de rombos y en 3D no aplica. **En three.js, con cámara real, la variante offset de cuadrados no tiene sentido**: hay que elegir entre cuadrada pura o hex.

## 2. Vecindad, distancia y pathfinding

- **Cuadrada:** con 4 vecinos los caminos quedan en escalera y las distancias Manhattan se ven raras. Con 8 vecinos aparece el problema de la diagonal (costo √2, cortar esquinas, rodear obstáculos en diagonal). Los diseñadores de Civ V citaron justamente esto: en hex *"no hay ventaja por moverse en diagonal"* ([HEXUS review](https://www.hexus.net/gaming/reviews/pc/26722-sid-meiers-civilization-v-pc/)).
- **Hex:** 6 vecinos equidistantes. La distancia axial es `(|dq| + |dq+dr| + |dr|) / 2`. Sirven anillos (6N hexes en el radio N), espirales y rotación de 60° como `[q,r,s] → [−r,−s,−q]`.
- **A*/Dijkstra** funcionan igual en las dos. Solo cambian la función de vecinos y la heurística (distancia hex) ([Red Blob – Hexagonal Grids, Pathfinding](https://www.redblobgames.com/grids/hexagons/)).
- **Picking analítico** (relevante para el ticket de interacción): en las dos se hace un raycast al plano del suelo y después se convierte a celda. En cuadrada es `floor`. En hex se pasa de píxel/mundo a axial fraccional con la matriz inversa y después **cube rounding** (redondear las 3 y corregir la de mayor error) ([Red Blob – Implementation](https://www.redblobgames.com/grids/hexagons/implementation.html)). Es un poco más de matemática y el costo es igual.
- **Tamaño:** un mapa hexagonal de radio N tiene `1 + 3N(N+1)` celdas, así que con N=57 son ≈ 9.919 tiles. Un rectángulo de 100×100 da 10.000 en cualquiera de las dos grillas.

## 3. Encaje con WFC y otros generadores

- **WFC funciona sobre cualquier grafo de adyacencia.** La librería DeBroglie de BorisTheBrave *"supports 2d tiles, hexs, and 3d voxels"* ([DeBroglie](https://github.com/BorisTheBrave/DeBroglie)). En hex hay 6 direcciones de restricción en lugar de 4. La propagación queda más restringida y conviene un tileset con pocas clases de "socket" para evitar contradicciones (esto es inferencia, sin fuente medida).
- **Bad North** (Stålberg) usó WFC sobre **grilla cuadrada** con más de 300 tiles hechos a mano. **Townscaper** usa una grilla **irregular de quads** que sale de subdividir una grilla hexagonal, con piezas de "esquina" al estilo marching cubes; un reskin estimaba ~500 tiles ([Game Developer – How Townscaper works](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)). La lección es que el trabajo de assets crece rápido con el número de combinaciones, sea cual sea la grilla.
- **Ruido, Voronoi, erosión y biomas por altura/humedad** son independientes de la grilla: se muestrea el campo continuo en el centro de cada celda. Ahí la hex no cuesta nada extra. El ticket 0004 trata los algoritmos.

## 4. Autotiling y cantidad de piezas

Conteos de piezas únicas para un set **por bordes** (Wang) o **por esquinas**, donde cada borde o esquina toma un "color" de terreno. Los de cuadrada vienen de [BorisTheBrave – Classification of Tilesets](https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/). **Los de hex los calculé yo con el lema de Burnside** (collares/brazaletes de 6 cuentas) porque la fuente no los da:

| Set | Cuadrada: crudo / rot / rot+espejo | Hex: crudo / rot / rot+espejo |
|---|---|---|
| Bordes, 2 colores | 16 / 6 / 6 | 64 / 14 / 13 |
| Bordes, 3 colores | 81 / 24 / 21 | 729 / 130 / 92 |
| Esquinas, 2 colores | 16 / 6 / 6 (marching squares) | 64 / 14 / 13 |
| Blob (bordes+esquinas), 2 colores | 256 → 47 (blob) | — (no aplica igual) |
| **Grilla dual** (esquina donde se juntan las celdas) | 4 celdas por vértice → 16 / 6 | **3 celdas por vértice → triángulos: 8 / 4 (T-V2-RM); con 3 colores, 11 (T-V3-RM)** |

Observaciones:
- En hex **cada vértice lo comparten exactamente 3 celdas**, y nunca se juntan 4 terrenos en un punto. Catlike Coding lo usa para el blending: un núcleo sólido del 75%, "puentes" (quads) en cada borde compartido y **un triángulo por cada trío de celdas** ([Catlike Coding – Hex Map 2](https://catlikecoding.com/unity/tutorials/hex-map/part-2/)). La reseña de Civ V nombra el mismo beneficio visual: se evita que *cuatro tipos de terreno se encuentren en un punto* ([HEXUS](https://www.hexus.net/gaming/reviews/pc/26722-sid-meiers-civilization-v-pc/)).
- Para piezas modeladas (glTF), el enfoque dual en hex da piezas triangulares con muy pocas variantes. Es el que más reduce el trabajo de modelado.
- Ríos y caminos en hex: cada borde puede tener o no río o camino. Son 64 combinaciones crudas y 13 únicas, aunque en la práctica se usan menos (rectos, curvas suaves/cerradas, deltas). KayKit trae tiles de ríos, caminos y costas hex ya hechos ([KayKit Medieval Hexagon](https://kaylousberg.itch.io/kaykit-medieval-hexagon)).

## 5. Cómo se ve en isométrico y rotación de cámara

- **Cuadrada + iso clásico (yaw 45°):** los tiles se ven como rombos. Hay 4 vistas con pasos de 90°. Las líneas rectas de cuadras, muros y campos quedan naturales, pero las costas salen en escalera si no se suavizan.
- **Hex:** se ve "menos blocky" y más orgánico. Es el argumento de Jon Shafer para Civ V ([Gamereactor](https://www.gamereactor.eu/?p=4542), [PC Gamer – History of Civ](https://pcgamer.com/the-complete-history-of-civilization/5)). Con pasos de **60°** se mantiene la misma orientación aparente (flat-top o pointy-top). A 30° se ve la otra, así que **hay que elegir un yaw base y rotar solo de a 60°**. Son 6 vistas en vez de 4. Como los modelos son 3D no hay costo extra de arte, pero hay más ángulos para revisar en composición, sombras y oclusión.
- **Tilt-shift realista:** las maquetas reales no muestran la grilla. Con cualquiera de las dos hay que **separar la grilla lógica de la malla visual** (terreno continuo con blending, props dispersos con jitter). La hex arranca con ventaja porque tiene menos líneas rectas largas que delaten la grilla. La cuadrada es mejor cuando el contenido es urbano y ortogonal.
- **Edificios:** los rectangulares sobre hex quedan raros o necesitan bases hexagonales. Es la mayor contra estética de la hex para ciudades.

## 6. Rendimiento (presupuesto de 10k tiles)

Prácticamente igual. Una tapa hexagonal plana tiene 4–6 triángulos contra 2 en cuadrada, una diferencia despreciable frente a los props. Con `InstancedMesh` o merge por chunk, el costo lo dominan los draw calls y los props, no la forma de la celda. El chunking en rectángulos funciona igual sobre el array offset. **La grilla no debería decidirse por rendimiento.**

## 7. Juegos reales

| Hex | Cuadrada |
|---|---|
| Civilization V y VI (Civ V pasó de cuadrados a hex) [Wikipedia Civ V](https://en.wikipedia.org/wiki/Civilization_V) | Bad North (WFC, 300+ tiles) [Game Developer](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making) |
| Dorfromantik (tiles hex que encajan por bordes, estilo Carcassonne) [GOG interview](https://gog.com/news/binterview_toukana_interactive_tells_us_more_about_dorfromantikb) | Civ I–IV, XCOM, Into the Breach, Factorio (conocimiento general, sin fuente puntual) |
| Humankind, Old World, Age of Wonders 4, Panzer General (conocimiento general) | Townscaper: quads irregulares derivados de hex (caso híbrido) |

Nota: Shafer después se mostró ambivalente con algunas decisiones de Civ V, como un tile por unidad ([PC Gamer 2013](https://www.pcgamer.com/2013/04/12/civilization-v-designer-ed-beach-jon-shafer/)). La crítica es al diseño de combate, no a la grilla hex en sí.

## Recomendación y trade-offs

**Elegir hex**, con estas decisiones derivadas:

1. **Coordenadas:** axial `(q, r)` en toda la API. Cúbica solo dentro de los algoritmos (rounding, rotación, líneas). Offset **solo** como índice de almacenamiento o chunk.
2. **Orientación:** fijar una (pointy-top o flat-top) y un yaw base. La cámara rota de a 60°.
3. **Terreno:** malla continua generada por chunk con blending de bordes y esquinas (enfoque Catlike), en lugar de una pieza modelada por combinación.
4. **Piezas discretas o WFC:** sockets por borde con pocas clases, o piezas en la grilla dual triangular (4 variantes con 2 terrenos y 11 con 3).
5. **Kits iniciales:** KayKit Medieval Hexagon (CC0, glTF, 200+ modelos, aunque estilizado low-poly) y Kenney Hexagon Kit (CC0) ([Kenney](https://kenney.nl/assets/hexagon-kit)). Sirven para prototipar. El look realista va a pedir reemplazarlos (ticket 0006).

| Se gana | Se paga |
|---|---|
| Distancias uniformes, sin diagonales | Más variantes por borde (13–14 contra 6 con 2 terrenos) |
| Look orgánico, nunca se juntan 4 terrenos en un punto | Edificios y calles rectangulares encajan peor |
| Kits CC0 hex disponibles | Matemática de coordenadas menos obvia (mitigada con axial) |
| 6 vistas de cámara | Más ángulos para revisar composición y sombras |

**Cuándo elegir cuadrada:** si el gameplay se define como city-builder o táctico con estructuras ortogonales, o si se prioriza el mínimo trabajo de assets modulares (cliffs y muros rectos).

## Fuentes

- Red Blob Games – Hexagonal Grids: https://www.redblobgames.com/grids/hexagons/
- Red Blob Games – Implementation of Hex Grids: https://www.redblobgames.com/grids/hexagons/implementation.html
- Red Blob Games – Grid parts and relationships: https://www.redblobgames.com/grids/parts/
- BorisTheBrave – Classification of Tilesets: https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/
- DeBroglie (WFC con soporte hex): https://github.com/BorisTheBrave/DeBroglie
- Catlike Coding – Hex Map, part 2 (blending): https://catlikecoding.com/unity/tutorials/hex-map/part-2/
- Game Developer – How Townscaper works: https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making
- HEXUS – Civilization V review (de cuadrados a hexágonos): https://www.hexus.net/gaming/reviews/pc/26722-sid-meiers-civilization-v-pc/
- Gamereactor – Jon Shafer sobre Civ V: https://www.gamereactor.eu/?p=4542
- PC Gamer – The complete history of Civilization: https://pcgamer.com/the-complete-history-of-civilization/5
- PC Gamer 2013 – Ed Beach sobre las críticas de Shafer: https://www.pcgamer.com/2013/04/12/civilization-v-designer-ed-beach-jon-shafer/
- Tiled manual – orientaciones de mapa: https://doc.mapeditor.org/en/stable/manual/introduction/
- KayKit Medieval Hexagon (CC0): https://kaylousberg.itch.io/kaykit-medieval-hexagon
- Kenney Hexagon Kit (CC0): https://kenney.nl/assets/hexagon-kit
- GOG – Entrevista a Toukana (Dorfromantik): https://gog.com/news/binterview_toukana_interactive_tells_us_more_about_dorfromantikb
