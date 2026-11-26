"""Read-only measurements and controlled surface renders from the saved scene.

Run in Blender. Never saves or overwrites the production .blend or PNGs.
Use --render to produce three equal-camera diagnostic crops.
"""
from pathlib import Path
import argparse, collections, hashlib, json, math, sys, time
import bpy
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
OUT = HERE/'evidencias'
OUT.mkdir(exist_ok=True)
SOURCE = PROJECT/'models/vegetacion_patagonica/escenas/02_caserio_del_cipres.blend'
sys.path.insert(0,str(PROJECT/'models/vegetacion_patagonica/source'))
from arboles import metal


def stats(values):
    a = np.asarray(values,dtype=float)
    return dict(min=round(float(a.min()),5),median=round(float(np.median(a)),5),max=round(float(a.max()),5))


def upstream(socket):
    found = {}
    def visit(s):
        for link in s.links:
            n = link.from_node
            if n.name in found:
                continue
            found[n.name] = n
            for child in n.inputs:
                visit(child)
    visit(socket)
    return list(found.values())


def material_info(mat):
    p = mat.node_tree.nodes.get('Principled BSDF')
    data = dict(name=mat.name,channels={})
    for key in ['Base Color','Roughness','Normal']:
        nodes = upstream(p.inputs[key])
        data['channels'][key] = dict(
            immediate=[f'{l.from_node.name}.{l.from_socket.name}' for l in p.inputs[key].links],
            image_names=sorted({n.image.name for n in nodes if n.type=='TEX_IMAGE' and n.image}),
            node_names=[n.name for n in nodes],
        )
    data['noise'] = [dict(name=n.name,scale=n.inputs['Scale'].default_value,detail=n.inputs['Detail'].default_value,
        vector_linked=n.inputs['Vector'].is_linked) for n in mat.node_tree.nodes if n.type=='TEX_NOISE']
    data['bump'] = [dict(name=n.name,distance=n.inputs['Distance'].default_value,strength=n.inputs['Strength'].default_value)
        for n in mat.node_tree.nodes if n.type=='BUMP']
    data['roughness_default'] = p.inputs['Roughness'].default_value
    return data


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--render',action='store_true')
    a = args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    sc = bpy.context.scene
    terrain = next(o for o in sc.objects if o.name.startswith('Terreno continuo'))
    rocks = [o for o in sc.objects if o.name.startswith('Afloramiento')]
    sc.camera = bpy.data.objects['Cámara · detalle de la ladera']
    bpy.context.view_layer.update()
    width,height = sc.render.resolution_x,sc.render.resolution_y
    to_meters = 500
    def projection(p):
        v = world_to_camera_view(sc,sc.camera,p)
        return Vector((v.x*width,v.y*height))
    rock_info = []
    for ob in rocks:
        points = [ob.matrix_world@Vector(p) for p in ob.bound_box]
        pix = [projection(p) for p in points]
        dims = [float(ob.dimensions[i])*to_meters for i in range(3)]
        footprint = [(max(p[i] for p in pix)-min(p[i] for p in pix)) for i in range(2)]
        rock_info.append(dict(name=ob.name,dimensions_m=dims,projected_bbox_px=footprint,
            local_position=list(ob.location),mesh=ob.data.name))
    coords = np.empty(len(terrain.data.vertices)*3,dtype=np.float32)
    terrain.data.vertices.foreach_get('co',coords)
    coords = coords.reshape(-1,3)
    xs,ys = np.unique(coords[:,0]),np.unique(coords[:,1])
    points = [Vector((-5*.04,4*.04,.9*.04)),Vector((0,0,.2*.04))]
    ppms = []
    for p in points:
        ppms.append(dict(point_world=list(p),x_pixels_per_meter=(projection(p+Vector((.002,0,0)))-projection(p)).length,
            y_pixels_per_meter=(projection(p+Vector((0,.002,0)))-projection(p)).length))
    images = [dict(name=im.name,size=list(im.size),colorspace=im.colorspace_settings.name,
        packed=bool(im.packed_file)) for im in bpy.data.images if im.source=='FILE']
    data = dict(source=str(SOURCE.relative_to(PROJECT)),source_sha256=original_hash,
        camera=sc.camera.name,resolution=[width,height],lens_mm=sc.camera.data.lens,
        fstop=sc.camera.data.dof.aperture_fstop,exposure=sc.view_settings.exposure,
        look=sc.view_settings.look,view_transform=sc.view_settings.view_transform,
        cycles=dict(samples=sc.cycles.samples,min_samples=sc.cycles.adaptive_min_samples,
            adaptive_threshold=sc.cycles.adaptive_threshold,denoising=sc.cycles.use_denoising,
            denoising_input_passes=sc.cycles.denoising_input_passes,denoising_prefilter=sc.cycles.denoising_prefilter),
        lights=[dict(name=o.name,type=o.data.type,energy=o.data.energy,color=list(o.data.color)) for o in sc.objects if o.type=='LIGHT'],
        rock_count=len(rocks),unique_rock_meshes=len({o.data.name for o in rocks}),
        rock_size_x_m=stats([r['dimensions_m'][0] for r in rock_info]),
        rock_size_z_m=stats([r['dimensions_m'][2] for r in rock_info]),
        rock_pixel_width=stats([r['projected_bbox_px'][0] for r in rock_info]),
        terrain=dict(vertices=len(coords),polygons=len(terrain.data.polygons),
            grid_x_step_m=stats(np.diff(xs)*20),grid_y_step_m=stats(np.diff(ys)*20),
            modifiers=[dict(name=m.name,type=m.type) for m in terrain.modifiers],
            world_scale=list(terrain.matrix_world.to_scale())),
        pixels_per_meter=ppms,rocks=rock_info,images=images,
        terrain_material=material_info(terrain.data.materials[0]),
        rock_material=material_info(rocks[0].data.materials[0]))
    (OUT/'auditoria_actual.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print('SURFACE_AUDIT',json.dumps({k:data[k] for k in ['rock_count','unique_rock_meshes','rock_size_x_m','rock_size_z_m','rock_pixel_width','terrain','pixels_per_meter']},ensure_ascii=False),flush=True)

    if a.render:
        metal(sc)
        sc.cycles.seed = 1029
        sc.cycles.samples = 128
        sc.cycles.adaptive_min_samples = 32
        sc.cycles.adaptive_threshold = .018
        sc.render.use_border = True
        sc.render.use_crop_to_border = True
        sc.render.border_min_x,sc.render.border_max_x = .23,.75
        sc.render.border_min_y,sc.render.border_max_y = .22,.80
        render_reports = []
        for name,dof,denoise in [('01_dof_y_denoise',True,True),('02_sin_dof',False,True),('03_sin_dof_sin_denoise',False,False)]:
            sc.camera.data.dof.use_dof = dof
            sc.cycles.use_denoising = denoise
            sc.render.filepath = str(OUT/f'{name}.png')
            start = time.time()
            bpy.ops.render.render(write_still=True)
            render_reports.append(dict(file=f'{name}.png',dof=dof,denoise=denoise,samples=128,
                seconds=round(time.time()-start,2),border=[.23,.75,.22,.80]))
            print('DIAGNOSTIC_RENDER',name,flush=True)
        (OUT/'renders.json').write_text(json.dumps(render_reports,indent=2)+'\n')
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==original_hash
    print('ORIGINAL_UNCHANGED',original_hash,flush=True)

if __name__=='__main__':
    main()
