/**
 * Exact public upstream CUBE Emerald TOML provenance, not ROM authentication.
 * Pinned source: kcradi/CUBHMA at 3044393183e01af2ae1e907fb37e4a75eda6a8dc.
 * The original 435,942-byte TOML is not redistributed or embedded.
 * A local file with identical bytes establishes only its source identity.
 */
import {createHash} from 'node:crypto';

export const PINNED_CUBE_EMERALD_TOML=Object.freeze({
 repository:'kcradi/CUBHMA',
 commit:'3044393183e01af2ae1e907fb37e4a75eda6a8dc',
 path:'src/HexManiac.Core/ViewModels/QuickEditItems/cube_emerald.toml',
 byteLength:435942,
 sha256:'09bf893bb7bf06fefe88e3721129ca443927f9e36bc3320316a6bdb383b3f068',
 gitBlobSha:'1261b72a7d07a242b48a6f0517c625e14812ae78'
});

/** Read-only exact-byte check; never accepts a caller-supplied expected hash. */
export function inspectPinnedCubeEmeraldToml(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>4*1024*1024)
  throw new RangeError('Expected bounded raw TOML bytes');
 const exactUpstreamBytes=bytes.length===PINNED_CUBE_EMERALD_TOML.byteLength&&
  createHash('sha256').update(bytes).digest('hex')===PINNED_CUBE_EMERALD_TOML.sha256;
 return Object.freeze({
  exactUpstreamBytes,
  metadataSourceVerified:exactUpstreamBytes,
  romBuildAuthenticated:false,
  globalPointerOwnershipProven:false,
  writeAuthorized:false,
  strictParityEvidence:false
 });
}
