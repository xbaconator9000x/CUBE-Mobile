/* Android-only bridge for user-triggered blob: downloads.
 * Backpressure: one <=48 KiB chunk per native acknowledgment.
 * The native side requires an explicit ACTION_CREATE_DOCUMENT selection.
 */
(() => {
  'use strict';
  if (!window.CubeExport || window.__cubeNativeExportInstalled) return;
  window.__cubeNativeExportInstalled = true;
  const MAX = 128 * 1024 * 1024, CHUNK = 48 * 1024;
  let blob = null, offset = 0, index = 0, waiting = false, chunkLength = 0;
  const post = data => window.CubeExport.postMessage(JSON.stringify(data));
  const reset = () => {
    blob = null; offset = 0; index = 0; waiting = false; chunkLength = 0;
  };
  window.__cubeNativeCancel = reset;
  async function pump() {
    if (!blob || waiting) return;
    if (offset === blob.size) {
      post({kind: 'finish'});
      reset();
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
    if (blob !== current || waiting) return;
    chunkLength = part.size;
    waiting = true;
    post({kind: 'chunk', index, data: base64});
  }
  window.__cubeNativeBegin = () => {
    pump().catch(() => {
      post({kind: 'abort'});
      reset();
    });
  };
  window.__cubeNativeAck = acknowledged => {
    if (!blob || !waiting || acknowledged !== index) return;
    offset += chunkLength;
    index++;
    waiting = false;
    pump().catch(() => {
      post({kind: 'abort'});
      reset();
    });
  };
  document.addEventListener('click', async event => {
    const target = event.target instanceof Element
      ? event.target.closest('a[download]') : null;
    if (!target || !target.href.startsWith('blob:')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (blob) {
      alert('Finish or cancel the current export first.');
      return;
    }
    try {
      const response = await fetch(target.href);
      if (!response.ok) throw new Error('Blob download unavailable');
      const value = await response.blob();
      if (value.size > MAX) throw new Error('Export exceeds 128 MiB limit');
      blob = value;
      offset = 0; index = 0; waiting = false;
      post({kind: 'start', name: target.download || 'cube-export.bin',
        mime: value.type || 'application/octet-stream', size: value.size});
    } catch (failure) {
      reset();
      alert('Export could not start: ' + failure.message);
    }
  }, true);
})();
