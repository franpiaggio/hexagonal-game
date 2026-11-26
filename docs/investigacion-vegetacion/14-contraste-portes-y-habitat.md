# Contraste de portes y hábitat

Revisión del 5 de noviembre de 2026 a partir de las observaciones sobre lenga, coihue y ciprés. La comparación corresponde a especies y ambientes, con referencia principal al norte de la Patagonia andina.

## Resultado

Las observaciones coinciden ampliamente con las fichas del proyecto. La precisión principal corresponde a la lenga achaparrada, cuya abundancia debe referirse al ambiente de altura. La implementación actual representa parcialmente los gradientes de tamaño, forma y hábitat que ya estaban documentados.

## Lenga

En Nahuel Huapi, APN diferencia un bosque de lenga con árboles de **15–25 m**, aproximadamente entre **1000 y 1500 m s. n. m.**, y un matorral achaparrado de **1,5–2,5 m**, aproximadamente entre **1400 y 1600–1700 m s. n. m.** El matorral forma una franja densa próxima al límite superior del bosque. Esto respalda una variante mucho más baja y extendida para las escenas de altura. [APN, bosque y matorral de lenga](https://nahuelhuapi.gov.ar/bosque-y-matorral-de-lenga/).

El estudio de Barrera y colaboradores en el Valle de Andorra describe formas postradas y decurrentes, además de árboles intermedios con base curvada. Allí predominaba el bosque erguido y el krummholz ocupaba una franja de unos 20–30 m de ancho. Por tanto, la afirmación «la achaparrada es la más común» requiere precisar el lugar observado. La evidencia consultada permite afirmarlo para determinados sectores del límite arbóreo. [Barrera et al., 2000, estudio original UNLP/CADIC](https://api.naturalis.fcnym.unlp.edu.ar/server/api/core/bitstreams/b2340ded-c4ea-4fda-83e1-c19a47613aea/content).

La altitud cambia con la latitud. En Tierra del Fuego la lenga crece desde el nivel del mar y, en sitios favorables, supera los 30 m de altura. El porte bajo depende también de la exposición y las condiciones locales. [Instituto Fueguino de Turismo, guía de campo](https://fdm.tierradelfuego.org.ar/es/guia-campo/399).

La [ficha existente](especies/02-lenga.md) ya describe bosque alto, tronco curvado y krummholz rastrero. La auditoría de los modelos da **23,63 m** para `lenga_bosque`, **13,20 m** para `lenga_torcida` y **4,12 m** para `lenga_achaparrada`. El generador conserva un eje principal ascendente en esta última. Su silueta compacta requiere desarrollar ejes laterales y una copa próxima al suelo para representar el matorral de altura. La colección de veinte escenas emplea las variantes bosque y torcida.

## Coihue

La observación del gran tamaño está respaldada. Un estudio de rodales antiguos en Puyehue obtuvo para coihue un **percentil 95 de altura de 49,4 m**, con más de 10 m de diferencia respecto de las otras especies estudiadas. Ese número describe la población muestreada en sitios favorables, como referencia para grandes emergentes. [Parada, Jara y Lusk, 2003, estudio original](https://www.scielo.cl/scielo.php?pid=S0717-92002003000200007&script=sci_arttext).

La [ficha existente](especies/01-coihue.md) ya indica **35–45 m**, hasta **50 m**, y condición emergente. Los maestros revisados miden **27,76 m** (`coihue_adulto`) y **35,43 m** (`coihue_emergente`). En la colección reciente, el joven aparece en 18 escenas, el adulto en una y el emergente en otra. El reparto favorece visualmente el bosque joven. Para mostrar un coihual maduro corresponde reforzar la presencia de fustes gruesos, copas amplias y emergentes, según el ambiente representado.

## Ciprés de la cordillera

La asociación con roca es correcta. APN describe suelos pedregosos poco profundos, fuertes pendientes y laderas secas de exposición norte en Nahuel Huapi. [APN, bosque de transición](https://nahuelhuapi.gov.ar/bosque-de-transicion/). El muestreo de ocho sitios de Chubut de La Manna también encontró cipresales sobre suelos profundos y distintos materiales parentales. Conviene tratar la roca como una asociación frecuente dentro de una amplitud ecológica mayor. [La Manna, 2005, estudio original CIEFAP/CONICET](https://www.scielo.cl/scielo.php?pid=S0717-92002005000200017&script=sci_arttext).

La variación de forma también está documentada. La ficha oficial chilena registra portes columnares y, en poblaciones septentrionales sometidas a estrés, formas arrodilladas, agrupadas, de tenedor, candelabro y arpa. Su arquitectura usual mantiene un tronco principal. Estas formas extremas tienen un contexto regional concreto y sirven como referencias para ampliar la diversidad con criterio. La expresión «raros» puede describir sus siluetas singulares. Una afirmación sobre escasez requeriría especificar población o localidad. [MMA Chile, ficha de antecedentes, páginas 1–3](https://clasificacionespecies.mma.gob.cl/wp-content/uploads/2019/10/Austrocedrus_chilensis_14RCE_FINAL.pdf).

La [ficha existente](especies/06-cipres-cordillera.md) ya contempla roca, ecotono, pendiente y cambios de copa con edad. La colección reciente usa joven y adulto, con selección por comunidad. Quedan por representar la variante envejecida y una distribución que responda a roca, pendiente y exposición.

## Procedencia de la auditoría del proyecto

Las medidas anteriores proceden de los JSON de exportación, en metros del modelo maestro. Las instancias de escena tienen escalas adicionales. Los criterios de selección proceden del generador de la colección de veinte imágenes.

- [Medidas de lengas](../../models/vegetacion_patagonica/blend/lenga.json).
- [Coihue adulto revisado](../../models/vegetacion_patagonica/revision_follaje_03/blend/coihue_adulto.json) y [emergente](../../models/vegetacion_patagonica/revision_follaje_03/blend/coihue_emergente.json).
- [Generador de árboles](../../models/vegetacion_patagonica/source/arboles.py).
- [Generador de Bosques y aguas](../../models/source/bosques_y_aguas_20/render.py).

Las propuestas de modelado de esta nota son interpretaciones para el proyecto basadas en la evidencia citada.
