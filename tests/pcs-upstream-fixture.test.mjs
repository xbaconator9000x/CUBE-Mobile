import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHmaPcsReference,decodeHmaPcsReference} from '../src/pcs-reference.js';

// Pinned upstream CUBHMA source; see fixtures/UPSTREAM_LICENSE.txt.
// This fixture must never be bundled as authenticated CUBE ROM metadata.
const source=readFileSync(new URL('./fixtures/upstream-pcsReference.txt',import.meta.url),'utf8');
const reference=parseHmaPcsReference(source);

test('authentic pinned upstream PCS reference imports without syntax workarounds',()=>{
  assert.equal(reference.kind,'hma-pcs-reference-v1');
  assert.equal(reference.authenticated,false);
  assert.equal(reference.editable,false);
  assert.equal(reference.glyphs[0x00],' ');
  assert.equal(reference.glyphs[0xBB],'A');
  assert.equal(reference.glyphs[0xD5],'a');
  assert.equal(reference.glyphs[0xFF],'"'); // upstream single-character quote
  assert.equal(reference.controlCodeLengths[0x04],4);
  assert.equal(reference.controlCodeLengths[0x09],1);
});

test('authentic underscore-delimited game groups preserve distinct colour macros',()=>{
  for(const code of ['BPRE','BPGE']){
    assert.deepEqual(reference.macrosByGame[code]['[white]'],[0xFC,0x01,0x00]);
    assert.equal(reference.macrosByGame[code]['[transp]'],undefined);
  }
  for(const code of ['AXVE','AXPE']){
    assert.deepEqual(reference.macrosByGame[code]['[white]'],[0xFC,0x01,0x0C]);
    assert.deepEqual(reference.macrosByGame[code]['[transp]'],[0xFC,0x01,0x00]);
  }
  assert.deepEqual(reference.macrosByGame.BPEE['[white]'],[0xFC,0x01,0x00]);
  assert.equal(reference.macrosByGame.BPEE['[transp]'],undefined);
  for(const code of ['AXVE','AXPE','BPRE','BPGE','BPEE'])
    assert.deepEqual(reference.macrosByGame[code]['[player]'],[0xFD,0x01]);
});

test('authentic source decodes same bytes with game-scoped macro names',()=>{
  const bytes=Uint8Array.of(0xFC,0x01,0x0C,0xFF);
  const copy=bytes.slice();
  const ruby=decodeHmaPcsReference(bytes,0,bytes.length,{gameCode:'AXVE',reference});
  const emerald=decodeHmaPcsReference(bytes,0,bytes.length,{gameCode:'BPEE',reference});
  assert.equal(ruby.text,'[white]');
  assert.equal(emerald.text,'[white4]');
  assert.equal(ruby.terminatorOffset,3);
  assert.equal(emerald.terminated,true);
  assert.deepEqual(bytes,copy);
});

test('malformed game scopes and unmatched quotes still fail closed',()=>{
  for(const bad of ['@!game(BPRE_BOGU)','@!game(BPRE_bad)','@!game(BPRE+)','0x00 = "AB'])
    assert.throws(()=>parseHmaPcsReference('0x00 = " "\n'+bad));
});
