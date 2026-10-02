"""V2 finish pass: explicit material parts, neutral palette, economical geometry.

Used only for the staged collection, never writes production models.
"""
import math
import bpy
import bmesh
from mathutils import Vector


def refine(prop, root, collection, objects):
    key = prop['key']
    changes = ['v2 native beveled panels and cushions; separate flat materials']

    def mat(color, role='fixed'):
        name = f'{key}.{role}.{color:06x}'
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials.new(name)
            rgb = [((color >> s) & 255) / 255 for s in (16, 8, 0)]
            rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
            m.diffuse_color = (*rgb, 1)
            m.use_nodes = True
            bsdf = m.node_tree.nodes.get('Principled BSDF')
            bsdf.inputs['Base Color'].default_value = (*rgb, 1)
            bsdf.inputs['Roughness'].default_value = .85
            m['role'] = role
        return m

    def adopt(o, name, color, role='fixed'):
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)
        o.name = f'{key}_{name}'
        o.parent = root
        o.data.materials.clear()
        o.data.materials.append(mat(color, role))
        o['role'] = role
        o['recolor'] = role == 'recolor'
        objects.append(o)
        return o

    def remove(predicate):
        for o in list(objects):
            if predicate(o):
                objects.remove(o)
                bpy.data.objects.remove(o, do_unlink=True)

    def lathe(name, profile, color, role='fixed', n=16):
        verts, faces = [], []
        for r, z in profile:
            verts.extend((math.cos(i * math.tau/n)*r, math.sin(i * math.tau/n)*r, z) for i in range(n))
        for j in range(len(profile)-1):
            for i in range(n):
                v = j*n+i
                w = j*n+(i+1)%n
                faces.append((v,w,w+n,v+n))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], faces)
        o = bpy.data.objects.new(name, mesh)
        collection.objects.link(o)
        return adopt(o, name, color, role)

    def cylinder(name, radius, depth, pos, color, role='fixed', n=8):
        bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=radius, depth=depth,
                                          location=(pos[0],-pos[2],pos[1]))
        return adopt(bpy.context.object,name,color,role)

    def color(o):
        return o.data.materials[0].name.split('.')[-1]

    if key == 'plant':
        for o in objects:
            if color(o) == 'eee0ca':
                o.data.materials[0] = mat(0xeee0ca, 'recolor')
                o['role'], o['recolor'] = 'recolor', True
        changes.append('generic plant pot has its own recolorable material')

    if key == 'bed':
        for o in objects:
            if color(o) == '81936a':
                o.data.materials[0] = mat(0x81936a)
                o['role'], o['recolor'] = 'fixed', False
        changes.append('sage blanket and cuff stay distinct from cream mattress/pillows')

    if key == 'mug':
        remove(lambda o: o.get('recolor') and len(o.data.polygons) < 100)
        # Hollow ceramic lip; coffee remains independent. Handle is retained.
        lathe('ceramic-cup', [(0,0),(.060,0),(.065,.008),(.075,.125),(.072,.13),
                            (.063,.13),(.060,.115)], 0xf3e4d2, 'recolor', n=16)
        changes.append('hollow cup rim and independent coffee insert')

    if key == 'lantern':
        remove(lambda o: True)
        cylinder('base',.088,.02,(0,.01,0),0x393932,'recolor',n=6)
        for i in range(6):
            angle = i*math.tau/6
            cylinder(f'bar-{i}',.006,.18,(math.cos(angle)*.07,.11,math.sin(angle)*.07),0x393932,'recolor',n=4)
        bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.10,radius2=.025,depth=.06,location=(0,0,.23))
        adopt(bpy.context.object,'roof',0x393932,'recolor')
        cylinder('candle',.025,.09,(0,.065,0),0xf3e4d2,n=8)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=6,ring_count=4,radius=.016,location=(0,0,.12))
        flame = adopt(bpy.context.object,'flame',0xffd58a,'glow')
        flame.scale.z = 1.5
        bsdf = flame.data.materials[0].node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Emission Color'].default_value = (1,.6,.2,1)
        bsdf.inputs['Emission Strength'].default_value = .5
        bpy.ops.mesh.primitive_torus_add(major_segments=10,minor_segments=4,major_radius=.026,minor_radius=.005,
                                       location=(0,0,.275),rotation=(math.pi/2,0,0))
        adopt(bpy.context.object,'brass-ring',0xbb9451)
        changes.append('open hexagonal cage and cream candle; no translucent black film')

    if key in ('worldMap','botanicalPrint'):
        for o in objects:
            if o.get('role') == 'canvas':
                o.data.materials[0] = mat(0xf3e4d2,'canvas')
        changes.append('blank cream canvas reserved for later game artwork')

    # Fix face normals and keep large planar panels flat, curved parts softly shaded.
    for o in objects:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(o.data)
        bm.free()
        bpy.context.view_layer.objects.active = o
        for other in bpy.context.selected_objects:
            other.select_set(False)
        o.select_set(True)
        for face in o.data.polygons:
            face.use_smooth = o.get('role') != 'canvas'
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
        # Material boundaries are object boundaries, so later decimation cannot smear colors.
        assert len(o.data.materials) == 1, f'{key}: material parts must stay isolated'
    root['artReference'] = 'art-source/prop-sheet-low-poly-v2.png'
    root['refinements'] = '; '.join(changes)
    return changes
