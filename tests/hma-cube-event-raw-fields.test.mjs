import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';
import {previewHmaCubeEventRawFieldChange,verifyHmaCubeEventRawFieldDryRun}
 from '../src/hma-cube-event-position.js';

const opts={bankIndex:0,mapIndex:0,mapCount:1};
const u16=(b,i,v)=>{b[i]=v&255;b[i+1]=(v>>>8)&255;};
const u32=(b,i,v)=>{u16(b,i,v&65535);u16(b,i+2,v>>>16);};
const ptr=(b,i,at)=>u32(b,i,0x08000000+at);
function fixture(){
 const text=readFileSync(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8')
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
 u32(bytes,0x280,5);u32(bytes,0x284,4);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 bytes[0x600]=1;bytes[0x601]=1;bytes[0x602]=1;bytes[0x603]=1;
 ptr(bytes,0x604,0x700);ptr(bytes,0x608,0x740);
 ptr(bytes,0x60c,0x780);ptr(bytes,0x610,0x7c0);
 bytes[0x700]=1;bytes[0x701]=3;u16(bytes,0x702,0x12);
 u16(bytes,0x704,1);u16(bytes,0x706,1);bytes[0x708]=2;bytes[0x709]=2;
 u16(bytes,0x70a,4);u16(bytes,0x70c,5);u16(bytes,0x70e,6);
 ptr(bytes,0x710,0xabc);u16(bytes,0x714,7);u16(bytes,0x716,0xcafe);
 u16(bytes,0x740,3);u16(bytes,0x742,1);
 u16(bytes,0x780,2);u16(bytes,0x782,2);u16(bytes,0x784,400);
 u16(bytes,0x786,1);u32(bytes,0x788,0x12345678);ptr(bytes,0x78c,0xb00);
 u16(bytes,0x7c0,4);u16(bytes,0x7c2,3);bytes[0x7c4]=4;
 u16(bytes,0x7c6,0x55aa);ptr(bytes,0x7c8,0xc00);
 return {bytes,summary};
}
function change(kind,record,proposed){
 return {...opts,kind,index:0,proposed,
  expected:Object.fromEntries(Object.keys(proposed).map(k=>[k,record[k]]))};
}

test('object raw scalar proposal preserves script pointer, padding and other events',()=>{
 const {bytes,summary}=fixture(),original=bytes.slice();
 const records=inspectHmaCubeMapEventWarps(bytes,summary,opts);
 const args=change('objects',records.objects[0],{id:9,graphics:4,flag:0x207});
 const plan=previewHmaCubeEventRawFieldChange(bytes,summary,args);
 assert.deepEqual(plan.changedFields,['id','graphics','flag']);
 assert.equal(plan.rawBytes.length,3);
 assert.equal(plan.unrelatedFieldsPreserved,true);
 assert.equal(plan.virtualReDecodeVerified,true);
 assert.equal(plan.writeAuthorized,false);
 const dry=verifyHmaCubeEventRawFieldDryRun(bytes,summary,args);
 assert.equal(dry.changedBytes,3);
 assert.equal(dry.inMemoryRollbackVerified,true);
 assert.equal(dry.sourceBytesPreserved,true);
 assert.deepEqual(bytes,original);
});

test('script trigger u32 raw index and signpost raw kind are copy-only',()=>{
 const {bytes,summary}=fixture(),records=inspectHmaCubeMapEventWarps(bytes,summary,opts);
 const script=change('scripts',records.scripts[0],{trigger:2,indexValue:0x1234abcd});
 const plan=previewHmaCubeEventRawFieldChange(bytes,summary,script);
 assert.equal(plan.after.indexValue,0x1234abcd);
 assert.equal(plan.rawBytes.length,3);
 assert.equal(verifyHmaCubeEventRawFieldDryRun(bytes,summary,script).changedBytes,3);
 const sign=change('signposts',records.signposts[0],{kind:5,unused:0x44aa});
 assert.equal(previewHmaCubeEventRawFieldChange(bytes,summary,sign).after.kind,5);
 assert.equal(verifyHmaCubeEventRawFieldDryRun(bytes,summary,sign).changedBytes,2);
});

test('unknown, pointer, stale, no-op and out-of-range raw fields fail closed',()=>{
 const {bytes,summary}=fixture(),records=inspectHmaCubeMapEventWarps(bytes,summary,opts);
 const object=records.objects[0],base=change('objects',object,{movement:3});
 for(const proposed of [{scriptPointer:0x08000c00},{padding:3},{x:2},{rawArgument:5}])
  assert.throws(()=>previewHmaCubeEventRawFieldChange(bytes,summary,
   {...base,proposed,expected:Object.fromEntries(Object.keys(proposed).map(k=>[k,0]))}),
   /supported raw scalar/i);
 assert.throws(()=>previewHmaCubeEventRawFieldChange(bytes,summary,
  {...base,expected:{movement:255}}),/changed since selection/i);
 assert.throws(()=>previewHmaCubeEventRawFieldChange(bytes,summary,
  {...base,proposed:{movement:256}}),/range/i);
 assert.throws(()=>previewHmaCubeEventRawFieldChange(bytes,summary,
  {...base,proposed:{movement:object.movement}}),/no bytes/i);
 assert.throws(()=>previewHmaCubeEventRawFieldChange(bytes,summary,
  {...base,expected:{movement:2,flag:7}}),/Exact source values/i);
 assert.throws(()=>previewHmaCubeEventRawFieldChange(bytes,summary,
  {...base,kind:'warps'}),/Unsupported CUBE raw event kind/i);
});

test('offline bundle includes exact copy-only raw field preflight without export authority',()=>{
 const source=readFileSync(new URL('../src/hma-cube-event-position.js',import.meta.url),'utf8');
 const offline=readFileSync(new URL('../app/CUBHMA_Mobile_Lab_Offline.html',import.meta.url),'utf8');
 assert.match(source,/export function previewHmaCubeEventRawFieldChange/);
 assert.match(source,/export function verifyHmaCubeEventRawFieldDryRun/);
 assert.match(offline,/function previewHmaCubeEventRawFieldChange/);
 assert.match(offline,/function verifyHmaCubeEventRawFieldDryRun/);
 assert.match(offline,/scriptSemanticsVerified:false/);
 assert.doesNotMatch(source,/writeAuthorized:true|patchedRomExported:true/);
});
