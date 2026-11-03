---
id: 0012
title: Picking e interacción con celdas
type: wayfinder:grilling
status: open
assignee:
blocked_by: []
---

## Question

Con grilla hex pointy-top, terreno continuo y niveles de altura discretos (ver [Decidir forma de grilla](0007-decidir-grilla.md)), ¿cómo se detecta qué celda está bajo el puntero? Opciones: raycast contra la malla del terreno y conversión a axial; raycast analítico contra los planos de cada nivel con cube rounding; o un ID buffer en GPU. Definir también los estados de interacción (hover, selección, overlay) y los controles de cámara (pan, zoom, rotación de 60°) en desktop y touch.
