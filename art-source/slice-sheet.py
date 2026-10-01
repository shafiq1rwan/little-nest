"""Cut the Codex prop sheet (art-source/prop-sheet.png) into one square 1024px image per catalog key.

Usage: python art-source/slice-sheet.py
Needs Pillow and numpy. Objects are found by their gaps, rows by the thin caption lines, so the
sheet does not need a uniform grid. Output goes to art-source/prop-crops/<nn>-<key>.png plus a
_contact.png overview. Feed the single crops to an image-to-3D tool; never the whole sheet.
"""
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent
KEYS = ['sofa','armchair','coffeeTable','bookshelf','plant','floorLamp','rug','desk',
 'chair','ottoman','sideboard','tvStand','boxes','bed','nightstand','wardrobe',
 'planter','bench','sideTable','pouf','basket','monstera','fern','snakePlant',
 'palm','cactus','rubberTree','mug','candle','bookStack','succulent','frame',
 'lantern','vase','worldMap','botanicalPrint','wallShelf','mirror','macrame','clock',
 'lowSofa','lowTable','paperLamp','bonsai','floralArmchair','dresser','rockingChair','teapot']
COLS = 8

def runs(profile, min_gap, min_len):
    out, start = [], None
    for i, v in enumerate(list(profile) + [0]):
        if v and start is None: start = i
        elif not v and start is not None: out.append([start, i]); start = None
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] < min_gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return [r for r in merged if r[1] - r[0] >= min_len]

def main():
    im = Image.open(ROOT / 'prop-sheet.png').convert('RGB'); a = np.asarray(im).astype(int)
    bg = a[5, 5]; mask = np.abs(a - bg).sum(axis=2) > 40; H, W = mask.shape
    dark = a.sum(axis=2) < 330
    colhits = np.array([sum(dark[y, int(c * W / COLS):int((c + 1) * W / COLS)].any() for c in range(COLS)) for y in range(H)])
    captions = [r for r in runs(colhits >= COLS - 2, 6, 8) if r[0] > 50 and r[1] - r[0] <= 16]
    bands, prev = [], 50
    for c0, c1 in captions: bands.append((prev + 4, c0 - 3)); prev = c1
    out = ROOT / 'prop-crops'; out.mkdir(exist_ok=True)
    bgc = tuple(int(x) for x in bg); n = 0
    for r0, r1 in bands:
        band = mask[r0:r1]; occupancy = band.sum(axis=0); cols = []
        for c0, c1 in runs(band.any(axis=0), 14, 25):
            if c1 - c0 > W / COLS * 1.4:   # two objects touching: split at the thinnest column in the middle half
                lo, hi = c0 + (c1 - c0) // 4, c1 - (c1 - c0) // 4
                cut = lo + int(np.argmin(occupancy[lo:hi])); cols += [[c0, cut], [cut, c1]]
            else: cols.append([c0, c1])
        for c0, c1 in cols[:COLS]:
            ys = np.where(band[:, c0:c1].any(axis=1))[0]
            y0, y1 = r0 + ys[0], r0 + ys[-1] + 1
            pad = 14
            tile = im.crop((max(c0 - pad, 0), max(y0 - pad, r0), min(c1 + pad, W), min(y1 + pad, r1)))
            s = max(tile.size) + 24; sq = Image.new('RGB', (s, s), bgc)
            sq.paste(tile, ((s - tile.width) // 2, (s - tile.height) // 2))
            sq.resize((1024, 1024), Image.LANCZOS).save(out / f'{n + 1:02d}-{KEYS[n]}.png'); n += 1
    sheet = Image.new('RGB', (COLS * 192, 6 * 192), bgc)
    for i, k in enumerate(KEYS[:n]):
        sheet.paste(Image.open(out / f'{i + 1:02d}-{k}.png').resize((192, 192)), ((i % COLS) * 192, (i // COLS) * 192))
    sheet.save(out / '_contact.png'); print('wrote', n, 'crops to', out)

if __name__ == '__main__': main()
