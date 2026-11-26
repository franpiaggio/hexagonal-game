# 03 · Pila de fichas

Prototipo de mecánica. Se saca una ficha de la pila, se gira y se apoya junto a las que ya están, y así se arma el tablero. Las fichas son las siete piezas del kit de Blender (`models/glb`), con sus materiales exportados sin cambios. La demo no agrega geometría ni efectos propios.

## Ejecutar

```bash
cd game
pnpm dev
```

Abrir `/demos/03-pila-de-fichas/`. Agregar `?seed=N` a la dirección repite la misma pila.

## Controles

| Acción | Efecto |
| --- | --- |
| Click en un hueco | Apoya la ficha actual |
| `Q` / `E`, click derecho, botones ⟲ ⟳ | Giran la ficha |
| Arrastrar con el botón izquierdo | Mueve el tablero |
| Arrastrar con el botón derecho | Gira la cámara |
| Rueda | Zoom |
| `N` | Nueva partida |

## Reglas actuales

- **Fichas:** pradera, bosque, caserío, montaña, río recto, río curvo y laguna.
  - Probabilidad de salida: pradera y bosque 9 cada una, montaña 5, caserío 4, río recto y río curvo 4 cada uno, laguna 2.
  - Pila de 40 fichas. La partida arranca con una pradera en el centro.
- **Tipo de cada borde:**
  - Agua en los bordes con agua según `models/manifest.json` (`waterEdges`).
  - En el resto, el tipo de la ficha.
  - Las orillas de río y laguna cuentan como pradera.
- **Bordes al apoyar** (se ven como barras sobre la ficha antes de apoyarla):

  | Borde | Barra | Efecto |
  | --- | --- | --- |
  | Coincide | Verde | 10 puntos |
  | No coincide | Ámbar | Permitido, sin puntos |
  | Agua contra tierra | Roja | No se puede apoyar |

- **Encaje perfecto:** al menos tres vecinos y todos coinciden. Da +20 puntos y +1 ficha a la pila.
- **Hexágono cerrado:** seis vecinos y todos coinciden. Da +60 puntos y +2 fichas más.
- **Ficha sin lugar:** si no entra en ningún hueco con ningún giro, se descarta.
- **Zona más grande:** el panel de la derecha muestra, por tipo, la zona conectada más grande, medida en fichas. En una ficha, los bordes de agua quedan conectados entre sí.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `rules.ts` | Fichas, pila, tablero, evaluación de bordes y zonas. No usa three.js. |
| `kit.ts` | Carga los GLB y dibuja los contornos de los huecos, las barras de borde y el ícono del HUD. |
| `main.ts` | Escena, cámara, entrada, HUD y bucle. |

## Assets

`bash scripts/build-fichas-assets.sh` regenera `public/assets/fichas/` desde `../models/glb`, con el mismo pipeline que `build-patagonia-assets.sh` (dequantize, meshopt y WebP). Copia las siete fichas, ríos y laguna incluidos.

## Lo que deja ver el prototipo

- Visualmente, las fichas de tierra tienen el mismo pasto en el borde. Que un bosque toque una montaña no se nota en el dibujo: la regla dice "no coincide" pero el paisaje no lo muestra. Las piezas son genéricas justamente por esto.
- Un río solo conecta con otro río o con una laguna. Sin piezas de desembocadura o de nacimiento, los cursos de agua quedan abiertos.
- Pendiente: definir los tipos de ficha a partir de la investigación de vegetación (`docs/investigacion-vegetacion`), por ejemplo pehuenar, coihual, lengal o mallín, y los bordes que cada uno necesita.
