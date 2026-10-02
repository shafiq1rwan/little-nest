"""Generate the framed-art images with a running ComfyUI (the Pinokio launcher, Flux Schnell checkpoint).

    python tools/comfy/generate-prints.py                 # all prints
    python tools/comfy/generate-prints.py worldMap --seed 7

Writes art-source/prints/<key>.png (full size, ignored by git) and public/art/prints/<key>.webp
(512 px on the long side, tracked), which src/scene/models.js preloads for the print canvases.
Set COMFY_URL if the app is not on http://127.0.0.1:8188.
"""
import argparse, io, json, os, random, time, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
URL = os.environ.get('COMFY_URL', 'http://127.0.0.1:8188')
STYLE = ('flat stylized illustration, soft matte colours, muted sage, olive, cream and warm honey palette, '
         'gentle paper grain, no text, no border, no frame, no watermark, no signature')
PRINTS = {
    # key: (width, height, prompt)  sizes keep the canvas aspect of each model (see docs/PROP_BRIEFS.md)
    'worldMap': (1024, 800, 'vintage world map poster on warm parchment, simplified continents in muted terracotta and sage, '
                            'faint latitude lines, small compass rose, cozy cottage decor print, ' + STYLE),
    'botanicalPrint': (832, 1024, 'vintage botanical plate of one large monstera deliciosa leaf with its characteristic splits and holes, '
                                  'deep sage and olive green gouache on aged cream paper background, centred with generous margins, '
                                  'tiny handwritten latin caption below, cozy cottage decor print, ' + STYLE),
    'frame': (832, 1024, 'small framed family photo illustration: a sleepy ginger cat curled on a cream armchair by a window, '
                         'warm late afternoon light, cozy, ' + STYLE),
}
CHECKPOINT = 'flux1-schnell-fp8.safetensors'

def workflow(prompt, width, height, seed):
    return {
        '1': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': CHECKPOINT}},
        '2': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': prompt}},
        '3': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': ''}},
        '4': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': width, 'height': height, 'batch_size': 1}},
        '5': {'class_type': 'KSampler', 'inputs': {'model': ['1', 0], 'positive': ['2', 0], 'negative': ['3', 0], 'latent_image': ['4', 0],
                                                   'seed': seed, 'steps': 4, 'cfg': 1.0, 'sampler_name': 'euler', 'scheduler': 'simple', 'denoise': 1.0}},
        '6': {'class_type': 'VAEDecode', 'inputs': {'samples': ['5', 0], 'vae': ['1', 2]}},
        '7': {'class_type': 'SaveImage', 'inputs': {'images': ['6', 0], 'filename_prefix': 'little-nest-print'}},
    }

def post(path, data):
    req = urllib.request.Request(URL + path, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=60))

def get(path):
    return urllib.request.urlopen(URL + path, timeout=60).read()

def generate(key, seed):
    width, height, prompt = PRINTS[key]
    started = time.time()
    pid = post('/prompt', {'prompt': workflow(prompt, width, height, seed)})['prompt_id']
    while True:
        history = json.loads(get('/history/' + pid))
        if pid in history:
            status = history[pid].get('status', {})
            if status.get('status_str') == 'error':
                raise RuntimeError('ComfyUI reported an error: ' + json.dumps(status.get('messages', []))[:400])
            images = history[pid]['outputs']['7']['images']
            break
        time.sleep(2)
    image = images[0]
    data = get('/view?filename=%s&subfolder=%s&type=%s' % (image['filename'], image.get('subfolder', ''), image['type']))
    raw_dir = os.path.join(ROOT, 'art-source', 'prints'); os.makedirs(raw_dir, exist_ok=True)
    with open(os.path.join(raw_dir, key + '.png'), 'wb') as f: f.write(data)
    from PIL import Image
    im = Image.open(io.BytesIO(data)).convert('RGB')
    scale = 512 / max(im.size); im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    out_dir = os.path.join(ROOT, 'public', 'art', 'prints'); os.makedirs(out_dir, exist_ok=True)
    im.save(os.path.join(out_dir, key + '.webp'), 'WEBP', quality=85)
    print(f'{key}: {width}x{height} seed {seed} in {time.time() - started:.0f}s -> public/art/prints/{key}.webp')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('keys', nargs='*'); ap.add_argument('--seed', type=int, default=None)
    args = ap.parse_args()
    for key in args.keys or list(PRINTS):
        generate(key, args.seed if args.seed is not None else random.randrange(1 << 31))
