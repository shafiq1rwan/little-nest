const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__sim);
 await page.locator('#deselect').click();
 await page.locator('#search').fill('plant');assert.equal(await page.locator('.catalog-card:visible').count(),5);
 const bounds=await page.evaluate(async()=>{
   const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
   return __sim.items.filter(i=>['snakePlant','palm','cactus','rubberTree'].includes(i.type)).map(i=>{
     const box=new Box3().setFromObject(i.mesh),size=box.getSize(new Vector3());return {type:i.type,w:size.x,d:size.z,h:size.y};
   });
 });
 for(const b of bounds){assert.ok(b.w<=1.05&&b.d<=1.05,JSON.stringify(b));assert.ok(b.h>.6);}
 console.log('Plant bounds:',JSON.stringify(bounds));
 assert.equal(await page.locator('.catalog-card:visible img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
 await page.screenshot({path:'output/checks/plants-catalog.png'});
 for(const type of ['snakePlant','palm','cactus','rubberTree']){
   await page.locator('.catalog-card[data-type="'+type+'"]').click();
   const point=await page.evaluate(()=>{
     const p=__sim.worldPos('plant',7,3,0).project(__sim.camera),r=document.getElementById('scene').getBoundingClientRect();
     return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
   });
   await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
   assert.equal(await page.evaluate(()=>__sim.selected.type),type);
   await page.locator('#rotate-selected').click();assert.equal(await page.evaluate(()=>__sim.selected.rot),1);
   await page.getByRole('button',{name:'Terracotta',exact:true}).click();
   assert.equal(await page.evaluate(()=>__sim.selected.color),0xb96949);
   assert.equal(await page.evaluate(()=>{let valid=true;__sim.selected.mesh.traverse(o=>{if(o.userData.recolor&&o.material.color.getHex()!==0xb96949)valid=false;});return valid;}),true);
   await page.locator('#save').click();await page.locator('#remove-selected').click();await page.locator('#load').click();
   const restored=await page.evaluate(type=>__sim.items.find(i=>i.type===type&&i.gx===7&&i.gz===3),type);
   assert.equal(restored.color,0xb96949);assert.equal(restored.rot,1);
   await page.evaluate(type=>__sim.setSelected(__sim.items.find(i=>i.type===type&&i.gx===7&&i.gz===3)),type);
   await page.locator('#remove-selected').click();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: four new plants fit their tile, have rendered thumbnails, can be placed, rotated, recolored, saved, restored, and removed. No browser errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
