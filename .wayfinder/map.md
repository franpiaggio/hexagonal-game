---
label: wayfinder:map
title: Escena isométrica 3D con tilt-shift — spec técnica
---

## Destination

Una spec técnica lista para implementar del motor visual del juego: stack y renderer, tipo de grilla, cámara y tilt-shift realista, pipeline de modelos, algoritmo de generación procedural de mapas y presupuesto de performance. Todo decidido; el código se escribe después, fuera de este mapa.

## Notes

- Idioma: español. Proyecto en `game/` (Vite 8 + TypeScript strict + three.js 0.187, pnpm).
- Decidido al trazar el mapa (no son tickets):
  - Código: three.js vanilla + TS. Sin React Three Fiber.
  - Gameplay o género: todavía no definido. El motor visual va primero.
  - Objetivo de performance: hasta ~10k tiles visibles, 60 fps en desktop y 30 fps en mobile de gama media, en navegador.
  - Mapas procedurales con semilla.
  - Modelos: kits CC0 para arrancar, con un pipeline glTF que también acepte modelos propios de Blender.
  - Estilo: tilt-shift **realista** (no low-poly de juguete).
  - Cámara: ángulo isométrico fijo, con pan, zoom y rotación en pasos según la grilla (60° si es hex, 90° si es cuadrada).
- Skills a consultar: `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-shaders`, `threejs-interaction`, `threejs-animation`; `grilling` + `domain-modeling` para tickets HITL.
- Optimización desde el principio: toda decisión se evalúa contra el presupuesto de performance.

## Decisions so far

<!-- one line per closed ticket -->

- [Grilla hexagonal vs cuadrada con offset](tickets/0001-grilla-hex-vs-cuadrada.md): la investigación recomienda hex (axial + array con offset, rotación de 60°); el costo de variantes se mitiga con malla continua o WFC en la grilla dual.
- [WebGPURenderer vs WebGLRenderer](tickets/0002-renderer-webgpu-vs-webgl.md): la investigación recomienda WebGPURenderer + TSL con fallback a WebGL2; las draw calls son caras, así que hay que agrupar por chunk; condición de salida: spike en Android de gama media.
- [Algoritmos de generación procedural de mapas](tickets/0004-algoritmos-generacion-mapas.md): pipeline en worker: FBM+warp, Priority-Flood para ríos, biomas tipo Whittaker, WFC por bloques solo para piezas y Poisson para props; no hay WFC hex en JS.
- [Técnicas de tilt-shift realista](tickets/0003-tilt-shift-realista.md): la investigación recomienda DoF por profundidad (no banda), escalado por tier (gaussiano a media resolución en mobile, `dof()` TSL en desktop) y perspectiva con FOV ~25°.
- [Técnicas de optimización para 10k tiles en three.js](tickets/0005-tecnicas-optimizacion-10k-tiles.md): la investigación indica que el límite son las draw calls; propone chunks + InstancedMesh/BatchedMesh, KTX2 + meshopt, ≤100–200 draws en mobile y una sombra cacheada.
- [Pipeline de assets y kits CC0 realistas](tickets/0006-pipeline-assets-realistas.md): ningún kit CC0 sirve tal cual para el look realista; propone texturas PBR CC0 sobre geometría propia y un pipeline Blender .glb → gltf-transform (meshopt + KTX2).

## Not yet specified

- **Modelo de datos del mapa**: cómo se guardan los tiles, si se divide en chunks y cómo se manejan mapas mutables. Depende de la grilla y de los patrones de render; el género todavía no está definido.
- **Iluminación y atmósfera**: sol, sombras (cascadas, baked o mezcla), ciclo día/noche, niebla y color grading para el look de maqueta realista.
- **Elementos vivos**: agua, vegetación con viento, partículas. Shaders y su costo.
- **Interacción**: picking de tiles (raycast vs cálculo analítico en la grilla), hover y selección.
- **Arquitectura del runtime**: game loop, ECS o no, organización de sistemas.
- **Herramientas de perfilado y CI de performance**: stats, captura de GPU y budgets automatizados.

## Out of scope

- Editor manual de mapas (los mapas son procedurales).
- Diseño de gameplay o género.
- Multiplayer y backend.
- Implementación. El mapa termina en la spec.
