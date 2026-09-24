import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {exampleProject,floor}=await server.ssrLoadModule('/src/world/examples.ts');
  const {newLevel}=await server.ssrLoadModule('/src/world/level.ts');
  const {solveWater}=await server.ssrLoadModule('/src/world/water.ts');
  const {GameSession}=await server.ssrLoadModule('/src/world/game.ts');
  const project=exampleProject();await mkdir('levels/phase3',{recursive:true});
  for(const level of Object.values(project.levels)){await writeFile(`levels/phase3/${level.id}.json`,JSON.stringify(level,null,2)+'\n');if(level.route){const game=new GameSession(level);for(const command of level.route){if(!game.act(command).accepted)throw new Error(`Route failed: ${level.name}`);}if(game.state.status!=='won')throw new Error(`Not solved: ${level.name}`);}}
  await writeFile('levels/phase3/chapters.json',JSON.stringify(project,null,2)+'\n');
  const measurements=[];
  for(const [name,layers]of [['two-floors',[0,4]],['sixteen-floors',Array.from({length:16},(_,i)=>i*2)],['solid-32-layers',Array.from({length:32},(_,i)=>i)]]){
    const level=newLevel(name,32,32);for(const y of layers)floor(level,y);level.source={x:16,y:layers.at(-1)+1,z:16};level.spawn={x:14,y:layers.at(-1)+1,z:14};solveWater(level);
    const times=[];let water;for(let i=0;i<12;i++){const start=performance.now();water=solveWater(level);times.push(performance.now()-start);}times.sort((a,b)=>a-b);
    measurements.push({name,objects:level.objects.length,airLayers:water.cells.length,medianMs:times[6],maxMs:Math.max(...times),samplesMs:times});
  }
  await writeFile('docs/phase3-core-performance.json',JSON.stringify({node:process.version,date:new Date().toISOString(),measurements},null,2)+'\n');
  console.log('Exported 12 levels, chapter project, verified routes and solver benchmarks.');
} finally {await server.close();}
