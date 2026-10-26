import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHmaNamedAnchors,readAnchorInspection,filterAnchors,groupAnchors} from '../src/semantic.js';

const src="[[NamedAnchors]]\nName = '''graphics.pokemon.front'''\nAddress = 0x10\nFormat = '''`lzs4x64x64`'''\n\n[[NamedAnchors]]\nName = 'data.pokemon.stats'\nAddress = 0x30\nFormat = '[hp. atk.]386'\n\n[[NamedAnchors]]\nName = 'outside'\nAddress = 0x1000\n";
test('HMA NamedAnchors TOML indexing',()=>{const a=parseHmaNamedAnchors(src,{romSize:256});assert.equal(a.length,3);assert.equal(a[0].name,'graphics.pokemon.front');assert.equal(a[1].address,48);assert.equal(a[2].valid,false);});
test('Invalid metadata addresses not converted to pointers',()=>assert.equal(parseHmaNamedAnchors("[[NamedAnchors]]\nName='bad'\nAddress=unknown").length,0));
test('Bounded metadata input',()=>assert.throws(()=>parseHmaNamedAnchors('x'.repeat(4*1024*1024+1))));
test('Pointer inspection follows only in-bounds ROM pointer',()=>{const b=new Uint8Array(128);b.set([0x20,0,0,0x08],16);const a=readAnchorInspection(b,{address:16});assert.equal(a.pointer,32);assert.throws(()=>readAnchorInspection(b,{address:128}));});
test('Semantic search by anchor name and format',()=>{const a=parseHmaNamedAnchors(src);assert.equal(filterAnchors(a,'stats').length,1);assert.equal(filterAnchors(a,'lzs').length,1);assert.equal(groupAnchors(a).length,3);});
