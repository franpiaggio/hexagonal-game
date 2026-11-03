"""Proportion pass, evaluated in the shared generator namespace.

Architectural reference: 1 grid unit represents 20 m. The original grid remains
unchanged. Mountain relief is deliberately compressed to fit a modular tile.
"""
METERS_PER_UNIT=20.0

def cabin(m,x,y,scale=1,angle=0,roof='roof'):
    # A smaller footprint is a one-storey cabin, not a uniformly shrunk house.
    two_storeys=scale>=.9
    w=.50 if two_storeys else .38
    d=.59 if two_storeys else .47
    floor=.018
    eave=.298 if two_storeys else .158
    ridge=eave+.143 if two_storeys else eave+.111
    old=m.transform.copy()
    m.transform=old @ Matrix.Translation((x,y,0)) @ Matrix.Rotation(angle,4,'Z')
    m.box((0,0,.01),(w+.025,d+.025,.02),'stone')
    if two_storeys:
        m.box((0,0,.088),(w,d,.14),'plaster')
        m.box((0,0,.228),(w,d,.14),'wood')
    else:
        m.box((0,0,.088),(w,d,.14),'wood')
    for yy in [-d/2,d/2]:
        triangle=[(-w/2,yy,eave),(w/2,yy,eave),(0,yy,ridge)]
        m.face(triangle if yy<0 else triangle[::-1],'wood')
    # Timber boards: 16 cm high, joints only 12 mm thick at the reference scale.
    low=.16 if two_storeys else .024
    for j in range(int((eave-low)/.008)):
        z=low+j*.008
        m.box((0,-d/2-.0009,z),(w,.0015,.0006),tint('wood',.79))
        m.box((w/2+.0009,0,z),(.0015,d,.0006),tint('wood',.79))
    rw=w/2+.027;rd=d/2+.027;rz=eave-.014
    for sign in [-1,1]:
        panel=[(0,-rd,ridge+.004),(sign*rw,-rd,rz),(sign*rw,rd,rz),(0,rd,ridge+.004)]
        m.face(panel if sign>0 else panel[::-1],roof)
        m.tube((sign*rw,-rd,rz),(sign*rw,rd,rz),.0025,'wood_dark',5)
        for yy in [-rd,rd]:m.tube((0,yy,ridge+.004),(sign*rw,yy,rz),.003,'wood_light',4)
        for j in range(1,15):
            yy=-rd+2*rd*j/15
            m.tube((0,yy,ridge+.005),(sign*rw,yy,rz+.001),.0008,tint(roof,.87),4)
    m.tube((0,-rd,ridge+.005),(0,rd,ridge+.005),.0035,tint(roof,1.08),6)
    # Both houses use the same 0.90 x 2.10 m door and 1.2 m windows.
    door_x=w*.23
    m.box((door_x,-d/2-.002,floor+.0525),(.045,.004,.105),'wood_dark')
    m.box((door_x,-d/2-.005,floor+.0525),(.036,.003,.096),'wood')
    m.box((door_x+.013,-d/2-.007,floor+.052),(.003,.002,.003),'stone_dark')
    def front_window(xx,z):
        m.box((xx,-d/2-.002,z),(.067,.005,.065),'wood_dark')
        m.box((xx,-d/2-.005,z),(.055,.002,.054),'window')
        m.box((xx,-d/2-.0065,z),(.0025,.002,.055),'wood_light')
        m.box((xx,-d/2-.0065,z),(.057,.002,.0025),'wood_light')
        m.box((xx,-d/2-.009,z-.034),(.077,.016,.003),'wood')
    front_window(-w*.25,.100)
    if two_storeys:
        for xx in [-w*.25,w*.23]:front_window(xx,.237)
    for yy in [-d*.27,d*.27]:
        for z in ([.10,.237] if two_storeys else [.10]):
            m.box((w/2+.002,yy,z),(.005,.067,.065),'wood_dark')
            m.box((w/2+.005,yy,z),(.002,.055,.054),'window')
            m.box((w/2+.006,yy,z),(.002,.0025,.054),'wood_light')
    m.box((-.12 if two_storeys else -.08,.12,ridge-.035),(.027,.030,.13),'stone_light')
    m.box((-.12 if two_storeys else -.08,.12,ridge+.032),(.035,.038,.006),'stone_dark')
    # Porch and optional upper balcony share human-sized railing elements.
    for z in ([.022,.163] if two_storeys else [.022]):
        front=-d/2-.10
        m.box((0,-d/2-.052,z),(w,.105,.008),'wood')
        for j in range(8):m.box((0,-d/2-.004-j*.013,z+.0044),(w,.0008,.0008),'wood_dark')
        for xx in [-w/2+.012,w/2-.012]:m.box((xx,front,z+.027),(.005,.005,.054),'wood_dark')
        m.box((0,front,z+.054),(w,.004,.004),'wood_dark')
        for j in range(1,12):
            xx=-w/2+w*j/12
            # Open the ground-floor railing in front of the door.
            if z<.1 and abs(xx-door_x)<.037:continue
            m.box((xx,front,z+.027),(.0025,.003,.05),'wood')
    m.box((door_x,-d/2-.12,.009),(.075,.045,.018),'stone')
    m.transform=old

def fence(m,pts):
    # Posts at <= 2.4 m spacing, 1.1 m high; no oversized log railings.
    samples=[]
    for p,q in zip(pts,pts[1:]):
        p=Vector(p);q=Vector(q);n=max(1,math.ceil((q-p).length/.12))
        samples.extend(tuple(p.lerp(q,i/n)) for i in range(n))
    samples.append(tuple(pts[-1]))
    for x,y in samples:m.tube((x,y,.004),(x,y,.059),.0035,'wood_dark',5)
    for p,q in zip(samples,samples[1:]):
        for z in [.024,.050]:m.tube((*p,z),(*q,z),.002,'wood',4)

original_pine=pine
def pine(m,x,y,h=1):
    ground_z=m.elevation(x,y) if hasattr(m,'elevation') else 0
    if ground_z>.62:return
    old=m.transform.copy();m.transform=old @ Matrix.Translation((0,0,ground_z))
    original_pine(m,x,y,h)
    m.transform=old

def lenga(m,x,y,h=.85):
    # Small sprays form the canopy; individual leaves are no longer oversized.
    m.tube((x,y,0),(x+.025*h,y,h*.82),.012*h,'trunk',9,.003*h)
    for i in range(17):
        a=i*2.39996+m.rng.uniform(-.25,.25)
        z=m.rng.uniform(.53,.87)*h
        reach=(.20+.09*math.sin(i*1.7))*h
        root=Vector((x,y,z*.54))
        tip=Vector((x+math.cos(a)*reach,y+math.sin(a)*reach,z))
        m.tube(root,tip,.004*h,'trunk',6,.001*h)
        for j in range(8):
            theta=a+j*2.4
            offset=Vector((math.cos(theta)*.065*h,math.sin(theta)*.065*h,m.rng.uniform(-.025,.055)*h))
            begin=tip+offset
            end=begin+Vector((math.cos(theta)*.07*h,math.sin(theta)*.07*h,.06*h))
            foliage(m,begin-Vector((0,0,.025*h)),end,.13*h,LEAF,m.rng.uniform(-1,1))

original_rock=rock
def rock(m,x,y,s=.13):
    z=m.elevation(x,y) if hasattr(m,'elevation') else 0
    old=m.transform.copy();m.transform=old @ Matrix.Translation((0,0,z))
    original_rock(m,x,y,s*.52)
    m.transform=old

original_tuft=tuft
def tuft(m,x,y,s=.07):
    z=m.elevation(x,y) if hasattr(m,'elevation') else 0
    if z>.38:return
    old=m.transform.copy();m.transform=old @ Matrix.Translation((0,0,z))
    original_tuft(m,x,y,s*.35)
    m.transform=old

original_patch=patch
def patch(m,x,y,rx,ry,color,z=.006,n=11):
    if color=='flower':rx*=.16;ry*=.16
    return original_patch(m,x,y,rx,ry,color,z,n)

def mountain(m,x,y,r,h):
    # A single continuous ridge, with a broad foot and connected spurs.
    # Height is cartographically compressed; it is not a 1:1 full mountain.
    def elevation(px,py):
        distance=min(A-px*math.cos(k*TAU/6)-py*math.sin(k*TAU/6) for k in range(6))
        u=max(0,min(1,distance/.38));fade=u*u*(3-2*u)
        xx=px/r;yy=(py-.12)/r
        main=1.8*math.exp(-((xx+.12-.27*yy)/.34)**2-((yy-.22)/.70)**2)
        shoulder=.73*math.exp(-((xx-.37)/.42)**2-((yy+.15)/.52)**2)
        foot=.36*math.exp(-(xx/.89)**2-(yy/.92)**2)
        crest=.91+.09*math.cos(9*yy+.4)
        flutes=.95+.035*math.cos(17*xx+4*yy)+.025*math.sin(23*xx-6*yy)
        return max(.001,(main*crest+shoulder+foot)*flutes*fade)*h/2.55
    m.elevation=elevation
    old=m.smooth;m.smooth=True
    corners=[Vector((R*math.cos(math.pi/6+i*TAU/6),R*math.sin(math.pi/6+i*TAU/6))) for i in range(6)]
    n=32
    for sector in range(6):
        p,q=corners[sector],corners[(sector+1)%6]
        def point(a,b):
            co=(p*a+q*b)/n
            return (co.x,co.y,elevation(co.x,co.y)+.003)
        for a in range(n):
            for b in range(n-a):
                triangles=[[point(a,b),point(a+1,b),point(a,b+1)]]
                if a+b<n-1:triangles.append([point(a+1,b),point(a+1,b+1),point(a,b+1)])
                for tri in triangles:
                    cx=sum(v[0] for v in tri)/3;cy=sum(v[1] for v in tri)/3;z=sum(v[2] for v in tri)/3
                    snowline=1.56+.10*math.sin(cx*12+cy*4)+.07*math.sin(cx*21-cy*10)
                    if z>snowline:color='snow'
                    elif z<.11:color='grass'
                    elif z<.30:
                        t=(z-.11)/.19;color=tuple(a*(1-t)+b*t for a,b in zip(rgb('grass'),rgb('stone')))
                    else:color=tint('stone',.97+.04*math.sin(cx*8+cy*6))
                    m.face(tri,color)
    m.smooth=old

