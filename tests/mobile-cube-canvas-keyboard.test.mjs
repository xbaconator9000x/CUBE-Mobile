import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function keyboardHarness(){
  const source=read('src/app.js');
  const begin=source.indexOf("$('cube-map-render-canvas').addEventListener('keydown',event=>{");
  const end=source.indexOf("$('cube-map-batch-add').addEventListener",begin);
  assert.ok(begin>=0&&end>begin,'CUBE canvas keyboard handler exists');
  const snippet=source.slice(begin,end);
  const events=[],listeners={};
  const canvas={
    hidden:false,width:160,height:128,
    getBoundingClientRect:()=>({left:10,top:20,width:320,height:256}),
    addEventListener:(name,handler)=>{listeners[name]=handler;},
    dispatchEvent:event=>events.push(event)
  };
  const snapshot={x:10,y:20};
  class MouseEvent {
    constructor(type,options){this.type=type;Object.assign(this,options);}
  }
  const context={
    $:id=>{assert.equal(id,'cube-map-render-canvas');return canvas;},
    cubeRenderEvidence:snapshot,cubeRenderSelection:null,MouseEvent
  };
  runInNewContext(snippet,context);
  const press=key=>{
    let prevented=false;
    listeners.keydown({key,preventDefault:()=>{prevented=true;}});
    return prevented;
  };
  return {canvas,snapshot,context,events,press};
}

test('CUBE canvas arrow keys select exact metatile centers through existing click path',()=>{
  const h=keyboardHarness();
  assert.equal(h.press('ArrowRight'),true);
  assert.equal(h.events.length,1);
  assert.equal(h.events[0].type,'click');
  assert.equal(h.events[0].clientX,58);
  assert.equal(h.events[0].clientY,36);
  assert.equal(h.events[0].bubbles,true);
  h.context.cubeRenderSelection={snapshot:h.snapshot,x:13,y:22};
  assert.equal(h.press('ArrowRight'),true);
  assert.equal(h.events[1].clientX,154);
  assert.equal(h.events[1].clientY,100);
  assert.equal(h.press('ArrowUp'),true);
  assert.equal(h.events[2].clientX,122);
  assert.equal(h.events[2].clientY,68);
});

test('CUBE keyboard navigation clamps edges and ignores unrelated or stale views',()=>{
  const h=keyboardHarness();
  h.context.cubeRenderSelection={snapshot:h.snapshot,x:10,y:20};
  assert.equal(h.press('ArrowLeft'),true);
  assert.equal(h.events[0].clientX,26);
  assert.equal(h.press('Tab'),false);
  assert.equal(h.events.length,1);
  h.canvas.hidden=true;
  assert.equal(h.press('ArrowRight'),false);
  assert.equal(h.events.length,1);
  h.canvas.hidden=false;
  h.context.cubeRenderEvidence=null;
  assert.equal(h.press('Enter'),false);
  assert.equal(h.events.length,1);
});

test('Enter and Space use the same source-checked CUBE cell inspection',()=>{
  const h=keyboardHarness();
  h.context.cubeRenderSelection={snapshot:h.snapshot,x:19,y:27};
  assert.equal(h.press('Enter'),true);
  assert.equal(h.press(' '),true);
  assert.equal(h.events.length,2);
  for(const event of h.events){
    assert.equal(event.clientX,314);
    assert.equal(event.clientY,260);
  }
});

test('modular CUBE canvas has accessible focus and offline parity',()=>{
  const html=read('index.html'),css=read('src/styles.css');
  const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
  for(const page of [html,offline]){
    assert.match(page,/id="cube-map-render-canvas" hidden tabindex="0" role="button"/);
    assert.match(page,/aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space"/);
    assert.match(page,/Arrow keys move the cell selection/);
  }
  assert.match(css,/#cube-map-render-canvas:focus-visible/);
  assert.match(offline,/#cube-map-render-canvas:focus-visible/);
  assert.match(app,/canvas\.dispatchEvent\(new MouseEvent\('click'/);
  assert.match(offline,/canvas\.dispatchEvent\(new MouseEvent\('click'/);
});
