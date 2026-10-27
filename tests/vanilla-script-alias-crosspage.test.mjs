import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaScriptAliasesAcrossPages as audit} from '../src/vanilla-script-alias-crosspage.js';
const ptr=n=>0x08000000+n;
function d(rom,offset,value){for(let i=0;i<4;i++)rom[offset+i]=(value>>>(8*i))&255;}
function fixture(){
 const rom=new Uint8Array(0x5000).fill(0xff);
 d(rom,0x100,ptr(0x140));d(rom,0x140,ptr(0x200));
 for(let i=0;i<17;i++){
  const header=0x400+i*0x40,layout=0x900+i*0x20;
  const events=0xc00+i*0x20,object=0xf00+i*0x20;
  d(rom,0x200+i*4,ptr(header));
  d(rom,header,ptr(layout));d(rom,header+4,ptr(events));
  d(rom,header+8,0);d(rom,header+12,0);
  d(rom,layout,2);d(rom,layout+4,2);
  d(rom,layout+8,ptr(0x1800));d(rom,layout+12,ptr(0x1600+i*0x10));
  d(rom,layout+16,ptr(0x2000));d(rom,layout+20,ptr(0x2100));
  rom[events]=1;rom[events+1]=0;rom[events+2]=0;rom[events+3]=0;
  d(rom,events+4,ptr(object));d(rom,events+8,0);
  d(rom,events+12,0);d(rom,events+16,0);
  d(rom,object+16,ptr(i>=15?0x3000:0x3100+i*0x10));
 }
 return {rom,atlas:inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[17],family:'RSE'
 })};
}
test('cross-page audit finds shared script pointers spanning maps 15 and 16',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const result=audit(rom,atlas,{maxMaps:17});
 assert.equal(result.mapsInspected,17);
 assert.equal(result.pointerFields,17);
 assert.equal(result.inRomPointers,17);
 assert.equal(result.totalGroups,1);
 const group=result.groups[0];
 assert.equal(group.targetOffset,0x3000);
 assert.equal(group.referenceCount,2);
 assert.equal(group.crossesSixteenMapPage,true);
 assert.deepEqual(group.references.map(x=>x.mapIndex),[15,16]);
 assert.deepEqual(group.references.map(x=>x.pointerSourceOffset),[
  0xf00+15*0x20+16,0xf00+16*0x20+16
 ]);
 assert.equal(result.nextStartMap,null);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.independentParityEvidence,false);
 assert.ok(Object.isFrozen(group.references));
 assert.deepEqual(rom,before);
});
test('single 16-map pages cannot claim cross-page aliases',()=>{
 const {rom,atlas}=fixture();
 const first=audit(rom,atlas,{maxMaps:16});
 const last=audit(rom,atlas,{startMap:16,maxMaps:1});
 assert.equal(first.totalGroups,0);
 assert.equal(first.nextStartMap,16);
 assert.equal(last.totalGroups,0);
 assert.equal(last.nextStartMap,null);
});
test('bounded caps, stale pointer and staged read accessor fail safely',()=>{
 const {rom,atlas}=fixture();
 assert.throws(()=>audit(rom,atlas,{maxMaps:17,maxPointerFields:16}),/budget/);
 assert.throws(()=>audit(rom,atlas,{maxMaps:257}),RangeError);
 const accessor={length:rom.length,read:i=>rom[i]};
 assert.equal(audit(accessor,atlas,{maxMaps:17}).totalGroups,1);
 d(rom,0x200+16*4,ptr(0x500));
 assert.throws(()=>audit(rom,atlas,{maxMaps:17}),/pointer changed/);
});
