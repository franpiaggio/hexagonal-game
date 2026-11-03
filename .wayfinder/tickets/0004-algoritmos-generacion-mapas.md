---
id: 0004
title: Algoritmos de generación procedural de mapas
type: wayfinder:research
status: open
assignee:
blocked_by: []
---

## Question

¿Qué algoritmos sirven para generar mapas de tiles con semilla, con resultado realista y en un tiempo razonable para ~10k tiles en el navegador? Cubrir: capas de ruido (simplex/FBM, domain warping) para altura, humedad y biomas; Wave Function Collapse y sus variantes para colocar piezas con restricciones de borde; ríos, costas y erosión; colocación de props (Poisson disk). Para cada uno: cómo se adapta a grilla hex y a grilla cuadrada, determinismo, costo de cómputo, librerías JS/TS existentes y referencias (Red Blob Games, Townscaper, Bad North, etc.).
