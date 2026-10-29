import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectReleaseSignature, verifyReleaseApk } from '../scripts/verify-android-release.mjs';

const PIN = 'ab'.repeat(32);
const SIGNED = [
  'Verifies',
  'Verified using v1 scheme (JAR signing): false',
  'Verified using v2 scheme (APK Signature Scheme v2): true',
  'Verified using v3 scheme (APK Signature Scheme v3): false',
  'Number of signers: 1',
  'Signer #1 certificate SHA-256 digest: ' + PIN
].join('\n');

test('requires verified v2 signature and exactly one pinned signer', () => {
  assert.equal(inspectReleaseSignature(SIGNED, PIN), PIN);
  assert.equal(inspectReleaseSignature(SIGNED, PIN.toUpperCase().match(/../g).join(':')), PIN);
  for (const changed of [
    SIGNED.replace('Verifies', 'DOES NOT VERIFY'),
    SIGNED.replace('v2): true', 'v2): false'),
    SIGNED.replace('Number of signers: 1', 'Number of signers: 2'),
    SIGNED.replace('Signer #1 certificate', 'Signer #2 certificate'),
    SIGNED + '\nSigner #2 certificate SHA-256 digest: ' + PIN
  ]) assert.throws(() => inspectReleaseSignature(changed, PIN));
  assert.throws(() => inspectReleaseSignature(SIGNED, 'cd'.repeat(32)), /differs/);
  assert.throws(() => inspectReleaseSignature(SIGNED, ''), /pinned/);
  assert.throws(() => inspectReleaseSignature(SIGNED, '1234'), /Invalid/);
});

test('signed candidate requires exact packaged HTML, no ROM and remains not release-ready', () => {
  const root = mkdtempSync(join(tmpdir(), 'cube-signed-candidate-'));
  try {
    mkdirSync(join(root, 'assets'));
    const html = join(root, 'source.html');
    writeFileSync(html, '<html>Verified offline asset</html>');
    writeFileSync(join(root, 'assets/index.html'), '<html>Verified offline asset</html>');
    writeFileSync(join(root, 'AndroidManifest.xml'), 'synthetic manifest');
    const apk = join(root, 'candidate.apk');
    execFileSync('zip', ['-q', apk, 'assets/index.html', 'AndroidManifest.xml'], { cwd: root });
    const args = {
      apkPath: apk, htmlPath: html, expectedVersion: '0.5.9',
      expectedFingerprint: PIN, signatureOutput: SIGNED,
      badging: "package: name='com.pokebacon.cubemobile' versionCode='1' versionName='0.5.9'\napplication-label:'CUBE Mobile'\n",
      permissions: 'package: com.pokebacon.cubemobile\n'
    };
    const report = verifyReleaseApk(args);
    assert.equal(report.releaseSigned, true);
    assert.equal(report.releaseReady, false);
    assert.equal(report.semanticRomCompatibilityVerified, false);
    assert.equal(report.physicalDeviceVerified, false);
    assert.equal(report.signingCertificateSha256, PIN);
    assert.throws(() => verifyReleaseApk({
      ...args, badging: args.badging + 'application-debuggable\\n'
    }), /must not be debuggable/);
    writeFileSync(html, 'tampered');
    assert.throws(() => verifyReleaseApk(args), /differs/);
    writeFileSync(html, '<html>Verified offline asset</html>');
    writeFileSync(join(root, 'assets/copyrighted.gba'), 'fake');
    execFileSync('zip', ['-q', apk, 'assets/copyrighted.gba'], { cwd: root });
    assert.throws(() => verifyReleaseApk(args), /ROM or save asset/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
