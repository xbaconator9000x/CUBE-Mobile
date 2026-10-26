import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {hashMetadataBytes,compareMetadataDigest} from '../src/metadata-digest.js';
const hash=b=>hashMetadataBytes(b,{cryptoProvider:webcrypto});
test('exact imported metadata bytes use known SHA-256 vector',async()=>{
 assert.equal(await hash(new TextEncoder().encode('abc')),
 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('metadata line endings and whitespace are byte-significant',async()=>{
 assert.notEqual(await hash(new TextEncoder().encode('a\\n')),
 await hash(new TextEncoder().encode('a\\r\\n')));
});
test('metadata hash does not modify input bytes',async()=>{
 const input=Uint8Array.from([0,255,1]);const before=input.slice();
 await hash(input);assert.deepEqual(input,before);
});
test('invalid or oversized metadata fails closed',async()=>{
 for(const input of [new Uint8Array(),new Uint8Array(4*1024*1024+1),'abc'])
  await assert.rejects(()=>hash(input));
});
test('digest match does not confer provenance or write authority',async()=>{
 const actual=await hash(new TextEncoder().encode('abc'));
 assert.deepEqual(compareMetadataDigest(actual,actual.toUpperCase()),{
  matches:true,authorizesWrites:false,provenanceVerified:false
 });
 assert.equal(compareMetadataDigest(actual,'0'.repeat(64)).matches,false);
 assert.throws(()=>compareMetadataDigest(actual,'unknown'));
});
