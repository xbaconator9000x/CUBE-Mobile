import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ROM_ASSET = /\.(?:gba|gbc|gb|rom|sav|srm)$/i;
const MAX_HTML_BYTES = 64 * 1024 * 1024;

export function inspectZipEntries(raw) {
  const entries = raw.split(/\r?\n/).filter(Boolean);
  if (!entries.length) throw Error('APK has no ZIP entries');
  const seen = new Set();
  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('\\') ||
        entry.split('/').some(part => part === '..' || part === '.') ||
        /[\x00-\x1f\x7f]/.test(entry)) throw Error('Unsafe APK ZIP entry');
    if (seen.has(entry)) throw Error('Duplicate APK ZIP entry');
    seen.add(entry);
    if (ROM_ASSET.test(entry)) throw Error('ROM or save asset bundled in APK');
  }
  if (!seen.has('assets/index.html')) throw Error('Offline app HTML missing from APK');
  if (!seen.has('AndroidManifest.xml')) throw Error('Android manifest missing from APK');
  return entries.length;
}

export function inspectAapt(badging, permissions, expectedVersion) {
  const match = badging.match(/^package:\s+name='([^']+)'\s+versionCode='([^']+)'\s+versionName='([^']+)'/m);
  if (!match) throw Error('Cannot establish APK package identity');
  const [, applicationId, versionCode, versionName] = match;
  if (applicationId !== 'com.pokebacon.cubemobile' ||
      !/^[1-9]\d*$/.test(versionCode) || versionName !== expectedVersion) {
    throw Error('APK identity/version mismatch');
  }
  if (!/^application-label:'CUBE Mobile'$/m.test(badging)) {
    throw Error('APK application label mismatch');
  }
  // The offline shell uses SAF picker grants, never broad storage permissions.
  if (/^\s*(?:uses-permission|uses-permission-sdk-\d+):/m.test(permissions)) {
    throw Error('Unexpected Android permission in offline APK');
  }
  return { applicationId, versionCode: Number(versionCode), versionName };
}

export function verifyApk({ apkPath, htmlPath, expectedVersion, aaptPath = 'aapt',
  badging, permissions }) {
  if (!apkPath || !htmlPath || !expectedVersion) throw Error('Missing APK verification inputs');
  const entries = execFileSync('unzip', ['-Z1', apkPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const entryCount = inspectZipEntries(entries);
  const html = readFileSync(htmlPath);
  if (!html.length || html.length > MAX_HTML_BYTES) throw Error('Offline HTML size invalid');
  const packaged = execFileSync('unzip', ['-p', apkPath, 'assets/index.html'],
    { maxBuffer: MAX_HTML_BYTES + 1024 });
  if (!packaged.equals(html)) throw Error('APK HTML differs from verified offline build');
  const identity = inspectAapt(
    badging ?? execFileSync(aaptPath, ['dump', 'badging', apkPath], { encoding: 'utf8' }),
    permissions ?? execFileSync(aaptPath, ['dump', 'permissions', apkPath], { encoding: 'utf8' }),
    expectedVersion);
  return {
    schema: 'cube-mobile-android-debug-provenance/1',
    ...identity,
    apkSha256: hash(readFileSync(apkPath)),
    offlineHtmlSha256: hash(html),
    zipEntryCount: entryCount,
    releaseSigned: false,
    semanticRomCompatibilityVerified: false,
    physicalDeviceVerified: false
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const apkPath = process.argv[2];
    const aaptPath = process.argv[3] || 'aapt';
    if (!apkPath) throw Error('Usage: node scripts/verify-android-apk.mjs <debug.apk> [aapt-path]');
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const result = verifyApk({ apkPath, aaptPath, expectedVersion: pkg.version,
      htmlPath: resolve(ROOT, 'app/CUBHMA_Mobile_Lab_Offline.html') });
    writeFileSync(apkPath + '.provenance.json', JSON.stringify(result, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
    console.log('Verified offline debug APK; SHA-256 ' + result.apkSha256);
  } catch (error) {
    console.error('Android APK verification failed: ' + error.message);
    process.exitCode = 1;
  }
}
