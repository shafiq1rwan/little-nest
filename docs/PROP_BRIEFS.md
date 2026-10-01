# Little Nest prop briefs

Reference descriptions for every catalog item, written so Codex can draw one reference image per prop and Tripo can build a 3D model from that image. Dimensions and colours come from the current procedural models in `src/props.js` and `src/plants.js`; a modelled replacement must keep the same footprint, origin and colour slots so it drops into saved rooms without changes.

## Shared style (paste at the top of every prompt)

> Low-poly cozy isometric furniture for a room-decorating game. Clean flat-shaded facets, soft rounded edges (small bevels, no sharp box corners), chunky readable silhouette, no textures or decals, one flat colour per part. Palette: warm honey wood `#b87946`, dark walnut `#694b35`, cream linen `#f3e4d2`, sage green `#81936a`, leaf green `#4d7639`, pale clay pot `#eee0ca`, soft black `#393932`, brass `#bb9451`, terracotta `#b96949`, caramel `#c38e62`. Isometric three-quarter view from the front-left, soft warm daylight, plain pale background, no floor shadow baked in.

## Pipeline: Codex draws, Tripo models from the drawing

1. **Codex image, one per prop.** Prompt = shared style + the prop brief + this suffix:
   > Single object only, centred, front three-quarter view from the front-left, slightly above eye level, whole object visible with margin, plain pure white background, no floor, no shadow, no text, no other objects. Square 1024 x 1024.
   Image-to-3D reads one isolated object best; do not put several views or several props on one image. Name the file after the catalog key (`sofa.png`).
2. **Optional multi-view.** For items whose back matters (sofa, bed, bookshelf, desk, wardrobe, rocking chair) ask Codex for three extra images with the same suffix but "straight front view", "straight left side view", and "straight back view", and feed all four to Tripo's multi-view mode. Keep the same colours and proportions across the set.
3. **Tripo.** Image-to-3D with the Codex image(s). Pick low-poly or "cartoon/stylised" output if offered, and request a quad or low-tri mesh. Export glb.
4. **Check against the brief** before accepting: footprint shape, number of legs/drawers/cushions, the recolourable part exists as a visually separate area, nothing extra was hallucinated (cables, extra cushions, text on the screen).

Tripo output is normalised to roughly a unit cube with an arbitrary origin and merged materials, so every model then needs the clean-up in the next section.

## Clean-up after Tripo (Blender or similar)

| Step | Target |
| --- | --- |
| Format | glTF binary (.glb), Y up, metres |
| Scale | Resize so the longest side matches the brief's size. 1 grid cell = 1.0 unit; footprints below are in cells, sizes in units. |
| Origin | Floor items: centre of the footprint on the floor (y = 0). Surface items: centre of the base. Wall items: bottom-centre of the back face, model extends towards +Z (into the room). |
| Facing | Front of the item faces +Z. Backs of sofas, beds, bookshelves and desks sit at -Z. |
| Triangle budget | Decimate to: small items under 400, plants under 2 500, furniture under 1 500, wall art under 300. |
| Materials | Replace the generated texture with flat colours from the brief, one material per colour, named by role. Parts the player can recolour (marked **recolour** below) must be their own material and not share it with any other part. |
| Glow parts | Candle flame, lantern glow and lamp shades are separate materials so the game can make them emissive. |
| Smoothing | Flat shading for facets; smooth only cylinders, pots and cushions. |
| Textures | None in the final file. The two framed prints get their art from the game, so the canvas is a plain flat quad. |

Footprint cells are width (x) by depth (z). Rotations are quarter turns, so items need not be symmetric.

---

## Nest classics (default collection, floor items)

### sofa — Sofa
Footprint 3 x 1. Size 2.8 w x 0.9 d x 0.95 h.
Three-seat sofa with a plump base cushion, three seat cushions, three softly tilted back cushions and thick rounded armrests, all cream linen (**recolour**: all cushions and arms as one material). Four short tapered wooden legs `#b87946`. Two throw pillows leaning against the back, one caramel `#bf895c` on the left, one sage on the right.

### armchair — Armchair
Footprint 1 x 1. Size 0.88 w x 0.88 d x 0.95 h.
Single-seat version of the sofa: cream base, seat and tilted back cushion (**recolour**), but with slim wooden armrests `#b87946` (a thin rail along each side on a wooden post) instead of upholstered arms. One sage throw pillow (**recolour**). Four short tapered wooden legs.

### coffeeTable — Coffee table
Footprint 2 x 1. Size 1.7 w x 1.0 d x 0.56 h. Two item slots on top.
Oval wooden top `#b87946` (a stretched disc, 0.09 thick) on four tapered round legs. Dressed with two stacked flat books (cream `#e4d2b6` and sage `#8d9b79`) on the right, a tiny potted plant at the left, and a small cream cup at the far right. Dressing is baked in; leave the front-left and back-centre clear for player items.

### bookshelf — Bookshelf
Footprint 2 x 1. Size 1.86 w x 0.65 d x 2.4 h. Three slots: lower shelf right, middle shelf left, top shelf centre.
Tall open bookcase in honey wood with a dark back panel `#694b35`. Closed cabinet base with two drawer-style doors `#ad7448` and brass pulls. Three shelves above the base with 5 to 7 upright books per shelf in muted colours (`#dfc8a0`, `#8a9a79`, `#9d6450`, `#e6ded0`, `#675c4b`), a small potted plant on the top shelf right, and a cream vase on the middle shelf left. Short legs.

### plant — Plant
Footprint 1 x 1. Size about 0.75 w x 1.5 h.
Generic leafy pot plant: tapered pale clay pot `#eee0ca` with dark soil, eleven thin green stems fanning out from the centre at different heights, each ending in an elongated oval leaf, mostly leaf green `#4d7639` with a third in lighter `#739249`.

### floorLamp — Floor lamp (lamp)
Footprint 1 x 1. Size 0.72 w x 1.5 h.
Tripod floor lamp: three slim wooden legs `#b87946` splayed from a point near the top, carrying a tapered drum shade (narrower at the top, 0.42 tall) in warm cream `#ffebc4`. The shade is a separate glowing material. No visible cable.

### rug — Rug
Footprint 4 x 3, flat on the floor. Size 3.85 x 2.85 x 0.03.
Rectangular flat-weave rug in warm cream `#f1ddbd` (**recolour**), with a thin inset border stripe `#d5ba96` along both long edges and short fringe tassels `#e6ceaa` along both long edges. Rounded corners, very thin.

### desk — Desk
Footprint 2 x 1. Size 1.9 w x 0.86 d x 1.2 h incl. monitor. Three slots: right-back, right-front, left-front.
Writing desk in honey wood: thick top, a three-drawer pedestal on the right side (drawer fronts `#c38a56`, brass pulls), two square legs on the left. Dressed with a cream monitor on a short stand at the left-centre (screen `#9ea6a0`), a pale keyboard in front of it, and a small plant at the far left-back. Keep the right half of the desktop clear.

### chair — Office chair
Footprint 1 x 1. Size 0.6 w x 0.6 d x 1.1 h.
Simple swivel chair: round black base disc `#393932`, thin central column, square padded seat and upright padded back, both dark walnut `#694b35` (**recolour**). No armrests, no wheels.

### ottoman — Ottoman
Footprint 1 x 1. Size 0.87 w x 0.87 d x 0.46 h.
Square upholstered footstool, generously rounded, in caramel brown `#976444` (**recolour**), on four short tapered wooden legs.

### sideboard — Sideboard
Footprint 2 x 1. Size 1.85 w x 0.65 d x 0.85 h. Two slots on top, left-centre.
Low cabinet in honey wood with three door panels `#c58a5c` across the front, each with a small round brass knob near the top. Short tapered legs. Dressed with a potted plant at the left end and a row of five books standing at the right end.

### tvStand — TV stand
Footprint 2 x 1. Size 1.85 w x 0.65 d x 1.05 h incl. TV. Two slots on top, left and right.
Low, plain honey-wood console on short legs with a thin flat-screen TV standing on a small black foot at the centre: black bezel `#393932`, dark teal screen `#4b5d58`. Leave the two ends of the top clear.

### boxes — Moving box
Footprint 1 x 1. Size 0.7 x 0.7 x 0.6.
Closed cardboard box `#c89b68` with a lighter tape strip `#e6c397` across the top. Slightly rounded edges.

### bed — Bed
Footprint 2 x 3 (headboard at -Z). Size 1.92 w x 2.92 d x 1.1 h.
Double bed: honey-wood frame with a plain tall headboard, four short dark legs, a thick cream mattress (**recolour**: mattress and the two pillows as one material), two pillows propped against the headboard, and a sage blanket covering the lower two thirds with a folded cuff near the pillows.

### nightstand — Nightstand
Footprint 1 x 1. Size 0.6 w x 0.5 d x 0.58 h. One slot on top.
Small bedside cabinet in honey wood with one drawer front `#c38a56` and a brass pull, on four short legs.

### wardrobe — Wardrobe
Footprint 2 x 1. Size 1.9 w x 0.66 d x 2.25 h.
Tall two-door wardrobe in honey wood with a slightly wider top cap and a dark plinth `#694b35`. Two full-height door panels `#c38a56` with a brass knob each near the centre line.

### planter — Planter box
Footprint 2 x 1. Size 1.8 w x 0.6 d x 0.82 h.
Rectangular wooden trough `#b87946` (**recolour**) filled with dark soil and six round leafy bushes in two greens (`#6f965a`, `#8daa6a`) in a zig-zag, each topped with a small flower ball in rose `#d79c9c`, yellow `#e9bd6c` or cream.

### bench — Bench
Footprint 2 x 1. Size 1.85 w x 0.6 d x 0.59 h.
Simple wooden bench: honey plank seat, four dark walnut legs with a dark stretcher bar at each end, and a flat sage seat pad `#81936a` (**recolour**) along the whole seat.

### sideTable — Side table
Footprint 1 x 1. Size 0.68 diameter x 0.55 h. One slot on top.
Round pedestal side table: honey-wood disc top, dark walnut column and a small round dark base.

### pouf — Pouf
Footprint 1 x 1. Size 0.8 diameter x 0.45 h.
Round fabric pouf in cream `#f3e4d2` (**recolour**), slightly wider at the bottom, domed top, with a thin contrasting piping ring `#d9b48f` around the top edge.

### basket — Woven basket
Footprint 1 x 1. Size 0.6 diameter x 0.55 h.
Round rattan basket `#c8a06c` with five horizontal weave ridges `#b98b58`, holding a folded sage blanket (**recolour**) that domes over the rim with a rolled fold on top.

## Plants (default collection, floor, 1 x 1 each)

All plants: pot has dark soil `#49392c` on top and a rolled lip. The pot body and lip are the **recolour** material.

### monstera — Monstera
Size 0.8 w x 1.3 h. Pale clay pot `#e9dfc8`, 0.54 wide. Six stems carry large split leaves; each leaf is three overlapping flat lobes, alternating deep green `#3e6a3e` and brighter `#4f8a4a`.

### fern — Boston fern
Size 1.0 w x 0.8 h. Low ribbed terracotta pot `#c57955`, 0.48 wide. Fourteen arching fronds drooping outward, each a thin stem lined with small paired leaflets in two greens (`#7fb35a`, `#5c8a45`).

### snakePlant — Snake plant
Size 0.55 w x 1.1 h. Ribbed pale pot `#e9dfc8`. Nine upright pointed sword leaves of different heights, dark green `#526e46` and mid green `#698553` with a pale yellow-green central stripe `#a4b778`.

### palm — Areca palm
Size 0.9 w x 1.6 h. Caramel pot `#be9165`. Seven slender arched fronds from a tight base, each with paired narrow leaflets along the stem, greens `#6d8f50` and `#416d3f`.

### cactus — Flowering cactus
Size 0.55 w x 0.95 h. Terracotta pot `#c57955`. One fat barrel cactus `#6f965a` with ten vertical ribs `#8daa6a`, small pale spines `#e1d4a4` on each rib, and a crown of seven pink petals `#d79c9c` around a yellow centre `#e9bd6c`.

### rubberTree — Rubber tree
Size 0.6 w x 1.6 h. Cream pot `#f3e4d2`. Two woody stems `#786044`, the taller reaching 1.58, each with six large glossy oval leaves on short stalks, dark `#3c6845` and mid `#698956` with a pale midrib.

## Small items (sit in slots on tables and shelves; keep within a 0.3 footprint)

### mug — Mug
0.15 wide x 0.13 h. Slightly tapered cream mug (**recolour**) with a round loop handle on the right and a dark coffee surface `#5b3d2a` inside the rim.

### candle — Candle (lamp)
0.2 wide x 0.27 h. Flat brass saucer, a cream pillar candle (**recolour**), a tiny black wick and a small teardrop flame `#ffc76b` (separate glowing material).

### bookStack — Book stack
0.24 x 0.3 x 0.11. Three flat books stacked slightly offset: sage `#8a9a79` at the bottom, cream `#dfc8a0` middle, rust `#9d6450` on top (**recolour**: top book).

### succulent — Succulent
0.15 wide x 0.2 h. Tiny tapered pale pot (**recolour**) with soil, a rosette of eight plump leaves, four outer and four inner, in `#8daa6a` and `#6f965a`.

### frame — Photo frame
0.22 x 0.26, leaning back about 9 degrees. Thin honey-wood frame (**recolour**) with a pale green picture `#c3d6a8` and a small wooden easel leg at the back.

### lantern — Lantern (lamp)
0.2 wide x 0.3 h. Hexagonal black metal lantern: flat base, six thin corner bars, semi-transparent glass panes, a pointed hexagonal roof (**recolour**: base, bars and roof), a small brass ring on top, and a warm glowing ball `#ffd58a` inside (separate material).

### vase — Vase
0.15 wide x 0.33 h. Rounded sage ceramic vase (**recolour**), narrow neck, holding three thin stems topped with round flower heads, yellow `#e9bd6c` in the centre and pink `#d79c9c` either side.

## Wall items (origin at bottom-centre of back face, extend +Z)

Wall grid: one column = 1 unit wide, one row = 0.5 unit tall.

### worldMap — World map
2 columns x 3 rows. Frame 1.71 x 1.36, 0.08 deep. Plain rectangular honey-wood frame (**recolour**) around a flat canvas 1.55 x 1.2. Leave the canvas blank; the game paints the map.

### botanicalPrint — Botanical print
2 columns x 3 rows. Frame 1.21 x 1.46, portrait. Same frame style (**recolour**) around a flat 1.05 x 1.3 canvas. Leave blank.

### wallShelf — Wall shelf
2 columns x 1 row. 1.9 w x 0.32 d x 0.42 h. Two slots on top, left and right.
Single honey-wood plank (**recolour**) on two dark walnut L-brackets.

### mirror — Round mirror
1 column x 2 rows. 0.87 diameter, centred 0.5 up.
Round brass ring frame (**recolour**) around a pale reflective disc `#d8e6e4` (separate low-roughness material).

### macrame — Hanging plant
1 column x 3 rows. Total height 1.45; hook near the top at 1.42, pot hangs 0.52 up.
Small dark wall hook, three pale cords `#e6ccad` meeting a cord ring, holding a tapered clay pot (**recolour**) with soil. Trailing vine stems and small oval leaves spill over the rim in `#6d8f50`, `#4d7639`, `#7fa05c`.

### clock — Wall clock
1 column x 1 row. 0.46 diameter, centred 0.25 up.
Round dark walnut rim (**recolour**), cream face, two black hands pointing to about ten past twelve. No numbers.

## Japandi collection

Palette: pale ash `#d9c7a7`, charcoal `#3f3d3a`, paper `#fff1dc`, moss `#5f7a4a`.

### lowSofa — Low sofa
Footprint 3 x 1. Size 2.9 w x 0.96 d x 0.85 h.
Platform sofa: a thin pale-ash slab base with a front rail, three square charcoal seat cushions and three tilted charcoal back cushions (**recolour**), no arms. One pale-ash coloured cushion tilted at the left end.

### lowTable — Low table
Footprint 2 x 1. Size 1.8 w x 0.8 d x 0.4 h. Two slots on top.
Very low rectangular table in pale ash: a thick slab top on two solid slab legs set in from the ends.

### paperLamp — Paper lamp (lamp)
Footprint 1 x 1. Size 0.53 diameter x 1.15 h.
Charcoal disc base and thin rod carrying a tall paper cylinder shade `#fff1dc` (separate glowing material) with three thin charcoal hoops around it.

### bonsai — Bonsai (small item)
0.28 x 0.18 x 0.26 h. Shallow rectangular charcoal tray pot (**recolour**) with soil, a short leaning trunk `#6b4a2e` with one branch, and three flat moss-green foliage pads `#5f7a4a` at different heights.

## Cottage collection

Palette: painted sage `#a7b98e`, rose `#d9a3a3`, cottage cream `#f6efe2`, light oak `#b4885a`.

### floralArmchair — Cottage armchair
Footprint 1 x 1. Size 0.9 w x 0.9 d x 0.96 h.
Fully upholstered rounded armchair in dusty rose (**recolour**): deep seat cushion, tilted back cushion, two rounded padded arms, on four short light-oak legs. One cream cushion tilted against the back.

### dresser — Painted dresser
Footprint 2 x 1. Size 1.9 w x 0.64 d x 0.94 h. Two slots on top.
Four-drawer chest painted sage (**recolour**) with a light-oak top and legs. Two columns of two cream drawer fronts, each with a round brass knob.

### rockingChair — Rocking chair
Footprint 1 x 1. Size 0.72 w x 0.72 d x 1.05 h.
Light-oak rocking chair: two curved rockers, four turned legs, a plank seat, five slender back spindles leaning slightly back with a top rail, and a thin rose seat pad (**recolour**).

### teapot — Teapot (small item)
0.25 wide x 0.22 h. Round cream teapot (**recolour**: body and loop handle) with a short angled spout on the right, a small foot, and a sage lid with a round knob.

---

## Quick index

| Key | Label | Collection | Footprint | Layer |
| --- | --- | --- | --- | --- |
| sofa | Sofa | classics | 3 x 1 | floor |
| armchair | Armchair | classics | 1 x 1 | floor |
| coffeeTable | Coffee table | classics | 2 x 1 | floor, 2 slots |
| bookshelf | Bookshelf | classics | 2 x 1 | floor, 3 slots |
| plant | Plant | classics | 1 x 1 | floor |
| floorLamp | Floor lamp | classics | 1 x 1 | floor, lamp |
| rug | Rug | classics | 4 x 3 | floor (flat) |
| desk | Desk | classics | 2 x 1 | floor, 3 slots |
| chair | Office chair | classics | 1 x 1 | floor |
| ottoman | Ottoman | classics | 1 x 1 | floor |
| sideboard | Sideboard | classics | 2 x 1 | floor, 2 slots |
| tvStand | TV stand | classics | 2 x 1 | floor, 2 slots |
| boxes | Moving box | classics | 1 x 1 | floor |
| bed | Bed | classics | 2 x 3 | floor |
| nightstand | Nightstand | classics | 1 x 1 | floor, 1 slot |
| wardrobe | Wardrobe | classics | 2 x 1 | floor |
| planter | Planter box | classics | 2 x 1 | floor |
| bench | Bench | classics | 2 x 1 | floor |
| sideTable | Side table | classics | 1 x 1 | floor, 1 slot |
| pouf | Pouf | classics | 1 x 1 | floor |
| basket | Woven basket | classics | 1 x 1 | floor |
| monstera | Monstera | classics | 1 x 1 | floor |
| fern | Boston fern | classics | 1 x 1 | floor |
| snakePlant | Snake plant | classics | 1 x 1 | floor |
| palm | Areca palm | classics | 1 x 1 | floor |
| cactus | Flowering cactus | classics | 1 x 1 | floor |
| rubberTree | Rubber tree | classics | 1 x 1 | floor |
| mug | Mug | classics | slot | surface |
| candle | Candle | classics | slot | surface, lamp |
| bookStack | Book stack | classics | slot | surface |
| succulent | Succulent | classics | slot | surface |
| frame | Photo frame | classics | slot | surface |
| lantern | Lantern | classics | slot | surface, lamp |
| vase | Vase | classics | slot | surface |
| worldMap | World map | classics | 2 col x 3 row | wall |
| botanicalPrint | Botanical print | classics | 2 col x 3 row | wall |
| wallShelf | Wall shelf | classics | 2 col x 1 row | wall, 2 slots |
| mirror | Round mirror | classics | 1 col x 2 row | wall |
| macrame | Hanging plant | classics | 1 col x 3 row | wall |
| clock | Wall clock | classics | 1 col x 1 row | wall |
| lowSofa | Low sofa | japandi | 3 x 1 | floor |
| lowTable | Low table | japandi | 2 x 1 | floor, 2 slots |
| paperLamp | Paper lamp | japandi | 1 x 1 | floor, lamp |
| bonsai | Bonsai | japandi | slot | surface |
| floralArmchair | Cottage armchair | cottage | 1 x 1 | floor |
| dresser | Painted dresser | cottage | 2 x 1 | floor, 2 slots |
| rockingChair | Rocking chair | cottage | 1 x 1 | floor |
| teapot | Teapot | cottage | slot | surface |
