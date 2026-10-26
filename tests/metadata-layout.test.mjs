import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHmaMetadataLayout,checkHmaMetadataSources} from '../src/semantic.js';

function syntheticEmerald(){
  const rom=new Uint8Array(0x200);
  for(const [i,ch] of [...'BPEE'].entries())rom[0xAC+i]=ch.charCodeAt(0);
  rom[0xB2]=0x96;
  let sum=0;
  for(let i=0xA0;i<=0xBC;i++)sum=(sum+rom[i])&255;
  rom[0xBD]=(0x19-sum)&255;
  return rom;
}
const stock={name:'default.bpee.toml',text:"[[NamedAnchors]]\nName='vanilla'\nAddress=0x10\nFormat='[value.]1'\n"};
const expansion={name:'my-cube.toml',text:"[General]\nMetadataLayout = '''expansion'''\n\n[[NamedAnchors]]\nName='trainers'\nAddress=0x20\nFormat='[party<\x60tpte\x60>]1'\n"};
test('source-grounded CUBE layout marker is read as metadata evidence, not ROM proof',()=>{
  const result=inspectHmaMetadataLayout(expansion.text);
  assert.equal(result.kind,'expansion');
  assert.equal(result.marker,'expansion');
  assert.equal(result.viaTpte,true);
  assert.deepEqual(result.tpteAnchors,['trainers']);
});
test('trainer-party tpte run detects unmarked legacy expansion metadata',()=>{
  const result=inspectHmaMetadataLayout("[[NamedAnchors]]\nName='trainer.parties'\nAddress=0x10\nFormat='[party<\x60tpte\x60>]2'");
  assert.equal(result.kind,'expansion');
  assert.equal(result.marker,null);
  assert.equal(result.viaTpte,true);
});
test('unrelated tpte text is not misclassified as a named anchor',()=>{
  const result=inspectHmaMetadataLayout("[[List]]\nName='text'\n0='contains \x60tpte\x60'\n");
  assert.equal(result.kind,'unspecified');
});
test('known vanilla reference remains permitted but explicitly unauthenticated',()=>{
  const result=checkHmaMetadataSources([stock],syntheticEmerald());
  assert.equal(result.layout.kind,'unspecified');
  assert.equal(result.sources[0].kind,'stock-reference');
  assert.match(result.warning,/cannot authenticate CUBE/);
});
test('CUBE metadata imports alone remain read-only and allowed',()=>{
  const rom=syntheticEmerald(),before=rom.slice();
  const result=checkHmaMetadataSources([expansion],rom);
  assert.equal(result.layout.kind,'expansion');
  assert.equal(result.layout.viaTpte,true);
  assert.deepEqual(rom,before);
});
test('vanilla overlay is rejected even when the expansion ROM has a valid Emerald header',()=>{
  const rom=syntheticEmerald(),before=rom.slice();
  assert.throws(()=>checkHmaMetadataSources([stock,expansion],rom),/Refusing vanilla stock metadata overlay/);
  assert.deepEqual(rom,before);
});
test('unmarked tpte layout also rejects vanilla overlays',()=>{
  const legacy={name:'cube-old.toml',text:"[[NamedAnchors]]\nName='trainer'\nAddress=0x30\nFormat='\x60tpte\x60'"};
  assert.throws(()=>checkHmaMetadataSources([stock,legacy],syntheticEmerald()),/Refusing vanilla/);
});
test('unknown nonempty layout markers protect custom layouts from stock overlays',()=>{
  const custom={name:'custom.toml',text:"[General]\nMetadataLayout = 'my-custom-layout'\n"};
  assert.equal(checkHmaMetadataSources([custom],syntheticEmerald()).layout.kind,'custom');
  assert.throws(()=>checkHmaMetadataSources([stock,custom],syntheticEmerald()),/Refusing vanilla/);
});
test('conflicting explicit layout markers fail closed',()=>{
  const other={name:'other.toml',text:'[General]\nMetadataLayout = "another"\n'};
  assert.throws(()=>checkHmaMetadataSources([expansion,other],syntheticEmerald()),/Conflicting MetadataLayout/);
});
test('duplicate or malformed layout markers fail closed',()=>{
  for(const bad of [
    "MetadataLayout = '''expansion'''\nMetadataLayout = '''expansion'''",
    "MetadataLayout = expansion",
    "MetadataLayout = '''expansion",
    "MetadataLayout ="
  ])assert.throws(()=>inspectHmaMetadataLayout(bad),/MetadataLayout/);
});
test('empty marker and case-insensitive expansion marker match upstream semantics',()=>{
  assert.equal(inspectHmaMetadataLayout("MetadataLayout = ''''''").kind,'unspecified');
  assert.equal(inspectHmaMetadataLayout("MetadataLayout = '''ExPaNsIoN'''").kind,'expansion');
});
test('metadata layout parser enforces bounded input',()=>{
  assert.throws(()=>inspectHmaMetadataLayout('a'.repeat(4*1024*1024+1)),/4 MiB/);
});

test('filename-only guard remains compatible but provides no expansion evidence',()=>{
 const result=checkHmaMetadataSources([{name:'default.bpee.toml'}],syntheticEmerald());
 assert.equal(result.layout.kind,'unspecified');
 assert.equal(result.sources[0].kind,'stock-reference');
});
test('supplied non-text metadata still fails closed',()=>{
 assert.throws(()=>checkHmaMetadataSources([{name:'custom.toml',text:42}],syntheticEmerald()),/TOML text/);
});
