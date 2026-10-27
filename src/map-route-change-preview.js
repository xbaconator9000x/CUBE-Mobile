/**
 * Read-only impact of proposed VANILLA warp changes on shortest RAW routes.
 * Uses typed queued review/ownership checks, a stale-checked byte overlay and
 * the canonical atlas route inspector. Never writes a ROM or grants authority.
 */
import {reviewVanillaChangeSet,createVanillaReviewedChangeOverlay} from './map-change-review.js';
import {auditVanillaQueuedChangeRoundtrip} from './map-change-roundtrip.js';
import {inspectVanillaAtlasRawRoute} from './map-route-explorer.js';

export function compareVanillaReviewedRawRoute(source,atlas,previews,{
 originBank=0,originMap=0,targetBank,targetMap,
 maxMaps=128,maxLinks=8192,maxHops=128,maxChanges=16
}={}){
 if(!Number.isSafeInteger(maxChanges)||maxChanges<1||maxChanges>64)
  throw new RangeError('Route change preview budget must be 1–64 records');
 const review=reviewVanillaChangeSet(source,previews,{
  maxChanges,maxBytes:2048
 });
 if(review.entries.some(e=>e.kind!=='warp'))
  throw new RangeError('Raw route comparison requires warp-only reviewed changes');
 // Decode every changed field for every declared owner before deriving paths.
 // Shared pointers and structural conflicts are checked by the typed audit.
 const typed=auditVanillaQueuedChangeRoundtrip(source,atlas,previews,{
  maxChanges,maxBytes:2048,maxOwners:32
 });
 if(!typed.typedRoundtripPassed||typed.records!==review.count)
  throw new RangeError('Typed reviewed warp provenance was not verified');
 const overlay=createVanillaReviewedChangeOverlay(source,previews,{
  maxChanges,maxBytes:2048
 });
 const opts={originBank,originMap,targetBank,targetMap,
  maxMaps,maxLinks,maxHops};
 const before=inspectVanillaAtlasRawRoute(source,atlas,opts);
 const after=inspectVanillaAtlasRawRoute(overlay.source,atlas,opts);
 const routeChanged=before.status!==after.status||
  JSON.stringify(before.steps)!==JSON.stringify(after.steps);
 return Object.freeze({
  before,after,routeChanged,reviewedWarps:review.count,
  changedBytes:review.changedBytes,checkedOwners:typed.checkedOwners,
  typedPreviewRoundtripPassed:true,
  readOnly:true,previewOnly:true,transactionCommitted:false,
  writeAuthorized:false,layoutAuthenticated:false,
  gameplayReachabilityVerified:false,cubeCompatibilityVerified:false,
  independentParityEvidence:false
 });
}
