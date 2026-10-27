import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaAtlasScriptAliases as audit} from '../src/vanilla-script-aliases.js';
const ptr=n=>0x08000000+n;
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(8*i)&255;}
function fixture(){
 const r=new Uint8Array(0x1000).fill(0xff);
 d(r,0x100,ptr(0x140));d(r,0x140,ptr(0x200));d(r,0x144,ptr(0x240));
 for(let i=0;i<2;i++){
  const header=0x200+i*0x40,layout=0x300+i*0x40;
  const events=0x500+i*0x20,object=0x600+i*0x20;
  d(r,header,ptr(layout));d(r,header+4,ptr(events));
  d(r,header+8,0);d(r,header+12,0);
  d(r,layout,2);d(r,layout+4,2);
  for(const [o,p] of [[8,0x480],[12,0x400+i*0x20],[16,0x800],[20,0x900]])
   d(r,layout+o,ptr(p));
  r[events]=1;r[events+1]=0;r[events+2]=0;r[events+3]=0;
  d(r,events+4,ptr(object));d(r,events+8,0);
  d(r,events+12,0);d(r,events+16,0);
  d(r,object+16,ptr(0x700));
 }
 const atlas=inspectVanillaMapAtlas(r,{
  address:0x100,bankMapCounts:[2],family:'RSE'});
 return {r,atlas};
}
test('reports shared script pointer targets across separately owned vanilla events',()=>{
 const {r,atlas}=fixture(),before=r.slice();
 const result=audit(r,atlas);
 assert.equal(result.mapsInspected,2);
 assert.equal(result.pointerFields,2);
 assert.equal(result.inRomPointers,2);
 assert.equal(result.totalGroups,1);
 assert.equal(result.groups[0].targetOffset,0x700);
 assert.deepEqual(result.groups[0].references.map(x=>x.pointerSourceOffset),
  [0x610,0x630]);
 assert.deepEqual(result.groups[0].references.map(x=>x.mapIndex),[0,1]);
 assert.equal(result.ownershipAuthenticated,false);
 assert.equal(result.writeAuthorized,false);
 assert.ok(Object.isFrozen(result.groups[0].references));
 assert.deepEqual(r,before);
});
test('paged scan does not claim aliases outside its bounded page',()=>{
 const {r,atlas}=fixture();
 const first=audit(r,atlas,{startMap:0,maxMaps:1});
 const second=audit(r,atlas,{startMap:1,maxMaps:1});
 assert.equal(first.totalGroups,0);
 assert.equal(first.nextStartMap,1);
 assert.equal(second.totalGroups,0);
 assert.equal(second.nextStartMap,null);
});
test('stale pointer or layout and invalid budgets fail closed',()=>{
 const {r,atlas}=fixture();
 assert.throws(()=>audit(r,atlas,{startMap:2}),RangeError);
 assert.throws(()=>audit(r,atlas,{maxMaps:33}),RangeError);
 assert.throws(()=>audit(r,atlas,{maxReferences:0}),RangeError);
 d(r,0x144,ptr(0x260));
 assert.throws(()=>audit(r,atlas),RangeError);
});
