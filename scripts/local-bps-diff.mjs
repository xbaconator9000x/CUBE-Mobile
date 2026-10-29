#!/usr/bin/env node
/**
 * Local BPS patch export from explicit expected-byte raw edit plans.
 * This NEVER writes an edited ROM or asserts CUBE semantic compatibility.
 * Outputs only aggregate evidence, never ROM bytes, hashes or local paths.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {publishNewPatchArtifact} from './local-atomic-patch-artifact.mjs';
import {verifyLocalBpsPatch} from './local-bps-verify.mjs';
import {buildVerifiedBpsDiff} from '../src/bps-export.js';
import {applyBps} from '../src/core.js';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function parseLocalBpsArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 8)
    throw new RangeError('ROM, expected SHA-256, JSON edit plan and output path required');
  const keys = new Set(['--rom','--expected-sha256','--plan','--out']), args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!keys.has(argv[i]) || Object.hasOwn(args,argv[i]) ||
        typeof argv[i+1] !== 'string' || !argv[i+1] || argv[i+1].includes('\0'))
      throw new RangeError('Invalid or repeated local BPS argument');
    args[argv[i]] = argv[i+1];
  }
  if (Object.keys(args).length !== 4 ||
      !/^[0-9a-f]{64}$/i.test(args['--expected-sha256']))
    throw new RangeError('Complete arguments and exact SHA-256 required');
  if (resolve(args['--rom']) === resolve(args['--out']))
    throw new RangeError('Patch destination must differ from ROM source');
  return args;
}
export function parseExpectedBytePlan(bytes, source) {
  let plan;
  try { plan = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { throw new RangeError('Edit plan must be UTF-8 JSON'); }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) ||
      Object.keys(plan).length !== 1 || !Array.isArray(plan.edits) ||
      !plan.edits.length || plan.edits.length > 65536)
    throw new RangeError('Plan must contain 1–65536 expected-byte edits only');
  const edits = [], seen = new Set();
  for (const entry of plan.edits) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).sort().join(',') !== 'expected,offset,value' ||
        !Number.isSafeInteger(entry.offset) || entry.offset < 0 ||
        entry.offset >= source.length ||
        !Number.isInteger(entry.expected) || entry.expected < 0 || entry.expected > 255 ||
        !Number.isInteger(entry.value) || entry.value < 0 || entry.value > 255 ||
        seen.has(entry.offset) || source[entry.offset] !== entry.expected)
      throw new RangeError('Invalid, duplicate or stale expected-byte edit');
    seen.add(entry.offset);
    edits.push([entry.offset,entry.value]);
  }
  return edits;
}
export async function exportLocalBpsDiff(argv) {
  const args = parseLocalBpsArgs(argv);
  const source = await readStableLocalFile(args['--rom'],64*1024*1024);
  const expected = args['--expected-sha256'].toLowerCase();
  if (source.length < 0xC0 || digest(source) !== expected)
    throw new RangeError('Source ROM does not match exact expected SHA-256');
  const edits = parseExpectedBytePlan(await readStableLocalFile(args['--plan'],2*1024*1024),source);
  const patch = buildVerifiedBpsDiff(source,edits);
  const target = applyBps(source,patch);
  const changed = edits.filter(([at,value]) => source[at] !== value).length;
  if (changed < 1 || target.length !== source.length)
    throw new RangeError('BPS replay did not produce expected changed ROM');
  for (const [at,value] of edits)
    if (target[at] !== value) throw new RangeError('BPS replay disagrees with edit plan');
  const sourceAgain = await readStableLocalFile(args['--rom'],64*1024*1024);
  if (!sourceAgain.equals(source) || digest(sourceAgain) !== expected)
    throw new RangeError('Source ROM changed before patch publication');
  // Independently reopen the published artifact and replay it against the
  // source, including an exact target SHA-256. Any failed acceptance rolls
  // back only this publication, never the original ROM.
  const targetHash=digest(target);
  const published = await publishNewPatchArtifact(args['--out'],patch,{
    verifyPublished: async destination => {
      const report=await verifyLocalBpsPatch([
        '--rom',args['--rom'],'--patch',destination,
        '--expected-sha256',expected,'--expected-target-sha256',targetHash
      ]);
      if (!report.exactTargetSha256Matched || !report.sourcePreserved ||
          !report.patchReopenVerified)
        throw new RangeError('Published BPS replay acceptance failed');
    }
  });
  return Object.freeze({schema:'cube-mobile-local-bps-diff/1',
    proposedEdits:edits.length, changedBytes:changed, patchBytes:published.byteCount,
    exactSourceSha256Matched:true, patchReplayVerified:true,
    originalSourcePreserved:true, destinationReopenVerified:published.destinationReopenVerified,
    atomicNoOverwrite:published.atomicNoOverwrite,
    publishedPatchReplayed:published.publishedAcceptanceVerified,
    publishedTargetSha256Verified:published.publishedAcceptanceVerified,
    romModified:false,romExported:false,patchExported:true,
    cubeSemanticsAuthenticated:false,exclusiveOwnershipProven:false,
    emulatorVerified:false,androidHardwareVerified:false,
    semanticWritesAllowed:false,strictParityEvidence:false});
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.stdout.write(JSON.stringify(
    await exportLocalBpsDiff(process.argv.slice(2)),null,2)+'\n'); }
  catch {
    process.stderr.write('Local BPS export refused. No source ROM was modified.\n');
    process.exitCode = 2;
  }
}
