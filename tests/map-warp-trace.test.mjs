import test from 'node:test';
import assert from 'node:assert/strict';
import {traceVanillaWarpArrival as trace,auditVanillaWarpReturns as returns} from '../src/map-warp-trace.js';
const ptr=n=>0x08000000+n;
const u16=(b,o,n)=>{b[o]=n&255;b[o+1]=(n>>>8)&255;};
const u32=(b,o,n)=>{for(let i=0;i<4;i++)b[o+i]=(n>>>(8*i))&255;};
function fixture(){
 const rom=new Uint8Array(0x900).fill(0xff);
 u32(rom,0x40,ptr(0x100));u32(rom,0x44,ptr(0x400));
 for(const [header,layout,block,events,warps,border] of [
  [0x100,0x140,0x200,0x300,0x340,0x740],
  [0x400,0x440,0x500,0x600,0x640,0x760]]){
  u32(rom,header,ptr(layout));u32(rom,header+4,ptr(events));
  u32(rom,header+8,0);u32(rom,header+12,0);
  u32(rom,layout,2);u32(rom,layout+4,2);
  for(const [at,to] of [[8,border],[12,block],[16,0x700],[20,0x720]])
   u32(rom,layout+at,ptr(to));
  rom.set([0,1,0,0],events);u32(rom,events+8,ptr(warps));
 }
 rom.set([0,0,0,0,0,0,0,1],0x340);
 rom.set([1,0,1,0,0,0,0,0],0x640);
 u16(rom,0x506,0x8042);
 const atlas={family:'RSE',readOnly:true,layoutAuthenticated:false,maps:[
  {bankIndex:0,mapIndex:0,mapPointerSource:0x40,mapHeaderOffset:0x100,layoutOffset:0x140,
   blockmapOffset:0x200,width:2,height:2},
  {bankIndex:1,mapIndex:0,mapPointerSource:0x44,mapHeaderOffset:0x400,layoutOffset:0x440,
   blockmapOffset:0x500,width:2,height:2}]};
 return {rom,atlas};
}
const opts={bankIndex:0,mapIndex:0,warpIndex:0};
test('trace resolves raw target warp cell without mutating ROM or claiming teleport behavior',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const result=trace(rom,atlas,opts);
 assert.equal(result.status,'raw-arrival');
 assert.equal(result.destination.headerOffset,0x400);
 assert.equal(result.destination.warpRecordOffset,0x640);
 assert.equal(result.destination.x,1);
 assert.equal(result.destination.y,1);
 assert.equal(result.destination.blockmapByteOffset,0x506);
 assert.equal(result.destination.rawCollision,32);
 assert.equal(result.destination.tileId,66);
 assert.equal(result.runtimeBehaviorVerified,false);
 assert.deepEqual(rom,before);
 assert.equal(Object.isFrozen(result.destination),true);
});
test('special, undeclared, invalid index and out-of-bounds arrival are explicit',()=>{
 const {rom,atlas}=fixture();
 rom[0x347]=255;assert.equal(trace(rom,atlas,opts).status,'special');
 rom[0x347]=9;assert.equal(trace(rom,atlas,opts).status,'undeclared');
 rom[0x347]=1;rom[0x345]=2;assert.equal(trace(rom,atlas,opts).status,'invalid-index');
 rom[0x345]=0;u16(rom,0x640,5);
 assert.equal(trace(rom,atlas,opts).status,'out-of-bounds');
});
test('stale atlas and unsupported source warp fail closed',()=>{
 const {rom,atlas}=fixture();
 assert.throws(()=>trace(rom,atlas,{...opts,warpIndex:1}),RangeError);
 assert.throws(()=>trace(rom,{...atlas,maps:[{...atlas.maps[0],width:3},atlas.maps[1]]},opts),/changed/);
 assert.throws(()=>trace(rom,{...atlas,family:'CUBE'},opts),TypeError);
});
test('staged read accessor retains raw byte provenance',()=>{
 const {rom,atlas}=fixture();
 const source={length:rom.length,read:i=>rom[i]};
 assert.equal(trace(source,atlas,opts).destination.blockmapByteOffset,0x506);
});

test('raw arrival return path is reciprocal only when target warp points back to exact source index',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const result=returns(rom,atlas,{bankIndex:0,mapIndex:0});
 assert.deepEqual(result.counts,{reciprocal:1,differentWarp:0,differentMap:0,specialReturn:0,unresolved:0});
 assert.equal(result.records[0].returnTarget.recordOffset,0x640);
 assert.equal(result.records[0].arrival.x,1);
 assert.equal(result.reciprocalRequired,false);
 assert.equal(result.runtimeBehaviorVerified,false);
 assert.deepEqual(rom,before);
});
test('different warp, different map, special return and unresolved arrival are distinct',()=>{
 const {rom,atlas}=fixture();
 rom[0x645]=2;
 assert.equal(returns(rom,atlas,{bankIndex:0,mapIndex:0}).records[0].status,'differentWarp');
 rom[0x647]=1;
 assert.equal(returns(rom,atlas,{bankIndex:0,mapIndex:0}).records[0].status,'differentMap');
 rom[0x647]=0;rom[0x645]=255;
 assert.equal(returns(rom,atlas,{bankIndex:0,mapIndex:0}).records[0].status,'specialReturn');
 rom[0x345]=2;
 assert.equal(returns(rom,atlas,{bankIndex:0,mapIndex:0}).records[0].status,'unresolved');
});
test('return-path inspection rejects stale pointers and caps results without writing',()=>{
 const {rom,atlas}=fixture();
 const truncated=returns(rom,atlas,{bankIndex:0,mapIndex:0,maxResults:1});
 assert.equal(truncated.truncated,false);
 assert.throws(()=>returns(rom,atlas,{bankIndex:0,mapIndex:0,maxResults:0}),RangeError);
 assert.throws(()=>returns(rom,atlas,{bankIndex:9,mapIndex:0}),RangeError);
 u32(rom,0x44,ptr(0x100));
 assert.throws(()=>returns(rom,atlas,{bankIndex:0,mapIndex:0}),/pointer changed/);
});
test('return-path inspection accepts staged reader',()=>{
 const {rom,atlas}=fixture();
 assert.equal(returns({length:rom.length,read:i=>rom[i]},atlas,{bankIndex:0,mapIndex:0}).counts.reciprocal,1);
});
