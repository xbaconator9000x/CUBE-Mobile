import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaScriptCommandPrefix as inspect} from '../src/vanilla-script-prefix.js';
const read=(bytes,family='FRLG')=>inspect(Uint8Array.from(bytes),{address:0,family});

test('fixed-width music, movement, text and item commands retain exact byte boundaries',()=>{
 const bytes=[
  0x33,0x23,0x01,0x01, // playsong word + loop byte
  0x44,0x10,0x00,0x02,0x00, // additem two words
  0x4f,0xff,0x00,0x40,0,0,0x08, // applymovement npc word + pointer
  0x51,0,0, // waitmovement word
  0x67,0x60,0,0,0x08, // preparemsg pointer
  0x66,0x6a,0x5a,0x6c,0x02
 ];
 const r=read(bytes);
 assert.deepEqual(r.commands.map(c=>[c.name,c.offset,c.length]),[
  ['playsong',0,4],['additem',4,5],['applymovement',9,7],
  ['waitmovement',16,3],['preparemsg',19,5],['waitmsg',24,1],
  ['lock',25,1],['faceplayer',26,1],['release',27,1],['end',28,1]
 ]);
 assert.equal(r.commands[2].args[1].target.offset,64);
 assert.equal(r.commands[4].args[0].offset,20);
 assert.equal(r.stopReason,'terminal');
 assert.equal(r.controlFlowFollowed,false);
});

test('warp commands stop a sequential prefix rather than parsing following bytes as script',()=>{
 for(const family of ['FRLG','RSE']){
  const r=read([0x39,1,2,0xff,0x10,0,0x20,0,0x00,0x02],family);
  assert.deepEqual(r.commands.map(c=>c.name),['warp']);
  assert.deepEqual(r.commands[0].args.map(a=>a.value),[1,2,255,16,32]);
  assert.equal(r.inspectedBytes,8);
  assert.equal(r.stopReason,'terminal');
 }
});

test('variable-length trainerbattle and family-specific 2c remain untrusted',()=>{
 for(const opcode of [0x2c,0x5c]){
  const r=read([opcode,0,0,0,0,0,0,0,0]);
  assert.equal(r.commands.length,0);
  assert.equal(r.stopReason,'unknown-opcode');
 }
});

test('truncated movement and warp operands never produce partial commands',()=>{
 for(const bytes of [[0x4f,1,0,0x10,0],[0x39,1,2,3,4,5,6]]){
  const r=read(bytes);
  assert.equal(r.commands.length,0);
  assert.equal(r.stopReason,'rom-end');
 }
});

test('new commands respect explicit byte and command budgets',()=>{
 const bytes=Uint8Array.from([0x67,0x10,0,0,0x08,0x6a,0x02]);
 assert.equal(inspect(bytes,{address:0,family:'RSE',maxBytes:4}).stopReason,'truncated-command');
 assert.equal(inspect(bytes,{address:0,family:'RSE',maxCommands:1}).stopReason,'command-budget');
 assert.deepEqual(bytes,Uint8Array.from([0x67,0x10,0,0,0x08,0x6a,0x02]));
});
