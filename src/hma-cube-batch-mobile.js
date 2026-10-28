/**
 * Touch-first, copy-only CUBE Emerald warp and event batch editor.
 * Uses the pinned CUBHMA record decoders; never mutates or exports ROM data.
 * Context must be revalidated against the exact inspected source on every action.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {previewHmaCubeWarpBatch,verifyHmaCubeWarpBatchDryRun} from './hma-cube-warp-batch.js';
import {previewHmaCubeEventPositionBatch,verifyHmaCubeEventPositionBatchDryRun} from './hma-cube-event-batch.js';

const warpFields=['x','y','elevation','warpId','targetMap','targetBank'];
const positionFields=['x','y','elevation'];
function unsigned(value,max,label){
 if(!/^[0-9]+$/.test(String(value).trim()))throw new RangeError(label+' must be unsigned');
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n>max)throw new RangeError(label+' outside raw field range');
 return n;
}
function declaredBanks(text){
 const parts=text.trim().split(',').map(x=>x.trim());
 if(parts.length<1||parts.length>8||parts.some(p=>!/^[0-9]+:[0-9]+$/.test(p)))
  throw new RangeError('Declare 1–8 bank:map-count pairs');
 const banks=parts.map(p=>{
  const [bankIndex,mapCount]=p.split(':').map(Number);
  return {bankIndex:unsigned(bankIndex,255,'Bank'),mapCount:unsigned(mapCount,1024,'Map count')};
 });
 if(banks.some(b=>b.mapCount<1)||new Set(banks.map(b=>b.bankIndex)).size!==banks.length)
  throw new RangeError('Invalid or duplicate bank counts');
 return banks;
}
export function bindHmaCubeBatchEditors({getContext,safeRun}){
 const $=id=>document.getElementById(id);
 let warpQueue=[],eventQueue=[],warpSelection=null,eventSelection=null;
 let warpSnapshot=null,eventSnapshot=null,warpBanks=null,enabled=false;
 const names=['warp','event'];
 function status(kind,text){$('cube-batch-'+kind+'-status').textContent=text;}
 function reset(){
  warpQueue=[];eventQueue=[];warpSelection=null;eventSelection=null;
  warpSnapshot=null;eventSnapshot=null;warpBanks=null;
  for(const kind of names){
   $('cube-batch-'+kind+'-list').replaceChildren();
   for(const action of ['load','queue','preview','verify','clear'])
    $('cube-batch-'+kind+'-'+action).disabled=true;
   status(kind,'No queued '+kind+' proposals. ROM unchanged; no export.');
  }
 }
 function ready(value){
  reset();enabled=Boolean(value);
  for(const kind of names)$('cube-batch-'+kind+'-load').disabled=!enabled;
 }
 function current(snapshot){
  const ctx=getContext();
  if(!enabled||!ctx||!snapshot||snapshot!==ctx.snapshot||
     snapshot.rom!==ctx.rom||snapshot.summary!==ctx.summary)
   throw Error('CUBE event source expired; inspect map records again');
  const fresh=inspectHmaCubeMapEventWarps(ctx.rom,ctx.summary,snapshot.options);
  if(JSON.stringify(fresh)!==JSON.stringify(snapshot.report))
   throw Error('CUBE event records changed; reinspect before editing');
  return {ctx,fresh};
 }
 function readFields(kind,fields){
  return Object.fromEntries(fields.map(key=>[
   key,unsigned($('cube-batch-'+kind+'-'+key).value,
    key==='x'||key==='y'?65535:key==='elevation'&&kind==='event'?65535:255,key)
  ]));
 }
 function options(kind){
  const snapshot=kind==='warp'?warpSnapshot:eventSnapshot;
  const {ctx}=current(snapshot);
  return {ctx,params:{...snapshot.options,
   changes:kind==='warp'?warpQueue:eventQueue,
   ...(kind==='warp'?{targetBanks:warpBanks}:{})}};
 }
 function render(kind){
  const queue=kind==='warp'?warpQueue:eventQueue;
  const list=$('cube-batch-'+kind+'-list');list.replaceChildren();
  for(const action of ['preview','verify','clear'])
   $('cube-batch-'+kind+'-'+action).disabled=!queue.length;
  status(kind,queue.length+'/32 '+kind+' proposals. Preview/copy-only rollback; no ROM export.');
  for(const entry of queue){
   const button=document.createElement('button');
   button.type='button';button.className='subtle-button';
   button.textContent=kind==='warp'?'Remove warp #'+entry.warpIndex+
    ' → '+entry.proposed.targetBank+':'+entry.proposed.targetMap+':'+entry.proposed.warpId:
    'Remove '+entry.kind+' #'+entry.index+' → ('+entry.proposed.x+','+entry.proposed.y+')';
   button.addEventListener('click',()=>safeRun(()=>{
    current(kind==='warp'?warpSnapshot:eventSnapshot);
    if(kind==='warp')warpQueue=warpQueue.filter(x=>x.warpIndex!==entry.warpIndex);
    else eventQueue=eventQueue.filter(x=>x.kind!==entry.kind||x.index!==entry.index);
    if(!warpQueue.length){warpSnapshot=null;warpBanks=null;}
    if(!eventQueue.length)eventSnapshot=null;
    render(kind);
   }));
   list.append(button);
  }
 }
 function on(id,fn){$(id).addEventListener('click',()=>safeRun(fn));}
 on('cube-batch-warp-load',()=>{
  const ctx=getContext(),{fresh}=current(ctx?.snapshot);
  const warpIndex=unsigned($('cube-batch-warp-index').value,65535,'Warp index');
  if(warpIndex>=fresh.warps.length)throw RangeError('Warp index outside source array');
  const record=fresh.warps[warpIndex];
  warpSelection={snapshot:ctx.snapshot,warpIndex,
   expected:Object.fromEntries(warpFields.map(key=>[key,record[key]]))};
  for(const key of warpFields)$('cube-batch-warp-'+key).value=String(record[key]);
  if(!$('cube-batch-warp-banks').value.trim())
   $('cube-batch-warp-banks').value=ctx.snapshot.options.bankIndex+':'+ctx.snapshot.options.mapCount;
  $('cube-batch-warp-queue').disabled=false;
  status('warp','Loaded warp #'+warpIndex+'. Edit raw fields and queue; ROM unchanged.');
 });
 on('cube-batch-warp-queue',()=>{
  const selection=warpSelection;
  if(!selection)throw Error('Load a warp first');
  const {ctx}=current(selection.snapshot);
  if(unsigned($('cube-batch-warp-index').value,65535,'Warp index')!==selection.warpIndex)
   throw Error('Warp index changed; reload');
  const proposed=readFields('warp',warpFields);
  const banks=declaredBanks($('cube-batch-warp-banks').value);
  if(warpQueue.length&&(warpSnapshot!==selection.snapshot||
     JSON.stringify(banks)!==JSON.stringify(warpBanks)))
   throw Error('Batch source or bank counts changed; clear queue');
  if(warpQueue.length>=32||warpQueue.some(x=>x.warpIndex===selection.warpIndex))
   throw Error('Only 32 distinct warps; remove a duplicate first');
  const changes=[...warpQueue,{warpIndex:selection.warpIndex,expected:selection.expected,proposed}];
  previewHmaCubeWarpBatch(ctx.rom,ctx.summary,{...selection.snapshot.options,changes,targetBanks:banks});
  warpQueue=changes;warpSnapshot=selection.snapshot;warpBanks=banks;render('warp');
 });
 on('cube-batch-warp-preview',()=>{
  const {ctx,params}=options('warp'),r=previewHmaCubeWarpBatch(ctx.rom,ctx.summary,params);
  status('warp','Atomic preview: '+r.changedRecords+' records, '+r.changedBytes+
   ' bytes; topology changed: '+r.topologyChanged+'; re-decode: '+r.combinedReDecodeVerified+
   '. No ownership proof, ROM write or emulator acceptance.');
 });
 on('cube-batch-warp-verify',()=>{
  const {ctx,params}=options('warp'),r=verifyHmaCubeWarpBatchDryRun(ctx.rom,ctx.summary,params);
  status('warp','Isolated copy: '+r.changedRecords+' records, '+r.changedBytes+
   ' bytes; re-decode: '+r.inMemoryReDecodeVerified+'; rollback: '+r.inMemoryRollbackVerified+
   '; source preserved: '+r.sourceBytesPreserved+'. No ROM exported.');
 });
 on('cube-batch-warp-clear',()=>{warpQueue=[];warpSnapshot=null;warpBanks=null;render('warp');});
 on('cube-batch-event-load',()=>{
  const ctx=getContext(),{fresh}=current(ctx?.snapshot);
  const kind=$('cube-batch-event-kind').value;
  if(!['objects','scripts','signposts'].includes(kind))throw RangeError('Unsupported event kind');
  const index=unsigned($('cube-batch-event-index').value,65535,'Event index');
  if(index>=fresh.arrays[kind].length)throw RangeError('Event index outside source array');
  const record=fresh.arrays[kind][index];
  eventSelection={snapshot:ctx.snapshot,kind,index,
   expected:Object.fromEntries(positionFields.map(key=>[key,record[key]]))};
  for(const key of positionFields)$('cube-batch-event-'+key).value=String(record[key]);
  $('cube-batch-event-queue').disabled=false;
  status('event','Loaded '+kind+' #'+index+'. Only position fields are editable.');
 });
 on('cube-batch-event-queue',()=>{
  const selection=eventSelection;
  if(!selection)throw Error('Load an event first');
  const {ctx}=current(selection.snapshot);
  if($('cube-batch-event-kind').value!==selection.kind||
     unsigned($('cube-batch-event-index').value,65535,'Event index')!==selection.index)
   throw Error('Event kind/index changed; reload');
  const proposed=readFields('event',positionFields);
  if(eventQueue.length&&eventSnapshot!==selection.snapshot)
   throw Error('Batch source changed; clear queue');
  if(eventQueue.length>=32||eventQueue.some(x=>x.kind===selection.kind&&x.index===selection.index))
   throw Error('Only 32 distinct events; remove a duplicate first');
  const changes=[...eventQueue,{kind:selection.kind,index:selection.index,
   expected:selection.expected,proposed}];
  previewHmaCubeEventPositionBatch(ctx.rom,ctx.summary,{...selection.snapshot.options,changes});
  eventQueue=changes;eventSnapshot=selection.snapshot;render('event');
 });
 on('cube-batch-event-preview',()=>{
  const {ctx,params}=options('event'),r=previewHmaCubeEventPositionBatch(ctx.rom,ctx.summary,params);
  status('event','Atomic preview: '+r.changedRecords+' records, '+r.changedBytes+
   ' bytes, '+r.colocatedDestinations.length+' shared destinations; re-decode: '+
   r.combinedReDecodeVerified+'. Script pointers preserved; no ROM writes.');
 });
 on('cube-batch-event-verify',()=>{
  const {ctx,params}=options('event'),r=verifyHmaCubeEventPositionBatchDryRun(ctx.rom,ctx.summary,params);
  status('event','Isolated copy: '+r.changedRecords+' records, '+r.changedBytes+
   ' bytes; rollback: '+r.inMemoryRollbackVerified+
   '; source preserved: '+r.sourceBytesPreserved+'. No ROM exported.');
 });
 on('cube-batch-event-clear',()=>{eventQueue=[];eventSnapshot=null;render('event');});
 reset();
 return Object.freeze({reset,ready});
}
