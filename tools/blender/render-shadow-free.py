"""Render an existing library without external ground shadows; never save over it.

blender --background <library.blend> --python tools/blender/render-shadow-free.py
Outputs alongside the loaded library under shadow-free/previews.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector

source = Path(bpy.data.filepath).parent
output = source / 'shadow-free'
(output / 'previews').mkdir(parents=True, exist_ok=True)
report = json.loads((source / 'build-report.json').read_text())
(output / 'build-report.json').write_text(json.dumps(report, indent=2))
scene = bpy.context.scene
camera = scene.camera
ground = bpy.data.objects.get('Preview ground (never exported)')
if scene.render.engine == 'BLENDER_WORKBENCH':
    scene.display.shading.show_shadows = False
if ground:
    ground.hide_render = True
scene.render.image_settings.file_format = 'PNG'
for prop in report:
    root = bpy.data.objects[prop['key']]
    original_location = root.location.copy()
    root.location = (0,0,0)
    meshes = set(o for o in root.children if o.type == 'MESH')
    for obj in scene.objects:
        if obj.type == 'MESH':
            obj.hide_render = obj not in meshes
    lo, hi = prop['bounds']['min'], prop['bounds']['max']
    center = Vector(((lo[0]+hi[0])/2,-(lo[2]+hi[2])/2,(lo[1]+hi[1])/2))
    span = max(hi[i]-lo[i] for i in range(3))
    camera.location = center + Vector((-3,-5,3.4))*span
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale = span*1.65
    for light in (o for o in scene.objects if o.type == 'LIGHT'):
        key = light.name == 'Soft key'
        light.location = center + Vector((-3,-4,6) if key else (4,-1,4))*span
        light.data.energy = (450 if key else 180)*span*span
        light.data.size = (5 if key else 4)*span
        light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    scene.render.filepath = str(output / 'previews' / f"{prop['key']}.png")
    bpy.ops.render.render(write_still=True)
    root.location = original_location
    print(f"SHADOW-FREE {prop['key']}",flush=True)
print(f"Rendered {len(report)} props. Original .blend left unchanged.",flush=True)
