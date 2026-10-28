/**
 * Touch-first, copy-only CUBE Emerald warp and event batch editor.
 * Uses the pinned CUBHMA record decoders; never mutates or exports ROM data.
 * Context must be revalidated against the exact inspected source on every action.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';
import {previewHmaCubeConnectionBatch,verifyHmaCubeConnectionBatchDryRun} from './hma-cube-connection-edit.js';
import {previewHmaCubeWarpBatch,verifyHmaCubeWarpBatchDryRun} from './hma-cube-warp-batch.js';
import {previewHmaCubeEventPositionBatch,verifyHmaCubeEventPositionBatchDryRun} from './hma-cube-event-batch.js';
import {verifyHmaCubeCombinedTransaction} from './hma-cube-combined-transaction.js';
import {previewHmaCubeScriptRetargetBatch,verifyHmaCubeScriptRetargetDryRun} from './hma-cube-script-retarget.js';
import {auditHmaCubeEditOwnershipImpact} from './hma-cube-edit-ownership-impact.js';
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
 let connectionQueue=[],connectionSelection=null,connectionSnapshot=null,connectionBanks=null;
 let warpSnapshot=null,eventSnapshot=null,warpBanks=null,enabled=false;
 let scriptQueue=[],scriptSnapshot=null,scriptSelection=null;
 const names=['warp','event'];
 function status(kind,text){$('cube-batch-'+kind+'-status').textContent=text;}
 function reset(){
  warpQueue=[];eventQueue=[];warpSelection=null;eventSelection=null;
  warpSnapshot=null;eventSnapshot=null;warpBanks=null;
  scriptQueue=[];scriptSnapshot=null;scriptSelection=null;
  $('cube-batch-script-list').replaceChildren();
  for(const action of ['load','queue','preview','verify','clear'])$('cube-batch-script-'+action).disabled=true;
  $('cube-batch-script-status').textContent='No script retargets queued.';
  connectionQueue=[];connectionSelection=null;connectionSnapshot=null;connectionBanks=null;
  $('cube-batch-connection-list').replaceChildren();
  for(const action of ['queue','preview','verify','clear','load'])
   $('cube-batch-connection-'+action).disabled=true;
  $('cube-batch-connection-status').textContent='No queued raw connection edits. ROM unchanged.';
  $('cube-batch-combined-verify').disabled=true;
  $('cube-batch-combined-ownership').disabled=true;
  for(const kind of names)$('cube-batch-'+kind+'-use-cell').disabled=true;
  $('cube-batch-combined-status').textContent='No cross-kind rehearsal performed.';
  $('cube-batch-ownership-status').textContent='No ownership impact audit performed.';
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
  $('cube-batch-connection-load').disabled=!enabled;
  $('cube-batch-script-load').disabled=!enabled;
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
  $('cube-batch-combined-verify').disabled=!(warpQueue.length||eventQueue.length||connectionQueue.length||scriptQueue.length);
  $('cube-batch-combined-ownership').disabled=!(warpQueue.length||eventQueue.length||connectionQueue.length||scriptQueue.length);
  $('cube-batch-combined-status').textContent='Queues changed; rerun cross-kind verification.';
  $('cube-batch-ownership-status').textContent='Queues changed; rerun ownership impact audit.';
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
 function renderConnection(){
  $('cube-batch-combined-verify').disabled=!(warpQueue.length||eventQueue.length||connectionQueue.length||scriptQueue.length);
  $('cube-batch-combined-ownership').disabled=!(warpQueue.length||eventQueue.length||connectionQueue.length||scriptQueue.length);
  $('cube-batch-combined-status').textContent='Queues changed; rerun four-kind verification.';
  $('cube-batch-ownership-status').textContent='Queues changed; rerun ownership impact audit.';
  const list=$('cube-batch-connection-list');list.replaceChildren();
  for(const action of ['preview','verify','clear'])
   $('cube-batch-connection-'+action).disabled=!connectionQueue.length;
  $('cube-batch-connection-status').textContent=connectionQueue.length+
   '/32 raw connection proposals. Copy-only; no ROM export.';
  for(const entry of connectionQueue){
   const button=document.createElement('button');
   button.type='button';button.className='subtle-button';
   button.textContent='Remove connection #'+entry.connectionIndex+
    ' → '+entry.proposed.targetBank+':'+entry.proposed.targetMap;
   button.addEventListener('click',()=>safeRun(()=>{
    current(connectionSnapshot);
    connectionQueue=connectionQueue.filter(x=>x.connectionIndex!==entry.connectionIndex);
    if(!connectionQueue.length){connectionSnapshot=null;connectionBanks=null;}
    renderConnection();
   }));
   list.append(button);
  }
 }
 const connectionFields=['direction','rawDisplacement','targetBank','targetMap','unused'];
 const connectionLimits={direction:0xFFFFFFFF,rawDisplacement:0xFFFFFFFF,
  targetBank:255,targetMap:255,unused:65535};
 on('cube-batch-connection-load',()=>{
  const ctx=getContext();
  current(ctx?.snapshot);
  const report=inspectHmaCubeMapConnections(ctx.rom,ctx.summary,ctx.snapshot.options);
  const index=unsigned($('cube-batch-connection-index').value,65535,'Connection index');
  if(index>=report.connections.length)throw RangeError('Connection index outside source array');
  const record=report.connections[index];
  connectionSelection={snapshot:ctx.snapshot,connectionIndex:index,
   expected:Object.fromEntries(connectionFields.map(k=>[k,record[k]]))};
  for(const key of connectionFields)
   $('cube-batch-connection-'+key).value=String(record[key]);
  if(!$('cube-batch-connection-banks').value.trim())
   $('cube-batch-connection-banks').value=ctx.snapshot.options.bankIndex+
    ':'+ctx.snapshot.options.mapCount;
  $('cube-batch-connection-queue').disabled=false;
  $('cube-batch-connection-status').textContent='Loaded raw connection #'+index+
   '. Direction/offset are unverified numeric fields, not travel semantics.';
 });
 on('cube-batch-connection-queue',()=>{
  const selection=connectionSelection;
  if(!selection)throw Error('Load a connection before queueing');
  const {ctx}=current(selection.snapshot);
  if(unsigned($('cube-batch-connection-index').value,65535,'Connection index')!==
     selection.connectionIndex)
   throw Error('Connection index changed; reload');
  const proposed=Object.fromEntries(connectionFields.map(k=>[
   k,unsigned($('cube-batch-connection-'+k).value,connectionLimits[k],k)
  ]));
  const banks=declaredBanks($('cube-batch-connection-banks').value);
  if(connectionQueue.length&&(connectionSnapshot!==selection.snapshot||
     JSON.stringify(connectionBanks)!==JSON.stringify(banks)))
   throw Error('Connection queue source or bank declarations changed; clear queue');
  if(connectionQueue.length>=32||connectionQueue.some(x=>x.connectionIndex===selection.connectionIndex))
   throw Error('Only 32 distinct connections; remove a duplicate first');
  const changes=[...connectionQueue,{connectionIndex:selection.connectionIndex,
   expected:selection.expected,proposed}];
  previewHmaCubeConnectionBatch(ctx.rom,ctx.summary,{
   ...selection.snapshot.options,changes,targetBanks:banks
  });
  connectionQueue=changes;connectionSnapshot=selection.snapshot;connectionBanks=banks;
  renderConnection();
 });
 on('cube-batch-connection-preview',()=>{
  const {ctx}=current(connectionSnapshot);
  const r=previewHmaCubeConnectionBatch(ctx.rom,ctx.summary,{
   ...connectionSnapshot.options,changes:connectionQueue,targetBanks:connectionBanks
  });
  $('cube-batch-connection-status').textContent='Raw connection preview: '+
   r.changedRecords+' records, '+r.changedBytes+
   ' changed bytes; complete array re-decode: '+r.combinedReDecodeVerified+
   '. Destination counts are user-declared, not authenticated; no writes.';
 });
 on('cube-batch-connection-verify',()=>{
  const {ctx}=current(connectionSnapshot);
  const r=verifyHmaCubeConnectionBatchDryRun(ctx.rom,ctx.summary,{
   ...connectionSnapshot.options,changes:connectionQueue,targetBanks:connectionBanks
  });
  $('cube-batch-connection-status').textContent='Connection copy-only rollback: '+
   r.changedRecords+' records, '+r.changedBytes+' changed bytes; rollback: '+
   r.inMemoryRollbackVerified+'; source preserved: '+r.sourceBytesPreserved+
   '. No ROM file exported.';
 });
 on('cube-batch-connection-clear',()=>{
  connectionQueue=[];connectionSnapshot=null;connectionBanks=null;renderConnection();
 });
 function scriptStatus(message){$('cube-batch-script-status').textContent=message;}
 function renderScript(){
  const list=$('cube-batch-script-list');list.replaceChildren();
  for(const action of ['preview','verify','clear'])$('cube-batch-script-'+action).disabled=!scriptQueue.length;
  for(const c of scriptQueue){
   const button=document.createElement('button');button.type='button';button.className='subtle-button';
   button.textContent='Remove '+c.kind+' #'+c.index+' → '+c.targetKind+' #'+c.targetIndex;
   button.addEventListener('click',()=>safeRun(()=>{
    current(scriptSnapshot);scriptQueue=scriptQueue.filter(x=>x.kind!==c.kind||x.index!==c.index);
    if(!scriptQueue.length)scriptSnapshot=null;renderScript();
   }));list.append(button);
  }
  $('cube-batch-combined-verify').disabled=!(warpQueue.length||eventQueue.length||connectionQueue.length||scriptQueue.length);
  $('cube-batch-combined-ownership').disabled=!(warpQueue.length||eventQueue.length||connectionQueue.length||scriptQueue.length);
  $('cube-batch-combined-status').textContent='Queues changed; rerun combined rollback.';
  $('cube-batch-ownership-status').textContent='Queues changed; rerun ownership impact.';
  scriptStatus(scriptQueue.length+'/32 script references queued. Copy-only.');
 }
 on('cube-batch-script-load',()=>{
  const ctx=getContext(),{fresh}=current(ctx?.snapshot);
  const kind=$('cube-batch-script-kind').value;
  if(!['objects','scripts','signposts'].includes(kind))throw RangeError('Unsupported script-reference kind');
  const index=unsigned($('cube-batch-script-index').value,65535,'Script index');
  const record=fresh.arrays[kind]?.[index];if(!record)throw RangeError('Script event outside array');
  if(kind==='signposts'&&record.kind>=5)throw RangeError('Hidden-item signpost is not a script pointer');
  const expectedRaw=kind==='signposts'?record.rawArgument:record.scriptPointer;
  scriptSelection={snapshot:ctx.snapshot,kind,index,expectedRaw};
  $('cube-batch-script-expected').textContent='Original pointer: 0x'+expectedRaw.toString(16).padStart(8,'0');
  $('cube-batch-script-queue').disabled=false;
 });
 on('cube-batch-script-queue',()=>{
  const s=scriptSelection;if(!s)throw Error('Load a script-bearing event first');
  const {ctx}=current(s.snapshot);
  if($('cube-batch-script-kind').value!==s.kind||
   unsigned($('cube-batch-script-index').value,65535,'Script index')!==s.index)
   throw Error('Source event selection changed; reload');
  if(scriptQueue.length&&scriptSnapshot!==s.snapshot)throw Error('Script source changed; clear queue');
  if(scriptQueue.length>=32||scriptQueue.some(c=>c.kind===s.kind&&c.index===s.index))
   throw Error('Only 32 distinct script references');
  const changes=[...scriptQueue,{kind:s.kind,index:s.index,expectedRaw:s.expectedRaw,
   targetKind:$('cube-batch-script-target-kind').value,
   targetIndex:unsigned($('cube-batch-script-target-index').value,65535,'Target index')}];
  previewHmaCubeScriptRetargetBatch(ctx.rom,ctx.summary,{...s.snapshot.options,changes});
  scriptQueue=changes;scriptSnapshot=s.snapshot;renderScript();
 });
 on('cube-batch-script-preview',()=>{
  const {ctx}=current(scriptSnapshot);
  const r=previewHmaCubeScriptRetargetBatch(ctx.rom,ctx.summary,{...scriptSnapshot.options,changes:scriptQueue});
  scriptStatus('Preview: '+r.changedRecords+' pointers, '+r.changedBytes+' bytes; re-decode: '+
   r.completeEventReDecodeVerified+'. No ROM writes.');
 });
 on('cube-batch-script-verify',()=>{
  const {ctx}=current(scriptSnapshot);
  const r=verifyHmaCubeScriptRetargetDryRun(ctx.rom,ctx.summary,{...scriptSnapshot.options,changes:scriptQueue});
  scriptStatus('Copy-only rollback: '+r.inMemoryRollbackVerified+'; source preserved: '+r.sourceBytesPreserved);
 });
 on('cube-batch-script-clear',()=>{scriptQueue=[];scriptSnapshot=null;renderScript();});
 function combinedParams(){
  const ctx=getContext();
  const {fresh}=current(ctx?.snapshot);
  if(!fresh||!(warpQueue.length||eventQueue.length||connectionQueue.length||scriptQueue.length))
   throw Error('Queue a warp, event or connection change before combined rehearsal');
  if(warpQueue.length&&warpSnapshot!==ctx.snapshot)
   throw Error('Warp queue belongs to a different map inspection');
  if(eventQueue.length&&eventSnapshot!==ctx.snapshot)
   throw Error('Event queue belongs to a different map inspection');
  if(scriptQueue.length&&scriptSnapshot!==ctx.snapshot)
    throw Error('Script queue belongs to a different map inspection');
   if(connectionQueue.length&&connectionSnapshot!==ctx.snapshot)
   throw Error('Connection queue belongs to a different map inspection');
  if(warpQueue.length&&connectionQueue.length&&
     JSON.stringify(warpBanks)!==JSON.stringify(connectionBanks))
   throw Error('Warp and connection destination bank declarations differ; align queues');
  const cells=ctx.cellQueue??[];
  if(cells.length&&(!ctx.cellSnapshot||ctx.cellSnapshot!==ctx.cellEvidence||
     ctx.cellSnapshot.rom!==ctx.rom||
     ctx.cellSnapshot.options.bankIndex!==ctx.snapshot.options.bankIndex||
     ctx.cellSnapshot.options.mapIndex!==ctx.snapshot.options.mapIndex||
     ctx.cellSnapshot.options.mapCount!==ctx.snapshot.options.mapCount))
   throw Error('Map-cell queue expired or belongs to another CUBE map; render again');
  return {ctx,params:{
   ...ctx.snapshot.options,cells,warps:warpQueue,events:eventQueue,
   connections:connectionQueue,scripts:scriptQueue,
   targetBanks:warpBanks??connectionBanks??[{bankIndex:ctx.snapshot.options.bankIndex,
    mapCount:ctx.snapshot.options.mapCount}],
   x:ctx.cellSnapshot?.x??0,y:ctx.cellSnapshot?.y??0,
   viewportWidth:10,viewportHeight:8
  }};
 }
 on('cube-batch-combined-verify',()=>{
  const {ctx,params}=combinedParams();
  const r=verifyHmaCubeCombinedTransaction(ctx.rom,ctx.summary,params);
  $('cube-batch-combined-status').textContent='Combined copy-only transaction: '+
   r.cellChanges+' cells, '+r.warpChanges+' warps, '+r.eventChanges+
   ' events, '+r.connectionChanges+' connections, '+r.scriptChanges+' script pointers; '+r.changedBytes+' changed bytes; re-decode: '+r.combinedReDecodeVerified+
   '; rollback: '+r.inMemoryRollbackVerified+'; source preserved: '+
   r.sourceBytesPreserved+'. No ROM file exported or write permission.';
 });
 on('cube-batch-combined-ownership',()=>{
  const {ctx,params}=combinedParams();
  const banks=declaredBanks($('cube-batch-ownership-banks').value);
  const r=auditHmaCubeEditOwnershipImpact(ctx.rom,ctx.summary,{...params,banks});
  $('cube-batch-ownership-status').textContent='Changed-byte ownership impact: '+
   r.changedBytes+' changed bytes, '+r.decodedMaps+'/'+r.inspectedMaps+
   ' declared maps decoded, '+r.conflicts.length+' edited-byte overlap(s), '+
   r.eventIssueCount+' invalid event array(s), '+r.connectionIssueCount+
   ' invalid connection array(s), '+r.mapScriptIssueCount+
   ' invalid map-script table(s), '+r.invalidMaps+
   ' invalid map(s). '+(r.changedBytesTouchSharedClaims?
    'SHARED MAP CLAIM DETECTED. ':'')+
   (r.censusIncomplete?'Census incomplete. ':'')+
   'Partial bank census only; global aliases, ROM identity and safe writing NOT proven.';
 });
 reset();
 return Object.freeze({reset,ready});
}
