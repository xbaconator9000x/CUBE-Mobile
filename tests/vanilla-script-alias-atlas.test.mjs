import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaAtlasWideScriptAliases as audit} from '../src/vanilla-script-alias-atlas.js';
const ptr=n=>0x08000000+n;
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=(n>>>(8*i))&255;}
function fixture(count=130){
 const rom=new Uint8Array(0x20000).fill(0xff);
 d(rom,0x100,ptr(0x400));
 for(let i=0;i<count;i++){
  const header=0x1000+i*0x40,layout=0x4000+i*0x20;
  const events=0x6000+i*0x20,object=0x8000+i*0x20;
  d(rom,0x400+i*4,ptr(header));
  d(rom,header,ptr(layout));d(rom,header+4,ptr(events));
  d(rom,header+8,0);d(rom,header+12,0);
  d(rom,layout,2);d(rom,layout+4,2);
  d(rom,layout+8,ptr(0xb000));d(rom,layout+12,ptr(0xa000));
  d(rom,layout+16,ptr(0xc000));d(rom,layout+20,ptr(0xd000));
  rom[events]=1;rom[events+1]=0;rom[events+2]=0;rom[events+3]=0;
  d(rom,events+4,ptr(object));d(rom,events+8,0);
  d(rom,events+12,0);d(rom,events+16,0);
  d(rom,object+16,ptr(i===0||i===count-1?0x12000:0x13000+i*4));
 }
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[count],family:'RSE'
 });
 return {rom,atlas};
}
test('finds aliases separated by multiple 64-map windows, without writing bytes',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const result=audit(rom,atlas);
 assert.equal(result.mapsInspected,130);
 assert.equal(result.pointerFields,130);
 assert.equal(result.distinctTargets,129);
 assert.equal(result.totalGroups,1);
 assert.equal(result.groups[0].targetOffset,0x12000);
 assert.equal(result.groups[0].referenceCount,2);
 assert.equal(result.groups[0].crossesSixtyFourMapWindow,true);
 assert.deepEqual(result.groups[0].references.map(r=>r.mapIndex),[0,129]);
 assert.equal(result.wholeDeclaredAtlas,true);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.independentParityEvidence,false);
 assert.ok(Object.isFrozen(result.groups[0].references));
 assert.deepEqual(rom,before);
});
test('caps and stale map pointers fail closed rather than claiming full coverage',()=>{
 const {rom,atlas}=fixture();
 assert.throws(()=>audit(rom,atlas,{maxMaps:129}),/no partial result/);
 assert.throws(()=>audit(rom,atlas,{maxPointerFields:129}),/budget/);
 assert.throws(()=>audit(rom,atlas,{maxReferences:33}),RangeError);
 assert.equal(audit({length:rom.length,read:i=>rom[i]},atlas).totalGroups,1);
 d(rom,0x400+129*4,ptr(0x1040));
 assert.throws(()=>audit(rom,atlas),/pointer changed/);
});
test('reports truncated reference display without truncating counts',()=>{
 const {rom,atlas}=fixture(3);
 d(rom,0x8000+0x20+16,ptr(0x12000));
 const result=audit(rom,atlas,{maxReferences:1});
 assert.equal(result.totalGroups,1);
 assert.equal(result.groups[0].referenceCount,3);
 assert.equal(result.groups[0].references.length,1);
 assert.equal(result.groups[0].referencesTruncated,true);
});
