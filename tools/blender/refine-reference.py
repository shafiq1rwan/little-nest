"""Native mesh refinements guided by output/imagegen/little-nest-48-props-sample.png.

Used by build-library.py --reference. Game coordinates are used in helpers.
No runtime/catalog mutations and no generated textures.
"""
import math
import bpy
import bmesh
from mathutils import Vector


def refine(prop, root, collection, objects):
    key = prop['key']
    changes = ['clean planar topology and angle-aware normals']

    def material(color, role='fixed'):
        name = f'{key}.{role}.{color:06x}'
        mat = bpy.data.materials.get(name)
        if mat is None:
            mat = bpy.data.materials.new(name)
            rgb = [((color >> shift) & 255) / 255 for shift in (16, 8, 0)]
            rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
            mat.diffuse_color = (*rgb, 1)
            mat.use_nodes = True
            mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = mat.diffuse_color
            mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
            mat['role'] = role
        return mat

    def adopt(obj, name, color, role='fixed'):
        for old in list(obj.users_collection):
            old.objects.unlink(obj)
        collection.objects.link(obj)
        obj.parent = root
        obj.name = f'{key}.{name}'
        obj.data.materials.clear()
        obj.data.materials.append(material(color, role))
        obj['role'] = role
        obj['recolor'] = role == 'recolor'
        objects.append(obj)
        return obj

    def point(p):
        return Vector((p[0], -p[2], p[1]))

    def ellipsoid(name, center, scale, color, role='fixed', segments=12, rings=6):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=point(center))
        obj = adopt(bpy.context.object, name, color, role)
        obj.scale = (scale[0], scale[2], scale[1])
        return obj

    def box(name, center, size, color, role='fixed', radius=.006):
        bpy.ops.mesh.primitive_cube_add(size=1, location=point(center))
        obj = adopt(bpy.context.object, name, color, role)
        obj.scale = (size[0], size[2], size[1])
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if radius > 0:
            bevel = obj.modifiers.new('Soft crafted edges', 'BEVEL')
            bevel.width = min(radius, min(size) / 4)
            bevel.segments = 2
            bpy.ops.object.modifier_apply(modifier=bevel.name)
        return obj

    def rod(name, a, b, radius, color, role='fixed', vertices=8):
        a, b = point(a), point(b)
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius * .9,
            depth=(b-a).length, location=(a+b)/2)
        obj = adopt(bpy.context.object, name, color, role)
        obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
        return obj

    def lathe(name, profile, color, role='fixed', center=(0, 0, 0), segments=20):
        vertices, faces = [], []
        for radius, height in profile:
            for i in range(segments):
                a = i * math.tau / segments
                vertices.append(tuple(point((center[0]+math.cos(a)*radius, center[1]+height, center[2]+math.sin(a)*radius))))
        for j in range(len(profile)-1):
            for i in range(segments):
                a, b = j*segments+i, j*segments+(i+1)%segments
                faces.append((a,b,b+segments,a+segments))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        return adopt(obj, name, color, role)

    def remove(predicate):
        for obj in list(objects):
            if predicate(obj):
                objects.remove(obj)
                bpy.data.objects.remove(obj, do_unlink=True)

    def hexcolor(obj):
        return obj.data.materials[0].name.split('.')[-1]

    if key == 'sideTable':
        remove(lambda o: True)
        lathe('honey.round-top', [(0,.49),(.325,.49),(.34,.505),(.34,.535),(.325,.55),(0,.55)], 0xb87946)
        lathe('walnut.flared-pedestal', [(0,0),(.19,0),(.20,.025),(.065,.43),(.09,.49),(0,.49)], 0x694b35)
        changes.append('flared pedestal and rounded circular top; surface y=.55 preserved')

    if key == 'vase':
        remove(lambda o: o.get('recolor'))
        lathe('ceramic.rounded-vase', [(0,0),(.035,0),(.06,.025),(.075,.075),(.07,.125),(.047,.16),(.033,.185),(.035,.2),(.026,.2),(.025,.175)], 0x81936a, 'recolor', segments=16)
        # Flatten flower heads into small petal rosettes rather than balls.
        for obj in list(objects):
            if hexcolor(obj) in ('e9bd6c','d79c9c'):
                midpoint = sum((obj.matrix_world @ Vector(v) for v in obj.bound_box), Vector()) / 8
                center = (midpoint.x, midpoint.z, -midpoint.y)
                color = int(hexcolor(obj),16)
                remove(lambda o: o == obj)
                ellipsoid('flower.petals', center, (.029,.012,.029), color, segments=8, rings=4)
                ellipsoid('flower.center', (center[0],center[1]+.008,center[2]), (.009,.006,.009), 0xe9bd6c, segments=6, rings=4)
        changes.append('rounded ceramic profile and flattened flower heads')

    if key == 'succulent':
        remove(lambda o: o.get('role') == 'fixed' and hexcolor(o) in ('8daa6a','6f965a'))
        for ring, count, reach, height, length in [(0,7,.039,.13,.043),(1,5,.019,.157,.034)]:
            for i in range(count):
                a = i*math.tau/count + ring*.4
                leaf = ellipsoid(f'rosette.{ring}.{i}', (math.cos(a)*reach,height,math.sin(a)*reach), (.015,.014,length), 0x8daa6a if ring else 0x6f965a, segments=8, rings=4)
                leaf.rotation_euler.z = -a + math.pi/2
                leaf.rotation_euler.x = .35 if ring else .12
        changes.append('two tiers of pointed, spreading rosette leaves')

    if key == 'monstera':
        remove(lambda o: hexcolor(o) in ('3e6a3e','4f8a4a'))
        # A solid split outline, rather than overlapping oval lobes. The fan is
        # triangulated from its central ridge, leaving deep open edge notches.
        outline = [(0,0),(.075,.01),(.14,.025),(.19,.06),(.205,.09),(.12,.13),
            (.205,.15),(.225,.18),(.21,.205),(.105,.22),(.20,.245),(.21,.265),
            (.195,.29),(.09,.30),(.16,.325),(.17,.345),(.145,.37),(.10,.405),(0,.45)]
        outline += [(-x,y) for x,y in reversed(outline[1:-1])]
        for i in range(6):
            a=i*1.05+.3
            reach=.3+(i%2)*.08
            anchor=Vector((math.cos(a)*reach,.95+(i%3)*.18,math.sin(a)*reach))
            side=Vector((math.cos(a*.35),0,-math.sin(a*.35)))
            down=Vector((math.sin(a)*.2,-.86,.48)).normalized()
            vertices=[tuple(point(anchor+side*x+down*y)) for x,y in outline]
            vertices.append(tuple(point(anchor+down*.22+Vector((0,.014,.014)))))
            center=len(vertices)-1
            faces=[(center,j,(j+1)%len(outline)) for j in range(len(outline))]
            mesh=bpy.data.meshes.new(f'monstera.split-leaf{i}')
            mesh.from_pydata(vertices,[],faces)
            obj=bpy.data.objects.new(f'monstera.split-leaf{i}',mesh)
            collection.objects.link(obj)
            adopt(obj,f'split-leaf{i}',0x3e6a3e if i%2 else 0x4f8a4a)
            # No textures: real silhouette notches, thickness retained in export.
            mod=obj.modifiers.new('Leaf thickness','SOLIDIFY')
            mod.thickness=.004
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.modifier_apply(modifier=mod.name)
        changes.append('six broad ridged leaves with genuine split outlines')

    if key == 'bonsai':
        remove(lambda o: True)
        box('tray.pot',(0,.02,0),(.28,.04,.18),0x3f3d3a,'recolor',radius=.004)
        box('tray.soil',(0,.041,0),(.25,.007,.15),0x49392c,radius=0)
        rod('trunk.leaning',(-.03,.045,0),(.015,.17,0),.015,0x6b4a2e)
        rod('branch.left',(.005,.12,0),(-.073,.17,0),.009,0x6b4a2e)
        rod('branch.right',(.01,.14,0),(.075,.20,0),.009,0x6b4a2e)
        for j,(x,y,z,r) in enumerate([(-.073,.17,0,.058),(.075,.20,0,.07),(.005,.23,-.016,.052)]):
            pad=lathe(f'foliage.pad{j}',[(0,-.014),(r*.85,-.014),(r,0),(r*.8,.014),(0,.02)],0x5f7a4a,center=(x,y,z),segments=10)
            for v in pad.data.vertices:
                v.co.y = -z + (v.co.y+z)*.7
        changes.append('tiered scalloped bonsai canopy')

    if key == 'planter':
        remove(lambda o: hexcolor(o) in ('6f965a','8daa6a','d79c9c','e9bd6c','f3e4d2'))
        for i in range(6):
            x, z = -.7+i*.28, .085 if i%2 else -.085
            for j in range(5):
                a=j*math.tau/5
                leaf=ellipsoid(f'bush{i}.leaf{j}', (x+math.cos(a)*.055,.59+(.035 if j%2 else 0),z+math.sin(a)*.055),(.075,.055,.14),0x6f965a if i%2 else 0x8daa6a,segments=8,rings=4)
                leaf.rotation_euler.z = -a
            for j in range(5):
                a=j*math.tau/5
                ellipsoid(f'flower{i}.petal{j}', (x+math.cos(a)*.035,.75,z+math.sin(a)*.035),(.029,.012,.029),[0xd79c9c,0xe9bd6c,0xf3e4d2][i%3],segments=6,rings=4)
            ellipsoid(f'flower{i}.center',(x,.765,z),(.014,.014,.014),0xe9bd6c,segments=6,rings=4)
        changes.append('six leafy flowering clumps replace ball bushes')

    if key == 'macrame':
        remove(lambda o: hexcolor(o) in ('e6ccad','6d8f50','4d7639','7fa05c'))
        for i in range(3):
            a=i*math.tau/3
            rod(f'macrame.suspension{i}',(0,1.42,.08),(math.cos(a)*.12,.63,.12+math.sin(a)*.12),.006,0xe6ccad)
        for i in range(6):
            a=i*math.tau/6
            prev=(math.cos(a)*.10,.74,.12+math.sin(a)*.1)
            for j in range(4):
                p=(math.cos(a)*(.14+.017*j),.67-j*.12,.12+math.sin(a)*(.14+.017*j))
                rod(f'vine{i}.stem{j}',prev,p,.003,0x4d7639,vertices=5)
                ellipsoid(f'vine{i}.leaf{j}',p,(.045,.026,.065),0x7fa05c if j%2 else 0x4d7639,segments=8,rings=4)
                prev=p
        changes.append('converging suspension cords and six trailing leafy vines')

    if key == 'bookStack':
        remove(lambda o: True)
        for i,(x,y,w,d) in enumerate([(0,.02,.24,.3),(.01,.0575,.22,.28),(0,.0925,.2,.27)]):
            color = [0x8a9a79,0xdfc8a0,0x9d6450][i]
            for side in [-1,1]:
                box(f'book{i}.cover{side}',(x,y+side*.014,0),(w,.007,d),color,'recolor' if i==2 else 'fixed',radius=.001)
            box(f'book{i}.paper-block',(x,y,.003),(w-.018,.021,d-.013),0xf3e4d2,radius=.001)
        changes.append('cream page blocks between colored covers')

    if key == 'basket':
        # Native geometry strips provide restrained weave without textures.
        for i in range(20):
            a=i*math.tau/20
            rod(f'rattan.vertical{i}',(math.cos(a)*.26,.055,math.sin(a)*.26),(math.cos(a)*.30,.39,math.sin(a)*.30),.008,0xb98b58,vertices=5)
        box('blanket.draped-fold',(.08,.36,.225),(.22,.28,.06),0x81936a,'recolor',radius=.025)
        changes.append('vertical rattan weave and blanket draped over rim')

    if key == 'nightstand':
        # Keep one drawer and its tabletop contract; the reference is a silhouette guide.
        box('drawer.lower-reveal',(0,.18,.251),(.47,.008,.006),0x694b35,radius=.001)
        changes.append('drawer reveal emphasizes cabinet construction')

    if key == 'boxes':
        box('cardboard.front-fold',(0,.29,.349),(.004,.56,.002),0xb4885a,radius=.0003)
        changes.append('subtle cardboard fold seam')

    if key == 'ottoman':
        for obj in objects:
            if obj.get('recolor'):
                obj.data.materials[0] = material(0xc38e62,'recolor')
        box('cushion.front-piping',(0,.34,.433),(.73,.009,.008),0xc38e62,radius=.002)
        changes.append('seat piping')

    if key == 'tvStand':
        for x in [-.58,0,.58]:
            box('console.drawer-front',(x,.34,.327),(.54,.29,.018),0xc38a56,radius=.009)
            box('console.brass-pull',(x,.39,.34),(.11,.018,.016),0xbb9451,radius=.003)
        changes.append('three console drawer fronts with brass pulls')

    if key == 'pouf':
        for i in range(6):
            a=i*math.tau/6
            rod(f'fabric.seam{i}',(math.cos(a)*.382,.065,math.sin(a)*.382),(math.cos(a)*.361,.335,math.sin(a)*.361),.0025,0xd9b48f,vertices=5)
        changes.append('six subtle fabric seam lines')

    # Repair topology and normals across the complete 48-prop library, including
    # untouched silhouettes. Planar panels keep crisp shading; curved rims/cushions
    # retain smooth normals. Avoid smoothing flat faces across their hard edges.
    for obj in objects:
        bm=bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
        bmesh.ops.dissolve_limit(bm,angle_limit=.001,verts=list(bm.verts),edges=list(bm.edges))
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        for edge in bm.edges:
            edge.smooth = len(edge.link_faces)==2 and edge.calc_face_angle(0) < math.radians(42)
        for face in bm.faces:
            face.smooth = obj.get('role') != 'canvas'
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        # Small secondary bevels soften the remaining sharp wooden panel joints.
        # Existing rounded cushions and thin plant blades retain their topology.
        if hexcolor(obj) in ('b87946','694b35','c38a56','b4885a','d9c7a7') and len(obj.data.polygons) < 80:
            bevel=obj.modifiers.new('Reference soft edge finish','BEVEL')
            bevel.width=.004
            bevel.segments=2
            bevel.limit_method='ANGLE'
            bevel.angle_limit=math.radians(50)
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.modifier_apply(modifier=bevel.name)
    changes.append('small bevel finish on wooden panel joints')
    root['artReference'] = 'output/imagegen/little-nest-48-props-sample.png'
    root['refinements'] = '; '.join(changes)
    return changes
