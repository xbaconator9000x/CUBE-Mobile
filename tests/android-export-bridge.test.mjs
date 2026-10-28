import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script = readFileSync(new URL('../android/app/src/main/assets/export-bridge.js', import.meta.url), 'utf8');
function harness(blob) {
  const messages = [];
  const anchor = {href: 'blob:local-test', download: 'synthetic.gba'};
  let click;
  class Element { closest(selector) { assert.equal(selector, 'a[download]'); return anchor; } }
  class FileReader {
    readAsDataURL(part) {
      part.arrayBuffer().then(bytes => {
        this.result = 'data:application/octet-stream;base64,' +
          Buffer.from(bytes).toString('base64');
        this.onload();
      }).catch(error => this.onerror(error));
    }
  }
  const window = {CubeExport: {postMessage: value => messages.push(JSON.parse(value))}};
  const document = {addEventListener: (event, handler, capture) => {
    assert.equal(event, 'click');
    assert.equal(capture, true);
    click = handler;
  }};
  runInNewContext(script, {window, document, Element, FileReader,
    fetch: async () => ({ok: true, blob: async () => blob}),
    alert: message => { throw new Error('Unexpected alert: ' + message); }});
  const trigger = async () => {
    let prevented = false, stopped = false;
    await click({target: new Element(),
      preventDefault: () => { prevented = true; },
      stopImmediatePropagation: () => { stopped = true; }});
    assert.ok(prevented && stopped);
  };
  return {messages, window, trigger};
}
async function until(predicate) {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error('Timed out waiting for export protocol message');
}

test('Android export bridge streams 48KiB chunks only after ACK and preserves bytes', async () => {
  const original = Buffer.alloc(110000);
  for (let i = 0; i < original.length; i++) original[i] = (i * 37) & 255;
  const h = harness(new Blob([original], {type: 'application/octet-stream'}));
  await h.trigger();
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].kind, 'start');
  assert.equal(h.messages[0].size, original.length);
  h.window.__cubeNativeBegin(h.messages[0].session);
  const received = [];
  for (let index = 0; index < 3; index++) {
    await until(() => h.messages.some(x => x.kind === 'chunk' && x.index === index));
    const chunks = h.messages.filter(x => x.kind === 'chunk');
    assert.equal(chunks.length, index + 1);
    const item = chunks[index];
    const bytes = Buffer.from(item.data, 'base64');
    assert.ok(bytes.length > 0 && bytes.length <= 48 * 1024);
    received.push(bytes);
    h.window.__cubeNativeAck(h.messages[0].session, index);
  }
  await until(() => h.messages.some(x => x.kind === 'finish'));
  assert.deepEqual(Buffer.concat(received), original);
  assert.equal(h.messages.filter(x => x.kind === 'finish').length, 1);
});

test('Android export bridge refuses blobs larger than 128MiB before native start', async () => {
  const h = harness({size: 128 * 1024 * 1024 + 1, type: '', slice() {}});
  let error = null;
  // The rejection is surfaced to the user as an alert rather than native IO.
  // The harness alert throws; the bridge does not post a start message.
  try { await h.trigger(); } catch (e) { error = e; }
  assert.match(String(error), /128 MiB/);
  assert.equal(h.messages.length, 0);
});

test('Android export bridge cancellation drops pending chunks', async () => {
  const h = harness(new Blob([Buffer.alloc(100000)]));
  await h.trigger();
  h.window.__cubeNativeBegin(h.messages[0].session);
  await until(() => h.messages.some(x => x.kind === 'chunk'));
  h.window.__cubeNativeCancel(h.messages[0].session);
  const before = h.messages.length;
  h.window.__cubeNativeAck(h.messages[0].session, 0);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.messages.length, before);
});

test('Android export bridge rejects delayed callbacks from an earlier session', async () => {
  const h = harness(new Blob([Buffer.alloc(100000)]));
  await h.trigger();
  const first = h.messages[0].session;
  h.window.__cubeNativeCancel(first);
  await h.trigger();
  const second = h.messages.findLast(x => x.kind === 'start').session;
  assert.notEqual(first, second);
  const before = h.messages.length;
  h.window.__cubeNativeBegin(first);
  h.window.__cubeNativeAck(first, 0);
  h.window.__cubeNativeComplete(first);
  h.window.__cubeNativeCancel(first);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.messages.length, before);
  h.window.__cubeNativeBegin(second);
  await until(() => h.messages.some(x => x.kind === 'chunk' && x.session === second));
  h.window.__cubeNativeAck(first, 0);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.messages.filter(x => x.kind === 'chunk' && x.session === second).length, 1);
  h.window.__cubeNativeAck(second, 0);
  await until(() => h.messages.filter(x => x.kind === 'chunk' && x.session === second).length === 2);
});

test('Android export bridge retains session until native readback completes', async () => {
  const h = harness(new Blob([Buffer.alloc(3)]));
  await h.trigger();
  const first = h.messages[0].session;
  h.window.__cubeNativeBegin(first);
  await until(() => h.messages.some(x => x.kind === 'chunk'));
  h.window.__cubeNativeAck(first, 0);
  await until(() => h.messages.some(x => x.kind === 'finish'));
  assert.equal(h.messages.filter(x => x.kind === 'finish')[0].session, first);
  await assert.rejects(h.trigger(), /Finish or cancel the current export first/);
  assert.equal(h.messages.filter(x => x.kind === 'start').length, 1);
  h.window.__cubeNativeComplete(first);
  await h.trigger();
  assert.equal(h.messages.filter(x => x.kind === 'start').length, 2);
  assert.notEqual(h.messages.findLast(x => x.kind === 'start').session, first);
});
