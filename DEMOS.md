# Demos

Bitácora de experimentos visuales. Cada demo vive en `game/demos/NN-nombre/`, tiene su propio
`README.md`, y queda marcada en git con el tag `demo-NN` para volver a ese estado exacto.

```bash
cd game
pnpm install
pnpm dev            # http://localhost:5173 → índice de demos
pnpm build          # dist/ con todas las demos (sitio estático)
```

| # | Demo | Fecha | Tag | Qué prueba |
|---|------|-------|-----|------------|
| 04 | [Inspector de piezas](game/demos/04-inspector/README.md) | 2026-11-25 | — | Debugger: cada ficha y casa por separado, objetos por material, aislar, wireframe, tipos de borde y giro. |
| 03 | [Pila de fichas](game/demos/03-pila-de-fichas/README.md) | 2026-11-25 | — | Prototipo de mecánica: pila de fichas del kit, giro, bordes que coinciden, agua solo con agua, bonus de fichas y zonas. |
| 02 | [Atlas patagónico · pequeños mundos](game/demos/02-atlas-patagonico/README.md) | 2026-11-03 | — | Generador independiente con seis familias, caseríos pequeños, bosque de ramas texturizadas, relieve y suelo por capas, fundido óptico, cámara orbital, tilt-shift y calidad adaptativa. |
| 01 | [Patagonia · generador](game/demos/01-patagonia-generador/README.md) | 2026-11-03 | `demo-01`, `demo-01.2` | Paisajes procedurales hex con tilt-shift, agua y macizos continuos, 5 climas (incl. invierno), animación de armado para redes. v2: montañas en cordón, agua realista, AO+bloom, instancing. |
| 00 | [Hex grid base](game/demos/00-hex-grid-base/main.ts) | 2026-11-03 | — | Escena inicial del scaffold (grilla flat-top de prueba). |

## Convenciones

- Una carpeta por demo, numerada. No se edita una demo vieja para hacer la nueva: se copia o se extrae a `game/src/shared/`.
- Código reutilizable entre demos: `game/src/shared/` (hex, random, …).
- Assets web optimizados: `game/public/assets/<kit>/`, generados desde `models/` con scripts en `game/scripts/`.
- `models/` es la fuente de Blender (se trabaja en paralelo); nunca se edita desde las demos.
