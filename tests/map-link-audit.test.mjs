import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaMapLinks} from '../src/map-link-audit.js';

const ptr=n=>0x08000000+n;
function u32(rom,at,value){for(let i=0;i<4;i++)rom[at+i]=(value>>>(8*i))&255;}
function u16(rom,at,value){rom[at]=value&255;rom[at+1]=(value>>>8)&255;}
function warp(rom,at,{x=1,y=1,id=0,map=0,bank=0}={}){
 u16(rom,at,x);u16(rom,at+2,y);
 rom[at+4]=0;rom[at+5]=id;rom[at+6]=map;rom[at+7]=bank;
}
function fixture(){
 const rom=new Uint8Array(0x2000).fill(0xff);
 u32(rom,0x100,ptr(0x140));u32(rom,0x140,ptr(0x200));u32(rom,0x144,ptr(0x240));
 for(const [header,layout,blockmap,events,connections] of [
  [0x200,0x300,0x500,0x900,0xb00],[0x240,0x340,0x520,0x940,0]]){
  u32(rom,header,ptr(layout));u32(rom,header+4,ptr(events));
  u32(rom,header+8,0);u32(rom,header+12,connections?ptr(connections):0);
  u32(rom,layout,2);u32(rom,layout+4,2);
  u32(rom,layout+8,ptr(0x700));u32(rom,layout+12,ptr(blockmap));
  u32(rom,layout+16,ptr(0x800));u32(rom,layout+20,ptr(0x820));
 }
 rom.fill(0,0x900,0x904);rom.fill(0,0x940,0x944);
 rom[0x901]=4;u32(rom,0x908,ptr(0xa00));
 rom[0x941]=1;u32(rom,0x948,ptr(0xa40));
 warp(rom,0xa00,{map:1,bank:0,id:0});
 warp(rom,0xa08,{map:9,bank:0,id:0});
 warp(rom,0xa10,{map:255,bank:255,id:255});
 warp(rom,0xa18,{map:1,bank:0,id:2});
 warp(rom,0xa40,{map:0,bank:0,id:0});
 u32(rom,0xb00,2);u32(rom,0xb04,ptr(0xc00));
 u32(rom,0xc00,1);u32(rom,0xc04,0);rom[0xc08]=0;rom[0xc09]=1;
 u32(rom,0xc0c,2);u32(rom,0xc10,0);rom[0xc14]=0;rom[0xc15]=9;
 return rom;
}
const atlas=rom=>inspectVanillaMapAtlas(rom,{address:0x100,bankMapCounts:[2],family:'RSE'});
test('declared links, missing declarations, special fields and raw warp indexes are distinguished',()=>{
 const rom=fixture(),before=rom.slice(),result=auditVanillaMapLinks(rom,atlas(rom),{bankIndex:0,mapIndex:0});
 assert.deepEqual(result.counts,{declared:2,undeclared:2,special:1,needsReview:1});
 assert.deepEqual(result.records.map(x=>x.status),[
  'declared','undeclared','special','needs-review','declared','undeclared'
 ]);
 assert.equal(result.records[0].targetHeaderOffset,0x240);
 assert.equal(result.records[3].targetWarpId,2);
 assert.equal(result.records[4].offset,0xc00);
 assert.ok(Object.isFrozen(result.records)&&Object.isFrozen(result.records[0]));
 assert.equal(result.layoutAuthenticated,false);
 assert.deepEqual(rom,before);
});
test('staged bytes change link results without mutating underlying ROM',()=>{
 const rom=fixture(),before=rom.slice();
 const reader={length:rom.length,read:i=>i===0xa06?9:rom[i]};
 const result=auditVanillaMapLinks(reader,atlas(reader),{bankIndex:0,mapIndex:0});
 assert.equal(result.records[0].status,'undeclared');
 assert.deepEqual(rom,before);
});
test('invalid map selections and malformed target event pointers fail closed',()=>{
 const rom=fixture(),catalog=atlas(rom);
 assert.throws(()=>auditVanillaMapLinks(rom,catalog,{bankIndex:1,mapIndex:0}),/outside/);
 assert.throws(()=>auditVanillaMapLinks(rom,{}, {bankIndex:0,mapIndex:0}));
 u32(rom,0x948,0x07000000);
 assert.throws(()=>auditVanillaMapLinks(rom,catalog,{bankIndex:0,mapIndex:0}),/pointer/i);
});
