---
id: 0003
title: Técnicas de tilt-shift realista
type: wayfinder:research
status: closed
assignee: claude
blocked_by: []
---

## Question

¿Qué técnicas logran un tilt-shift **realista** (efecto miniatura fotográfico) en tiempo real y cuánto cuestan en mobile? Comparar: blur por bandas en screen-space vs DoF basado en profundidad (bokeh, gather, CoC), cámara ortográfica vs perspectiva con FOV bajo (cuál da mejor efecto y profundidad usable), saturación y contraste, viñeta, y los demás factores del "look miniatura". Indicar implementaciones disponibles para three.js (pmndrs/postprocessing, nodos TSL, ejemplos oficiales) y su costo de GPU.

## Research

Gist: usar DoF por profundidad (CoC desde viewZ, foco en el target de cámara) en vez de banda de pantalla; en mobile, un blur gaussiano a ½ res mezclado por CoC + grading/viñeta en el mismo pase (~≤10 taps/px), `dof()` TSL o pmndrs `DepthOfFieldEffect` en desktop; cámara perspectiva FOV ~25° preferible a ortográfica. Detalle: [research/0003-tilt-shift-realista.md](../research/0003-tilt-shift-realista.md)

## Resolution

Recomendación de la investigación: DoF basado en profundidad (CoC calculado desde el depth buffer, con foco en el target de la cámara) y no una banda fija en pantalla. La banda falla con relieve y edificios (Held et al. 2010). Calidad por tier: en mobile, un blur gaussiano a media resolución mezclado por CoC, con grading y viñeta en la misma pasada (≤10 lecturas por píxel). En desktop, `dof()` en TSL o `DepthOfFieldEffect` de pmndrs. La banda queda solo como fallback mínimo. Evitar `BokehPass`. Cámara: perspectiva con FOV ~25°, preferida sobre ortográfica (inferido, sin probar). Si se usa ortográfica en r187, hay que llamar `orthographicDepthToViewZ` a mano. Los costos de GPU son estimados, no medidos. Detalle: [research](../research/0003-tilt-shift-realista.md).
