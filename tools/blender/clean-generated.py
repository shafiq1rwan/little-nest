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
ap.add_argument('--label-tris', type=int, default=40000, help='triangles kept while assigning colour parts (boundary accuracy)')
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
    'shade': 0xffebc4, 'paper': 0xfff1dc, 'screen': 0x9ea6a0, 'tv': 0x4b5d58, 'books': 0x8a9a79, 'cardboard': 0xc89b68, 'tape': 0xe6c397,
    'rattan': 0xc8a06c, 'coffee': 0x5b3d2a, 'flame': 0xffc76b, 'bookSage': 0x8a9a79, 'bookCream': 0xdfc8a0, 'rust': 0x9d6450,
    'picture': 0xc3d6a8, 'glow': 0xffd58a, 'canvas': 0xeed1a0, 'glass': 0xd8e6e4, 'rose': 0xd9a3a3, 'charcoal': 0x3f3d3a,
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

def rule_region(regions, base=None):
    """Label faces by (predicate(u, normal), part); first match wins. u = (x/w, depth fraction with -0.5 at
    the front face and +0.5 at the back, z/h)."""
    def rule(obj, size):
        w, d, h = size
        parts = base(obj, size) if base else {}
        front_y = min(v.co.y for v in obj.data.vertices)
        for p in obj.data.polygons:
            c = p.center; n = p.normal
            u = (c.x / w, (c.y - front_y) / d - 0.5, c.z / h)
            for pred, part in regions:
                if pred(u, n):
                    parts[p.index] = part; break
        return parts
    return rule

def top_plane(obj, h):
    """Height fraction of the largest upward-facing plane (a table or cabinet top), from an area histogram."""
    bins = {}
    for p in obj.data.polygons:
        if p.normal.z > 0.8: bins[round(p.center.z / h, 2)] = bins.get(round(p.center.z / h, 2), 0) + p.area
    if not bins: return 1.0
    biggest = max(bins.values())
    return max(z for z, a in bins.items() if a > biggest * 0.25)

def rule_dressing(part_fn, base=None):
    """Everything above the main top plane is dressing; part_fn(u) names the part (or None to keep)."""
    def rule(obj, size):
        w, d, h = size
        parts = base(obj, size) if base else {}
        top = top_plane(obj, h)
        front_y = min(v.co.y for v in obj.data.vertices)
        for p in obj.data.polygons:
            c = p.center
            u = (c.x / w, (c.y - front_y) / d - 0.5, c.z / h)
            if u[2] > top + 0.015:
                part = part_fn(u, p.normal)
                if part: parts[p.index] = part
        return parts
    return rule

front = lambda n: n.y < -0.6
up = lambda n: n.z > 0.6
RULES_MORE = {
    'coffeeTable': rule_dressing(lambda u, n: 'drop'),
    'bookshelf': rule_region([(lambda u, n: u[2] < 0.3 and front(n) and u[1] < -0.3, 'door'),
                              (lambda u, n: 0.3 < u[2] < 0.97 and front(n) and u[1] > 0.15 and abs(u[0]) < 0.46, 'dark'),
                              (lambda u, n: 0.33 < u[2] < 0.95 and front(n) and -0.4 < u[1] <= 0.15 and abs(u[0]) < 0.44, 'books')]),
    'floorLamp': rule_region([(lambda u, n: u[2] > 0.7, 'shade')]),
    'desk': rule_dressing(lambda u, n: 'drop' if u[0] > 0.2 else ('screen' if (u[2] > 0.84 and front(n)) else 'cream'),
                          base=rule_region([(lambda u, n: u[2] < 0.6 and u[0] > 0.22 and front(n) and u[1] < -0.3, 'door')])),
    'chair': rule_bands([(0.42, 'black')]),
    'sideboard': rule_dressing(lambda u, n: 'drop', base=rule_region([(lambda u, n: 0.22 < u[2] < 0.78 and front(n) and u[1] < -0.3, 'door')])),
    'tvStand': rule_region([(lambda u, n: u[2] > 0.56 and front(n) and abs(u[0]) < 0.33, 'screen'),
                            (lambda u, n: u[2] > 0.5, 'black')]),
    'boxes': rule_region([(lambda u, n: up(n) and u[2] > 0.9 and abs(u[0]) < 0.09, 'tape')]),
    'basket': rule_region([(lambda u, n: u[2] > 0.8 and (u[0] ** 2 + u[1] ** 2) ** 0.5 < 0.45, 'blanket')]),
    'mug': rule_region([(lambda u, n: up(n) and u[2] > 0.85 and abs(u[0]) < 0.3 and abs(u[1]) < 0.4, 'coffee')]),
    'candle': rule_region([(lambda u, n: u[2] > 0.84, 'flame'), (lambda u, n: u[2] < 0.12, 'brass')]),
    'bookStack': rule_bands([(0.34, 'book1'), (0.67, 'book2')]),
    'frame': rule_region([(lambda u, n: n.y < -0.3 and abs(u[0]) < 0.33 and 0.2 < u[2] < 0.8 and u[1] < -0.2, 'picture')]),
    'lantern': rule_region([(lambda u, n: u[2] > 0.9, 'brass'), (lambda u, n: 0.3 < u[2] < 0.75 and abs(u[0]) < 0.3 and abs(u[1]) < 0.3, 'glow')]),
    'worldMap': rule_region([(lambda u, n: front(n) and abs(u[0]) < 0.43 and 0.1 < u[2] < 0.9, 'canvas')]),
    'botanicalPrint': rule_region([(lambda u, n: front(n) and abs(u[0]) < 0.41 and 0.1 < u[2] < 0.9, 'canvas')]),
    'wallShelf': rule_bands([(0.6, 'dark')]),
    'mirror': rule_region([(lambda u, n: front(n) and (u[0] ** 2 + (u[2] - 0.5) ** 2) ** 0.5 < 0.42, 'glass')]),
    'clock': rule_region([(lambda u, n: front(n) and (u[0] ** 2 + (u[2] - 0.5) ** 2) ** 0.5 < 0.4, 'face')]),
    'paperLamp': rule_region([(lambda u, n: 0.35 < u[2] < 0.95, 'shade')]),
    'floralArmchair': rule_bands([(0.12, 'oak')]),
    'rockingChair': rule_region([(lambda u, n: up(n) and 0.38 < u[2] < 0.5 and abs(u[0]) < 0.4 and -0.35 < u[1] < 0.2, 'pad')]),
    'teapot': rule_region([(lambda u, n: u[2] > 0.8, 'lid')]),
}

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
    'coffeeTable': (RULES_MORE['coffeeTable'], {'drop': ('drop', 'cream', False)}, ('wood', 'wood', False)),
    'bookshelf': (RULES_MORE['bookshelf'], {'door': ('door', 'door', False), 'books': ('books', 'books', False), 'dark': ('back', 'dark', False)}, ('wood', 'wood', False)),
    'floorLamp': (RULES_MORE['floorLamp'], {'shade': ('glow', 'shade', False)}, ('wood', 'wood', False)),
    'desk': (RULES_MORE['desk'], {'screen': ('screen', 'screen', False), 'cream': ('monitor', 'cream', False), 'drop': ('drop', 'cream', False), 'door': ('door', 'door', False)}, ('wood', 'wood', False)),
    'chair': (RULES_MORE['chair'], {'black': ('base', 'black', False)}, ('fabric', 'dark', True)),
    'sideboard': (RULES_MORE['sideboard'], {'drop': ('drop', 'cream', False), 'door': ('door', 'door', False)}, ('wood', 'wood', False)),
    'tvStand': (RULES_MORE['tvStand'], {'screen': ('screen', 'tv', False), 'black': ('tv', 'black', False)}, ('wood', 'wood', False)),
    'boxes': (RULES_MORE['boxes'], {'tape': ('tape', 'tape', False)}, ('cardboard', 'cardboard', False)),
    'basket': (RULES_MORE['basket'], {'blanket': ('blanket', 'sage', True)}, ('rattan', 'rattan', False)),
    'mug': (RULES_MORE['mug'], {'coffee': ('coffee', 'coffee', False)}, ('ceramic', 'cream', True)),
    'candle': (RULES_MORE['candle'], {'flame': ('glow', 'flame', False), 'brass': ('brass', 'brass', False)}, ('wax', 'cream', True)),
    'bookStack': (RULES_MORE['bookStack'], {'book1': ('book', 'bookSage', False), 'book2': ('book', 'bookCream', False)}, ('cover', 'rust', True)),
    'frame': (RULES_MORE['frame'], {'picture': ('picture', 'picture', False)}, ('wood', 'wood', True)),
    'lantern': (RULES_MORE['lantern'], {'brass': ('brass', 'brass', False), 'glow': ('glow', 'glow', False)}, ('metal', 'black', True)),
    'worldMap': (RULES_MORE['worldMap'], {'canvas': ('canvas', 'canvas', False)}, ('wood', 'wood', True)),
    'botanicalPrint': (RULES_MORE['botanicalPrint'], {'canvas': ('canvas', 'canvas', False)}, ('wood', 'wood', True)),
    'wallShelf': (RULES_MORE['wallShelf'], {'dark': ('bracket', 'dark', False)}, ('wood', 'wood', True)),
    'mirror': (RULES_MORE['mirror'], {'glass': ('glass', 'glass', False)}, ('ring', 'brass', True)),
    'clock': (RULES_MORE['clock'], {'face': ('face', 'cream', False)}, ('rim', 'dark', True)),
    'paperLamp': (RULES_MORE['paperLamp'], {'shade': ('glow', 'paper', False)}, ('base', 'charcoal', False)),
    'floralArmchair': (RULES_MORE['floralArmchair'], {'oak': ('oak', 'oak', False)}, ('fabric', 'rose', True)),
    'rockingChair': (RULES_MORE['rockingChair'], {'pad': ('pad', 'rose', True)}, ('oak', 'oak', False)),
    'teapot': (RULES_MORE['teapot'], {'lid': ('lid', 'paint', False)}, ('ceramic', 'cottageCream', True)),
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

# --- coarse pre-decimation so labelling stays fast while boundaries stay fine ---
def decimate(o, target):
    ratio = min(1.0, target / max(1, len(o.data.polygons)))
    if ratio >= 1.0: return
    mod = o.modifiers.new('decimate', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='decimate')
decimate(obj, args.label_tris)
me = obj.data

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

# --- parts in the 'drop' role are baked dressing that would sit on the surface slots: delete them ---
dropped = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.endswith('_drop')]
for o in dropped: bpy.data.objects.remove(o, do_unlink=True)
if dropped:
    # the dressing was fused into the surface, so removing it leaves open rings: cap them
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        bm = bmesh.new(); bm.from_mesh(o.data)
        boundary = [e for e in bm.edges if e.is_boundary]
        if boundary:
            bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(o.data); bm.free(); o.data.update()

# --- decimate each part on its own so colour boundaries stay crisp, then smooth by angle ---
parts_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
total_faces = sum(len(o.data.polygons) for o in parts_objs)
for o in parts_objs:
    decimate(o, max(60, int(args.tris * len(o.data.polygons) / total_faces)))
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free(); o.data.update()
    for p in o.data.polygons: p.use_smooth = True
    for other in bpy.context.scene.objects: other.select_set(other == o)
    bpy.context.view_layer.objects.active = o
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(args.angle))
    except Exception:
        try: bpy.ops.object.shade_auto_smooth(angle=math.radians(args.angle))
        except Exception: pass

# --- planar UVs for painted canvases (the game maps its art texture onto parts named *_canvas) ---
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.endswith('_canvas')]:
    me2 = o.data
    xs = [v.co.x for v in me2.vertices]; zs = [v.co.z for v in me2.vertices]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    uv = me2.uv_layers.new(name='canvas')
    for poly in me2.polygons:
        for li in poly.loop_indices:
            v = me2.vertices[me2.loops[li].vertex_index].co
            uv.data[li].uv = ((v.x - x0) / max(1e-6, x1 - x0), (v.z - z0) / max(1e-6, z1 - z0))

# --- export ---
os.makedirs(os.path.dirname(out), exist_ok=True)
for o in bpy.context.scene.objects: o.select_set(o == root or o.parent == root)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_extras=True, export_materials='EXPORT', export_image_format='NONE', export_normals=True, export_texcoords=True)
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
