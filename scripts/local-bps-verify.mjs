#!/usr/bin/env node
/**
 * Read-only local acceptance for an existing BPS patch against an owned ROM.
 * Caller-supplied SHA-256 values are identity assertions, not CUBE authentication.
 * Never writes a ROM, patch or report to disk and never prints private paths/hashes.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {applyBps} from '../src/core.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const HASH = /^[0-9a-f]{64}$/i;
const FLAGS = new Set(['--rom','--patch','--expected-sha256','--expected-target-sha256']);

export function parseLocalBpsVerifyArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 8)
    throw new RangeError('Exact ROM, patch and source/target digests required');
  const args = {};
  for (let i=0;i<argv.length;i+=2) {
    const key=argv[i], value=argv[i+1];
    if (!FLAGS.has(key) || Object.hasOwn(args,key) ||
        typeof value !== 'string' || !value || value.includes('\0'))
      throw new RangeError('Invalid or repeated BPS verification argument');
    args[key]=value;
  }
  if (Object.keys(args).length !== FLAGS.size ||
      !HASH.test(args['--expected-sha256']) ||
      !HASH.test(args['--expected-target-sha256']) ||
      resolve(args['--rom'])===resolve(args['--patch']))
    throw new RangeError('Distinct inputs and exact SHA-256 digests required');
  return args;
}

/**
 * Verify a previously exported BPS file by reopening the exact inputs,
 * replaying the patch and checking the entire expected target digest.
 * BPS CRC32 checks alone are not enough to establish target identity.
 */
export async function verifyLocalBpsPatch(argv) {
  const args=parseLocalBpsVerifyArgs(argv);
  const source=await readStableLocalFile(args['--rom'],64*1024*1024);
  const patch=await readStableLocalFile(args['--patch'],2*1024*1024);
  if (source.length<0xC0 || patch.length<19 ||
      sha256(source)!==args['--expected-sha256'].toLowerCase())
    throw new RangeError('Source ROM identity or bounded patch input refused');
  const patchHash=sha256(patch);
  const target=applyBps(source,patch); // independently validates all three BPS CRC32 fields
  const targetHash=sha256(target);
  if (targetHash!==args['--expected-target-sha256'].toLowerCase())
    throw new RangeError('Replayed target does not match exact expected SHA-256');
  let changedBytes=0;
  for (let i=0;i<Math.min(source.length,target.length);i++)
    if (source[i]!==target[i]) changedBytes++;
  changedBytes+=Math.abs(target.length-source.length);
  if (!changedBytes) throw new RangeError('Patch produces no changed ROM bytes');

  // Both inputs must still be the same inode-backed contents after replay.
  const [sourceAgain,patchAgain]=await Promise.all([
    readStableLocalFile(args['--rom'],64*1024*1024),
    readStableLocalFile(args['--patch'],2*1024*1024)
  ]);
  if (!sourceAgain.equals(source) || sha256(sourceAgain)!==sha256(source) ||
      !patchAgain.equals(patch) || sha256(patchAgain)!==patchHash)
    throw new RangeError('Source ROM or patch changed during acceptance');
  return Object.freeze({
    schema:'cube-mobile-local-bps-reopen-acceptance/1',
    sourceBytes:source.length,targetBytes:target.length,patchBytes:patch.length,
    changedBytes,exactSourceSha256Matched:true,exactTargetSha256Matched:true,
    patchCrcAndSourceTargetCrcVerified:true,patchReopenVerified:true,
    sourceReopenVerified:true,sourcePreserved:true,
    romModified:false,romExported:false,patchExported:false,
    independentlyAuthenticatedCubeRom:false,exclusiveOwnershipProven:false,
    gameEmulatorVerified:false,androidHardwareVerified:false,
    semanticWritesAllowed:false,strictParityEvidence:false,readOnly:true
  });
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try { process.stdout.write(JSON.stringify(
    await verifyLocalBpsPatch(process.argv.slice(2)),null,2)+'\n'); }
  catch {
    process.stderr.write('Local BPS acceptance refused; inputs were not modified.\n');
    process.exitCode=2;
  }
}
