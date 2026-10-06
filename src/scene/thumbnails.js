// Renders a small isometric preview of every catalog model with an offscreen renderer.
// Returns { [type]: dataURL }. Results are cached in browser storage under a signature of the
// catalog, so repeat visits skip the WebGL work; a changed model invalidates the cache.

import * as THREE from 'three';
import { disposeModel, compactModel } from './geometry.js';
import { readJSON, writeJSON } from '../persistence/storage.js';
import { MODELS_VERSION } from '../config/game.js';

export const THUMBNAIL_CACHE_KEY = 'home-deco-sim:thumbnails';

/** A cheap fingerprint of the catalog: every type plus the length of its builder source. */
export function catalogSignature(catalog) {
  let hash = 0;
  for (const [key, def] of Object.entries(catalog)) {
    const text = key + ':' + String(def.build).length + ':' + (def.defaultColor ?? '') + ':' + (def.model ? def.model + '@' + MODELS_VERSION : '');
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return 'v5:' + (hash >>> 0).toString(36);
}

export function createThumbnails(catalog, { width = 240, height = 200, cache = true } = {}) {
  const signature = catalogSignature(catalog);
  if (cache) {
    const stored = readJSON(THUMBNAIL_CACHE_KEY);
    if (stored?.signature === signature && stored.thumbnails && Object.keys(catalog).every((k) => typeof stored.thumbnails[k] === 'string')) {
      return { thumbnails: stored.thumbnails, cached: true };
    }
  }

  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(width, height);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.35;
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xfff8e9, 0xa48a70, 3));
  const light = new THREE.DirectionalLight(0xffe5c5, 3);
  light.position.set(-3, 5, 4);
  s.add(light);

  const thumbnails = {};
  for (const [key, def] of Object.entries(catalog)) {
    const model = compactModel(def.build());
    s.add(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 30);
    camera.position.copy(center).add(new THREE.Vector3(5, 3.5, 6));
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    // Fit the projected bounding box so every model fills its card the same way.
    const projected = new THREE.Box3();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    }
    const extent = Math.max((projected.max.x - projected.min.x) / 2.4, (projected.max.y - projected.min.y) / 2) * 1.12;
    camera.left = -extent * 1.2; camera.right = extent * 1.2; camera.top = extent; camera.bottom = -extent;
    camera.updateProjectionMatrix();
    r.render(s, camera);
    thumbnails[key] = r.domElement.toDataURL('image/webp', 0.85);   // WebP keeps 160+ thumbnails inside the storage quota
    s.remove(model);
    disposeModel(model);
  }
  r.dispose();
  r.forceContextLoss();
  if (cache) writeJSON(THUMBNAIL_CACHE_KEY, { signature, thumbnails });   // a refused write just means no cache next time
  return { thumbnails, cached: false };
}
