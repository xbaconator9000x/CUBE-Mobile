import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPinnedCubeEmeraldToml,PINNED_CUBE_EMERALD_TOML} from '../scripts/pinned-cube-metadata.mjs';

test('pinned public upstream source is recorded by exact blob identity without bundling metadata',()=>{
 assert.equal(PINNED_CUBE_EMERALD_TOML.byteLength,435942);
 assert.equal(PINNED_CUBE_EMERALD_TOML.sha256,'09bf893bb7bf06fefe88e3721129ca443927f9e36bc3320316a6bdb383b3f068');
 assert.equal(PINNED_CUBE_EMERALD_TOML.gitBlobSha,'1261b72a7d07a242b48a6f0517c625e14812ae78');
 assert.equal(PINNED_CUBE_EMERALD_TOML.commit.length,40);
});
test('partial or synthetic TOML never impersonates exact upstream provenance',()=>{
 for(const data of [Buffer.from('[[NamedAnchors]]'),new Uint8Array(435942),
  Buffer.from('cube_emerald.toml')]){
  const report=inspectPinnedCubeEmeraldToml(data);
  assert.equal(report.exactUpstreamBytes,false);
  assert.equal(report.writeAuthorized,false);
  assert.equal(report.strictParityEvidence,false);
  assert.equal(report.romBuildAuthenticated,false);
 }
 for(const value of [null,{},new Uint8Array(),new Uint8Array(4*1024*1024+1)])
  assert.throws(()=>inspectPinnedCubeEmeraldToml(value),RangeError);
});
