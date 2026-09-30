const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__sim);
 const state=()=>page.evaluate(()=>__sim.items.map(({type,gx,gz,rot,color})=>({type,gx,gz,rot,color})));
 assert.equal((await state()).length,16);
 assert.equal(await page.evaluate(()=>__sim.items.every(it=>{
   const def=it.type==='rug'?{w:4,d:3}:null;
   return it.gx>=0&&it.gz>=0&&it.gx<8&&it.gz<8;
 })),true);
 await page.locator('#rotate-selected').click();
 assert.equal(await page.evaluate(()=>__sim.selected.rot),0);
 await page.getByRole('button',{name:'Terracotta',exact:true}).click();
 assert.equal(await page.evaluate(()=>__sim.selected.color),0xb96949);
 const saved=await state();await page.locator('#save').click();
 await page.locator('#remove-selected').click();assert.equal((await state()).length,15);
 await page.locator('#load').click();assert.deepEqual(await state(),saved);
 await page.locator('#search').fill('plant');
 assert.equal(await page.locator('.catalog-card:visible').count(),5);
 await page.locator('#search').fill('rug');
 assert.equal(await page.locator('.catalog-card:visible').count(),1);
 await page.locator('#search').fill('');
 await page.locator('[data-category="seating"]').click();assert.equal(await page.locator('.catalog-card:visible').count(),4);
 await page.locator('[data-category="all"]').click();
 await page.locator('#tab-walls').click();await page.getByRole('button',{name:'Sage',exact:true}).click();
 assert.equal(await page.evaluate(()=>__sim.wallMat.color.getHex()),0x9ba58c);
 await page.locator('#tab-floor').click();await page.getByRole('button',{name:'Pale oak',exact:true}).click();
 assert.equal(await page.evaluate(()=>__sim.floorMat.color.getHex()),0xf6d9b0);
 await page.locator('#grid-tool').click();assert.equal(await page.evaluate(()=>__sim.grid.visible),true);
 await page.locator('#walls-tool').click();assert.equal(await page.evaluate(()=>__sim.walls.visible),false);
 await page.locator('#walls-tool').click();
 const zoom=await page.evaluate(()=>__sim.camera.zoom);await page.locator('#zoom-in').click();assert.ok(await page.evaluate(z=>__sim.camera.zoom>z,zoom));
 await page.locator('#reset-view').click();assert.equal(await page.evaluate(()=>__sim.camera.zoom),1);
 await page.locator('#tab-furniture').click();
 await page.locator('.catalog-card[data-type="plant"]').click();
 assert.equal(await page.evaluate(()=>__sim.selectedType),'plant');
 const point=await page.evaluate(()=>{
   const p=__sim.worldPos('plant',7,3,0).project(__sim.camera),r=document.getElementById('scene').getBoundingClientRect();
   return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
 });
 await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
 assert.equal((await state()).length,17);
 assert.equal(await page.evaluate(()=>__sim.selected.type),'plant');
 assert.equal(await page.evaluate(()=>__sim.selected.gx),7);
 await page.keyboard.press('Delete');assert.equal((await state()).length,16);
 // Exercise real pointer drag against collision rules.
 const drag=await page.evaluate(()=>{
   const it=__sim.items.find(x=>x.type==='sofa'),r=document.getElementById('scene').getBoundingClientRect();
   const a=it.mesh.position.clone();a.y=.65;a.project(__sim.camera);
   const b=__sim.worldPos('sofa',1,1,0).project(__sim.camera);
   return {a:{x:r.x+(a.x+1)*r.width/2,y:r.y+(1-a.y)*r.height/2},b:{x:r.x+(b.x+1)*r.width/2,y:r.y+(1-b.y)*r.height/2}};
 });
 await page.mouse.move(drag.a.x,drag.a.y);await page.mouse.down();await page.mouse.move(drag.b.x,drag.b.y,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>__sim.items.find(x=>x.type==='sofa').gx),1);
 // Invalid saved data must leave the current design intact.
 const beforeInvalid=await state();
 await page.evaluate(()=>localStorage.setItem('home-deco-sim:room','{"items":null}'));
 await page.locator('#load').click();assert.deepEqual(await state(),beforeInvalid);
 await page.locator('#clear').click();assert.equal((await state()).length,0);assert.equal(await page.evaluate(()=>__sim.occupancy.size),0);
 await page.reload();await page.waitForFunction(()=>!!window.__sim);await page.screenshot({path:'output/checks/desktop-final.png'});
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:'output/checks/laptop.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>!!window.__sim);assert.equal(await page.locator('#selection-card').isVisible(),false);await page.screenshot({path:'output/checks/mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#save').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: scene startup, rotation, recoloring, save/load, search, categories, wall/floor finishes, grid/walls, camera, placement, drag, delete, malformed save protection, clear, desktop/mobile layout. No page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});



