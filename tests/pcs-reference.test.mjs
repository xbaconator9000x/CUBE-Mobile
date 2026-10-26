import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHmaPcsReference,decodeHmaPcsReference} from '../src/pcs-reference.js';

const source=[
  '0x00 = " AB"',
  '0xA1 = "012"',
  '0xFC = \\CC',
  '0xFD = \\\\',
  'CC_04 = 2',
  '[GLOBAL] A1 A2',
  '@!game(BPEE)',
  '[EMERALD] FD01',
  '@!game(BPRE, BPGE)',
  '[FIRERED] FD02'
].join('\n');

test('upstream-style glyph ranges, control lengths and game-scoped macros are parsed',()=>{
  const ref=parseHmaPcsReference(source);
  assert.equal(ref.glyphs[0],' ');
  assert.equal(ref.glyphs[1],'A');
  assert.equal(ref.glyphs[0xA2],'1');
  assert.equal(ref.controlCodeLengths[4],3);
  assert.deepEqual(ref.macrosByGame.BPEE['[EMERALD]'],[0xFD,1]);
  assert.equal(ref.macrosByGame.BPRE['[EMERALD]'],undefined);
  assert.deepEqual(ref.macrosByGame.AXVE['[GLOBAL]'],[0xA1,0xA2]);
  assert.equal(ref.authenticated,false);
  assert.equal(ref.editable,false);
});

test('reference decoding uses game-specific macro before raw escape interpretation',()=>{
  const ref=parseHmaPcsReference(source);
  const rom=Uint8Array.from([0xFD,1,0xA1,0xFF]);
  const copy=rom.slice();
  const result=decodeHmaPcsReference(rom,0,4,{gameCode:'BPEE',reference:ref});
  assert.equal(result.text,'[EMERALD]0');
  assert.equal(result.macroCount,1);
  assert.equal(result.terminatorOffset,3);
  assert.equal(result.mapping,'imported-hma-pcs-reference');
  assert.deepEqual(rom,copy);
});

test('a macro for another game is never silently applied',()=>{
  const ref=parseHmaPcsReference(source);
  const result=decodeHmaPcsReference(Uint8Array.of(0xFD,1,0xFF),0,3,{gameCode:'BPRE',reference:ref});
  assert.equal(result.macroCount,0);
  assert.equal(result.text,'\\\\01');
});

test('control lengths from reference protect FF argument bytes',()=>{
  const ref=parseHmaPcsReference(source);
  const rom=Uint8Array.of(0xFC,4,0xFF,0xA1,0xA2,0xFF);
  const result=decodeHmaPcsReference(rom,0,rom.length,{gameCode:'BPEE',reference:ref});
  assert.equal(result.terminatorOffset,5);
  assert.equal(result.text,'\\CC04FFA1\\!A2');
});

test('unmapped bytes remain visible rather than fabricated',()=>{
  const ref=parseHmaPcsReference('0x00 = " "\n0xA1 = 0');
  const result=decodeHmaPcsReference(Uint8Array.of(0x80,0xFF),0,2,{gameCode:'BPEE',reference:ref});
  assert.equal(result.text,'\\!80');
  assert.equal(result.unknownByteCount,1);
});

test('truncated controls and macro matches cannot read past the selected field',()=>{
  const ref=parseHmaPcsReference(source);
  const result=decodeHmaPcsReference(Uint8Array.of(0xFC,4,0xFF,0xA1),0,3,{gameCode:'BPEE',reference:ref});
  assert.equal(result.truncatedEscape,true);
  assert.equal(result.terminated,false);
  const macro=decodeHmaPcsReference(Uint8Array.of(0xFD,1),0,1,{gameCode:'BPEE',reference:ref});
  assert.equal(macro.macroCount,0);
  assert.equal(macro.truncatedEscape,true);
});

test('malformed and contradictory reference records fail closed',()=>{
  for (const bad of [
    '0x00 = "A"\n0x00 = "B"',
    '0xFF = "AB"',
    '0x00 = "A"\nCC_04 = 3\nCC_04 = 2',
    '0x00 = "A"\n[BAD] F',
    '0x00 = "A"\n@!game(ZZZZ)',
    '0x00 = "A"\n[TEST] 01\n[TEST] 02',
    '0x00 = "A"\n[TEST] ',
    '',
    'x'.repeat(1024*1024+1)
  ]) assert.throws(()=>parseHmaPcsReference(bad),bad.slice(0,35));
});

test('untrusted references and invalid staged ROM readers cannot be decoded',()=>{
  const ref=parseHmaPcsReference(source);
  assert.equal(decodeHmaPcsReference(Uint8Array.of(0),0,1,{gameCode:'XXXX',reference:ref}).supported,false);
  assert.equal(decodeHmaPcsReference(Uint8Array.of(0),0,1,{gameCode:'BPEE'}).supported,false);
  assert.throws(()=>decodeHmaPcsReference(Uint8Array.of(0),0,2,{gameCode:'BPEE',reference:ref}));
  assert.throws(()=>decodeHmaPcsReference({length:1,read:()=>-1},0,1,{gameCode:'BPEE',reference:ref}));
});

test('longest matching macro wins without inspecting beyond a bounded span',()=>{
  const ref=parseHmaPcsReference('0x00 = " "\n[SHORT] A1\n[LONG] A1A2');
  const rom=Uint8Array.of(0xA1,0xA2,0xFF);
  assert.equal(decodeHmaPcsReference(rom,0,3,{gameCode:'BPEE',reference:ref}).text,'[LONG]');
  assert.equal(decodeHmaPcsReference(rom,0,1,{gameCode:'BPEE',reference:ref}).text,'[SHORT]');
});
