import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {auditHmaCubeCrossBankOwnership} from '../src/hma-cube-cross-bank-ownership.js';
import {auditHmaCubeEditOwnershipImpact} from '../src/hma-cube-edit-ownership-impact.js';

function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
const banks=[{bankIndex:0,mapCount:1},{bankIndex:1,mapCount:1}];
async function fixture(){
 const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text:toml}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x14,0x120);
 ptr(bytes,0x100,0x200);ptr(bytes,0x120,0x240);
 for(const [header,layout,blockmap] of [[0x200,0x280,0x300],[0x240,0x2c0,0x340]]){
  ptr(bytes,header,layout);
  u32(bytes,layout,3);u32(bytes,layout+4,16);
  ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,blockmap);
  ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
 }
 // The second map's warp array is also an independently claimed script table
 // in the first map. A changed warp byte therefore has multiple owners.
 ptr(bytes,0x24c,0x640);u32(bytes,0x640,0); // overwritten below
 ptr(bytes,0x244,0x600);bytes[0x601]=1;ptr(bytes,0x608,0x740);
 ptr(bytes,0x208,0x740);
 u16(bytes,0x740,1);ptr(bytes,0x741,0xb00);bytes[0x745]=0;
 // x=1, y=11, elevation=8, warpId=0, targetMap=0, targetBank=0
 u16(bytes,0xb00,0x4000);u16(bytes,0xb02,1);ptr(bytes,0xb04,0xc00);
 u16(bytes,0xb08,0);
 return {bytes,summary};
}
test('map-script table claim intersects an edited warp byte across declared banks',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const census=auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks,includeEvents:true,includeMapScripts:true
 });
 assert.equal(census.mapScriptIssues.length,0);
 assert.equal(census.mapScriptClaimsInspected,1);
 assert.ok(census.relationships.some(r=>
  r.firstKind==='map-scripts-table'&&r.secondKind==='event-warps'||
  r.secondKind==='map-scripts-table'&&r.firstKind==='event-warps'));
 const impact=auditHmaCubeEditOwnershipImpact(bytes,summary,{
  bankIndex:1,mapIndex:0,mapCount:1,banks,targetBanks:banks,
  warps:[{warpIndex:0,expected:{
   x:1,y:11,elevation:8,warpId:0,targetMap:0,targetBank:0
  },proposed:{x:2}}]
 });
 assert.equal(impact.changedBytes,1);
 assert.equal(impact.mapScriptIssueCount,0);
 assert.equal(impact.changedBytesTouchSharedClaims,true);
 assert.ok(impact.conflicts.some(c=>c.changedKinds.includes('event-warps')&&
  [c.firstKind,c.secondKind].includes('map-scripts-table')));
 assert.equal(impact.writeAuthorized,false);
 assert.deepEqual(bytes,before);
});
test('shared conditional map-script table across banks is a visible alias',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x248,0x900);
 bytes[0x900]=2;ptr(bytes,0x901,0xb00);bytes[0x905]=0;
 // Map zero also points at the same conditional table, but via its own list.
 ptr(bytes,0x208,0x920);bytes[0x920]=2;ptr(bytes,0x921,0xb00);bytes[0x925]=0;
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks,includeMapScripts:true
 });
 assert.equal(report.mapScriptIssues.length,0);
 assert.equal(report.mapScriptClaimsInspected,4);
 assert.ok(report.relationships.some(r=>
  r.firstKind==='map-scripts-conditions'&&r.secondKind==='map-scripts-conditions'));
 assert.equal(report.completeOwnershipProven,false);
});
test('invalid map-script list fails closed in ownership impact',async()=>{
 const {bytes,summary}=await fixture();
 bytes[0x740]=8;
 const result=auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks,includeMapScripts:true
 });
 assert.equal(result.mapScriptIssues.length,1);
 assert.equal(result.mapScriptIssues[0].id,'0:0');
 assert.equal(result.mapScriptClaimsInspected,0);
 assert.throws(()=>auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks,includeMapScripts:'true'
 }),/boolean/i);
 // A separate edit still works in isolation, but cannot establish ownership
 // when any declared map-script table is invalid.
 bytes[0x740]=1;
 ptr(bytes,0x208,0x900);bytes[0x900]=8;
 const impact=auditHmaCubeEditOwnershipImpact(bytes,summary,{
  bankIndex:1,mapIndex:0,mapCount:1,banks,targetBanks:banks,
  warps:[{warpIndex:0,expected:{
   x:1,y:11,elevation:8,warpId:0,targetMap:0,targetBank:0
  },proposed:{x:2}}]
 });
 assert.equal(impact.mapScriptIssueCount,1);
 assert.equal(impact.censusIncomplete,true);
 assert.equal(impact.noDetectedOverlapInInspectedMaps,false);
 assert.equal(impact.writeAuthorized,false);
});
