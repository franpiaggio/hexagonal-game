# 0006 — Pipeline de assets y kits CC0 realistas

Investigado el 2026-11-03. Versiones verificadas: three.js 0.187 y Vite 8.3.5 (instaladas en `game/node_modules`), `@gltf-transform/cli` 4.5.1 (salida de `-h` y código fuente del paquete) y el manual del exportador glTF de Blender (5.2 LTS).

## Resumen

- **No existe un kit CC0 de modelos que sea realista y además liviano.** Poly Haven tiene modelos fotoescaneados realistas, pero con conteos de producción: la mediana de la categoría *rocks* es de ~121k polígonos y la de *trees* de ~750k. Kenney y Quaternius son livianos, pero estilizados (low-poly o "toon"). Ninguno sirve tal cual descargado.
- **Estrategia recomendada:**
  1. **Texturas PBR realistas** de Poly Haven y ambientCG (CC0, unas 2000 materiales en ambientCG y ~870 texturas en Poly Haven). Aportan casi todo el realismo de maqueta.
  2. **Geometría simple y propia** (o de kits CC0 low-poly usados solo como base) con esos materiales, y bake de normales y AO desde los modelos *high-poly* de Poly Haven cuando haga falta.
  3. **Kenney Hexagon Kit** (CC0, 70 archivos) solo como placeholder para prototipar la grilla.
- **Pipeline:** Blender → `.glb` (+Y up, metros, modificadores aplicados, ORM empaquetado) → `gltf-transform` (dedup, prune, weld, simplify con borde bloqueado, meshopt, KTX2 con UASTC para normal y ORM y ETC1S para color) → `game/public/assets/` → `GLTFLoader` + `KTX2Loader` + `MeshoptDecoder`.
- **Ojo con `optimize`:** por defecto hace `flatten`, `join` e `instance`, y eso fusiona las piezas de un kit. En una librería de piezas hay que desactivarlo.
- **Licencias:** Poly Haven, ambientCG y Kenney son CC0 sin atribución. Quaternius es contradictorio: su página general de licencia dice "Quaternius Asset License" (prohíbe redistribuir los assets sueltos), pero las páginas de cada pack dicen CC0. Hay que verificar pack por pack.

## 1. Fuentes de assets: encaje con el estilo y licencia

| Fuente | Qué ofrece | Encaje con "maqueta realista" | Licencia |
|---|---|---|---|
| **Poly Haven** | ~870 texturas PBR (507 *outdoor*, 131 *terrain*, 125 *rock*, 108 *brick*, 38 *cobblestone*, 23 *roofing*), 521 modelos, HDRIs | **Alto en texturas y HDRIs.** Modelos realistas pero pesados: *rocks* con mediana ~121k (mín. 6k), *trees* con mediana ~750k (hasta 17M), *buildings* con solo 13 piezas (fachadas y puertas, sin casas completas). Sirven como fuente *high-poly* para bake o con decimación fuerte. | CC0, "You do not need to give credit". Solo los assets: logos, renders y texto del sitio no. Si se usa la **API en vivo** se exige el crédito "Powered by Poly Haven". |
| **ambientCG** | ~2000 materiales PBR, atlas de hojas y follaje (`LeafSet*`, `Foliage*`), decals, HDRIs | **Alto.** Ideal para suelo, roca, pasto, ladrillo y techos. Los atlas de hojas sirven para *alpha cards* de vegetación barata. | CC0 1.0. Permite incluir los archivos crudos en un juego. Atribución opcional. |
| **Kenney** | Hexagon Kit (70 archivos; tags *hexagon*, *terrain*, *building*; v2.0 con color map), Nature Kit, etc. | **Bajo** (low-poly de juguete). Útil como placeholder de grilla y para medidas. | CC0, "Attribution is not required". El logo de Kenney no se puede usar. |
| **Quaternius** | Medieval Village MegaKit (304 piezas modulares texturizadas; glTF, FBX y OBJ; tier gratis ~60-70%), Stylized Nature MegaKit, Ultimate Nature Pack, Buildings, Farm, etc. | **Medio-bajo.** Estilizado ("Stylized", "Toon", "Ghibli"). Las piezas modulares de edificios sirven como base geométrica para retexturizar con PBR. | Contradicción: `/license.html` dice QAL v1.0 ("No attribution is required", pero prohíbe "Resell or redistribute the Assets themselves"). La página del MegaKit dice CC0. Revisar el LICENSE de cada descarga. Usarlos dentro del juego compilado está permitido con cualquiera de las dos licencias. |

**Conclusión de estilo.** En una vista tilt-shift el realismo viene sobre todo de los **materiales PBR fotográficos, la iluminación y el DOF**, no de la cantidad de polígonos. A la distancia de cámara isométrica, la geometría simple con buenas texturas y normal maps horneados se lee como maqueta real. Por eso el gasto va en texturas compartidas, no en geometría.

## 2. Exportar desde Blender (modelos propios o retexturizados)

Basado en el manual del add-on glTF 2.0 de Blender:

- **Ejes y unidades:** activar *Transform ▸ Y Up* ("Export using glTF convention, +Y up"). glTF usa metros: modelar con 1 unidad de Blender = 1 m y fijar una convención de proyecto (por ejemplo, tile hex de 1 m entre caras planas, origen en el centro y base en y=0).
- **Malla:** *Apply Modifiers* (exporta la malla evaluada). Exportar UVs y normales. Tangentes solo si el normal map lo necesita (three.js puede calcularlas). Quads y n-gons se triangulan. Las costuras de UV y los bordes *flat* duplican vértices, así que conviene minimizarlos.
- **Materiales:** usar solo Principled BSDF.
  - Metallic en el canal **B** y Roughness en el **G** de la misma imagen (con *Separate RGB*, Color Space *Non-Color*).
  - AO en el canal **R** mediante el node group *glTF Material Output* con input *Occlusion*. Así queda un solo mapa **ORM** por material.
  - Normal map en *Tangent Space* (el único soportado), con +Y up (convención OpenGL; Poly Haven y ambientCG ofrecen la variante GL).
- **Imágenes:** exportar PNG (sin pérdida) y dejar la compresión a la etapa de `gltf-transform`. No exportar WebP desde Blender si después se va a pasar a KTX2.
- **Metadatos:** *Include ▸ Custom Properties* exporta las propiedades como `extras` en el glTF (útil para `tileType`, `biome`, `variant`, `lod`). three.js las expone en `object.userData`.
- **Organización:** un `.glb` por familia de piezas (por ejemplo `terrain.glb`, `trees.glb`) con nodos con nombre, o el *Collection exporter* (con opción de exportar en el centro de la colección). Tener en cuenta que *GPU Instances* (`EXT_mesh_gpu_instancing`) exige que las instancias sean mallas sin hijos.

## 3. Optimización con gltf-transform (CLI 4.5.1)

Instalación: `pnpm add -D @gltf-transform/cli` (o global con `npm i -g @gltf-transform/cli`). Usa Sharp para las imágenes. Para KTX2 hace falta **KTX-Software ≥ 4.4.0** con el binario `ktx` en el PATH; el código del CLI falla con `Command "ktx" not found` si no está. Se descarga de los releases de KhronosGroup/KTX-Software.

Paso 1, diagnóstico: `gltf-transform inspect in.glb` muestra si el modelo pesa por geometría, por texturas o por draw calls.

**Comportamiento por defecto de `optimize`** (de `optimize -h`):

| Opción | Default |
|---|---|
| `--compress` | `meshopt` |
| `--flatten` | `true` |
| `--join` | `true` |
| `--instance` | `true` (mín. 5) |
| `--palette` | `true` |
| `--simplify` | `true` (`--simplify-ratio 0`, `--simplify-error 0.0001`) |
| `--texture-compress` | `auto` (recomprime en el formato original) |
| `--texture-size` | `2048` |

Con `--texture-compress ktx2`, el código aplica **UASTC** (nivel 4, RDO con λ=4) a `normalTexture`, `occlusionTexture` y `metallicRoughnessTexture`, y **ETC1S** (calidad 255) al resto (base color y emisivo).

**Receta propuesta para una librería de piezas de tiles** (sin fusionar las piezas, porque se instancian en runtime con `InstancedMesh` o `BatchedMesh`):

```bash
gltf-transform optimize raw/trees.glb public/assets/trees.glb \
  --flatten false --join false --instance false \
  --simplify-lock-border true --simplify-error 0.001 \
  --texture-compress ktx2 --texture-size 1024 \
  --compress meshopt
```

- `--simplify-lock-border` evita que se abran grietas en los bordes compartidos entre tiles vecinos. `weld` va antes de simplificar (ya incluido en `optimize`).
- Para LODs: `gltf-transform simplify in.glb lod1.glb --ratio 0.5 --error 0.001` (después `weld`). Según su `-h`, con `ratio 0.5` y `error 0.001` apunta al 50% limitado a 0.1% de error.
- Control fino por textura: `uastc` / `etc1s` con `--pattern` o `--slots` (por ejemplo, UASTC solo en normal maps).
- Alternativa: **gltfpack** (meshoptimizer). `-cc` para meshopt, `-tc` para KTX2/BasisU (requiere un build nativo con soporte de texturas), `-si R` para simplificar, `-kn`/`-km` para conservar nodos y materiales con nombre, `-mi` para instancing. Cuantiza por defecto con `KHR_mesh_quantization`. Recomendación: gltf-transform como herramienta principal (scriptable desde Node), gltfpack como plan B.

## 4. Carga en three.js 0.187 y Vite 8

- `GLTFLoader` en 0.187 soporta `KHR_mesh_quantization`, `KHR_texture_basisu`, `EXT_meshopt_compression`, `EXT_mesh_gpu_instancing`, `EXT_texture_webp` y `EXT_texture_avif` (comentario de cabecera de `examples/jsm/loaders/GLTFLoader.js`).

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ktx2 = new KTX2Loader()
  .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
  .detectSupport(renderer);            // obligatorio antes de cargar
const gltfLoader = new GLTFLoader()
  .setKTX2Loader(ktx2)                 // debe llamarse antes de cargar (si no, GLTFLoader lanza error)
  .setMeshoptDecoder(MeshoptDecoder);
```

- **Transcoder Basis:** copiar `node_modules/three/examples/jsm/libs/basis/{basis_transcoder.js,basis_transcoder.wasm}` (~570 KB) a `game/public/basis/`. Conviene hacerlo con un script `postinstall` o `predev` para que siga a la versión de three.
- **Vite 8:** `.glb` y `.ktx2` **no** están en `KNOWN_ASSET_TYPES` de Vite 8.3.5, así que un `import x from './a.glb'` falla sin configuración. Hay dos opciones:
  - (a) **Recomendada:** dejar los assets en `game/public/assets/`. Se sirven tal cual y se copian a `dist/`, con URLs del tipo `${import.meta.env.BASE_URL}assets/trees.glb` (el proyecto usa `base: './'`).
  - (b) Agregar `assetsInclude: ['**/*.glb', '**/*.ktx2']` o usar el sufijo `?url` para obtener hashing de nombres y cache-busting.
- Estructura sugerida: `game/assets-src/` (`.blend` y `.glb` crudos, fuera del bundle) → script `pnpm assets` que corre gltf-transform → `game/public/assets/`.

## 5. Presupuestos por pieza (propuesta derivada, a validar en el ticket de performance)

Se derivan del objetivo del mapa: ~10k tiles visibles, 60 fps en desktop y 30 fps en mobile de gama media. Son estimaciones de diseño, no cifras de una fuente.

| Pieza | Tris LOD0 | LOD1 | Texturas |
|---|---|---|---|
| Tile de terreno (hex o cuadrado) | 50–200 | 12–50 | Materiales tileables compartidos 1024² (color ETC1S + normal/ORM UASTC); sin textura única por tile |
| Roca o prop chico | 200–800 | 50–200 | Atlas o trim sheet compartido de 1024² |
| Árbol o arbusto | 500–2000 (tronco + *cards* de hojas con alpha clip) | 100–300, o impostor | Atlas de hojas 1024² (ambientCG `LeafSet`/`Foliage`) |
| Edificio | 1000–4000 | 200–800 | Trim sheet de 2048² compartido por todo el set de edificios |

- **Total de escena:** con 10k tiles de ~100 tris quedan ~1M tris de terreno. Si se suman ~3k props instanciados de ~500 tris, el total ronda 2–3M en desktop. Mobile requiere LOD1 y cull por distancia.
- **VRAM por textura** (aritmética): 1024² RGBA8 sin comprimir ocupa 4 MB, ~5.3 MB con mips. Una textura KTX2 transcodificada a ASTC 4×4 o BC7 ocupa 1 byte/píxel (~1.4 MB con mips), y a ETC1/BC1 ocupa 0.5 B/px (~0.7 MB). Por eso KTX2 es obligatorio en mobile.
- **Regla de materiales:** pocos materiales compartidos (atlas o trim sheets) para que las piezas puedan entrar en `InstancedMesh` o `BatchedMesh` y bajar los draw calls. Esto se cruza con el ticket 0005 (optimización de 10k tiles).

## 6. Licencias: resumen operativo

- Poly Haven, ambientCG y Kenney: CC0, sin atribución, uso comercial permitido y redistribución permitida. Igual conviene dejar `CREDITS.md` con las URLs de origen como buena práctica.
- Poly Haven: si se integra su **API en vivo** (no es el caso, porque bajamos archivos), exige "Powered by Poly Haven". Su ToS prohíbe el scraping del sitio sin permiso: descargar a mano o vía la API.
- Quaternius: verificar en cada pack si es CC0 o QAL. Con QAL no se puede publicar el `.glb` suelto en un repo público como "asset pack"; incluirlo en el juego distribuido sí está permitido.
- Los modelos propios de Blender son nuestros, sin restricciones.

## Fuentes

- Poly Haven, licencia: https://polyhaven.com/license
- Poly Haven API (conteos y categorías consultados el 2026-11-03): https://api.polyhaven.com/assets?type=models, https://api.polyhaven.com/categories/models, https://github.com/Poly-Haven/Public-API
- ambientCG, licencia: https://docs.ambientcg.com/license/; API: https://ambientcg.com/api/v2/full_json
- Kenney, licencia: https://kenney.nl/support; Hexagon Kit: https://kenney.nl/assets/hexagon-kit
- Quaternius: https://quaternius.com/, https://quaternius.com/license.html, https://quaternius.com/packs/medievalvillagemegakit.html
- Blender, exportador glTF 2.0: https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html
- glTF Transform CLI: https://gltf-transform.dev/cli; `gltf-transform optimize|simplify|uastc|etc1s -h` (v4.5.1) y código `@gltf-transform/cli/dist/cli.mjs` (`KTX_SOFTWARE_VERSION_MIN = "4.4.0"`, slots UASTC/ETC1S en `optimize`)
- KTX-Software: https://github.com/KhronosGroup/KTX-Software
- gltfpack: https://meshoptimizer.org/gltf/
- three.js KTX2Loader: https://threejs.org/docs/pages/KTX2Loader.html; `game/node_modules/three/examples/jsm/loaders/GLTFLoader.js` (extensiones, `setKTX2Loader`, `setMeshoptDecoder`)
- Vite, assets: https://vite.dev/guide/assets; `game/node_modules/vite/dist/node/chunks/node.js` (`KNOWN_ASSET_TYPES` sin glb/ktx2)
