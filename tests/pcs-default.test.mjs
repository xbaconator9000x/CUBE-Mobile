import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeHmaPcsFallback,scanPcsTerminator} from '../src/pcs-default.js';

test('upstream fallback Gen 3 letter and digit mapping, read only',()=>{
  const rom=Uint8Array.from([0xBB,0xBC,0xD5,0xD6,0xA1,0xAA,0xFF,0x12]);
  const before=rom.slice();
  const result=decodeHmaPcsFallback(rom,0,rom.length,{gameCode:'BPEE'});
  assert.equal(result.text,'ABab09');
  assert.equal(result.terminatorOffset,6);
  assert.equal(result.terminated,true);
  assert.equal(result.authenticated,false);
  assert.equal(result.editable,false);
  assert.deepEqual(rom,before);
});
test('upstream fallback accents and control glyphs are not ASCII guesses',()=>{
  const result=decodeHmaPcsFallback(Uint8Array.from([0,1,0x51,0xFE,0xFA,0xFB,0xFF]),0,7,{gameCode:'BPRE'});
  assert.equal(result.text,' À¿\\n\\l\\pn');
});
test('escaped FF is not treated as a terminator',()=>{
  const raw=[0xFD,0xFF,0xBB,0xFF];
  assert.equal(scanPcsTerminator(raw).terminatorOffset,3);
  const result=decodeHmaPcsFallback(Uint8Array.from(raw),0,4,{gameCode:'BPGE'});
  assert.equal(result.text,'\\\\FF A'.replace(' ','')); // escaped raw FF, then A
  assert.equal(result.terminatorOffset,3);
});
test('function escape consumes its control-code argument bytes, including FF',()=>{
  const raw=[0xFC,0x04,0x01,0xFF,0x03,0xBB,0xFF];
  const result=decodeHmaPcsFallback(Uint8Array.from(raw),0,raw.length,{gameCode:'BPEE'});
  assert.equal(result.text,'\\CC0401FF03A');
  assert.equal(result.terminatorOffset,6);
  assert.equal(scanPcsTerminator(raw).terminatorOffset,6);
});
test('incomplete escape is explicit and cannot read outside a field',()=>{
  const raw=Uint8Array.from([0xBB,0xFC,0x04,0x01]);
  const result=decodeHmaPcsFallback(raw,0,raw.length,{gameCode:'BPEE'});
  assert.equal(result.text,'A\\CC0401');
  assert.equal(result.truncatedEscape,true);
  assert.equal(result.terminated,false);
  assert.equal(scanPcsTerminator([...raw]).malformedEscape,true);
});
test('unknown bytes are escaped and do not become fabricated characters',()=>{
  const result=decodeHmaPcsFallback(Uint8Array.from([0x7F,0xFF]),0,2,{gameCode:'AXVE'});
  assert.equal(result.text,'\\!7F');
  assert.equal(result.unknownByteCount,1);
});
test('unsupported or custom ROM game codes are not decoded as authenticated PCS',()=>{
  assert.equal(decodeHmaPcsFallback(Uint8Array.of(0xBB),0,1,{gameCode:'ZZZZ'}).supported,false);
  assert.equal(decodeHmaPcsFallback(Uint8Array.of(0xBB),0,1).supported,false);
});
test('PCS fallback preview accepts bounded staged readers and rejects bad bytes',()=>{
  const reader={length:5,read:i=>[0,0xBB,0xD5,0xFF,0][i]};
  assert.equal(decodeHmaPcsFallback(reader,1,3,{gameCode:'AXPE'}).text,'Aa');
  assert.throws(()=>decodeHmaPcsFallback({length:1,read:()=>256},0,1,{gameCode:'BPEE'}));
  assert.throws(()=>decodeHmaPcsFallback(reader,4,2,{gameCode:'BPEE'}));
  assert.throws(()=>decodeHmaPcsFallback(reader,0,1025,{gameCode:'BPEE'}));
});
test('end-exclusive span does not inspect a later FF terminator',()=>{
  const result=decodeHmaPcsFallback(Uint8Array.from([0xBB,0xFF]),0,1,{gameCode:'BPEE'});
  assert.equal(result.terminated,false);
  assert.equal(result.text,'A');
});
