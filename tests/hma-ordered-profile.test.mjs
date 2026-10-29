import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLocalOrderedProfileOverlay,compareLocalOrderedProfileOverlay}
 from '../src/hma-ordered-profile.js';

const sha=n=>String(n).repeat(64);
const entries=[
 {name:'base.toml',length:12,sha256:sha('a')},
 {name:'cube.toml',length:17,sha256:sha('b')}
];
const profile={metadataSha256:sha('a'),metadataFiles:entries};
const manifest={files:entries.map(e=>({...e}))};

test('exact ordered multi-file claims are consistent but never authenticate CUBE',()=>{
 const overlay=validateLocalOrderedProfileOverlay(profile);
 const result=compareLocalOrderedProfileOverlay(overlay,manifest,entries);
 assert.equal(result.status,'consistent-ordered-byte-claims');
 assert.equal(result.consistentExactByteClaims,true);
 for(const key of ['independentlyAuthenticated','metadataAuthenticated',
   'cubeLayoutAuthenticated','semanticWritesAllowed'])
  assert.equal(result[key],false,key);
 assert.ok(Object.isFrozen(overlay)&&Object.isFrozen(overlay[0])&&Object.isFrozen(result));
 assert.equal(validateLocalOrderedProfileOverlay({metadataSha256:sha('a')}),null);
});

test('ordered profile refuses reordered, missing and altered metadata',()=>{
 const overlay=validateLocalOrderedProfileOverlay(profile);
 assert.equal(compareLocalOrderedProfileOverlay(overlay,manifest,[...entries].reverse()).status,
  'profile-ordered-file-set-mismatch');
 assert.equal(compareLocalOrderedProfileOverlay(overlay,manifest,entries.slice(0,1)).status,
  'profile-ordered-file-set-mismatch');
 assert.equal(compareLocalOrderedProfileOverlay(overlay,manifest,
  [{...entries[0],sha256:sha('c')},entries[1]]).status,
  'profile-ordered-file-byte-mismatch');
 assert.equal(compareLocalOrderedProfileOverlay(overlay,
  {files:[entries[0],{...entries[1],sha256:sha('c')}]},entries).status,
  'profile-ordered-file-byte-mismatch');
});

test('invalid overlay claims reject ambiguous names, paths, size and legacy mismatch',()=>{
 const bad=[
  {metadataFiles:[]},
  {metadataFiles:[...entries,{...entries[0],name:'BASE.toml'}]},
  {metadataFiles:[{...entries[0],name:'../base.toml'}]},
  {metadataFiles:[{...entries[0],name:'dir/base.toml'}]},
  {metadataFiles:[{...entries[0],length:0}]},
  {metadataFiles:[{...entries[0],length:4*1024*1024+1}]},
  {metadataFiles:[{...entries[0],sha256:'not-a-sha'}]},
  {metadataFiles:[{...entries[0],sha256:sha('b')}]},
  {metadataFiles:Array.from({length:17},(_,i)=>({...entries[0],name:'f'+i+'.toml'}))}
 ];
 for(const change of bad)
  assert.throws(()=>validateLocalOrderedProfileOverlay({...profile,...change}),RangeError);
 assert.deepEqual(entries,profile.metadataFiles,'validation never changes caller input');
});
