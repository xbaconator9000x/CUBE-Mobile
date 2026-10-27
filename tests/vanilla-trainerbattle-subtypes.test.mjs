import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaScriptCommandPrefix as inspect} from '../src/vanilla-script-prefix.js';
import {auditVanillaScriptOperandPointers as pointers} from '../src/vanilla-script-operand-pointers.js';
const widths=[2,3,3,1,3,2,4,3,4];
function fixture(subtype,count=widths[subtype]){
 const rom=new Uint8Array(256).fill(0xff);
 const command=[0x5c,subtype,0x34,0x12,0,0,
  ...Array.from({length:count},()=>[0x80,0,0,0x08]).flat(),0x02];
 rom.set(command);
 return rom;
}
test('all nine pinned vanilla trainerbattle subtypes preserve exact pointer widths',()=>{
 for(const family of ['FRLG','RSE'])for(let subtype=0;subtype<9;subtype++){
  const rom=fixture(subtype),before=rom.slice();
  const result=inspect(rom,{address:0,family});
  assert.deepEqual(result.commands.map(c=>c.name),['trainerbattle','end']);
  assert.equal(result.commands[0].length,6+widths[subtype]*4);
  assert.equal(result.commands[0].args[0].value,subtype);
  assert.equal(result.commands[0].args[1].value,0x1234);
  assert.equal(result.commands[0].args.filter(a=>a.type==='pointer').length,widths[subtype]);
  assert.equal(result.commands[1].offset,6+widths[subtype]*4);
  assert.equal(result.stopReason,'terminal');
  assert.equal(result.writeAuthorized,false);
  assert.deepEqual(rom,before);
 }
});
test('unsupported family-specific trainerbattle subtypes stop before any bytes are consumed',()=>{
 for(const subtype of [9,10,255]){
  const rom=fixture(subtype,0);
  const result=inspect(rom,{address:0,family:'FRLG'});
  assert.equal(result.stopReason,'unsupported-trainerbattle');
  assert.equal(result.inspectedBytes,0);
  assert.equal(result.commands.length,0);
 }
});
test('incomplete subtype and variable-width operands fail closed',()=>{
 const a=inspect(Uint8Array.of(0x5c),{address:0,family:'RSE'});
 assert.equal(a.stopReason,'rom-end');
 const b=inspect(fixture(6),{address:0,family:'RSE',maxBytes:10});
 assert.equal(b.stopReason,'truncated-command');
 assert.equal(b.commands.length,0);
 const c=inspect(fixture(0),{address:0,family:'RSE',maxBytes:1});
 assert.equal(c.stopReason,'truncated-command');
});
test('trainerbattle pointer hints remain unverified generic battle data',()=>{
 const r=pointers(fixture(6),{address:0,family:'FRLG'});
 assert.equal(r.total,4);
 assert.equal(r.roles.trainerBattleData,4);
 assert.equal(r.statuses.inRom,4);
 assert.deepEqual(r.findings.map(f=>f.pointerSourceOffset),[6,10,14,18]);
 assert.equal(r.targetFormatVerified,false);
 assert.equal(r.writeAuthorized,false);
});
