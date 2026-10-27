import test from 'node:test';
import assert from 'node:assert/strict';
import {auditVanillaMapEventScripts as audit} from '../src/vanilla-map-script-audit.js';
const ptr=n=>0x08000000+n;
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(i*8)&255;}
function fixture(){
 const r=new Uint8Array(0x1000).fill(0xff);
 d(r,0x200,ptr(0x300));d(r,0x204,ptr(0x500));
 d(r,0x208,0);d(r,0x20c,0);
 d(r,0x300,2);d(r,0x304,2);
 for(const [o,p] of [[8,0x480],[12,0x400],[16,0x800],[20,0x900]])
  d(r,0x300+o,ptr(p));
 r[0x500]=1;r[0x501]=0;r[0x502]=1;r[0x503]=0;
 d(r,0x504,ptr(0x600));d(r,0x508,0);d(r,0x50c,ptr(0x640));d(r,0x510,0);
 d(r,0x610,ptr(0x700));d(r,0x64c,ptr(0x710));
 r.set([0x16,0,0x40,1,0,0x02],0x700);
 r.set([0x04,0x10,0x07,0,0x08,0x02],0x710);
 return r;
}
test('audits two independently selected vanilla event script prefixes without executing',()=>{
 const r=fixture(),before=r.slice();
 const a=audit(r,{address:0x200,family:'RSE'});
 assert.equal(a.totalRecords,2);
 assert.equal(a.counts.inRom,2);
 assert.equal(a.counts.decoded,2);
 assert.equal(a.counts.terminal,2);
 assert.deepEqual(a.records.map(x=>x.preview.firstCommand),['setvar','call']);
 assert.equal(a.records[1].preview.branchCount,1);
 assert.equal(a.records[1].preview.branchStatuses.commandStart,1);
 assert.equal(a.records[0].pointerSourceOffset,0x610);
 assert.equal(a.records[1].pointerSourceOffset,0x64c);
 assert.equal(a.independentParityEvidence,false);
 assert.equal(a.controlFlowFollowed,false);
 assert.ok(Object.isFrozen(a.records[0].preview));
 assert.deepEqual(r,before);
});
test('bounded records preserve totals and disclose truncation',()=>{
 const a=audit(fixture(),{address:0x200,family:'FRLG',maxRecords:1});
 assert.equal(a.inspectedRecords,1);
 assert.equal(a.totalRecords,2);
 assert.equal(a.truncated,true);
});
test('null, non-ROM and unknown command pointers remain untrusted',()=>{
 const r=fixture();d(r,0x610,0);d(r,0x64c,ptr(0x720));r[0x720]=0xff;
 const a=audit(r,{address:0x200,family:'RSE'});
 assert.equal(a.counts.null,1);
 assert.equal(a.counts.unknownOpcode,1);
 assert.equal(a.counts.decoded,0);
 assert.equal(a.records[0].preview,null);
 assert.equal(a.records[1].preview.stopReason,'unknown-opcode');
});
test('rejects malformed record budgets, grammar and event structure',()=>{
 const r=fixture();
 assert.throws(()=>audit(r,{address:0x200,family:'RSE',maxRecords:0}),RangeError);
 assert.throws(()=>audit(r,{address:0x200,family:'RSE',maxRecords:65}),RangeError);
 assert.throws(()=>audit(r,{address:0x200,family:'CUBE'}),RangeError);
 d(r,0x504,0);
 assert.throws(()=>audit(r,{address:0x200,family:'RSE'}),RangeError);
});
