"""Generate raw shapes from the prop crops with a running Hunyuan3D Gradio app (the Pinokio launcher).

    python tools/hunyuan/generate.py ottoman bed wardrobe        # one or more catalog keys
    python tools/hunyuan/generate.py --url http://127.0.0.1:42003 --steps 5 --octree 192 ottoman

Finds the crop art-source/prop-crops/<nn>-<key>.png, calls the app's shape_generation endpoint
(shape only, background removed), and saves the result as art-source/generated/<key>.glb for
tools/blender/clean-generated.py. Existing files are skipped unless --force is given.
Needs `pip install gradio_client`. The app URL is printed in the launcher terminal.
"""
import argparse, glob, os, shutil, sys, time
from gradio_client import Client, handle_file

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CROPS = os.path.join(ROOT, 'art-source', 'prop-crops')
OUT = os.path.join(ROOT, 'art-source', 'generated')

ap = argparse.ArgumentParser()
ap.add_argument('keys', nargs='+')
ap.add_argument('--url', default=os.environ.get('HUNYUAN_URL', 'http://127.0.0.1:42003'))
ap.add_argument('--steps', type=int, default=5)
ap.add_argument('--guidance', type=float, default=5.0)
ap.add_argument('--octree', type=int, default=192)
ap.add_argument('--chunks', type=int, default=8000)
ap.add_argument('--seed', type=int, default=None, help='fixed seed; default random')
ap.add_argument('--force', action='store_true')
args = ap.parse_args()

client = Client(args.url, verbose=False)
os.makedirs(OUT, exist_ok=True)
for key in args.keys:
    target = os.path.join(OUT, key + '.glb')
    if os.path.exists(target) and not args.force:
        print(key + ': exists, skipped (use --force)'); continue
    crops = glob.glob(os.path.join(CROPS, '*-' + key + '.png'))
    if not crops:
        print(key + ': no crop found in art-source/prop-crops'); continue
    started = time.time()
    result = client.predict(
        None, handle_file(crops[0]), None, None, None, None,
        args.steps, args.guidance, args.seed if args.seed is not None else 1234, args.octree,
        True, args.chunks, args.seed is None,
        api_name='/shape_generation')
    mesh_file, _html, stats, seed = result
    path = mesh_file if isinstance(mesh_file, str) else mesh_file.get('path') or mesh_file.get('value')
    shutil.copyfile(path, target)
    print(f'{key}: {os.path.getsize(target) // 1024} KB in {time.time() - started:.0f}s, seed {seed} -> {os.path.relpath(target, ROOT)}')
