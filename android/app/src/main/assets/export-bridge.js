/* Android-only bridge for user-triggered blob: downloads.
 * Backpressure: one <=48 KiB chunk per native acknowledgment.
 * Every native callback is scoped to a unique export session to prevent
 * delayed callbacks from advancing or cancelling a later export.
 * The native side requires an explicit ACTION_CREATE_DOCUMENT selection.
 */
(() => {
  'use strict';
  if (!window.CubeExport || window.__cubeNativeExportInstalled) return;
  window.__cubeNativeExportInstalled = true;
  const MAX = 128 * 1024 * 1024, CHUNK = 48 * 1024;
  let blob = null, offset = 0, index = 0, waiting = false, chunkLength = 0;
  let sequence = 0, session = null, preparing = false;
  const post = data => window.CubeExport.postMessage(JSON.stringify(data));
  // Android-only 48px touch target, visible throughout picker/stream/readback.
  // It does not exist in the browser/PWA build.
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel export';
  cancelButton.setAttribute('aria-label', 'Cancel current document export');
  cancelButton.style.cssText = 'position:fixed;right:16px;bottom:16px;' +
    'min-height:48px;min-width:120px;padding:10px 16px;z-index:2147483647;' +
    'border:2px solid #fff;border-radius:10px;background:#742020;' +
    'color:#fff;font:600 16px system-ui,sans-serif;box-shadow:0 2px 12px #0008';
  cancelButton.hidden = true;
  document.body.appendChild(cancelButton);
  const reset = () => {
    blob = null; offset = 0; index = 0; waiting = false; chunkLength = 0;
    session = null; preparing = false; cancelButton.hidden = true;
  };
  cancelButton.addEventListener('click', () => {
    if (!session) return;
    const active = session;
    post({kind: 'abort', session: active});
    reset();
  });
  window.__cubeNativeCancel = id => {
    if (id === session) reset();
  };
  window.__cubeNativeComplete = id => {
    if (id === session) reset();
  };
  async function pump() {
    if (!blob || waiting || !session) return;
    const active = session;
    if (offset === blob.size) {
      waiting = true; // Native readback must finish before a new export starts.
      post({kind: 'finish', session: active});
      return;
    }
    const current = blob;
    const part = current.slice(offset, Math.min(current.size, offset + CHUNK));
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Unable to read export chunk'));
      reader.readAsDataURL(part);
    });
    if (blob !== current || session !== active || waiting) return;
    chunkLength = part.size;
    waiting = true;
    post({kind: 'chunk', session: active, index, data: base64});
  }
  const fail = id => {
    if (id !== session) return;
    post({kind: 'abort', session: id});
    reset();
  };
  window.__cubeNativeBegin = id => {
    if (id !== session) return;
    pump().catch(() => fail(id));
  };
  window.__cubeNativeAck = (id, acknowledged) => {
    if (id !== session || !blob || !waiting || acknowledged !== index) return;
    offset += chunkLength;
    index++;
    waiting = false;
    pump().catch(() => fail(id));
  };
  document.addEventListener('click', async event => {
    const target = event.target instanceof Element
      ? event.target.closest('a[download]') : null;
    if (!target || !target.href.startsWith('blob:')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (blob || preparing) {
      alert('Finish or cancel the current export first.');
      return;
    }
    preparing = true;
    try {
      const response = await fetch(target.href);
      if (!response.ok) throw new Error('Blob download unavailable');
      const value = await response.blob();
      if (value.size > MAX) throw new Error('Export exceeds 128 MiB limit');
      blob = value;
      offset = 0; index = 0; waiting = false;
      session = String(++sequence);
      preparing = false;
      cancelButton.hidden = false;
      post({kind: 'start', session, name: target.download || 'cube-export.bin',
        mime: value.type || 'application/octet-stream', size: value.size});
    } catch (failure) {
      reset();
      alert('Export could not start: ' + failure.message);
    }
  }, true);
})();
