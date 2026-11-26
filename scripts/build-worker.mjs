import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const assets={},types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
// The deployable Worker serves an embedded copy of Vite's client output.
// esbuild resolves server imports so new modules stay in the deployable bundle.
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else assets['/'+path.relative('dist/client',p)]={type:types[path.extname(p)]||'application/octet-stream',body:(await fs.readFile(p)).toString('base64')};}}
await walk('dist/client');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await build({stdin:{contents:'import {createHandler} from "./src/server.js"; export default createHandler('+JSON.stringify(assets)+');',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js'});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
// Copy schema-only migration files; do not seed or modify live records here.
await fs.cp('drizzle','dist/drizzle',{recursive:true});
console.log('Built Worker with '+Object.keys(assets).length+' embedded assets and D1 migrations.');
