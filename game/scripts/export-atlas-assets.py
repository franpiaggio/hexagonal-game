"""Export a compact, instancing-friendly web library from the approved art pipeline.

Run with Blender in background. The delivered .blend scenes are only read.
Then optimize atlas-source.glb with the command documented in demo 02/README.md.
"""
from pathlib import Path
import bpy, bmesh, runpy, sys, json, random
from mathutils import Vector, Matrix

PROJECT = Path(__file__).resolve().parents[2]
SOURCE = PROJECT / 'models/source'
DEST = PROJECT / 'game/public/assets/atlas'
DEST.mkdir(parents=True, exist_ok=True)
RAW = PROJECT / 'game/.cache/atlas'
RAW.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(SOURCE))
lib = runpy.run_path(str(SOURCE / 'build_dense_panorama.py'), run_name='web_library')
scene = bpy.data.scenes.new('Atlas web assets')
bpy.context.window.scene = scene

flat = bpy.data.materials.new('Architecture vertex colors')
flat.use_nodes = True
principled = flat.node_tree.nodes.get('Principled BSDF')
principled.inputs['Roughness'].default_value = .78
color = flat.node_tree.nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Color'
flat.node_tree.links.new(color.outputs['Color'], principled.inputs['Base Color'])

exported = []
def add(name, mesh, architecture=False):
    data = mesh.copy()
    if architecture:
        palette = []
        for material in data.materials:
            node = material.node_tree.nodes.get('Principled BSDF') if material and material.use_nodes else None
            palette.append(tuple(node.inputs['Base Color'].default_value) if node else (.3,.3,.25,1))
        if data.color_attributes.get('Color'):
            data.color_attributes.remove(data.color_attributes['Color'])
        colors = data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
        for poly in data.polygons:
            c = palette[poly.material_index]
            for i in poly.loop_indices: colors.data[i].color = c
            poly.material_index = 0
        data.materials.clear(); data.materials.append(flat)
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.select_set(True)
    exported.append(dict(name=name, vertices=len(data.vertices), triangles=sum(len(p.vertices)-2 for p in data.polygons)))
    return ob

# Reuse the lightweight lenga and the vertex-color export helper from the kit.
kit_source = (SOURCE/'build_miniatura.py').read_text().split('# Build the same topology and layout with corrected proportions.')[0]
kit = {'__file__':str(SOURCE/'build_miniatura.py')}
exec(compile(kit_source,'web_vegetation','exec'),kit)
for name, fn, seed in [('leaf_0','lenga',811)]:
    mesh = kit['Mesh'](seed)
    kit[fn](mesh,0,0,1)
    ob = mesh.finish(name,scene.collection)
    # The mesh builder links into the active scene and keeps its existing UVs.
    ob.name=name
    exported.append(dict(name=name,vertices=len(ob.data.vertices),triangles=sum(len(p.vertices)-2 for p in ob.data.polygons)))

# Keep complete textured shoots from the render library, rather than collapsing
# their UV silhouettes. Simplify only opaque wood. Both web firs stay near 5.5k tris.
tree_root = SOURCE/'cycles_assets/fir_tree_01'
foliage = bpy.data.materials.new('Atlas · fir needles'); foliage.use_nodes = True
nodes=foliage.node_tree.nodes; links=foliage.node_tree.links; bs=nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value=.9
for suffix, socket, noncolor in [('diff','Base Color',False),('alpha','Alpha',True)]:
    tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(tree_root/f'textures/fir_tree_01_twig_{suffix}_1k.png'),check_existing=True)
    if noncolor: tex.image.colorspace_settings.name='Non-Color'
    tex.image.pack(); links.new(tex.outputs['Color'],bs.inputs[socket])
foliage.surface_render_method='DITHERED'
wood=bpy.data.materials.new('Atlas · tree wood');wood.use_nodes=True
wood.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.115,.075,.035,1)
wood.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=1
with bpy.data.libraries.load(str(tree_root/'fir_tree_01.blend'),link=False) as (available,loaded):
    loaded.objects=['fir_tree_01_c_LOD2','fir_tree_01_b_LOD2']
for number, original in enumerate(loaded.objects):
    # These evaluated Geometry Nodes trees store UVMap as a generic vector
    # attribute, not a Blender UV layer. Promote it before exporting to glTF.
    source=original.data.copy()
    source_uv=source.attributes.get('UVMap')
    if source_uv is None: raise RuntimeError('Missing fir UVMap attribute')
    uv=source.uv_layers.new(name='WebUV')
    for loop in source.loops:
        index=loop.index if source_uv.domain=='CORNER' else loop.vertex_index
        value=source_uv.data[index].vector
        uv.data[loop.index].uv=(value[0],value[1])
    points=[original.matrix_world@Vector(v) for v in original.bound_box]
    lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    normalize=Matrix.Scale(1/(hi.z-lo.z),4) @ Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))) @ original.matrix_world
    twig_slots={i for i,m in enumerate(original.data.materials) if 'twig' in m.name}
    total_tris=0;total_vertices=0
    for leafy in [True,False]:
        bm=bmesh.new();bm.from_mesh(source)
        trunk_slots={i for i,m in enumerate(original.data.materials) if 'trunk' in m.name}
        keep_slots=twig_slots if leafy else trunk_slots
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index not in keep_slots],context='FACES')
        if leafy:
            seen=set();components=[]
            for vert in bm.verts:
                if vert in seen or not vert.link_faces:continue
                stack=[vert];seen.add(vert);faces=set()
                while stack:
                    current=stack.pop();faces.update(current.link_faces)
                    for edge in current.link_edges:
                        other=edge.other_vert(current)
                        if other not in seen:seen.add(other);stack.append(other)
                components.append(faces)
            random.Random(91+number).shuffle(components)
            count=0;remove=[]
            for faces in components:
                if count<5100:count+=sum(len(f.verts)-2 for f in faces)
                else:remove.extend(faces)
            bmesh.ops.delete(bm,geom=remove,context='FACES')
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
        for face in bm.faces:face.material_index=0
        data=bpy.data.meshes.new('Atlas tree part');bm.to_mesh(data);bm.free();data.transform(normalize)
        data.materials.append(foliage if leafy else wood)
        ob=bpy.data.objects.new(f'fir_{number}_'+('needles' if leafy else 'wood'),data);scene.collection.objects.link(ob)
        if not leafy:
            modifier=ob.modifiers.new('Web wood budget','DECIMATE');modifier.ratio=min(1,420/max(1,sum(len(p.vertices)-2 for p in data.polygons)))
            bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=modifier.name)
        total_vertices+=len(ob.data.vertices);total_tris+=sum(len(p.vertices)-2 for p in ob.data.polygons)
        ob.select_set(True)
    exported.append(dict(name=f'fir_{number}',vertices=total_vertices,triangles=total_tris))
    bpy.data.meshes.remove(source)
    bpy.data.objects.remove(original,do_unlink=True)

# Carrier meshes package four terrain materials in the same compressed GLB.
# They are material containers only; the runtime never renders these planes.
for slug, source_name in [('surface','grass_ground'),('litter','forest_ground_04'),('gravel','gravel_road'),('sand','gravelly_sand')]:
    ground=bpy.data.materials.new(f'Atlas · {slug}');ground.use_nodes=True
    nodes=ground.node_tree.nodes;links=ground.node_tree.links;bs=nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=1
    for suffix in ['color','normal']:
        tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(PROJECT/f'models/textures/cycles_detail/{source_name}_{suffix}.jpg'),check_existing=True);tex.image.pack()
        if suffix=='color':links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        else:
            tex.image.colorspace_settings.name='Non-Color';normal=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs['Normal'])
    bpy.ops.mesh.primitive_plane_add(size=1)
    carrier=bpy.context.object;carrier.name=slug;carrier.data.materials.append(ground)
for kind, slug, variant in [('cabaña','cabin',0),('chalet','chalet',1),('casa de piedra','stone',0),('hostería','inn',1),('galpón','shed',1),('capilla','chapel',0)]:
    choices = [p for p in lib['PROTOS'] if p['kind']==kind]
    add(slug, choices[min(variant,len(choices)-1)]['data'], True)

for ob in scene.objects: ob.select_set(True)
bpy.context.view_layer.objects.active = next(iter(scene.objects))
kit['export_tiles_glb'](filepath=str(RAW/'atlas-source.glb'),export_format='GLB',use_selection=True,
    export_animations=False,export_cameras=False,export_lights=False,export_yup=True,
    export_apply=True,export_attributes=False)
(DEST/'asset-manifest.json').write_text(json.dumps(dict(assets=exported,source='Patagonia project',
    architecture='Custom geometry from the approved Blender library; vertex-color materials',
    vegetation='Poly Haven fir_tree_01 LOD2, complete shoot thinning and decimated wood; procedural lenga',
    textures='Poly Haven fir_tree_01, grass_ground, forest_ground_04, gravel_road and gravelly_sand (CC0); procedural lenga',
    sources=['https://polyhaven.com/a/fir_tree_01','https://polyhaven.com/a/grass_ground','https://polyhaven.com/a/forest_ground_04','https://polyhaven.com/a/gravel_road','https://polyhaven.com/a/gravelly_sand','https://polyhaven.com/license']),indent=2)+'\n')
print('WEB_ASSETS_EXPORTED',json.dumps(exported),flush=True)
