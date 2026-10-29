import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {RomModel,applyBps} from '../src/core.js';
import {buildVerifiedBpsDiff} from '../src/bps-export.js';

test('BPS mobile workflow replays staged edits beyond IPS limit and preserves original',()=>{
 const bytes=new Uint8Array(0x1000010);
 const model=new RomModel('test.gba',bytes);
 assert.equal(model.write(0x1000001,0xAB),true);
 assert.equal(model.write(0x1000002,0xCD),true);
 assert.throws(()=>model.exportIps(),/16 MiB/);
 const before=model.base.slice();
 const patch=buildVerifiedBpsDiff(model.base,model.edits);
 const reopened=applyBps(model.base,patch);
 assert.equal(reopened[0x1000001],0xAB);
 assert.equal(reopened[0x1000002],0xCD);
 assert.deepEqual(model.base,before);
 assert.equal(model.edits.size,2);
 assert.ok(patch.length<100);
});

test('BPS mobile workflow refuses unpatched no-op, too many edits and patched base',()=>{
 const model=new RomModel('test.gba',new Uint8Array(1024));
 assert.throws(()=>buildVerifiedBpsDiff(model.base,model.edits),/1–65536/);
 model.write(2,3);
 const before=model.base.slice();
 const patch=buildVerifiedBpsDiff(model.base,model.edits);
 model.switchPatched(applyBps(model.base,patch));
 assert.equal(model.appliedPatch,true);
 assert.deepEqual(model.original,before);
 assert.equal(model.edits.size,0);
 assert.throws(()=>buildVerifiedBpsDiff(new Uint8Array(0xC0),
   Array.from({length:65537},(_,i)=>[i%192,1])),RangeError);
});

test('BPS export is wired into browser, offline HTML and Android blob bridge',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 for(const file of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(file);
  assert.match(html,/id="export-bps"/);
  assert.match(html,/This does not authorize CUBE semantic writes/);
 }
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(app,/import \{buildVerifiedBpsDiff\} from '\.\/bps-export\.js'/);
 assert.match(app,/\$\('export-bps'\)\.addEventListener/);
 assert.match(app,/current\.appliedPatch\)throw Error/);
 assert.match(app,/buildVerifiedBpsDiff\(current\.base,current\.edits\)/);
 assert.match(app,/downloadFile\(\x60\$\{safeName\(current\.name\)\}_mobilelab\.bps\x60,bytes\)/);
 assert.match(offline,/const buildVerifiedBpsDiff=\(\(\)=>\{/);
 assert.match(offline,/\$\('export-bps'\)\.addEventListener/);
 assert.match(read('android/app/src/main/assets/export-bridge.js'),/a\[download\]/);
 const embedded=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(embedded);
 assert.doesNotMatch(embedded[1],/^import \{/m);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+embedded[1]));
});
