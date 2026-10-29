/**
 * Atomic, no-overwrite local publication for non-ROM patch artifacts.
 * Never follows a destination-directory symlink, and never replaces a file.
 */
import {constants} from 'node:fs';
import {open, lstat, realpath, link, unlink} from 'node:fs/promises';
import {createHash, randomBytes} from 'node:crypto';
import {resolve, dirname, basename, join} from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inode = (a,b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size;
async function absent(path) {
  try { await lstat(path); throw new RangeError('Artifact destination already exists'); }
  catch (e) { if (e?.code !== 'ENOENT') throw e; }
}
async function reopen(path, expected, identity) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || !inode(info,identity))
    throw new RangeError('Artifact pathname changed identity');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (!inode(before,identity)) throw new RangeError('Artifact inode changed');
    const data = await file.readFile(), after = await file.stat();
    if (!inode(before,after) || !data.equals(Buffer.from(expected)) ||
        hash(data) !== hash(expected))
      throw new RangeError('Artifact readback differs from staged bytes');
  } finally { await file.close(); }
}
export async function publishNewPatchArtifact(destinationPath, bytes, {verifyPublished}={}) {
  if (verifyPublished!==undefined && typeof verifyPublished!=='function')
    throw new RangeError('Invalid published patch verifier');
  if (typeof destinationPath !== 'string' || !destinationPath ||
      destinationPath.includes('\0') || !(bytes instanceof Uint8Array) ||
      bytes.length < 19 || bytes.length > 2 * 1024 * 1024)
    throw new RangeError('Invalid bounded patch artifact');
  const destination = resolve(destinationPath), parent = dirname(destination);
  if (await realpath(parent) !== parent)
    throw new RangeError('Artifact parent symlink traversal refused');
  await absent(destination);
  const stage = join(parent, '.' + basename(destination) +
    '.cube-patch-stage-' + randomBytes(12).toString('hex'));
  let staged = false, published = false, identity = null;
  try {
    const file = await open(stage, constants.O_WRONLY | constants.O_CREAT |
      constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    staged = true;
    try { await file.writeFile(bytes); await file.sync(); }
    finally { await file.close(); }
    identity = await lstat(stage);
    await reopen(stage, bytes, identity);
    await link(stage, destination); // atomic EEXIST, no overwrite
    published = true;
    const linked = await lstat(destination);
    if (!inode(linked,identity)) throw new RangeError('Artifact publication inode changed');
    await reopen(destination, bytes, linked);
    // Acceptance happens while the stage still exists. If replay or source
    // verification fails, catch removes only our newly linked destination.
    if (verifyPublished) await verifyPublished(destination);
    const dir = await open(parent, constants.O_RDONLY);
    try { await dir.sync(); } finally { await dir.close(); }
    await unlink(stage); staged = false;
    return Object.freeze({byteCount:bytes.length, atomicNoOverwrite:true,
      stagedReopenVerified:true, destinationReopenVerified:true,
      publishedAcceptanceVerified:!!verifyPublished});
  } catch (error) {
    if (published) {
      try {
        const now = await lstat(destination);
        if (identity && inode(now,identity)) await unlink(destination);
      } catch (e) { if (e?.code !== 'ENOENT') throw e; }
    }
    throw error;
  } finally {
    if (staged) try { await unlink(stage); }
    catch (e) { if (e?.code !== 'ENOENT') throw e; }
  }
}
