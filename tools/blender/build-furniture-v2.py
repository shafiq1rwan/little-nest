"""Author the remaining 35 v2 props. Exports only to the staging directory.
blender --background --python-exit-code 1 --python tools/blender/build-furniture-v2.py -- --output art-source/models-v2/furniture
"""
import argparse, ast, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

# Reuse the established plant builder's geometry helpers without executing its CLI.
source=Path(__file__).with_name('build-plants-v2.py')
tree=ast.parse(source.read_text())
names={'material','adopt','mesh','lathe','tube','leaf','blob','box'}
nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names
       or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='COLORS' for t in n.targets)]
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'))
COLORS.update(cream='f3e4d2',sage='81936a',wood='b87946',dark='694b35',brass='bb9451',
              rose='bd8069',ash='d9c7a7',paper='fff1dc',charcoal='3f3d3a',oak='b4885a')
KEYS=['armchair','coffeeTable','bookshelf','floorLamp','rug','desk','chair','ottoman','sideboard',
      'tvStand','boxes','bed','nightstand','wardrobe','bench','sideTable','pouf','basket','mug','candle',
      'bookStack','frame','lantern','worldMap','botanicalPrint','wallShelf','mirror','clock',
      'lowSofa','lowTable','paperLamp','floralArmchair','dresser','rockingChair','teapot']
SMALL={'mug','candle','bookStack','frame','lantern','teapot'}
WALL={'worldMap','botanicalPrint','wallShelf','mirror','clock'}
ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);ap.add_argument('--keys',nargs='*')
args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);OUT=Path(args.output).resolve()

def cube(name,pos,size,color='wood',role='fixed',bevel=.015,segments=1,smooth=False):
    o=box(name,pos,size,color,role,bevel=0)
    if bevel:
        m=o.modifiers.new('Rounded edges','BEVEL');m.width=bevel;m.segments=segments
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons:p.use_smooth=smooth
    if smooth:
        m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');m.keep_sharp=True;m.weight=30
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def cushion(name,pos,size,color='cream',role='recolor',tilt=0,segments=3):
    o=cube(name,pos,size,color,role,min(size)*.30,segments,True);o.rotation_euler.x=tilt;return o

def disc(name,r,h,z,color='wood',role='fixed',n=24,xy=(0,0)):
    return lathe(name,[(0,z),(r*.94,z),(r,z+h*.18),(r,z+h*.82),(r*.94,z+h),(0,z+h)],color,role,n,(*xy,0))

def ring(name,r,thickness,pos,color='wood',role='fixed',n=24,cross=4,vertical=False):
    verts=[];faces=[]
    for i in range(n):
        a=i*math.tau/n
        for j in range(cross):
            b=j*math.tau/cross;rr=r+thickness*math.cos(b)
            v=(rr*math.cos(a),rr*math.sin(a),thickness*math.sin(b))
            if vertical:v=(v[0],v[2],v[1])
            verts.append(tuple(Vector(pos)+Vector(v)))
    for i in range(n):
        for j in range(cross):faces.append((i*cross+j,((i+1)%n)*cross+j,((i+1)%n)*cross+(j+1)%cross,i*cross+(j+1)%cross))
    return mesh(name,verts,faces,color,role,True)

def legs(width,depth,height,color='wood',radius=.045,z=0):
    for x in [-width/2,width/2]:
        for y in [-depth/2,depth/2]:
            tube(f'leg_{x}_{y}',[(x*1.03,y*1.03,z),(x,y,z+height)],[radius*.78,radius],color,n=6)

def knob(name,x,y,z,r=.022):
    return blob(name,(x,y,z),(r,r*.7,r),'brass')

def books(name,pos,w=.20,h=.035,d=.25):
    for i,c in enumerate(['sage','dfc8a0','9d6450']):
        x,y,z=pos;shift=(i%2)*w*.07
        cube(f'{name}_{i}_pages',(x+shift,y,z+i*h+h*.5),(w*.94,d*.96,h*.67),'e8dfc9',bevel=0)
        for sign in [-1,1]:
            cube(f'{name}_{i}_cover_{sign}',(x+shift,y,z+i*h+h*.5+sign*h*.41),(w,d,h*.16),c,
                 'recolor' if key=='bookStack' and i==2 else 'fixed',bevel=0)
        cube(f'{name}_{i}_spine',(x+shift-w*.48,y,z+i*h+h*.5),(w*.055,d,h*.78),c,
             'recolor' if key=='bookStack' and i==2 else 'fixed',bevel=0)

def tiny_plant(pos,scale=1):
    x,y,z=pos
    lathe('decor_pot',[(0,0),(.055,0),(.073,.12),(.061,.12),(.059,.107),(0,.107)],'cream',n=10,center=pos)
    for i in range(5):
        a=i*2.399
        leaf(f'decor_leaf_{i}',(x,y,z+.11),(x+.075*math.cos(a),y+.075*math.sin(a),z+.22+(i%2)*.06),.042,'leaf',n=4,rings=3)

def make_armchair():
    legs(.69,.66,.28)
    cube('seat_frame',(0,0,.29),(.84,.81,.09))
    cushion('seat',(0,-.015,.41),(.74,.73,.20))
    cushion('back',(0,.30,.72),(.74,.19,.59),tilt=.10)
    for s in [-1,1]:
        cube(f'arm_{s}',(s*.405,0,.68),(.075,.86,.08),bevel=.025,segments=2)
        cube(f'front_post_{s}',(s*.405,-.34,.43),(.06,.06,.51))
        cube(f'back_post_{s}',(s*.405,.33,.52),(.06,.06,.54))
    cushion('throw_pillow',(.02,.155,.64),(.34,.12,.34),'sage','fixed',.20)

def make_coffeeTable():
    legs(1.20,.57,.47,radius=.047)
    o=disc('oval_top',.50,.09,.47);o.scale.x=1.7
    books('books',(-.08,-.01,.56),.29,.036,.28)
    tiny_plant((.44,.10,.56))

def make_bookshelf():
    legs(1.60,.43,.14,radius=.046)
    cube('back',(0,.286,1.25),(1.76,.055,2.14),'dark',bevel=0)
    for s in [-1,1]:cube(f'side_{s}',(s*.87,0,1.23),(.11,.65,2.18))
    for i,z in enumerate([.17,.72,1.25,1.80,2.35]):
        cube(f'shelf_{i}',(0,0,z),(1.86,.65,.10) if i==4 else (1.66,.61,.10))
    for s in [-1,1]:
        cube(f'lower_door_{s}',(s*.43,-.287,.45),(.835,.08,.47),'ad7448')
        knob(f'pull_{s}',s*.11,-.341,.46)
    palette=['dfc8a0','8a9a79','9d6450','e6ded0','675c4b']
    for level,z in enumerate([.78,1.31,1.86]):
        for i in range(5):
            x=-.65+i*.14 if level!=1 else .02+i*.14
            h=.29+(i%3)*.045
            cube(f'book_{level}_{i}',(x,.01,z+h/2),(.10,.30,h),palette[(i+level)%5],bevel=0)
    tiny_plant((.51,0,1.85));tiny_plant((.48,0,.77))
    lathe('vase',[(0,1.30),(.11,1.30),(.14,1.46),(.07,1.57),(.07,1.61),(0,1.61)],'cream',n=12,center=(-.49,0,0))

def make_floorLamp():
    for i in range(3):
        a=i*math.tau/3-math.pi/2
        tube(f'tripod_{i}',[(.32*math.cos(a),.32*math.sin(a),.025),(.075*math.cos(a),.075*math.sin(a),1.12)],[.028,.033],'wood',n=8)
    disc('collar',.09,.07,1.05,n=12)
    lathe('shade',[(.36,1.08),(.29,1.50),(.274,1.50),(.344,1.08)],'ffebc4','glow',n=24)
    disc('diffuser',.33,.008,1.10,'ffebc4','glow',n=20)

def make_rug():
    cube('weave',(0,0,.014),(3.65,2.70,.028),'f1ddbd','recolor',.012,2)
    for s in [-1,1]:
        cube(f'border_long_{s}',(0,s*1.18,.031),(3.32,.045,.005),'d5ba96',bevel=0)
        cube(f'border_end_{s}',(s*1.64,0,.031),(.045,2.40,.005),'d5ba96',bevel=0)
        for i in range(12):
            tube(f'fringe_{s}_{i}',[(s*1.81,-1.22+i*.22,.018),(s*1.93,-1.22+i*.22,.018)],.024,'e6ceaa',n=5)

def make_desk():
    cube('top',(0,0,.73),(1.90,.86,.12),bevel=.025,segments=2)
    for y in [-.32,.32]:cube(f'leg_{y}',(-.79,y,.345),(.085,.085,.69))
    cube('pedestal',(.60,.01,.36),(.60,.72,.67))
    for i in range(3):
        cube(f'drawer_{i}',(.60,-.369,.16+i*.20),(.55,.055,.183),'c38a56')
        knob(f'pull_{i}',.60,-.410,.16+i*.20)
    cube('monitor_foot',(-.39,.07,.81),(.30,.20,.035),'cream')
    cube('monitor_stand',(-.39,.16,.93),(.055,.055,.22),'cream')
    cube('monitor',(-.39,.17,1.10),(.60,.058,.39),'cream',bevel=.02,segments=2)
    cube('screen',(-.39,.136,1.10),(.546,.008,.331),'4b5d58',bevel=.006)
    cube('keyboard',(-.39,-.22,.802),(.50,.17,.024),'e8dfce',bevel=.007)
    cube('mouse',(-.02,-.20,.809),(.075,.105,.035),'cream',bevel=.015,segments=2)

def make_chair():
    disc('base',.30,.048,0,'black')
    tube('column',[(0,0,.04),(0,0,.43)],.045,'black',n=12)
    cushion('seat',(0,-.025,.48),(.62,.61,.16),'dark')
    cushion('back',(0,.23,.80),(.60,.17,.59),'dark',tilt=.08)
    for s in [-1,1]:cushion(f'seat_edge_{s}',(s*.255,-.02,.55),(.10,.49,.12),'dark')

def make_ottoman():
    legs(.65,.65,.18)
    cushion('body',(0,0,.315),(.87,.87,.32),'c38e62')

def cabinet_base(w,d,h,color='wood'):
    legs(w-.24,d-.18,.16,color='dark',radius=.042)
    cube('carcass',(0,0,(h+.07)/2),(w-.05,d-.025,h-.21),color)
    cube('cap',(0,0,h-.035),(w,d,.07),'oak' if key=='dresser' else color)

def make_sideboard():
    cabinet_base(1.85,.65,.85)
    for i in range(3):
        x=(i-1)*.585
        cube(f'door_{i}',(x,-.33,.49),(.566,.055,.59),'c58a5c')
        knob(f'pull_{i}',x,-.367,.54)

def make_tvStand():
    legs(1.58,.43,.12,radius=.035)
    for z in [.17,.47]:cube(f'board_{z}',(0,0,z),(1.85,.65,.065))
    cube('back',(0,.285,.32),(1.80,.05,.29),'dark')
    for x in [-.89,-.33,.33,.89]:cube(f'divider_{x}',(x,0,.32),(.055,.59,.27))
    for s in [-1,1]:
        cube(f'drawer_{s}',(s*.61,-.30,.32),(.52,.055,.23),'c38a56');knob(f'pull_{s}',s*.61,-.335,.32,.016)
    cube('tv_foot',(0,.06,.525),(.46,.20,.04),'black')
    cube('tv_stem',(0,.13,.59),(.09,.06,.15),'black')
    cube('tv',(0,.13,.94),(1.42,.07,.79),'black',bevel=.018,segments=2)
    cube('screen',(0,.088,.94),(1.34,.012,.71),'4b5d58',bevel=.008)

def make_boxes():
    cube('box',(0,0,.30),(.70,.70,.60),'c89b68',bevel=.015,segments=2)
    cube('tape_top',(0,0,.603),(.13,.693,.008),'e6c397',bevel=.002)
    for s in [-1,1]:cube(f'tape_end_{s}',(0,s*.352,.53),(.13,.007,.15),'e6c397',bevel=.002)

def make_bed():
    legs(1.67,2.60,.24,color='dark')
    cube('frame',(0,0,.29),(1.92,2.92,.18),bevel=.035,segments=2)
    cube('headboard',(0,1.39,.70),(1.92,.12,.85),bevel=.025,segments=2)
    cushion('mattress',(0,-.015,.48),(1.83,2.75,.28))
    cushion('blanket',(0,-.43,.605),(1.86,1.90,.19),'sage','fixed')
    cushion('blanket_fold',(0,.40,.675),(1.86,.25,.11),'sage','fixed')
    for s in [-1,1]:cushion(f'pillow_{s}',(s*.46,1.0,.66),(.83,.48,.17),tilt=.10)

def make_nightstand():
    cabinet_base(.60,.50,.58)
    cube('drawer',(0,-.251,.37),(.50,.06,.29),'c38a56')
    knob('pull',0,-.292,.37)

def make_wardrobe():
    cube('plinth',(0,0,.055),(1.88,.64,.11),'dark')
    cube('body',(0,0,1.16),(1.86,.63,2.12))
    cube('cap',(0,0,2.215),(1.92,.68,.07))
    for s in [-1,1]:
        cube(f'door_{s}',(s*.455,-.325,1.16),(.891,.06,2.06),'c38a56')
        knob(f'pull_{s}',s*.12,-.370,1.08,.025)

def make_bench():
    legs(1.55,.39,.43,'dark',.055)
    for x in [-.775,.775]:cube(f'stretcher_{x}',(x,0,.17),(.06,.48,.06),'dark')
    cube('seat',(0,0,.46),(1.85,.60,.09))
    cushion('pad',(0,0,.55),(1.74,.54,.12),'sage')

def make_sideTable():
    disc('base',.26,.055,0,'dark')
    tube('column',[(0,0,.04),(0,0,.50)],.06,'dark',n=14)
    disc('top',.34,.07,.48)

def make_pouf():
    lathe('upholstery',[(0,0),(.29,0),(.37,.025),(.40,.12),(.39,.28),(.36,.37),(.28,.43),(0,.45)],'cream','recolor',n=24)
    ring('piping',.392,.008,(0,0,.29),'d9b48f',n=24)

def make_basket():
    lathe('basket',[(0,0),(.24,0),(.28,.04),(.30,.39),(.28,.43),(.255,.40),(.24,.06),(0,.06)],'c8a06c',n=16)
    for i in range(5):ring(f'weave_{i}',.277+i*.004,.010,(0,0,.08+i*.066),'b98b58',n=16,cross=3)
    for i in range(16):
        a=i*math.tau/16
        tube(f'vertical_weave_{i}',[(.277*math.cos(a),.277*math.sin(a),.04),(.298*math.cos(a),.298*math.sin(a),.40)],.004,'b98b58',n=3)
    # Draped blanket folds over the front rim, leaving the opening visible.
    for i in range(3):
        o=cube(f'blanket_fold_{i}',(-.105+i*.105,-.20,.375),(.11,.26,.065),'sage','recolor',.025,1,True)
        o.rotation_euler.x=.20
        cube(f'blanket_drop_{i}',(-.105+i*.105,-.285,.28),(.11,.065,.24),'sage','recolor',.018,1,True)

def make_mug():
    lathe('cup',[(0,0),(.05,0),(.065,.012),(.067,.125),(.055,.13),(.050,.115),(.048,.025),(0,.025)],'cream','recolor',n=12)
    lathe('coffee',[(0,.113),(.051,.113)],'5b3d2a',n=12)
    pts=[(.061+.040*math.sin(i*math.pi/8),0,.072+.041*math.cos(i*math.pi/8)) for i in range(9)]
    tube('handle',pts,.010,'cream',n=6,role='recolor')

def make_candle():
    lathe('saucer',[(0,0),(.095,0),(.10,.01),(.10,.024),(.086,.024),(.084,.014),(0,.014)],'brass',n=12)
    lathe('wax',[(0,.014),(.060,.014),(.065,.025),(.065,.190),(.058,.20),(0,.198)],'cream','recolor',n=12)
    tube('wick',[(0,0,.195),(0,0,.22)],.003,'black',n=4)
    lathe('flame',[(0,.21),(.013,.223),(.017,.239),(.010,.259),(0,.282)],'ffc76b','glow',n=8)

def make_bookStack():books('book',(0,0,0),.24,.036,.29)

def make_frame():
    w=.22;h=.26
    cube('picture',(0,0,h/2),(w-.025,.012,h-.025),'c3d6a8',bevel=0)
    for s in [-1,1]:
        cube(f'side_{s}',(s*(w-.018)/2,-.003,h/2),(.018,.027,h),'wood','recolor',.003)
        cube(f'rail_{s}',(0,-.003,.009 if s<0 else h-.009),(w-.036,.027,.018),'wood','recolor',.003)
    o=cube('easel',(0,.051,.112),(.035,.024,.226),'dark',bevel=.004);o.rotation_euler.x=-.40
    # Lean the whole frame backward around its base.
    for o in parts:
        if 'easel' not in o.name:o.rotation_euler.x=-.12;o.location.y+=o.location.z*.12

def make_lantern():
    cube('base',(0,0,.018),(.18,.18,.036),'black','recolor',.004)
    for x in [-.076,.076]:
        for y in [-.076,.076]:cube(f'post_{x}_{y}',(x,y,.12),(.012,.012,.20),'black','recolor',0)
    cube('roof_rim',(0,0,.227),(.20,.20,.025),'black','recolor',.004)
    mesh('roof',[(-.10,-.10,.239),(.10,-.10,.239),(.10,.10,.239),(-.10,.10,.239),(0,0,.293)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'black','recolor')
    ring('handle',.024,.004,(0,0,.313),'brass',n=10,vertical=True)
    lathe('candle',[(0,.036),(.038,.036),(.038,.13),(0,.13)],'cream',n=10)
    lathe('flame',[(0,.13),(.008,.139),(.008,.152),(0,.169)],'ffd58a','glow',n=6)
    # Thin glass panels have their own neutral, transparent material.
    o=mesh('glass',[(-.066,-.066,.04),(.066,-.066,.04),(.066,-.066,.21),(-.066,-.066,.21),
                    (-.066,.066,.04),(.066,.066,.04),(.066,.066,.21),(-.066,.066,.21)],
           [(0,1,2,3),(1,5,6,2),(5,4,7,6),(4,0,3,7)],'d8e6e4','glass')
    m=o.data.materials[0];m.diffuse_color=(*m.diffuse_color[:3],.12)
    m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.12
    m.surface_render_method='DITHERED';m.use_backface_culling=False

def print_frame(w,h):
    cube('canvas',(0,-.023,h/2),(w-.12,.025,h-.12),'f3e4d2',bevel=0)['canvas']=True
    for s in [-1,1]:
        cube(f'side_{s}',(s*(w-.06)/2,-.04,h/2),(.06,.08,h),'wood','recolor',.007)
        cube(f'rail_{s}',(0,-.04,.03 if s<0 else h-.03),(w-.12,.08,.06),'wood','recolor',.007)

def make_worldMap():print_frame(1.71,1.36)
def make_botanicalPrint():print_frame(1.21,1.46)

def make_wallShelf():
    cube('shelf',(0,-.16,.375),(1.90,.32,.09),'wood','recolor',.012)
    for s in [-1,1]:
        cube(f'vertical_{s}',(s*.64,-.035,.16),(.07,.07,.32),'dark',bevel=.005)
        cube(f'horizontal_{s}',(s*.64,-.15,.305),(.07,.30,.055),'dark',bevel=.005)
        tube(f'brace_{s}',[(s*.64,-.07,.10),(s*.64,-.25,.30)],.028,'dark',n=4)

def wall_disc(name,r,z,color,role='fixed',n=48):
    o=lathe(name,[(0,0),(r,0),(r,.025),(0,.025)],color,role,n=n)
    o.rotation_euler.x=math.pi/2;o.location.z=z
    return o

def make_mirror():
    wall_disc('mirror',.405,.435,'d8e6e4',n=32)
    ring('brass_frame',.420,.015,(0,-.022,.435),'brass','recolor',n=24,cross=3,vertical=True)
    m=material('d8e6e4');m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.12
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.65

def make_clock():
    wall_disc('face',.207,.23,'cream',n=26)
    ring('rim',.219,.011,(0,-.02,.23),'dark','recolor',n=24,cross=3,vertical=True)
    tube('minute_hand',[(0,-.031,.23),(.105,-.031,.33)],.008,'black',n=4)
    tube('hour_hand',[(0,-.034,.23),(0,-.034,.35)],.010,'black',n=4)
    blob('hub',(0,-.04,.23),(.015,.007,.015),'black')

def make_lowSofa():
    legs(2.50,.68,.10,'ash',.055)
    cube('platform',(0,0,.18),(2.90,.96,.16),'ash',bevel=.025,segments=2)
    cube('back_rail',(0,.40,.45),(2.70,.065,.49),'ash')
    for i in range(3):
        x=(i-1)*.89
        cushion(f'seat_{i}',(x,-.035,.35),(.865,.75,.20),'charcoal')
        cushion(f'back_{i}',(x,.32,.615),(.865,.19,.46),'charcoal',tilt=.12)
    cushion('throw',(-.88,.12,.57),(.38,.13,.37),'cream','fixed',.15,segments=2)

def make_lowTable():
    cube('top',(0,0,.34),(1.80,.80,.12),'ash',bevel=.022,segments=2)
    for s in [-1,1]:cube(f'slab_leg_{s}',(s*.60,0,.15),(.15,.67,.30),'ash',bevel=.012)

def make_paperLamp():
    disc('base',.205,.045,0,'charcoal',n=16)
    tube('rod',[(0,0,.04),(0,0,.43)],.025,'charcoal',n=10)
    lathe('paper_shade',[(.24,.32),(.25,.35),(.25,1.11),(.24,1.15),(.228,1.15),(.238,1.11),(.238,.35),(.228,.32)],'paper','glow',n=24)
    for i,z in enumerate([.335,.73,1.13]):ring(f'hoop_{i}',.245,.010,(0,0,z),'charcoal',n=24)
    disc('diffuser',.226,.005,.34,'paper','glow',n=16)

def make_floralArmchair():
    legs(.66,.65,.20,'oak')
    cushion('base',(0,0,.29),(.89,.88,.23),'rose')
    cushion('seat',(0,-.065,.44),(.65,.68,.20),'rose')
    cushion('back',(0,.31,.69),(.81,.20,.58),'rose',tilt=.10)
    for s in [-1,1]:cushion(f'arm_{s}',(s*.365,-.015,.53),(.20,.80,.42),'rose')
    cushion('pillow',(0,.15,.64),(.42,.14,.36),'cream','fixed',.17)

def make_dresser():
    cabinet_base(1.90,.64,.94,'a7b98e')
    for o in parts:
        if 'carcass' in o.name:
            o['role']='recolor';o['recolor']=True;o.data.materials.clear();o.data.materials.append(material('a7b98e','recolor'))
    for i in range(2):
        for j in range(2):
            x=(i-.5)*.91;z=.34+j*.35
            cube(f'drawer_{i}_{j}',(x,-.321,z),(.88,.055,.325),'f6efe2')
            knob(f'knob_{i}_{j}',x,-.36,z)

def make_rockingChair():
    for s in [-1,1]:
        pts=[(s*.31,-.43+j*.1075,.023+.46*(-.43+j*.1075)**2) for j in range(9)]
        tube(f'rocker_{s}',pts,.027,'oak',n=6)
        for y in [-.25,.25]:tube(f'leg_{s}_{y}',[(s*.29,y,.06),(s*.26,y*.86,.43)],.027,'oak',n=6)
    cube('seat',(0,0,.43),(.66,.59,.07),'oak',bevel=.045,segments=2)
    cushion('pad',(0,-.015,.49),(.61,.53,.075),'rose')
    for i in range(5):tube(f'spindle_{i}',[((i-2)*.115,.23,.46),((i-2)*.115,.32,.96)],.016,'oak',n=6)
    o=cube('top_rail',(0,.32,.97),(.69,.075,.09),'oak',bevel=.015,segments=2);o.rotation_euler.x=.12

def make_teapot():
    lathe('body',[(0,0),(.05,0),(.076,.022),(.09,.067),(.086,.12),(.066,.158),(.047,.17),(0,.17)],'cream','recolor',n=10)
    lathe('lid',[(0,.165),(.052,.165),(.047,.177),(.024,.185),(0,.187)],'sage',n=8)
    blob('lid_knob',(0,0,.195),(.013,.013,.015),'sage')
    tube('spout',[(-.068,0,.073),(-.108,0,.107),(-.14,0,.155)],[.030,.024,.018],'cream',n=8,role='recolor')
    lathe('spout_opening',[(0,0),(.012,0)],'dark',n=8,center=(-.14,0,.1555))
    pts=[(.075+.049*math.sin(i*math.pi/8),0,.10+.049*math.cos(i*math.pi/8)) for i in range(9)]
    tube('handle',pts,.010,'cream',n=6,role='recolor')

for key in args.keys or KEYS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.unit_settings.system='METRIC';parts=[]
    root=bpy.data.objects.new(key+'.root',None);scene.collection.objects.link(root)
    root['catalogKey']=key;root['artReference']='art-source/prop-sheet-low-poly-v2.png'
    root['provenance']='Native Blender modeling';root['staged']=True
    globals()['make_'+key]()
    for o in parts:
        if o.get('role')=='glow':
            m=o.data.materials[0];bsdf=m.node_tree.nodes['Principled BSDF']
            bsdf.inputs['Emission Color'].default_value=m.diffuse_color
            bsdf.inputs['Emission Strength'].default_value=.30
    # Normalize ground / wall origins after evaluating all transformed bounds.
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v) for o in parts for v in o.bound_box]
    low=min(v.z for v in points);back=max(v.y for v in points) if key in WALL else 0
    for o in parts:o.location.z-=low;o.location.y-=back
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v) for o in parts for v in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    for o in parts:o.data.calc_loop_triangles()
    triangles=sum(len(o.data.loop_triangles) for o in parts)
    budget=399 if key in SMALL else 299 if key in WALL else 1499
    assert triangles<=budget,f'{key}: {triangles} > {budget}'
    folder=OUT/key;folder.mkdir(parents=True,exist_ok=True)
    for o in scene.objects:o.select_set(o==root or o in parts)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.export_scene.gltf(filepath=str(folder/(key+'.glb')),export_format='GLB',use_selection=True,export_yup=True,
        export_apply=True,export_extras=True,export_texcoords=False,export_animations=False,export_cameras=False,export_lights=False)
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=scene.render.resolution_y=384;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=.5
    center=(lo+hi)/2;span=max(hi-lo)
    bpy.ops.object.light_add(type='AREA',location=center+Vector((-2,-3,5))*span)
    light=bpy.context.object;light.data.energy=170*span*span;light.data.shape='DISK';light.data.size=4*span
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=center+Vector((-2.5,-4,2.5))*span)
    camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=span*1.37;scene.camera=camera
    scene.render.filepath=str(folder/'preview.png');bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(key+'.blend')))
    report={'key':key,'triangles':triangles,'budget':budget,'parts':len(parts),'recolorParts':sum(bool(o.get('recolor')) for o in parts),
            'size':[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y],'layer':'wall' if key in WALL else 'surface' if key in SMALL else 'floor',
            'glowParts':sum(o.get('role')=='glow' for o in parts),'generator':'Blender native','integrated':False}
    (folder/'build-report.json').write_text(json.dumps(report,indent=2))
    print('COMPLETE '+json.dumps(report),flush=True)
all_reports=[json.loads((OUT/k/'build-report.json').read_text()) for k in KEYS if (OUT/k/'build-report.json').exists()]
(OUT/'build-report.json').write_text(json.dumps(all_reports,indent=2))
