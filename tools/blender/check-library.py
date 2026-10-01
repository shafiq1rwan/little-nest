"""Validate a saved .blend: blender --background <library.blend> --python this-file."""
import json
from pathlib import Path
import bpy

output = Path(bpy.data.filepath).parent
catalog = json.loads((output / 'catalog-source.json').read_text())['catalog']
report = {p['key']: p for p in json.loads((output / 'build-report.json').read_text())}
roots = {o['catalogKey']: o for o in bpy.data.objects if 'catalogKey' in o}
assert set(roots) == {p['key'] for p in catalog}, 'Library must contain exactly the catalog roots'
for prop in catalog:
    key = prop['key']
    root = roots[key]
    contract = json.loads(root['contract'])
    for field in ('key', 'w', 'd', 'layer', 'wall', 'surface', 'lamp'):
        assert contract[field] == prop[field], f'{key}: changed {field}'
    parts = [o for o in root.children if o.type == 'MESH']
    assert len(parts) == report[key]['parts'], f'{key}: missing editable parts'
    assert sum(bool(o.get('recolor')) for o in parts) == report[key]['recolorParts']
    for obj in parts:
        assert obj.data.vertices and obj.data.polygons, f'{obj.name}: empty mesh'
        assert obj.data.materials, f'{obj.name}: missing material'
        assert all(m.name.startswith(key + '.') for m in obj.data.materials), f'{key}: material shared across props'
        assert obj.get('role') in ('fixed','recolor','canvas','glow')
        assert bool(obj.get('recolor')) == (obj.get('role') == 'recolor')
ground = bpy.data.objects.get('Preview ground (never exported)')
assert not ground or (ground.hide_viewport and ground.hide_render), 'Preview ground must not obscure library'
result = {'props': len(roots), 'editableParts': sum(p['parts'] for p in report.values()), 'pass': True}
(output / 'library-validation.json').write_text(json.dumps(result, indent=2))
print(f"LIBRARY CHECK: {len(roots)}/48 collections retain editable parts, isolated materials and placement contracts.")
