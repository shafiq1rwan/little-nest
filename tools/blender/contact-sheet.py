"""Build a labeled preview sheet from the Blender renders (requires Pillow)."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

output = Path(sys.argv[1] if len(sys.argv) > 1 else 'output/blender')
report = json.loads((output / 'build-report.json').read_text())
width, height, columns = 240, 265, 8
sheet = Image.new('RGB', (width * columns, 80 + height * ((len(report) + columns - 1) // columns)), '#fff8ed')
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default(size=16)
draw.text((24, 18), f'Little Nest | Blender prop library - {len(report)} editable models', fill='#563425', font=ImageFont.load_default(size=25))
draw.text((24, 51), 'GLB export previews | each object framed individually; sizes are not to scale', fill='#8c725f', font=font)
for i, prop in enumerate(report):
    x, y = i % columns * width, 80 + i // columns * height
    preview = Image.open(output / 'previews' / (prop['key'] + '.png')).convert('RGBA')
    paper = Image.new('RGBA', preview.size, '#fff8ed')
    image = Image.alpha_composite(paper, preview).convert('RGB').resize((230, 230))
    sheet.paste(image, (x + 5, y))
    draw.text((x + 10, y + 231), prop['key'], fill='#563425', font=font)
    draw.text((x + 10, y + 249), f'{prop["exportTriangles"]} triangles', fill='#8c725f', font=ImageFont.load_default(size=12))
sheet.save(output / 'contact-sheet.jpg', quality=92)
