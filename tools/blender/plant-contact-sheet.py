"""Assemble small QA previews from the actual Blender renders, without new image generation."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

root=Path(__file__).resolve().parents[2]
out=root/'art-source/models-v2/plants'
report=json.loads((out/'build-report.json').read_text())
sheet=Image.new('RGB',(1000,850),'#fffaf2')
d=ImageDraw.Draw(sheet)
d.text((14,8),'Little Nest - Blender plants / staged for review',fill='#563425',font=ImageFont.load_default(size=20))
for i,r in enumerate(report):
    im=Image.open(out/r['key']/'preview.png').convert('RGBA')
    im.thumbnail((248,235))
    x=i%4*250;y=40+i//4*270
    sheet.paste(im,(x+(250-im.width)//2,y),im)
    d.text((x+10,y+237),r['key'],fill='#563425',font=ImageFont.load_default(size=16))
    d.text((x+10,y+255),str(r['triangles'])+' triangles',fill='#8c725f',font=ImageFont.load_default(size=11))
sheet.save(out/'contact-sheet.jpg',quality=92)
