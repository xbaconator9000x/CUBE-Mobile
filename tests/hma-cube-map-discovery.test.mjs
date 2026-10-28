import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEntry} from '../src/hma-cube-map-discovery.js';
import {inspectBlockMap} from '../src/map-blocks.js';

const fixture=new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url);
function u16(bytes,at,value){bytes[at]=value&255;bytes[at+1]=(value>>>8)&255;}
function u32(bytes,at,value){u16(bytes,at,value&65535);u16(bytes,at+2,value>>>16);}
function ptr(bytes,at,target){u32(bytes,at,0x08000000+target);}
async function make(){
  const text=(await readFile(fixture,'utf8')).replace('Address = 0x102D520','Address = 0x10');
  const bytes=new Uint8Array(4096);
  const metadata=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
  ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
  ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
  u16(bytes,0x210,123);u16(bytes,0x212,456);
  bytes[0x214]=7;bytes[0x215]=8;bytes[0x216]=9;bytes[0x217]=10;
  u16(bytes,0x218,321);bytes[0x21a]=0x45;bytes[0x21b]=11;
  u32(bytes,0x280,3);u32(bytes,0x284,2);
  ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
  ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
  bytes[0x298]=1;bytes[0x299]=2;bytes[0x29a]=3;bytes[0x29b]=4;
  for(let i=0;i<6;i++)u16(bytes,0x300+i*2,(i+1)|((i%3)<<10));
  return {bytes,metadata};
}
test('pinned CUBE metadata resolves explicitly selected custom map header/layout and raw block cells',async()=>{
  const {bytes,metadata}=await make(),original=bytes.slice();
  assert.equal(metadata.status,'custom-candidate');
  const result=inspectHmaCubeMapEntry(bytes,metadata,{bankIndex:0,mapIndex:0,mapCount:1});
  assert.equal(result.declaredBankCount,34);
  assert.equal(result.header.address,0x200);
  assert.equal(result.header.eventsOffset,0x600);
  assert.equal(result.header.music,123);
  assert.equal(result.header.layoutId,456);
  assert.equal(result.header.regionSectionId,7);
  assert.equal(result.header.nightMusic,321);
  assert.equal(result.header.flags,0x45);
  assert.equal(result.layout.address,0x280);
  assert.equal(result.layout.width,3);
  assert.equal(result.layout.height,2);
  assert.equal(result.layout.blockmapOffset,0x300);
  assert.equal(result.layout.borderWidth,2);
  const grid=inspectBlockMap(bytes,{address:result.layout.blockmapOffset,width:3,height:2});
  assert.equal(grid.cells[0][1].tileId,2);
  assert.equal(grid.cells[0][1].collision,1);
  assert.equal(result.writeAuthorized,false);
  assert.equal(result.cubeLayoutAuthenticated,false);
  assert.ok(Object.isFrozen(result.header)&&Object.isFrozen(result.layout));
  assert.deepEqual(bytes,original);
});
test('explicit nested map count is mandatory and no map count is guessed',async()=>{
  const {bytes,metadata}=await make();
  for(const options of [{bankIndex:0,mapIndex:0},{bankIndex:34,mapIndex:0,mapCount:1},
    {bankIndex:0,mapIndex:1,mapCount:1},{bankIndex:0,mapIndex:0,mapCount:1025},
    {bankIndex:0,mapIndex:0,mapCount:0}]){
    assert.throws(()=>inspectHmaCubeMapEntry(bytes,metadata,options),RangeError);
  }
});
test('fail closed on pointer overlap, truncation and invalid dimensions',async()=>{
  const {bytes,metadata}=await make();
  const valid=()=>inspectHmaCubeMapEntry(bytes,metadata,{bankIndex:0,mapIndex:0,mapCount:1});
  ptr(bytes,0x100,0x10);
  assert.throws(valid,/overlap/i);
  ptr(bytes,0x100,0x200);
  ptr(bytes,0x200,0x200);
  assert.throws(valid,/overlap/i);
  ptr(bytes,0x200,0x280);
  u32(bytes,0x280,0);
  assert.throws(valid,/dimensions/i);
  u32(bytes,0x280,3);
  ptr(bytes,0x28c,0x280);
  assert.throws(valid,/overlap/i);
  ptr(bytes,0x28c,0x300);
  ptr(bytes,0x100,0xFFF);
  assert.throws(valid,RangeError);
});
test('unsupported altered metadata field order and stale staged bytes are rejected',async()=>{
  const {bytes,metadata}=await make();
  const options={bankIndex:0,mapIndex:0,mapCount:1};
  const wrong={...metadata,hierarchy:{...metadata.hierarchy,
    mapFormat:metadata.hierarchy.mapFormat.replace('nightMusic:songnames','nightMusic::')}};
  assert.throws(()=>inspectHmaCubeMapEntry(bytes,wrong,options),/field order/i);
  const reader={length:bytes.length,read:i=>bytes[i]};
  const old=inspectHmaCubeMapEntry(reader,metadata,options);
  ptr(bytes,0x100,0x204);
  assert.throws(()=>inspectHmaCubeMapEntry(reader,metadata,options),RangeError);
  ptr(bytes,0x100,0x200);
  bytes[0x212]=0xAA;
  assert.notEqual(inspectHmaCubeMapEntry(reader,metadata,options).header.layoutId,old.header.layoutId);
  assert.throws(()=>inspectHmaCubeMapEntry({length:bytes.length,read:()=>256},metadata,options),RangeError);
});
