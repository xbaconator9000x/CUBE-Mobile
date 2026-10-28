/**
 * Touch-first, copy-only CUBE Emerald warp and event batch editor.
 * Uses the pinned CUBHMA record decoders; never mutates or exports ROM data.
 * Context must be revalidated against the exact inspected source on every action.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {previewHmaCubeWarpBatch,verifyHmaCubeWarpBatchDryRun} from './hma-cube-warp-batch.js';
import {previewHmaCubeEventPositionBatch,verifyHmaCubeEventPositionBatchDryRun} from './hma-cube-event-batch.js';
import {verifyHmaCubeCombinedTransaction} from './hma-cube-combined-transaction.js';
import {auditHmaCubeRawPlacements} from './hma-cube-raw-placement-audit.js';

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
export function bindHmaCubeBatchEditors({getContext,getSelectedCell,safeRun}){
 const $=id=>document.getElementById(id);
 let warpQueue=[],eventQueue=[],warpSelection=null,eventSelection=null;
 let warpSnapshot=null,eventSnapshot=null,warpBanks=null,enabled=false;
 const names=['warp','event'];
 function status(kind,text){$('cube-batch-'+kind+'-status').textContent=text;}
 function reset(){
  warpQueue=[];eventQueue=[];warpSelection=null;eventSelection=null;
  warpSnapshot=null;eventSnapshot=null;warpBanks=null;
  $('cube-batch-combined-verify').disabled=true;
  for(const kind of names)$('cube-batch-'+kind+'-use-cell').disabled=true;
  $('cube-batch-combined-status').textContent='No cross-kind rehearsal performed.';
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
     !ctx.rom||!ctx.summary)
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
  $('cube-batch-combined-verify').disabled=!(warpQueue.length||eventQueue.length);
  $('cube-batch-combined-status').textContent='Queues changed; rerun cross-kind verification.';
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
 function fillFromRenderedCell(kind){
  const selection=kind==='warp'?warpSelection:eventSelection;
  if(!selection)throw Error('Load a '+kind+' before selecting a destination cell');
  current(selection.snapshot);
  if(typeof getSelectedCell!=='function')throw Error('Rendered map selection unavailable');
  const hit=getSelectedCell();
  if(!hit||!Number.isSafeInteger(hit.x)||!Number.isSafeInteger(hit.y))
   throw Error('Tap a valid rendered CUBE map cell first');
  $('cube-batch-'+kind+'-x').value=String(hit.x);
  $('cube-batch-'+kind+'-y').value=String(hit.y);
  status(kind,'Proposed '+kind+' position set to rendered cell ('+hit.x+','+hit.y+
   '). Queue and verify explicitly; ROM unchanged.');
 }
 on('cube-batch-warp-use-cell',()=>fillFromRenderedCell('warp'));
 on('cube-batch-event-use-cell',()=>fillFromRenderedCell('event'));
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
  $('cube-batch-warp-use-cell').disabled=false;
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
  const raw=auditHmaCubeRawPlacements(ctx.rom,ctx.summary,{
   ...params,placements:r.changes.map(c=>({kind:'warps',index:c.warpIndex,
    x:c.after.x,y:c.after.y}))
  });
  status('warp','Atomic preview: '+r.changedRecords+' records, '+r.changedBytes+
   ' bytes; topology changed: '+r.topologyChanged+'; re-decode: '+r.combinedReDecodeVerified+
   '. Raw high bits nonzero: '+raw.nonzeroRawHighBits+
   '; source co-locations: '+raw.sourceColocations+
   '. Raw warnings are NOT walkability; no ROM writes.');
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
  $('cube-batch-event-use-cell').disabled=false;
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
  const raw=auditHmaCubeRawPlacements(ctx.rom,ctx.summary,{
   ...params,placements:r.changes.map(c=>({kind:c.kind,index:c.index,
    x:c.after.x,y:c.after.y}))
  });
  status('event','Atomic preview: '+r.changedRecords+' records, '+r.changedBytes+
   ' bytes, '+r.colocatedDestinations.length+' shared destinations; re-decode: '+
   r.combinedReDecodeVerified+'; raw high bits nonzero: '+raw.nonzeroRawHighBits+
   '; source co-locations: '+raw.sourceColocations+
   '; proposed co-locations: '+raw.proposedColocations+
   '. Script pointers preserved; no walkability inference or ROM writes.');
 });
 on('cube-batch-event-verify',()=>{
  const {ctx,params}=options('event'),r=verifyHmaCubeEventPositionBatchDryRun(ctx.rom,ctx.summary,params);
  status('event','Isolated copy: '+r.changedRecords+' records, '+r.changedBytes+
   ' bytes; rollback: '+r.inMemoryRollbackVerified+
   '; source preserved: '+r.sourceBytesPreserved+'. No ROM exported.');
 });
 on('cube-batch-event-clear',()=>{eventQueue=[];eventSnapshot=null;render('event');});
 on('cube-batch-combined-verify',()=>{
  const ctx=getContext();
  const {fresh}=current(ctx?.snapshot);
  if(!fresh||!(warpQueue.length||eventQueue.length))
   throw Error('Queue a warp or event change before combined rehearsal');
  if(warpQueue.length&&warpSnapshot!==ctx.snapshot)
   throw Error('Warp queue belongs to a different map inspection');
  if(eventQueue.length&&eventSnapshot!==ctx.snapshot)
   throw Error('Event queue belongs to a different map inspection');
  const cells=ctx.cellQueue??[];
  if(cells.length&&(!ctx.cellSnapshot||ctx.cellSnapshot!==ctx.cellEvidence||
     ctx.cellSnapshot.rom!==ctx.rom||
     ctx.cellSnapshot.options.bankIndex!==ctx.snapshot.options.bankIndex||
     ctx.cellSnapshot.options.mapIndex!==ctx.snapshot.options.mapIndex||
     ctx.cellSnapshot.options.mapCount!==ctx.snapshot.options.mapCount))
   throw Error('Map-cell queue expired or belongs to another CUBE map; render again');
  const r=verifyHmaCubeCombinedTransaction(ctx.rom,ctx.summary,{
   ...ctx.snapshot.options,cells,warps:warpQueue,events:eventQueue,
   targetBanks:warpBanks??[{bankIndex:ctx.snapshot.options.bankIndex,
    mapCount:ctx.snapshot.options.mapCount}],
   x:ctx.cellSnapshot?.x??0,y:ctx.cellSnapshot?.y??0,
   viewportWidth:10,viewportHeight:8
  });
  $('cube-batch-combined-status').textContent='Combined copy-only transaction: '+
   r.cellChanges+' cells, '+r.warpChanges+' warps, '+r.eventChanges+
   ' events; '+r.changedBytes+' changed bytes; re-decode: '+r.combinedReDecodeVerified+
   '; rollback: '+r.inMemoryRollbackVerified+'; source preserved: '+
   r.sourceBytesPreserved+'. No ROM file exported or write permission.';
 });
 reset();
 return Object.freeze({reset,ready});
}
