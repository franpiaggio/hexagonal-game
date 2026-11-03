---
id: 0002
title: WebGPURenderer vs WebGLRenderer
type: wayfinder:research
status: open
assignee:
blocked_by: []
---

## Question

En three.js r187 (noviembre 2026), ¿conviene `WebGPURenderer` + TSL (con fallback a WebGL2) o `WebGLRenderer` clásico para este juego? Mirar: soporte de WebGPU en navegadores desktop y mobile, madurez del fallback, postprocesado (DoF/tilt-shift, SSAO, bloom) en cada camino, InstancedMesh/BatchedMesh, sombras, compute shaders útiles (generación, culling) y diferencias de performance medidas.
