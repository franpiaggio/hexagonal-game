# Glossary

**Celda**
Una posición de la grilla hexagonal del mundo, identificada por sus coordenadas axiales (q, r). Es la unidad de lógica del juego; no es un objeto visible.
_Avoid_: tile (cuando se habla de lógica), casilla, hex suelto

**Mapa**
El conjunto rectangular de celdas que forma un mundo generado a partir de una semilla.
_Avoid_: nivel (choca con Nivel de altura), escenario

**Semilla**
El valor que determina por completo el resultado de la generación de un Mapa.
_Avoid_: seed (en prosa en español)

**Nivel de altura**
La altura entera y discreta de una Celda. Celdas vecinas con niveles distintos se conectan con una terraza, una rampa o un acantilado.
_Avoid_: elevación continua, altura (sin calificar)

**Terreno**
La superficie continua que se ve, derivada de las Celdas y sus Niveles de altura. Oculta la grilla.
_Avoid_: tiles, piso

**Prop**
Un objeto visual ubicado sobre el Terreno (árbol, roca, casa) y asociado a una Celda.
_Avoid_: decoración, asset (en sentido de objeto del mundo)

**Overlay de grilla**
Los contornos de Celdas dibujados encima del Terreno, solo al hacer hover, al seleccionar o en modo debug.
_Avoid_: wireframe, grid helper
