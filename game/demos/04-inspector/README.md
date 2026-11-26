# 04 · Inspector de piezas

Herramienta de depuración para mirar una pieza del kit por vez: las siete fichas (`public/assets/fichas`) y las cinco casas (`public/assets/patagonia/casas`), con los materiales exportados sin cambios.

Abrir `/demos/04-inspector/`. Agregar `?pieza=rio_curvo` a la dirección abre directamente esa pieza (sirve cualquier id del kit o de casas).

## Qué muestra

- **Objetos:** cada malla de la pieza, que en general es un objeto por material, con nombre, triángulos, vértices, texturas, alpha test y vertex color.
  - La casilla oculta o muestra la malla.
  - Un click la aísla; otro click vuelve a mostrar todas.
- **Datos:** archivo y peso, totales, materiales, resolución de las texturas, tamaño y tipos de borde.
- **Bordes y tipos:** en las fichas, el contorno del hexágono y la etiqueta `k · tipo` de cada borde. Son los mismos tipos que usan las reglas del juego (`../03-pila-de-fichas/rules.ts`).
- **Giro:** rota la pieza de a 60° y muestra cómo cambian los tipos de borde.
- **Opciones de vista:** wireframe, grilla y ejes, caja contenedora y fondo oscuro.
- **Lectura al pasar el cursor:** nombre de la malla, material y altura del punto.
