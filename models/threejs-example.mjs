/**
 * Copy this asset folder into your web app's public directory.
 * Requires the project's existing `three` dependency.
 *
 * const kit = await loadPatagonia('/patagonia_miniatura/');
 * scene.add(kit.createDemo());
 * const camera = createPatagoniaCamera(canvas.clientWidth / canvas.clientHeight);
 *
 * Provide soft ambient + directional lighting and enable shadows in your renderer.
 * The GLBs contain geometry, vertex colors and embedded textures; camera blur is separate.
 * The Blender preview uses AgX, soft sunlight, and depth of field.
 *
 * Seven tiles, radius 2, ground at Y=0, bottom at Y=-0.26, Y-up.
 * Pointy-top hex grid; rotation steps are 60 degrees around Y.
 * Tiles use textured PBR materials and alpha-tested foliage, 2,139–23,760 triangles.
 * Keep the supplied vertex colors when changing materials.
 * Materials/geometries are shared between clones: dispose them once per kit.
 *
 * API references:
 * https://threejs.org/docs/pages/GLTFLoader.html
 * https://threejs.org/docs/pages/OrthographicCamera.html
 */
import { Group, OrthographicCamera } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const AXIAL_NEIGHBORS = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
];

export function axialToWorld(q, r, radius = 2) {
  return [Math.sqrt(3) * radius * (q + r / 2), 0, -1.5 * radius * r];
}

const mod6 = n => ((n % 6) + 6) % 6;

export async function loadPatagonia(baseUrl = '/patagonia_miniatura/') {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) throw new Error(`Patagonia manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  const loader = new GLTFLoader();
  const templates = new Map(await Promise.all(manifest.tiles.map(async tile => {
    const gltf = await loader.loadAsync(`${base}${tile.file}`);
    gltf.scene.traverse(node => {
      if (node.isMesh) node.castShadow = node.receiveShadow = true;
    });
    return [tile.id, gltf.scene];
  })));
  const definitions = new Map(manifest.tiles.map(tile => [tile.id, tile]));

  function createTile(id, q, r, rotationSteps = 0) {
    if (!templates.has(id)) throw new Error(`Unknown Patagonia tile: ${id}`);
    if (!Number.isInteger(rotationSteps)) throw new Error('Rotation steps must be integers');
    const tile = templates.get(id).clone(true);
    tile.name = `${id} [${q},${r}]`;
    tile.position.set(...axialToWorld(q, r, manifest.radius));
    tile.rotation.y = mod6(rotationSteps) * Math.PI / 3;
    tile.userData = { ...tile.userData, tileId: id, q, r, rotationSteps: mod6(rotationSteps) };
    return tile;
  }

  function edges(id, rotationSteps = 0) {
    const tile = definitions.get(id);
    if (!tile) throw new Error(`Unknown Patagonia tile: ${id}`);
    return Array.from({ length: 6 }, (_, edge) =>
      tile.waterEdges.includes(mod6(edge - rotationSteps)) ? 'water' : 'land');
  }

  function createDemo() {
    const group = new Group();
    group.name = 'Patagonia · verano';
    for (const tile of manifest.demoLayout) {
      group.add(createTile(tile.tile, tile.q, tile.r, tile.rotationSteps));
    }
    return group;
  }

  return { manifest, createTile, createDemo, edges };
}

export function createPatagoniaCamera(aspect = 1.2) {
  const halfHeight = 9.5;
  const camera = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .1, 150);
  camera.position.set(14, 23, 19);
  camera.lookAt(0, .15, 0);
  return camera;
}
