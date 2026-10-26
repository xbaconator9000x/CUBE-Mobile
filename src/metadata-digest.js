/**
 * Hash the exact imported metadata bytes. No newline normalization, trimming,
 * re-encoding of a parsed string, or filename-based trust.
 * This is an identity check only; it cannot authorize semantic writes.
 */
export async function hashMetadataBytes(bytes, {cryptoProvider=globalThis.crypto}={}) {
  if (!(bytes instanceof Uint8Array) || bytes.length===0 || bytes.length>4*1024*1024)
    throw Error('Metadata bytes must be a non-empty Uint8Array of at most 4 MiB');
  if (!cryptoProvider?.subtle?.digest) throw Error('SHA-256 is unavailable');
  const snapshot=Uint8Array.from(bytes);
  const digest=await cryptoProvider.subtle.digest('SHA-256',snapshot);
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export function compareMetadataDigest(actual, expected) {
  const valid = v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
  if(!valid(actual)||!valid(expected))throw Error('Expected two SHA-256 hex digests');
  return {matches:actual.toLowerCase()===expected.toLowerCase(),
    authorizesWrites:false,provenanceVerified:false};
}
