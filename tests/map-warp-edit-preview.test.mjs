import test from 'node:test';
import assert from 'node:assert/strict';
import {previewVanillaWarpRecordChange as preview} from '../src/map-warp-edit-preview.js';
const ptr=n=>0x08000000+n;
const u32=(b,o,n)=>{for(let i=0;i<4;i++)b[o+i]=(n>>>(8*i))&255;};
function fixture(){
 const rom=new Uint8Array(0x500).fill(0xff);
 u32(rom,0x100,ptr(0x140));u32(rom,0x104,ptr(0x180));u32(rom,0x108,0);u32(rom,0x10c,0);
 u32(rom,0x140,2);u32(rom,0x144,2);
 for(const [at,to] of [[0x148,0x200],[0x14c,0x220],[0x150,0x240],[0x154,0x260]])u32(rom,at,ptr(to));
 rom.set([0,1,0,0],0x180);u32(rom,0x188,ptr(0x300));
 rom.set([1,0,0,0,3,4,5,6],0x300);
 return rom;
}
const opts={address:0x100,family:'RSE',warpIndex:0};
test('warp change preview reports exact bytes and never mutates source ROM',()=>{
 const rom=fixture(),before=rom.slice();
 const result=preview(rom,{...opts,changes:{x:0,elevation:8,targetMap:9}});
 assert.deepEqual(result.before,[1,0,0,0,3,4,5,6]);
 assert.deepEqual(result.after,[0,0,0,0,8,4,9,6]);
 assert.equal(result.recordOffset,0x300);
 assert.equal(result.changed,true);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.ownershipVerified,false);
 assert.deepEqual(rom,before);
});
test('stale original bytes reject preview, even when staged accessor changes',()=>{
 const rom=fixture(),read={length:rom.length,read:i=>rom[i]};
 assert.throws(()=>preview(read,{...opts,changes:{warpId:2},
  expectedBytes:[1,0,0,0,3,4,5,0]}),/changed/);
 assert.equal(preview(read,{...opts,changes:{warpId:4},
  expectedBytes:[1,0,0,0,3,4,5,6]}).changed,false);
});
test('unknown fields, malformed values and coordinates outside map fail closed',()=>{
 const rom=fixture();
 for(const changes of [{foo:1},{targetMap:256},{warpId:-1},{x:2},{y:5},{x:1.5},{}])
  assert.throws(()=>preview(rom,{...opts,changes}));
 assert.throws(()=>preview(rom,{...opts,warpIndex:1,changes:{x:1}}),RangeError);
 assert.throws(()=>preview(rom,{...opts,changes:{x:1},expectedBytes:[0]}),TypeError);
});
test('raw target 0xFF is retained as an unresolved runtime special case',()=>{
 const rom=fixture();
 const result=preview(rom,{...opts,changes:{targetBank:255,warpId:255}});
 assert.deepEqual(result.after.slice(5),[255,5,255]);
 assert.equal(result.runtimeBehaviorVerified,false);
});
