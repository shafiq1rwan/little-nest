const sharp = require('C:/Users/shafiq.irwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 const source='public/icons/little-nest-icon.png';
 for(const size of [32,180,192,512])await sharp(source).resize(size,size).png().toFile('public/icons/little-nest-'+size+'.png');
 console.log('Exported browser, Apple home-screen, and app icons.');
})().catch(e=>{console.error(e);process.exit(1)});
