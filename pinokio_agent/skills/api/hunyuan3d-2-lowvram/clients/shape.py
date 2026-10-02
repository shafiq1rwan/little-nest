"""Generate a shape through the running launcher's public Gradio API."""
import argparse
import shutil
from pathlib import Path
from gradio_client import Client, handle_file

p = argparse.ArgumentParser()
p.add_argument('--url', required=True)
p.add_argument('--image', required=True)
p.add_argument('--out', required=True)
p.add_argument('--seed', type=int, default=1234)
p.add_argument('--octree', type=int, default=256)
a = p.parse_args()
c = Client(a.url, verbose=False)
result = c.predict(None, handle_file(a.image), None, None, None, None,
                   5, 5.0, a.seed, a.octree, True, 8000, False,
                   api_name='/shape_generation')
mesh, _, stats, seed = result
source = mesh if isinstance(mesh, str) else mesh.get('path') or mesh.get('value')
target = Path(a.out)
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, target)
print(f'Saved {target}; seed={seed}; stats={stats}')
