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

  scene.add(new THREE.HemisphereLight(0xfff3df, 0xaa7652, 2));
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
  function zoomBy(factor) {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
  }
  /** Fits the orthographic frustum to the canvas so the whole room stays framed at any aspect. */
  let lastWidth = 0, lastHeight = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === lastWidth && h === lastHeight)) return;
    lastWidth = w; lastHeight = h;
    renderer.setSize(w, h, false);
    const aspect = w / h, span = Math.max(10.6, 13.6 / aspect);
    camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, controls, resetView, zoomBy, resize };
}
