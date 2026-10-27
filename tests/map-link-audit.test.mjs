import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaMapLinks,auditVanillaAtlasLinkBatch,auditVanillaMapEventCoordinates} from '../src/map-link-audit.js';

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

test('bounded atlas batches count every link and paginate without mutating ROM',()=>{
 const rom=fixture(),before=rom.slice(),catalog=atlas(rom);
 const first=auditVanillaAtlasLinkBatch(rom,catalog,{start:0,limit:1,maxFindings:2});
 assert.equal(first.scannedMaps,1);
 assert.equal(first.nextStart,1);
 assert.deepEqual(first.counts,{declared:2,undeclared:2,special:1,needsReview:1});
 assert.equal(first.totalFindings,4);
 assert.equal(first.findings.length,2);
 assert.equal(first.truncated,true);
 assert.deepEqual(first.findings.map(x=>x.status),['undeclared','special']);
 assert.equal(first.findings[0].headerOffset,0x200);
 assert.ok(Object.isFrozen(first.findings)&&Object.isFrozen(first.findings[0]));
 const second=auditVanillaAtlasLinkBatch(rom,catalog,{start:1,limit:16});
 assert.equal(second.scannedMaps,1);
 assert.equal(second.nextStart,null);
 assert.equal(second.totalFindings,0);
 assert.equal(second.counts.declared,1);
 assert.deepEqual(rom,before);
});
test('batch audit rejects invalid windows and malformed event pointers without partial result',()=>{
 const rom=fixture(),catalog=atlas(rom);
 for(const options of [{start:-1},{start:2},{limit:0},{limit:33},{maxFindings:0},{maxFindings:257}])
  assert.throws(()=>auditVanillaAtlasLinkBatch(rom,catalog,options),RangeError);
 assert.throws(()=>auditVanillaAtlasLinkBatch(rom,{}),TypeError);
 u32(rom,0x948,0x07000000);
 assert.throws(()=>auditVanillaAtlasLinkBatch(rom,catalog,{limit:2}),/pointer/i);
});

test('event coordinate audit distinguishes co-located raw warps from map bounds',()=>{
 const rom=fixture(),before=rom.slice(),catalog=atlas(rom);
 const result=auditVanillaMapEventCoordinates(rom,catalog,{bankIndex:0,mapIndex:0});
 assert.deepEqual(result.counts,{total:4,withinMap:4,outsideMap:0,sharedCell:4});
 assert.equal(result.totalFindings,4);
 assert.equal(result.findings[0].status,'shared-cell');
 assert.equal(result.findings[0].offset,0xa00);
 assert.equal(result.findings[0].cellOffset,0x506);
 assert.equal(result.findings[0].rawCollision,63);
 assert.equal(result.findings[0].rawTileId,1023);
 assert.equal(result.walkabilityVerified,false);
 assert.ok(Object.isFrozen(result.findings[0]));
 assert.deepEqual(rom,before);
});
test('objects, triggers and signposts retain raw coordinate provenance and bounds',()=>{
 const rom=fixture();
 rom[0x900]=1;rom[0x902]=1;rom[0x903]=1;
 u32(rom,0x904,ptr(0xd00));u32(rom,0x90c,ptr(0xd40));u32(rom,0x910,ptr(0xd80));
 rom.fill(0,0xd00,0xd18);rom.fill(0,0xd40,0xd50);rom.fill(0,0xd80,0xd8c);
 u16(rom,0xd04,3);u16(rom,0xd06,1);
 u16(rom,0xd40,0);u16(rom,0xd42,1);
 u16(rom,0xd80,0);u16(rom,0xd82,1);
 rom[0x504]=1;rom[0x505]=8;
 const before=rom.slice();
 const result=auditVanillaMapEventCoordinates(rom,atlas(rom),{
  bankIndex:0,mapIndex:0,maxFindings:2
 });
 assert.deepEqual(result.counts,{total:7,withinMap:6,outsideMap:1,sharedCell:6});
 assert.equal(result.totalFindings,7);
 assert.equal(result.findings.length,2);
 assert.equal(result.truncated,true);
 const full=auditVanillaMapEventCoordinates(rom,atlas(rom),{
  bankIndex:0,mapIndex:0
 });
 const object=full.findings.find(x=>x.kind==='objects');
 assert.deepEqual([object.status,object.offset,object.x,object.y,object.cellOffset],
  ['outside-map',0xd00,3,1,null]);
 const script=full.findings.find(x=>x.kind==='scripts');
 const sign=full.findings.find(x=>x.kind==='signposts');
 assert.equal(script.status,'shared-cell');
 assert.equal(sign.status,'shared-cell');
 assert.equal(script.cellOffset,0x504);
 assert.equal(script.rawTileId,1);
 assert.equal(script.rawCollision,2);
 assert.deepEqual(rom,before);
});
test('coordinate audit rejects stale layouts, invalid caps and malformed staged reads',()=>{
 const rom=fixture(),before=rom.slice(),catalog=atlas(rom);
 for(const maxFindings of [0,257,-1,1.5])
  assert.throws(()=>auditVanillaMapEventCoordinates(rom,catalog,{
   bankIndex:0,mapIndex:0,maxFindings
  }),/limit/);
 assert.throws(()=>auditVanillaMapEventCoordinates(rom,catalog,{
  bankIndex:1,mapIndex:0
 }),/outside/);
 const reader={length:rom.length,read:i=>i===0xa00?9:rom[i]};
 const staged=auditVanillaMapEventCoordinates(reader,catalog,{bankIndex:0,mapIndex:0});
 assert.equal(staged.counts.outsideMap,1);
 assert.equal(staged.counts.sharedCell,3);
 const invalid={length:rom.length,read:i=>i===0x506?-1:rom[i]};
 assert.throws(()=>auditVanillaMapEventCoordinates(invalid,catalog,{
  bankIndex:0,mapIndex:0
 }),/Invalid blockmap/);
 u32(rom,0x300,3);
 assert.throws(()=>auditVanillaMapEventCoordinates(rom,catalog,{
  bankIndex:0,mapIndex:0
 }),/layout changed/);
 assert.deepEqual(before.slice(0,0x300),rom.slice(0,0x300));
});
