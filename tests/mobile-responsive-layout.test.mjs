import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('phone toolbar cards constrain long inspector controls to the viewport',()=>{
 const styles=read('src/styles.css');
 const rules=styles.slice(styles.lastIndexOf('@media(max-width:590px){'));
 assert.ok(rules.length>0,'narrow toolbar layout rules exist');
 assert.match(styles,/\.input-row\{flex-wrap:wrap;min-width:0\}/);
 assert.match(styles,/\.input-row>\*{min-width:0;max-width:100%}/);
 assert.match(rules,/\.toolbar-card>\*{min-width:0;max-width:100%}/);
 assert.match(rules,/\.toolbar-card \.input-row{flex-wrap:wrap;min-width:0}/);
 assert.match(rules,/\.toolbar-card \.subtle-button,\.toolbar-card \.secondary-button\{white-space:normal;overflow-wrap:anywhere\}/);
 assert.match(rules,/\.primary-button,\.secondary-button,\.subtle-button\{white-space:normal;overflow-wrap:anywhere\}/);
});
