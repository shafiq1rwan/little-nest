import * as THREE from 'three';
import { CATALOG } from './props.js';
const paths = {
 home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
 folder:'M3 7V5h7l2 3h9l-3 12H3V7Z',
 save:'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',
 help:'M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 pencil:'m4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4',
 move:'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
 rotate:'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3',
 grid:'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 close:'m6 6 12 12M6 18 18 6',
 trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
 minus:'M5 12h14',plus:'M5 12h14M12 5v14',
 target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 8v8M8 12h8M12 1v3M12 20v3M1 12h3M20 12h3',
 search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1 5 6 6',
 chevron:'m6 9 6 6 6-6',
 music:'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 'music-off':'M9 18V9M9 6l11-2v9M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 3l18 18',
};
export function installIcons(root = document) {
 root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + paths[el.dataset.icon] + '"/></svg>'; });
}
export function createThumbnails() {
 const r = new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
 r.setSize(240,200); r.setPixelRatio(1); r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.35;
 const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xfff8e9,0xa48a70,3));
 const light = new THREE.DirectionalLight(0xffe5c5,3); light.position.set(-3,5,4); s.add(light);
 const thumbnails = {};
 for (const [key,def] of Object.entries(CATALOG)) {
  const model = def.build(); s.add(model);
  const bounds = new THREE.Box3().setFromObject(model), center=bounds.getCenter(new THREE.Vector3());
  const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);
  camera.position.copy(center).add(new THREE.Vector3(5,3.5,6)); camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const projected = new THREE.Box3();
  for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  const extent=Math.max((projected.max.x-projected.min.x)/2.4,(projected.max.y-projected.min.y)/2)*1.12;
  camera.left=-extent*1.2;camera.right=extent*1.2;camera.top=extent;camera.bottom=-extent;camera.updateProjectionMatrix();
  r.render(s,camera); thumbnails[key]=r.domElement.toDataURL('image/png'); s.remove(model);
  model.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
 }
 r.dispose(); r.forceContextLoss(); return thumbnails;
}
