import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'queue/development.json';
const q=JSON.parse(readFileSync(file,'utf8'));
export function reconcile(q){
 if(q.schema!=='cube-mobile-queue/1'||!Array.isArray(q.tasks))throw Error('Unsupported queue');
 const ids=new Set(),map=new Map();
 for(const t of q.tasks){if(ids.has(t.id)||!['done','pending','blocked','in_progress','failed'].includes(t.status)||!Array.isArray(t.paths)||!Array.isArray(t.dependsOn)||!Number.isFinite(t.effortHours)||t.effortHours<=0)throw Error('Invalid task '+t.id);ids.add(t.id);map.set(t.id,t)}
 for(const t of q.tasks)for(const d of t.dependsOn)if(!map.has(d)||d===t.id)throw Error('Invalid dependency '+d);
 const visiting=new Set(),visited=new Set();
 function visit(id){if(visiting.has(id))throw Error('Dependency cycle');if(visited.has(id))return;visiting.add(id);for(const d of map.get(id).dependsOn)visit(d);visiting.delete(id);visited.add(id)}
 for(const id of ids)visit(id);
 for(const t of q.tasks)if(t.status==='done'&&t.dependsOn.some(d=>map.get(d).status!=='done'))throw Error('Premature completion '+t.id);
 const eligible=q.tasks.filter(t=>t.status==='pending'&&t.dependsOn.every(d=>map.get(d).status==='done')).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 const selected=[];const occupied=new Set(q.tasks.filter(t=>t.status==='in_progress').flatMap(t=>t.paths));
 for(const t of eligible){if(t.paths.some(p=>occupied.has(p)))continue;selected.push(t);for(const p of t.paths)occupied.add(p)}
 const total=q.tasks.reduce((s,t)=>s+t.effortHours,0),done=q.tasks.filter(t=>t.status==='done').reduce((s,t)=>s+t.effortHours,0);
 return {eligible:eligible.map(t=>t.id),parallelBatch:selected.map(t=>t.id),blocked:q.tasks.filter(t=>t.status==='blocked').map(t=>t.id),inProgress:q.tasks.filter(t=>t.status==='in_progress').map(t=>t.id),estimatedHoursRemaining:total-done,queueTaskHoursTotal:total,queueTaskHoursDone:done,queueCompletionPercent:Number((100*done/total).toFixed(1)),note:'Queue-only hours and completion are planning estimates; NOT total project completion or independently verified parity.'}
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){const report=reconcile(q);console.log(JSON.stringify(report,null,2));if(process.argv.includes('--output'))writeFileSync('queue/next-batch.json',JSON.stringify(report,null,2)+'\n')}
