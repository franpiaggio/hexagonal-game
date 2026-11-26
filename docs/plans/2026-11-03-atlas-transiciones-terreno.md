# Atlas: transiciones y terreno

## Pedido

Eliminar el crecimiento de árboles al generar mapas y mejorar el piso plano. Mantener la estética de miniatura, el único botón, el giro de cámara y el rendimiento web.

## Decisión de transición

Fundir paisajes completos mediante una captura GPU de la vista saliente. Frente a un viaje de cámara, conserva el encuadre que eligió el usuario; frente a un corte o fundido a negro, mantiene continuidad visual. Una curva quíntica de 1,35 s suaviza la mezcla y un breve desenfoque acompaña el cambio. La entrada inicial tarda 0,85 s. No se escala ni se desplaza individualmente ningún árbol, roca o edificio.

El mapa anterior permanece visible durante el cálculo en worker. Al recibir el siguiente, se captura la vista anterior, se reemplaza el mundo y se calculan las nuevas sombras una vez. El botón permanece ocupado hasta terminar el fundido. La preferencia de movimiento reducido realiza el reemplazo directamente. Los recursos del mundo anterior se liberan; la transición requiere una textura de pantalla, no dos bosques vivos.

## Decisión de terreno

Combinar lomas amplias, pliegues menores y una transición gradual a la cota del agua. Bases horizontales para las casas suavemente integradas con la pendiente. Las posiciones de árboles, construcciones y piedras usan el mismo campo de altura que la malla.

Mezclar cuatro materiales de Poly Haven ya presentes en el proyecto: pasto, suelo de bosque, camino de ripio y arena con piedras. Sus mapas de color y normales se exportan comprimidos dentro de un solo GLB. Las máscaras se calculan en worker según bosque, caminos, accesos y costa. Pequeñas matas de pasto instanciadas complementan el detalle al acercarse.

## Validación

Cinco pruebas automatizadas: UV de las piezas texturizadas, determinismo, distribución de 60 combinaciones, buffers de terreno y capas, y relieve/costa/bases de edificios. Compilación TypeScript y Vite. Revisión en navegador de los estados inicial, intermedio y final de la transición, carga de shaders, regeneración, zoom y rotación. Las mediciones y capturas se registran en el documento de verificación de la demo.
