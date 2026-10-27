import test from 'node:test';
import assert from 'node:assert/strict';
import {auditVanillaAtlasIncomingLinks as incoming} from '../src/map-link-audit.js';

const ptr=n=>0x08000000+n;
const u32=(b,o,n)=>{for(let i=0;i<4;i++)b[o+i]=(n>>>(8*i))&255;};
function fixture(){
 const rom=new Uint8Array(0x1600).fill(0xff);
 const maps=[];
 for(let i=0;i<3;i++){
  const header=0x100+i*0x300,layout=header+0x40,block=header+0x100;
  const events=header+0x200,warps=events+0x40,connections=events+0x60;
  const pointerSource=0x40+i*4;
  u32(rom,pointerSource,ptr(header));
  u32(rom,header,ptr(layout));u32(rom,header+4,ptr(events));
  u32(rom,header+8,0);u32(rom,header+12,i===0?ptr(connections):0);
  u32(rom,layout,2);u32(rom,layout+4,2);
  for(const [at,to] of [[8,0x1200],[12,block],[16,0x1220],[20,0x1240]])
   u32(rom,layout+at,ptr(to));
  rom.set([0,1,0,0],events);u32(rom,events+8,ptr(warps));
  rom.set([0,0,0,i===2?255:i===1?2:0,1,0],warps+2);
  // Explicit 8-byte warp: x=0,y=0,elevation=0,warpID,map,bank
  rom.set([0,0,0,0,0,i===2?255:i===1?2:0,1,0],warps);
  if(i===0){
   u32(rom,connections,1);u32(rom,connections+4,ptr(connections+0x20));
   u32(rom,connections+0x20,1);u32(rom,connections+0x24,0);
   rom[connections+0x28]=0;rom[connections+0x29]=1;
  }
  maps.push({bankIndex:0,mapIndex:i,mapPointerSource:pointerSource,
   mapHeaderOffset:header,layoutOffset:layout,blockmapOffset:block,width:2,height:2});
 }
 return {rom,atlas:{family:'RSE',readOnly:true,layoutAuthenticated:false,maps}};
}
const options={bankIndex:0,mapIndex:1};
test('incoming references are paged with exact offsets and raw index classifications',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const first=incoming(rom,atlas,{...options,start:0,limit:2});
 assert.deepEqual(first.counts,{warps:2,connections:1,validIndex:1,specialIndex:0,invalidIndex:1});
 assert.equal(first.nextStart,2);
 assert.deepEqual(first.records.map(r=>[r.sourceMap,r.kind,r.status]),
  [[0,'warp','valid-index'],[0,'connection','declared'],[1,'warp','invalid-index']]);
 assert.equal(first.records[0].recordOffset,0x340);
 assert.equal(first.records[1].recordOffset,0x380);
 assert.equal(first.targetWarpCount,1);
 const last=incoming(rom,atlas,{...options,start:2,limit:1});
 assert.equal(last.nextStart,null);
 assert.equal(last.counts.specialIndex,1);
 assert.equal(last.records[0].targetWarpId,255);
 assert.equal(first.runtimeBehaviorVerified,false);
 assert.equal(Object.isFrozen(first.records[0]),true);
 assert.deepEqual(rom,before);
});
test('truncation preserves total counts; zero matches are explicit',()=>{
 const {rom,atlas}=fixture();
 const result=incoming(rom,atlas,{...options,limit:3,maxResults:1});
 assert.equal(result.totalResults,4);
 assert.equal(result.records.length,1);
 assert.equal(result.truncated,true);
 const none=incoming(rom,atlas,{bankIndex:0,mapIndex:0,limit:3});
 assert.equal(none.totalResults,0);
});
test('stale pointers, layouts, invalid paging and unknown family fail closed',()=>{
 const {rom,atlas}=fixture();
 assert.throws(()=>incoming(rom,atlas,{...options,start:3}),RangeError);
 assert.throws(()=>incoming(rom,atlas,{...options,limit:33}),RangeError);
 assert.throws(()=>incoming(rom,atlas,{...options,maxResults:0}),RangeError);
 assert.throws(()=>incoming(rom,atlas,{bankIndex:1,mapIndex:0}),RangeError);
 assert.throws(()=>incoming(rom,{...atlas,family:'CUBE'},options),TypeError);
 u32(rom,0x44,ptr(0x100));
 assert.throws(()=>incoming(rom,atlas,{...options,limit:3}),/pointer changed/);
 u32(rom,0x44,ptr(0x400));
 u32(rom,0x444,3);
 assert.throws(()=>incoming(rom,atlas,options),/layout changed/);
});
test('staged accessor uses exact bytes without materialising ROM',()=>{
 const {rom,atlas}=fixture();
 const reader={length:rom.length,read:i=>rom[i]};
 assert.equal(incoming(reader,atlas,{...options,limit:3}).totalResults,4);
 assert.throws(()=>incoming({length:rom.length,read:()=>300},atlas,options),RangeError);
});
