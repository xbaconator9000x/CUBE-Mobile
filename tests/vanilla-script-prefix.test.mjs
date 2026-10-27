import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaScriptCommandPrefix as inspect} from '../src/vanilla-script-prefix.js';
const decode=(bytes,options={})=>inspect(Uint8Array.from(bytes),{
 address:0,family:'RSE',...options});
test('decodes upstream fixed-width commands with byte-exact offsets',()=>{
 const result=decode([0x16,0x00,0x40,0x03,0x00,0x06,0x01,
  0x10,0x00,0x08,0x02,0x00,0x00,0x00,0xff]);
 assert.deepEqual(result.commands.map(c=>[c.name,c.offset,c.length]),
  [['setvar',0,5],['if1',5,6],['end',11,1]]);
 assert.equal(result.commands[0].args[0].value,0x4000);
 assert.equal(result.commands[1].args[1].target.status,'non-rom');
 assert.equal(result.stopReason,'terminal');
 assert.equal(result.inspectedBytes,12);
 assert.equal(result.layoutAuthenticated,false);
 assert.equal(result.grammarAuthenticated,false);
 assert.equal(result.writeAuthorized,false);
 assert.ok(Object.isFrozen(result.commands[0].bytes));
});
test('conventional pointer classification never follows a branch',()=>{
 const rom=new Uint8Array(40);
 rom.set([0x04,0x14,0,0,0x08,0x02],0);
 const result=inspect(rom,{address:0,family:'FRLG'});
 assert.equal(result.commands[0].args[0].target.status,'in-rom');
 assert.equal(result.commands[0].args[0].target.offset,20);
 assert.equal(result.commands[1].name,'end');
 assert.equal(result.commands.length,2);
 assert.equal(result.controlFlowFollowed,false);
});
test('unknown opcode stops before inventing a command boundary',()=>{
 const result=decode([0x00,0xff,0x02]);
 assert.deepEqual(result.commands.map(c=>c.name),['nop']);
 assert.equal(result.stopReason,'unknown-opcode');
 assert.equal(result.stopOffset,1);
});
test('truncated command and ROM end do not consume partial operands',()=>{
 const rom=Uint8Array.from([0x16,0x00,0x40,0x00,0x00,0x04,0x00]);
 const a=inspect(rom,{address:0,family:'RSE',maxBytes:6});
 assert.equal(a.stopReason,'truncated-command');
 assert.equal(a.inspectedBytes,5);
 const b=inspect(rom,{address:5,family:'FRLG'});
 assert.equal(b.stopReason,'rom-end');
 assert.equal(b.commands.length,0);
});
test('hard command and byte limits prevent unbounded traversal',()=>{
 const rom=new Uint8Array(300);
 assert.equal(inspect(rom,{address:0,family:'RSE',maxCommands:2}).stopReason,'command-budget');
 assert.equal(inspect(rom,{address:0,family:'RSE',maxBytes:3}).stopReason,'byte-budget');
 assert.equal(inspect(rom,{address:299,family:'RSE'}).stopReason,'rom-end');
});
test('rejects malformed offsets, accessor bytes, families and budgets',()=>{
 const rom=new Uint8Array(8);
 for(const options of [{address:8,family:'RSE'},
  {address:-1,family:'RSE'},{address:0,family:'CUBE'},
  {address:0,family:'RSE',maxBytes:257},
  {address:0,family:'RSE',maxCommands:65}])
  assert.throws(()=>inspect(rom,options),RangeError);
 assert.throws(()=>inspect({length:8,read:()=>256},{address:0,family:'RSE'}),RangeError);
 assert.throws(()=>inspect({length:8,read:()=>undefined},{address:0,family:'RSE'}),RangeError);
 assert.throws(()=>inspect(null,{address:0,family:'RSE'}),TypeError);
});
test('staged accessors are inspected without changing backing bytes',()=>{
 const rom=new Uint8Array(10),original=rom.slice();
 const result=inspect({length:10,read:i=>i===0?0x02:rom[i]},
  {address:0,family:'RSE'});
 assert.equal(result.commands[0].name,'end');
 assert.deepEqual(rom,original);
});
