import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile PCS reference import is local-only and opt-in',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.match(html,/id="pcs-reference-picker"/);
  assert.match(html,/id="pcs-reference-clear"/);
  assert.match(html,/id="pcs-reference-status"/);
  assert.match(html,/unverified<\/b> against this ROM/);
  assert.match(app,/parseHmaPcsReference\(await file\.text\(\)\)/);
  assert.match(app,/pcsReference=parsed/);
  assert.match(app,/function installModel\(name,bytes\)\{[^}\n]*pcsReference=null/);
  assert.match(app,/decodeHmaPcsReference\(model,/);
});

test('offline standalone includes parseable PCS reference inspector and local picker',()=>{
  const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
  assert.match(html,/id="pcs-reference-picker"/);
  assert.match(html,/function parseHmaPcsReference\(/);
  assert.match(html,/function decodeHmaPcsReference\(/);
  const match=/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/.exec(html);
  assert.ok(match,'standalone application script exists');
  assert.doesNotThrow(()=>new Script(match[1]));
});
