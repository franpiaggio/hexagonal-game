"""Small, deterministic Blender asset kit. Run in Blender's Python context."""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector, Matrix

OUT = Path('/Users/franciscopiaggio/Documents/Foto Project/assets/patagonia_base')
R = 2.0
A = math.sqrt(3)
TAU = math.tau
PALETTE = {
    'grass': '#9da982', 'grass_light': '#adb88e', 'grass_dark': '#8a9b76',
    'earth': '#ad9676', 'earth_dark': '#8d795f', 'sand': '#c8ba94',
    'pine': '#476d5d', 'pine_light': '#66816b', 'pine_dark': '#365a50',
    'leaf': '#839967', 'leaf_light': '#a1ab78', 'trunk': '#705947',
    'stone': '#929b9b', 'stone_light': '#b5b9b0', 'stone_dark': '#6c7d83',
    'snow': '#e9e9d7', 'snow_shadow': '#cddbd5',
    'wood': '#ad7c50', 'wood_light': '#c29360', 'wood_dark': '#71513b',
    'plaster': '#e7dcc0', 'roof': '#a45e47', 'roof_light': '#bb7455',
    'slate': '#526d73', 'window': '#384f52', 'glass': '#d5b579',
    'water': '#65a9a4', 'water_light': '#85bfb4', 'water_dark': '#4c9599',
    'foam': '#c5d9c4', 'flower': '#dfcc91',
}

def rgb(key):
    h = PALETTE.get(key, key).lstrip('#')
    return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))

def linear(v):
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4

def tint(c, factor):
    c = rgb(c) if isinstance(c,str) else c
    return tuple(min(1,max(0,x*factor)) for x in c)

mat = bpy.data.materials.new('Patagonia · pigmento mate / COLOR_0')
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .86
bsdf.inputs['Specular IOR Level'].default_value = .18
vc = mat.node_tree.nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'Color'
mat.node_tree.links.new(vc.outputs['Color'],bsdf.inputs['Base Color'])

class Mesh:
    def __init__(self, seed):
        self.v=[]; self.f=[]; self.c=[]; self.patch_layers={}
        self.rng=random.Random(seed)
        self.transform=Matrix.Identity(4)
    def face(self, vertices, color, jitter=0):
        start=len(self.v)
        self.v.extend(tuple(self.transform @ Vector(v)) for v in vertices)
        self.f.append(tuple(range(start,start+len(vertices))))
        c=tint(color,1+self.rng.uniform(-jitter,jitter))
        self.c.append(c)
    def polygon(self, pts, z, color):
        cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts)
        for i,p in enumerate(pts):
            q=pts[(i+1)%len(pts)]
            self.face([(cx,cy,z),(p[0],p[1],z),(q[0],q[1],z)],color)
    def box(self, center, size, color):
        x,y,z=center; a,b,c=(s/2 for s in size)
        v=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),
           (x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
        for inds in [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:
            self.face([v[i] for i in inds],color,.025)
    def tube(self, p, q, radius, color, n=5, radius_end=None):
        p=Vector(p); q=Vector(q); d=(q-p).normalized()
        u=d.cross(Vector((0,0,1)))
        if u.length < .01: u=d.cross(Vector((1,0,0)))
        u.normalize(); v=d.cross(u).normalized()
        r2=radius if radius_end is None else radius_end
        rings=[[tuple(c+r*(u*math.cos(i*TAU/n)+v*math.sin(i*TAU/n))) for i in range(n)] for c,r in [(p,radius),(q,r2)]]
        self.face(list(reversed(rings[0])),color)
        self.face(rings[1],color)
        for i in range(n):
            j=(i+1)%n
            self.face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],color,.035)
    def finish(self,name,collection):
        data=bpy.data.meshes.new(name)
        data.from_pydata(self.v,[],self.f); data.update()
        attr=data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
        values=[]
        for poly,c in zip(data.polygons,self.c):
            values.extend((*[linear(x) for x in c],1.0)*len(poly.loop_indices))
        attr.data.foreach_set('color', values)
        data.materials.append(mat)
        data.color_attributes.active_color=attr
        obj=bpy.data.objects.new(name,data); collection.objects.link(obj)
        return obj

def inside(x,y,margin=0):
    return all(x*math.cos(i*TAU/6)+y*math.sin(i*TAU/6)<=A-margin for i in range(6))

def ground(m):
    verts=[(R*math.cos(math.pi/6+i*TAU/6),R*math.sin(math.pi/6+i*TAU/6)) for i in range(6)]
    # A common border palette and exact edge positions prevent discontinuities.
    for i in range(6):
        p=verts[i]; q=verts[(i+1)%6]
        for za,zb,col in [(-.12,-.095,'earth_dark'),(-.095,-.022,'earth'),(-.022,0,'grass_dark')]:
            m.face([(p[0],p[1],za),(q[0],q[1],za),(q[0],q[1],zb),(p[0],p[1],zb)],col)
        n=8
        def point(a,b): return ((a*p[0]+b*q[0])/n,(a*p[1]+b*q[1])/n,0)
        for a in range(n):
            for b in range(n-a):
                triangles=[[point(a,b),point(a+1,b),point(a,b+1)]]
                if a+b<n-1: triangles.append([point(a+1,b),point(a+1,b+1),point(a,b+1)])
                for tri in triangles:
                    x=sum(t[0] for t in tri)/3; y=sum(t[1] for t in tri)/3
                    edge=min(A-x*math.cos(j*TAU/6)-y*math.sin(j*TAU/6) for j in range(6))
                    f=1+min(1,edge/.35)*(.018*math.sin(5*x+2*y)+.016*math.sin(2*x-4*y))
                    m.face(tri,tint('grass',f))
    m.face([(x,y,-.12) for x,y in reversed(verts)],'earth_dark')

def patch(m,x,y,rx,ry,color,z=.006,n=11):
    layer=m.patch_layers.get(z,0)+1
    m.patch_layers[z]=layer
    z += layer*.00015
    pts=[]
    for i in range(n):
        a=i*TAU/n; jitter=m.rng.uniform(.9,1.1)
        pts.append((x+rx*math.cos(a)*jitter,y+ry*math.sin(a)*jitter))
    m.polygon(pts,z,color)

def rock(m,x,y,s=.13):
    n=7
    rings=[]
    for z,r in [(0,1),(.62,.88),(.95,.43)]:
        rings.append([(x+math.cos(i*TAU/n)*s*r*m.rng.uniform(.87,1.1),y+math.sin(i*TAU/n)*s*r*.8*m.rng.uniform(.88,1.12),.015+z*s) for i in range(n)])
    for j in range(2):
        for i in range(n):
            k=(i+1)%n
            m.face([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],m.rng.choice(['stone','stone_light','stone']),.04)
    m.face(rings[-1],'stone_light',.03)

def pine(m,x,y,h=1.0):
    m.tube((x,y,.01),(x+.015,y,h*.82),.035*h,'trunk',5,.018*h)
    color=m.rng.choice(['pine','pine_light','pine_dark'])
    for level,(z,r,top) in enumerate([(.23,.29,.67),(.43,.25,.86),(.65,.19,1.03)]):
        n=9; ring=[]; shoulder=[]
        off=level*.3
        for i in range(n):
            a=i*TAU/n+off; f=m.rng.uniform(.85,1.1)
            ring.append((x+math.cos(a)*r*h*f,y+math.sin(a)*r*h*f,z*h+m.rng.uniform(-.035,.035)*h))
            shoulder.append((x+math.cos(a)*r*h*.63,y+math.sin(a)*r*h*.63,(z+(top-z)*.38)*h))
        tip=(x+.035*h,y-.025*h,top*h)
        for i in range(n):
            k=(i+1)%n
            m.face([ring[i],ring[k],shoulder[k],shoulder[i]],tint(color,.96),.055)
            m.face([shoulder[i],shoulder[k],tip],color,.045)
        m.face(list(reversed(ring)),tint(color,.86))

def lenga(m,x,y,h=.85):
    m.tube((x,y,0),(x,y,h*.7),.035*h,'trunk')
    for dx,dy,sc in [(-.12,0,.29),(.13,.04,.26),(0,-.09,.3)]:
        n=7; rings=[]
        for z,rad in [(.43,.5),(.61,1),(.85,.84),(1.02,.2)]:
            rings.append([(x+dx*h+math.cos(i*TAU/n)*sc*h*rad,y+dy*h+math.sin(i*TAU/n)*sc*h*rad,z*h+m.rng.uniform(-.035,.035)*h) for i in range(n)])
        for j in range(3):
            for i in range(n):
                k=(i+1)%n
                m.face([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],'leaf' if j<2 else 'leaf_light',.06)
        m.face(rings[-1],'leaf_light')

def tuft(m,x,y,s=.07):
    for dx,dy in [(-.4,.1),(.25,.2),(0,-.4)]:
        m.face([(x-.012,y,.007),(x+.012,y,.007),(x+dx*s,y+dy*s,s*.65)],'grass_dark')

def scatter(m,count=28,exclude=None):
    for _ in range(count):
        x=m.rng.uniform(-1.55,1.55); y=m.rng.uniform(-1.65,1.65)
        if not inside(x,y,.2) or (exclude and exclude(x,y)): continue
        tuft(m,x,y,m.rng.uniform(.04,.08))
        if m.rng.random()<.18:
            patch(m,x+.04,y,.018,.018,'flower',.018,n=5)

def path(m,points,width,color='sand',z=.012):
    # Endpoint tangents are normal to the hex sides. All ports have the same width.
    left=[]; right=[]
    for i,(x,y) in enumerate(points):
        p=Vector(points[max(0,i-1)]); q=Vector(points[min(len(points)-1,i+1)])
        tangent=(q-p).normalized(); normal=Vector((-tangent.y,tangent.x))
        left.append((x+normal.x*width/2,y+normal.y*width/2,z))
        right.append((x-normal.x*width/2,y-normal.y*width/2,z))
    for i in range(len(points)-1):
        m.face([right[i],right[i+1],left[i+1],left[i]],color)

def bezier(p0,p1,p2,p3,n=36):
    return [tuple((1-t)**3*p0[k]+3*(1-t)**2*t*p1[k]+3*(1-t)*t*t*p2[k]+t**3*p3[k] for k in range(2)) for t in [i/n for i in range(n+1)]]

def cabin(m,x,y,scale=1,angle=0,roof='roof'):
    old=m.transform.copy()
    m.transform=old @ Matrix.Translation((x,y,0)) @ Matrix.Rotation(angle,4,'Z') @ Matrix.Diagonal((scale,scale,scale,1))
    w=.88; d=.72; e=.62; peak=1.02
    m.box((0,0,.065),(w+.08,d+.06,.13),'stone')
    m.box((0,0,.25),(w,d,.38),'plaster')
    m.box((0,0,.49),(w+.025,d+.025,.25),'wood')
    for yy in [-d/2-.012,d/2+.012]:
        tri=[(-w/2,yy,e),(w/2,yy,e),(0,yy,peak)]
        m.face(tri if yy<0 else list(reversed(tri)),'wood')
    # Thin timber lines are visible when inspecting close-up.
    for z in [.40,.465,.53,.595]:
        m.box((0,-d/2-.017,z),(w,.012,.012),'wood_dark')
        m.box((w/2+.017,0,z),(.012,d,.012),'wood_dark')
    rw=w/2+.105; rd=d/2+.09; rz=e-.03
    for sign in [-1,1]:
        upper=[(0,-rd,peak+.025),(sign*rw,-rd,rz),(sign*rw,rd,rz),(0,rd,peak+.025)]
        if sign<0: upper.reverse()
        m.face(upper,roof)
        m.tube((sign*rw,-rd,rz),(sign*rw,rd,rz),.018,'wood_dark',4)
        for yy in [-rd,rd]: m.tube((0,yy,peak+.025),(sign*rw,yy,rz),.021,'wood_light',4)
        for j in range(1,7):
            yy=-rd+j*(2*rd/7)
            m.tube((0,yy,peak+.03),(sign*rw,yy,rz+.008),.0055,tint(roof,.83),4)
    m.tube((0,-rd-.015,peak+.03),(0,rd+.015,peak+.03),.022,tint(roof,1.12),5)
    # Door, simple frames and luminous muted glass.
    m.box((.19,-d/2-.018,.19),(.14,.028,.27),'wood_dark')
    m.box((.19,-d/2-.04,.06),(.22,.15,.045),'stone_light')
    for xx in [-.23]:
        m.box((xx,-d/2-.023,.265),(.195,.034,.165),'wood_dark')
        m.box((xx,-d/2-.043,.265),(.142,.008,.12),'glass')
        m.box((xx,-d/2-.05,.265),(.016,.01,.125),'wood_dark')
        m.box((xx,-d/2-.05,.265),(.15,.01,.014),'wood_dark')
    for yy in [-.19,.17]:
        m.box((w/2+.026,yy,.27),(.035,.17,.15),'wood_dark')
        m.box((w/2+.048,yy,.27),(.01,.12,.105),'window')
        m.box((w/2+.056,yy,.27),(.009,.015,.11),'wood_light')
    m.box((0,-d/2-.03,.735),(.13,.04,.15),'wood_dark')
    m.box((0,-d/2-.054,.735),(.085,.01,.105),'glass')
    m.box((-.25,.18,.94),(.12,.13,.39),'stone_light')
    m.box((-.25,.18,1.14),(.16,.17,.055),'stone_dark')
    # Small timber porch on the visible facade.
    m.box((0,-.55,.05),(.88,.3,.055),'wood')
    for xx in [-.39,.39]:
        m.box((xx,-.67,.18),(.035,.035,.27),'wood_dark')
    m.box((0,-.67,.29),(.83,.03,.03),'wood_dark')
    for xx in [-.26,-.12,.03,.18,.3]: m.box((xx,-.67,.17),(.018,.022,.22),'wood_light')
    m.transform=old

def fence(m,pts):
    for x,y in pts: m.tube((x,y,.01),(x,y,.19),.021,'wood_dark',4)
    for p,q in zip(pts,pts[1:]):
        for z in [.09,.17]: m.tube((*p,z),(*q,z),.014,'wood',4)

def mountain(m,x,y,r,h):
    n=9; rings=[]
    offsets=[m.rng.uniform(-.07,.07) for _ in range(n)]
    for level,(rad,z) in enumerate([(1,.015),(.77,.24),(.43,.55),(.28,.70),(.14,.86)]):
        ring=[]
        for i in range(n):
            a=i*TAU/n
            rr=rad*r*m.rng.uniform(.83,1.14)
            ring.append((x+math.cos(a)*rr+.13*z,y+math.sin(a)*rr-.08*z,z*h+offsets[i]*h*(.3 if level==0 else 1)))
        rings.append(ring)
    for j in range(len(rings)-1):
        for i in range(n):
            k=(i+1)%n
            col=m.rng.choice(['stone','stone_dark','stone_light']) if j<3 else m.rng.choice(['snow','snow','snow_shadow'])
            a,b,c,d=rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]
            m.face([a,b,d],col,.035); m.face([b,c,d],col,.045)
    tip=(x+.15,y-.06,h)
    for i in range(n): m.face([rings[-1][i],rings[-1][(i+1)%n],tip],'snow',.025)

def water_detail(m,points):
    for i in range(5,len(points)-4,4):
        x,y=points[i]
        patch(m,x+.04,y-.08,.10,.025,'water_light',.031,7)
    for i in [7,18,28]:
        if i<len(points):
            x,y=points[i]; m.tube((x-.07,y,.034),(x+.1,y+.012,.034),.005,'foam',4)

def make_tile(kind,seed,collection):
    m=Mesh(seed); ground(m)
    for x,y,rx,ry,col in [(-.7,.8,.5,.34,'grass_light'),(.65,-.7,.5,.32,'grass_dark'),(.2,.2,.65,.42,'grass_light')]:
        patch(m,x,y,rx,ry,tint(col,.99))
    ports=[]
    if kind=='pradera':
        patch(m,.2,-.15,.8,.44,'grass_light')
        lenga(m,-1,.65,.72); lenga(m,-.69,.89,.55)
        for x,y,s in [(.84,.66,.17),(1.02,.65,.09),(-.9,-.5,.12)]: rock(m,x,y,s)
        scatter(m,60)
    elif kind=='bosque':
        trees=[(-1.02,.55,.95),(-.55,.91,1.18),(.03,1.1,.91),(.6,.85,1.02),(1.03,.45,.84),
               (-1.1,-.15,.84),(-.58,.19,1.05),(.03,.45,1.27),(.58,.25,.98),(1.05,-.26,.8),
               (-.65,-.56,.88),(-.1,-.33,1.03),(.44,-.5,.79),(-.2,-.93,.69)]
        for x,y,h in trees:
            patch(m,x,y,.25,.2,'grass_dark'); pine(m,x,y,h)
        lenga(m,-1,-.76,.67); lenga(m,.68,-.94,.65)
        rock(m,1.28,.03,.13); scatter(m)
    elif kind=='caserio':
        patch(m,-.38,.22,.38,.48,'sand')
        patch(m,.72,-.49,.31,.36,'sand')
        path(m,[(-.27,-.11),(-.24,-.45),(.16,-.65),(.72,-.84)],.06)
        cabin(m,-.38,.28,1.04,-.12,'roof')
        cabin(m,.72,-.45,.67,.28,'slate')
        pine(m,-1.05,.9,.9); pine(m,.75,.8,.79)
        lenga(m,-1.13,-.48,.67)
        fence(m,[(-.8,-1.12),(-.43,-1.14),(-.08,-1.14),(.26,-1.04)])
        for x,y,s in [(1.18,.45,.13),(.98,.9,.09),(-.8,.72,.1)]: rock(m,x,y,s)
        scatter(m,20,lambda x,y: abs(x)<.9 and abs(y)<.7)
    elif kind=='montana':
        patch(m,0,.1,1.33,1.29,'grass_dark')
        mountain(m,.0,.15,1.5,2.55)
        for x,y,h in [(-1.12,.54,.53),(1.18,.49,.48),(-.72,-.9,.55),(-.21,-1.07,.45),(.88,-.93,.41)]: pine(m,x,y,h)
        for x,y,s in [(.05,-.64,.19),(-.48,-.68,.15),(1.12,-.23,.12),(-1.23,.02,.16)]: rock(m,x,y,s)
        scatter(m,20)
    elif kind in ('rio_recto','rio_curvo'):
        if kind=='rio_recto':
            points=bezier((-A,0),(-.65,0),(.65,0),(A,0))
            ports=[3,0]
        else:
            points=bezier((-A,0),(-.57,0),(.30,.52),(A*.5,A*math.sqrt(3)/2))
            ports=[3,1]
            # Make the last section exactly perpendicular to the receiving edge.
            end=Vector(points[-1]); tangent=Vector((.5,math.sqrt(3)/2))
            points[-2]=tuple(end-tangent*.08)
            points[1]=(-A+.08,0)
        path(m,points,.84,'sand',.018)
        path(m,points,.70,'water',.027)
        water_detail(m,points)
        positions=[(-.8,-.9,.65),(.1,-.86,.78),(1.05,-.6,.63)]
        for x,y,h in positions: pine(m,x,y,h)
        if kind=='rio_recto': lenga(m,.9,.8,.64); rock(m,-.8,.53,.17)
        else: lenga(m,-.8,.85,.65); rock(m,.17,-.47,.15)
        rock(m,.85,-.45,.11)
        scatter(m,22,lambda x,y:min((x-a)**2+(y-b)**2 for a,b in points)<.34)
    elif kind=='laguna':
        patch(m,-.24,.02,1.04,.88,'sand',.018,18)
        patch(m,-.24,.02,.94,.77,'water',.027,18)
        points=bezier((.2,0),(.65,0),(1.2,0),(A,0))
        path(m,points,.84,'sand',.018); path(m,points,.7,'water',.027)
        # Wider overlap hides the bank under the water of the lake.
        patch(m,-.12,0,.82,.65,'water',.029,18)
        patch(m,-.40,.08,.52,.31,'water_dark',.030,15)
        patch(m,-.64,-.25,.29,.12,'water_light',.032,10)
        water_detail(m,points)
        ports=[0]
        for x,y,h in [(-.8,.98,.7),(-.14,1.1,.85),(.51,.96,.65),(-1.14,-.76,.65)]: pine(m,x,y,h)
        for x,y,s in [(-1.14,.36,.18),(-1.18,.04,.12),(.36,-.8,.17),(.57,-.77,.11)]: rock(m,x,y,s)
        # A tiny wooden jetty gives a scale cue from above.
        m.box((-.22,-.67,.044),(.12,.38,.012),'wood')
        for j in range(27): m.box((-.22,-.855+j*.014,.0505),(.122,.001,.001),'wood_dark')
        for xx in [-.281,-.159]: m.box((xx,-.53,.04),(.007,.007,.085),'wood_dark')
        scatter(m,18,lambda x,y: abs(y)<.85)
    obj=m.finish(kind,collection)
    obj['tile_id']=kind; obj['radius']=R; obj['water_edges']=json.dumps(sorted(ports))
    obj['top_height']=0.0; obj['rotation_step_degrees']=60
    obj.data.calc_loop_triangles()
    return obj, {'id':kind,'file':f'glb/{kind}.glb','waterEdges':sorted(ports),
                 'triangles':len(obj.data.loop_triangles),'vertices':len(obj.data.vertices)}

# Keep the pre-existing test scene intact.
scene=bpy.data.scenes.new('PATAGONIA · verano / set base')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
library=bpy.data.collections.new('01 · Siete piezas originales')
scene.collection.children.link(library)
kinds=['pradera','bosque','caserio','montana','rio_recto','rio_curvo','laguna']
assets={}; manifest=[]
for i,kind in enumerate(kinds):
    obj,info=make_tile(kind,901+i*17,library); assets[kind]=obj; manifest.append(info)

# Export each tile at the origin before arranging any display instances.
for kind,obj in assets.items():
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=str(OUT/'glb'/f'{kind}.glb'),export_format='GLB',use_selection=True,use_active_scene=True,
                              export_yup=True,export_tangents=True,export_extras=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
library.hide_render=True
library.hide_viewport=True

demo=bpy.data.collections.new('02 · Paisaje ensamblado')
scene.collection.children.link(demo)
layout=[]
route={(-2,0):('laguna',0),(-1,0):('rio_recto',0),(0,0):('rio_curvo',0),(0,1):('rio_curvo',3),(1,1):('laguna',3)}
land={(-2,1):'bosque',(-2,2):'montana',(-1,1):'bosque',(-1,2):'montana',(0,2):'bosque',
      (-1,-1):'pradera',(0,-2):'bosque',(0,-1):'caserio',(1,-2):'pradera',(1,-1):'pradera',
      (1,0):'caserio',(2,-2):'bosque',(2,-1):'pradera',(2,0):'bosque'}
for q in range(-2,3):
    for r in range(-2,3):
        if abs(q+r)>2: continue
        kind,rotation=route.get((q,r),(land.get((q,r),'pradera'),0))
        if (q,r) not in route: rotation={(-2,2):1,(-1,2):4,(0,-2):2,(2,0):3,(2,-1):2,(1,-2):4}.get((q,r),0)
        ob=bpy.data.objects.new(f'{kind} [{q},{r}]',assets[kind].data)
        demo.objects.link(ob)
        ob.location=(math.sqrt(3)*R*(q+r/2),1.5*R*r,0)
        ob.rotation_euler.z=rotation*math.pi/3
        ob['tile_id']=kind; ob['q']=q; ob['r']=r; ob['rotationSteps']=rotation
        layout.append({'tile':kind,'q':q,'r':r,'rotationSteps':rotation})

bpy.ops.object.select_all(action='DESELECT')
for ob in demo.objects: ob.select_set(True)
bpy.context.view_layer.objects.active=next(iter(demo.objects))
bpy.ops.export_scene.gltf(filepath=str(OUT/'glb'/'paisaje_demo.glb'),export_format='GLB',use_selection=True,use_active_scene=True,
                          export_yup=True,export_tangents=True,export_extras=True,export_materials='EXPORT',export_cameras=False,export_lights=False)

presentation=bpy.data.collections.new('03 · Cámara y estudio (no exportar)')
scene.collection.children.link(presentation)
def aim(ob,target): ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Isométrica · ortográfica')
camera=bpy.data.objects.new('Isométrica · ortográfica',camera_data); presentation.objects.link(camera)
camera.location=(14,-19,23); aim(camera,(0,0,.15)); camera_data.type='ORTHO'; camera_data.ortho_scale=22.8
scene.camera=camera
light_data=bpy.data.lights.new('Sol suave de verano','AREA'); light_data.energy=1950; light_data.shape='DISK'; light_data.size=10
light=bpy.data.objects.new('Sol suave de verano',light_data); presentation.objects.link(light); light.location=(-5,-8,15); aim(light,(0,0,0))
sun_data=bpy.data.lights.new('Luz de día','SUN'); sun_data.energy=1.5; sun_data.angle=math.radians(18)
sun=bpy.data.objects.new('Luz de día',sun_data); presentation.objects.link(sun); sun.rotation_euler=(.45,-.35,-.4)
world=bpy.data.worlds.new('Fondo · papel cálido'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.68,.74,.79,1); world.node_tree.nodes['Background'].inputs[1].default_value=.7; scene.world=world

backmat=bpy.data.materials.new('Papel marfil'); backmat.diffuse_color=(*[linear(v) for v in rgb('#e6e4d9')],1); backmat.use_nodes=True
backmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=backmat.diffuse_color
backmat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1
floor_data=bpy.data.meshes.new('Fondo'); floor_data.from_pydata([(-200,-200,-.15),(200,-200,-.15),(200,200,-.15),(-200,200,-.15)],[],[(0,1,2,3)])
floor=bpy.data.objects.new('Fondo de presentación',floor_data); presentation.objects.link(floor); floor.data.materials.append(backmat)
scene.render.engine='CYCLES'; scene.cycles.samples=40; scene.cycles.use_denoising=True
scene.render.resolution_x=1800; scene.render.resolution_y=1500; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.render.filepath=str(OUT/'previews'/'paisaje_isometrico.png')
scene.view_settings.view_transform='Standard'; scene.view_settings.look='None'; scene.view_settings.exposure=0; scene.view_settings.gamma=1

# An independent catalog scene is useful when iterating on one of the seven assets.
catalog=bpy.data.scenes.new('PATAGONIA · catálogo de piezas')
catalog.world=world
catalog.render.engine='CYCLES'; catalog.cycles.samples=32; catalog.cycles.use_denoising=True
catalog.render.resolution_x=1800; catalog.render.resolution_y=1350; catalog.render.resolution_percentage=100
catalog.render.image_settings.file_format='PNG'; catalog.render.filepath=str(OUT/'previews'/'catalogo.png')
catalog.view_settings.view_transform='Standard'; catalog.view_settings.look='None'
catalog.collection.objects.link(floor)
catalog.collection.objects.link(light); catalog.collection.objects.link(sun)
catcam=bpy.data.objects.new('Cámara catálogo',camera_data.copy()); catalog.collection.objects.link(catcam)
catcam.location=(11,-17,27); aim(catcam,(0,0,.15)); catcam.data.ortho_scale=21; catalog.camera=catcam
catalog_positions=[(-5.2,3.7),(0,3.7),(5.2,3.7),(-7.8,-2),(-2.6,-2),(2.6,-2),(7.8,-2)]
for kind,(x,y) in zip(kinds,catalog_positions):
    ob=bpy.data.objects.new(kind,assets[kind].data); ob.location=(x,y,0); catalog.collection.objects.link(ob)

manifest_data={'name':'Patagonia · verano / base 01','version':1,'radius':R,'apothem':A,
 'thickness':.12,'units':'meters','orientation':'pointy-top','upAxis':'Y',
 'origin':'center of tile at ground surface','waterWidth':.70,'bankWidth':.84,'waterHeight':.027,
 'edgeOrder':'0 east, then +60 degrees in Blender XY; in Three.js direction = [cos(a),0,-sin(a)]',
 'axialToThree':'[sqrt(3)*R*(q+r/2), 0, -1.5*R*r]',
 'rotation':'Three.js rotation.y = rotationSteps * PI / 3',
 'tiles':manifest,'demoLayout':layout,'palette':PALETTE}
(OUT/'manifest.json').write_text(json.dumps(manifest_data,indent=2,ensure_ascii=False)+'\n')

bpy.context.window.scene=scene
bpy.ops.object.select_all(action='DESELECT')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.type='MATERIAL'
        area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'patagonia_base.blend'))
result={'scene':scene.name,'blend':str(OUT/'patagonia_base.blend'),'tiles':manifest,'demoTiles':len(layout)}
print(json.dumps(result,ensure_ascii=False))
