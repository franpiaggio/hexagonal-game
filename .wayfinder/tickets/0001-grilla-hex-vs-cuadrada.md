---
id: 0001
title: Grilla hexagonal vs cuadrada con offset
type: wayfinder:research
status: closed
assignee: claude
blocked_by: []
---

## Question

Para un juego isométrico 3D con mapas procedurales y hasta ~10k tiles, ¿qué ventajas y costos tiene una grilla hexagonal frente a una cuadrada (incluida la variante con filas desplazadas o "offset" que usan muchos juegos)? Mirar: sistemas de coordenadas (axial/cube vs offset), vecindad y pathfinding, encaje con Wave Function Collapse y otros generadores, autotiling y modelado de piezas (bordes, transiciones, cantidad de variantes), cómo se ve en isométrico, rotación de cámara (60° vs 90°), y ejemplos de juegos reales con cada opción.

## Research

Hex con coordenadas axiales (offset solo para guardar), cámara en pasos de 60°; el costo es más variantes de pieza, que se mitiga con terreno continuo con blending y piezas en grilla dual. Ver [findings](../research/0001-grilla-hex-vs-cuadrada.md).

## Resolution

Recomendación de la investigación: grilla hexagonal, con coordenadas axiales/cúbicas en la lógica, almacenamiento en array con offset y rotación de cámara en pasos de 60°. El costo principal es la cantidad de variantes de pieza; se mitiga con malla de terreno continua (Catlike Coding) o con WFC sobre la grilla dual. La "cuadrada con offset" no conviene en 3D. Cambiar a cuadrada solo si el gameplay termina siendo ortogonal (city-builder). La decisión final queda en "Decidir forma de grilla". Detalle: [research](../research/0001-grilla-hex-vs-cuadrada.md).
