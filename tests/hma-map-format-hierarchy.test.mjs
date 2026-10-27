import test from 'node:test';
import assert from 'node:assert/strict';
import {extractHmaPointerContent,inspectHmaMapFormatHierarchy} from '../src/hma-map-format-hierarchy.js';

const custom="[banks<map<[layout<[width:: height:: primaryBlockset<[tiles.]1>]1> events<[objects<[id.]2> warps<[x: y:]4> scripts<[x: script<>]1> signposts<[kind.]1>]1> connections<[count::]1> music. weather.]1>]1>]";
test('extracts nested upstream-style custom map metadata without interpreting ROM bytes',()=>{
 const result=inspectHmaMapFormatHierarchy(custom);
 assert.equal(result.status,'custom-candidate');
 assert.equal(result.vanillaMarker,false);
 assert.equal(result.sections.layout,'[width:: height:: primaryBlockset<[tiles.]1>]1');
 assert.equal(result.sections.events,'[objects<[id.]2> warps<[x: y:]4> scripts<[x: script<>]1> signposts<[kind.]1>]1');
 assert.equal(result.sections.warps,'[x: y:]4');
 assert.equal(result.sections.primaryBlockset,'[tiles.]1');
 assert.equal(result.sections.connections,'[count::]1');
 assert.equal(result.sectionCount,8);
 assert.equal(result.romAuthenticated,false);
 assert.equal(result.cubeLayoutAuthenticated,false);
 assert.equal(result.writeAuthorized,false);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.sections));
});
test('vanilla marker is a format hint, not ROM authentication',()=>{
 const result=inspectHmaMapFormatHierarchy(
  '[bank<map<[layout<[width::]1> music. cave. floorNum.]1>]1>]');
 assert.equal(result.status,'vanilla-marker');
 assert.equal(result.vanillaMarker,true);
 assert.equal(result.romAuthenticated,false);
});
test('unknown or unsupported formats fail to establish layout compatibility',()=>{
 const missing=inspectHmaMapFormatHierarchy('[foo<[x.]1>]');
 assert.equal(missing.status,'unresolved');
 assert.equal(missing.mapFormat,null);
 const unsupported=inspectHmaMapFormatHierarchy('[map<[layout<[x.]1>]2>]');
 assert.equal(unsupported.status,'unsupported-shape');
 assert.equal(unsupported.supportedShape,false);
 assert.equal(unsupported.sections.layout,'[x.]1');
});
test('pointer parser enforces identifier boundaries and nested suffixes',()=>{
 assert.equal(extractHmaPointerContent('[remap<[x.]1> map<[y.]1>]','map<'),'[y.]1');
 assert.equal(extractHmaPointerContent('[map<value>]','map<'),null);
 assert.equal(extractHmaPointerContent('[map<[x.]1>]','events<'),null);
 assert.throws(()=>extractHmaPointerContent('[map<[x.]1','map<'),RangeError);
 assert.throws(()=>extractHmaPointerContent('[map<[[[[x]]]]1>]','map<',{maxDepth:3}),RangeError);
 assert.throws(()=>extractHmaPointerContent('[map<[x.]1>]','map<',{maxLength:5}),RangeError);
 assert.throws(()=>extractHmaPointerContent('[map<[x.]1>]','map<',{maxDepth:0}),RangeError);
 assert.throws(()=>inspectHmaMapFormatHierarchy(null),TypeError);
});
