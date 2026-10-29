/**
 * Read-only intersection of two independently represented provenance claims:
 * exact ROM profile and ordered HMA/CUBHMA TOML manifest.
 *
 * Sources: kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc
 * StoredMetadata/MapModel metadata overlays. No ROMs or TOML bytes bundled.
 * Matching injected registries remain untrusted and NEVER authorize writes.
 */
import {CURATED_ROM_PROFILES,compareRomIdentity,
  compareRomProfileManifestClaims} from './rom-compatibility.js';
import {CURATED_HMA_METADATA_MANIFESTS,
  compareHmaMetadataManifest} from './hma-metadata-manifest.js';

/**
 * The caller supplies a live RomModel, its snapshot-bound SHA-256 result,
 * and ordered exact-byte TOML fingerprints (not decoded/normalized text).
 * Both registries must be independently curated before any claim of trusted
 * provenance; both bundled registries are intentionally empty.
 *
 * An exact manifest match alone does not bind a single-digest ROM profile
 * to multiple overlay files. We surface that gap explicitly.
 */
export function compareRomHmaProvenance(model,romFingerprint,metadataFingerprints,{
  profiles=CURATED_ROM_PROFILES,manifests=CURATED_HMA_METADATA_MANIFESTS
}={}){
  // Validate BOTH sources on every invocation, including stale ROM results.
  // Their comparators reject malformed registries and metadata records.
  const rom=compareRomIdentity(model,romFingerprint,{profiles});
  const metadata=compareHmaMetadataManifest(model,romFingerprint,
    metadataFingerprints,{manifests});
  let status;
  if(rom.status==='stale'||metadata.status==='stale')status='stale';
  else if(rom.status==='profile-conflict'||metadata.status==='rom-header-conflict')
    status='rom-header-conflict';
  else if(rom.status!=='profile-match')status='rom-profile-unavailable';
  else if(metadata.status==='unknown-rom')status='ordered-manifest-unavailable';
  else if(metadata.status!=='exact-file-set-match')status=metadata.status;
  else status=compareRomProfileManifestClaims(
    rom.profile,metadata.manifest,metadata.metadataFiles).status;
  return Object.freeze({
    status,romStatus:rom.status,manifestStatus:metadata.status,
    metadataFileCount:metadata.metadataFiles.length,
    consistentExactByteClaims:status==='consistent-exact-byte-claims',
    readOnly:true,independentlyAuthenticated:false,
    metadataAuthenticated:false,cubeLayoutAuthenticated:false,
    semanticWritesAllowed:false,exclusiveOwnershipProven:false,
    gameEmulatorVerified:false,androidHardwareVerified:false,
    strictParityEvidence:false
  });
}
