# Algoritmos de generación procedural de mapas (ticket 0004)

Investigado el 2026-11-03. Fuentes primarias al final; cada afirmación lleva su referencia entre corchetes. Las estimaciones de costo que no salen de una fuente están marcadas como **[estimación]**.

## Resumen

- **La base es ruido por capas.** Elevación, humedad y temperatura salen de simplex/OpenSimplex con FBM (octavas), redistribución con `pow`, máscara de isla y domain warping. Cada tile se calcula aparte, así que el ruido es determinista con semilla, se paraleliza y funciona igual en hex y en cuadrada: se muestrea en el centro del tile en espacio mundo [RB-terrain]. Para 10k tiles cuesta milisegundos [estimación a partir de SN-bench].
- **Ríos y costas van después, sobre el grafo de vecinos.** Primero Priority-Flood para que todo drene, después dirección de flujo, acumulación y número de Strahler para el ancho [Barnes, RB-rivers]. En hex hay 6 vecinos y la red queda más orgánica. En cuadrada hay 4 u 8 y aparecen sesgos diagonales.
- **La erosión hidráulica de partículas es opcional.** Da el plus "realista", pero no a la resolución del tile: se corre sobre un heightmap más fino (por ejemplo 4×4 muestras por tile) y su costo es el más alto del pipeline [SebLague, estimación].
- **WFC no sirve para la forma macro del terreno.** Sirve para ajustar piezas locales con restricciones de borde. Con 10k celdas conviene usarlo por bloques (Modifying in Blocks), con backtracking, o reemplazarlo por autotiling determinista (marching squares/dual grid) cuando las reglas son simples [WFC, Merrell/BtB, BtB-autotile]. Bad North y Townscaper lo usan así: el contexto lo fija otra cosa y WFC elige módulos [GD-Townscaper].
- **Los props se colocan con Poisson disk (Bridson, O(n)) o con jitter por tile.** La densidad se modula con el bioma. Para que el resultado no dependa del orden de generación de chunks, conviene sembrar el RNG por tile [PDS, RB-terrain].
- **Librerías JS/TS:** `simplex-noise` 4.0.3 (TS, MIT, 2 kB) + `alea` para ruido, o `fastnoise-lite` 1.1.1 si hace falta domain warp y fractales ya hechos. `poisson-disk-sampling` 2.3.1 acepta RNG propio. `wavefunctioncollapse` 2.1.0 es un port JS sin tipos, solo 2D cuadrado. `honeycomb-grid` 4.1.5 resuelve coordenadas hex. `delaunator` sirve solo si se va a grafos irregulares.
- **Hex vs cuadrada:** ningún algoritmo de esta lista descarta una u otra. Hex cuesta más en el catálogo de piezas WFC y autotile (6 bordes y 6 rotaciones contra 4 y 4) y en las piezas de río. A cambio da distancias uniformes y ríos/costas más naturales.

## Pipeline sugerido

Todo dentro de un Web Worker, con una semilla maestra y sub-semillas derivadas por capa (`hash(seed, "elevation")`, `hash(seed, "moisture")`, ...). Las capas quedan desacopladas: cambiar la cantidad de props no altera el terreno.

1. **Grilla y vecinos.** Se define la topología (hex axial guardada en "rectangle storage" o cuadrada) y una función `neighbors(i)` [RB-hex]. Todo lo de abajo trabaja contra esa interfaz, así que la grilla queda intercambiable.
2. **Elevación.** FBM de 4 a 6 octavas con domain warp. Después redistribución `pow(e, k)` y máscara de isla o continente `lerp(e, 1-d, mix)` [RB-terrain, IQ-warp]. Opcional: ruido ridged para cordilleras [RB-terrain].
3. **Hidrología.** Priority-Flood desde el mar o el borde: rellena depresiones y da direcciones de flujo [Barnes]. La acumulación de flujo × lluvia define los ríos. El número de Strahler da el ancho [RB-rivers]. Si un pozo queda como pozo en vez de rellenarse, sale un lago.
4. **(Opcional) Erosión.** Gotas sobre el heightmap fino, unas decenas de miles de iteraciones [SebLague]. Al terminar se vuelve a muestrear la altura de cada tile. Los ríos se recalculan después de erosionar.
5. **Clima y biomas.** Humedad con ruido y distancia al agua. Temperatura con latitud y altura. Lookup tipo Whittaker [RB-terrain]. En mapgen4 la humedad sale de viento y lluvia, una mejora posible más adelante [mapgen4].
6. **Cuantización a tiles.** Altura discreta en terrazas (`round(e*n)/n`) [RB-terrain], un tipo de terreno por tile y bordes de costa y río.
7. **Selección de piezas.** Se elige la variante de modelo por tile según sus vecinos: autotiling por esquinas o bordes, o WFC por bloques si hay piezas con conexiones complejas (acantilados, caminos, puentes) [WFC, Merrell/BtB].
8. **Props.** Poisson disk con densidad por bioma, sembrado por tile o por chunk [PDS].

Costo total sin erosión: unos pocos ms a ~30 ms en desktop **[estimación]**. Con erosión de partículas a 160k muestras y ~50–70k gotas: del orden de 100 ms a varios cientos **[estimación]**. Por ese costo la erosión va en worker y es candidata a cachearse por semilla.

## Algoritmo por algoritmo

### 1. Ruido: simplex / OpenSimplex, FBM, redistribución

- **Qué es.** Ruido coherente: valores vecinos relacionados entre sí. La frecuencia controla el tamaño horizontal de los rasgos y la amplitud el vertical. El ruido rosa (amplitud ∝ f^-½) suele quedar mejor para paisajes [RB-noise].
- **FBM.** `e = Σ a_i · noise(f_i·x, f_i·y) / Σ a_i`, con frecuencias que se duplican. Amplitudes como `[1, 1/2, 1/3, 1/4, 1/5]` sacan más detalle fino [RB-terrain]. Cada octava se desplaza con un offset propio para evitar correlación cerca del origen [RB-terrain].
- **Redistribución.** `pow(e·fudge, exp)` aplana valles y afila picos [RB-terrain].
- **Biomas.** Una segunda capa de ruido para humedad, con otra semilla u otro offset (`noise2D(nx+1000, ny)`). Después tabla elevación × humedad [RB-terrain].
- **Islas.** `d = 1 - (1-nx²)(1-ny²)` o `d = min(1, (nx²+ny²)/√2)`, mezclado con `e = lerp(e, 1-d, mix)` [RB-terrain].
- **Terrazas.** `round(e·n)/n` [RB-terrain]. Le sirve directo a un mapa de tiles con niveles de altura.
- **Mundos infinitos o con wrap.** El cálculo es local, así que se puede generar cualquier región desplazando las coordenadas. Para wrap este-oeste se usa ruido 3D sobre un cilindro [RB-terrain].
- **Hex vs cuadrada.** Se muestrea en el centro del tile en espacio mundo (`hex_to_pixel` en hex) [RB-hex]. Es idéntico en ambas grillas. Amit Patel recomienda empezar con grilla cuadrada para experimentar el generador [RB-noise].
- **Determinismo.** `simplex-noise` usa `Math.random` por defecto, pero acepta un PRNG: `createNoise2D(alea('seed'))`. Cada función de ruido necesita su propia instancia de `alea` [SN].
- **Costo.** ~20 ns por muestra 2D, unos 73 M ops/s en un Ryzen 5950X single-thread [SN]. 10k tiles × ~20 evaluaciones (elevación + humedad + warp) ≈ 200k muestras ≈ 4 ms en desktop. En mobile de gama media habría que multiplicar por 3–5 **[estimación]**.

### 2. Domain warping

- **Qué es.** Desplazar las coordenadas con otro ruido antes de muestrear: `f(p + h·fbm(p + o))`. También se anida: `f(p + fbm(p + fbm(p)))`. Rompe la isotropía del FBM y da formas plegadas, como de erosión o de flujo [IQ-warp].
- **Costo.** Cada nivel de warp suma dos FBM (x e y) por muestra. Un warp de un nivel triplica el costo de la capa. Con 10k tiles sigue siendo irrelevante **[estimación]**.
- **Librerías.** `fastnoise-lite` trae domain warp listo, en variantes OpenSimplex2 y "Basic Grid", más fractales [FNL]. Con `simplex-noise` se arma a mano en ~10 líneas.
- **Hex vs cuadrada.** Indiferente, porque opera en espacio mundo.
- **Nota:** no pude recuperar la página de Íñigo Quílez (iquilezles.org/articles/warp/ devolvió 404 al pedirla). La fórmula es la que él publica y la cito de memoria; conviene verificarla en el sitio.

### 3. Ríos, costas y depresiones

- **Costas.** Salen de un umbral de elevación sobre el nivel del mar. La máscara de isla controla la forma general [RB-terrain]. El tile de costa es el tile de tierra con al menos un vecino agua. Su variante de modelo sale del patrón de vecinos (ver §6).
- **Garantizar drenaje.** Priority-Flood (Barnes et al.) inunda desde el borde con cola de prioridad. Rellena depresiones, da direcciones de flujo y etiqueta cuencas. Cuesta O(n) para alturas enteras y O(n log n) para floats [Barnes]. Funciona sobre cualquier grafo de vecinos, sea hex (6) o cuadrada (4/8).
- **Crecer cuencas desde el borde (Red Blob).** BFS desde el exterior. Cada celda apunta a un vecino ya visitado, y sesgar el orden con ruido (híbrido BFS/Dijkstra) da cuencas asimétricas. El ancho del río sale del número de Strahler, que se calcula en post-orden. La altura puede asignarse *después*, para que encaje con la red de drenaje [RB-rivers].
- **mapgen4.** Malla Delaunay/Voronoi, simulación de evaporación, viento y lluvia, ríos como árboles binarios, generación interactiva con multithreading. Es Apache-2.0 [mapgen4, GH].
- **Hex vs cuadrada.** En hex los ríos pasan por el centro del tile y salen por uno de 6 bordes. Para 1 entrada y 1 salida, por rotación quedan 3 formas (giro cerrado, giro suave, recto). Sumando confluencias y nacientes aparecen más variantes. En cuadrada hay 2 formas (recto y esquina) con 4-vecindad, y con 8-vecindad los ríos diagonales cruzan esquinas, cosa incómoda para modelar **[análisis propio]**.
- **Determinismo.** Los algoritmos son deterministas si los empates de la cola de prioridad se rompen siempre igual, por ejemplo por índice de tile **[análisis propio]**.

### 4. Erosión hidráulica

- **Qué es.** Simulación de gotas: cada una baja por el gradiente, arrastra sedimento según su capacidad y lo deposita al frenar o evaporarse. El repo de Sebastian Lague muestra el resultado tras 70k iteraciones y cita como referencias el PDF "implementation of a methode for hydraulic erosion" (firespark.de) y un post de ranmantaru.com [SebLague]. No pude leer el PDF: el certificado del sitio estaba vencido.
- **Escala.** A resolución de 1 muestra por tile (~100×100) la erosión casi no se ve. Hay que correrla sobre un heightmap más fino que el que después se re-muestrea por tile **[análisis propio]**.
- **Costo.** Es el paso más caro. Por ejemplo, 60k gotas × ~30–60 pasos × interpolación bilineal ≈ 2–4 M de actualizaciones, del orden de 100 ms o más en JS **[estimación]**. Va en worker y puede omitirse en mobile.
- **Determinismo.** Las gotas se procesan en orden secuencial, con el RNG de la capa. Si se paraleliza (por ejemplo en GPU), el orden de escritura deja de ser determinista **[análisis propio]**.
- **Hex vs cuadrada.** La simulación corre sobre un heightmap cuadrado en ambos casos. Solo el re-muestreo final cambia.

### 5. Wave Function Collapse (WFC) y variantes

- **Modelos.** El *overlapping model* aprende patrones N×N de un bitmap. El *simple tiled model* usa tiles con reglas de adyacencia, el caso 1×2 [WFC].
- **Heurística.** Colapsa la celda de menor entropía no nula. Eso evita sesgo direccional y funciona en grillas irregulares [WFC].
- **Contradicciones.** El algoritmo base no hace backtracking: ante una contradicción falla y reinicia. Según el autor son "sorprendentemente raras" con buenos tilesets. Decidir si existe solución es NP-hard [WFC].
- **Escalar a mapas grandes.**
  - *Modifying in Blocks* (Merrell, model synthesis): se resuelve por bloques solapados y una contradicción reinicia solo su bloque, así que la tasa de fallo no crece con el tamaño. Necesita un conjunto de tiles "conocido bueno" para fijar bordes abiertos [Merrell/BtB].
  - *Backtracking:* DeBroglie (C#) lo soporta completo, con topologías hex y 3D y restricciones no locales [DeBroglie].
  - *Nested WFC* con tilesets "complete/sub-complete" para contenido infinito sin conflictos ni backtracking (IEEE CoG 2023). El abstract no trae benchmarks [N-WFC].
- **En juegos.**
  - *Bad North:* más de 300 tiles modelados en Maya. Las reglas de vecindad salen de escanear los bordes de cada modelo. Agua abajo y cielo arriba como condiciones iniciales. Restricciones duras y blandas, una heurística de navegabilidad y validación con reinicio si falla [GD-Townscaper, WFC]. Charla: Stålberg, "Wave Function Collapse in Bad North", Everything Procedural Conference 2018 [EPC].
  - *Townscaper:* grilla hex subdividida en quads y relajada, con colocación por esquinas al estilo marching cubes. Separa la selección de módulos de la decoración. Los módulos tienen prioridades. Puede fallar en silencio [GD-Townscaper].
  - *Caves of Qud:* WFC en varias pasadas dentro de un pipeline mayor [WFC].
- **Hex vs cuadrada.** En cuadrada cada pieza tiene 4 bordes y 4 rotaciones. En hex tiene 6 bordes y 6 rotaciones, así que el catálogo de piezas y las reglas de adyacencia crecen. DeBroglie soporta hex de forma nativa [DeBroglie]. El port JS (`wavefunctioncollapse`) solo trae grilla 2D cuadrada [kchapelier], así que para hex habría que escribir el solver. Es chico: propagación AC-3 sobre `neighbors(i)` **[análisis propio]**.
- **Determinismo.** `model.generate(rng)` acepta un RNG [kchapelier]. Con semilla y orden de desempate fijos es reproducible. Los reinicios también consumen del mismo RNG, así que la salida es reproducible aunque el número de intentos varíe **[análisis propio]**.
- **Costo.** Depende fuerte del tileset. El overlapping model tuvo mejoras de un orden de magnitud (Fehr y Courant) [WFC]. Para 10k celdas con un tileset simple es factible en worker. Con tilesets restrictivos, sin bloques ni backtracking, el riesgo de reinicios crece con el tamaño [Merrell/BtB].
- **Recomendación.** Usar WFC solo para la capa de piezas, restringido por la capa de terreno (cada celda arranca con las piezas compatibles con su bioma y altura). Nunca para decidir el terreno macro, que en Bad North también lo fijan heurísticas y reglas duras [GD-Townscaper].

### 6. Autotiling determinista (alternativa barata a WFC)

- **Qué es.** Marching squares elige entre 16 tiles según las esquinas. El "blob" usa 47 tiles por vecindad de 8. Ambos explotan combinatoriamente con 3 o más terrenos [BtB-autotile].
- **Ventajas.** Es O(n), sin búsqueda, siempre resuelve y es determinista por construcción.
- **Hex.** Con etiquetado binario de los 6 bordes (o las 6 esquinas) hay 64 combinaciones, que por rotación se reducen a 14 clases (13 si también se usa reflexión). En cuadrada con 4 esquinas hay 16 combinaciones y 6 clases por rotación **[cálculo propio: necklaces binarios]**. En el dual de la grilla hex (triángulos, 3 esquinas) hay solo 8 combinaciones y 4 clases. Townscaper colapsa el catálogo de forma parecida, colocando "esquinas" en una grilla dual [GD-Townscaper].

### 7. Colocación de props: Poisson disk y jitter

- **Bridson.** Muestreo O(n) de puntos con distancia mínima r [JD-PDS]. Detalles del paper (grilla de fondo de lado r/√2, k≈30 candidatos en el anillo r–2r): no pude extraer el PDF, así que los cito de memoria. Coinciden con el default `tries: 30` y `maxDistance = 2·minDistance` de la librería [PDS].
- **Alternativa.** Red Blob recomienda Poisson disc o grilla con jitter antes que ruido de alta frecuencia para colocar árboles [RB-terrain].
- **Densidad variable.** `poisson-disk-sampling` acepta `distanceFunction(p) → [0,1]`, que se alimenta desde el mapa de bioma o humedad [PDS].
- **Determinismo y chunks.** La librería acepta un `rng` como segundo argumento [PDS]. Un Bridson global depende del orden de inserción, así que si se generan chunks por separado los bordes no coinciden. Para streaming conviene: (a) RNG sembrado por tile con k puntos jittereados dentro del tile y rechazo contra los vecinos ya colocados, o (b) un patrón Poisson tileable precomputado que se rota u offsetea por tile **[análisis propio]**.
- **Hex vs cuadrada.** El muestreo se hace en espacio mundo y cada punto se asigna a su tile con `pixel_to_hex` o `floor` [RB-hex]. En hex el jitter por tile cubre un hexágono (rechazo sobre un rectángulo envolvente).

### 8. Grafos irregulares (Voronoi / quads relajados)

- mapgen4 y Townscaper muestran que los grafos irregulares dan el look más orgánico [mapgen4, GD-Townscaper]. `delaunator` (ISC, con tipos) y `@redblobgames/dual-mesh` (Apache-2.0) lo resuelven en JS [npm, GH].
- **Fuera de scope por ahora.** El mapa del proyecto plantea hex o cuadrada con rotación de cámara por pasos de grilla. La opción queda anotada como variante futura y no como recomendación.

## Determinismo: reglas transversales

- No usar `Math.random` en ninguna parte del generador. Un PRNG semillable (`alea`, `pure-rand`, o mulberry32/sfc32 a mano) y sub-semillas por capa y por tile.
- ECMAScript define `Math.sin/cos/exp/pow` como "implementation-approximated": pueden diferir en el último bit entre motores. Las decisiones discretas (umbrales de bioma, río sí/no) deberían tomarse sobre valores cuantizados, o usar solo aritmética básica + `Math.sqrt`/`floor` en los caminos críticos, si se necesita igualdad bit a bit entre navegadores (por ejemplo, multiplayer o semillas compartidas) **[a verificar en ECMA-262 §21.3.2]**.
- Orden de iteración y desempates fijos (por índice de tile) en colas de prioridad, BFS y WFC.

## Librerías JS/TS (verificado en registry.npmjs.org y GitHub el 2026-11-03)

| Paquete | Versión | Licencia | Tipos TS | Uso | Notas |
|---|---|---|---|---|---|
| `simplex-noise` | 4.0.3 | MIT | sí (escrito en TS) | ruido 2D/3D/4D | ~2 kB gz, sin dependencias, PRNG inyectable [SN] |
| `alea` | 1.0.1 | MIT | no | PRNG con semilla string | el que recomienda simplex-noise [SN] |
| `fastnoise-lite` | 1.1.1 | MIT | no declarados en package.json | ruido + fractales + domain warp + celular | port oficial de FastNoiseLite [FNL] |
| `open-simplex-noise` | 3.0.0 | Unlicense | — | OpenSimplex | alternativa |
| `poisson-disk-sampling` | 2.3.1 | MIT | no | props | n dimensiones, densidad variable, rng propio [PDS] |
| `fast-2d-poisson-disk-sampling` | 1.0.3 | MIT | no | props | Bridson modificado, solo 2D |
| `wavefunctioncollapse` | 2.1.0 | MIT | no | WFC | port de mxgmn, solo grilla cuadrada, último cambio 2023 [kchapelier] |
| `honeycomb-grid` | 4.1.5 | MIT | sí | coordenadas y grillas hex | opcional: las fórmulas de Red Blob son pocas líneas |
| `delaunator` | 5.1.0 | ISC | sí | triangulación | solo si se usan grafos irregulares |
| `pure-rand` | 8.4.2 | MIT | sí | PRNG | alternativa tipada a alea |

Sin equivalente maduro en JS: WFC con backtracking y hex (DeBroglie es C#), Priority-Flood (es corto de implementar) y erosión de partículas (hay que portar el algoritmo).

## Fuentes

- [RB-terrain] Red Blob Games, "Making maps with noise functions": https://www.redblobgames.com/maps/terrain-from-noise/
- [RB-noise] Red Blob Games, "Noise Functions and Map Generation": https://www.redblobgames.com/articles/noise/introduction.html
- [RB-hex] Red Blob Games, "Hexagonal Grids": https://www.redblobgames.com/grids/hexagons/
- [RB-rivers] Red Blob Games, "Procedural river growing": https://www.redblobgames.com/x/1723-procedural-river-growing/
- [mapgen4] Red Blob Games, mapgen4: https://www.redblobgames.com/maps/mapgen4/ · código: https://github.com/redblobgames/mapgen4 (Apache-2.0)
- [WFC] mxgmn, WaveFunctionCollapse (README): https://github.com/mxgmn/WaveFunctionCollapse
- [kchapelier] Port JS de WFC: https://github.com/kchapelier/wavefunctioncollapse
- [DeBroglie] Boris the Brave, DeBroglie: https://github.com/BorisTheBrave/DeBroglie
- [Merrell/BtB] Boris the Brave, "Model Synthesis and Modifying in Blocks": https://www.boristhebrave.com/2021/10/26/model-synthesis-and-modifying-in-blocks/
- [BtB-autotile] Boris the Brave, "Beyond Basic Autotiling": https://www.boristhebrave.com/2021/09/12/beyond-basic-autotiling/
- [N-WFC] Nie et al., "Extend Wave Function Collapse to Large-Scale Content Generation", IEEE CoG 2023: https://arxiv.org/abs/2308.07307
- [GD-Townscaper] Game Developer, "How Townscaper works: a story four games in the making" (entrevista a Oskar Stålberg): https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making
- [EPC] O. Stålberg, "Wave Function Collapse in Bad North", Everything Procedural Conference 2018 (Breda University). No verifiqué el video directamente.
- [Barnes] Barnes, Lehman, Mulla, "Priority-Flood: An Optimal Depression-Filling and Watershed-Labeling Algorithm for Digital Elevation Models": https://arxiv.org/abs/1511.04463
- [SebLague] Sebastian Lague, Hydraulic-Erosion: https://github.com/SebLague/Hydraulic-Erosion
- [IQ-warp] Íñigo Quílez, "Domain warping": https://iquilezles.org/articles/warp/ (404 al pedirla, citado de memoria)
- [SN] simplex-noise: https://github.com/jwagner/simplex-noise.js
- [FNL] FastNoiseLite: https://github.com/Auburn/FastNoiseLite
- [PDS] poisson-disk-sampling: https://github.com/kchapelier/poisson-disk-sampling
- [JD-PDS] Jason Davies, Poisson-disc sampling (con link al paper de Bridson, "Fast Poisson Disk Sampling in Arbitrary Dimensions", SIGGRAPH 2007): https://www.jasondavies.com/poisson-disc/
- [npm/GH] Versiones y licencias: registry.npmjs.org/<paquete>/latest y api.github.com/repos/<repo>, consultados el 2026-11-03.
