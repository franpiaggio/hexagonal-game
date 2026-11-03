---
id: 0010
title: Decidir pipeline de generación de mapas
type: wayfinder:grilling
status: open
assignee:
blocked_by: [0007]
---

## Question

Con la forma de grilla fijada, ¿qué etapas tiene el generador procedural y en qué orden? Partir del pipeline que propone [Algoritmos de generación procedural de mapas](0004-algoritmos-generacion-mapas.md) (ruido, ríos, erosión, biomas, selección de piezas, props). Definir: qué etapas entran en la primera versión, autotiling vs WFC para elegir piezas (escribir un solver hex o no), si se usa erosión, las garantías de determinismo de la semilla (PRNG, precisión de `Math.*` entre navegadores) y cómo corre en Web Workers.
