---
id: 0005
title: Técnicas de optimización para 10k tiles en three.js
type: wayfinder:research
status: closed
assignee: claude
blocked_by: []
---

## Question

¿Qué técnicas de render permiten llegar a ~10k tiles visibles con props, a 60 fps en desktop y 30 fps en mobile de gama media? Cubrir: InstancedMesh vs BatchedMesh vs geometría mergeada por chunk; frustum culling por chunk; LOD; impostores; atlases y texturas KTX2/Basis; compresión meshopt/Draco; sombras (CSM, resolución, sombras estáticas cacheadas); costo del postprocesado; límites de draw calls y triángulos en mobile; y herramientas de medición (stats-gl, `renderer.info`, Spector.js).

## Research

Chunks + InstancedMesh/BatchedMesh por chunk, KTX2 + meshopt, sombra direccional única cacheada y tilt-shift de blur separable a baja resolución; objetivo ≤100–200 draws en mobile; medir con stats-gl, renderer.info, Spector.js/WebGPU Inspector. Ver [hallazgos](../research/0005-tecnicas-optimizacion-10k-tiles.md).

## Resolution

Recomendación de la investigación: el límite son las draw calls, no los triángulos. Dividir el mapa en chunks, con `InstancedMesh` por tipo de tile y `BatchedMesh` para props variados. Usar pocos materiales con atlases KTX2 y comprimir con meshopt y cuantización (no Draco). Objetivo: ≤100–200 draws en mobile y ≤300–500 en desktop. Sombras: una sola direccional ajustada a la vista isométrica, cacheada (`autoUpdate = false`); CSM probablemente no hace falta. Tilt-shift con un blur separable a ½–¼ de resolución, `pixelRatio` limitado y MSAA nativo. El costo extra de CPU de WebGPU se achica con instancing, pero el renderer debe decidirse con un benchmark en los dispositivos objetivo. Para medir: stats-gl, `renderer.info`, Spector.js y WebGPU Inspector. Los budgets de triángulos, VRAM y sombras son estimados. Detalle: [research](../research/0005-tecnicas-optimizacion-10k-tiles.md).
