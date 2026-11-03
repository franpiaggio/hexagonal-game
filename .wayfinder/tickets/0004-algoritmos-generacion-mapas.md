---
id: 0004
title: Algoritmos de generación procedural de mapas
type: wayfinder:research
status: closed
assignee: claude
blocked_by: []
---

## Question

¿Qué algoritmos sirven para generar mapas de tiles con semilla, con resultado realista y en un tiempo razonable para ~10k tiles en el navegador? Cubrir: capas de ruido (simplex/FBM, domain warping) para altura, humedad y biomas; Wave Function Collapse y sus variantes para colocar piezas con restricciones de borde; ríos, costas y erosión; colocación de props (Poisson disk). Para cada uno: cómo se adapta a grilla hex y a grilla cuadrada, determinismo, costo de cómputo, librerías JS/TS existentes y referencias (Red Blob Games, Townscaper, Bad North, etc.).

## Research

Pipeline: ruido FBM + domain warp → Priority-Flood/ríos → erosión opcional → biomas → autotiling o WFC por bloques → props Poisson. Todo es agnóstico a hex/cuadrada salvo el catálogo de piezas. Hallazgos: [../research/0004-algoritmos-generacion-mapas.md](../research/0004-algoritmos-generacion-mapas.md)

## Resolution

Pipeline recomendado: en un Web Worker con sub-semillas por capa. Pasos: FBM + domain warp; Priority-Flood + Strahler para ríos y costas; erosión opcional sobre un heightmap más fino; biomas con tabla tipo Whittaker; autotiling o WFC por bloques solo para elegir piezas; props con Poisson disk por tile. El ruido para 10k tiles toma ~4 ms (estimado, no medido); la erosión ~100 ms o más. No hay un solver WFC en JS para hex, así que habría que escribirlo. Ningún algoritmo obliga a elegir hex o cuadrada. Algunos puntos están citados de memoria y quedan por verificar (domain warping de Íñigo Quílez, Bridson, precisión de `Math.*`). Detalle: [research](../research/0004-algoritmos-generacion-mapas.md).
