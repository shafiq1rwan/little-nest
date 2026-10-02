"""Native Blender plant set matched to the v2 sheet; staged assets only.

blender --background --python tools/blender/build-plants-v2.py -- --output art-source/models-v2/plants
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ap=argparse.ArgumentParser()
ap.add_argument('--output',required=True)
ap.add_argument('--keys',nargs='*')
args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
OUT=Path(args.output).resolve()
KEYS=['plant','monstera','fern','snakePlant','palm','rubberTree','planter','succulent','bonsai','macrame','vase']
SMALL={'succulent','bonsai','vase'}
COLORS={'cream':'eadac0','clay':'c47743','caramel':'b98546','soil':'493323',
        'leaf':'496e2d','light':'62853b','deep':'355923','sage':'80964e',
        'wood':'b87946','bark':'76502e','cord':'ddc397','black':'393932',
        'rose':'e9927d','yellow':'e5b66b','ash':'a5b466'}

def material(color,role='fixed'):
    color=COLORS.get(color,color)
    name=f'{key}.{role}.{color}'
    m=bpy.data.materials.get(name)
    if m: return m
    m=bpy.data.materials.new(name)
    rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*rgb,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.87
    return m

def adopt(o,name,color,role='fixed',smooth=False):
    o.name=f'{key}_{name}'
    o.parent=root
    o.data.materials.clear()
    o.data.materials.append(material(color,role))
    o['role']=role
    o['recolor']=role=='recolor'
    for p in o.data.polygons: p.use_smooth=smooth
    parts.append(o)
    return o

def mesh(name,verts,faces,color,role='fixed',smooth=False):
    me=bpy.data.meshes.new(name)
    me.from_pydata(verts,[],faces)
    me.update()
    bm=bmesh.new();bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-9)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);scene.collection.objects.link(o)
    return adopt(o,name,color,role,smooth)

def lathe(name,profile,color,role='fixed',n=20,center=(0,0,0),smooth=True,rib=0):
    verts=[]
    for r,z in profile:
        for i in range(n):
            a=i*math.tau/n
            radius=r*(1+rib*(1 if i%2 else -1))
            verts.append((center[0]+radius*math.cos(a),center[1]+radius*math.sin(a),center[2]+z))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    return mesh(name,verts,faces,color,role,smooth)

def pot(radius,height,color='cream',center=(0,0,0),ribbed=False,mini=False):
    # Rounded taper and a genuine open rim, consistent with the approved cactus.
    p=[(0,0),(.72*radius,0),(.80*radius,.04*height),(.98*radius,.88*height),
       (radius,height),(.88*radius,height),(.84*radius,.87*height)]
    o=lathe('pot',p,color,'recolor',n=10 if mini else 32 if ribbed else 24,
            center=center,rib=.025 if ribbed else 0)
    lathe('soil',[(0,.88*height),(.86*radius,.88*height),(.86*radius,.91*height),(0,.91*height)],
          'soil',n=8 if mini else 16,center=center,smooth=False)
    return center[2]+height

def tube(name,points,radii,color='leaf',n=5,role='fixed'):
    points=[Vector(p) for p in points]
    if isinstance(radii,(int,float)): radii=[radii]*len(points)
    verts=[]
    for j,p in enumerate(points):
        axis=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
        side=axis.cross(Vector((0,1,0)))
        if side.length<.01: side=axis.cross(Vector((1,0,0)))
        side.normalize();other=axis.cross(side).normalized()
        for i in range(n):
            a=i*math.tau/n
            verts.append(tuple(p+radii[j]*(side*math.cos(a)+other*math.sin(a))))
    faces=[tuple(reversed(range(n)))]
    for j in range(len(points)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    faces.append(tuple((len(points)-1)*n+i for i in range(n)))
    return mesh(name,verts,faces,color,role,True)

def leaf(name,start,end,width,color='leaf',arch=.015,thick=.005,n=6,rings=9,normal=(0,-.8,.6)):
    start,end=Vector(start),Vector(end)
    axis=end-start
    d=axis.normalized()
    norm=Vector(normal);norm=(norm-d*norm.dot(d)).normalized()
    if norm.length<.01: norm=Vector((1,0,0))
    side=d.cross(norm).normalized()
    verts=[]
    for j in range(rings):
        t=j/(rings-1);shape=math.sin(math.pi*t)**.72
        mid=start+axis*t+norm*(arch*math.sin(math.pi*t))
        for i in range(n):
            a=i*math.tau/n
            verts.append(tuple(mid+side*(width*.5*shape*math.cos(a))+norm*(thick*shape*math.sin(a))))
    faces=[]
    for j in range(rings-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    return mesh(name,verts,faces,color,smooth=True)

def blob(name,pos,scale,color='leaf',detail=1,role='fixed'):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail,radius=1,location=pos)
    o=adopt(bpy.context.object,name,color,role)
    o.scale=scale
    return o

def box(name,pos,size,color='wood',role='fixed',bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=adopt(bpy.context.object,name,color,role)
    o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft edge','BEVEL');mod.width=bevel;mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def make_plant():
    pot(.235,.43)
    tips=[(-.16,.01,1.35),(.36,.03,1.22),(-.40,0,1.13),(.49,-.01,.91),
          (-.45,-.03,.79),(.38,-.11,.66),(-.23,-.14,.64)]
    for i,end in enumerate(tips):
        start=Vector((0,0,.46));tip=Vector(end)
        base=start+(tip-start)*.52
        tube(f'stem_{i}',[start,base],.012,'deep')
        leaf(f'leaf_{i}',base,tip,.26 if i<4 else .23,'light' if i%3==0 else 'leaf',arch=.035,thick=.010,n=8)

def make_rubberTree():
    pot(.225,.40)
    tube('trunk_left',[(0,0,.35),(-.05,.02,.75),(-.09,.025,1.12)],[.027,.02,.01],'bark',n=7)
    tube('trunk_right',[(.015,0,.37),(.09,.01,.73),(.11,0,1.05)],[.025,.018,.008],'bark',n=7)
    pairs=[((-.075,.02,.94),(-.30,.02,1.32),.27),((.10,0,.87),(.35,.015,1.22),.28),
           ((-.045,.01,.75),(-.48,-.01,.99),.29),((.08,0,.70),(.48,-.03,.96),.29),
           ((-.015,0,.52),(-.41,-.12,.65),.25),((.045,0,.50),(.40,-.10,.64),.24),
           ((.07,.04,.75),(.31,.16,.89),.23)]
    for i,(start,end,width) in enumerate(pairs):
        d=Vector(end)-Vector(start);base=Vector(start)+d*.12
        tube(f'petiole_{i}',[start,base],.007,'bark')
        leaf(f'broad_leaf_{i}',base,end,width,'deep' if i%3==0 else 'leaf',arch=.035,thick=.011,n=8)
        tube(f'midrib_{i}',[base,base+d*.40,base+d*.70],[.004,.003,.0015],'light',n=3)

def split_leaf(name,start,end,width,color):
    # Real edge cuts with a raised midrib and a closed underside.
    outline=[(0,0),(.12,-.08),(.26,-.06),(.38,.04),(.45,.18),(.46,.28),
             (.40,.36),(.22,.39),(.40,.42),(.41,.51),(.35,.61),(.15,.62),
             (.30,.68),(.25,.78),(.15,.90),(0,1)]
    outline += [(-x,y) for x,y in reversed(outline[1:-1])]
    start,end=Vector(start),Vector(end);direction=end-start;d=direction.normalized()
    norm=Vector((0,-1,.32));norm=(norm-d*norm.dot(d)).normalized();side=d.cross(norm).normalized()
    verts=[]
    for offset in [.004,-.004]:
        for x,t in outline:
            verts.append(tuple(start+direction*t+side*(x*width)+norm*(offset+.025*math.sin(math.pi*t))))
    count=len(outline)
    faces=[]
    flat=[Vector((x,t,0)) for x,t in outline]
    for triangle in tessellate_polygon([flat]):
        ids=tuple(v if isinstance(v,int) else flat.index(v) for v in triangle)
        faces.append(ids)
        faces.append(tuple(count+i for i in reversed(ids)))
    for i in range(count):
        j=(i+1)%count
        faces.append((i,count+i,count+j,j))
    mesh(name,verts,faces,color)

def make_monstera():
    pot(.255,.43)
    leaves=[((-.16,.025,1.33),(-.17,-.03,.83),.54),((.29,.12,1.15),(.50,-.04,.77),.46),
            ((-.36,-.13,.84),(-.53,-.20,.50),.41),((.10,-.17,.95),(.22,-.23,.62),.38),
            ((-.11,-.22,.78),(-.12,-.27,.52),.34),((.02,.18,1.20),(.08,.18,.91),.33)]
    for i,(start,end,w) in enumerate(leaves):
        tube(f'stalk_{i}',[(0,0,.39),start],[.014,.009],'deep',n=6)
        split_leaf(f'split_leaf_{i}',start,end,w,'leaf' if i%2 else 'deep')

def make_fern():
    pot(.23,.32,'clay')
    for i in range(8):
        a=i*2.399
        direction=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0))
        reach=.43 if i%3 else .37;height=.40 if i%3 else .55
        def center(t): return direction*(reach*max(t,0)**.85)+Vector((0,0,.28+height*(3*t-2.8*t*t)))
        tube(f'frond_{i}',[center(j/5) for j in range(6)],[.008,.007,.006,.005,.004,.002],'deep',n=4)
        for j in range(1,10):
            t=.05+j*.09;start=center(t);length=.105*(1-t*.65)
            for sign in [-1,1]:
                end=start+side*(sign*length)+direction*(length*.32)+Vector((0,0,.025))
                leaf(f'leaflet_{i}_{j}_{sign}',start,end,length*.55,'light' if (i+j)%3 else 'leaf',
                     arch=.008,thick=.004,n=6,rings=3,normal=(0,0,1))
        leaf(f'frond_tip_{i}',center(.85),center(1.06),.027,'leaf',n=4,rings=3,normal=(0,0,1))

def make_palm():
    pot(.24,.37,'caramel')
    for i in range(8):
        a=i*2.399;direction=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0))
        height=.60+(i%3)*.12;reach=.51 if i%2 else .44
        def center(t): return direction*(reach*(.25*t+.75*t*t))+Vector((0,0,.34+height*math.sin(t*math.pi*.60)-.12*t*t))
        tube(f'arched_frond_{i}',[center(j/6) for j in range(7)],[.014,.013,.011,.008,.006,.004,.0015],'leaf',n=5)
        for j in range(1,6):
            t=j/6;start=center(t);length=.26*math.sin(t*math.pi)
            for sign in [-1,1]:
                end=start+side*(sign*length)+direction*(length*.5)+Vector((0,0,-length*.50))
                leaf(f'palm_leaflet_{i}_{j}_{sign}',start,end,.068 if j<5 else .047,
                     'leaf' if i%2 else 'light',arch=.017,thick=.006,n=4,rings=4,normal=(0,0,1))
        leaf(f'frond_tip_{i}',center(.87),center(1.10),.040,'leaf',arch=.012,n=4,rings=3,normal=(0,0,1))

def make_snakePlant():
    pot(.225,.38,ribbed=True)
    for i in range(20):
        a=i*math.tau/20
        tube(f'pot_rib_{i}',[(.181*math.cos(a),.181*math.sin(a),.035),
             (.219*math.cos(a),.219*math.sin(a),.344)],.004,'cream',n=4,role='recolor')
    for i in range(9):
        a=i*2.399;r=.025 if i==0 else .105
        start=Vector((r*math.cos(a),r*math.sin(a),.33))
        end=start+Vector((math.cos(a)*.11,math.sin(a)*.10,.62+(i%3)*.13))
        axis=end-start;side=Vector((math.cos(a+.5),math.sin(a+.5),0))
        side=(side-axis.normalized()*side.dot(axis.normalized())).normalized()
        normal=axis.normalized().cross(side).normalized()
        verts=[];rows=6
        for j in range(rows):
            t=j/(rows-1);w=.074*(math.sin(math.pi*t)**.60)
            center=start+axis*t+normal*(.025*t*t)
            for s in [-1,-.73,0,.73,1]:
                verts.append(tuple(center+side*w*s+normal*(.008*(1-abs(s)))))
        faces=[];colors=[]
        for j in range(rows-1):
            for k in range(4):
                faces.append((j*5+k,j*5+k+1,(j+1)*5+k+1,(j+1)*5+k));colors.append(k in (0,3))
        # Use a closed thin blade; edge bands are real material faces, not painted overlays.
        front=verts[:];verts += [tuple(Vector(v)-normal*.004) for v in front]
        n=len(front)
        for f,edge in list(zip(faces,colors)):
            faces.append(tuple(n+v for v in reversed(f)));colors.append(edge)
        for j in range(rows-1):
            for k in [0,4]:
                x=j*5+k;y=(j+1)*5+k;faces.append((x,y,n+y,n+x));colors.append(True)
        o=mesh(f'sword_leaf_{i}',verts,faces,'deep')
        o.data.materials.append(material('ash'))
        # Cleanup may merge tip faces; choose edge material geometrically using source vertices.
        for f in o.data.polygons:
            mid=f.center-start;t=max(0,min(1,mid.dot(axis)/axis.length_squared))
            width=.074*(math.sin(math.pi*t)**.60)
            sideways=abs(mid.dot(side))
            f.material_index=1 if width>0 and sideways>width*.70 else 0

def make_planter():
    box('base',(0,0,.045),(1.8,.60,.09),'wood','recolor')
    for side in [-1,1]:
        for j in range(2):
            box(f'long_board_{side}_{j}',(0,side*.273,.135+j*.15),(1.8,.055,.144),'wood','recolor',.008)
        box(f'end_{side}',(side*.866,0,.20),(.06,.50,.32),'wood','recolor',.008)
    box('soil',(0,0,.350),(1.68,.48,.025),'soil',bevel=0)
    for i in range(6):
        x=-.70+i*.28;y=.075 if i%2 else -.075
        blob(f'bush_{i}',(x,y,.55),(.18,.16,.19),'leaf',detail=2)
        for j in range(4):
            a=j*math.tau/4
            blob(f'bush_lobe_{i}_{j}',(x+.085*math.cos(a),y+.07*math.sin(a),.59),(.095,.085,.11),'light' if j%2 else 'leaf')
        petalcolor=['rose','cream','yellow'][i%3]
        for j in range(5):
            a=j*math.tau/5
            blob(f'flower_{i}_{j}',(x+.034*math.cos(a),y+.034*math.sin(a),.750),(.030,.030,.017),petalcolor)
        blob(f'flower_center_{i}',(x,y,.765),(.015,.015,.015),'yellow')

def make_succulent():
    pot(.072,.105,mini=True)
    for ring,count,reach,height in [(0,5,.081,.142),(1,4,.055,.173)]:
        for i in range(count):
            a=i*math.tau/count+ring*.6
            start=(.012*math.cos(a),.012*math.sin(a),.103+ring*.020)
            end=(reach*math.cos(a),reach*math.sin(a),height)
            leaf(f'rosette_{ring}_{i}',start,end,.055,'sage' if ring==0 else 'light',arch=.008,thick=.016,n=6,rings=4,normal=(0,0,1))
    leaf('central_leaf',(0,0,.131),(.008,.005,.195),.027,'sage',thick=.008,n=6,rings=4)

def make_bonsai():
    # Rectangular tray built from nested rectangular rings to keep the small-item budget.
    verts=[]
    for x,y,z in [(.12,.075,0),(.14,.09,.034),(.122,.074,.041),(.115,.067,.019)]:
        verts.extend([(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)])
    faces=[(3,2,1,0),(12,13,14,15)]
    for j in range(3):
        for i in range(4):faces.append((j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i))
    mesh('tray',verts,faces,'black','recolor')
    box('soil',(0,0,.032),(.237,.14,.009),'soil',bevel=0)
    tube('twisting_trunk',[(-.025,0,.032),(-.006,0,.084),(-.025,0,.13),(.008,0,.179)],[.023,.018,.016,.007],'bark',n=5)
    for i,(x,z) in enumerate([(-.087,.114),(.085,.162),(.005,.217)]):
        tube(f'branch_{i}',[(-.01,0,.09+i*.035),(x,0,z)],[.010,.005],'bark',n=4)
        for j in range(4):
            a=j*math.tau/4
            o=blob(f'canopy_{i}_{j}',(x+.022*math.cos(a),.021*math.sin(a),z+.007),(.036,.034,.026),'leaf' if j%2 else 'light')
            for face in o.data.polygons: face.use_smooth=True
    for i in [-1,1]:
        tube(f'root_{i}',[(-.02,0,.05),(.05*i,.018*i,.036)],[.013,.004],'bark',n=4)

def make_macrame():
    center=Vector((0,-.22,.45))
    pot(.19,.27,center=center)
    # Wall hook and three straight cords support the bowl at its rim.
    tube('hook',[(0,-.005,1.29),(0,-.035,1.35),(0,-.07,1.29),(0,-.045,1.255)],.012,'black',n=6)
    top=Vector((0,-.055,1.265))
    for i in range(3):
        a=i*math.tau/3+.4
        end=center+Vector((.17*math.cos(a),.17*math.sin(a),.22))
        tube(f'cord_{i}',[top,end],.008,'cord',n=6)
    for i in range(7):
        a=i*2.399;d=Vector((math.cos(a),math.sin(a),0))
        start=center+Vector((0,0,.25));points=[start]
        for j in range(4):
            points.append(center+d*(.15+j*.025)+Vector((0,0,.30-j*.125)))
        tube(f'vine_{i}',points,.004,'deep',n=4)
        for j in range(4):
            st=points[j+1];tip=st+d*.063+Vector((0,0,-.065))
            leaf(f'vine_leaf_{i}_{j}',st,tip,.060,'leaf' if (i+j)%2 else 'light',arch=.010,thick=.004,n=6,rings=5)
    for i in range(7):
        a=i*math.tau/7;d=Vector((math.cos(a),math.sin(a),0))
        leaf(f'crown_leaf_{i}',center+Vector((0,0,.26)),center+d*.19+Vector((0,0,.32)),.067,
             'light' if i%2 else 'leaf',arch=.035,thick=.006,n=6,rings=5,normal=(0,0,1))

def make_vase():
    lathe('ceramic_vase',[(0,0),(.038,0),(.063,.025),(.074,.071),(.064,.12),(.038,.15),
          (.029,.166),(.032,.18),(.021,.18),(.019,.157)],'6b7d55','recolor',n=12)
    for i,(x,y,z,c) in enumerate([(-.052,0,.284,'rose'),(.008,.005,.325,'yellow'),(.064,.003,.265,'rose')]):
        tube(f'stem_{i}',[(0,0,.16),(x*.60,y,.23),(x,y,z)],[.004,.003,.002],'deep',n=4)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=7,ring_count=4,radius=.030,location=(x,y,z))
        adopt(bpy.context.object,f'flower_{i}',c)

BUILDERS={k:globals()['make_'+k] for k in KEYS}
report=[]
for key in args.keys or KEYS:
    folder=OUT/key;folder.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.unit_settings.system='METRIC'
    root=bpy.data.objects.new(key+'.root',None);scene.collection.objects.link(root)
    root['catalogKey']=key;root['artReference']='art-source/prop-sheet-low-poly-v2.png'
    root['provenance']='Native Blender model, individually authored to the v2 plant reference'
    parts=[]
    BUILDERS[key]()
    bpy.context.view_layer.update()
    for o in parts:
        # Ground-centered floor/surface props; hanging plant retains wall origin.
        o.data.calc_loop_triangles()
    triangles=sum(len(o.data.loop_triangles) for o in parts)
    budget=399 if key in SMALL else 2499
    assert triangles<=budget,f'{key}: {triangles} > {budget}'
    points=[o.matrix_world@Vector(v) for o in parts for v in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in points) for i in range(3)))
    hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    for o in scene.objects:o.select_set(o==root or o in parts)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.export_scene.gltf(filepath=str(folder/(key+'.glb')),export_format='GLB',use_selection=True,
        export_yup=True,export_apply=True,export_extras=True,export_texcoords=False,
        export_animations=False,export_cameras=False,export_lights=False)
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=scene.render.resolution_y=384;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.view_settings.exposure=.5
    center=(lo+hi)/2;span=max(hi-lo)
    bpy.ops.object.light_add(type='AREA',location=center+Vector((-2,-3,5))*span)
    light=bpy.context.object;light.data.energy=170*span*span;light.data.shape='DISK';light.data.size=4*span
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=center+Vector((-1.0,-4,1.9))*span)
    camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=span*1.30;scene.camera=camera
    scene.render.filepath=str(folder/'preview.png');bpy.ops.render.render(write_still=True)
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                region=area.spaces.active.region_3d;region.view_location=center;region.view_distance=span*1.7
                region.view_rotation=camera.rotation_euler.to_quaternion();area.spaces.active.shading.color_type='MATERIAL'
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(key+'.blend')))
    item={'key':key,'triangles':triangles,'budget':budget,'parts':len(parts),
          'recolorParts':sum(bool(o.get('recolor')) for o in parts),'size':[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y],
          'generator':'Blender native','integrated':False}
    (folder/'build-report.json').write_text(json.dumps(item,indent=2));report.append(item)
    print('PLANT COMPLETE '+json.dumps(item),flush=True)
all_reports=[json.loads((OUT/k/'build-report.json').read_text()) for k in KEYS if (OUT/k/'build-report.json').exists()]
(OUT/'build-report.json').write_text(json.dumps(all_reports,indent=2))
