---
id: 0002
title: WebGPURenderer vs WebGLRenderer
type: wayfinder:research
status: closed
assignee: claude
blocked_by: []
---

## Question

En three.js r187 (noviembre 2026), ¿conviene `WebGPURenderer` + TSL (con fallback a WebGL2) o `WebGLRenderer` clásico para este juego? Mirar: soporte de WebGPU en navegadores desktop y mobile, madurez del fallback, postprocesado (DoF/tilt-shift, SSAO, bloom) en cada camino, InstancedMesh/BatchedMesh, sombras, compute shaders útiles (generación, culling) y diferencias de performance medidas.

## Research

`WebGPURenderer` + TSL con fallback WebGL2, siempre que se use batching/instancing por chunk (el overhead por draw de #30560 sigue abierto) y que compute quede como mejora opcional; validar con un spike en Android de gama media antes de cerrar. Detalle: [../research/0002-renderer-webgpu-vs-webgl.md](../research/0002-renderer-webgpu-vs-webgl.md)

## Resolution

Recomendación de la investigación: `WebGPURenderer` + TSL con el fallback automático a WebGL2, y el postprocesado nativo de three.js (`RenderPipeline`). pmndrs/postprocessing no soporta WebGPU y está limitado a three < 0.188. Riesgos: cada draw call cuesta unas 2 veces más CPU, así que hay que agrupar por chunk (100–300 draws); los compute shaders quedan como mejora opcional; el tilt-shift se arma en TSL. Antes de confirmar, probar en un Android de gama media con los dos backends. Si no llega a 30 fps, volver a `WebGLRenderer` + pmndrs v6. La decisión final se toma en el prototipo de cámara y tilt-shift. Detalle: [research](../research/0002-renderer-webgpu-vs-webgl.md).
