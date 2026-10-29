import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectZipEntries, inspectAapt, verifyApk } from '../scripts/verify-android-apk.mjs';

const BADGING = "package: name='com.pokebacon.cubemobile' versionCode='1' versionName='0.5.9'\napplication-label:'CUBE Mobile'\n";
const PERMISSIONS = "package: com.pokebacon.cubemobile\n";

test('rejects duplicate entries, traversal, ROM/save assets and missing app HTML', () => {
  for (const names of [
    'assets/index.html\nassets/index.html\nAndroidManifest.xml\n',
    '../assets/index.html\nAndroidManifest.xml\n',
    'assets/index.html\nAndroidManifest.xml\nassets/pokemon.GBA\n',
    'assets/index.html\nAndroidManifest.xml\nsaves/user.srm\n',
    'AndroidManifest.xml\n']) {
    assert.throws(() => inspectZipEntries(names));
  }
  assert.equal(inspectZipEntries('assets/index.html\nAndroidManifest.xml\nclasses.dex\n'), 3);
});

test('rejects unexpected permissions, application IDs, labels and versions', () => {
  assert.deepEqual(inspectAapt(BADGING, PERMISSIONS, '0.5.9'),
    { applicationId: 'com.pokebacon.cubemobile', versionCode: 1, versionName: '0.5.9' });
  assert.throws(() => inspectAapt(BADGING, "uses-permission: name='android.permission.INTERNET'", '0.5.9'));
  assert.throws(() => inspectAapt(BADGING.replace('cubemobile', 'wrongapp'), PERMISSIONS, '0.5.9'));
  assert.throws(() => inspectAapt(BADGING, PERMISSIONS, '0.6.0'));
  assert.throws(() => inspectAapt(BADGING.replace('CUBE Mobile', 'Unknown'), PERMISSIONS, '0.5.9'));
});

test('verifies actual ZIP offline HTML bytes and refuses altered or extra ROM assets', () => {
  const root = mkdtempSync(join(tmpdir(), 'cube-apk-test-'));
  try {
    const source = join(root, 'offline.html');
    const contents = '<html><body>Offline CUBE</body></html>';
    writeFileSync(source, contents);
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'assets/index.html'), contents);
    writeFileSync(join(root, 'AndroidManifest.xml'), 'fake manifest');
    const apk = join(root, 'test.apk');
    execFileSync('zip', ['-q', apk, 'assets/index.html', 'AndroidManifest.xml'], { cwd: root });
    const args = { apkPath: apk, htmlPath: source, expectedVersion: '0.5.9',
      badging: BADGING, permissions: PERMISSIONS };
    const report = verifyApk(args);
    assert.equal(report.releaseSigned, false);
    assert.equal(report.physicalDeviceVerified, false);
    assert.match(report.apkSha256, /^[a-f0-9]{64}$/);
    writeFileSync(source, 'altered');
    assert.throws(() => verifyApk(args), /differs/);
    writeFileSync(source, contents);
    writeFileSync(join(root, 'assets/secret.gba'), 'no ROM assets allowed');
    execFileSync('zip', ['-q', apk, 'assets/secret.gba'], { cwd: root });
    assert.throws(() => verifyApk(args), /ROM or save asset/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
