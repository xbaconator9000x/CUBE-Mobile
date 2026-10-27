import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaAtlasScriptOperandAliases as audit}
 from '../src/vanilla-script-operand-alias-atlas.js';

const ptr=n=>0x08000000+n;
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=(n>>>(8*i))&255;}
function fixture(){
 const rom=new Uint8Array(0x2000).fill(0xff);
 d(rom,0x100,ptr(0x140));
 for(let i=0;i<2;i++){
  const header=0x200+i*0x40,layout=0x300+i*0x40,
   events=0x700+i*0x20,object=0x740+i*0x20,script=0x900+i*0x20;
  d(rom,0x140+i*4,ptr(header));
  d(rom,header,ptr(layout));d(rom,header+4,ptr(events));
  for(const o of [8,12])d(rom,header+o,0);
  d(rom,layout,2);d(rom,layout+4,2);
  for(const [o,target] of [[8,0x500],[12,0x400],[16,0x600],[20,0x620]])
   d(rom,layout+o,ptr(target));
  rom[events]=1;rom[events+1]=0;rom[events+2]=0;rom[events+3]=0;
  d(rom,events+4,ptr(object));
  for(const o of [8,12,16])d(rom,events+o,0);
  d(rom,object+16,ptr(script));
  rom[script]=0x67;d(rom,script+1,ptr(0xa00));rom[script+5]=0x02;
 }
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2],family:'RSE'
 });
 return {rom,atlas};
}
test('finds two independent message pointer fields sharing one target',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const result=audit(rom,atlas);
 assert.equal(result.mapsInspected,2);
 assert.equal(result.eventScriptReferences,2);
 assert.equal(result.distinctEventScripts,2);
 assert.equal(result.decodedScripts,2);
 assert.equal(result.operandFields,2);
 assert.equal(result.inRomOperandFields,2);
 assert.equal(result.totalGroups,1);
 assert.equal(result.groups[0].targetOffset,0xa00);
 assert.equal(result.groups[0].sourceCount,2);
 assert.deepEqual(result.groups[0].references.map(r=>r.pointerSourceOffset),
  [0x901,0x921]);
 assert.deepEqual(result.groups[0].references.map(r=>r.role),
  ['message-text','message-text']);
 assert.equal(result.controlFlowFollowed,false);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.independentParityEvidence,false);
 assert.ok(Object.isFrozen(result.groups[0].references));
 assert.deepEqual(rom,before);
});
test('shared script root is not falsely counted as two operand sources',()=>{
 const {rom}=fixture();d(rom,0x770,ptr(0x900));
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2],family:'RSE'
 });
 const result=audit(rom,atlas);
 assert.equal(result.eventScriptReferences,2);
 assert.equal(result.distinctEventScripts,1);
 assert.equal(result.operandFields,1);
 assert.equal(result.totalGroups,0);
});
test('limits and stale provenance fail closed without partial results',()=>{
 const {rom,atlas}=fixture();
 assert.throws(()=>audit(rom,atlas,{maxScripts:1}),/no partial result/);
 assert.throws(()=>audit(rom,atlas,{maxOperandFields:1}),/no partial result/);
 assert.throws(()=>audit(rom,atlas,{maxGroups:0}),RangeError);
 assert.throws(()=>audit(rom,atlas,{maxCommands:17}),RangeError);
 assert.equal(audit({length:rom.length,read:i=>rom[i]},atlas).totalGroups,1);
 d(rom,0x144,ptr(0x200));
 assert.throws(()=>audit(rom,atlas),/pointer changed/);
});
test('invalid or unknown command pointers are not asserted as shared targets',()=>{
 const {rom,atlas}=fixture();
 d(rom,0x921,0); // null message pointer in second script
 const result=audit(rom,atlas);
 assert.equal(result.operandFields,2);
 assert.equal(result.inRomOperandFields,1);
 assert.equal(result.totalGroups,0);
 rom[0x920]=0xff; // unknown command, no operand decoding
 const after=audit(rom,atlas);
 assert.equal(after.operandFields,1);
 assert.equal(after.totalGroups,0);
});
