import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('phone navigation exposes every view in equal safe-area-aware touch targets',()=>{
 const html=read('index.html');
 const styles=read('src/styles.css');
 const app=read('src/app.js');
 const views=[...html.matchAll(/<section class="view(?: active)?" id="view-([^"]+)"/g)]
  .map(([,name])=>name);
 const nav=html.match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(nav,'mobile navigation exists');
 const tabs=[...nav.matchAll(/class="mobile-tab[^"]*" data-tab="([^"]+)"/g)]
  .map(([,name])=>name);
 assert.deepEqual(tabs,views);
 assert.match(styles,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(styles,/height:calc\(67px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(styles,/padding-bottom:env\(safe-area-inset-bottom\)/);
 assert.match(styles,/min-height:64px/);
 assert.match(app,/if\(el\.classList\.contains\('mobile-tab'\)\)\{\s*if\(el\.dataset\.tab===name\)el\.setAttribute\('aria-current','page'\)/);
});
