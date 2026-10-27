import test from 'node:test';
import assert from 'node:assert/strict';
import {previewVanillaBlockmapCellChange as preview} from '../src/map-edit-preview.js';
const ptr=n=>0x08000000+n;
const u32=(b,o,n)=>{for(let i=0;i<4;i++)b[o+i]=(n>>>(8*i))&255;};
function fixture(){
 const rom=new Uint8Array(0x400).fill(0xff);
 u32(rom,0x100,ptr(0x140));u32(rom,0x104,0);u32(rom,0x108,0);u32(rom,0x10c,0);
 u32(rom,0x140,2);u32(rom,0x144,2);
 for(const [at,to] of [[0x148,0x180],[0x14c,0x200],[0x150,0x220],[0x154,0x240]])u32(rom,at,ptr(to));
 rom[0x200]=0x45;rom[0x201]=0x81; // tile 325, collision 32
 return rom;
}
const options={address:0x100,family:'RSE',x:0,y:0};
test('exact byte preview preserves unmodified raw collision bits and ROM',()=>{
 const rom=fixture(),before=rom.slice();
 const result=preview(rom,{...options,tileId:777});
 assert.equal(result.byteOffset,0x200);
 assert.deepEqual(result.before.bytes,[0x45,0x81]);
 assert.deepEqual(result.after.bytes,[0x09,0x83]);
 assert.equal(result.before.collision,32);
 assert.equal(result.after.collision,32);
 assert.equal(result.after.tileId,777);
 assert.equal(result.changed,true);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.layoutAuthenticated,false);
 assert.deepEqual(rom,before);
 assert.equal(Object.isFrozen(result),true);
});
test('collision-only preview retains tile and supports immutable staged read accessor',()=>{
 const rom=fixture(),accessor={length:rom.length,read:i=>rom[i]};
 const result=preview(accessor,{...options,collision:63,expectedRaw:0x8145});
 assert.equal(result.after.raw,(63<<10)|325);
 assert.equal(result.after.tileId,325);
 assert.equal(result.aliases.known,false);
});
test('stale originals, invalid coordinates, unbounded values and missing changes fail closed',()=>{
 const rom=fixture();
 for(const override of [{expectedRaw:0},{x:2},{y:-1},{tileId:1024},
  {collision:64},{collision:-1},{tileId:1.5},{tileId:undefined,collision:undefined}]){
  assert.throws(()=>preview(rom,{...options,tileId:325,...override}),RangeError);
 }
});
test('declared atlas records aliases and rejects stale or unrelated map snapshots',()=>{
 const rom=fixture();
 const entry=(bankIndex,mapHeaderOffset)=>({bankIndex,mapIndex:0,
  mapHeaderOffset,layoutOffset:0x140,blockmapOffset:0x200,width:2,height:2});
 const atlas={family:'RSE',readOnly:true,layoutAuthenticated:false,
  maps:[entry(0,0x100),entry(1,0x120)]};
 const result=preview(rom,{...options,tileId:5,atlas});
 assert.equal(result.aliases.total,2);
 assert.equal(result.aliases.maps[1].bankIndex,1);
 assert.throws(()=>preview(rom,{...options,tileId:5,
  atlas:{...atlas,maps:[{...entry(0,0x100),width:3}]} }),/stale/);
 assert.throws(()=>preview(rom,{...options,tileId:5,
  atlas:{...atlas,maps:[entry(0,0x120)]}}),/absent/);
});
test('invalid staged reader byte and mismatched vanilla family reject preview',()=>{
 const rom=fixture();
 assert.throws(()=>preview({length:rom.length,read:i=>i===0x200?999:rom[i]},
  {...options,tileId:2}),RangeError);
 assert.throws(()=>preview(rom,{...options,family:'CUBE',tileId:2}),RangeError);
});
