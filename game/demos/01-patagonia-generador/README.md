# 01 · Patagonia · generador

Generador de dioramas hexagonales de Patagonia (pueblo, lagos, ríos, bosque, cordillera) con
tilt-shift. Pensado para grabar y postear: sin UI, cada click arma un paisaje nuevo.

## Controles

| Acción | Efecto |
|---|---|
| Click / tap, `Espacio`, `→`, `Enter` | Siguiente paisaje |
| `A` | Autoplay on/off (cada 7 s) |
| `?v=N` | Arrancar en la variante N |
| `?auto` o `?auto=10` | Autoplay desde el inicio (segundos por variante) |
| `?hq` | Render a 2× pixel ratio (para grabar; por defecto 1,5×) |

El cursor se oculta solo tras 1,2 s quieto, para grabar limpio.

## Variantes

Las 10 primeras están curadas (`CURATED` en `generator.ts`): tableros de radio 3 a 5, pueblos de
hasta 12 celdas, bosques x1–x3 y cinco climas (día, invierno, atardecer, noche, otoño). Desde la 11
se derivan del índice, así que la secuencia es infinita y reproducible.

## Cómo está hecho

- **Generador** (`generator.ts`, sin three.js): forma del tablero (hexágono con borde irregular),
  ríos que serpentean (giros de ±60° alternados), lagos que crecen de 1 a N celdas y se encadenan
  con ríos (`from: 'chain'`), pueblo junto al agua, cordillera al fondo, bosque por ruido.
- **Terreno propio** (`terrain.ts`): agua y montañas no usan los tiles del kit. Un campo en espacio
  de mundo (SDF de ríos como curvas Catmull-Rom + lagos como unión suave de círculos con ruido;
  macizo con ruido ridged enmascarado por distancia a celdas no-montaña) se muestrea en cada celda,
  así las formas cruzan los bordes. Los lagos se recortan para no tocar celdas de tierra del kit.
- **Kit** (`tiles.ts`): pradera, bosque (duplicado y rotado para más densidad) y caserío del kit de
  `models/`; de la montaña solo se reusa el pico, 1 o 2 por celda con escala variable.
- **Materiales TSL** (`materials.ts`): suelo continuo con manchas de pradera (reemplaza la textura
  ruidosa del kit), bloque de tierra con estratos, agua con orilla/espuma/reflejo, follaje con brisa y
  alpha dilatado, nieve por altura. Todo pasa por uniforms de `mood`.
- **Climas** (`moods.ts`): fondo, sol, cielo, tintes y luces de ventanas; se interpolan al cambiar.
- **Render** (`main.ts`): `WebGPURenderer` (fallback WebGL2), cámara perspectiva FOV 22°,
  DoF por profundidad (`dof` TSL) como tilt-shift, viñeta, AgX.
- **Animación**: cada celda sube y crece con `easeOutBack` y un leve balanceo; el orden lo da
  `reveal` (centro, espiral, barrido o "agua primero"), repartido con `easeInOutSine` para que la ola
  acelere y frene. Los props crecen después desde el suelo. La salida es la ola inversa.

## v2 (2026-11-03)

- **Invierno**: nieve sobre todo lo que mira hacia arriba, lagos y ríos congelados con grietas.
- **Montañas**: el macizo es terreno propio con un pico gaussiano por celda que se funde con los
  vecinos (cordones continuos), crestas por ruido ridged, nieve por altura y pinos procedurales en
  laderas suaves. A veces aparece suelto un pico chico del kit, nunca encadenado.
- **Agua**: profundidad real por vértice (color + transparencia en orillas), fresnel con el cielo,
  ondas por bump animado (brillos del sol), cáusticas animadas sobre el lecho, espuma en la orilla.
- **Tilt-shift**: foco en el pueblo (plano focal por el punto de interés), rango de foco más corto,
  cámara más alta (40°), AO de contacto (GTAO), bloom suave, grading en espacio de display
  (+contraste, +saturación), viñeta y grano.
- **Rendimiento**: los tiles del kit son `InstancedMesh` (una draw call por pieza para todo el
  tablero). Sombras 4K cacheadas: se recalculan solo mientras hay animación. Las copias extra del
  bosque no llevan troncos. Medido en M-series, tablero de radio 4: ~148 draw calls, ~0,7 M tris,
  60 FPS a 1,5× (36 FPS a 2×; el post es fill-bound).

## Assets

`pnpm assets:patagonia` regenera `public/assets/patagonia/` desde `../models/glb`
(dequantize → meshopt + WebP 512 px, igual que la fuente; ~1,7 MB en total). El dequantize previo es necesario: sin él los
vertex colors del export de Blender quedan blancos.

## Pendientes / ideas

- Grabación directa a video (MediaRecorder) en 1080×1350 / 1920×1080.
- Ríos que bajen desde la cordillera; cascadas en el corte del diorama.
- Los GLB todavía embeben texturas que la demo no usa (`suelo`, `*_normal`): quitarlas ahorraría peso.
- Los tiles espejados se descartaron con el instancing (invierten el winding); se podría volver a
  tenerlos con un segundo bucket por pieza con `side` invertido.
