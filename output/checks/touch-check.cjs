const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__sim);
 await page.locator('#panel-toggle').tap();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const cameraBefore=await page.evaluate(()=>__sim.camera.position.toArray());
 const points=await page.evaluate(()=>{
  const it=__sim.items.find(x=>x.type==='armchair'),r=document.getElementById('scene').getBoundingClientRect();
  const a=it.mesh.position.clone();a.y=.6;a.project(__sim.camera);const b=__sim.worldPos('armchair',5,3,0).project(__sim.camera);
  return {a:{x:r.x+(a.x+1)*r.width/2,y:r.y+(1-a.y)*r.height/2},b:{x:r.x+(b.x+1)*r.width/2,y:r.y+(1-b.y)*r.height/2}};
 });
 const cdp=await context.newCDPSession(page);
 const dispatch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({...p,id:i+1,radiusX:2,radiusY:2,force:1}))});
 await dispatch('touchStart',[points.a]);await dispatch('touchMove',[points.b]);await dispatch('touchEnd',[]);
 assert.equal(await page.evaluate(()=>__sim.items.find(i=>i.type==='armchair').gx),5);
 const cameraAfter=await page.evaluate(()=>__sim.camera.position.toArray());
 cameraBefore.forEach((x,i)=>assert.ok(Math.abs(x-cameraAfter[i])<.001,'Single finger moved camera'));
 assert.equal(await page.locator('#selection-card').isVisible(),true);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const zoom=await page.evaluate(()=>__sim.camera.zoom);
 await dispatch('touchStart',[{x:150,y:250},{x:240,y:250}]);
 await dispatch('touchMove',[{x:120,y:250},{x:270,y:250}]);await dispatch('touchEnd',[]);
 assert.ok(await page.evaluate(z=>__sim.camera.zoom>z,zoom),'Pinch did not zoom');
 // Changing screen size must move the same selection controls into the right surface.
 await page.evaluate(()=>__sim.setSelected(__sim.items.find(i=>i.type==='armchair')));
 await page.setViewportSize({width:1440,height:900});
 assert.equal(await page.locator('#selection-card').evaluate(el=>el.parentElement.id),'viewport');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.getElementById('selection-card').parentElement.id==='panel-content');
 assert.equal(await page.locator('#selection-card').evaluate(el=>el.parentElement.id),'panel-content');
 console.log('PASS: one-finger drag moves furniture without rotating camera; two-finger pinch zooms; selection controls survive responsive resizing.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});








