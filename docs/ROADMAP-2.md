# Roadmap 2 — from finished prototype to a game people keep

Baseline: 2 October 2026. Phases 0–5 of [ROADMAP.md](ROADMAP.md) are complete, the front door exists, and all 48 props load from models. This file plans the next phases, 7 to 12. Phase 6 of the first roadmap (optional goals and sharing) is absorbed into Phase 10 here.

The rules from the first roadmap still apply: keep the style guide and saved rooms intact, work in small reviewable increments, and mark a phase complete only when its criteria are met. Timers, currencies, daily rewards, accounts and monetisation stay out unless requested.

| Phase | Focus | Status | Dependency |
| --- | --- | --- | --- |
| 7 | Finish the core loop | Complete 2 October 2026 | Phases 0–5 |
| 8 | A living room: animation and sound | In progress (increments 1–3 done 2 October 2026) | Phase 7 |
| 9 | More room: structure, ceiling, night | Planned | Phase 7 |
| 10 | Expression and progression | Planned | Phases 8, 9 |
| 11 | Desktop release | Planned | Phase 7 (can run alongside 8–10) |
| 12 | Content packs and seasons | Ongoing after release | Phase 11 |

Start a phase the way the first roadmap describes: give a session the phase name and a concrete first increment, and record what changed and what remains in HANDOFF.

## Phase 7 — finish the core loop

Goal: every interaction a player reaches in the first five minutes feels complete.

Increments, in order:

1. Done 2 October 2026: **Placement controls in the mode pill.** While holding an item the pill shows Keep placing (a remembered switch that keeps placing mode after each drop, like Shift) and Cancel; the View tray gained orbit-left and orbit-right buttons that turn the camera 15 degrees within the azimuth limits. On phones narrower than 640px the orbit buttons are hidden because the tray must fit beside the tool rail and two-finger orbit exists. Covered by tests/browser/placement.spec.js.
2. Done 2 October 2026: **Pillows and throws as items.** Surfaces now carry a `kind` ('table' by default, 'seat' for sofa, armchair, ottoman, bed, bench, pouf, low sofa, cottage armchair, rocking chair) and surface items a matching `surfaceKind`; `placement.acceptsOn()` keeps mugs off sofas and pillows off tables. New `soft` category with a throw pillow and a throw blanket, both recolourable. The baked pillows on the sofa, armchair, low sofa and cottage armchair are omitted from the loaded models (`omit` on the catalog entry) and the starter sofa carries two pillow items instead. No save version was needed: the kind is derived from the catalog and records still store parent and slot. Covered by tests/browser/seats.spec.js.
3. Done 2 October 2026: **Curtains that open and close.** A wall item spanning a window footprint, with a rail and two panels. The lamp switch generalises to a per-item toggle (`lit` stays the stored field; label changes by type). Opening tweens the panels over about 450 ms with ease-out and keeps calling `invalidate()` until done; loading a room jumps to the final pose. Closed curtains dim the sun by a mood-dependent factor.
4. Done 2 October 2026: **Per-wall finishes and floor patterns.** The Walls tab has a Both walls / Back / Left target row above the swatches (Both is one undo step through `commands.setFinishes`); the left wall has its own material. The Floor tab has Parquet / Planks / Tile above the colours. Save version 8 adds `wallLeft` (defaults to `wall`) and `floorStyle` (defaults to `parquet`); keys live in `FLOOR_STYLES` and `FLOOR_STYLE_KEYS`.
5. Done 2 October 2026: **Selection polish.** A soft cream hover outline follows the item under a mouse pointer (never on touch, never on the selected item); floor ghosts cast a footprint-sized soft shadow; placed and dropped items squash and settle over 260 ms (`MOTION` in src/config/game.js), skipped under prefers-reduced-motion.

Completion criteria: a new player can place, duplicate, cancel and recolour anything without the keyboard; pillows are items; curtains work in all presets with windows; old saves load unchanged; suite passes with specs for each increment.

Met 2 October 2026: placement, Keep placing, Cancel, Copy, Rotate and the swatches are all buttons; pillows and throws are seat items; curtains hang on any preset window (the balcony has none); saves from versions 2–7 migrate in the unit suite; specs: placement, seats, curtains, finishes, polish. Suite 98 passed, 1 skipped by design.

## Phase 8 — a living room: animation and sound

Goal: the room feels inhabited.

Increments:

1. Done 2 October 2026: **Sound effects.** Thirteen CC0 files from Kenney's Interface Sounds, Impact Sounds and UI Audio packs in `public/audio/sfx` (sources and originals in SOURCES.md, 124 KB): place (five variants), pick-up, rotate, lamp, curtain, recolour, remove, blocked, and a quiet UI tap. `src/ui/sfx.js` plays them through Web Audio with per-sound gains and slight pitch variation, loads nothing before the first gesture, and remembers on/off and volume (`home-deco-sim:sfx`, `home-deco-sim:sfx-volume`). Settings has a Sound effects switch and an effects volume slider, independent of the music. Credits name the packs.
2. Done 2 October 2026: **Idle motion.** `src/scene/motion.js` drives lamp breathing (about 3.5%), candle and lantern flicker, an evening twinkle on the string-light bulbs (now one material each), and a 1.4 degree sway on floor plants' foliage around the base (pots stay still). One clock capped at 24 fps, active only while something animated is in the room. Motion multiplies the resting values applyLamp stores in `userData.lampValue`, so moods and switches stay authoritative and turning it off lands on exact values. Settings has an Ambient motion switch (`home-deco-sim:ambient`); reduced motion keeps it off. Benchmark: a tick costs 0.004 ms in the starter room and 0.014 ms in the stress room; with motion on the room draws about 0.35 frames per display frame, 0 with it off.
3. Done 2 October 2026: **A cat.** `src/game/pet.js` is the brain (pure, unit-tested): A* over free cells with eight neighbours and no corner cutting, goals weighted toward rugs, sunny cells beside windows and free seat slots (it hops up and curls), sit and curl rests, head turned toward the mouse within reach, and a per-update check that hops it off any cell furniture lands on and replans blocked paths; a calm mode for reduced motion rests in place. `src/scene/cat.js` is the model, built in code from rounded parts on pivot joints instead of Blender clips (no rig needed, joint targets eased per action). Save version 9 adds `pet: { present, color }` (four fur keys in `PET_COLORS`); the position is not saved. The pet is two finishes (`petPresent`, `petColor`), so invite, recolour and room loads are undoable. The living room preset includes a ginger cat; the Light tab has the companion controls.
4. **Weather at the window.** Rain and clouds variants of the window view, picked in the Light tab next to the moods, with a faint rain-on-glass overlay.
6. Done 7 October 2026 (added at the user's request): **Residents use things.** `src/game/activities.js` (pure, unit-tested) decides which appliances are in use: a TV someone sits facing within six units, a laptop or monitor at the seat in front of it, a stove someone is cooking at. `src/scene/activities.js` adds glow panels measured from each model (TV screens, laptop lid, monitor, oven window, electric hob), steam puffs, and mood bubbles that pop up when a person settles: a hum at the stove, coffee at other counters, sleepy z on evening sofas, a heart beside the cat or now and then. Brain poses now carry `spot` and `settling`. Still open for later increments: the radio playing music, lamps switched on at dusk, sleeping in beds, petting the cat, naming and dressing residents, and guests.
5. Done 6 October 2026 (added at the user's request): **Residents.** Up to three people live in the room. `src/game/residents.js` is the brain (pure, unit-tested, built like the cat's): they sit on seat slots (pillow-free, not beds) and on chairs and stools without slots, stand facing kitchen-tagged floor items and windows, wander, and leave and come back through the door; every seat, spot and resting cell is claimed by one person, the cat's seat is avoided and theirs are hidden from the cat, and standing up steps to the cell in front of the seat. `src/scene/people.js` shows Kenney's Mini Characters (CC0; three skinned glbs plus one colormap in `public/models/people`, about 750 KB) with crossfaded idle, walk, sit and interact clips. Save version 10 adds `residents` (0–3, default 0); positions are not saved. The count is a finish, so it is undoable and carried by room loads; the Light tab has a None/1/2/3 picker (arrivals walk in through the door), and the living room preset starts with two.

Completion criteria: sound can be muted independently of music; idle motion costs under 1 ms per frame on the benchmark; the cat never stands inside furniture and resumes after undo/redo and room loads; suite and `npm run bench` pass.

## Phase 9 — more room: structure, ceiling, night

Goal: rooms read as part of a house, not a box.

Increments:

1. Done 6 October 2026 (with the Phase 8 residents): **Doors.** Presets declare one `door: { wall, end }`; `presetDoor()` centres it on that end cell and falls back to the wall's other end, then the other wall, when a shrunk room would put it over a window. Its wall cells refuse new decorations and moves (`wallDoors`), but restores and loads allow them, so older saves keep anything hanging there. `src/room.js` draws a frame, a dark doorway and a panelled leaf that swings into the room while a resident is near. The balcony has none. Preset furniture keeps the floor cell inside each door clear. Still open: a strip of hallway floor beyond, and more than one door per room.
2. **Ceiling items.** A `ceiling` layer with a grid like the wall grid: pendant lamp, ceiling fan, string lights, hanging plant. Lamps feed the existing mood system. Save version 11: `ceiling` layer records `{ cx, cz }`.
3. **Window views.** The garden-day image becomes the default view, cropped per window aspect with an offset per wall; a dusk variant generated through tools/comfy crossfades on mood change; Phase 8 weather variants reuse the same slot.
4. **Room sizes beyond presets.** Width and depth sliders in the Rooms dialog within the existing size range, with windows and doors re-laid from the preset's rules.

Completion criteria: every preset has at least one door; two ceiling items exist and switch with moods; the window view changes with mood and weather; saves from versions 7–11 all load in the unit suite.

## Phase 10 — expression and progression

Goal: reasons to come back, without timers or money.

Increments:

1. **Photo mode upgrades.** Tilt and zoom presets, a polaroid frame, a caption, and a date stamp; export at 2x. Photos save to the gallery beside rooms.
2. **Custom pictures.** Drop or pick an image for any print or the photo frame; stored as a small data URL in the room record (version 12, capped at 200 KB per picture) with a clear fallback when absent.
3. **Styling challenges.** A `src/data/briefs.js` list: a brief, required tags, a palette hint and a mood. Scoring is local and deterministic (coverage of required tags, colour harmony against the brief's palette, a mood bonus). Results show a gentle three-star card; nothing is locked behind failure.
4. **Sticker book.** Local achievements for firsts: first lamp lit, first cat nap, every preset furnished, every collection used. Stored under `home-deco-sim:stickers`.
5. **Furniture discovery (optional, off by default).** A setting that starts the catalog at the classics and unlocks collections through briefs. Free decorating always remains available.

Completion criteria: a challenge can be completed end to end and reopened later; custom pictures survive export/import; stickers never block any feature; everything works offline.

## Phase 11 — desktop release

Goal: a sellable build on itch.io, with Steam-ready plumbing.

Increments:

1. **Electron shell.** `electron/` folder with a preload bridge; file-based saves in the user data folder with the browser gallery imported on first run; window state remembered; fullscreen toggle; no remote content.
2. **Settings for desktop.** Resolution scale, vsync, sound and music volumes, language placeholder.
3. **Controller support.** Cursor-style navigation for the catalog and the room with the existing keyboard actions mapped.
4. **Real-hardware QA.** A checklist run on a low-end laptop and a 4K display; frame budget recorded with `npm run bench`.
5. **Store page.** Capsule art rendered from the game, six screenshots, a 30-second trailer cut from photo mode and the cat, a one-paragraph pitch, Pixabay and font credits.

Completion criteria: an installer for Windows that runs without a browser or network; saves survive updates; the page is live on itch.io.

## Phase 12 — content packs and seasons

Goal: ongoing content after release, each pack a small self-contained increment.

Pattern for every pack: a collection key in `src/data/collections.js`, 8–12 props through the model pipeline (`docs/PROP_BRIEFS.md`), one preset, one window view, one brief, and a HANDOFF entry. Candidates: Cottage Christmas, Autumn Reading, Seaside Studio, Midnight Office, Garden Balcony. Patterns for wallpaper and rugs through a tools/comfy batch belong here too.

Completion is per pack, never for the phase.
