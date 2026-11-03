---
id: 0006
title: Pipeline de assets y kits CC0 realistas
type: wayfinder:research
status: closed
assignee: claude
blocked_by: []
---

## Question

¿Qué kits CC0 de modelos y texturas encajan con un estilo **realista** de maqueta (no low-poly de juguete) para terreno, edificios, vegetación y props de tiles? Por ejemplo: Poly Haven, ambientCG, Quaternius, Kenney. ¿Y cómo se arma un pipeline glTF optimizado que también acepte modelos propios hechos en Blender? Cubrir: convenciones de export desde Blender, `gltf-transform` (dedup, meshopt, KTX2, simplificación), integración con Vite, presupuesto de tris y texturas por pieza, y licencias.

## Research

Texturas PBR CC0 (Poly Haven/ambientCG) sobre geometría simple propia; kits Kenney/Quaternius solo como base o placeholder; pipeline Blender → gltf-transform (meshopt + KTX2, sin join/flatten) → public/ con budgets por pieza. Ver [findings](../research/0006-pipeline-assets-realistas.md).

## Resolution

Recomendación de la investigación: ningún kit CC0 sirve tal cual para el look realista. Poly Haven es demasiado pesado y Kenney/Quaternius son low-poly estilizados. La propuesta es usar texturas PBR CC0 (Poly Haven, ambientCG) sobre geometría simple propia, con normal y AO horneados desde modelos de Poly Haven cuando haga falta. El Hexagon Kit de Kenney sirve solo como placeholder. Hay que revisar la licencia de cada pack de Quaternius. Pipeline: Blender exporta `.glb` (+Y arriba, metros), gltf-transform 4.5.1 lo procesa (desactivando flatten/join/instance) con KTX2 vía `ktx` ≥4.4.0, y el juego lo carga con GLTFLoader + KTX2Loader + MeshoptDecoder. Los assets van en `game/public/assets/` y el transcoder Basis en `public/basis/`. Los budgets por pieza son estimados. Detalle: [research](../research/0006-pipeline-assets-realistas.md).
