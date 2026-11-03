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
| 01 | [Patagonia · generador](game/demos/01-patagonia-generador/README.md) | 2026-11-03 | `demo-01` | Paisajes procedurales hex con tilt-shift, agua y macizos continuos, 4 climas, animación de armado para redes. |
| 00 | [Hex grid base](game/demos/00-hex-grid-base/main.ts) | 2026-11-03 | — | Escena inicial del scaffold (grilla flat-top de prueba). |

## Convenciones

- Una carpeta por demo, numerada. No se edita una demo vieja para hacer la nueva: se copia o se extrae a `game/src/shared/`.
- Código reutilizable entre demos: `game/src/shared/` (hex, random, …).
- Assets web optimizados: `game/public/assets/<kit>/`, generados desde `models/` con scripts en `game/scripts/`.
- `models/` es la fuente de Blender (se trabaja en paralelo); nunca se edita desde las demos.
