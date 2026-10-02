"""Small contact sheets from native renders, grouped for readable review."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

out=Path(__file__).resolve().parents[2]/'art-source/models-v2/furniture'
groups={
 'seating-bedroom':['armchair','chair','ottoman','bed','bench','pouf','lowSofa','floralArmchair','rockingChair'],
 'tables-storage':['coffeeTable','bookshelf','desk','sideboard','tvStand','nightstand','wardrobe','sideTable','lowTable','dresser'],
 'decor-lighting':['floorLamp','rug','boxes','basket','mug','candle','bookStack','frame','lantern','worldMap','botanicalPrint','wallShelf','mirror','clock','paperLamp','teapot'],
}
for name,keys in groups.items():
    cols=4 if len(keys)>12 else 3
    rows=(len(keys)+cols-1)//cols
    sheet=Image.new('RGB',(cols*240,rows*242+42),'#fffaf2');d=ImageDraw.Draw(sheet)
    d.text((12,10),'Little Nest / '+name+' / staged',fill='#563425',font=ImageFont.load_default(size=17))
    for i,key in enumerate(keys):
        if not (out/key/'preview.png').exists():continue
        im=Image.open(out/key/'preview.png').convert('RGBA');im.thumbnail((235,216))
        x=i%cols*240;y=42+i//cols*242
        sheet.paste(im,(x+(240-im.width)//2,y),im)
        d.text((x+12,y+218),key,fill='#563425',font=ImageFont.load_default(size=15))
    sheet.save(out/(name+'.jpg'),quality=91)
