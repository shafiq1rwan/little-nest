"""Model the cactus from cell 26 of the v2 prop sheet, without runtime integration.

blender --background --python tools/blender/build-cactus-v2.py -- --out-dir art-source/models-v2/cactus
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--out-dir', required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(a.out_dir).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
root = bpy.data.objects.new('cactus.root', None)
scene.collection.objects.link(root)
root['catalogKey'] = 'cactus'
root['artReference'] = 'art-source/prop-sheet-low-poly-v2.png, cell 26'
root['provenance'] = 'Native Blender mesh construction from the reference; no Hunyuan geometry'
parts = []

def material(role, color):
    rgb = [int(color[i:i+2], 16)/255 for i in (0,2,4)]
    rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new(f'cactus.{role}.{color}')
    m.diffuse_color = (*rgb,1)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .88
    return m

clay = material('pot','c47743')
green = material('body','4d702a')
soil = material('soil','513725')
pink = material('petals','e9927d')
yellow = material('center','e5b66b')

def mesh_part(name, verts, faces, mat, smooth=False, recolor=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-8)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('cactus_' + name, me)
    scene.collection.objects.link(o)
    o.parent = root
    o.data.materials.append(mat)
    o['recolor'] = recolor
    for f in me.polygons:
        f.use_smooth = smooth
    parts.append(o)
    return o

def lathe(name, profile, mat, segments=32, smooth=False, recolor=False):
    verts = [(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z)
             for r,z in profile for i in range(segments)]
    faces = []
    for j in range(len(profile)-1):
        for i in range(segments):
            k = j*segments+i
            n = j*segments+(i+1)%segments
            faces.append((k,n,n+segments,k+segments))
    return mesh_part(name,verts,faces,mat,smooth,recolor)

# One closed ceramic section: tapered walls, substantial raised lip, visible inner rim.
lathe('terracotta_pot',[(0,0),(.195,0),(.207,.010),(.241,.267),
      (.269,.276),(.275,.284),(.275,.351),(.269,.362),(.246,.362),
      (.237,.350),(.231,.282),(.177,.039),(0,.039)],clay,smooth=True,recolor=True)
lathe('soil',[(0,.326),(.234,.326),(.234,.335),(0,.335)],soil,segments=32)

# Ten broad ribs are part of a single closed surface. No floating rib strips or paint stripes.
profile = [(0,.323),(.176,.330),(.211,.391),(.242,.493),(.248,.565),
           (.224,.654),(.177,.704),(.112,.727),(0,.736)]
samples = 40
verts = []
for radius,z in profile:
    for i in range(samples):
        angle = i*math.tau/samples + .04
        rib = [.845,.985,1.025,.985][i%4]
        verts.append((radius*rib*math.cos(angle),radius*rib*math.sin(angle),z))
faces=[]
for j in range(len(profile)-1):
    for i in range(samples):
        k=j*samples+i
        n=j*samples+(i+1)%samples
        faces.append((k,n,n+samples,k+samples))
mesh_part('ribbed_barrel',verts,faces,green)

# Five thick, upward-facing petals. The rear petal is taller, as in the sheet.
for petal in range(5):
    angle = math.pi/2 + petal*math.tau/5
    direction = Vector((math.cos(angle),math.sin(angle),0))
    tangent = Vector((-math.sin(angle),math.cos(angle),0))
    lift = .108 if petal == 0 else .078
    rings = [(0,.012,.011,.009),(.23,.039,.036,.013),(.58,.078,.049,.014),
             (.84,.104,.037,.012),(1,.113,0,0)]
    verts=[]
    for t,r,w,thick in rings:
        center = direction*r + Vector((0,0,.739 + lift*(t**1.45)))
        for i in range(8):
            phi=i*math.tau/8
            v=center+tangent*(w*math.cos(phi))+Vector((0,0,thick*math.sin(phi)))
            verts.append(tuple(v))
    faces=[tuple(reversed(range(8)))]
    for j in range(len(rings)-1):
        for i in range(8):
            k=j*8+i
            n=j*8+(i+1)%8
            faces.append((k,n,n+8,k+8))
    mesh_part(f'flower_petal_{petal+1}',verts,faces,pink,smooth=True)

lathe('flower_center',[(0,.745),(.031,.745),(.035,.758),(.024,.775),(0,.779)],yellow,segments=12,smooth=True)

# Preserve the sheet's restrained faceting while smoothing the ceramic lip.
for o in parts:
    if o.name == 'cactus_terracotta_pot':
        bpy.context.view_layer.objects.active=o
        o.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(36))
        o.select_set(False)

for o in scene.objects:
    o.select_set(o == root or o in parts)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.export_scene.gltf(filepath=str(out/'cactus-v2.glb'), export_format='GLB',
    use_selection=True, export_yup=True, export_apply=True, export_extras=True,
    export_texcoords=False, export_animations=False, export_cameras=False, export_lights=False)

# One small neutral desktop studio render for visual QA; cameras/lights stay out of the GLB.
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=512
scene.render.resolution_y=512
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Neutral white studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.render.film_transparent=True
bpy.ops.object.light_add(type='AREA', location=(-2,-3,5))
light=bpy.context.object
light.name='Softbox'
light.data.energy=170
light.data.shape='DISK'
light.data.size=4
light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add()
camera=bpy.context.object
camera.name='Desktop reference camera'
target=Vector((0,0,.42))
camera.location=target+Vector((0,-3.8,1.4))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=1.20
scene.camera=camera
scene.render.filepath=str(out/'cactus-preview.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active=root
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_location=target
            area.spaces.active.region_3d.view_distance=1.7
            area.spaces.active.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'cactus-v2.blend'))

triangles=0
for o in parts:
    o.data.calc_loop_triangles()
    triangles+=len(o.data.loop_triangles)
report={'key':'cactus','generator':'Blender native','triangles':triangles,'parts':len(parts),
        'reference':'art-source/prop-sheet-low-poly-v2.png, cell 26','integrated':False,
        'features':['tapered terracotta pot with broad rim','ten sculpted ribs','five cupped pink petals','yellow center'],
        'palette':{'pot':'c47743','body':'4d702a','soil':'513725','petals':'e9927d','center':'e5b66b'}}
(out/'build-report.json').write_text(json.dumps(report,indent=2))
assert triangles < 2500, triangles
print('CACTUS RESULT:',json.dumps(report))
