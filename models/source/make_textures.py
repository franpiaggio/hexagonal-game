"""Deterministic albedo, normal and cutout foliage textures for the miniature kit."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math, random
import numpy as np

OUT=Path(__file__).resolve().parents[1]/'textures'
OUT.mkdir(exist_ok=True)
N=512
rng=np.random.default_rng(72)

def noise_field():
    # Periodic spectral noise keeps opposite texture edges continuous.
    fy=np.fft.fftfreq(N)[:,None];fx=np.fft.rfftfreq(N)[None,:]
    frequency=fx*fx+fy*fy
    result=np.zeros((N,N),dtype=float)
    for cells,weight in [(4,.35),(12,.24),(40,.20),(128,.13),(512,.08)]:
        spectrum=np.fft.rfft2(rng.standard_normal((N,N)))
        sigma=N/cells/3
        band=np.fft.irfft2(spectrum*np.exp(-2*math.pi**2*sigma**2*frequency),s=(N,N))
        band=.5+band/max(band.std()*6,1e-9)
        result+=np.clip(band,0,1)*weight
    return result

def surface(name,variation=.25,grain=0):
    a=noise_field()
    if grain:
        line=np.asarray(Image.fromarray((rng.random((64,8))*255).astype('uint8')).resize((N,N),Image.Resampling.BICUBIC))/255
        a=a*(1-grain)+line*grain
    rgb=np.clip(.94+(a-.5)*variation,0,1)
    Image.fromarray(np.uint8(np.repeat(rgb[:,:,None],3,axis=2)*255)).save(OUT/f'{name}.png')
    dy,dx=np.gradient(a)
    normal=np.stack((-dx*1.3,-dy*1.3,np.ones_like(a)),axis=-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    Image.fromarray(np.uint8((normal*.5+.5)*255)).save(OUT/f'{name}_normal.png')

surface('suelo',.38)
surface('corteza_madera',.38,.7)
surface('piedra',.55)
surface('agua',.16,.7)

def conifer():
    S=2; n=N*S; im=Image.new('RGBA',(n,n)); d=ImageDraw.Draw(im)
    r=random.Random(924)
    def line(a,b,color,w=1): d.line([tuple(v*S for v in a),tuple(v*S for v in b)],fill=color,width=max(1,int(w*S)))
    def needle(p,angle,length,color,width=1.1):
        q=(p[0]+math.cos(angle)*length,p[1]+math.sin(angle)*length)
        line(p,q,color,width)
    # A single branching shoot; UV v=0 at the woody attachment, v=1 at the tip.
    line((256,492),(256,25),(103,93,59,255),2.2)
    for j in range(18):
        yy=460-j*22; length=90*(1-j/23)+18
        for side in [-1,1]:
            tip=(256+side*length,yy-r.uniform(30,58))
            line((256,yy),tip,(78,85,49,255),1.5)
            for k in range(17):
                t=k/17
                x=256+(tip[0]-256)*t; y=yy+(tip[1]-yy)*t
                for sign in [-1,1]:
                    angle=-math.pi/2+side*.25+sign*r.uniform(.35,1.18)
                    length=r.uniform(14,29)*(1-.37*t)
                    v=r.uniform(.77,1.24)
                    color=(int(69*v),int(91*v),int(49*v),255)
                    needle((x,y),angle,length,color,r.uniform(.8,1.5))
                    if k%3==0: needle((x+.7,y),angle,length*.74,(120,133,75,225),.65)
    for yy in range(27,475,7):
        for side in [-1,1]:needle((256,yy),-math.pi/2+side*.75,r.uniform(13,24),(88,106,57,255))
    im.resize((N,N),Image.Resampling.LANCZOS).save(OUT/'conifera.png')

def lenga():
    S=2; im=Image.new('RGBA',(N*S,N*S)); d=ImageDraw.Draw(im); r=random.Random(42)
    def line(a,b,c,w):d.line([tuple(v*S for v in a),tuple(v*S for v in b)],fill=c,width=max(1,int(w*S)))
    line((256,493),(255,58),(100,90,57,255),3)
    for j in range(9):
        y=450-j*40
        for side in [-1,1]:
            target=(256+side*r.uniform(66,119),y-r.uniform(43,67))
            line((256,y),target,(108,96,58,255),1.5)
            for k in range(5):
                t=(k+.4)/5;cx=256+(target[0]-256)*t;cy=y+(target[1]-y)*t
                sign=1 if k%2 else -1
                angle=-math.pi/2+sign*.75
                cx+=math.cos(angle)*12;cy+=math.sin(angle)*12
                length=r.uniform(22,34);width=r.uniform(12,18)
                ux,uy=math.cos(angle),math.sin(angle);vx,vy=-uy,ux
                pts=[]
                for i in range(18):
                    a=i*math.tau/18; serration=1.0 if i%2 else .94
                    pts.append(((cx+ux*math.cos(a)*length+vx*math.sin(a)*width*serration)*S,(cy+uy*math.cos(a)*length+vy*math.sin(a)*width*serration)*S))
                val=r.uniform(.82,1.17)
                col=(int(99*val),int(118*val),int(52*val),255)
                d.polygon(pts,fill=col)
                line((cx-ux*length*.8,cy-uy*length*.8),(cx+ux*length*.9,cy+uy*length*.9),(144,151,78,240),.65)
    im.resize((N,N),Image.Resampling.LANCZOS).save(OUT/'lenga.png')

conifer(); lenga()
print('Created',len(list(OUT.glob('*.png'))),'portable PBR / foliage textures')
