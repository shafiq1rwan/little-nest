"""Sequential, resumable Hunyuan shape batch through the launcher-managed Gradio API."""
import argparse
import json
import shutil
import time
from pathlib import Path
from gradio_client import Client, handle_file

p=argparse.ArgumentParser()
p.add_argument('--url',required=True)
p.add_argument('--directory',required=True)
p.add_argument('--keys',nargs='*')
p.add_argument('--seed',type=int,default=1234)
a=p.parse_args()
root=Path(a.directory).resolve()
(root/'raw').mkdir(exist_ok=True)
manifest=json.loads((root/'input-manifest.json').read_text())
c=Client(a.url,verbose=False)
failures=[]
for entry in manifest:
    key=entry['key']
    if a.keys and key not in a.keys: continue
    target=root/'raw'/f'{key}.glb'
    if target.exists():
        print(f'{key}: already generated',flush=True)
        continue
    start=time.time()
    try:
        result=c.predict(None,handle_file(str(root/'inputs'/f'{key}.png')),None,None,None,None,
                         5,5.0,a.seed,256,True,8000,False,api_name='/shape_generation')
        mesh,_,stats,seed=result
        source=mesh if isinstance(mesh,str) else mesh.get('path') or mesh.get('value')
        shutil.copyfile(source,target)
        (root/'raw'/f'{key}.json').write_text(json.dumps({'generator':'Hunyuan3D-2mini turbo','seed':seed,'stats':stats,'input':f'inputs/{key}.png'},indent=2))
        print(f'{key}: {stats["number_of_faces"]} faces, {time.time()-start:.1f}s',flush=True)
    except Exception as e:
        failures.append({'key':key,'error':str(e)})
        print(f'{key}: FAILED {e}',flush=True)
(root/'generation-failures.json').write_text(json.dumps(failures,indent=2))
if failures: raise SystemExit(1)
