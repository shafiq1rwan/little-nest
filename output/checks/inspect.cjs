const { chromium } = require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__sim);
 await page.screenshot({path:'output/checks/desktop-initial.png'});
 console.log(JSON.stringify(await page.evaluate(()=>({count:__sim.items.length,selected:__sim.selected.type,occupancy:__sim.occupancy.size,canvas:{w:document.getElementById('scene').clientWidth,h:document.getElementById('scene').clientHeight},images:[...document.querySelectorAll('.catalog-card img')].every(i=>i.complete&&i.naturalWidth>0)}))));
 await browser.close();console.log('Page errors:',errors);
})().catch(e=>{console.error(e);process.exit(1)});

