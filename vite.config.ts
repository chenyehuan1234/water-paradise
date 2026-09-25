import { defineConfig, type Plugin } from 'vite';

// Probe only the transfer page's static marker. A foreign 4175 app must never be
// loaded in an iframe just to discover that it cannot export local storage.
function migrationProbe(): Plugin {
  const handler = async (_req: unknown, res: { setHeader: (key:string,value:string)=>void; end:(body:string)=>void }) => {
    let available = false;
    try { const response = await fetch('http://127.0.0.1:4175/transfer.html',{signal:AbortSignal.timeout(900)});
      available = response.ok && (await response.text()).includes('name="water-paradise-transfer" content="v1"');
    } catch { /* The old address is optional. */ }
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({available}));
  };
  return {name:'water-paradise-local-migration-probe',configureServer(server){server.middlewares.use('/__old-transfer-probe',handler);},configurePreviewServer(server){server.middlewares.use('/__old-transfer-probe',handler);}};
}

export default defineConfig({
  base: './',
  plugins:[migrationProbe()],
  build: { target: 'es2022', rolldownOptions: { input: { main: 'index.html' }, output: { inlineDynamicImports: true } } },
});
