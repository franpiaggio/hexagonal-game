---
id: 0005
title: Técnicas de optimización para 10k tiles en three.js
type: wayfinder:research
status: open
assignee:
blocked_by: []
---

## Question

¿Qué técnicas de render permiten llegar a ~10k tiles visibles con props, a 60 fps en desktop y 30 fps en mobile de gama media? Cubrir: InstancedMesh vs BatchedMesh vs geometría mergeada por chunk; frustum culling por chunk; LOD; impostores; atlases y texturas KTX2/Basis; compresión meshopt/Draco; sombras (CSM, resolución, sombras estáticas cacheadas); costo del postprocesado; límites de draw calls y triángulos en mobile; y herramientas de medición (stats-gl, `renderer.info`, Spector.js).
