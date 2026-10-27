import test from 'node:test';
import assert from 'node:assert/strict';
import {auditVanillaScriptOperandPointers as audit} from '../src/vanilla-script-operand-pointers.js';
const ptr=n=>[n,0,0,0x08];
function fixture(){
 const r=new Uint8Array(128).fill(0xff);
 r.set([0x0f,0,...ptr(80),
  0x4f,0xff,0,...ptr(88),
  0x67,...ptr(96),
  0x04,...ptr(112),0x02],0);
 return r;
}
test('classifies source-grounded pointer roles without following targets',()=>{
 const rom=fixture(),before=rom.slice();
 const a=audit(rom,{address:0,family:'FRLG'});
 assert.equal(a.total,4);
 assert.deepEqual(a.findings.map(f=>[f.role,f.pointerSourceOffset,f.targetOffset]),[
  ['generic-data',2,80],['movement-data',9,88],
  ['message-text',14,96],['script-branch',19,112]
 ]);
 assert.equal(a.statuses.inRom,4);
 assert.equal(a.roles.movementData,1);
 assert.equal(a.stopReason,'terminal');
 assert.equal(a.targetFormatVerified,false);
 assert.equal(a.writeAuthorized,false);
 assert.ok(Object.isFrozen(a.findings[0]));
 assert.deepEqual(rom,before);
});
test('caps returned pointers but preserves totals and all counts',()=>{
 const a=audit(fixture(),{address:0,family:'RSE',maxFindings:2});
 assert.equal(a.total,4);
 assert.equal(a.findings.length,2);
 assert.equal(a.truncated,true);
 assert.equal(a.statuses.inRom,4);
});
test('null, outside ROM and non-ROM pointers retain distinct statuses',()=>{
 const rom=fixture();
 rom.set([0,0,0,0],2);
 rom.set([0xff,0xff,0xff,0x08],9);
 rom.set([1,0,0,0x02],14);
 const a=audit(rom,{address:0,family:'FRLG'});
 assert.equal(a.statuses.null,1);
 assert.equal(a.statuses.outsideRom,1);
 assert.equal(a.statuses.nonRom,1);
 assert.equal(a.statuses.inRom,1);
});
test('rejects malformed finding limits and unsupported families',()=>{
 for(const opts of [{maxFindings:0},{maxFindings:65},{family:'CUBE'}])
  assert.throws(()=>audit(fixture(),{address:0,family:'FRLG',...opts}),RangeError);
});
