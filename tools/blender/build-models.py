"""Run clean-generated.py for every prop in models.json (or the keys given) and write a contact sheet.

    python tools/blender/build-models.py            # all entries with a raw file present
    python tools/blender/build-models.py sofa bed   # just these

Set BLENDER to the executable path if it is not the default install. Previews land in
output/models-preview (ignored), with _contact.png for a quick look at every exported prop.
"""
import json, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
SCRIPT = os.path.join(ROOT, 'tools', 'blender', 'clean-generated.py')
PREVIEW = os.path.join(ROOT, 'output', 'models-preview')
os.makedirs(PREVIEW, exist_ok=True)

with open(os.path.join(ROOT, 'tools', 'blender', 'models.json'), encoding='utf-8') as f:
    manifest = {k: v for k, v in json.load(f).items() if not k.startswith('_')}
keys = sys.argv[1:] or list(manifest)
done = []
for key in keys:
    spec = manifest[key]
    raw = os.path.join(ROOT, 'art-source', 'generated', key + '.glb')
    if not os.path.exists(raw):
        print(key + ': no raw file in art-source/generated, skipped'); continue
    cmd = [BLENDER, '--background', '--python', SCRIPT, '--', '--key', key, '--size', *map(str, spec['size']),
           '--tris', str(spec['tris']), '--preview', PREVIEW, *spec.get('args', [])]
    out = subprocess.run(cmd, capture_output=True, text=True)
    lines = [l for l in out.stdout.splitlines() if l.startswith(key + ':') or 'Traceback' in l or 'Error' in l]
    print('\n'.join(lines) or (key + ': no output'))
    if out.returncode: print(out.stderr[-800:])
    else: done.append(key)

try:
    from PIL import Image
    cols = 4; rows = (len(done) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 320, max(1, rows) * 320), (250, 243, 230))
    for i, key in enumerate(done):
        tile = Image.open(os.path.join(PREVIEW, key + '-iso.png')).convert('RGB').resize((320, 320))
        sheet.paste(tile, ((i % cols) * 320, (i // cols) * 320))
    sheet.save(os.path.join(PREVIEW, '_contact.png')); print('contact sheet:', os.path.join(PREVIEW, '_contact.png'))
except ImportError:
    print('Pillow not installed; no contact sheet')
