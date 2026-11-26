# Traslado del render a RTX 5070 en Windows

El usuario confirmó una RTX 5070 de escritorio con Windows después de consultar el costo de continuar en la M2 Pro. La Mac sigue renderizando: no solicitó detenerla. La consulta midió 250/810 cuadros terminados y unas 54,6 horas de render pendientes en la Mac. Los benchmarks agregados sugieren una mejora grande, pero todavía no hay una medición de estas escenas en esa PC.

## Decisión

Preparar un paquete independiente, con las cinco copias animadas canónicas, sus bibliotecas relativas y una instantánea de los PNG terminados. No modificar las escenas, los ajustes revisados ni el orquestador que está funcionando en la Mac. No copiar todo el histórico del proyecto: incluir únicamente dependencias y evidencia necesaria, con hashes.

El lanzador de Windows usará el Python incluido en Blender 5.2, sin exigir otra instalación de Python. Seleccionará explícitamente la RTX 5070 mediante OptiX y rechazará una ejecución accidental en CPU u otra versión de Blender. Los resultados nuevos se guardarán por separado de la referencia Metal.

## Prueba y continuidad

Primero renderizar tres cuadros consecutivos de Punta y tres de Costa: Punta incluye agua, hojas y humo; Costa cubre el bosque de coihues más exigente. Los de Costa se eligen alrededor del punto de reanudación, con dos cuadros solapados con la Mac y el primero faltante. Guardar dispositivo, versión, tiempos y receta efectiva, junto con los PNG. Comparar esos resultados y la unión entre equipos antes de habilitar una producción que mezcle ambas procedencias. Este es un control técnico de continuidad; no declara que la RTX ya esté validada.

Después de la revisión, reanudar los cuadros faltantes de la instantánea. No sobrescribir PNG terminados. Cada cuadro se publica mediante un archivo temporal y un renombrado, y se registra en un índice con hash. La cola comprobará integridad y cambiará de proceso cada doce cuadros. Un archivo de parada permitirá cerrar después del cuadro en curso. Mantener un bloqueo de ejecución para impedir dos colas simultáneas en el mismo paquete.

## Límites de validación

En la Mac se pueden comprobar sintaxis, selección de cuadros, integridad del paquete, resolución de rutas y manejo de interrupciones mediante pruebas del orquestador. No se puede certificar el rendimiento de OptiX, la memoria disponible ni ejecutar el lanzador de Windows en el equipo actual. Esas comprobaciones se realizarán con la prueba corta en la PC. El traslado no debe detener la producción actual antes de tener el paquete listo y una instrucción clara de cambio.
