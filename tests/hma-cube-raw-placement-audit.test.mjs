import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {auditHmaCubeRawPlacements} from '../src/hma-cube-raw-placement-audit.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text:toml}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
 u32(bytes,0x280,3);u32(bytes,0x284,2);
 for(const [at,to] of [[0x288,0x400],[0x28c,0x300],[0x290,0x500],[0x294,0x540]])ptr(bytes,at,to);
 bytes[0x600]=1;bytes[0x601]=1;
 ptr(bytes,0x604,0x720);ptr(bytes,0x608,0x700);
 u16(bytes,0x724,1);u16(bytes,0x726,1);
 u16(bytes,0x700,0);u16(bytes,0x702,0);
 u16(bytes,0x308,0xfc02);
 return {bytes,summary};
}
const options={bankIndex:0,mapIndex:0,mapCount:1};
test('reports raw high bits and existing/proposed event co-location without passability claims',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const result=auditHmaCubeRawPlacements(bytes,summary,{...options,placements:[
  {kind:'warps',index:0,x:1,y:1},{kind:'objects',index:0,x:1,y:1}
 ]});
 assert.equal(result.nonzeroRawHighBits,2);
 assert.equal(result.sourceColocations,1);
 assert.equal(result.proposedColocations,2);
 assert.equal(result.placements[0].rawWord,0xfc02);
 assert.equal(result.placements[0].rawHighBits,63);
 assert.equal(result.placements[0].tileId,2);
 assert.deepEqual(result.placements[0].sourceOccupants.map(x=>x.kind),['objects']);
 assert.equal(result.collisionSemanticsVerified,false);
 assert.equal(result.walkabilityVerified,false);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('rejects duplicate identities, invalid destinations and unsupported record kinds',async()=>{
 const {bytes,summary}=await fixture();
 const p={kind:'warps',index:0,x:1,y:1};
 const run=placements=>auditHmaCubeRawPlacements(bytes,summary,{...options,placements});
 assert.throws(()=>run([p,p]),/Duplicate/);
 assert.throws(()=>run([{...p,x:3}]),/Invalid/);
 assert.throws(()=>run([{...p,kind:'collision'}]),/Invalid/);
 assert.throws(()=>run([]),/1–64/);
});
