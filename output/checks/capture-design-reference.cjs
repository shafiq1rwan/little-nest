const {chromium}=require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  for(const [name,width,height,selected,collapsed] of [
    ['desktop',1440,900,true,false],
    ['phone-browse',390,844,false,false],
    ['phone-selected',390,844,true,false],
    ['phone-room',320,568,false,true],
    ['landscape',844,390,false,false]
  ]) {
   const page=await browser.newPage({viewport:{width,height}});
   await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__sim);
   if(selected&&width<=900)await page.evaluate(()=>__sim.setSelected(__sim.items.find(i=>i.type==='armchair')));
   if(!selected)await page.evaluate(()=>__sim.setSelected(null));
   const isCollapsed=await page.locator('#panel').evaluate(el=>el.classList.contains('collapsed'));
   if(width<=900&&isCollapsed!==collapsed)await page.locator('#panel-toggle').click();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:'docs/design-reference/'+name+'.png'});
   await page.close();
  }
  console.log('Saved five current Little Nest visual baselines.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
