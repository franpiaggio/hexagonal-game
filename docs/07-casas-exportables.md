# Cinco casas exportables

Entrega del 3 de noviembre de 2026: cinco variantes de arquitectura patagónica/alpina para importar en otros proyectos. Mantienen los materiales, proporciones y detalles del trabajo anterior, con geometría nueva y cinco siluetas distintas.

1. Cabaña de alerce: una planta y porche cubierto.
2. Chalet con balcón: dos plantas, planta baja revocada y alerce en altura.
3. Casa de piedra: mampostería gris, postigos y pequeña cubierta de acceso.
4. Casa en L: dos alas perpendiculares, madera y revoque.
5. Casa familiar con galería: planta ancha, altillo y galería lateral cubierta.

## Archivos

- [Carpeta del kit e instrucciones](../models/casas_5/README.md).
- [Paquete ZIP](../models/casas_patagonicas_5.zip).
- [Blender editable](../models/casas_5/casas_patagonicas_5.blend).
- [Cinco GLB independientes y biblioteca conjunta](../models/casas_5/glb/).
- [Manifiesto de dimensiones y geometría](../models/casas_5/manifest.json).
- [Verificación de reimportación](../models/casas_5/validation.json).

Cada GLB contiene materiales PBR y mapas normales PNG embebidos. Una unidad representa un metro; el origen está en el centro de la huella y en el nivel inferior. glTF usa arriba +Y y frente +Z. No requiere decodificadores de compresión. Se exportan únicamente las casas, sin terreno, iluminación, cámara o animación.

Las piezas tienen entre aproximadamente 4.100 y 8.950 triángulos. Se priorizó compatibilidad de importación; las normales PNG y la geometría no usan compresión especializada. Los vidrios son opacos y reflectantes, y no se modelaron interiores. La biblioteca conjunta contiene cinco objetos con nombres estables y posiciones de catálogo; los archivos individuales arrancan en el origen.

## Reproducción

El kit incluye `generar_casas.py`, `validar_casas.py` y sus dos texturas fuente. Puede regenerarse con Blender 5.x sin abrir ni alterar los paisajes anteriores. El primer script reconstruye geometría, exporta y renderiza las vistas; el segundo reimporta los GLB, comprueba recursos, UV, tangentes, pivotes, dimensiones y triángulos y renderiza la biblioteca importada. Los comandos completos están en el README del kit.

La entrega no reemplaza automáticamente los modelos de Atlas patagónico. Su escala métrica es explícita; la biblioteca web anterior utilizaba otra adaptación de escala para la composición de la miniatura.

![Biblioteca exportada y reimportada](../models/casas_5/previews/casas_5_importadas.png)
