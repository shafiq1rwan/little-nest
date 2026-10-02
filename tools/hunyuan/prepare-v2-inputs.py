"""Extract caption-free inputs from the reviewed v2 sheet for the local 3D pipeline."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
out = ROOT / 'art-source/models-v2/collection'
(out / 'inputs').mkdir(parents=True, exist_ok=True)
keys = ['sofa','armchair','coffeeTable','bookshelf','plant','floorLamp','rug','desk',
 'chair','ottoman','sideboard','tvStand','boxes','bed','nightstand','wardrobe',
 'planter','bench','sideTable','pouf','basket','monstera','fern','snakePlant',
 'palm','cactus','rubberTree','mug','candle','bookStack','succulent','frame',
 'lantern','vase','worldMap','botanicalPrint','wallShelf','mirror','macrame','clock',
 'lowSofa','lowTable','paperLamp','bonsai','floralArmchair','dresser','rockingChair','teapot']
bands = [(0,157),(174,324),(343,482),(502,645),(663,790),(806,917)]
cuts = [[0,268,452,670,840,1050,1238,1467,1672],
        [0,236,444,651,857,1045,1250,1468,1672],
        [0,232,450,652,855,1048,1252,1460,1672],
        [0,238,441,653,851,1042,1250,1468,1672],
        [0,231,440,648,857,1050,1243,1468,1672],
        [0,238,451,647,852,1047,1250,1467,1672]]
im = Image.open(ROOT / 'art-source/prop-sheet-low-poly-v2.png').convert('RGB')
assert im.size == (1672,941), 'Bounds are reviewed for this exact sheet'
manifest=[]
for i,key in enumerate(keys):
    if key == 'sofa': continue
    r,c=divmod(i,8)
    rect=[cuts[r][c],bands[r][0],cuts[r][c+1],bands[r][1]]
    tile=im.crop(rect)
    size=max(tile.size)+24
    square=Image.new('RGB',(size,size),'white')
    square.paste(tile,((size-tile.width)//2,(size-tile.height)//2))
    square.resize((512,512),Image.Resampling.LANCZOS).save(out/'inputs'/f'{key}.png')
    manifest.append({'key':key,'source':'art-source/prop-sheet-low-poly-v2.png','crop':rect})
(out/'input-manifest.json').write_text(json.dumps(manifest,indent=2))
print(f'Prepared {len(manifest)} Hunyuan inputs')
