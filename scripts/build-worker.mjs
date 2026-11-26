import fs from 'node:fs/promises';
import path from 'node:path';
const assets={},types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else assets['/'+path.relative('dist/client',p)]={type:types[path.extname(p)]||'application/octet-stream',body:(await fs.readFile(p)).toString('base64')};}}
await walk('dist/client');
const model=(await fs.readFile('src/model.js','utf8')).replace(/export /g,'');
const server=(await fs.readFile('src/server.js','utf8')).replace(/import .*?;\n/,'').replace('export function','function');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await fs.writeFile('dist/server/index.js',model+'\n'+server+'\nexport default createHandler('+JSON.stringify(assets)+');\n');
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await fs.cp('drizzle','dist/drizzle',{recursive:true});
console.log('Built Worker with '+Object.keys(assets).length+' embedded assets and D1 migrations.');
