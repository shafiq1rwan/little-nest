const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),errors=[];
 for(const [width,height] of [[390,844],[320,568],[768,1024],[844,390],[568,320],[1440,900]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<700});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__sim);
  const compact=width<=900||height<=600;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const id of ['save','load','help-toggle','grid-tool','walls-tool','zoom-in']){
   const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+.5&&b.y>=0&&b.y+b.height<=height+.5,id+' offscreen '+width);
   if(compact)assert.ok(b.width>=44&&b.height>=44,id+' too small');
  }
  if(compact) {
   const selected=page.locator('#selection-card');assert.equal(await selected.isVisible(),false);
   if(await page.locator('#panel').evaluate(el=>el.classList.contains('collapsed')))await page.locator('#panel-toggle').tap();
   assert.equal(await page.locator('#tab-furniture').isVisible(),true);
   // A single row of cards can be swiped; side drawers use two columns.
   const landscape=width>height;
   if(!landscape)assert.ok(await page.locator('#catalog').evaluate(el=>el.scrollWidth>el.clientWidth));
   const before=await page.locator('#scene').boundingBox();
   await page.locator('#panel-toggle').tap();
   const after=await page.locator('#scene').boundingBox();
   assert.ok(landscape?after.width>before.width:after.height>before.height);
   await page.screenshot({path:'output/checks/hud-'+width+'x'+height+'-room.png'});
   await page.locator('#panel-toggle').tap();
   await page.locator('.catalog-card[data-type="armchair"]').tap();
   assert.equal(await page.locator('#panel').evaluate(el=>el.classList.contains('collapsed')),true);
   assert.equal(await page.evaluate(()=>__sim.selectedType),'armchair');
   const point=await page.evaluate(()=>{
    const p=__sim.worldPos('armchair',7,3,0).project(__sim.camera),r=document.getElementById('scene').getBoundingClientRect();
    return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
   });
   await page.touchscreen.tap(point.x,point.y);
   assert.equal(await page.evaluate(()=>__sim.selected.type),'armchair');
   assert.equal(await page.locator('#selection-card').evaluate(el=>el.parentElement.id),'panel-content');
   const sceneBounds=await page.locator('#scene').boundingBox(),cardBounds=await selected.boundingBox();
   assert.ok(landscape?cardBounds.x>=sceneBounds.x+sceneBounds.width-.5:cardBounds.y>=sceneBounds.y+sceneBounds.height-.5,'Selection overlaps room');
   await page.locator('#rotate-selected').tap();assert.equal(await page.evaluate(()=>__sim.selected.rot),1);
   await page.getByRole('button',{name:'Sage',exact:true}).tap();
   await page.screenshot({path:'output/checks/hud-'+width+'x'+height+'-selected.png'});
   await page.locator('#move-selected').tap();assert.equal(await page.locator('#panel').evaluate(el=>el.classList.contains('collapsed')),true);
   await page.locator('#panel-toggle').tap();await page.locator('#deselect').tap();
   assert.equal(await page.locator('#tab-furniture').isVisible(),true);
   await page.locator('#tab-walls').tap();await page.getByRole('button',{name:'Clay',exact:true}).tap();
   await page.locator('#tab-furniture').tap();await page.locator('#search').fill('plant');assert.equal(await page.locator('.catalog-card:visible').count(),5);
   await page.screenshot({path:'output/checks/hud-'+width+'x'+height+'-browse.png'});
   await page.locator('#save').tap();
  } else {
   assert.equal(await page.locator('#panel-toggle').isVisible(),false);
   assert.equal(await page.locator('#selection-card').evaluate(el=>el.parentElement.id),'viewport');
   await page.screenshot({path:'output/checks/hud-desktop.png'});
  }
  console.log('PASS '+width+'x'+height);
  await context.close();
 }
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: responsive HUD, touch targets, expanded/collapsed panels, touch placement, selection dock, rotation/color, finishes, search and desktop layout. No browser errors.');
})().catch(e=>{console.error(e);process.exit(1)});
