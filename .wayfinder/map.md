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

## Not yet specified

- **Modelo de datos del mapa**: cómo se guardan los tiles, si se divide en chunks y cómo se manejan mapas mutables. Depende de la grilla y de los patrones de render; el género todavía no está definido.
- **Iluminación y atmósfera**: sol, sombras (cascadas, baked o mezcla), ciclo día/noche, niebla y color grading para el look de maqueta realista.
- **Elementos vivos**: agua, vegetación con viento, partículas. Shaders y su costo.
- **Interacción**: picking de tiles (raycast vs cálculo analítico en la grilla), hover y selección.
- **Generación en workers y determinismo**: semilla reproducible, generación off-main-thread y streaming.
- **Arquitectura del runtime**: game loop, ECS o no, organización de sistemas.
- **Herramientas de perfilado y CI de performance**: stats, captura de GPU y budgets automatizados.

## Out of scope

- Editor manual de mapas (los mapas son procedurales).
- Diseño de gameplay o género.
- Multiplayer y backend.
- Implementación. El mapa termina en la spec.
