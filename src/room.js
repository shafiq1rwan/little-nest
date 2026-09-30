import * as THREE from 'three';

function texture(draw, size = 1024) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function woodTexture(floor = false) {
  return texture((c, s) => {
    c.fillStyle = '#c39872'; c.fillRect(0, 0, s, s);
    if (floor) {
      // Basket-weave parquet: alternating blocks of narrow wood strips.
      const block = 128;
      for (let x = 0; x < s; x += block) for (let y = 0; y < s; y += block) {
        c.save(); c.translate(x + block / 2, y + block / 2);
        if ((x / block + y / block) % 2) c.rotate(Math.PI / 2);
        for (let i = 0; i < 4; i++) {
          const tone = 155 + ((x * 17 + y * 7 + i * 13) % 36);
          c.fillStyle = 'rgb(' + (tone + 32) + ',' + (tone - 8) + ',' + (tone - 43) + ')';
          c.fillRect(-64, -64 + i * 32, 128, 32);
          c.strokeStyle = '#79523666'; c.lineWidth = 1.5; c.strokeRect(-64, -64 + i * 32, 128, 32);
          c.strokeStyle = '#f2d0a522'; c.lineWidth = 1;
          for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(-62, -61 + i * 32 + j * 6); c.bezierCurveTo(-20, -62 + i * 32 + j * 6, 15, -56 + i * 32 + j * 6, 62, -60 + i * 32 + j * 6); c.stroke(); }
        }
        c.restore();
      }
    } else {
      c.fillStyle = '#b5947b'; c.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 64) {
        c.fillStyle = y % 128 ? '#ffffff08' : '#34201308'; c.fillRect(0, y, s, 64);
        c.strokeStyle = '#51341f55'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke();
        c.strokeStyle = '#e6c5a722'; c.lineWidth = 1;
        for (let j = 0; j < 6; j++) { c.beginPath(); c.moveTo(0, y + 8 + j * 8); c.bezierCurveTo(300, y + 3 + j * 8, 700, y + 15 + j * 8, s, y + 8 + j * 8); c.stroke(); }
      }
    }
  });
}
function viewTexture() {
  return texture((c, s) => {
    const grad = c.createLinearGradient(0, 0, 0, s); grad.addColorStop(0, '#d6e7be'); grad.addColorStop(.6, '#c3cf93'); grad.addColorStop(1, '#7d995b');
    c.fillStyle = grad; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 130; i++) {
      const x = (i * 137.5) % s, y = (i * 69.3) % s;
      c.fillStyle = ['#88a05d55', '#bdce8955', '#f2e8af88', '#5d844755'][i % 4];
      c.beginPath(); c.ellipse(x, y, 20 + i % 35, 30 + i % 45, i, 0, Math.PI * 2); c.fill();
    }
  }, 512);
}
export function artTexture(botanical) {
  return texture((c, s) => {
    c.fillStyle = botanical ? '#f0dfc5' : '#eed1a0'; c.fillRect(0, 0, s, s);
    if (botanical) {
      c.strokeStyle = '#5c6b42'; c.lineWidth = 6; c.beginPath(); c.moveTo(s * .5, s * .88); c.bezierCurveTo(s * .4, s * .5, s * .6, s * .5, s * .5, s * .15); c.stroke();
      for (let i = 0; i < 8; i++) { const side = i % 2 ? -1 : 1; c.fillStyle = i % 3 ? '#6e8055' : '#9ca177'; c.beginPath(); c.ellipse(s * .5 + side * s * .12, s * .23 + i * s * .07, s * .16, s * .065, side * -.5, 0, Math.PI * 2); c.fill(); }
    } else {
      c.fillStyle = '#b6874d';
      for (const [x, y, rx, ry, r] of [[.25,.39,.18,.12,-.3],[.35,.58,.07,.18,-.3],[.53,.4,.07,.05,0],[.57,.55,.08,.16,-.2],[.73,.4,.2,.13,.1],[.82,.69,.09,.05,.3]]) {
        c.beginPath(); c.ellipse(x*s,y*s,rx*s,ry*s,r,0,Math.PI*2); c.fill();
      }
      c.fillStyle = '#6d4b2c'; c.textAlign = 'center'; c.font = '40px Georgia'; c.fillText('WORLD MAP', s / 2, s * .18);
      c.font = '20px Georgia'; c.fillText('a world of possibility', s / 2, s * .88);
    }
  }, 512);
}
export function createRoom(scene, size, wallHeight) {
  const half = size / 2;
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xe3a372, map: woodTexture(true), roughness: .85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x92725c, map: woodTexture(), roughness: .93 });
  const walls = new THREE.Group(); scene.add(walls);
  const wood = new THREE.MeshStandardMaterial({ color: 0x9b623d, roughness: .8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xe7ca9f, roughness: .9 });
  function block(w,h,d,mat,x,y,z,parent=walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.receiveShadow = m.castShadow = true; parent.add(m); return m;
  }
  block(size + .48,.23,size + .48,trim,0,-.2,0,scene);
  block(size,.15,size,floorMat,0,-.075,0,scene);
  block(size,.15,.15,trim,0,-.05,half+.07,scene);
  block(.15,.15,size,trim,half+.07,-.05,0,scene);
  // The two wall panels double as raycast targets for wall-mounted decorations.
  const backPanel = block(size,wallHeight,.2,wallMat,0,wallHeight/2,-half-.1); backPanel.userData.wall = 'back';
  const leftPanel = block(.2,wallHeight,size+.2,wallMat,-half-.1,wallHeight/2,-.1); leftPanel.userData.wall = 'left';
  block(size+.25,.1,.3,trim,0,wallHeight,-half-.1);
  block(.3,.1,size+.25,trim,-half-.1,wallHeight,-.1);
  block(size,.16,.09,wood,0,.09,-half+.06);
  block(.09,.16,size,wood,-half+.06,.09,0);
  const viewMat = new THREE.MeshStandardMaterial({ map: viewTexture(), emissive: 0xc9d498, emissiveIntensity: .2, roughness: 1 });
  function windowAt(x,z,rotation,width) {
    const g = new THREE.Group(); g.position.set(x,2.22,z); g.rotation.y = rotation; walls.add(g);
    block(width+.18,2.25,.13,wood,0,0,0,g);
    block(width,2.06,.025,viewMat,0,0,.08,g);
    for (const xx of [-width/2,0,width/2]) block(.055,2.15,.07,trim,xx,0,.11,g);
    block(width,.055,.07,trim,0,-.45,.11,g);
    block(width+.28,.07,.35,wood,0,-1.13,.12,g);
    for (let i=0;i<10;i++) block(width+.1,.065,.12,wood,0,1.09-i*.073,.2,g);
    const cord = new THREE.MeshStandardMaterial({ color: 0xe6ccad });
    for (const xx of [-width*.32,width*.32]) block(.012,.73,.015,cord,xx,.78,.27,g);
  }
  windowAt(-1.5,-half+.05,0,4.7);
  windowAt(-half+.05,-1.9,Math.PI/2,3.9);
  // The framed prints are catalog wall items now (see props.js) so they can be moved and swapped.
  // A short string of warm bulbs above the cabinet.
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x5d4938 });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(half-1.1,3.6,-half+.18),new THREE.Vector3(half-.65,3.25,-half+.18),new THREE.Vector3(half-.2,3.6,-half+.18)]);
  walls.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.008,5,false),wireMat));
  const bulbMat = new THREE.MeshStandardMaterial({ color:0xffe2a4,emissive:0xffc76b,emissiveIntensity:2 });
  for (const t of [.12,.4,.7,.92]) {
    const p=curve.getPoint(t), bulb=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),bulbMat); bulb.position.copy(p); walls.add(bulb);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:0xdf9d80,toneMapped:false}));
  ground.rotation.x=-Math.PI/2; ground.position.y=-.34; scene.add(ground);
  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.18}));
  groundShadow.rotation.x=-Math.PI/2;groundShadow.position.y=-.335;groundShadow.receiveShadow=true;scene.add(groundShadow);
  // Wall areas covered by fixtures, in world units along each wall, so decorations cannot overlap them.
  const fixtures = [
    { wall: 'back', from: -3.85, to: .85, bottom: 1.05, top: 3.4 },   // back window with sill and blinds
    { wall: 'left', from: -3.85, to: .05, bottom: 1.05, top: 3.4 },   // side window
    { wall: 'back', from: 2.9, to: 3.8, bottom: 3.2, top: 3.65 },     // string of bulbs
  ];
  return { floorMat, wallMat, walls, wallPanels: { back: backPanel, left: leftPanel }, fixtures };
}
