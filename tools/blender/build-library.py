"""Blender --background --python tools/blender/build-library.py -- --output output/blender.

Construct editable native mesh parts, keep source topology in .blend, and export
budgeted GLBs. Coordinate conversion: game (x,y,z) -> Blender (x,-z,y).
"""
import argparse
import json
import math
import sys
import struct
import runpy
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='output/blender')
parser.add_argument('--render', action='store_true')
parser.add_argument('--render-keys', nargs='*', help='Refresh previews only for these keys; still export the full library')
parser.add_argument('--reference', action='store_true', help='Refine meshes against the 48-prop concept sheet')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
output = Path(args.output).resolve()
catalog = json.loads((output / 'catalog-source.json').read_text())['catalog']
for folder in ['glb', 'previews']:
    (output / folder).mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.display.shading.light = 'STUDIO'
scene.display.shading.studiolight_rotate_z = math.radians(20)
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'
scene.display.shading.show_specular_highlight = True
scene.display.shading.background_type = 'WORLD'
scene.world = bpy.data.worlds.new('Warm paper')
scene.world.color = (0.94, 0.91, 0.86)
scene.view_settings.view_transform = 'Standard'
camera_data = bpy.data.cameras.new('Preview camera')
camera = bpy.data.objects.new('Preview camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
refine = runpy.run_path(str(Path(__file__).with_name('refine-reference.py')))['refine'] if args.reference else None
if args.reference:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.78, 0.73, 0.65, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .8
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    scene.view_settings.look = 'AgX - Medium High Contrast'
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground = bpy.context.object
    ground.name = 'Preview ground (never exported)'
    paper = bpy.data.materials.new('Preview warm cream')
    paper.use_nodes = True
    paper.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.94,.89,.79,1)
    paper.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    ground.data.materials.append(paper)
    ground.is_shadow_catcher = True
    scene.render.film_transparent = True
    for name, location, energy, size in [('Soft key',(-3,-4,6),450,5),('Warm fill',(4,-1,4),180,4)]:
        data = bpy.data.lights.new(name,'AREA')
        data.energy, data.shape, data.size = energy, 'DISK', size
        light = bpy.data.objects.new(name,data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (-light.location).to_track_quat('-Z','Y').to_euler()


def linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def triangles(objects, evaluated=False):
    total = 0
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.evaluated_get(depsgraph).to_mesh() if evaluated else obj.data
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        if evaluated:
            obj.evaluated_get(depsgraph).to_mesh_clear()
    return total


def aim(target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


roots = []
report = []
for index, prop in enumerate(catalog):
    key = prop['key']
    collection = bpy.data.collections.new(key + ' — ' + prop['label'])
    scene.collection.children.link(collection)
    root = bpy.data.objects.new(key, None)
    collection.objects.link(root)
    roots.append(root)
    root['catalogKey'] = key
    root['contract'] = json.dumps({k: v for k, v in prop.items() if k not in ['parts', 'bounds']})
    root['gameFront'] = '+Z (Blender -Y)'
    material_cache = {}
    meshes = []
    for part_index, part in enumerate(prop['parts']):
        role = 'recolor' if part['recolor'] else 'canvas' if part['canvas'] else 'glow' if part['emissiveIntensity'] and max(part['emissive']) else 'fixed'
        color_hex = ''.join(f'{round(c * 255):02x}' for c in part['color'])
        material_key = (role, color_hex, part['roughness'], part['opacity'], tuple(part['emissive']), part['emissiveIntensity'])
        if material_key not in material_cache:
            mat = bpy.data.materials.new(f'{key}.{role}.{color_hex}')
            mat.diffuse_color = (*[linear(c) for c in part['color']], part['opacity'])
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get('Principled BSDF')
            bsdf.inputs['Base Color'].default_value = mat.diffuse_color
            bsdf.inputs['Roughness'].default_value = part['roughness']
            bsdf.inputs['Metallic'].default_value = part['metalness']
            bsdf.inputs['Alpha'].default_value = part['opacity']
            bsdf.inputs['Emission Color'].default_value = (*part['emissive'], 1)
            bsdf.inputs['Emission Strength'].default_value = part['emissiveIntensity']
            mat.use_backface_culling = not part['doubleSided']
            mat['role'] = role
            material_cache[material_key] = mat
        p = part['positions']
        vertices = [(p[i], -p[i + 2], p[i + 1]) for i in range(0, len(p), 3)]
        ids = part['indices'] or list(range(len(vertices)))
        faces = [ids[i:i + 3] for i in range(0, len(ids), 3)]
        mesh = bpy.data.meshes.new(f'{key}.part{part_index:03d}')
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=0.0000001)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(f'{key}.{role}.part{part_index:03d}', mesh)
        collection.objects.link(obj)
        obj.parent = root
        obj.data.materials.append(material_cache[material_key])
        obj['recolor'] = part['recolor']
        obj['role'] = role
        # Keep deliberately faceted leaves; rounded source parts get smooth normals.
        for polygon in mesh.polygons:
            polygon.use_smooth = role != 'canvas'
        meshes.append(obj)

    changes = refine(prop, root, collection, meshes) if refine else []
    bpy.context.view_layer.update()
    bounds_points = [obj.matrix_world @ Vector(v) for obj in meshes for v in obj.bound_box]
    minimum = [min(p[i] for p in bounds_points) for i in range(3)]
    maximum = [max(p[i] for p in bounds_points) for i in range(3)]
    refined_bounds = {'min': [minimum[0],minimum[2],-maximum[1]], 'max': [maximum[0],maximum[2],-minimum[1]]}
    source_count = triangles(meshes)
    budget = 399 if prop['layer'] == 'surface' else 299 if prop['layer'] == 'wall' and not prop['plant'] else 2499 if prop['plant'] else 1499
    # Non-destructive modifiers: artists retain the complete editable source meshes.
    if source_count > budget:
        for obj in meshes:
            mod = obj.modifiers.new('GLB triangle budget (source retained)', 'DECIMATE')
            mod.ratio = min(1, budget / source_count * 0.90)
            mod.use_collapse_triangulate = True
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    export_path = output / 'glb' / f'{key}.glb'
    for attempt in range(6):
        bpy.ops.export_scene.gltf(filepath=str(export_path),
            export_format='GLB', use_selection=True, export_yup=True,
            export_apply=True, export_extras=True, export_animations=False,
            export_cameras=False, export_lights=False)
        raw = export_path.read_bytes()
        json_length = struct.unpack_from('<I', raw, 12)[0]
        gltf = json.loads(raw[20:20 + json_length])
        export_count = sum(gltf['accessors'][p['indices']]['count'] // 3
            for m in gltf['meshes'] for p in m['primitives'])
        if export_count <= budget:
            break
        for obj in meshes:
            if obj.modifiers:
                obj.modifiers[0].ratio *= budget / export_count * 0.95
    if args.render and (not args.render_keys or key in args.render_keys):
        for other in scene.objects:
            if other.type == 'MESH':
                other.hide_render = other not in meshes and not (args.reference and other == ground)
        minimum, maximum = refined_bounds['min'], refined_bounds['max']
        center = Vector(((minimum[0] + maximum[0]) / 2, -(minimum[2] + maximum[2]) / 2, (minimum[1] + maximum[1]) / 2))
        span = max(maximum[i] - minimum[i] for i in range(3))
        camera.location = center + Vector((-3, -5, 3.4)) * span
        aim(center)
        camera_data.ortho_scale = span * 1.65
        if args.reference:
            ground.location = (center.x,center.y,minimum[1]-.003)
            for light in [o for o in scene.objects if o.type == 'LIGHT']:
                base = Vector((-3,-4,6) if light.name == 'Soft key' else (4,-1,4))
                light.location = center + base * span
                light.data.energy = (450 if light.name == 'Soft key' else 180) * span * span
                light.data.size = (5 if light.name == 'Soft key' else 4) * span
                light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath = str(output / 'previews' / f'{key}.png')
        bpy.ops.render.render(write_still=True)
    report.append({'key': key, 'label': prop['label'], 'sourceTriangles': source_count,
        'exportTriangles': export_count, 'budget': budget, 'withinBudget': export_count <= budget,
        'parts': len(meshes), 'recolorParts': sum(bool(o.get('recolor')) for o in meshes),
        'bounds': refined_bounds, 'originalBounds': prop['bounds'], 'refinements': changes,
        'surface': prop['surface'], 'wall': prop['wall']})
    root.location = ((index % 8) * 4.5, (index // 8) * 4.5, 0)
    print(f'BUILT {key}: {export_count}/{budget} triangles', flush=True)

for obj in scene.objects:
    obj.hide_render = False
if args.reference:
    ground.hide_viewport = True
    ground.hide_render = True
camera.location = (-20, -32, 35)
aim((15, 11, 0))
camera_data.ortho_scale = 46
bpy.ops.object.select_all(action='DESELECT')
roots[0].select_set(True)
bpy.context.view_layer.objects.active = roots[0]
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 42
            area.spaces.active.region_3d.view_location = (15, 11, 0)
            area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
            area.spaces.active.shading.color_type = 'MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'little-nest-props.blend'))
(output / 'build-report.json').write_text(json.dumps(report, indent=2))
print(f'Finished {len(report)} props; {sum(not p["withinBudget"] for p in report)} over budget.', flush=True)
