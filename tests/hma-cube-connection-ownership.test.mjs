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
 for(const [header,layout,blockmap,connection] of [
  [0x200,0x280,0x300,0x600],[0x240,0x2c0,0x340,0x640]
 ]){
  ptr(bytes,header,layout);ptr(bytes,header+12,connection);
  u32(bytes,layout,3);u32(bytes,layout+4,2);
  ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,blockmap);
  ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
  u32(bytes,connection,1);ptr(bytes,connection+4,0x700);
 }
 return {bytes,summary};
}
const banks=[{bankIndex:0,mapCount:1},{bankIndex:1,mapCount:1}];
test('connection array alias across banks is visible without ROM mutation',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks,includeConnections:true});
 assert.equal(report.decoded,2);
 assert.equal(report.connectionIssues.length,0);
 assert.equal(report.connectionClaimsInspected,4);
 assert.equal(report.includeConnections,true);
 assert.ok(report.relationships.some(r=>r.firstKind==='connection-records'&&
  r.secondKind==='connection-records'&&r.first==='0:0'&&r.second==='1:0'));
 assert.equal(report.completeOwnershipProven,false);
 assert.equal(report.writeAuthorized,false);
 assert.deepEqual(bytes,before);
});
test('connection arrays are opt-in and invalid source claims fail visibly',async()=>{
 const {bytes,summary}=await fixture();
 const omitted=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(omitted.connectionClaimsInspected,0);
 assert.equal(omitted.connectionIssues.length,0);
 ptr(bytes,0x24c,0x240);
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks,includeConnections:true});
 assert.equal(report.connectionIssues.length,1);
 assert.equal(report.connectionIssues[0].id,'1:0');
 assert.equal(report.invalid,0);
 assert.equal(report.writeAuthorized,false);
 assert.throws(()=>auditHmaCubeCrossBankOwnership(bytes,summary,{
  banks,includeConnections:'yes'
 }),/boolean/);
});
test('connection ownership toggle is wired into modular and offline mobile',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const [app,index,offline]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html')
 ]);
 for(const html of [index,offline])
  assert.match(html,/id="cube-ownership-connections" type="checkbox"/);
 assert.match(app,/includeConnections=\$\('cube-ownership-connections'\)\.checked/);
 assert.match(app,/snapshot\.includeConnections/);
 assert.match(offline,/connectionIssues\.length/);
});
