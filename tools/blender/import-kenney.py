"""Import Kenney's Furniture Kit (CC0) as Little Nest catalog items.

    blender --background --python tools/blender/import-kenney.py -- [--keys chair sofa] [--preview DIR] [--turn 0]

Reads art-source/packs/kenney-furniture-kit/Models/GLTF format/<name>.glb, and for every entry in
ITEMS: separates parts by material, remaps the kit's pastel palette to Little Nest colours, scales
it to the game (about 2x) so it fits whole grid cells, turns it so the front faces +Z, moves the
origin to the floor centre (wall items: bottom centre of the back face), finds table tops and seat
cushions by raycasting, and writes public/models/kit<Name>.glb plus src/data/kenney-catalog.json,
which src/kenney.js turns into catalog entries. Walls, floors, doorways, stairs and ceiling pieces
are left out on purpose (EXCLUDED): the room shell is procedural and there is no ceiling layer.
"""
import bpy, bmesh, sys, os, json, math, argparse
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--keys', nargs='*', default=None)
ap.add_argument('--preview', default=None)
ap.add_argument('--turn', type=int, default=0, help='quarter turns applied to every model so its front faces game +Z')
ap.add_argument('--no-json', action='store_true')
args = ap.parse_args(argv)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'art-source', 'packs', 'kenney-furniture-kit', 'Models', 'GLTF format')
OUT = os.path.join(ROOT, 'public', 'models')
CATALOG_JSON = os.path.join(ROOT, 'src', 'data', 'kenney-catalog.json')

EXCLUDED = ['wall', 'wallCorner', 'wallCornerRond', 'wallDoorway', 'wallDoorwayWide', 'wallHalf', 'wallWindow', 'wallWindowSlide',
            'floorFull', 'floorHalf', 'floorCorner', 'floorCornerRound', 'paneling', 'doorway', 'doorwayFront', 'doorwayOpen',
            'stairs', 'stairsCorner', 'stairsOpen', 'stairsOpenSingle', 'ceilingFan', 'lampSquareCeiling']

# name: (label, category, kind, tags). kind: floor | table (floor with a top surface) | seat (floor with seat slots)
#   | rug | small (sits on tables) | soft (sits on seats) | wall | lamp (floor lamp) | tablelamp | walllamp
ITEMS = {
  'bench': ('Wooden bench', 'seating', 'floor', ['wood']), 'benchCushion': ('Cushioned bench', 'seating', 'seat', []),
  'benchCushionLow': ('Low bench', 'seating', 'seat', []), 'chair': ('Wooden chair', 'seating', 'floor', ['dining']),
  'chairCushion': ('Cushioned chair', 'seating', 'floor', ['dining']), 'chairDesk': ('Desk chair', 'seating', 'floor', ['office']),
  'chairModernCushion': ('Modern chair', 'seating', 'floor', ['dining']), 'chairModernFrameCushion': ('Frame chair', 'seating', 'floor', ['dining']),
  'chairRounded': ('Rounded chair', 'seating', 'floor', ['dining']), 'loungeChair': ('Lounge chair', 'seating', 'seat', ['armchair']),
  'loungeChairRelax': ('Recliner', 'seating', 'seat', ['armchair']), 'loungeDesignChair': ('Design armchair', 'seating', 'seat', ['armchair']),
  'loungeDesignSofa': ('Design sofa', 'seating', 'seat', ['couch']), 'loungeDesignSofaCorner': ('Corner design sofa', 'seating', 'seat', ['couch']),
  'loungeSofa': ('Lounge sofa', 'seating', 'seat', ['couch']), 'loungeSofaCorner': ('Corner sofa', 'seating', 'seat', ['couch']),
  'loungeSofaLong': ('Chaise sofa', 'seating', 'seat', ['couch']), 'loungeSofaOttoman': ('Sofa ottoman', 'seating', 'seat', ['footstool']),
  'stoolBar': ('Bar stool', 'seating', 'floor', ['kitchen']), 'stoolBarSquare': ('Square bar stool', 'seating', 'floor', ['kitchen']),
  'bedBunk': ('Bunk bed', 'seating', 'floor', ['bedroom', 'kids']), 'bedDouble': ('Double bed', 'seating', 'seat', ['bedroom']),
  'bedSingle': ('Single bed', 'seating', 'seat', ['bedroom']),
  'desk': ('Writing desk', 'tables', 'table', ['office']), 'deskCorner': ('Corner desk', 'tables', 'table', ['office']),
  'table': ('Dining table', 'tables', 'table', ['dining']), 'tableCloth': ('Table with cloth', 'tables', 'table', ['dining']),
  'tableCross': ('Cross-leg table', 'tables', 'table', ['dining']), 'tableCrossCloth': ('Cross-leg table with cloth', 'tables', 'table', ['dining']),
  'tableGlass': ('Glass table', 'tables', 'table', ['dining']), 'tableRound': ('Round table', 'tables', 'table', ['dining']),
  'tableCoffee': ('Low coffee table', 'tables', 'table', ['living']), 'tableCoffeeGlass': ('Glass coffee table', 'tables', 'table', ['living']),
  'tableCoffeeGlassSquare': ('Square glass coffee table', 'tables', 'table', ['living']), 'tableCoffeeSquare': ('Square coffee table', 'tables', 'table', ['living']),
  'sideTable': ('Console table', 'tables', 'table', []), 'sideTableDrawers': ('Console with drawers', 'tables', 'table', ['storage']),
  'cabinetBed': ('Bedside cabinet', 'tables', 'table', ['bedroom']), 'cabinetBedDrawer': ('Bedside drawer', 'tables', 'table', ['bedroom']),
  'cabinetBedDrawerTable': ('Bedside table', 'tables', 'table', ['bedroom']), 'cabinetTelevision': ('Media console', 'tables', 'table', ['tv']),
  'cabinetTelevisionDoors': ('Media cabinet', 'tables', 'table', ['tv', 'storage']),
  'kitchenCabinet': ('Kitchen cabinet', 'tables', 'table', ['kitchen']), 'kitchenCabinetDrawer': ('Kitchen drawers', 'tables', 'table', ['kitchen']),
  'kitchenCabinetCornerInner': ('Kitchen corner', 'tables', 'table', ['kitchen']), 'kitchenCabinetCornerRound': ('Rounded kitchen corner', 'tables', 'table', ['kitchen']),
  'kitchenBar': ('Kitchen bar', 'tables', 'table', ['kitchen']), 'kitchenBarEnd': ('Bar end', 'tables', 'floor', ['kitchen']),
  'kitchenSink': ('Kitchen sink', 'tables', 'table', ['kitchen']), 'kitchenStove': ('Gas stove', 'tables', 'table', ['kitchen', 'cooking']),
  'kitchenStoveElectric': ('Electric stove', 'tables', 'table', ['kitchen', 'cooking']), 'bathroomSinkSquare': ('Vanity sink', 'tables', 'table', ['bathroom']),
  'bathroomCabinetDrawer': ('Bathroom drawers', 'tables', 'table', ['bathroom', 'storage']), 'washer': ('Washing machine', 'tables', 'table', ['laundry']),
  'dryer': ('Dryer', 'tables', 'table', ['laundry']),
  'bookcaseClosed': ('Bookcase', 'decor', 'table', ['storage', 'books']), 'bookcaseClosedDoors': ('Bookcase with doors', 'decor', 'table', ['storage', 'books']),
  'bookcaseClosedWide': ('Wide bookcase', 'decor', 'table', ['storage', 'books']), 'bookcaseOpen': ('Open bookcase', 'decor', 'table', ['storage', 'books']),
  'bookcaseOpenLow': ('Low open shelf', 'decor', 'table', ['storage', 'books']), 'cardboardBoxClosed': ('Cardboard box', 'decor', 'floor', ['storage', 'moving']),
  'cardboardBoxOpen': ('Open box', 'decor', 'floor', ['storage', 'moving']), 'coatRackStanding': ('Coat stand', 'decor', 'floor', ['hallway']),
  'kitchenFridge': ('Fridge', 'decor', 'floor', ['kitchen']), 'kitchenFridgeBuiltIn': ('Built-in fridge', 'decor', 'floor', ['kitchen']),
  'kitchenFridgeLarge': ('Double fridge', 'decor', 'floor', ['kitchen']), 'kitchenFridgeSmall': ('Small fridge', 'decor', 'table', ['kitchen']),
  'lampRoundFloor': ('Round floor lamp', 'decor', 'lamp', ['light']), 'lampSquareFloor': ('Square floor lamp', 'decor', 'lamp', ['light']),
  'pottedPlant': ('Potted plant', 'decor', 'floor', ['plant', 'pot']), 'rugDoormat': ('Doormat', 'decor', 'rug', ['rug', 'hallway']),
  'rugRectangle': ('Rectangle rug', 'decor', 'rug', ['rug']), 'rugRound': ('Round rug', 'decor', 'rug', ['rug']),
  'rugRounded': ('Rounded rug', 'decor', 'rug', ['rug']), 'rugSquare': ('Square rug', 'decor', 'rug', ['rug']),
  'shower': ('Corner shower', 'decor', 'floor', ['bathroom']), 'showerRound': ('Round shower', 'decor', 'floor', ['bathroom']),
  'bathtub': ('Bathtub', 'decor', 'floor', ['bathroom', 'bath']), 'bathroomSink': ('Pedestal sink', 'decor', 'floor', ['bathroom']),
  'toilet': ('Toilet', 'decor', 'floor', ['bathroom']), 'toiletSquare': ('Square toilet', 'decor', 'floor', ['bathroom']),
  'speaker': ('Floor speaker', 'decor', 'floor', ['music']), 'trashcan': ('Bin', 'decor', 'floor', ['kitchen']),
  'televisionVintage': ('Vintage TV', 'decor', 'floor', ['tv', 'retro']), 'washerDryerStacked': ('Washer-dryer stack', 'decor', 'floor', ['laundry']),
  'books': ('Books', 'small', 'small', ['books', 'reading']), 'computerKeyboard': ('Keyboard', 'small', 'small', ['office', 'computer']),
  'computerMouse': ('Mouse', 'small', 'small', ['office', 'computer']), 'computerScreen': ('Monitor', 'small', 'small', ['office', 'computer']),
  'laptop': ('Laptop', 'small', 'small', ['office', 'computer']), 'kitchenBlender': ('Blender', 'small', 'small', ['kitchen']),
  'kitchenCoffeeMachine': ('Coffee machine', 'small', 'small', ['kitchen', 'coffee']), 'kitchenMicrowave': ('Microwave', 'small', 'small', ['kitchen']),
  'toaster': ('Toaster', 'small', 'small', ['kitchen']), 'plantSmall1': ('Little plant', 'small', 'small', ['plant', 'pot']),
  'plantSmall2': ('Little leafy plant', 'small', 'small', ['plant', 'pot']), 'plantSmall3': ('Little spiky plant', 'small', 'small', ['plant', 'pot']),
  'radio': ('Radio', 'small', 'small', ['music', 'retro']), 'lampRoundTable': ('Round table lamp', 'small', 'tablelamp', ['light']),
  'lampSquareTable': ('Square table lamp', 'small', 'tablelamp', ['light']), 'televisionAntenna': ('TV antenna', 'small', 'small', ['tv', 'retro']),
  'speakerSmall': ('Bookshelf speaker', 'small', 'small', ['music']),
  'pillow': ('Square cushion', 'soft', 'soft', ['cushion', 'pillow']), 'pillowBlue': ('Flat cushion', 'soft', 'soft', ['cushion', 'pillow']),
  'pillowLong': ('Long cushion', 'soft', 'soft', ['cushion', 'pillow']), 'pillowBlueLong': ('Long flat cushion', 'soft', 'soft', ['cushion', 'pillow']),
  'bear': ('Teddy bear', 'soft', 'soft', ['toy', 'kids']),
  'bathroomCabinet': ('Bathroom cabinet', 'wall', 'wall', ['bathroom', 'storage']), 'bathroomMirror': ('Bathroom mirror', 'wall', 'wall', ['bathroom', 'glass']),
  'kitchenCabinetUpper': ('Upper cabinet', 'wall', 'wall', ['kitchen', 'storage']), 'kitchenCabinetUpperCorner': ('Upper corner cabinet', 'wall', 'wall', ['kitchen', 'storage']),
  'kitchenCabinetUpperDouble': ('Double upper cabinet', 'wall', 'wall', ['kitchen', 'storage']), 'kitchenCabinetUpperLow': ('Low upper cabinet', 'wall', 'wall', ['kitchen', 'storage']),
  'hoodLarge': ('Range hood', 'wall', 'wall', ['kitchen']), 'hoodModern': ('Modern range hood', 'wall', 'wall', ['kitchen']),
  'coatRack': ('Wall coat rack', 'wall', 'wall', ['hallway']), 'lampWall': ('Wall lamp', 'wall', 'walllamp', ['light']),
  'televisionModern': ('Flat-screen TV', 'wall', 'wall', ['tv']),
}

# The kit's pastel palette, remapped to Little Nest. role, colour, recolourable.
PALETTE = {
  'wood': ('wood', 0xc8925e, False), 'woodDark': ('woodDark', 0x8a5f40, False),
  'carpet': ('fabric', 0xf3e4d2, True), 'carpetWhite': ('fabricLight', 0xf6efe2, False),
  'carpetBlue': ('fabricAccent', 0x81936a, False), 'carpetDarker': ('fabricDark', 0xb96949, False),
  'metal': ('metal', 0xe8dfd2, False), 'metalLight': ('metalLight', 0xf3ece0, False),
  'metalMedium': ('metalMedium', 0xb5a898, False), 'metalDark': ('metalDark', 0x5b524a, False),
  'glass': ('glass', 0xd8e6e4, False), 'lamp': ('glow', 0xffebc4, False), 'plant': ('leaf', 0x5f8a4a, False),
  'fur': ('fur', 0xc38e62, True), '_defaultMat': ('paint', 0xf3ece0, False),
}

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def make_material(name, hex_color):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    rgb = [srgb_to_linear(((hex_color >> s) & 255) / 255) for s in (16, 8, 0)]
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    m.diffuse_color = (*rgb, 1)
    return m

def fit_scale(sx, sz, sy, kind):
    """Uniform scale: about 2x, shrunk a little so a model that barely spills over a whole cell fits it."""
    if kind == 'small':
        return min(2.0, 0.34 / max(sx, sz), 0.4 / sy)
    if kind == 'tablelamp':
        return min(2.0, 0.34 / max(sx, sz), 0.6 / sy)
    if kind == 'soft':
        return min(2.0, 0.5 / max(sx, sz), 0.4 / sy)
    s = 2.0
    for size in (sx, sz):
        w = size * s
        if w > 1 and w - math.floor(w) < 0.3:
            s = min(s, (math.floor(w) - 0.04) / size)
    if kind in ('wall', 'walllamp'):
        s = min(s, 0.56 / max(sz, 1e-6))   # wall items stand at most 0.56 off the wall
    return s

def world_bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))

def bvh_of(objs):
    bm = bmesh.new()
    for o in objs:
        tmp = bmesh.new(); tmp.from_mesh(o.data); tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new('tmp'); tmp.to_mesh(me); tmp.free()
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    tree = BVHTree.FromBMesh(bm); bm.free()
    return tree

def process(name):
    label, category, kind, tags = ITEMS[name]
    key = 'kit' + name[0].upper() + name[1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.glb'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    obj.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if args.turn: obj.data.transform(Matrix.Rotation(math.pi / 2 * args.turn, 4, 'Z'))

    # Size, scale, and origin. Blender: x = game x, -y = game z (front), z = up.
    mn, mx = world_bounds([obj])
    sx, sz, sy = mx.x - mn.x, mx.y - mn.y, mx.z - mn.z
    s = fit_scale(sx, sz, sy, kind)
    wall = kind in ('wall', 'walllamp')
    cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
    anchor_y = mx.y if wall else cy   # wall items: the back face sits on the wall plane
    obj.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -anchor_y, -mn.z)))
    obj.data.update()

    # Remap materials, then split into one object per material so recolour and glow parts stay separate.
    used = []
    for slot in obj.material_slots:
        src = slot.material.name.split('.')[0] if slot.material else '_defaultMat'
        role, colour, recolor = PALETTE.get(src, PALETTE['_defaultMat'])
        m = make_material(f'{key}.{role}.{colour:06x}', colour)
        slot.material = m
        used.append((role, recolor))
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    fabric_roles = [r for r, rc in used if rc]
    recolor_role = fabric_roles[0] if fabric_roles else None
    default_color = None
    root = bpy.data.objects.new(key + '.root', None); bpy.context.scene.collection.objects.link(root)
    for o in parts:
        mat = o.data.materials[0]
        role = mat.name.split('.')[1]
        o.name = key + '_' + role
        o['role'] = role
        if role == recolor_role:
            o['recolor'] = True
            default_color = int(mat.name.split('.')[2], 16)
        o.parent = root
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(o.data); bm.free()
        for p in o.data.polygons: p.use_smooth = False

    mn, mx = world_bounds(parts)
    W, D, H = mx.x - mn.x, mx.y - mn.y, mx.z - mn.z
    entry = {'key': key, 'source': name, 'label': label, 'category': category, 'tags': tags, 'size': [round(W, 3), round(D, 3), round(H, 3)]}
    if kind in ('small', 'tablelamp'):
        entry.update(layer='surface', w=1, d=1)
    elif kind == 'soft':
        entry.update(layer='surface', surfaceKind='seat', w=1, d=1)
    elif wall:
        cols = max(1, math.ceil(W - 0.05)); rows = max(1, math.ceil((H - 0.05) / 0.5))
        entry.update(layer='wall', w=cols, d=1, wall={'w': cols, 'h': rows})
    else:
        w = max(1, math.ceil(W - 0.05)); d = max(1, math.ceil(D - 0.05))
        entry.update(w=w, d=d)
        if kind == 'rug': entry['layer'] = 'floor'
        if kind in ('table', 'seat'):
            # Slots: a grid over the footprint; keep those whose downward ray lands on a top or cushion.
            tree = bvh_of(parts)
            xs = [(i + 0.5) / w * W - W / 2 for i in range(w)]
            zs = [0.0] if d == 1 else [(j + 0.5) / d * D - D / 2 for j in range(d)]
            if kind == 'seat' and d == 1: zs = [-0.12 * D]   # forward of the backrest (game +z = blender -y)
            slots = []
            for z in zs:
                for x in xs:
                    hit = tree.ray_cast(Vector((x, -z, H + 1)), Vector((0, 0, -1)))
                    if hit[0] is None: continue
                    top = hit[0].z
                    if kind == 'table' and top < H - 0.06 and top < 0.25: continue   # empty corner of an L-shape
                    if kind == 'seat' and (top < 0.15 or (H > 0.6 and top > 0.75 * H + 0.05)): continue   # low seats have no backrest
                    slots.append({'x': round(x, 3), 'z': round(z, 3), 'y': round(top, 3)})
            if slots:
                base = max(sl['y'] for sl in slots)
                surface = {'y': base, 'slots': [{k: v for k, v in sl.items() if k != 'y' or abs(v - base) > 0.02} for sl in slots]}
                if kind == 'seat': surface['kind'] = 'seat'
                entry['surface'] = surface
    if kind in ('lamp', 'tablelamp', 'walllamp'):
        entry['lamp'] = kind
    if default_color is not None: entry['defaultColor'] = default_color

    os.makedirs(OUT, exist_ok=True)
    for o in bpy.context.scene.objects: o.select_set(o == root or o.parent == root)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, key + '.glb'), export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_extras=True, export_materials='EXPORT', export_image_format='NONE', export_texcoords=False)
    if args.preview:
        preview(key, max(W, D, H), H)
    return entry

def preview(key, size, H):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x = scene.render.resolution_y = 256
    scene.world = bpy.data.worlds.new('w'); scene.world.color = (0.98, 0.95, 0.9)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.5
    center = Vector((0, 0, H / 2))
    d = Vector((-math.sin(math.radians(45)), -math.cos(math.radians(45)), 0.7)).normalized()   # the game camera: front-left, above
    cam.location = center + d * 10; cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(args.preview, key + '.png'); bpy.ops.render.render(write_still=True)

names = args.keys or [n for n in ITEMS]
missing = [f[:-4] for f in os.listdir(SRC) if f.endswith('.glb') and f[:-4] not in ITEMS and f[:-4] not in EXCLUDED]
if missing: print('UNMAPPED', missing)
entries = []
for n in names:
    try:
        e = process(n); entries.append(e); print('ok', e['key'], e.get('w'), e.get('d'), e.get('layer', 'floor'), e['size'], 'slots' if e.get('surface') else '')
    except Exception as ex:
        print('FAIL', n, repr(ex))
if not args.no_json:
    if args.keys and os.path.exists(CATALOG_JSON):   # a partial run updates its entries in place
        old = json.load(open(CATALOG_JSON, encoding='utf-8'))
        fresh = {e['key']: e for e in entries}
        entries = [fresh.pop(e['key'], e) for e in old] + list(fresh.values())
    with open(CATALOG_JSON, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(entries, f, indent=1)
    print('wrote', CATALOG_JSON, len(entries))
