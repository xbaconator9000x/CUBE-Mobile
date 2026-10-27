import test from 'node:test';
import assert from 'node:assert/strict';
import {auditVanillaScriptBranchTargets as audit} from '../src/vanilla-script-branches.js';
test('reports command-start and mid-command branch targets without following them',()=>{
 const rom=new Uint8Array(128);
 rom.set([0x04,5,0,0,8,0x06,1,2,0,0,8,0x02],0);
 const result=audit(rom,{address:0,family:'RSE'});
 assert.equal(result.total,2);
 assert.deepEqual(result.findings.map(f=>f.status),
  ['command-start','inside-command']);
 assert.deepEqual(result.findings.map(f=>f.pointerSourceOffset),[1,7]);
 assert.equal(result.counts.commandStart,1);
 assert.equal(result.counts.insideCommand,1);
 assert.equal(result.stopReason,'terminal');
 assert.equal(result.controlFlowFollowed,false);
 assert.equal(result.writeAuthorized,false);
 assert.ok(Object.isFrozen(result.findings));
});
test('outside-prefix pointers are hints, not claimed script destinations',()=>{
 const rom=new Uint8Array(128);
 rom.set([0x04,40,0,0,8,0x02],0);
 const result=audit(rom,{address:0,family:'FRLG'});
 assert.equal(result.findings[0].status,'outside-prefix');
 assert.equal(result.findings[0].targetOffset,40);
 assert.equal(result.findings[0].targetIsKnownCommand,false);
});
test('classifies null, non-ROM and out-of-ROM targets',()=>{
 for(const [bytes,status] of [
  [[0,0,0,0],'null'],
  [[0,0,0,2],'non-rom'],
  [[0,1,0,8],'outside-rom']
 ]){
  const rom=new Uint8Array(64);
  rom.set([0x05,...bytes],0);
  assert.equal(audit(rom,{address:0,family:'RSE'}).findings[0].status,status);
 }
});
test('branch limit preserves full counts and bounds output',()=>{
 const rom=new Uint8Array(100);
 for(let i=0;i<25;i+=5)rom.set([0x04,0,0,0,0],i);
 rom[25]=0x02;
 const result=audit(rom,{address:0,family:'RSE',maxFindings:2});
 assert.equal(result.total,5);
 assert.equal(result.findings.length,2);
 assert.equal(result.truncated,true);
 assert.equal(result.counts.null,5);
});
test('rejects invalid budgets and bad script source',()=>{
 const rom=new Uint8Array(16);
 assert.throws(()=>audit(rom,{address:0,family:'RSE',maxFindings:0}),RangeError);
 assert.throws(()=>audit(rom,{address:0,family:'RSE',maxFindings:65}),RangeError);
 assert.throws(()=>audit(rom,{address:16,family:'RSE'}),RangeError);
 assert.throws(()=>audit(rom,{address:0,family:'CUBE'}),RangeError);
});
