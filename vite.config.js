import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react(),{name:'local-preview',configureServer(server){server.middlewares.use('/api/state',(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:'preview'}));});}}],build:{outDir:'dist/client'}});
