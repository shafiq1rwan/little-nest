// Renderer, scene, orthographic camera, orbit controls, and lighting.
// Values come from config so the room can be re-framed without touching this file.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene({ canvas, camera: cam, render, backdrop }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, render.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = render.exposure;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backdrop);

  const camera = new THREE.OrthographicCamera(-9, 9, 9, -9, 0.1, 100);
  camera.position.set(...cam.position);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...cam.target);
  controls.enableDamping = true;
  controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  // One finger decorates; two fingers control the camera.
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.minPolarAngle = cam.minPolarAngle;
  controls.maxPolarAngle = cam.maxPolarAngle;
  controls.minAzimuthAngle = cam.minAzimuthAngle;
  controls.maxAzimuthAngle = cam.maxAzimuthAngle;
  controls.minZoom = cam.minZoom;
  controls.maxZoom = cam.maxZoom;

  const hemisphere = new THREE.HemisphereLight(0xfff3df, 0xaa7652, 2);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffe2b3, 3.2);
  sun.position.set(-3, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -9;
  sun.shadow.camera.right = sun.shadow.camera.top = 9;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun);

  function resetView() {
    camera.position.set(...cam.position);
    controls.target.set(...cam.target);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
  }
  /** Turns the view around its target by `delta` radians, within the configured azimuth limits (none by default: all the way round). */
  function orbitBy(delta) {
    const current = controls.getAzimuthalAngle();
    const next = THREE.MathUtils.clamp(current + delta, controls.minAzimuthAngle, controls.maxAzimuthAngle);
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), next - current);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    return next !== current;
  }
  // Tilting: the Top view button swings the camera between looking straight down and the angle it had before.
  let tilt = null;   // { from, to, zoomFrom, zoomTo, start, ms } while swinging
  let tiltBack = null;   // the polar angle and zoom to return to from the top: { phi, zoom }
  let roomCells = 8;   // the room's longest side, from setFrame()
  const isTop = () => controls.getPolarAngle() < cam.topPolarAngle + 0.15;
  function setPolar(phi) {
    const offset = camera.position.clone().sub(controls.target);
    const s = new THREE.Spherical().setFromVector3(offset);
    s.phi = THREE.MathUtils.clamp(phi, controls.minPolarAngle, controls.maxPolarAngle);
    s.makeSafe();
    camera.position.copy(controls.target).add(offset.setFromSpherical(s));
    controls.update();
  }
  /** Looks straight down (`on`), or back at the previous angle. `animate` false jumps there. */
  function viewFromTop(on, animate = true) {
    const from = controls.getPolarAngle();
    if (on && !isTop()) tiltBack = { phi: from, zoom: camera.zoom };
    const to = on ? cam.topPolarAngle : tiltBack?.phi ?? new THREE.Spherical().setFromVector3(new THREE.Vector3(...cam.position).sub(new THREE.Vector3(...cam.target))).phi;
    // Seen from straight above, the room is a turned square: zoom out just enough for all of it to fit.
    const a = controls.getAzimuthalAngle(), extent = roomCells * (Math.abs(Math.sin(a)) + Math.abs(Math.cos(a))) * 1.12;
    const fit = Math.min((camera.top - camera.bottom) / extent, (camera.right - camera.left) / extent);
    const zoomTo = on ? Math.min(camera.zoom, fit) : tiltBack?.zoom ?? camera.zoom;
    if (!on) tiltBack = null;
    tilt = { from, to, zoomFrom: camera.zoom, zoomTo, start: performance.now(), ms: animate ? cam.tiltMs : 0 };
    stepView(tilt.start);
  }
  /** Advances a tilt; true while one is running. */
  function stepView(now) {
    if (!tilt) return false;
    const k = tilt.ms ? Math.min(1, (now - tilt.start) / tilt.ms) : 1, e = k * k * (3 - 2 * k);
    camera.zoom = tilt.zoomFrom + (tilt.zoomTo - tilt.zoomFrom) * e;
    camera.updateProjectionMatrix();
    setPolar(tilt.from + (tilt.to - tilt.from) * e);
    if (k >= 1) tilt = null;
    return true;
  }
  function zoomBy(factor) {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
  }
  /** Fits the orthographic frustum to the canvas so the whole room stays framed at any aspect. */
  let lastWidth = 0, lastHeight = 0;
  let frame = 1;   // 1 frames an 8 x 8 room; larger rooms scale it up
  /** True when the canvas size changed (and the frustum was refitted). */
  function resize(force = false) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (!force && w === lastWidth && h === lastHeight)) return false;
    lastWidth = w; lastHeight = h;
    renderer.setSize(w, h, false);
    const aspect = w / h, span = Math.max(10.6, 13.6 / aspect) * frame;
    camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    return true;
  }
  /** Re-frames for a room whose longest side is `cells` wide (8 is the baseline). Smaller rooms keep the baseline. */
  function setFrame(cells) {
    roomCells = cells;
    frame = Math.max(1, cells / 8);
    resize(true);
  }

  return { renderer, scene, camera, controls, hemisphere, sun, resetView, zoomBy, orbitBy, resize, setFrame, viewFromTop, stepView, isTop };
}
