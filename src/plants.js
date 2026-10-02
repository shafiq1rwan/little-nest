import * as THREE from 'three';
import { sharedMaterial } from './scene/geometry.js';
import { modelInstance } from './scene/models.js';

const palette = { soil: 0x49392c, dark: 0x34593d, green: 0x5c814b, light: 0x8ca363, cream: 0xf3e4d2 };
const mat = (color) => sharedMaterial(color, .88);
function part(g, geometry, color, position = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat(color)); m.position.set(...position);
  m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function rod(g, from, to, radius, color) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const m = part(g, new THREE.CylinderGeometry(radius * .75, radius, a.distanceTo(b), 7), color);
  m.position.copy(a.clone().add(b).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return m;
}
function pot(g, radius, height, color, style = 'ceramic') {
  const body = part(g, new THREE.CylinderGeometry(radius, radius * .77, height, 24), color, [0, height / 2, 0]);
  body.userData.recolor = true;
  const lip = part(g, new THREE.TorusGeometry(radius * .97, .025, 6, 24), color, [0, height, 0]);
  lip.rotation.x = Math.PI / 2; lip.userData.recolor = true;
  part(g, new THREE.CylinderGeometry(radius * .91, radius * .91, .015, 24), palette.soil, [0, height - .015, 0]);
  if (style === 'ribbed') {
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12;
      const rib = rod(g, [Math.cos(a)*radius*.79,.035,Math.sin(a)*radius*.79], [Math.cos(a)*radius*.98,height-.025,Math.sin(a)*radius*.98], .009, color);
      rib.userData.recolor = true;
    }
  }
  return height;
}
// Curved, pointed leaves with a central ridge, built as solid low-poly blades.
function bladeGeometry(length, width, bend = .1) {
  const vertices = [], indices = [], steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, halfWidth = width * Math.sin(Math.PI * t) / 2;
    const z = bend * t * t;
    vertices.push(-halfWidth, length*t, z, 0, length*t, z+.016*Math.sin(Math.PI*t), halfWidth, length*t, z);
  }
  for (let i = 0; i < steps; i++) {
    const a=i*3,b=a+3;
    indices.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2);
    indices.push(a+1,b,a,b+1,b,a+1,a+2,b+1,a+1,b+2,b+1,a+2);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function leaf(g, start, end, length, width, color, bend = .07) {
  const m=part(g,bladeGeometry(length,width,bend),color,start);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize());
  return m;
}
function snakePlant() {
  const g=new THREE.Group(), base=pot(g,.25,.42,0xe9dfc8,'ribbed');
  for (let i=0;i<9;i++) {
    const angle=i*2.399,r=i===0?0:.12,h=.62+(i%4)*.16;
    const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    const m=part(g,bladeGeometry(h,.15,.09),i%2?0x526e46:0x698553,[x,base-.02,z]);
    m.rotation.y=angle;m.rotation.z=(i%2?1:-1)*.07;
    const stripe=part(g,bladeGeometry(h*.98,.065,.094),0xa4b778,[x,base-.014,z]);
    stripe.rotation.copy(m.rotation);
  }
  return g;
}
function palm() {
  const g=new THREE.Group(),base=pot(g,.27,.43,0xbe9165);
  for (let i=0;i<7;i++) {
    const a=i*2.399,h=1.2+(i%3)*.14,reach=.36+(i%2)*.025;
    const root=[Math.cos(a)*.045,base,Math.sin(a)*.045];
    const tip=[Math.cos(a)*reach,h,Math.sin(a)*reach];
    const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(...root),new THREE.Vector3(Math.cos(a)*.08,h+.19,Math.sin(a)*.08),new THREE.Vector3(...tip));
    part(g,new THREE.TubeGeometry(curve,10,.013,5,false),0x688246);
    for (let j=3;j<9;j++) {
      const t=j/10,p=curve.getPoint(t),spread=.15*Math.sin(Math.PI*t);
      for (const side of [-1,1]) {
        const end=[p.x+Math.cos(a+side*Math.PI/2)*spread+Math.cos(a)*.035,p.y-.06,p.z+Math.sin(a+side*Math.PI/2)*spread+Math.sin(a)*.035];
        leaf(g,p.toArray(),end,spread+.025,.047,j%2?0x6d8f50:0x416d3f,.025);
      }
    }
    leaf(g,curve.getPoint(.86).toArray(),tip,.13,.046,0x719451,.015);
  }
  return g;
}
function cactus() {
  const g=new THREE.Group(),base=pot(g,.27,.34,0xc57955);
  part(g,new THREE.SphereGeometry(.26,16,12),0x6f965a,[0,base+.24,0]).scale.y=1.25;
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5;
    const rib=part(g,new THREE.SphereGeometry(1,8,8),0x8daa6a,[Math.cos(a)*.242,base+.24,Math.sin(a)*.242]);
    rib.scale.set(.025,.28,.025);
    for(let j=0;j<4;j++) {
      const y=base+.08+j*.11;
      rod(g,[Math.cos(a)*.245,y,Math.sin(a)*.245],[Math.cos(a)*.275,y+.012,Math.sin(a)*.275],.005,0xe1d4a4);
    }
  }
  // A small pink blossom crown gives the compact cactus a distinct silhouette.
  for(let i=0;i<7;i++) {
    const a=i*Math.PI*2/7;
    const p=part(g,new THREE.SphereGeometry(.055,8,6),0xd79c9c,[Math.cos(a)*.067,base+.55,Math.sin(a)*.067]);
    p.scale.set(1,.5,1);
  }
  part(g,new THREE.SphereGeometry(.035,8,6),0xe9bd6c,[0,base+.56,0]);
  return g;
}
function rubberTree() {
  const g=new THREE.Group(),base=pot(g,.25,.42,palette.cream);
  for(const [x,z,h] of [[-.045,0,1.58],[.065,.04,1.25]]) {
    rod(g,[x,base-.01,z],[x+.02,h,z],.024,0x786044);
    for(let i=0;i<6;i++) {
      const a=i*2.4+(x>0?.9:0),y=base+.19+i*(h-base-.25)/6;
      const end=[x+Math.cos(a)*.23,y+.08,z+Math.sin(a)*.23];
      rod(g,[x,y,z],end,.01,0x62804b);
      const m=part(g,new THREE.SphereGeometry(1,12,8),i%3?0x3c6845:0x698956,end);
      m.scale.set(.095,.034,.21);m.rotation.set(.3,-a+Math.PI/2,.12);
      rod(g,[end[0]-Math.cos(a)*.13,end[1]+.023,end[2]-Math.sin(a)*.13],[end[0]+Math.cos(a)*.15,end[1]+.023,end[2]+Math.sin(a)*.15],.004,0x9baa71);
    }
  }
  g.scale.set(.98,1,.98);
  return g;
}
function monstera() {
  const g = new THREE.Group(), base = pot(g, .27, .4, 0xe9dfc8);
  // Each leaf is three overlapping lobes so the silhouette reads as a split leaf without cut-outs.
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + .3, reach = .3 + (i % 2) * .08, h = .95 + (i % 3) * .18;
    const tip = new THREE.Vector3(Math.cos(a) * reach, h, Math.sin(a) * reach);
    rod(g, [Math.cos(a) * .03, base - .02, Math.sin(a) * .03], tip.toArray(), .014, 0x4f7a3f);
    const shade = i % 2 ? 0x3e6a3e : 0x4f8a4a;
    for (const [side, len] of [[0, .3], [-1, .22], [1, .22]]) {
      const lobe = part(g, new THREE.SphereGeometry(1, 10, 7), shade, [tip.x + Math.cos(a + side * 1.1) * .06, tip.y + .01 - Math.abs(side) * .02, tip.z + Math.sin(a + side * 1.1) * .06]);
      lobe.scale.set(.09 - Math.abs(side) * .02, .02, len); lobe.rotation.y = -a + side * .5 - Math.PI / 2; lobe.rotation.x = .25;
    }
  }
  return g;
}
function fern() {
  const g = new THREE.Group(), base = pot(g, .24, .3, 0xc57955, 'ribbed');
  for (let i = 0; i < 14; i++) {
    const a = i * 0.449, droop = .45 + (i % 3) * .1, h = .55 + (i % 4) * .12;
    const root = [Math.cos(a) * .03, base - .02, Math.sin(a) * .03];
    const mid = new THREE.Vector3(Math.cos(a) * droop * .6, h, Math.sin(a) * droop * .6);
    const tip = new THREE.Vector3(Math.cos(a) * droop, h - .25, Math.sin(a) * droop);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...root), mid, tip);
    part(g, new THREE.TubeGeometry(curve, 6, .008, 4, false), 0x5c8a45);
    for (let j = 2; j < 8; j++) {
      const t = j / 8, p = curve.getPoint(t), spread = .09 * Math.sin(Math.PI * t) + .03;
      for (const side of [-1, 1]) {
        const end = [p.x + Math.cos(a + side * Math.PI / 2) * spread, p.y - .02, p.z + Math.sin(a + side * Math.PI / 2) * spread];
        leaf(g, p.toArray(), end, spread + .01, .035, j % 2 ? 0x7fb35a : 0x5c8a45, .02);
      }
    }
  }
  return g;
}
export const PLANT_CATALOG = {
  monstera: { label: 'Monstera', category: 'decor', tags: ['plant', 'leaf', 'tropical'], w: 1, d: 1, defaultColor: 0xe9dfc8, model: 'models/monstera.glb', build: () => modelInstance('monstera') || monstera() },
  fern: { label: 'Boston fern', category: 'decor', tags: ['plant', 'fern'], w: 1, d: 1, defaultColor: 0xc57955, model: 'models/fern.glb', build: () => modelInstance('fern') || fern() },
  snakePlant:{label:'Snake plant',category:'decor',tags:['plant','succulent'],w:1,d:1,defaultColor:0xe9dfc8,model: 'models/snakePlant.glb', build: () => modelInstance('snakePlant') || snakePlant() },
  palm:{label:'Areca palm',category:'decor',tags:['plant','palm'],w:1,d:1,defaultColor:0xbe9165,model: 'models/palm.glb', build: () => modelInstance('palm') || palm() },
  cactus:{label:'Flowering cactus',category:'decor',tags:['plant','cactus','succulent'],w:1,d:1,defaultColor:0xc57955,model: 'models/cactus.glb', build: () => modelInstance('cactus') || cactus() },
  rubberTree:{label:'Rubber tree',category:'decor',tags:['plant','tree'],w:1,d:1,defaultColor:palette.cream,model: 'models/rubberTree.glb', build: () => modelInstance('rubberTree') || rubberTree() },
};
