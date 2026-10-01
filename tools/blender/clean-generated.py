"""Turn a raw image-to-3D mesh into a game-ready Little Nest prop.

    blender --background --python tools/blender/clean-generated.py -- \
        --key sofa --size 2.9 0.9 1.0 --tris 1600 [--preview DIR]

Reads art-source/generated/<key>.glb, writes public/models/<key>.glb.
Steps: join, scale each axis to --size (width, depth, height in game units), put the origin at the
floor centre (wall items: bottom-centre of the back face), decimate to the triangle budget, smooth
by angle, split colour parts by rule, assign flat role-named materials, export Y-up with extras so
Three.js sees userData.recolor on the body. Parts rules live in PARTS below; add one per key.
"""
import bpy, bmesh, sys, os, math, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--key', required=True)
ap.add_argument('--size', nargs=3, type=float, required=True, metavar=('W', 'D', 'H'))
ap.add_argument('--tris', type=int, default=1500)
ap.add_argument('--angle', type=float, default=38, help='smooth-by-angle threshold in degrees')
ap.add_argument('--wall', action='store_true', help='wall item: origin at the back face, model extends to the front')
ap.add_argument('--plate', type=float, default=0.03, help='remove faces in this bottom fraction of the raw height (ground plate); 0 keeps them')
ap.add_argument('--smooth-passes', type=int, default=2, help='label smoothing passes at part boundaries; 0 disables')
ap.add_argument('--preview', default=None)
ap.add_argument('--src', default=None)
ap.add_argument('--out', default=None)
args = ap.parse_args(argv)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
src = args.src or os.path.join(ROOT, 'art-source', 'generated', args.key + '.glb')
out = args.out or os.path.join(ROOT, 'public', 'models', args.key + '.glb')

# Colours from docs/PROP_BRIEFS.md. Blender axes: x = width, y = depth (front is -Y), z = up.
COLORS = {
    'cream': 0xf3e4d2, 'wood': 0xb87946, 'dark': 0x694b35, 'sage': 0x81936a, 'caramel': 0xbf895c,
    'black': 0x393932, 'brass': 0xbb9451, 'pot': 0xeee0ca, 'green': 0x4d7639, 'soil': 0x5b4030,
    'ottoman': 0x976444, 'door': 0xc38a56, 'paint': 0xa7b98e, 'oak': 0xb4885a, 'cottageCream': 0xf6efe2, 'ash': 0xd9c7a7,
}

def rule_sofa(obj, size):
    """Legs below the base; the two throw pillows sit forward of the back cushion in the outer seats."""
    w, d, h = size
    me = obj.data
    front_of_back = None
    ys = sorted(p.center.y for p in me.polygons
                if abs(p.center.x) < w * 0.12 and h * 0.5 < p.center.z < h * 0.8 and p.normal.y < -0.6)
    if ys: front_of_back = ys[len(ys) // 2]
    front_y = min(v.co.y for v in me.vertices)
    parts = {}
    for p in me.polygons:
        c = p.center
        if c.z < h * 0.13:
            parts[p.index] = 'legs'
        elif front_of_back is not None and h * 0.55 < c.z < h * 0.9 and w * 0.14 < abs(c.x) < w * 0.42 and front_y + d * 0.3 < c.y < front_of_back - d * 0.04:
            parts[p.index] = 'pillowLeft' if c.x < 0 else 'pillowRight'
    return parts

def rule_armchair(obj, size):
    """Wood frame: side posts, arms and legs at the outer edges, rails at the bottom. The pillow sits
    forward of the back cushion in the middle; everything else is cushion."""
    w, d, h = size
    me = obj.data
    front_y = min(v.co.y for v in me.vertices)
    ys = sorted(p.center.y for p in me.polygons
                if w * 0.3 < abs(p.center.x) < w * 0.4 and h * 0.5 < p.center.z < h * 0.8 and p.normal.y < -0.6)
    front_of_back = ys[len(ys) // 2] if ys else None
    parts = {}
    for p in me.polygons:
        c = p.center
        if abs(c.x) > w * 0.43 or c.z < h * 0.14:
            parts[p.index] = 'wood'
        elif front_of_back is not None and h * 0.5 < c.z < h * 0.88 and abs(c.x) < w * 0.3 and front_y + d * 0.3 < c.y < front_of_back - d * 0.04:
            parts[p.index] = 'pillow'
    return parts

def rule_potted(pot_fraction=0.27):
    """Pot below a fraction of the height, soil on the upward faces just inside its rim, foliage above."""
    def rule(obj, size):
        w, d, h = size
        me = obj.data
        parts = {}
        for p in me.polygons:
            c = p.center
            if c.z < h * pot_fraction:
                parts[p.index] = 'pot'
            elif c.z < h * (pot_fraction + 0.05) and p.normal.z > 0.6 and (c.x * c.x + c.y * c.y) ** 0.5 < w * 0.3:
                parts[p.index] = 'soil'
        return parts
    return rule

def rule_bands(bands):
    """Horizontal bands by height fraction: [(top_fraction, part), ...] from the floor up; None keeps the body."""
    def rule(obj, size):
        w, d, h = size
        parts = {}
        for p in obj.data.polygons:
            z = p.center.z / h
            for top, part in bands:
                if z < top:
                    if part: parts[p.index] = part
                    break
        return parts
    return rule

def rule_fronts(part, z_range=(0.1, 0.9), x_limit=0.47, depth=0.25, base=None):
    """Front-facing faces (drawer or door fronts) within a height range, optionally over a base rule."""
    def rule(obj, size):
        w, d, h = size
        parts = base(obj, size) if base else {}
        front_y = min(v.co.y for v in obj.data.vertices)
        for p in obj.data.polygons:
            c = p.center
            if p.normal.y < -0.7 and c.y < front_y + d * depth and h * z_range[0] < c.z < h * z_range[1] and abs(c.x) < w * x_limit:
                parts[p.index] = part
        return parts
    return rule

def rule_bed(obj, size):
    """Wood frame and headboard, cream mattress and pillows at the head, sage blanket over the foot."""
    w, d, h = size
    me = obj.data
    front_y = min(v.co.y for v in me.vertices); back_y = max(v.co.y for v in me.vertices)
    parts = {}
    for p in me.polygons:
        c = p.center
        if c.z < h * 0.36 or c.y > back_y - d * 0.06:
            parts[p.index] = 'wood'
        elif c.y < front_y + d * 0.58:
            parts[p.index] = 'blanket'
    return parts

PARTS = {
    # key: (rule, { part: (material role, colour name, recolour?) }, body material)
    'sofa': (rule_sofa, {'legs': ('wood', 'wood', False), 'pillowLeft': ('pillow', 'caramel', False), 'pillowRight': ('pillow', 'sage', False)}, ('fabric', 'cream', True)),
    'armchair': (rule_armchair, {'wood': ('wood', 'wood', False), 'pillow': ('pillow', 'sage', True)}, ('fabric', 'cream', True)),
    'plant': (rule_potted(0.31), {'pot': ('pot', 'pot', True), 'soil': ('soil', 'soil', False)}, ('leaf', 'green', False)),
    'ottoman': (rule_bands([(0.2, 'legs')]), {'legs': ('wood', 'wood', False)}, ('fabric', 'ottoman', True)),
    'bed': (rule_bed, {'wood': ('wood', 'wood', False), 'blanket': ('blanket', 'sage', False)}, ('fabric', 'cream', True)),
    'wardrobe': (rule_fronts('door', (0.06, 0.95), x_limit=0.46), {'door': ('door', 'door', False)}, ('wood', 'wood', False)),
    'dresser': (rule_fronts('drawer', (0.14, 0.9), base=rule_bands([(0.12, 'oak'), (0.93, None), (1.1, 'oak')])), {'drawer': ('drawer', 'cottageCream', False), 'oak': ('oak', 'oak', False)}, ('paint', 'paint', True)),
    'nightstand': (rule_fronts('drawer', (0.35, 0.78)), {'drawer': ('drawer', 'door', False)}, ('wood', 'wood', False)),
    'bench': (rule_bands([(0.66, 'dark'), (0.82, 'wood'), (1.1, 'pad')]), {'dark': ('dark', 'dark', False), 'wood': ('wood', 'wood', False), 'pad': ('pad', 'sage', True)}, ('wood', 'wood', False)),
    'pouf': (lambda o, sz: {}, {}, ('fabric', 'cream', True)),
    'sideTable': (rule_bands([(0.86, 'dark')]), {'dark': ('dark', 'dark', False)}, ('wood', 'wood', False)),
    'lowTable': (lambda o, sz: {}, {}, ('ash', 'ash', False)),
}

def material(name, hex_color):
    m = bpy.data.materials.new(name)
    r, g, b = ((hex_color >> 16) & 255) / 255, ((hex_color >> 8) & 255) / 255, (hex_color & 255) / 255
    srgb = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    m.diffuse_color = (srgb(r), srgb(g), srgb(b), 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (srgb(r), srgb(g), srgb(b), 1)
        bsdf.inputs['Roughness'].default_value = 0.85
    return m

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = args.key
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = obj.data
before = len(me.polygons)

# --- drop the ground plate some generators add under the object (a drawn shadow turned solid) ---
zs = [v.co.z for v in me.vertices]; z0, zh = min(zs), max(zs) - min(zs)
bm = bmesh.new(); bm.from_mesh(me)
plate = [f for f in bm.faces if f.calc_center_median().z < z0 + zh * args.plate]
if plate: bmesh.ops.delete(bm, geom=plate, context='FACES')
bm.to_mesh(me); bm.free(); me.update()

# --- scale each axis to the catalog size and put the origin on the floor ---
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
cur = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
W, D, H = args.size
s = Vector((W / cur[0], D / cur[1], H / cur[2]))
cx, cy, cz = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, min(zs)
back_y = max(ys)
for v in me.vertices:
    v.co = Vector(((v.co.x - cx) * s.x, (v.co.y - (back_y if args.wall else cy)) * s.y, (v.co.z - cz) * s.z))
me.update()

# --- decimate to budget, then smooth by angle ---
ratio = min(1.0, args.tris / max(1, len(me.polygons)))
mod = obj.modifiers.new('decimate', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='decimate')
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me); bm.free(); me.update()
for p in me.polygons: p.use_smooth = True
try:
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(args.angle))
except Exception:
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(args.angle))
    except Exception: pass

# --- split colour parts and assign flat materials ---
rule, part_specs, body_spec = PARTS.get(args.key, (lambda o, sz: {}, {}, ('body', 'cream', True)))
assignment = rule(obj, (W, D, H))

def smooth_labels(me, labels, passes=3):
    """Majority vote over edge neighbours so part boundaries follow the shape, not the triangulation."""
    edge_faces = {}
    for p in me.polygons:
        for e in p.edge_keys: edge_faces.setdefault(e, []).append(p.index)
    neighbours = {p.index: [] for p in me.polygons}
    for faces in edge_faces.values():
        for a in faces:
            for b in faces:
                if a != b: neighbours[a].append(b)
    for _ in range(passes):
        changed = {}
        for i, ns in neighbours.items():
            if not ns: continue
            votes = {}
            for n in ns: votes[labels.get(n)] = votes.get(labels.get(n), 0) + 1
            best, count = max(votes.items(), key=lambda kv: kv[1])
            if count > len(ns) / 2 and best != labels.get(i): changed[i] = best
        for i, label in changed.items():
            if label is None: labels.pop(i, None)
            else: labels[i] = label
    return labels
assignment = smooth_labels(me, assignment, args.smooth_passes) if args.smooth_passes else assignment
body_mat = material(f'{args.key}.{body_spec[0]}.{COLORS[body_spec[1]]:06x}', COLORS[body_spec[1]])
me.materials.append(body_mat)
recolors = {body_mat.name: body_spec[2]}
slot_of = {}
for part, (role, color, recolor) in part_specs.items():
    m = material(f'{args.key}.{role}.{COLORS[color]:06x}', COLORS[color]); recolors[m.name] = recolor
    me.materials.append(m); slot_of[part] = len(me.materials) - 1
for p in me.polygons: p.material_index = slot_of.get(assignment.get(p.index), 0)
me.update()

# separate every non-body part into its own object so recolour only touches the body
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
for p in me.polygons: p.select = p.material_index != 0
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
root = bpy.data.objects.new(args.key + '.root', None); bpy.context.scene.collection.objects.link(root)
root['catalogKey'] = args.key
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    o.parent = root
    used = {me.materials[p.material_index].name for me in [o.data] for p in me.polygons}
    o.name = args.key + '_' + (next(iter(used)).split('.')[1] if used else 'part')   # underscores: Three.js strips dots from node names
    for slot in list(o.material_slots):
        if slot.material and slot.material.name not in used: pass
    if any(recolors.get(n) for n in used): o['recolor'] = True
    o.data.materials.clear()
    for n in used: o.data.materials.append(bpy.data.materials[n])
    for p in o.data.polygons: p.material_index = 0

# --- export ---
os.makedirs(os.path.dirname(out), exist_ok=True)
for o in bpy.context.scene.objects: o.select_set(o == root or o.parent == root)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_extras=True, export_materials='EXPORT', export_image_format='NONE', export_normals=True, export_texcoords=False)
total = sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
print(f'{args.key}: {before} -> {total} triangles, size {W}x{D}x{H}, parts {[o.name for o in bpy.context.scene.objects if o.type == "MESH"]}')
print('wrote', out)

# --- optional previews from the game angle, front, back and top ---
if args.preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.world = bpy.data.worlds.new('w'); scene.world.color = (0.98, 0.95, 0.90)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.type = 'ORTHO'
    center = Vector((0, 0, H / 2)); size = max(W, D, H)
    for name, (yaw, pitch) in {'iso': (-45, 35), 'front': (0, 10), 'back': (180, 10), 'top': (0, 89)}.items():
        d = Vector((math.sin(math.radians(yaw)) * math.cos(math.radians(pitch)), -math.cos(math.radians(yaw)) * math.cos(math.radians(pitch)), math.sin(math.radians(pitch))))
        cam.location = center + d * 10; cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = size * 1.25
        scene.render.filepath = os.path.join(args.preview, f'{args.key}-{name}.png'); bpy.ops.render.render(write_still=True)
