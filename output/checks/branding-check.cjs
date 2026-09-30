const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__sim);
 assert.equal(await page.title(),'Little Nest');
 assert.equal(await page.getByRole('heading',{name:'Little Nest',exact:true}).count(),1);
 assert.ok(await page.locator('.brand-icon').evaluate(i=>i.complete&&i.naturalWidth===192));
 for(const size of [32,180,192,512]){const response=await page.request.get('http://localhost:5173/icons/little-nest-'+size+'.png');assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/png/);}
 const manifest=await (await page.request.get('http://localhost:5173/manifest.webmanifest')).json();assert.equal(manifest.name,'Little Nest');
 await page.screenshot({path:'output/checks/little-nest-desktop.png'});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  await page.waitForFunction(()=>document.getElementById('selection-card').parentElement.id==='panel-content');
  if(await page.locator('#deselect').isVisible())await page.locator('#deselect').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const icon=await page.locator('.brand-icon').boundingBox(),name=await page.locator('h1').boundingBox(),load=await page.locator('#load').boundingBox();
  assert.ok(icon.x>=0&&name.x+name.width<=load.x);
  await page.screenshot({path:'output/checks/little-nest-phone-'+width+'.png'});
 }
 assert.deepEqual(errors,[]);console.log('PASS: Little Nest title/header, all icon exports, manifest, desktop and phone branding; no browser errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

