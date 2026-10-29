import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {auditHmaCubeCrossBankOwnership} from '../src/hma-cube-cross-bank-ownership.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
   .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x14,0x120);
 ptr(bytes,0x100,0x200);ptr(bytes,0x120,0x240);
 for(const [header,layout] of [[0x200,0x280],[0x240,0x2c0]]){
   ptr(bytes,header,layout);
   u32(bytes,layout,3);u32(bytes,layout+4,2);
   ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,0x300);
   ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
 }
 return {bytes,summary};
}
const banks=[{bankIndex:0,mapCount:1},{bankIndex:1,mapCount:1}];
test('detects shared CUBE blockmap across explicitly counted banks without writing',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(report.decoded,2);
 assert.equal(report.invalid,0);
 assert.equal(report.crossBankRelationshipCount,1);
 assert.deepEqual([report.relationships[0].first,report.relationships[0].second],['0:0','1:0']);
 assert.equal(report.relationships[0].firstKind,'blockmap');
 assert.equal(report.relationships[0].sameStart,true);
 assert.equal(report.completeOwnershipProven,false);
 assert.equal(report.writeAuthorized,false);
 assert.ok(Object.isFrozen(report.relationships[0]));
 assert.deepEqual(bytes,before);
});
test('flags partial overlapping blockmaps and preserves invalid map slots',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x2cc,0x306);
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(report.crossBankRelationshipCount,1);
 assert.equal(report.relationships[0].sameStart,false);
 assert.equal(report.relationships[0].overlapBytes,6);
 ptr(bytes,0x120,0);
 const bad=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(bad.invalid,1);
 assert.equal(bad.crossBankRelationshipCount,0);
});
test('rejects duplicate, unbounded and malformed bank count requests',async()=>{
 const {bytes,summary}=await fixture();
 const run=b=>auditHmaCubeCrossBankOwnership(bytes,summary,{banks:b});
 for(const b of [[],[{bankIndex:0,mapCount:0}],[
   {bankIndex:0,mapCount:1},{bankIndex:0,mapCount:1}],[
   {bankIndex:0,mapCount:129}]]){
   assert.throws(()=>run(b),RangeError);
 }
 assert.throws(()=>run(Array.from({length:9},(_,i)=>({bankIndex:i,mapCount:1}))),RangeError);
 assert.throws(()=>run([{bankIndex:0,mapCount:128},{bankIndex:1,mapCount:128},{bankIndex:2,mapCount:1}]),RangeError);
});

test('optional event claims reveal shared group and warp array across banks',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 ptr(bytes,0x204,0x600);ptr(bytes,0x244,0x600);
 bytes[0x601]=1;ptr(bytes,0x608,0x700);
 u16(bytes,0x700,1);u16(bytes,0x702,1);
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks,includeEvents:true});
 assert.equal(report.decoded,2);
 assert.equal(report.invalid,0);
 assert.equal(report.eventIssues.length,0);
 assert.equal(report.eventClaimsInspected,4);
 assert.equal(report.crossBankRelationshipCount,3);
 assert.deepEqual(new Set(report.relationships.map(r=>r.firstKind)),
  new Set(['blockmap','events-group','event-warps']));
 assert.equal(report.sameMapRelationships.length,0);
 assert.equal(report.completeOwnershipProven,false);
 assert.equal(report.writeAuthorized,false);
 assert.deepEqual(bytes.slice(0x10,0x200),original.slice(0x10,0x200));
});
test('invalid event arrays remain visible without hiding decoded map slots',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x204,0x600);bytes[0x601]=1;ptr(bytes,0x608,0x300);
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks,includeEvents:true});
 assert.equal(report.decoded,2);
 assert.equal(report.invalid,0);
 assert.equal(report.eventIssues.length,1);
 assert.equal(report.eventIssues[0].id,'0:0');
 assert.match(report.eventIssues[0].reason,/overlap/i);
 assert.equal(report.completeOwnershipProven,false);
 assert.throws(()=>auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks,includeEvents:'yes'
 }),/boolean/);
});

test('high-alias catalogs bound retained findings, count all overlaps and focus the edited map',async()=>{
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0x5000);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x1000);
 for(let i=0;i<128;i++)ptr(bytes,0x1000+i*4,0x2000);
 ptr(bytes,0x2000,0x2100);
 u32(bytes,0x2100,2);u32(bytes,0x2104,1);
 for(const [at,to] of [[0x2108,0x2300],[0x210c,0x2200],[0x2110,0x2400],[0x2114,0x2440]])
  ptr(bytes,at,to);
 const original=bytes.slice(),opts={banks:[{bankIndex:0,mapCount:128}]};
 const global=auditHmaCubeCrossBankOwnership(bytes,summary,opts);
 assert.equal(global.decoded,128);
 assert.equal(global.totalRelationshipCount,3*128*127/2);
 assert.equal(global.crossBankRelationshipCount,0);
 assert.equal(global.relationships.length,1024);
 assert.equal(global.relationshipFindingsTruncated,true);
 const focused=auditHmaCubeCrossBankOwnership(bytes,summary,{...opts,focusMapId:'0:127'});
 assert.equal(focused.totalRelationshipCount,global.totalRelationshipCount);
 assert.equal(focused.focusedRelationshipCount,3*127);
 assert.equal(focused.relationships.length,3*127);
 assert.equal(focused.relationshipFindingsTruncated,false);
 assert.ok(focused.relationships.every(r=>r.first==='0:127'||r.second==='0:127'));
 assert.deepEqual(bytes,original);
 assert.equal(global.writeAuthorized,false);
 assert.throws(()=>auditHmaCubeCrossBankOwnership(bytes,summary,{...opts,maxFindings:0}),/budget/);
 assert.throws(()=>auditHmaCubeCrossBankOwnership(bytes,summary,{...opts,focusMapId:'bad'}),/focused/);
});


test('transitive cross-bank ownership graph distinguishes direct byte aliases from connected maps',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 // 0:0 shares 6 blockmap bytes with 1:0; 1:0 shares 6 with 2:0.
 // 0:0 and 2:0 do not overlap each other.
 ptr(bytes,0x2cc,0x306);
 ptr(bytes,0x18,0x140);ptr(bytes,0x140,0x900);
 ptr(bytes,0x900,0x940);
 u32(bytes,0x940,3);u32(bytes,0x944,2);
 ptr(bytes,0x948,0x400);ptr(bytes,0x94c,0x30c);
 ptr(bytes,0x950,0x500);ptr(bytes,0x954,0x540);
 const census=[{bankIndex:0,mapCount:1},{bankIndex:1,mapCount:1},
  {bankIndex:2,mapCount:1}];
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks:census,focusMapId:'0:0',maxFindings:1
 });
 assert.equal(report.decoded,3);
 assert.equal(report.totalRelationshipCount,2);
 assert.equal(report.directAliasMapPairCount,2);
 assert.equal(report.crossBankDirectAliasMapPairCount,2);
 assert.equal(report.aliasComponents.length,1);
 assert.deepEqual(report.aliasComponents[0].mapIds,['0:0','1:0','2:0']);
 assert.deepEqual(report.aliasComponents[0].bankIndices,[0,1,2]);
 assert.equal(report.aliasComponents[0].directPairCount,2);
 assert.equal(report.aliasComponents[0].transitiveOnlyPairsPossible,true);
 assert.equal(report.mapAliasSummaries[0].directAliasMapCount,1);
 assert.equal(report.mapAliasSummaries[1].directAliasMapCount,2);
 assert.equal(report.mapAliasSummaries[2].directAliasMapCount,1);
 assert.ok(report.mapAliasSummaries.every(m=>m.componentMapCount===3));
 assert.equal(report.relationships.length,1); // focus is a display limit, not graph limit
 assert.equal(report.completeOwnershipProven,false);
 assert.equal(report.writeAuthorized,false);
 assert.ok(Object.isFrozen(report.aliasComponents[0].mapIds));
 assert.deepEqual(bytes.slice(0,0x10),before.slice(0,0x10));
});

test('truncated overlap findings cannot truncate complete alias components or direct pairs',async()=>{
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0x5000);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x1000);
 for(let i=0;i<32;i++)ptr(bytes,0x1000+i*4,0x2000);
 ptr(bytes,0x2000,0x2100);
 u32(bytes,0x2100,2);u32(bytes,0x2104,1);
 for(const [at,to] of [[0x2108,0x2300],[0x210c,0x2200],
  [0x2110,0x2400],[0x2114,0x2440]])ptr(bytes,at,to);
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks:[{bankIndex:0,mapCount:32}],maxFindings:1
 });
 assert.equal(report.relationshipFindingsTruncated,true);
 assert.equal(report.relationships.length,1);
 assert.equal(report.aliasComponents.length,1);
 assert.equal(report.aliasComponents[0].mapCount,32);
 assert.equal(report.directAliasMapPairCount,32*31/2);
 assert.equal(report.aliasComponents[0].directPairCount,32*31/2);
 assert.equal(report.aliasComponents[0].transitiveOnlyPairsPossible,false);
 assert.equal(report.mapAliasSummaries[31].directAliasMapCount,31);
 assert.equal(report.writeAuthorized,false);
});

test('invalid map slot stays visible and is never mistaken for an isolated decoded map',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x120,0);
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(report.invalid,1);
 assert.equal(report.mapAliasSummaries.length,2);
 assert.equal(report.mapAliasSummaries[1].id,'1:0');
 assert.equal(report.mapAliasSummaries[1].claimCount,0);
 assert.equal(report.mapAliasSummaries[1].componentMapCount,0);
 assert.equal(report.aliasComponents.length,0);
 assert.equal(report.completeOwnershipProven,false);
});
