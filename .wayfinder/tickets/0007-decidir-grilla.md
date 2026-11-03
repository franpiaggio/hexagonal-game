---
id: 0007
title: Decidir forma de grilla
type: wayfinder:grilling
status: closed
assignee: claude
blocked_by: [0001, 0004]
---

## Question

Con los resultados de la investigación de grillas y de algoritmos de generación a la vista, ¿la grilla es hexagonal o cuadrada (con o sin offset)? Fija las coordenadas, el paso de rotación de la cámara y las reglas de modelado de las piezas.

## Resolution

Decidido con el usuario (2026-11-03):

- **Grilla hexagonal, pointy-top.** Coordenadas axiales (q, r) en toda la lógica (s = −q−r cuando haga falta). Almacenamiento en array rectangular **odd-r**. Las coordenadas offset nunca se usan para lógica.
- **Mapa rectangular**, del orden de 100×100 celdas (~10k).
- **Cámara**: ángulo base fijo, rotación solo en pasos de 60° (6 vistas).
- **La grilla no se ve en el render.** El terreno es una malla continua con transiciones suaves entre celdas (núcleo sólido + puentes en bordes + triángulos en esquinas, estilo Catlike Coding Hex Map), con props encima.
- **Altura en niveles discretos** por celda (entero, rango a definir en el generador). Las transiciones entre niveles son terrazas, rampas o acantilados.
- **Escala**: el radio del hex mide 1 unidad de mundo. Es una escala abstracta; los modelos se escalan para representar el área y el tilt-shift vende la miniatura.
- **Overlay de grilla opcional**: contornos dibujados con shader, visibles al hacer hover o seleccionar y con un toggle de debug. Apagado por defecto.

Base: [research de grilla](../research/0001-grilla-hex-vs-cuadrada.md). Sin ADR por ahora: el nombre del proyecto ya anticipa la grilla hex, así que la decisión no sorprende.
