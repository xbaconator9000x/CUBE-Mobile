import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {auditHmaCubeEditOwnershipImpact} from '../src/hma-cube-edit-ownership-impact.js';

function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{
  romSize:bytes.length
 });
 ptr(bytes,0x10,0x100);ptr(bytes,0x14,0x120);
 ptr(bytes,0x100,0x200);ptr(bytes,0x120,0x240);
 for(const [header,layout,blockmap] of [
  [0x200,0x280,0x300],[0x240,0x2c0,0x340]
 ]){
  ptr(bytes,header,layout);
  u32(bytes,layout,3);u32(bytes,layout+4,2);
  ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,blockmap);
  ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
 }
 ptr(bytes,0x204,0x600);
 bytes[0x601]=1;ptr(bytes,0x608,0x700);
 u16(bytes,0x700,1);u16(bytes,0x702,1);
 // Destination bank/map/warp all resolve to the current map.
 bytes[0x704]=0;bytes[0x705]=0;bytes[0x706]=0;bytes[0x707]=0;
 return {bytes,summary};
}
const banks=[{bankIndex:0,mapCount:1},{bankIndex:1,mapCount:1}];
const opts={
 bankIndex:0,mapIndex:0,mapCount:1,banks,targetBanks:banks,
 warps:[{warpIndex:0,
  expected:{x:1,y:1,elevation:0,warpId:0,targetMap:0,targetBank:0},
  proposed:{x:2}
 }]
};
test('clean bounded census identifies changed warp bytes but never authorizes writing',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const result=auditHmaCubeEditOwnershipImpact(bytes,summary,opts);
 assert.equal(result.changedBytes,1);
 assert.equal(result.decodedMaps,2);
 assert.equal(result.conflicts.length,0);
 assert.equal(result.noDetectedOverlapInInspectedMaps,true);
 assert.equal(result.copyOnlyRehearsalVerified,true);
 assert.equal(result.partialCoverage,true);
 assert.equal(result.globalPointerOwnershipProven,false);
 assert.equal(result.exclusiveOwnershipProven,false);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.patchedRomExported,false);
 assert.deepEqual(bytes,before);
});
test('detects a second map sharing the edited warp array, including changed-byte kind',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 ptr(bytes,0x244,0x640);bytes[0x641]=1;ptr(bytes,0x648,0x700);
 const result=auditHmaCubeEditOwnershipImpact(bytes,summary,opts);
 assert.equal(result.changedBytesTouchSharedClaims,true);
 assert.equal(result.noDetectedOverlapInInspectedMaps,false);
 assert.equal(result.conflicts.length,1);
 assert.equal(result.conflicts[0].first,'0:0');
 assert.equal(result.conflicts[0].second,'1:0');
 assert.equal(result.conflicts[0].changedByteCount,1);
 assert.deepEqual(result.conflicts[0].changedKinds,['event-warps']);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(bytes.slice(0,0x244),before.slice(0,0x244));
});
test('invalid unrelated map or event arrays make the census incomplete',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x120,0);
 let result=auditHmaCubeEditOwnershipImpact(bytes,summary,opts);
 assert.equal(result.invalidMaps,1);
 assert.equal(result.censusIncomplete,true);
 assert.equal(result.noDetectedOverlapInInspectedMaps,false);
 const next=await fixture();
 ptr(next.bytes,0x244,0x640);next.bytes[0x641]=1;
 ptr(next.bytes,0x648,0x240);
 result=auditHmaCubeEditOwnershipImpact(next.bytes,next.summary,opts);
 assert.equal(result.eventIssueCount,1);
 assert.equal(result.censusIncomplete,true);
});
test('rejects missing source bank, stale records and overlapping unsafe inputs',async()=>{
 const {bytes,summary}=await fixture();
 assert.throws(()=>auditHmaCubeEditOwnershipImpact(bytes,summary,{
  ...opts,banks:[{bankIndex:1,mapCount:1}]
 }),/include exact edited bank/i);
 assert.throws(()=>auditHmaCubeEditOwnershipImpact(bytes,summary,{
  ...opts,warps:[{...opts.warps[0],expected:{...opts.warps[0].expected,x:0}}]
 }),/changed|stale|expected/i);
 assert.throws(()=>auditHmaCubeEditOwnershipImpact(bytes,summary,{
  ...opts,warps:[opts.warps[0],opts.warps[0]]
 }),/duplicate/i);
});

test('cross-kind impact catches a connection record aliasing the edited warp',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x24c,0x640);
 u32(bytes,0x640,1);ptr(bytes,0x644,0x700);
 const result=auditHmaCubeEditOwnershipImpact(bytes,summary,opts);
 assert.equal(result.connectionIssueCount,0);
 assert.equal(result.changedBytesTouchSharedClaims,true);
 assert.ok(result.conflicts.some(c=>
  c.firstKind==='event-warps'&&c.secondKind==='connection-records'&&
  c.changedKinds.includes('event-warps')));
 assert.equal(result.writeAuthorized,false);
});
