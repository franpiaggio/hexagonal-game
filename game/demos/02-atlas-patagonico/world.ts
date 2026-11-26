import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, IcosahedronGeometry,
  InstancedMesh, Mesh, MeshDepthMaterial, MeshStandardMaterial,
  Object3D, RGBADepthPacking, RepeatWrapping, LinearSRGBColorSpace, Vector2, type Material, type Texture,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { heightAt, riverline, shoreline, type Plan, type Prop, type TerrainData } from './landscape.ts'

type Part = { geometry: BufferGeometry; material: MeshStandardMaterial }
export type Library = Map<string, Part[]>
const ASSET_NAMES = ['fir_0', 'fir_1', 'leaf_0', 'cabin', 'chalet', 'stone', 'inn', 'shed', 'chapel', 'surface', 'litter', 'gravel', 'sand']

export async function loadLibrary(url: string): Promise<Library> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(url)
  gltf.scene.updateMatrixWorld(true)
  const library: Library = new Map(ASSET_NAMES.map(name => [name, []]))
  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return
    const name = ASSET_NAMES.find(id => object.name.startsWith(id))
    if (!name) return
    if (Array.isArray(object.material)) throw new Error('Cada pieza del atlas debe tener un material.')
    const material = object.material as MeshStandardMaterial
    if (material.map && !object.geometry.getAttribute('uv')) throw new Error(`Faltan coordenadas de textura en ${object.name}.`)
    material.metalness = 0
    material.roughness = .88
    if (name.startsWith('fir') || name.startsWith('leaf')) {
      material.side = DoubleSide
      // Preserve fine needles through mip levels when viewing a whole forest.
      if (object.name.includes('needles') || material.alphaTest > 0) {
        material.alphaTest = .065; material.alphaToCoverage = false
        material.color.setRGB(.9,1.02,.76); material.roughness = 1; material.envMapIntensity = .2
        // Blender's diffuse + separate alpha packing writes linear RGB into
        // this texture. Avoid decoding it as sRGB a second time (black firs).
        if (name.startsWith('fir') && material.map) material.map.colorSpace = LinearSRGBColorSpace
      }
      material.transparent = false
    }
    object.geometry.applyMatrix4(object.matrixWorld)
    library.get(name)!.push({ geometry: object.geometry, material })
  })
  for (const [name, parts] of library) if (!parts.length) throw new Error(`Falta la pieza ${name} en el atlas.`)
  return library
}

export type World = { group: Group; plan: Plan; time: { value: number }; dispose: () => void; triangles: number; instances: number }

export function createWorld(plan: Plan, data: TerrainData, library: Library): World {
  const group = new Group(), time = { value: 0 }
  const ownedGeometries: BufferGeometry[] = [], ownedMaterials: Material[] = []
  const batches: InstancedMesh[] = []
  let triangles = 0
  const terrain = new BufferGeometry()
  terrain.setAttribute('position', new BufferAttribute(data.positions, 3))
  terrain.setAttribute('color', new BufferAttribute(data.colors, 3))
  const uv = new Float32Array(data.positions.length / 3 * 2)
  for (let i=0; i<uv.length/2; i++) { uv[i*2]=data.positions[i*3]/3.2; uv[i*2+1]=data.positions[i*3+2]/3.2 }
  terrain.setAttribute('uv',new BufferAttribute(uv,2))
  terrain.setIndex(new BufferAttribute(data.indices, 1)); terrain.computeVertexNormals()
  terrain.setAttribute('terrainLayers',new BufferAttribute(data.layers,3))
  const surface = library.get('surface')![0].material
  const litter = library.get('litter')![0].material
  const gravel = library.get('gravel')![0].material
  const sand = library.get('sand')![0].material
  for (const material of [surface,litter,gravel,sand]) for (const texture of [material.map,material.normalMap]) if (texture) {
    texture.wrapS=texture.wrapT=RepeatWrapping; texture.anisotropy=4
  }
  const ground = new MeshStandardMaterial({ vertexColors: true, roughness: 1, map:surface.map, normalMap:surface.normalMap, normalScale:new Vector2(.65,.65), envMapIntensity:.25 })
  ground.onBeforeCompile = shader => {
    for (const [name,material] of [['litter',litter],['gravel',gravel],['sand',sand]] as const) {
      shader.uniforms[name+'Map']={value:material.map}
      shader.uniforms[name+'Normal']={value:material.normalMap}
    }
    shader.vertexShader = 'attribute vec3 terrainLayers; varying vec3 groundLayers; varying vec3 groundPosition;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n groundPosition = position; groundLayers=terrainLayers;')
    shader.fragmentShader = `
      varying vec3 groundLayers; varying vec3 groundPosition;
      uniform sampler2D litterMap, gravelMap, sandMap, litterNormal, gravelNormal, sandNormal;
    ` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 groundUV = vMapUv;
      vec3 grass = texture2D(map,groundUV).rgb;
      vec3 textureColor = mix(grass,texture2D(litterMap,groundUV*.8).rgb,groundLayers.y);
      textureColor = mix(textureColor,texture2D(gravelMap,groundUV*1.6).rgb,groundLayers.x);
      textureColor = mix(textureColor,texture2D(sandMap,groundUV*1.15).rgb,groundLayers.z);
      float luma = dot(textureColor,vec3(.2126,.7152,.0722));
      diffuseColor.rgb *= clamp(.48 + luma*3.2,.57,1.5) * mix(vec3(1.0),textureColor/max(luma,.025),.22);
      // A second, broad scale gives meadow patches without obvious tiling.
      float patches = dot(texture2D(map,mat2(.8,-.6,.6,.8)*groundUV*.16+vec2(.31,.47)).rgb,vec3(.333));
      diffuseColor.rgb *= .84 + patches*.9;
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      vec3 groundNormal = mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(litterNormal,vNormalMapUv*.8).xyz,groundLayers.y);
      groundNormal = mix(groundNormal,texture2D(gravelNormal,vNormalMapUv*1.6).xyz,groundLayers.x);
      groundNormal = mix(groundNormal,texture2D(sandNormal,vNormalMapUv*1.15).xyz,groundLayers.z);
      vec3 mapN = groundNormal*2.0-1.0;
      mapN.xy *= normalScale;
      normal = normalize(tbn*mapN);
    `)
  }
  ground.customProgramCacheKey=()=> 'atlas-layered-ground-1'
  const earth = new Mesh(terrain, ground); earth.receiveShadow = true; group.add(earth)
  ownedGeometries.push(terrain); ownedMaterials.push(ground)
  triangles += data.indices.length / 3

  // A single surface covers the water; raised land naturally occludes it.
  const waterGeometry = new BufferGeometry()
  const positions = data.positions.slice()
  for (let i = 1; i < positions.length; i += 3) positions[i] = .025
  waterGeometry.setAttribute('position', new BufferAttribute(positions, 3))
  waterGeometry.setAttribute('color', new BufferAttribute(data.waterColors, 3))
  waterGeometry.setIndex(new BufferAttribute(data.indices, 1)); waterGeometry.computeVertexNormals()
  const water = new MeshStandardMaterial({ vertexColors: true, roughness: .17, metalness: .12, envMapIntensity:1.1 })
  water.onBeforeCompile = shader => {
    shader.uniforms.uTime = time
    shader.vertexShader = 'varying vec3 waterPosition; uniform float uTime;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n waterPosition = position;')
    shader.fragmentShader = `
      varying vec3 waterPosition; uniform float uTime;
      float waterHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float waterNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+vec2(1,1)),f.x),f.y);
      }
    ` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
      #include <normal_fragment_begin>
      vec2 w = waterPosition.xz;
      float flow = waterNoise(w*.4);
      float a = sin(w.x * 6.5 + w.y * 8.0 + uTime * .6 + flow*5.0);
      float b = sin(w.x * -9.0 + w.y * 12.0 - uTime * .43 + flow*3.0);
      float c = sin(w.x * 2.1 - w.y * 1.4 + uTime * .18 + sin(w.y * .8));
      vec3 ripples = vec3(a*.035+c*.03,0.0,b*.025+c*.02);
      normal = normalize(normal + mat3(viewMatrix)*ripples);
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float wave = sin(waterPosition.x * 1.5 + waterPosition.z * 2.7 + uTime*.25 + sin(waterPosition.x*.61));
      diffuseColor.rgb *= .94 + .008*wave + .12*waterNoise(waterPosition.xz*.12);
    `)
  }
  const lake = new Mesh(waterGeometry, water); lake.receiveShadow = true; group.add(lake)
  ownedGeometries.push(waterGeometry); ownedMaterials.push(water)
  triangles += data.indices.length / 3

  const transform = new Object3D(), color = new Color()
  function instances(parts: Part[], props: Prop[], shadows = true) {
    if (!props.length) return
    for (const part of parts) {
      const geometry = part.geometry.clone(), material = part.material.clone()
      const mesh = new InstancedMesh(geometry, material, props.length)
      const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: material.map, alphaTest: material.alphaTest, side: material.side })
      mesh.customDepthMaterial = depth
      props.forEach((prop, i) => {
        transform.position.set(prop.x, prop.y, prop.z)
        transform.rotation.set(0, prop.angle, 0)
        transform.scale.setScalar(prop.scale); transform.updateMatrix()
        mesh.setMatrixAt(i, transform.matrix)
        color.setRGB(prop.tint, prop.tint, prop.tint); mesh.setColorAt(i, color)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = shadows; mesh.receiveShadow = true
      mesh.computeBoundingSphere(); mesh.computeBoundingBox()
      group.add(mesh); batches.push(mesh)
      ownedGeometries.push(geometry); ownedMaterials.push(material, depth)
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3 * props.length
    }
  }
  for (const [name, parts] of library) {
    const props = name.startsWith('fir') || name.startsWith('leaf') ? plan.trees.filter(p => p.kind === name) : plan.houses.filter(p => p.kind === name)
    // Spatial batches let the renderer cull whole off-screen forest sections.
    // A single map-wide InstancedMesh would submit every tree on every frame.
    const cells = new Map<string, Prop[]>()
    for (const prop of props) {
      const key = `${Math.floor(prop.x / 24)},${Math.floor(prop.z / 24)}`
      const cell = cells.get(key) ?? []; cell.push(prop); cells.set(key,cell)
    }
    for (const cell of cells.values()) instances(parts, cell)
  }
  const rockGeo = new IcosahedronGeometry(1, 1); rockGeo.scale(1.2, .65, .9)
  const rockMaterial = new MeshStandardMaterial({ color: '#9c9b89', roughness: 1 })
  instances([{ geometry: rockGeo, material: rockMaterial }], plan.rocks)
  rockGeo.dispose(); rockMaterial.dispose()

  // Sparse, tiny grass clusters catch grazing light at closer zoom levels.
  // No alpha overdraw, no animation, no extra textures or per-frame updates.
  const grassGeo=new BufferGeometry(), grassVertices:number[]=[], grassColors:number[]=[]
  for(let i=0;i<6;i++) {
    const angle=i*2.399, x=Math.cos(angle)*.12, z=Math.sin(angle)*.12
    const width=.025, height=.12+(i%3)*.035
    grassVertices.push(x-width,0,z, x+width,0,z, x+.04,height,z+.025)
    grassColors.push(.30,.34,.18, .30,.34,.18, .65,.67,.35)
  }
  grassGeo.setAttribute('position',new BufferAttribute(new Float32Array(grassVertices),3))
  grassGeo.setAttribute('color',new BufferAttribute(new Float32Array(grassColors),3)); grassGeo.computeVertexNormals()
  const grassMaterial=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:1,envMapIntensity:.15})
  const grassCells=new Map<string,Prop[]>()
  for(const prop of plan.grass) {
    const key=`${Math.floor(prop.x/24)},${Math.floor(prop.z/24)}`
    const cell=grassCells.get(key)??[];cell.push(prop);grassCells.set(key,cell)
  }
  for(const props of grassCells.values()) instances([{geometry:grassGeo,material:grassMaterial}],props,false)
  grassGeo.dispose();grassMaterial.dispose()

  // A short landing or bridge adds a readable human-scale detail without another asset.
  const wood = new MeshStandardMaterial({ color: '#9d8164', roughness: .85 })
  ownedMaterials.push(wood)
  function beam(width: number, height: number, depth: number, x: number, y: number, z: number) {
    const geo = new BoxGeometry(width, height, depth), mesh = new Mesh(geo, wood)
    mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true
    group.add(mesh); ownedGeometries.push(geo); triangles += 12
  }
  if (plan.bridge) {
    // Outside the village's building range, so a wide lodge cannot overlap it.
    const bx = -17.2, z = riverline(plan, bx), y = Math.max(heightAt(plan, bx, z - 2), heightAt(plan, bx, z + 2)) + .25
    beam(.75,.13,4.4,bx,y,z)
    for (const x of [bx-.34,bx+.34]) beam(.055,.06,4.4,x,y+.5,z)
    for (const x of [bx-.34,bx+.34]) for (const dz of [-1.95,0,1.95]) beam(.07,.7,.07,x,y+.2,z+dz)
  }
  if (plan.family==='bahia' || plan.family==='ladera') {
    const x=5, z=shoreline(plan,x)-.7, y=Math.max(.24,heightAt(plan,x,z+1.6)+.12)
    beam(.68,.12,3.7,x,y,z)
    for (const dx of [-.26,.26]) for(const dz of [-1.5,.9]) beam(.07,.8,.07,x+dx,y-.3,z+dz)
  }
  group.updateMatrixWorld(true)
  return { group, plan, time, triangles, instances: plan.trees.length + plan.houses.length + plan.rocks.length + plan.grass.length,
    dispose() { group.removeFromParent(); batches.forEach(mesh => mesh.dispose()); ownedGeometries.forEach(geo => geo.dispose()); ownedMaterials.forEach(mat => mat.dispose()) } }
}

export function disposeLibrary(library: Library) {
  const textures = new Set<Texture>(), materials = new Set<Material>(), geometries = new Set<BufferGeometry>()
  for (const parts of library.values()) for (const part of parts) {
    geometries.add(part.geometry); materials.add(part.material)
    for (const value of Object.values(part.material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture)
  }
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose())
}
