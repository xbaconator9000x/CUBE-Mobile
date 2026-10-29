import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapScriptReferences} from '../src/hma-cube-map-script-table.js';

const opts={bankIndex:0,mapIndex:0,mapCount:1};
const u16=(b,i,v)=>{b[i]=v&255;b[i+1]=(v>>>8)&255;};
const u32=(b,i,v)=>{u16(b,i,v&65535);u16(b,i+2,v>>>16);};
const ptr=(b,i,at)=>u32(b,i,0x08000000+at);
function fixture(){
 const text=readFileSync(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8')
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0xe000);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);ptr(bytes,0x200,0x280);
 u32(bytes,0x280,2);u32(bytes,0x284,1);
 for(const [at,to] of [[0x288,0x400],[0x28c,0x300],[0x290,0x500],[0x294,0x540]])
  ptr(bytes,at,to);
 for(const [at,secondary] of [[0x500,0],[0x540,1]]){
  bytes[at+1]=secondary;
  ptr(bytes,at+4,secondary?0x5000:0x1000);
  ptr(bytes,at+8,secondary?0x9200:0x9000);
  ptr(bytes,at+12,secondary?0xb400:0x9400);
  ptr(bytes,at+16,secondary?0xd800:0xd400);
 }
 ptr(bytes,0x208,0xa00);
 bytes[0xa00]=1;ptr(bytes,0xa01,0xc00);
 bytes[0xa05]=2;ptr(bytes,0xa06,0xb00);
 bytes[0xa0a]=0;
 u16(bytes,0xb00,0x4000);u16(bytes,0xb02,1);ptr(bytes,0xb04,0xc20);
 u16(bytes,0xb08,0);
 return {bytes,summary};
}

test('indexes exact direct, conditional-table and conditional script pointer sources',()=>{
 const {bytes,summary}=fixture(),original=bytes.slice();
 const r=inspectHmaCubeMapScriptReferences(bytes,summary,opts);
 assert.equal(r.totalReferenceCount,3);
 assert.deepEqual(r.references.map(x=>x.pointerSource),[0xa01,0xa06,0xb04]);
 assert.deepEqual(r.references.map(x=>x.targetOffset),[0xc00,0xb00,0xc20]);
 assert.deepEqual(r.references.map(x=>x.kind),
  ['direct-script','conditional-table','conditional-script']);
 assert.equal(r.structuralTargetWarnings.length,0);
 assert.equal(r.aliasGroups.length,0);
 assert.equal(r.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});

test('reports script target aliases without pretending they are safe ownership',()=>{
 const {bytes,summary}=fixture();
 ptr(bytes,0xb04,0xc00);
 const r=inspectHmaCubeMapScriptReferences(bytes,summary,opts);
 assert.equal(r.aliasGroups.length,1);
 assert.equal(r.aliasGroups[0].category,'script');
 assert.equal(r.aliasGroups[0].targetOffset,0xc00);
 assert.deepEqual(r.aliasGroups[0].pointerSources,[0xa01,0xb04]);
 assert.equal(r.exclusiveOwnershipProven,false);
});

test('warns on script pointers into the map-script table and keeps exact raw source',()=>{
 const {bytes,summary}=fixture();
 ptr(bytes,0xa01,0xa00);
 const r=inspectHmaCubeMapScriptReferences(bytes,summary,opts);
 assert.equal(r.structuralTargetWarnings.length,1);
 assert.equal(r.structuralTargetWarnings[0].overlaps,'map-script-table');
 assert.equal(r.structuralTargetWarnings[0].pointerSource,0xa01);
});

test('reference display truncation retains full counts and rejects invalid budgets',()=>{
 const {bytes,summary}=fixture();
 const r=inspectHmaCubeMapScriptReferences(bytes,summary,{...opts,maxReferences:1});
 assert.equal(r.totalReferenceCount,3);
 assert.equal(r.references.length,1);
 assert.equal(r.referenceFindingsTruncated,true);
 assert.throws(()=>inspectHmaCubeMapScriptReferences(bytes,summary,{...opts,maxReferences:0}),/budget/i);
 assert.throws(()=>inspectHmaCubeMapScriptReferences(bytes,summary,{...opts,maxReferences:4097}),/budget/i);
 u32(bytes,0xa01,0x12345678);
 assert.throws(()=>inspectHmaCubeMapScriptReferences(bytes,summary,opts),/pointer/i);
});

test('offline script reference index matches modular source and remains read-only',()=>{
 const source=readFileSync(new URL('../src/hma-cube-map-script-table.js',import.meta.url),'utf8');
 const offline=readFileSync(new URL('../app/CUBHMA_Mobile_Lab_Offline.html',import.meta.url),'utf8');
 assert.match(source,/export function inspectHmaCubeMapScriptReferences/);
 assert.match(offline,/function inspectHmaCubeMapScriptReferences/);
 assert.match(source,/exclusiveOwnershipProven:false/);
 assert.doesNotMatch(source,/writeAuthorized:true|scriptInstructionsDecoded:true/);
});
