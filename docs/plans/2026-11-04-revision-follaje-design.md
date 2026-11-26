# Revisión de follaje · arrayán y coihue

Pedido: mejorar hojas, especialmente arrayanes y coihues, con más referencias. La autorización vigente permite avanzar hasta dejar variantes comparables. Blender es el destino de esta etapa.

Se revisarán los seis modelos existentes de esas dos especies en `models/vegetacion_patagonica/revision_follaje_03/`. Los ciclos anteriores se conservan como comparación. El problema observado es la repetición de ramilletes planos: ruido fino en arrayán y manchas grandes en coihue.

Dirección: hojas individuales curvas, pecíolos y ramillas; arrayán con pares opuestos, lámina ancha y borde entero; coihue con hojas alternas, más estrechas y finamente aserradas. Variar inclinación, tamaño y tono de manera moderada; brillo satinado. Mantener los portes reconocibles y revisar densidad en cámara elevada.

Retocar sólo los atlas mantendría la repetición de ramillas planas. La nueva geometría requiere más memoria, pero permite comprobar las hojas y su respuesta a la luz en Blender. Se prioriza esta opción; la optimización web queda fuera de alcance.

1/6: referencias y diagnóstico. 2/6: construir y revisar ramillas. 3/6: probar copas completas. 4/6: aplicar a tres variantes por especie. 5/6: comprobar en una escena de miniatura. 6/6: exportar, reimportar y documentar.

Validación: renders antes/después bajo la misma cámara y luz, detalle de hojas, seis modelos exportados con materiales incorporados y una copia de la bahía actual. Las fuentes botánicas y sus límites se registran en `docs/investigacion-vegetacion/13-revision-follaje-arrayan-coihue.md`.

La prueba de coihue con hojas enteramente geométricas confirmó una copa demasiado rala al corregir la escala foliar. La implementación conserva una superficie curva propia por hoja, con ocho triángulos y recorte fino del borde y pecíolo mediante alfa. Esto permite aumentar ramillas y hojas pequeñas con un peso comparable al primer piloto. Cada hoja tiene orientación y normales propias; ya no se dibuja toda una ramilla en una superficie plana.
