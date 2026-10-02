"""Build the v2 reference sofa with explicit material boundaries.

blender --background --python tools/blender/build-sofa-v2.py -- --out-dir <directory>
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--out-dir', required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(a.out_dir).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def material(role, color):
    rgb = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4))
    m = bpy.data.materials.new(f'sofa.{role}.{color}')
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = .85
    return m

cream = material('fabric', 'f3e4d2')
wood = material('wood', 'b87946')
caramel = material('pillow', 'bf895c')
sage = material('pillow', '81936a')
root = bpy.data.objects.new('sofa.root', None)
bpy.context.scene.collection.objects.link(root)
root['catalogKey'] = 'sofa'
parts = []

def block(name, size, pos, mat, radius, rotation=(0, 0, 0), recolor=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.name = 'sofa_' + name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = o.modifiers.new('soft edges', 'BEVEL')
    bevel.width = radius
    bevel.segments = 1 if mat == wood else 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    o.rotation_euler = tuple(math.radians(v) for v in rotation)
    o.data.materials.append(mat)
    o.parent = root
    if recolor:
        o['recolor'] = True
    for face in o.data.polygons:
        face.use_smooth = True
    normals = o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normals.name)
    parts.append(o)
    return o

# Blender Z up, front -Y. Export converts to game Y up / front +Z.
block('base', (2.62, .84, .20), (0, 0, .26), cream, .07, recolor=True)
for x in (-1.26, 1.26):
    block('arm_left' if x < 0 else 'arm_right', (.38, .90, .60),
          (x, 0, .49), cream, .105, recolor=True)
for i, x in enumerate((-.82, 0, .82)):
    block(f'seat_{i}', (.805, .70, .20), (x, -.065, .44), cream, .065, recolor=True)
    block(f'back_{i}', (.805, .22, .57), (x, .292, .715), cream, .065,
          rotation=(-8, 0, 0), recolor=True)
for i, (x, y) in enumerate(((-1.15, -.31), (1.15, -.31), (-1.15, .31), (1.15, .31))):
    block(f'leg_{i}', (.13, .13, .18), (x, y, .09), wood, .015)
block('pillow_left', (.43, .16, .43), (-.87, .075, .70), caramel, .065,
      rotation=(-14, -12, -9))
block('pillow_right', (.43, .16, .43), (.87, .075, .70), sage, .065,
      rotation=(-14, 10, 7))

for o in bpy.context.scene.objects:
    o.select_set(o == root or o in parts)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.export_scene.gltf(filepath=str(out / 'sofa-low-poly-v2.glb'),
    export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
    export_extras=True, export_materials='EXPORT', export_texcoords=False)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.8, .8, .8, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.object.light_add(type='AREA', location=(-3, -4, 6))
bpy.context.object.data.energy = 400
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 5
bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 3.8
center = Vector((0, 0, .5))
for name, pos in [('iso', (-4, -6, 3.5)), ('front', (0, -7, 1.6)), ('back', (0, 7, 1.8))]:
    cam.location = pos
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out / f'sofa-{name}.png')
    bpy.ops.render.render(write_still=True)
cam.location = (-4, -6, 3.5)
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'sofa-low-poly-v2.blend'))
tris = 0
for o in parts:
    o.data.calc_loop_triangles()
    tris += len(o.data.loop_triangles)
print(f'SOFA RESULT: {tris} triangles, {len(parts)} meshes, 4 flat materials -> {out}')
