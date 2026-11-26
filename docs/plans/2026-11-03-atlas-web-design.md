# Atlas patagónico · generador web interactivo

## Encargo

Crear una subcarpeta con un generador de mapas animado, cámara rotatable y mapas nuevos, optimizado para navegador. Mantener como referencia las miniaturas aprobadas: verano, lagos extensos, vegetación natural, caseríos pequeños y profundidad de campo visible.

## Decisión

Nueva demo independiente en `game/demos/02-atlas-patagonico/`, integrada en el índice y compilación Vite existentes. Paisaje continuo con seis familias de distribución, semillas reproducibles en URL y cámara orbital con límites para conservar el encuadre. Controles explícitos para generar, repetir la animación y volver a la vista inicial.

Se reutiliza una biblioteca compacta de geometrías del trabajo de Blender. Cada árbol y edificio se instancia; se evita cargar la escena de render completa. El terreno se calcula en un worker y el agua tiene una animación de normales ligera. El posprocesado ofrece desenfoque de miniatura con calidad adaptativa.

Alternativas consideradas: ampliar la demo hexagonal existente, o cargar directamente un escenario GLB completo. La nueva demo continua permite variar la geografía y conservar la escala rural; la biblioteca compartida mantiene acotados descarga y draw calls.

## Interfaz

Paisaje a pantalla completa. Tipografía editorial, tinta verde y superficies marfil discretas. Un encabezado pequeño identifica la escena y la semilla; una barra inferior concentra paisaje, generación y cámara. Mouse: arrastrar para orbitar, rueda para zoom. Touch: un dedo para rotar y pellizco para zoom. Teclado y botones equivalentes, foco visible y respeto por movimiento reducido.

## Verificación

Compilación TypeScript/Vite, comprobaciones de determinismo y posiciones del generador, revisión visual en navegador, cambios repetidos de mapa, controles orbitales, tamaño móvil y observación de draw calls / memoria. Registrar mediciones reales y límites en el README de la demo.

## Simplificación solicitada

La revisión elimina todo el texto y los controles superpuestos. Quedan el paisaje y un único botón circular con icono para generar un mapa nuevo. La cámara conserva sus gestos y atajos; el tilt-shift y la calidad automática permanecen activos. Carga y reintento comparten ese botón. Se conservan etiquetas y anuncios accesibles sin texto visible.
