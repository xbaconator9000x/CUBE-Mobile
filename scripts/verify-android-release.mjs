import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyApk } from './verify-android-apk.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function digest(value) {
  if (typeof value !== 'string') throw Error('Missing pinned release certificate SHA-256');
  const normalized = value.replace(/:/g, '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw Error('Invalid pinned release certificate SHA-256');
  }
  return normalized;
}

/** Parse actual apksigner --verbose --print-certs output, never just a ZIP signature. */
export function inspectReleaseSignature(output, expectedFingerprint) {
  const expected = digest(expectedFingerprint);
  if (typeof output !== 'string' || !/^Verifies\s*$/m.test(output)) {
    throw Error('APK signature did not verify');
  }
  if (!/^Verified using v2 scheme \(APK Signature Scheme v2\): true\s*$/m.test(output)) {
    throw Error('APK Signature Scheme v2 verification is required');
  }
  if (!/^Number of signers: 1\s*$/m.test(output)) {
    throw Error('Exactly one APK signer is required');
  }
  const signers = [...output.matchAll(/^Signer #(\d+) certificate SHA-256 digest:\s*([0-9a-fA-F:]+)\s*$/gm)];
  if (signers.length !== 1 || signers[0][1] !== '1') {
    throw Error('Cannot establish unique APK signing certificate');
  }
  const actual = digest(signers[0][2]);
  if (actual !== expected) throw Error('APK signing certificate differs from pinned release identity');
  return actual;
}

export function verifyReleaseApk({ apkPath, htmlPath, expectedVersion, aaptPath,
  apksignerPath = 'apksigner', expectedFingerprint, signatureOutput, badging, permissions }) {
  const certificateSha256 = inspectReleaseSignature(
    signatureOutput ?? execFileSync(apksignerPath,
      ['verify', '--verbose', '--print-certs', apkPath], { encoding: 'utf8' }),
    expectedFingerprint);
  const base = verifyApk({ apkPath, htmlPath, expectedVersion, aaptPath, badging, permissions });
  return {
    ...base,
    schema: 'cube-mobile-android-signed-candidate-provenance/1',
    releaseSigned: true,
    signingCertificateSha256: certificateSha256,
    semanticRomCompatibilityVerified: false,
    physicalDeviceVerified: false,
    releaseReady: false
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const apkPath = process.argv[2];
    const aaptPath = process.argv[3] || 'aapt';
    const apksignerPath = process.argv[4] || 'apksigner';
    if (!apkPath) throw Error('Usage: node scripts/verify-android-release.mjs <release.apk> [aapt] [apksigner]');
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const result = verifyReleaseApk({
      apkPath, aaptPath, apksignerPath, expectedVersion: pkg.version,
      expectedFingerprint: process.env.CUBE_RELEASE_CERT_SHA256,
      htmlPath: resolve(ROOT, 'app/CUBHMA_Mobile_Lab_Offline.html')
    });
    writeFileSync(apkPath + '.provenance.json', JSON.stringify(result, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
    console.log('Verified signed candidate APK; SHA-256 ' + result.apkSha256);
  } catch (error) {
    console.error('Signed APK verification failed: ' + error.message);
    process.exitCode = 1;
  }
}
