// Ink outlines: a screen-space pass that draws soft lines along silhouettes and creases, so
// low-poly furniture reads as drawn rather than flat.
//
// Each frame the scene is rendered once more into a small target with a normal material (view-space
// normals plus a depth texture), without shadows or lights. A full-screen quad then finds edges
// (a jump in depth that a flat surface cannot produce, or a sharp turn in the normal) and multiplies
// the finished frame by a warm ink colour there. Multiplying keeps the main render untouched
// (antialiasing, tone mapping, colour space) and makes each line a darker shade of what it sits on.
//
// Lines, points, sprites, transparent meshes (the placement ghost, shadow decals) and anything with
// userData.noOutline are left out of the edge pass, so helpers and previews are never outlined.
// Meshes with userData.softOutline (catalog `outline: 'soft'`, for bumpy generated surfaces) keep
// their silhouette but draw no inner creases: they are drawn with one flat normal in the edge pass.

import * as THREE from 'three';

export const OUTLINE = {
  ink: [0.42, 0.33, 0.27],   // multiplied into the frame: a warm brown, never black
  strength: 0.85,            // 0..1 how far a full edge darkens toward the ink
  depthEdge: 0.12,           // world units of depth discontinuity that counts as a silhouette
  normalEdge: 0.35,          // 1 - cos(angle) between neighbouring normals that counts as a crease
  width: 1,                  // line half-width in CSS pixels
};

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const fragmentShader = /* glsl */`
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 texel;          // one texel times the line half-width
  uniform float depthRange;    // far - near: turns depth samples into world units (orthographic)
  uniform float depthEdge;
  uniform float normalEdge;
  uniform vec3 ink;
  uniform float strength;
  varying vec2 vUv;

  float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * depthRange; }
  vec3 normalAt(vec2 uv) { return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0); }

  void main() {
    vec2 dx = vec2(texel.x, 0.0), dy = vec2(0.0, texel.y);
    float c = depthAt(vUv);
    float l = depthAt(vUv - dx), r = depthAt(vUv + dx), d = depthAt(vUv - dy), u = depthAt(vUv + dy);
    // Second differences are zero across any flat surface whatever its slope, so floors and walls
    // seen at a grazing angle stay clean; only real steps in depth (silhouettes) light up.
    float step = max(abs(l + r - 2.0 * c), abs(d + u - 2.0 * c));
    float depthLine = smoothstep(depthEdge, depthEdge * 2.0, step);

    vec3 n = normalAt(vUv);
    float turn = max(max(1.0 - dot(n, normalAt(vUv - dx)), 1.0 - dot(n, normalAt(vUv + dx))),
                     max(1.0 - dot(n, normalAt(vUv - dy)), 1.0 - dot(n, normalAt(vUv + dy))));
    float normalLine = smoothstep(normalEdge, normalEdge * 1.6, turn);

    float edge = max(depthLine, normalLine) * strength;
    gl_FragColor = vec4(mix(vec3(1.0), ink, edge), 1.0);
  }
`;

export function createOutlines(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(1, 1);
  target.depthTexture.type = THREE.UnsignedIntType;
  const normals = new THREE.MeshNormalMaterial();
  const facing = new THREE.MeshBasicMaterial();   // a normal facing the camera, packed like MeshNormalMaterial's
  facing.color.setRGB(0.5, 0.5, 1, THREE.LinearSRGBColorSpace);
  const swapped = [];

  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: {
      tNormal: { value: target.texture }, tDepth: { value: target.depthTexture },
      texel: { value: new THREE.Vector2() }, depthRange: { value: 1 },
      depthEdge: { value: OUTLINE.depthEdge }, normalEdge: { value: OUTLINE.normalEdge },
      ink: { value: new THREE.Color(...OUTLINE.ink) }, strength: { value: OUTLINE.strength },
    },
    depthTest: false, depthWrite: false, toneMapped: false,
    // result = frame * shader colour
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const overlay = new THREE.Scene();
  overlay.add(quad);
  const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let enabled = true;
  const size = new THREE.Vector2();
  const clear = new THREE.Color();
  const hidden = [];
  const skip = (o) => o.isLine || o.isPoints || o.isSprite || o.userData.noOutline
    || (o.isMesh && (Array.isArray(o.material) ? o.material.some((m) => m.transparent) : o.material?.transparent));

  /** Draws the scene normally, then the outlines over it. Use in place of renderer.render(scene, camera). */
  function render() {
    if (!enabled) { renderer.render(scene, camera); return; }
    renderer.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    const ratio = renderer.getPixelRatio();
    material.uniforms.texel.value.set(OUTLINE.width * ratio / size.x, OUTLINE.width * ratio / size.y);
    material.uniforms.depthRange.value = camera.far - camera.near;

    // Edge pass: normals and depth only, without shadows, helpers or transparent things.
    scene.traverseVisible((o) => {
      if (o === scene) return;
      if (skip(o)) hidden.push(o);
      else if (o.isMesh) { swapped.push(o, o.material); o.material = o.userData.softOutline ? facing : normals; }
    });
    for (const o of hidden) o.visible = false;
    const background = scene.background, autoShadows = renderer.shadowMap.autoUpdate;
    const clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    scene.background = null;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x8080ff, 1);   // a normal facing the camera
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, clearAlpha);
    renderer.shadowMap.autoUpdate = autoShadows;
    scene.background = background;
    for (const o of hidden) o.visible = true;
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    hidden.length = 0; swapped.length = 0;

    renderer.render(scene, camera);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(overlay, overlayCamera);
    renderer.autoClear = autoClear;
  }

  return {
    render,
    get enabled() { return enabled; },
    setEnabled(on) { enabled = !!on; },
    dispose() { target.depthTexture.dispose(); target.dispose(); normals.dispose(); facing.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}
