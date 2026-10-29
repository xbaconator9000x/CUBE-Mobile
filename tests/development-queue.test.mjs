import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {reconcile} from '../scripts/development-queue.mjs';
const q=JSON.parse(readFileSync(new URL('../queue/development.json',import.meta.url)));
test('queue has valid dependencies and deterministic eligible batch',()=>{const r=reconcile(q);assert.ok(r.parallelBatch.length>0);assert.ok(r.blocked.includes('Q003'));assert.ok(r.queueTaskHoursTotal>r.queueTaskHoursDone)});
test('detects dependency cycles',()=>{const c=structuredClone(q);c.tasks.find(t=>t.id==='Q001').dependsOn=['Q004'];assert.throws(()=>reconcile(c),/cycle|Premature/)});
test('never schedules overlapping paths',()=>{const c=structuredClone(q);c.tasks.push({id:'Q999',title:'duplicate',priority:1,dependsOn:[],paths:['.github/workflows/android-build.yml'],status:'pending',effortHours:1});const s=reconcile(c).parallelBatch;assert.ok(!(s.includes('Q012')&&s.includes('Q999')))});
test('blocks tasks until prerequisites complete',()=>{const s=reconcile(q).parallelBatch;assert.ok(!s.includes('Q004'));assert.ok(!s.includes('Q013'))});
