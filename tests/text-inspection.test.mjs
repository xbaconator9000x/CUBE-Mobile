import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixedTextBytes} from '../src/text-inspection.js';
test('read-only fixed text inspector reports FF termination and original hex',()=>{
 const rom=Uint8Array.from([0x41,0x42,0xFF,0x80,0]);
 const before=rom.slice();
 const result=inspectFixedTextBytes(rom,0,5);
 assert.equal(result.hex,'41 42 FF 80 00');
 assert.equal(result.asciiHint,'AB');
 assert.equal(result.terminatorOffset,2);
 assert.equal(result.encoding,'unknown-gba-text');
 assert.deepEqual(rom,before);
});
test('un-terminated spans stay explicitly un-terminated',()=>{
 const result=inspectFixedTextBytes(Uint8Array.from([0,0x20]),0,2);
 assert.equal(result.terminated,false);
 assert.equal(result.asciiHint,'. ');
});
test('text inspector rejects invalid ranges without reading',()=>{
 const rom=new Uint8Array(2);
 for(const [start,length] of [[-1,1],[0,0],[1,2],[0,1025],[3,1]])
  assert.throws(()=>inspectFixedTextBytes(rom,start,length));
});
test('text inspector supports immutable staged ROM byte-reader',()=>{
 const bytes={length:3,read:i=>[0x61,0xFF,0x42][i]};
 assert.equal(inspectFixedTextBytes(bytes,0,3).asciiHint,'a');
});
