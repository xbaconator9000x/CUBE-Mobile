import {RomModel, MAX_BYTES, hex, parseOffset, parseHexBytes, applyBps, applyIps, crc32, paletteAt, gba4bppTile, decodeLz10, scanLz10Graphics} from './core.js';
import {parseHmaNamedAnchors,collectHmaNamedAnchors,readAnchorInspection,groupAnchors,filterAnchors,previewHmaFixedTable,resolveHmaStockMetadata,checkHmaMetadataSources,inspectHmaPointerReferences,parseHmaOffsetPointers,resolveHmaTableLayouts,collectHmaLists,collectHmaMatchedWords} from './semantic.js';
import {inspectFixedTextBytes} from './text-inspection.js';
import {decodeHmaPcsFallback} from './pcs-default.js';
import {parseHmaPcsReference,decodeHmaPcsReference} from './pcs-reference.js';
import {fingerprintRomSha256,fingerprintMatchesRom} from './rom-fingerprint.js';
import {compareRomIdentity} from './rom-compatibility.js';
import {fingerprintMetadataFiles,compareRomMetadataFingerprintRecords} from './metadata-fingerprint.js';
import {inspectBlockMap,summarizeBlockmapChunk} from './map-blocks.js';
import {inspectVanillaMapLayout,inspectVanillaMapHeader} from './map-layouts.js';
import {inspectVanillaMapBankEntry,inspectVanillaMapWarps} from './map-discovery.js';
import {parseVanillaBankMapCounts,inspectVanillaMapAtlas,lookupVanillaMapAtlasTarget,probeVanillaMapBankTables,auditVanillaAtlasPointerAliases} from './map-atlas.js';
import {auditVanillaMapLinks,auditVanillaAtlasLinkBatch,auditVanillaMapEventCoordinates,auditVanillaAtlasEventCoordinateBatch,auditVanillaAtlasIncomingLinks} from './map-link-audit.js';
import {inspectVanillaMapConnections} from './map-connections.js';
import {auditVanillaAtlasEventOwnership} from './map-event-ownership.js';
import {inspectVanillaMapEvents,inspectVanillaEventScriptPointers,previewVanillaEventScriptBytes} from './map-events.js';
import {inspectVanillaScriptCommandPrefix} from './vanilla-script-prefix.js';
import {auditVanillaScriptBranchTargets} from './vanilla-script-branches.js';
import {auditVanillaScriptOperandPointers} from './vanilla-script-operand-pointers.js';
import {auditVanillaAtlasScriptAliases} from './vanilla-script-aliases.js';
import {auditVanillaScriptAliasesAcrossPages} from './vanilla-script-alias-crosspage.js';
import {auditVanillaAtlasWideScriptAliases} from './vanilla-script-alias-atlas.js';
import {auditVanillaAtlasScriptOperandAliases} from './vanilla-script-operand-alias-atlas.js';
import {auditVanillaMapEventScripts} from './vanilla-map-script-audit.js';
import {inspectVanillaMapBlocksets} from './map-blocksets.js';
import {panMapViewport,indexMapWarpMarkers,indexMapEventMarkers,inspectRenderedMapPixel,projectRenderedMapMarkers} from './map-viewport.js';
import {renderVanillaMapViewport} from './map-render.js';
import {previewVanillaBlockmapCellChange} from './map-edit-preview.js';
import {traceVanillaWarpArrival,auditVanillaWarpReturns} from './map-warp-trace.js';
import {previewVanillaWarpRecordChange} from './map-warp-edit-preview.js';
import {previewVanillaEventCoordinateChange} from './map-event-edit-preview.js';
import {reviewVanillaChangeSet,exportVanillaChangeReviewJson} from './map-change-review.js';
import {auditVanillaChangeImpact} from './map-change-impact.js';
import {auditVanillaQueuedChangeRoundtrip} from './map-change-roundtrip.js';
import {compareVanillaBlockmapVisualChange,compareVanillaBlockmapVisualChangeSet} from './map-visual-diff.js';
import {buildVanillaRawMapOverlay,buildRawBlockmapGridOverlay} from './map-raw-overlay.js';
import {auditVanillaAtlasRawCells} from './map-cell-census.js';
import {auditVanillaAtlasWarpGraph} from './map-warp-graph.js';
import {inspectVanillaAtlasRawRoute} from './map-route-explorer.js';
import {compareVanillaReviewedRawRoute} from './map-route-change-preview.js';
import {summarizeHmaMapBankSources} from './hma-map-bank-report.js';
import {inspectHmaMapBankRawPointer} from './hma-map-bank-raw-pointer.js';
import {inspectHmaMapBankRawWindow} from './hma-map-bank-raw-window.js';
import {inspectHmaDeclaredBankPointerTable} from './hma-map-bank-declared-table.js';
import {inspectHmaDeclaredBankTargetWindows} from './hma-map-bank-target-windows.js';
import {inspectHmaMapBankAnchorSources} from './hma-map-bank-metadata.js';
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';
import {renderHmaCubeMapViewport} from './hma-cube-map-render.js';

const $=id=>document.getElementById(id), qa=q=>[...document.querySelectorAll(q)];
let metadata=[],metadataSources=[],metadataLayoutKind='unspecified',metadataOffsetPointers=[],metadataLists=[],metadataListConflicts=new Set(),metadataMatchedWords=[],metadataWordConflicts=new Set(),metadataWordSnapshot=null,metadataResolution=null,selectedAnchor=null;
let pcsReference=null,pcsReferenceName='';
let fingerprintResult=null,fingerprintAbort=null;
let metadataFingerprints=[],metadataImportSerial=0,mapBankMetadataReport=null,mapBankRawPointerEvidence=null,mapBankRawWindowEvidence=null,mapBankDeclaredEvidence=null,mapBankTargetEvidence=null,mapBankCustomSummary=null,cubeMapEvidence=null,cubeWarpEvidence=null,cubeConnectionEvidence=null,cubeRenderEvidence=null,cubeRenderSelection=null;
let inspectedWarpMap=null,selectedWarpPreview=null,selectedEventPreview=null,inspectedEventMap=null,inspectedMapAtlas=null,atlasBatchStart=0,atlasCoordinateBatchStart=0,atlasScriptAliasStart=0,atlasScriptCrossPageStart=0,atlasIncomingStart=0,atlasIncomingTarget=null;
let activeRenderedMap=null,selectedRenderedHit=null;
let mapReviewQueue=[],mapReviewRom=null,lastMapPreviews={cell:null,warp:null,event:null};
let model=null, currentTab='home', page=0, selected=null, patchFile=null, paletteOffset=null, graphicsSource=null, tilePage=0, palette=null, graphicCandidates=[], scanToken=0, scanning=false, toastTimer=null;
const PER_PAGE=128;
const tiles=$('tile-canvas'),ctx=tiles.getContext('2d',{willReadFrequently:false});
ctx.imageSmoothingEnabled=false;
const controls=['rom-fingerprint','rom-fingerprint-check','hex-prev','hex-next','hex-jump','hex-find','hex-offset','hex-search','graphics-offset','palette-offset','graphics-show','graphics-decode','palette-show','palette-reset','graphics-scan','map-inspect','map-summary-scan','map-preview-cell','map-visual-compare','map-visual-compare-queue','map-layout-inspect','map-bank-inspect','map-atlas-inspect','map-atlas-probe','map-warp-inspect','map-connection-inspect','map-event-inspect','map-script-pointer-inspect','map-script-map-audit','map-script-operand-atlas-audit','map-blockset-inspect','map-pan-up','map-pan-down','map-pan-left','map-pan-right','save-rom','save-project','export-ips','discard-button','edit-unlock'];
const tabs={home:['YOUR WORKSPACE','ROM Workbench'],hex:['BINARY INSPECTOR','Hex editor'],anchors:['ROM SEMANTICS','Named data'],maps:['RAW MAP CELLS','Blockmap inspector'],graphics:['GBA GRAPHICS','Graphics explorer'],patches:['PATCH WORKFLOW','Patch tools'],changes:['REVIEW & EXPORT','Changes']};
function toast(message,bad=false){const t=$('toast');t.textContent=message;t.classList.toggle('error',bad);t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),4300);}
function safeRun(fn){try{const result=fn();if(result?.catch) result.catch(err=>toast(err.message||String(err),true));}catch(err){toast(err.message||String(err),true);}}
function confirmAction(title,description){return new Promise(resolve=>{const d=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-text').textContent=description;d.showModal();d.addEventListener('close',()=>resolve(d.returnValue==='yes'),{once:true});});}
function ensureModel(){if(!model)throw Error('Open a GBA ROM first');return model;}
// A fragment route works both in an HTTPS-installed PWA and in a locally opened
// file:// standalone HTML app. Each tab change creates a real history entry,
// allowing Android's system Back gesture/button to return to the previous tab.
const routeFromHash=()=>{
  const match=/^#\/(home|hex|anchors|maps|graphics|patches|changes)$/.exec(location.hash);
  return match ? match[1] : 'home';
};
function renderTab(name){
  if(!tabs[name])name='home';
  currentTab=name;
  qa('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+name));
  qa('[data-tab]').forEach(el=>{
    el.classList.toggle('active',el.dataset.tab===name);
    if(el.classList.contains('tab'))el.setAttribute('aria-current',el.dataset.tab===name?'page':'false');
  });
  $('top-eyebrow').textContent=tabs[name][0];$('top-title').textContent=tabs[name][1];
  $('home-button').hidden=name==='home';
  window.scrollTo({top:0,behavior:'instant'});
  if(name==='hex')drawHex();if(name==='anchors')drawAnchors();if(name==='graphics')drawGraphics();if(name==='changes')drawChanges();
}
function gotoTab(name){
  if(!tabs[name]||name===currentTab)return;
  // Hash changes automatically add browser history entries, including file://.
  // Rendering is performed by hashchange to keep native Back/Forward in sync.
  location.hash='#/'+name;
}
window.addEventListener('hashchange',()=>{
  renderTab(routeFromHash());
});
qa('[data-tab]').forEach(b=>b.addEventListener('click',()=>gotoTab(b.dataset.tab)));
qa('[data-go]').forEach(b=>b.addEventListener('click',()=>gotoTab(b.dataset.go)));
$('home-button').addEventListener('click',()=>gotoTab('home'));
$('help-button').addEventListener('click',()=>$('help-dialog').showModal());
function bytetext(n){return hex(n,2);}
function showRomInfo(){
  const panel=$('rom-panel');
  if(!model){$('session-state').textContent='No ROM loaded';panel.innerHTML='<div class="rom-placeholder"><div class="big-file-icon">◇</div><div><strong>No ROM loaded yet</strong><p>Choose a legally obtained GBA ROM to get started. Your file stays on this device.</p></div></div>';return;}
  const meta=model.header(),romLabel=document.createElement('div');romLabel.className='rom-identity';
  const icon=document.createElement('div');icon.className='big-file-icon';icon.textContent='▣';romLabel.append(icon);
  const middle=document.createElement('div');middle.className='rom-meta';const title=document.createElement('strong');title.textContent=model.name;const sub=document.createElement('p');sub.textContent=`${meta.family} · ${meta.code} · ${formatSize(model.length)}`;middle.append(title,sub);romLabel.append(middle);
  const tags=document.createElement('div');tags.className='rom-badges';
  const metaTag=(s,kind='')=>{const el=document.createElement('span');el.className='meta-tag '+kind;el.textContent=s;tags.append(el);};
  metaTag(model.dirty?'● UNSAVED':'○ CLEAN',model.dirty?'warn':'good');metaTag(meta.fixedValid?'HEADER VALID':'HEADER CHECK',meta.fixedValid?'good':'warn');metaTag(meta.checksumValid?'CHECKSUM OK':'CHECKSUM MISMATCH',meta.checksumValid?'good':'warn');
  romLabel.append(tags);panel.replaceChildren(romLabel);$('session-state').textContent=meta.title;
}
function formatSize(n){return n>=1024*1024?`${(n/1048576).toFixed(2)} MiB`:`${(n/1024).toFixed(1)} KiB`;}
function updateIndicators(){
  const active=!!model;
  if(fingerprintResult&&!fingerprintMatchesRom(model,fingerprintResult)){
    fingerprintResult=null;
    $('rom-fingerprint-status').textContent='ROM bytes changed since the last SHA-256. Compute a new fingerprint.';
    $('rom-fingerprint-compare-status').textContent='Comparison cleared: ROM bytes changed.';
  }
  controls.forEach(id=>$(id).disabled=!active);
  $('rom-fingerprint').disabled=!active||!!fingerprintAbort;
  $('rom-fingerprint-check').disabled=!active||!fingerprintResult||!!fingerprintAbort;
  $('edit-unlock').disabled=!active;$('write-byte').disabled=!active||!$('edit-unlock').checked||selected===null;
  $('selected-value').disabled=!active||!$('edit-unlock').checked;
  $('undo-button').disabled=!active||model.undoStack.length===0;
  $('redo-button').disabled=!active||model.redoStack.length===0;
  $('apply-patch').disabled=!active||!patchFile;
  $('edited-counter').textContent=`${active?model.edits.size:0} bytes changed`;
  $('hex-status').textContent=$('edit-unlock').checked?'Editing unlocked':'Read only';
  $('hex-status').style.borderColor=$('edit-unlock').checked?'#9f5969':'#435079';
  $('change-pill').textContent=active && model.dirty?'Unsaved changes':'Clean';
  $('fix-checksum').disabled=!active;
  $('graphics-scan').disabled=!active||scanning;
  $('graphics-candidates').disabled=!active||scanning||graphicCandidates.length===0;
  $('tiles-back').disabled=!active||!graphicsSource||tilePage===0;
  $('tiles-forward').disabled=!active||!graphicsSource||tilePage>=lastTilePage();
  $('changes-tab-count').hidden=!active||!model.dirty;$('changes-tab-count').textContent=active ? String(model.edits.size+(model.appliedPatch?1:0)):'0';
  if(active)showRomInfo();
  drawMetadataFingerprintStatus();
  drawMapBankRawPointerEvidence();
  drawMapBankRawWindowEvidence();
}
function installModel(name,bytes){clearCubeRenderedMap('ROM replaced; render again.');clearMapChangeReview();clearMapAtlas('ROM replaced; declared atlas invalidated.');metadataImportSerial++;metadataFingerprints=[];mapBankMetadataReport=null;mapBankRawPointerEvidence=null;mapBankRawWindowEvidence=null;mapBankDeclaredEvidence=null;mapBankTargetEvidence=null;mapBankCustomSummary=null;cubeMapEvidence=null;cubeWarpEvidence=null;cubeConnectionEvidence=null;clearRenderedMap('ROM replaced. Select vanilla header again.');$('map-grid').innerHTML='<div class="empty-state">No blockmap inspected.</div>';$('map-bank-status').textContent='ROM replaced. Re-enter independently verified vanilla bank location and counts.';clearWarpInspection('ROM replaced. Select a vanilla map header again.');clearConnectionInspection('ROM replaced. Select a vanilla map header again.');$('map-layout-status').textContent='ROM replaced. No vanilla-format layout inspected.';$('map-status').textContent='ROM replaced. Enter a verified offset and inspect again.';pcsReference=null;fingerprintAbort?.abort();fingerprintAbort=null;fingerprintResult=null;$('rom-fingerprint-status').textContent='Ready to compute a local SHA-256. Layout remains unverified.';$('rom-fingerprint-expected').value='';$('rom-fingerprint-compare-status').textContent='Paste a reference digest after hashing to compare exact bytes. No layout authentication.';pcsReferenceName='';$('pcs-reference-status').textContent='No optional PCS reference loaded.';metadata=[];metadataSources=[];metadataLayoutKind='unspecified';metadataOffsetPointers=[];metadataLists=[];metadataListConflicts=new Set();metadataMatchedWords=[];metadataWordConflicts=new Set();metadataWordSnapshot=null;metadataResolution=null;selectedAnchor=null;model=new RomModel(name,bytes);page=0;selected=null;patchFile=null;resetGraphicState();$('patch-filename').textContent='No patch selected';$('patch-picker').value='';$('edit-unlock').checked=false;$('hex-offset').value='000000';$('selected-offset').value='';$('selected-value').value='';updateIndicators();drawHex();drawAnchors();drawGraphics();drawChanges();toast(`${name} opened locally · ${formatSize(bytes.length)}`);}
$('rom-picker').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(file.size<0xC0 || file.size>MAX_BYTES)return toast('ROM must be 192 bytes to 128 MiB',true);
  if(model?.dirty && !(await confirmAction('Replace current ROM?','You have unsaved changes. Opening a different ROM will discard them.')))return;
  try{const bytes=new Uint8Array(await file.arrayBuffer());installModel(file.name,bytes);}catch(err){toast(`Could not open ROM: ${err.message}`,true);}
});
$('rom-fingerprint').addEventListener('click',async()=>{
  if(!model||fingerprintAbort)return;
  const current=model,controller=new AbortController();
  fingerprintAbort=controller;fingerprintResult=null;
  $('rom-fingerprint-status').textContent='Computing local SHA-256…';
  updateIndicators();
  try{
    const result=await fingerprintRomSha256(current,{
      signal:controller.signal,chunkSize:65536,yieldEvery:16,
      onProgress:(done,total)=>{
        if(model===current)$('rom-fingerprint-status').textContent=
          'Computing SHA-256… '+Math.round(done*100/total)+'%';
      }
    });
    if(model!==current)return;
    if(!fingerprintMatchesRom(current,result)){
      $('rom-fingerprint-status').textContent='ROM changed during hashing. Recompute its SHA-256.';
      return;
    }
    fingerprintResult=result;
    const comparison=compareRomIdentity(current,result);
    $('rom-fingerprint-status').textContent='SHA-256: '+result.sha256+
      ' ('+formatSize(result.length)+', current staged bytes). '+
      (comparison.status==='unknown'?'No independently verified CUBE fingerprint registered.':'Curated profile matched; metadata still unverified.')+
      ' Identity only — CUBE layout NOT verified; semantic writes remain disabled.';
    $('rom-fingerprint-compare-status').textContent='Paste a published expected SHA-256 to compare. A user-supplied hash cannot authenticate a CUBE layout.';
  }catch(err){
    if(model===current)$('rom-fingerprint-status').textContent='Fingerprint unavailable: '+err.message;
  }finally{
    if(fingerprintAbort===controller)fingerprintAbort=null;
    updateIndicators();
  }
});
$('rom-fingerprint-check').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  if(!fingerprintResult)throw Error('Compute the current ROM SHA-256 first');
  const result=compareRomIdentity(model,fingerprintResult,{
    expectedSha256:$('rom-fingerprint-expected').value
  });
  if(result.status==='stale')throw Error('ROM changed; compute SHA-256 again');
  if(result.expectedMatch===null)throw Error('Paste an expected SHA-256 first');
  $('rom-fingerprint-compare-status').textContent=result.expectedMatch?
    'Exact SHA-256 MATCH with your supplied digest. Provenance, CUBE layout and metadata are NOT authenticated.':
    'SHA-256 MISMATCH. These ROM bytes differ from your supplied digest; do not apply metadata intended for that build.';
}));
function clampPage(n){return Math.max(0,Math.min(Math.floor((model.length-1)/PER_PAGE),n));}
function setPageForOffset(offset){ensureModel();if(offset<0||offset>=model.length)throw Error('Offset outside this ROM');page=clampPage(Math.floor(offset/PER_PAGE));selected=offset;$('hex-offset').value=hex(offset);drawHex();updateIndicators();}
function drawHex(){
  const grid=$('hex-grid');if(!model){grid.innerHTML='<div class="empty-state">Open a ROM to inspect bytes.</div>';return;}
  page=clampPage(page);const start=page*PER_PAGE;$('hex-page-label').textContent=hex(start);$('hex-range-label').textContent=`– ${hex(Math.min(model.length-1,start+PER_PAGE-1))}`;
  const frag=document.createDocumentFragment();
  for(let row=0;row<PER_PAGE/8;row++){
    const line=document.createElement('div');line.className='hex-row';
    const offset=start+row*8,label=document.createElement('span');label.className='hex-address';label.textContent=hex(offset);line.append(label);
    for(let col=0;col<8;col++){
      const i=offset+col,b=document.createElement('button');b.className='hex-byte';b.type='button';
      if(i>=model.length){b.disabled=true;b.textContent='--';}else{
        b.textContent=bytetext(model.read(i));b.classList.toggle('is-edited',model.hasEdit(i));b.classList.toggle('is-selected',i===selected);
        b.setAttribute('aria-label',`Offset ${hex(i)} value ${bytetext(model.read(i))}`);
        b.onclick=()=>{selected=i;$('selected-offset').value=hex(i);$('selected-value').value=bytetext(model.read(i));drawHex();updateIndicators();};
      }
      line.append(b);
    }
    frag.append(line);
  }
  grid.replaceChildren(frag);if(selected!==null&&selected>=start&&selected<start+PER_PAGE){$('selected-offset').value=hex(selected);$('selected-value').value=bytetext(model.read(selected));}
}
$('hex-jump').addEventListener('click',()=>safeRun(()=>setPageForOffset(parseOffset($('hex-offset').value))));
$('hex-offset').addEventListener('keydown',e=>{if(e.key==='Enter')$('hex-jump').click();});
$('hex-prev').addEventListener('click',()=>safeRun(()=>{ensureModel();page=clampPage(page-1);selected=null;drawHex();}));
$('hex-next').addEventListener('click',()=>safeRun(()=>{ensureModel();page=clampPage(page+1);selected=null;drawHex();}));
$('hex-find').addEventListener('click',()=>safeRun(()=>{ensureModel();const bytes=parseHexBytes($('hex-search').value),start=selected===null?0:selected+1;let found=model.find(bytes,start);if(found<0&&start!==0)found=model.find(bytes,0);if(found<0)throw Error('Pattern not found');setPageForOffset(found);toast(`Found at 0x${hex(found)}`);}));
$('hex-search').addEventListener('keydown',e=>{if(e.key==='Enter')$('hex-find').click();});
$('edit-unlock').addEventListener('change',()=>{if(!$('edit-unlock').checked)toast('Raw editing locked');else toast('Raw editing unlocked. Save a backup before changing bytes.');updateIndicators();});
$('write-byte').addEventListener('click',()=>safeRun(()=>{
  ensureModel();if(!$('edit-unlock').checked)throw Error('Unlock raw editing first');if(selected===null)throw Error('Tap a byte first');
  const val=$('selected-value').value.trim();if(!/^[0-9a-f]{1,2}$/i.test(val))throw Error('Enter a 1–2 digit hexadecimal byte');
  if(model.write(selected,parseInt(val,16))){invalidateDecodedGraphic();clearWarpInspection('ROM bytes changed; inspect warps again.');clearConnectionInspection('ROM bytes changed; inspect connections again.');clearMapGrid('ROM bytes changed; inspect map cells again.');toast(`Staged edit at 0x${hex(selected)}`);}drawHex();updateIndicators();
}));
$('undo-button').addEventListener('click',()=>safeRun(()=>{if(model.undo()){invalidateDecodedGraphic();clearWarpInspection('ROM bytes changed; inspect warps again.');clearConnectionInspection('ROM bytes changed; inspect connections again.');clearMapGrid('ROM bytes changed; inspect map cells again.');drawHex();drawGraphics();updateIndicators();}}));
$('redo-button').addEventListener('click',()=>safeRun(()=>{if(model.redo()){invalidateDecodedGraphic();clearWarpInspection('ROM bytes changed; inspect warps again.');clearConnectionInspection('ROM bytes changed; inspect connections again.');clearMapGrid('ROM bytes changed; inspect map cells again.');drawHex();drawGraphics();updateIndicators();}}));
$('selected-value').addEventListener('keydown',e=>{if(e.key==='Enter')$('write-byte').click();});
// The graphic source and the colour palette are deliberately independent:
// a generic ROM offset has no known sprite layout or matching palette.
const defaultPalette=Array.from({length:16},(_,i)=>{const v=i*17;return {r:v,g:v,b:v,css:`rgb(${v},${v},${v})`,value:0};});
function invalidateDecodedGraphic(){if(graphicsSource?.kind==='lz')graphicsSource.bytes=null;}
function lastTilePage(){
  if(!model||!graphicsSource)return 0;
  const size=graphicsSource.kind==='lz'?graphicsSource.size:model.length-graphicsSource.offset;
  return Math.max(0,Math.floor((size-1)/8192));
}
function resetGraphicState(){
  scanToken++;scanning=false;graphicsSource=null;graphicCandidates=[];tilePage=0;paletteOffset=null;
  $('graphics-offset').value='';$('palette-offset').value='';
  $('graphics-candidates').replaceChildren(new Option('No streams selected',''));
  $('graphics-scan-status').textContent=model?'ROM loaded. Tap Find to discover compressed tile candidates.':'Open a ROM, then scan to find compressed tile candidates.';
  $('graphics-source-label').textContent='NO GRAPHICS SELECTED';
  $('graphics-detail').textContent='Waiting for a known graphic source.';
}
function drawGraphics(){
  palette=defaultPalette;
  if(model&&paletteOffset!==null){
    const paletteBytes=new Uint8Array(32);for(let i=0;i<32;i++)paletteBytes[i]=model.read(paletteOffset+i);
    palette=paletteAt(paletteBytes,0);
  }
  const paletteRoot=$('palette-grid'),swatches=document.createDocumentFragment();
  palette.forEach((color,i)=>{const sw=document.createElement('div');sw.className='swatch';sw.style.background=color.css;sw.title=paletteOffset!==null?`Index ${i} · BGR555 ${hex(color.value,4)}`:`Index ${i} · neutral preview`;const label=document.createElement('span');label.textContent=String(i).padStart(2,'0');sw.append(label);swatches.append(sw);});paletteRoot.replaceChildren(swatches);
  $('palette-caption').textContent=paletteOffset!==null?`ROM palette at 0x${hex(paletteOffset)}. This palette is user-selected, not verified to match the graphic.`:'Neutral grayscale preview. Enter a known ROM palette offset to view real colours.';
  ctx.clearRect(0,0,128,128);
  $('tile-canvas').hidden=!graphicsSource;
  $('tile-empty').hidden=!!graphicsSource;
  $('tiles-back').disabled=!graphicsSource||tilePage===0;
  $('tiles-forward').disabled=!graphicsSource||tilePage>=lastTilePage();
  if(!model||!graphicsSource)return;
  let pageBytes,totalBytes;
  try{
    if(graphicsSource.kind==='lz'){
      const result=graphicsSource.bytes?{data:graphicsSource.bytes,consumed:graphicsSource.compressedBytes}:decodeLz10(model,graphicsSource.offset);
      graphicsSource.bytes=result.data;graphicsSource.size=result.data.length;
      graphicsSource.compressedBytes=result.consumed;
      totalBytes=result.data.length;
      pageBytes=result.data.subarray(tilePage*8192,(tilePage+1)*8192);
    }else{
      totalBytes=model.length-graphicsSource.offset;
      const start=graphicsSource.offset+tilePage*8192;
      const limit=Math.min(8192,model.length-start);
      pageBytes=new Uint8Array(limit);
      for(let i=0;i<limit;i++)pageBytes[i]=model.read(start+i);
    }
  }catch(err){
    graphicsSource=null;$('tile-canvas').hidden=true;$('tile-empty').hidden=false;
    $('graphics-source-label').textContent='GRAPHIC DECODE ERROR';
    $('tile-empty').textContent=`Unable to decode selected data: ${err.message}`;
    $('graphics-detail').textContent='ROM bytes may have changed. Select the source again.';
    $('tiles-back').disabled=true;$('tiles-forward').disabled=true;return;
  }
  $('tile-empty').textContent='Select a compressed stream or enter a known tile offset.';
  $('graphics-source-label').textContent=`${graphicsSource.kind==='lz'?'LZ77 DECODED':'RAW 4BPP'} · 0x${hex(graphicsSource.offset)}`;
  $('graphics-detail').textContent=`${graphicsSource.kind==='lz'?'Decompressed stream':'Uncompressed bytes'} · ${Math.floor(totalBytes/32)} tiles · page ${tilePage+1}/${Math.max(1,Math.ceil(totalBytes/8192))}. The 16 × 16 arrangement is a tile contact sheet, not the original sprite layout.`;
  const image=ctx.createImageData(128,128);
  for(let tileIndex=0;tileIndex<256;tileIndex++){
    const off=tileIndex*32;if(off+32>pageBytes.length)break;
    const pixels=gba4bppTile(pageBytes,off,palette);
    const x0=(tileIndex%16)*8,y0=Math.floor(tileIndex/16)*8;
    for(let j=0;j<64;j++){
      const px=x0+j%8,py=y0+Math.floor(j/8),dst=(py*128+px)*4,col=palette[pixels[j]];
      image.data[dst]=col.r;image.data[dst+1]=col.g;image.data[dst+2]=col.b;image.data[dst+3]=255;
    }
  }
  ctx.putImageData(image,0,0);
  $('tiles-back').disabled=tilePage===0;
  $('tiles-forward').disabled=tilePage>=lastTilePage();
}
function chooseGraphic(kind,offset){
  ensureModel();if(!Number.isInteger(offset)||offset<0||offset>=model.length)throw Error('Graphics offset is outside ROM');
  if(kind==='raw'&&offset+32>model.length)throw Error('A raw 4bpp tile needs at least 32 bytes');
  const next=kind==='lz'?decodeLz10(model,offset):null;
  graphicsSource={kind,offset,size:next?.data.length||model.length-offset,compressedBytes:next?.consumed||0,bytes:next?.data||null};tilePage=0;
  $('graphics-offset').value=hex(offset);drawGraphics();
  toast(kind==='lz'?`Decoded ${next.data.length} bytes of LZ77 data at 0x${hex(offset)}`:'Raw 4bpp view: bytes may not represent graphics');
}
$('graphics-show').addEventListener('click',()=>safeRun(()=>chooseGraphic('raw',parseOffset($('graphics-offset').value))));
$('graphics-decode').addEventListener('click',()=>safeRun(()=>chooseGraphic('lz',parseOffset($('graphics-offset').value))));
$('palette-show').addEventListener('click',()=>safeRun(()=>{
  ensureModel();const off=parseOffset($('palette-offset').value);
  if(off+32>model.length)throw Error('Palette offset needs 32 bytes');
  paletteOffset=off;$('palette-offset').value=hex(off);drawGraphics();toast('User-selected palette loaded; matching is not verified.');
}));
$('palette-reset').addEventListener('click',()=>{paletteOffset=null;$('palette-offset').value='';drawGraphics();toast('Neutral grayscale restored.');});
$('tiles-back').addEventListener('click',()=>{tilePage=Math.max(0,tilePage-1);drawGraphics();});
$('tiles-forward').addEventListener('click',()=>{tilePage=Math.min(lastTilePage(),tilePage+1);drawGraphics();});
$('graphics-candidates').addEventListener('change',()=>safeRun(()=>{
  if($('graphics-candidates').value==='')return;
  const index=Number($('graphics-candidates').value);
  if(!Number.isInteger(index)||index<0||index>=graphicCandidates.length)throw Error('Choose a detected stream');
  chooseGraphic('lz',graphicCandidates[index].offset);
}));
$('graphics-scan').addEventListener('click',async()=>{
  if(!model||scanning)return;
  const token=++scanToken;scanning=true;graphicCandidates=[];const picker=$('graphics-candidates');
  picker.replaceChildren(new Option('Searching…',''));updateIndicators();
  $('graphics-scan-status').textContent='Scanning for structurally valid LZ77 streams. This can take time on large ROMs.';
  const data=model,chunkSize=1024*1024,limit=128;
  try{
    for(let start=0;start<data.length;start+=chunkSize){
      if(token!==scanToken)return;
      const batch=scanLz10Graphics(data,{start,end:Math.min(data.length,start+chunkSize),maxResults:limit-graphicCandidates.length});
      graphicCandidates.push(...batch);
      const percent=Math.round(100*Math.min(start+chunkSize,data.length)/data.length);
      $('graphics-scan-status').textContent=`Scanning ${percent}% · ${graphicCandidates.length} candidate stream(s) found`;
      if(graphicCandidates.length>=limit)break;
      await new Promise(resolve=>setTimeout(resolve,0)); // yield so the phone remains interactive
    }
    if(token!==scanToken)return;
    picker.replaceChildren(new Option(graphicCandidates.length?'Choose a candidate stream':'No valid streams found',''));
    graphicCandidates.forEach((item,index)=>picker.add(new Option(`0x${hex(item.offset)} · ${item.tileCount} tiles · ${formatSize(item.size)} decoded`,String(index))));
    $('graphics-scan-status').textContent=`Found ${graphicCandidates.length} structurally valid candidate(s)${graphicCandidates.length>=limit?' (128 result limit reached)':''}. Results are not confirmed sprites or guaranteed to have the correct palette.`;
    if(!graphicCandidates.length)toast('No LZ77 tile streams found. This ROM may use raw or other compression.',true);
  }catch(err){if(token===scanToken){$('graphics-scan-status').textContent=`Scan failed: ${err.message}`;toast(err.message,true);}}
  finally{if(token===scanToken){scanning=false;updateIndicators();}}
});
async function downloadFile(name,bytes,mime='application/octet-stream'){
  const data=new Blob([bytes],{type:mime});const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function safeName(name){return String(name).replace(/\.(gba|rom|bin)$/i,'').replace(/[^\w.\- ]+/g,'_').slice(0,100)||'rom';}
$('save-rom').addEventListener('click',()=>safeRun(()=>{ensureModel();downloadFile(`${safeName(model.name)}_mobilelab.gba`,model.snapshot());toast('ROM copy download started. Original file unchanged.');}));
$('save-project').addEventListener('click',()=>safeRun(()=>{
  ensureModel();if(model.appliedPatch)throw Error('Export a ROM copy and reopen it before exporting a JSON sidecar. Patch bytes are not represented in sidecar edits.');
  const data=JSON.stringify(model.project(),null,2);downloadFile(`${safeName(model.name)}_mobilelab.json`,data,'application/json');toast('Checksum-bound project JSON download started.');
}));
$('project-picker').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{
    ensureModel();if(file.size>16*1024*1024)throw Error('Project JSON is too large');
    const project=JSON.parse(await file.text());
    if(model.dirty&&!(await confirmAction('Replace staged edits?','Restoring a project will discard the current staged edits. Continue?')))return;
    const restored=model.loadProject(project);invalidateDecodedGraphic();clearWarpInspection('Project restored; inspect warps again.');clearConnectionInspection('Project restored; inspect connections again.');clearMapGrid('Project restored; inspect map cells again.');drawHex();drawGraphics();drawChanges();updateIndicators();toast(`Restored ${restored} bytes of checked edits.`);
  }catch(err){toast(err.message||String(err),true);}
});
$('patch-picker').addEventListener('change',e=>{patchFile=e.target.files?.[0]||null;$('patch-filename').textContent=patchFile?`${patchFile.name} · ${formatSize(patchFile.size)}`:'No patch selected';updateIndicators();});
$('apply-patch').addEventListener('click',async()=>{
  try{
    ensureModel();if(!patchFile)throw Error('Choose a patch file');if(patchFile.size>MAX_BYTES)throw Error('Patch too large');
    const confirmed=await confirmAction('Apply to a working copy?',`This will replace the current staged edit session with the patched result of ${patchFile.name}. The original ROM file is never overwritten. Save a new ROM copy after applying.`);
    if(!confirmed)return;
    const ext=patchFile.name.split('.').pop().toLowerCase();
    if(!['bps','ips'].includes(ext))throw Error('Choose an .ips or .bps patch');
    const bytes=new Uint8Array(await patchFile.arrayBuffer());
    // BPS uses the working data, and independently validates source/patch/target CRCs.
    // IPS lacks CRCs, so ask the user to verify target ROM compatibility.
    const current=model.snapshot(),result=ext==='bps'?applyBps(current,bytes):applyIps(current,bytes);
    model.switchPatched(result);metadataReset();page=0;selected=null;resetGraphicState();drawHex();drawGraphics();drawChanges();updateIndicators();toast(`${ext.toUpperCase()} applied in memory. Metadata cleared because ROM bytes/layout may have changed; reload metadata for this ROM.`);
  }catch(err){toast(err.message||String(err),true);}
});
$('export-ips').addEventListener('click',()=>safeRun(()=>{ensureModel();const bytes=model.exportIps();downloadFile(`${safeName(model.name)}_mobilelab.ips`,bytes);toast(`IPS diff exported (${bytes.length} bytes)`);}));
function drawChanges(){
  if(!model){$('header-diagnostics').textContent='Open a ROM to inspect its GBA header checksum.';$('summary-byte-count').textContent='0';$('summary-patched').textContent='NO';$('summary-size').textContent='—';$('change-list-info').textContent='No edits';$('changes-list').innerHTML='<div class="empty-state">Open a ROM and make a raw edit to see changes here.</div>';return;}
  const h=model.header();$('header-diagnostics').textContent=`${h.code} · fixed byte: ${h.fixedValid?'valid':'invalid'} · stored 0x${hex(h.stored,2)} · expected 0x${hex(h.expected,2)} · ${h.checksumValid?'checksum OK':'checksum mismatch'}`;
  $('summary-byte-count').textContent=model.edits.size.toLocaleString();$('summary-patched').textContent=model.appliedPatch?'YES':'NO';$('summary-size').textContent=formatSize(model.length);
  const entries=[...model.edits.entries()].sort((a,b)=>a[0]-b[0]);$('change-list-info').textContent=model.appliedPatch?`${entries.length} raw edits + applied patch`:`${entries.length} raw edits`;
  const root=$('changes-list'),frag=document.createDocumentFragment();
  if(model.appliedPatch){const info=document.createElement('div');info.className='empty-state';info.textContent='A patch was applied to the in-memory working ROM. Its complete output will be included when you Save ROM copy. Changes made by that patch are not listed individually.';frag.append(info);}
  if(!entries.length && !model.appliedPatch){const info=document.createElement('div');info.className='empty-state';info.textContent='No staged raw byte changes.';frag.append(info);}
  for(const [off,newByte] of entries.slice(0,500)){
    const line=document.createElement('div');line.className='change-row';const a=document.createElement('b');a.textContent=`0x${hex(off)}`;const b=document.createElement('span');b.textContent=bytetext(model.base[off]);const c=document.createElement('em');c.textContent=`→ ${bytetext(newByte)}`;line.append(a,b,c);frag.append(line);
  }
  if(entries.length>500){const n=document.createElement('div');n.className='empty-state';n.textContent=`Showing first 500 of ${entries.length} edits.`;frag.append(n);}root.replaceChildren(frag);
}
$('fix-checksum').addEventListener('click',()=>safeRun(()=>{ensureModel();const old=model.header(),value=model.fixHeader();invalidateDecodedGraphic();drawHex();drawGraphics();drawChanges();updateIndicators();toast(old.checksumValid?'Header checksum already matches':`Staged checksum byte 0x${hex(value,2)} at 0x0000BD`);}));
$('discard-button').addEventListener('click',async()=>{
  if(!model||!model.dirty)return toast('Nothing to discard');
  const yes=await confirmAction('Discard all changes?','This resets your in-memory workspace to the original ROM. Any applied patch and all staged raw edits will be lost.');
  if(yes){model.reset();clearWarpInspection('Edits discarded; inspect warps again.');clearConnectionInspection('Edits discarded; inspect connections again.');clearMapGrid('Edits discarded; inspect map cells again.');page=0;selected=null;resetGraphicState();$('edit-unlock').checked=false;drawHex();drawGraphics();drawChanges();updateIndicators();toast('Reset to original ROM.');}
});
window.addEventListener('beforeunload',e=>{if(model?.dirty){e.preventDefault();e.returnValue='';}});
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) navigator.serviceWorker.register('./sw.js').catch(()=>{});



// Named-data discovery is intentionally read-only until CUBHMA's full format
// engine, game fingerprints and pointer allocator have been ported and tested.
let displayedAnchors=[], selectedInspection=null;
const encodeHex=bytes=>Array.from(bytes).map((b,i)=>hex(b,2)+(i%16===15?'\n':' ')).join('').trim();
function metadataReset(){clearCubeRenderedMap('Metadata reset; render again.');metadataImportSerial++;metadataFingerprints=[];clearWarpInspection('Metadata reset; inspect warps again.');clearMapChangeReview();clearConnectionInspection('Metadata reset; inspect connections again.');clearMapGrid('Metadata reset; inspect map again.');metadata=[];metadataSources=[];mapBankMetadataReport=null;mapBankRawPointerEvidence=null;mapBankRawWindowEvidence=null;mapBankDeclaredEvidence=null;mapBankTargetEvidence=null;mapBankCustomSummary=null;cubeMapEvidence=null;cubeWarpEvidence=null;cubeConnectionEvidence=null;metadataLayoutKind='unspecified';metadataOffsetPointers=[];metadataLists=[];metadataListConflicts=new Set();metadataMatchedWords=[];metadataWordConflicts=new Set();metadataWordSnapshot=null;metadataResolution=null;selectedAnchor=null;selectedInspection=null;drawAnchors();}
function snapshotMatchedWords(words=metadataMatchedWords){
  if(!model)return [];
  return words.map(word=>{
    if(word.address<0||word.address>model.length-word.length)return null;
    let raw=0;
    for(let i=0;i<word.length;i++)raw+=model.read(word.address+i)*2**(8*i);
    return raw;
  });
}
function refreshMatchedWordResolution(){
  if(!model||!metadataMatchedWords.length)return;
  const now=snapshotMatchedWords();
  if(metadataWordSnapshot&&now.length===metadataWordSnapshot.length&&
     now.every((value,i)=>value===metadataWordSnapshot[i]))return;
  metadataResolution=resolveHmaTableLayouts(metadata,{
    romSize:model.length,rom:model,lists:metadataLists,conflictingLists:metadataListConflicts,
    matchedWords:metadataMatchedWords,conflictingWords:metadataWordConflicts,
    offsetPointers:metadataOffsetPointers
  });
  metadataWordSnapshot=now;
}
function metadataCommit(sources){
  ensureModel();
  // Hash raw bytes before TOML parsing; never derive identity from decoded text.
  // A failed parse or collision check leaves the previous fingerprints intact.
  const nextFingerprints=fingerprintMetadataFiles(sources.map(({name,bytes})=>({name,bytes})));

  // Fail closed for known mismatched stock-game TOML before changing active metadata.
  // Custom CUBE/project TOML remains manually importable but is never authenticated by header alone.
  const metadataCheck=checkHmaMetadataSources(sources,model);
  const nextMapBankReport=summarizeHmaMapBankSources(sources,{romSize:model.length});
  const nextMapBankCustomSummary=inspectHmaMapBankAnchorSources(sources,{romSize:model.length});
  // Preserve contradictory named declarations instead of silently replacing
  // them; the semantic resolver will exclude conflicting names from typed reads.
  const merged=collectHmaNamedAnchors(sources,{romSize:model.length});
  const nextMetadata=merged.anchors;
  const offsets=new Map();
  for(const source of sources){
    for(const offsetPointer of parseHmaOffsetPointers(source.text,{romSize:model.length})){
      const existing=offsets.get(offsetPointer.address);
      if(existing&&existing.offset!==offsetPointer.offset)
        throw Error('Conflicting OffsetPointer at 0x'+hex(offsetPointer.address)+' across metadata files');
      offsets.set(offsetPointer.address,{...offsetPointer,source:source.name});
    }
  }
  const namedLists=collectHmaLists(sources);
  const matched=collectHmaMatchedWords(sources,{romSize:model.length});
  const nextResolution=resolveHmaTableLayouts(nextMetadata,{
    romSize:model.length,rom:model,lists:namedLists.lists,conflictingLists:namedLists.conflictedNames,
    matchedWords:matched.words,conflictingWords:matched.conflictedNames,
    offsetPointers:[...offsets.values()]
  });
  const nextWordSnapshot=snapshotMatchedWords(matched.words);
  metadataOffsetPointers=[...offsets.values()];
  metadataLists=namedLists.lists;metadataListConflicts=namedLists.conflictedNames;
  metadataMatchedWords=matched.words;metadataWordConflicts=matched.conflictedNames;
  metadataWordSnapshot=nextWordSnapshot;
  metadata=nextMetadata;metadataResolution=nextResolution;
  metadataSources=sources.map(({name})=>name);metadataLayoutKind=metadataCheck.layout.kind;
  mapBankMetadataReport=nextMapBankReport;mapBankRawPointerEvidence=null;mapBankRawWindowEvidence=null;mapBankDeclaredEvidence=null;mapBankTargetEvidence=null;mapBankCustomSummary=nextMapBankCustomSummary;clearCubeRenderedMap('Metadata changed; render again.');cubeMapEvidence=null;cubeWarpEvidence=null;cubeConnectionEvidence=null;
  metadataFingerprints=nextFingerprints;
  clearWarpInspection('Metadata changed; re-inspect vanilla warps.');
  clearConnectionInspection('Metadata changed; re-inspect vanilla connections.');
  clearMapGrid('Metadata changed; recheck vanilla map structure compatibility.');
  selectedAnchor=null;selectedInspection=null;
  drawAnchors();
  toast(`Loaded ${metadata.length} anchor declarations; ${merged.conflictedNames.size} conflicting names; ${metadataResolution.anchoredCount} anchor-length, ${metadataResolution.listCount} list-length and ${metadataResolution.matchedCount} matched-word-length tables · ${metadataLayoutKind} TOML layout · ROM unverified`);
}
function semanticChild(tag,value,klass){const el=document.createElement(tag);el.textContent=value;if(klass)el.className=klass;return el;}
function drawAnchorDetails(){
  const root=$('anchor-detail');root.replaceChildren();
  $('anchor-to-hex').disabled=true;$('anchor-follow-pointer').disabled=true;$('anchor-to-graphics').disabled=true;
  if(!model||!selectedAnchor){root.append(semanticChild('div','Choose an anchor to inspect its address, format and bytes.','empty-state'));return;}
  refreshMatchedWordResolution();
  const a=selectedAnchor;
  root.append(semanticChild('h3',a.name));
  root.append(semanticChild('div',`Source: ${a.source} · TOML line ${a.line}`,'palette-note'));
  root.append(semanticChild('div',`Offset: 0x${hex(a.address)} · Format: ${a.format||'unspecified'}`,'semantic-code'));
  const resolved=metadataResolution?.byName.get(a.name);
  if(resolved?.kind==='anchored-count'||resolved?.kind==='named-list-count'||resolved?.kind==='matched-word-count')root.append(semanticChild('div',`Linked table length: ${resolved.layout.count} rows, derived from ${resolved.kind==='named-list-count'?'HMA named list ':resolved.kind==='matched-word-count'?'ROM-backed MatchedWords ':'table '}${resolved.lengthFrom} (beginning ${resolved.parentMargins?.beginning||0}, end ${resolved.parentMargins?.end||0}; metadata only).`,'palette-note'));
  if(resolved?.kind==='matched-word-count'){
    const words=metadataResolution.wordResolution.byName.get(resolved.lengthFrom)?.words||[];
    root.append(semanticChild('div','ROM-backed word source(s): '+words.slice(0,6).map(w=>'0x'+hex(w.address)).join(', ')+(words.length>6?' (more not shown)':'')+'. These are metadata claims, not authenticated code ownership.','palette-note'));
  }
  if(metadataResolution?.conflicted.has(a.name))root.append(semanticChild('div','Conflicting metadata byte claims detected (table/table, table/MatchedWords or OffsetPointer). Typed interpretation is disabled for this table.','semantic-warning'));
  const unresolvedReason=metadataResolution?.unresolved.get(a.name);
  if(unresolvedReason)root.append(semanticChild('div',`Table format not resolved: ${unresolvedReason}. No typed interpretation of this anchor is permitted.`,'semantic-warning'));
  if(!a.valid){root.append(semanticChild('div','This anchor is outside the selected ROM. It cannot be read.','semantic-warning'));return;}
  let inspection;
  try{inspection=readAnchorInspection(model,a);}catch(error){root.append(semanticChild('div',error.message,'semantic-warning'));return;}
  selectedInspection=inspection;
  root.append(semanticChild('div',`u8 ${inspection.byte} · u16 ${inspection.u16===null?'—':inspection.u16} · u32 ${inspection.u32===null?'—':'0x'+hex(inspection.u32,8)}`,'palette-note'));
  if(inspection.pointer!==null)root.append(semanticChild('div',`Valid GBA ROM pointer → 0x${hex(inspection.pointer)}`,'semantic-code'));
  else if(inspection.pointerCandidate)root.append(semanticChild('div','The first four bytes resemble a ROM pointer but target outside this ROM.','semantic-warning'));
  const pre=document.createElement('pre');pre.className='semantic-bytes';pre.textContent=encodeHex(inspection.bytes);root.append(pre);
  root.append(semanticChild('div','ASCII preview: '+inspection.preview,'palette-note'));
  // Only simple fixed-size table layouts are supported. Every field is read-only;
  // text is shown as bytes because PCS character conversion is not yet ported.
  if(a.format.startsWith('[')){
    try{
      const table=previewHmaFixedTable(model,a,{maxRows:8,tableResolution:metadataResolution,
        lists:metadataLists,conflictingLists:metadataListConflicts,anchors:metadata});
      if(!table){root.append(semanticChild('div','Complex/dynamic HMA table format: not interpreted by this build. Use the hex view; do not infer structure from raw bytes.','palette-note'));}
      else{
        const section=semanticChild('section','','semantic-table');
        section.append(semanticChild('h4',`Read-only table preview · ${table.count} row(s) · ${table.rowSize} bytes/row`));
        section.append(semanticChild('p','Read-only unsigned scalars; pointer targets are range-checked. Named-list enum labels are unverified hints and never replace raw values. Text fields show raw bytes, escape-aware FF termination and an unverified Gen 3 PCS preview. Optional imported text references are not authenticated against the ROM. No semantic text edits or pointer writes.','palette-note'));
        const scroller=semanticChild('div','','semantic-table-scroll');
        const grid=document.createElement('table');
        const head=document.createElement('thead'),headRow=document.createElement('tr');
        for(const title of ['Row / offset',...table.fields.map(f=>f.name)])headRow.append(semanticChild('th',title));
        head.append(headRow);grid.append(head);
        const body=document.createElement('tbody');
        for(const row of table.rows){
          const tr=document.createElement('tr'),td=document.createElement('td');
          const jump=semanticChild('button',`#${row.index} · 0x${hex(row.offset)}`,'semantic-row-jump');
          jump.type='button';jump.addEventListener('click',()=>safeRun(()=>{setPageForOffset(row.offset);gotoTab('hex');}));td.append(jump);tr.append(td);
          for(const cell of row.cells){
            const col=document.createElement('td');col.textContent=String(cell.value);
            if(cell.type==='pointer'&&cell.target!==null)col.title=`In-ROM pointer to 0x${hex(cell.target)}`;
            if(cell.enumLabel!==undefined){
              col.append(semanticChild('div',`Unverified list ${cell.enumSource}: ${cell.enumLabel}`,'palette-note'));
            }
            if(cell.type==='text-bytes'){
              const field=table.fields.find(f=>f.name===cell.name);
              // Read-only preview of an already-resolved, non-conflicted field.
              // Upstream default PCS is a fallback, never a ROM-authenticated map.
              const text=inspectFixedTextBytes(model,row.offset+field.offset,field.size);
              const status=text.malformedEscape?'Truncated PCS control escape in this field':
                text.terminated?`FF terminator at byte ${text.terminatorOffset}`:'No FF terminator within this field';
              col.append(semanticChild('div',status,'palette-note'));
              const header=model.header();
              if(header.fixedValid&&header.checksumValid){
                const pcs=pcsReference?
                  decodeHmaPcsReference(model,row.offset+field.offset,field.size,{gameCode:header.code,reference:pcsReference}):
                  decodeHmaPcsFallback(model,row.offset+field.offset,field.size,{gameCode:header.code});
                if(pcs.supported){
                  const warning=pcs.truncatedEscape?' [truncated escape]':
                    pcs.unknownByteCount?` [${pcs.unknownByteCount} unknown byte(s)]`:'';
                  col.append(semanticChild('div',(pcsReference?'Unverified imported PCS: ':'Unverified default PCS: ')+pcs.text+warning,'palette-note'));
                }
              }
              col.title=`${status}. ASCII-only raw byte hint (not PCS): ${text.asciiHint}`;
            }
            tr.append(col);
          }
          body.append(tr);
        }
        grid.append(body);scroller.append(grid);section.append(scroller);
        if(table.truncated)section.append(semanticChild('p',`First ${table.rows.length} rows shown; remaining rows are not loaded.`, 'palette-note'));
        root.append(section);
      }
    }catch(error){root.append(semanticChild('div',error.message,'semantic-warning'));}
  }
  // Explicit opt-in: bounded pointer inspection can take time on larger ROMs.
  // Matches from this incomplete semantic subset do NOT establish safe repointing.
  const refsSection=semanticChild('section','','semantic-table');
  refsSection.append(semanticChild('h4','Pointer references (read only)'));
  refsSection.append(semanticChild('p','Inspect pointer fields in supported fixed and linked-length tables plus a bounded aligned raw-byte search. Overlapping tables are excluded. These are potential references, not proven ownership.','palette-note'));
  const scanButton=semanticChild('button','Find possible references','semantic-row-jump');
  scanButton.type='button';
  if(a.address>=0x02000000){
    scanButton.disabled=true;
    refsSection.append(semanticChild('p','This anchor is above the 32 MiB GBA ROM pointer window; it cannot be targeted by a conventional 0x08/0x09 ROM pointer.','semantic-warning'));
  }
  const results=semanticChild('div','','semantic-references');
  scanButton.addEventListener('click',()=>safeRun(()=>{
    scanButton.disabled=true;scanButton.textContent='Scanning…';
    try {
    const refs=inspectHmaPointerReferences(model,a.address,metadata,{offsetPointers:metadataOffsetPointers,lists:metadataLists,conflictingLists:metadataListConflicts,matchedWords:metadataMatchedWords,conflictingWords:metadataWordConflicts,maxTableSlots:60000,maxDeclared:24,maxCandidates:20,maxScanBytes:2*1024*1024});
    results.replaceChildren();
    results.append(semanticChild('p',
      'Declared table/offset-pointer matches: '+refs.matchedDeclared+'; raw aligned candidates: '+refs.candidateHits+'. Scanned first '+formatSize(refs.scannedBytes)+' of '+formatSize(model.length)+' for raw candidates. '+refs.skippedTables+' tables and '+refs.skippedOffsetPointers+' offset sources skipped (bounds or budget).',
      'palette-note'));
    results.append(semanticChild('p',refs.disclaimer,'semantic-warning'));
    for(const ref of [...refs.declared,...refs.candidates]){
      const label=ref.kind==='typed-table'
        ? 'Typed-table match · '+ref.table+' #'+ref.row+' / '+ref.field+' · 0x'+hex(ref.source)
        : ref.kind==='offset-pointer'
        ? 'OffsetPointer match · displacement '+ref.offset+' · 0x'+hex(ref.source)
        : 'Unverified raw match · 0x'+hex(ref.source);
      const jump=semanticChild('button',label,'semantic-row-jump');
      jump.type='button';
      jump.addEventListener('click',()=>safeRun(()=>{setPageForOffset(ref.source);gotoTab('hex');}));
      results.append(jump);
    }
    if(refs.declaredTruncated||refs.candidatesTruncated)results.append(semanticChild('p','Result list truncated to keep the interface responsive.','palette-note'));
    if(!refs.rawScanComplete)results.append(semanticChild('p','Raw pattern search is incomplete: later ROM regions were NOT scanned.','semantic-warning'));
    if(refs.unsupportedFormats)results.append(semanticChild('p',refs.unsupportedFormats+' unsupported or unresolved table formats were not interpreted.', 'palette-note'));
    if(refs.conflictedTables)results.append(semanticChild('p',refs.conflictedTables+' conflicting table claims were excluded from typed reference results.', 'semantic-warning'));
    if(refs.skippedConflictedOffsetPointers)results.append(semanticChild('p',refs.skippedConflictedOffsetPointers+' OffsetPointer source(s) overlap incompatible metadata claims and were excluded.', 'semantic-warning'));

    if(!refs.matchedDeclared&&!refs.candidateHits)results.append(semanticChild('p','No matches in the inspected subset. This does not prove the anchor has no references.','palette-note'));
    } finally { scanButton.disabled=a.address>=0x02000000;scanButton.textContent='Scan again'; }
  }));
  refsSection.append(scanButton,results);
  root.append(refsSection);
  $('anchor-to-hex').disabled=false;
  $('anchor-follow-pointer').disabled=inspection.pointer===null;
  $('anchor-to-graphics').disabled=!inspection.isLz10;
}
function drawMetadataFingerprintStatus(){
  const output=$('metadata-fingerprint-status');
  if(!output)return;
  if(!metadataFingerprints.length){
    output.textContent='No metadata fingerprints loaded. Exact TOML identity is unverified.';
    return;
  }
  const hashes=metadataFingerprints.map(file=>file.name+' ('+file.length+' bytes): '+file.sha256).join('\n');
  let identity='Compute the current ROM SHA-256 to check for a matching curated profile.';
  if(fingerprintResult){
    const result=compareRomMetadataFingerprintRecords(model,fingerprintResult,metadataFingerprints);
    identity={
      'rom-unverified':'No verified ROM profile matches these bytes.',
      'metadata-missing':'No matching metadata file.',
      'multi-file-manifest-required':'Multiple TOML files require an authenticated overlay manifest.',
      'digest-mismatch':'Metadata digest does not match the ROM profile.',
      'exact-byte-match':'Metadata bytes match the profile digest; semantic writes remain disabled.'
    }[result.metadataBindingStatus]||'ROM fingerprint is stale or conflicts with its profile.';
  }
  output.textContent='Exact imported TOML SHA-256 (local only):\n'+hashes+
    '\n'+identity+' Identity does not authenticate CUBE layout or permit semantic writes.';
}
function drawMapBankRawWindowEvidence(){
  const status=$('map-bank-raw-window-status'),list=$('map-bank-raw-window-list');
  if(!status||!list)return;
  list.replaceChildren();
  const report=mapBankRawWindowEvidence;
  if(!report){
    status.textContent='No raw word window inspected. No bank entries or map counts are inferred.';
    return;
  }
  let fresh;
  try{
    fresh=inspectHmaMapBankRawWindow(model,mapBankMetadataReport,{words:report.wordCount});
    if(fresh.rows.some((row,i)=>row.sourceOffset!==report.rows[i].sourceOffset||
       row.rawWord!==report.rows[i].rawWord))
      throw Error('Raw pointer window changed');
  }catch(_err){
    mapBankRawWindowEvidence=null;mapBankDeclaredEvidence=null;mapBankTargetEvidence=null;
    status.textContent='Raw pointer window changed or expired; inspect again.';
    return;
  }
  status.textContent=fresh.wordCount+' raw words · '+fresh.conventionalCount+
    ' conventional pointer-shaped · '+fresh.inRomCount+
    ' in ROM bounds. Not authenticated CUBE bank entries.';
  for(const row of report.rows){
    const entry=document.createElement('div');entry.className='input-row';
    const source=document.createElement('button');source.type='button';
    source.className='subtle-button';source.textContent='#'+row.index+
      ' · 0x'+hex(row.sourceOffset)+' : 0x'+hex(row.rawWord,8);
    const jump=target=>safeRun(()=>{
      if(!mapBankRawWindowEvidence)throw Error('Raw window expired');
      const fresh=inspectHmaMapBankRawWindow(ensureModel(),mapBankMetadataReport,
        {words:mapBankRawWindowEvidence.wordCount});
      if(fresh.rows[row.index].rawWord!==row.rawWord||
         fresh.rows[row.index].sourceOffset!==row.sourceOffset)
        throw Error('Raw word changed; inspect window again');
      if(target&&fresh.rows[row.index].targetOffset===null)
        throw Error('No in-ROM target for this raw word');
      setPageForOffset(target?fresh.rows[row.index].targetOffset:row.sourceOffset);
      gotoTab('hex');
    });
    source.addEventListener('click',()=>jump(false));entry.append(source);
    if(row.targetOffset!==null){
      const target=document.createElement('button');target.type='button';
      target.className='subtle-button';
      target.textContent='Target 0x'+hex(row.targetOffset);
      target.addEventListener('click',()=>jump(true));entry.append(target);
    }
    list.append(entry);
  }
}
function drawMapBankDeclaredEvidence(){
  const status=$('map-bank-declared-status'),list=$('map-bank-declared-list');
  if(!status||!list)return;
  list.replaceChildren();
  const report=mapBankDeclaredEvidence;
  if(!report){
    status.textContent='No declared pointer table inspected. TOML counts do not authenticate CUBE banks.';
    return;
  }
  let fresh;
  try{
    fresh=inspectHmaDeclaredBankPointerTable(ensureModel(),mapBankMetadataReport);
    if(fresh.anchorOffset!==report.anchorOffset||
       fresh.declaredBankCount!==report.declaredBankCount||
       fresh.rows.some((row,i)=>row.rawWord!==report.rows[i].rawWord||
         row.sourceOffset!==report.rows[i].sourceOffset))
      throw Error('Declared pointer table changed');
  }catch(_err){
    mapBankDeclaredEvidence=null;mapBankTargetEvidence=null;
    status.textContent='Declared table changed or expired; inspect again.';
    return;
  }
  status.textContent=fresh.declaredBankCount+' metadata-declared pointer slots · '+
    fresh.inRomCount+' in-ROM pointer-shaped · '+fresh.duplicateTargetCount+
    ' repeated targets · '+fresh.unalignedCount+' unaligned · '+
    fresh.insideTableCount+' point inside table. None are verified CUBE bank entries.';
  for(const row of report.rows){
    const entry=document.createElement('div');entry.className='input-row';
    const source=document.createElement('button');source.type='button';
    source.className='subtle-button';
    source.textContent='#'+row.index+' · 0x'+hex(row.sourceOffset)+
      ': 0x'+hex(row.rawWord,8)+(row.duplicateOf===null?'':' · repeats #'+row.duplicateOf);
    const jump=target=>safeRun(()=>{
      if(mapBankDeclaredEvidence!==report)throw Error('Declared table expired');
      const now=inspectHmaDeclaredBankPointerTable(ensureModel(),mapBankMetadataReport);
      if(now.anchorOffset!==report.anchorOffset||
         now.declaredBankCount!==report.declaredBankCount||
         now.rows.some((r,i)=>r.rawWord!==report.rows[i].rawWord||
           r.sourceOffset!==report.rows[i].sourceOffset))
        throw Error('Declared pointer table changed; inspect again');
      const current=now.rows[row.index];
      if(target&&current.targetOffset===null)throw Error('No in-ROM raw pointer target');
      setPageForOffset(target?current.targetOffset:current.sourceOffset);
      gotoTab('hex');
    });
    source.addEventListener('click',()=>jump(false));entry.append(source);
    if(row.targetOffset!==null){
      const target=document.createElement('button');target.type='button';
      target.className='subtle-button';
      target.textContent='Raw target 0x'+hex(row.targetOffset);
      target.addEventListener('click',()=>jump(true));entry.append(target);
    }
    list.append(entry);
  }
}
function drawMapBankTargetEvidence(){
  const status=$('map-bank-target-status'),list=$('map-bank-target-list');
  list.replaceChildren();
  const report=mapBankTargetEvidence;
  if(!report){
    status.textContent='No second-hop raw target windows inspected. No map counts or CUBE structures inferred.';
    return;
  }
  let fresh;
  try{
    fresh=inspectHmaDeclaredBankTargetWindows(ensureModel(),mapBankMetadataReport,{wordsPerTarget:4});
    if(fresh.anchorOffset!==report.anchorOffset||
       JSON.stringify(fresh.rows)!==JSON.stringify(report.rows))
      throw Error('Raw target window bytes changed');
  }catch(_err){
    mapBankTargetEvidence=null;
    status.textContent='Raw target windows changed or expired; inspect again.';
    return;
  }
  status.textContent=fresh.sampledTargets+' unique raw targets sampled · '+
    fresh.inRomNestedWords+' in-ROM pointer-shaped words · '+
    fresh.duplicateTargets+' repeated · '+fresh.overlappingWindows+
    ' overlapping · '+fresh.truncatedTargets+' truncated. These are NOT decoded CUBE maps.';
  for(const row of report.rows){
    const entry=document.createElement('div');entry.className='anchor-detail';
    entry.append(semanticChild('strong','Slot #'+row.slotIndex+' · '+row.status+
      (row.targetOffset===null?'':' · target 0x'+hex(row.targetOffset))));
    if(row.status==='sampled'){
      for(const word of row.words){
        const line=document.createElement('div');line.className='input-row';
        const source=document.createElement('button');source.type='button';
        source.className='subtle-button';
        source.textContent='Word #'+word.index+' at 0x'+hex(word.sourceOffset)+
          ': 0x'+hex(word.rawWord,8);
        const jump=follow=>safeRun(()=>{
          if(mapBankTargetEvidence!==report)throw Error('Target inspection expired');
          const now=inspectHmaDeclaredBankTargetWindows(ensureModel(),mapBankMetadataReport,
            {wordsPerTarget:4});
          if(now.anchorOffset!==report.anchorOffset||
             JSON.stringify(now.rows)!==JSON.stringify(report.rows))
            throw Error('Raw target bytes changed; inspect again');
          const current=now.rows[row.slotIndex]?.words[word.index];
          if(!current||follow&&current.targetOffset===null)
            throw Error('Raw pointer target unavailable');
          setPageForOffset(follow?current.targetOffset:current.sourceOffset);
          gotoTab('hex');
        });
        source.addEventListener('click',()=>jump(false));line.append(source);
        if(word.targetOffset!==null){
          const follow=document.createElement('button');follow.type='button';
          follow.className='subtle-button';
          follow.textContent='Candidate 0x'+hex(word.targetOffset);
          follow.addEventListener('click',()=>jump(true));line.append(follow);
        }
        entry.append(line);
      }
    }
    list.append(entry);
  }
}
function drawMapBankRawPointerEvidence(){
  const output=$('map-bank-raw-status'),follow=$('map-bank-raw-follow');
  if(!output||!follow)return;
  follow.disabled=true;
  if(!mapBankRawPointerEvidence){
    output.textContent='No raw anchor word inspected. The declaration is not a verified map-bank structure.';
    return;
  }
  try{
    const fresh=inspectHmaMapBankRawPointer(model,mapBankMetadataReport);
    if(fresh.rawWord!==mapBankRawPointerEvidence.rawWord||
       fresh.sourceOffset!==mapBankRawPointerEvidence.sourceOffset){
      mapBankRawPointerEvidence=null;
      output.textContent='Raw anchor bytes changed; inspect again. No cached pointer is trusted.';
      return;
    }
    output.textContent='Raw word 0x'+hex(fresh.rawWord,8)+' at 0x'+hex(fresh.sourceOffset)+
      ' · '+fresh.status+
      (fresh.targetOffset===null?'':' · candidate target 0x'+hex(fresh.targetOffset))+
      '. This is not a decoded CUBE map-bank table.';
    follow.disabled=fresh.targetOffset===null;
  }catch(_err){
    mapBankRawPointerEvidence=null;
    output.textContent='Raw anchor evidence expired; import metadata and inspect again.';
  }
}
function drawMapBankMetadataReport(){
  const status=$('map-bank-metadata-status'),list=$('map-bank-metadata-list');
  const jump=$('map-bank-metadata-jump');
  list.replaceChildren();
  const report=mapBankMetadataReport;
  jump.disabled=true;
  $('map-bank-raw-inspect').disabled=true;
  $('map-bank-raw-window-scan').disabled=true;
  $('map-bank-declared-scan').disabled=true;
  $('map-bank-target-scan').disabled=true;
  $('cube-map-inspect').disabled=true;
  if(!report){
    status.textContent='Import TOML metadata to inspect the CUBHMA data.maps.banks declaration. No ROM layout is authenticated.';
    list.append(semanticChild('p','No map-bank metadata inspected.','palette-note'));
    drawMapBankRawPointerEvidence();
    drawMapBankRawWindowEvidence();
    drawMapBankDeclaredEvidence();
    drawMapBankTargetEvidence();
    drawCubeMapEvidence();
    return;
  }
  const labels={
    'missing':'No data.maps.banks anchor in imported TOML',
    'custom-candidate':'Custom map format declared (unverified)',
    'vanilla-marker':'Vanilla format marker declared (unverified)',
    'conflicting-declarations':'Conflicting map-bank declarations — no selection',
    'ambiguous-format':'Ambiguous repeated pointer fields — no selection',
    'invalid-address':'Unaligned or out-of-ROM map-bank address',
    'malformed-format':'Malformed map-bank format',
    'unresolved-format':'Unsupported or unresolved map-bank format'
  };
  status.textContent=(labels[report.status]||'Unresolved map-bank metadata')+
    '. '+report.declarationCount+' declaration(s), '+report.uniqueDeclarationCount+
    ' unique. Metadata only; no CUBE ROM authentication or semantic writes.';
  for(const d of report.declarations){
    const row=document.createElement('div');row.className='palette-note';
    row.append(semanticChild('strong',d.source+' · line '+d.line));
    row.append(semanticChild('p','Offset 0x'+hex(d.address)+
      ' · format length '+d.formatLength+
      ' · ROM bounds '+(d.addressInBounds===true?'within declared ROM':d.addressInBounds===false?'invalid':'unknown')));
    list.append(row);
  }
  if(report.sectionNames.length)
    list.append(semanticChild('p','Declared sections: '+report.sectionNames.join(', ')+
      '. These are metadata hints, not decoded ROM structures.','palette-note'));
  if(report.ambiguousFields.length)
    list.append(semanticChild('p','Repeated fields: '+report.ambiguousFields.map(d=>
      d.scope+'.'+d.name+' ('+d.count+')').join(', ')+'.','semantic-warning'));
  const valid=['custom-candidate','vanilla-marker'].includes(report.status)&&
    report.uniqueDeclarationCount===1&&report.declarations.length>0&&
    report.declarations.every(d=>d.addressInBounds===true)&&
    !!model&&report.declarations[0].address<=model.length-4;
  jump.disabled=!valid;
  $('map-bank-raw-inspect').disabled=!valid;
  $('map-bank-raw-window-scan').disabled=!valid||report.declarations[0].address>model.length-64;
  $('map-bank-declared-scan').disabled=!valid||!Number.isSafeInteger(report.declaredBankCount)||
    report.declaredBankCount<1||report.declaredBankCount>256||
    report.declarations[0].address>model.length-report.declaredBankCount*4;
  $('map-bank-target-scan').disabled=$('map-bank-declared-scan').disabled;
  $('cube-map-inspect').disabled=$('map-bank-declared-scan').disabled||report.status!=='custom-candidate';
  drawMapBankRawPointerEvidence();
  drawMapBankRawWindowEvidence();
  drawMapBankDeclaredEvidence();
  drawMapBankTargetEvidence();
  drawCubeMapEvidence();
}

function clearCubeRenderedMap(message='CUBE render invalidated; render again.'){
  cubeRenderEvidence=null;cubeRenderSelection=null;
  $('cube-map-render-canvas').hidden=true;
  $('cube-map-render-jump').disabled=true;
  $('cube-map-render-status').textContent=message;
  $('cube-map-render-selection').textContent='Tap a rendered CUBE cell to inspect raw offsets.';
}
function drawCubeMapEvidence(){
  const status=$('cube-map-status'),details=$('cube-map-details');
  details.replaceChildren();
  $('cube-map-warps').disabled=true;
  $('cube-map-connections').disabled=true;
  $('cube-map-render').disabled=true;
  for(const id of ['cube-map-page','cube-map-left','cube-map-right','cube-map-up','cube-map-down'])$(id).disabled=true;
  const snapshot=cubeMapEvidence;
  if(!snapshot){
    clearCubeRenderedMap('Select a custom CUBE map before rendering.');
    status.textContent='Select a CUBE bank/map and supply its explicit map count. The ROM and custom layout remain unverified.';
    drawCubeWarpEvidence();
    drawCubeConnectionEvidence();
    return;
  }
  let fresh;
  try{
    fresh=inspectHmaCubeMapEntry(ensureModel(),mapBankCustomSummary,snapshot.options);
    if(JSON.stringify(fresh)!==JSON.stringify(snapshot.report))
      throw Error('CUBE map structure changed');
  }catch(_err){
    cubeMapEvidence=null;
    cubeWarpEvidence=null;cubeConnectionEvidence=null;
    clearCubeRenderedMap('CUBE map changed; render again.');
    status.textContent='Custom map structure changed or expired. Inspect again before navigating.';
    drawCubeWarpEvidence();
    drawCubeConnectionEvidence();
    return;
  }
  $('cube-map-warps').disabled=false;
  $('cube-map-connections').disabled=false;
  $('cube-map-render').disabled=false;
  for(const id of ['cube-map-page','cube-map-left','cube-map-right','cube-map-up','cube-map-down'])$(id).disabled=false;
  const h=fresh.header,l=fresh.layout;
  status.textContent='CUBE custom-format candidate: bank '+fresh.bankIndex+
    ', map '+fresh.mapIndex+' · '+l.width+' × '+l.height+
    ' raw cells · region '+h.regionSectionId+' · weather '+h.weather+
    '. Format recognized, ROM NOT authenticated; no editing or walkability inference.';
  function jumpButton(label,offset){
    const button=document.createElement('button');button.type='button';
    button.className='subtle-button';button.textContent=label+' · 0x'+hex(offset);
    button.addEventListener('click',()=>safeRun(()=>{
      if(cubeMapEvidence!==snapshot)throw Error('CUBE map inspection expired');
      const now=inspectHmaCubeMapEntry(ensureModel(),mapBankCustomSummary,snapshot.options);
      if(JSON.stringify(now)!==JSON.stringify(snapshot.report))
        throw Error('Custom map structure changed; inspect again');
      setPageForOffset(offset);gotoTab('hex');
    }));
    details.append(button);
  }
  jumpButton('Map pointer',fresh.mapPointerSource);
  jumpButton('Map header',h.address);
  jumpButton('Custom layout',l.address);
  jumpButton('Raw blockmap',l.blockmapOffset);
  if(h.eventsOffset!==null)jumpButton('Event group (unparsed)',h.eventsOffset);
  const open=document.createElement('button');open.type='button';open.className='subtle-button';
  open.textContent='Open raw blockmap viewport (not rendered)';
  open.addEventListener('click',()=>safeRun(()=>{
    if(cubeMapEvidence!==snapshot)throw Error('CUBE map inspection expired');
    const now=inspectHmaCubeMapEntry(ensureModel(),mapBankCustomSummary,snapshot.options);
    if(JSON.stringify(now)!==JSON.stringify(snapshot.report))
      throw Error('Custom map structure changed; inspect again');
    $('map-offset').value=hex(now.layout.blockmapOffset);
    $('map-width').value=String(now.layout.width);
    $('map-height').value=String(now.layout.height);
    $('map-x').value='0';$('map-y').value='0';
    gotoTab('maps');$('map-inspect').click();
  }));
  details.append(open);
  const originX=Number($('cube-map-x').value),originY=Number($('cube-map-y').value);
  if(!/^[0-9]+$/.test($('cube-map-x').value)||!/^[0-9]+$/.test($('cube-map-y').value)||
     originX>=l.width||originY>=l.height)
    throw new RangeError('CUBE grid origin must be within the declared map');
  if(cubeRenderEvidence&&(cubeRenderEvidence.options!==snapshot.options||
      cubeRenderEvidence.x!==originX||cubeRenderEvidence.y!==originY))
    clearCubeRenderedMap('Viewport changed; render again.');
  const grid=inspectBlockMap(model,{address:l.blockmapOffset,width:l.width,height:l.height,
    x:originX,y:originY,viewportWidth:Math.min(10,l.width),
    viewportHeight:Math.min(8,l.height)});
  let eventArrays=null;
  try{
    if(cubeWarpEvidence&&cubeWarpEvidence.options===snapshot.options){
      const events=inspectHmaCubeMapEventWarps(model,mapBankCustomSummary,snapshot.options);
      if(JSON.stringify(events)===JSON.stringify(cubeWarpEvidence.report))
        eventArrays=events.arrays;
    }
  }catch(_err){eventArrays=null;}
  const markerAt=(x,y)=>{
    if(!eventArrays)return '';
    const labels={objects:'O',warps:'W',scripts:'T',signposts:'S'};
    return Object.entries(labels).map(([kind,mark])=>{
      const count=eventArrays[kind].filter(record=>record.x===x&&record.y===y).length;
      return count?mark+count:'';
    }).filter(Boolean).join(' ');
  };
  details.append(semanticChild('p','Raw CUBE grid ('+originX+','+originY+') · '+
    grid.columns+' × '+grid.rows+' cells. Tile ID / raw high six bits; outlined by raw value.'+
    (eventArrays?' O=object W=warp T=trigger S=sign.':' Inspect events to overlay markers.')+
    ' NOT verified passability or rendered tiles. Tap to inspect source bytes.','palette-note'));
  for(const row of grid.cells){
    const line=document.createElement('div');line.className='input-row';
    line.style.display='grid';line.style.gridTemplateColumns='repeat('+grid.columns+',minmax(3rem,1fr))';
    line.style.overflowX='auto';line.style.gap='2px';
    for(const cell of row){
      const button=document.createElement('button');button.type='button';
      button.className='subtle-button';
      button.textContent=cell.tileId+'/'+cell.collision+' '+markerAt(cell.x,cell.y);
      button.style.borderColor='hsl('+((cell.collision*47)%360)+' 55% 65%)';
      button.title='('+cell.x+','+cell.y+') at 0x'+hex(cell.byteOffset);
      button.addEventListener('click',()=>safeRun(()=>{
        if(cubeMapEvidence!==snapshot)throw Error('CUBE map inspection expired');
        const now=inspectHmaCubeMapEntry(ensureModel(),mapBankCustomSummary,snapshot.options);
        if(JSON.stringify(now)!==JSON.stringify(snapshot.report))
          throw Error('Custom map structure changed; inspect again');
        const current=inspectBlockMap(model,{address:now.layout.blockmapOffset,
          width:now.layout.width,height:now.layout.height,x:cell.x,y:cell.y,
          viewportWidth:1,viewportHeight:1}).cells[0][0];
        if(current.raw!==cell.raw)throw Error('Raw cell changed; inspect again');
        setPageForOffset(current.byteOffset);gotoTab('hex');
      }));
      line.append(button);
    }
    details.append(line);
  }
  drawCubeWarpEvidence();
  drawCubeConnectionEvidence();
}
$('cube-map-page').addEventListener('click',()=>safeRun(()=>{
  if(!cubeMapEvidence)throw Error('Inspect a CUBE custom map first');
  drawCubeMapEvidence();
}));
for(const [id,axis,step] of [
  ['cube-map-left','x',-10],['cube-map-right','x',10],
  ['cube-map-up','y',-8],['cube-map-down','y',8]]){
  $(id).addEventListener('click',()=>safeRun(()=>{
    if(!cubeMapEvidence)throw Error('Inspect a CUBE custom map first');
    const l=cubeMapEvidence.report.layout;
    const input=$(axis==='x'?'cube-map-x':'cube-map-y');
    const old=Number(input.value);
    if(!/^[0-9]+$/.test(input.value))throw Error('Enter a valid grid origin');
    input.value=String(Math.max(0,Math.min((axis==='x'?l.width:l.height)-1,old+step)));
    drawCubeMapEvidence();
  }));
}
$('cube-map-inspect').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  const options={bankIndex:Number($('cube-bank-index').value),
    mapIndex:Number($('cube-map-index').value),
    mapCount:Number($('cube-map-count').value)};
  if(!['cube-bank-index','cube-map-index','cube-map-count'].every(id=>/^[0-9]+$/.test($(id).value)))
    throw Error('Explicit integer bank/map indexes and map count required');
  const report=inspectHmaCubeMapEntry(model,mapBankCustomSummary,options);
  clearCubeRenderedMap('New CUBE map selected; render again.');
  cubeMapEvidence={options,report};cubeWarpEvidence=null;cubeConnectionEvidence=null;
  $('cube-map-x').value='0';$('cube-map-y').value='0';
  drawCubeMapEvidence();
}));


$('cube-map-render').addEventListener('click',()=>safeRun(()=>{
  if(!cubeMapEvidence)throw Error('Inspect a custom CUBE map first');
  const options=cubeMapEvidence.options;
  const current=inspectHmaCubeMapEntry(ensureModel(),mapBankCustomSummary,options);
  if(JSON.stringify(current)!==JSON.stringify(cubeMapEvidence.report))
    throw Error('Selected CUBE map changed; inspect again');
  const x=Number($('cube-map-x').value),y=Number($('cube-map-y').value);
  if(!/^[0-9]+$/.test($('cube-map-x').value)||!/^[0-9]+$/.test($('cube-map-y').value))
    throw Error('Enter valid CUBE viewport coordinates');
  const rendered=renderHmaCubeMapViewport(model,mapBankCustomSummary,{
    ...options,x,y,viewportWidth:10,viewportHeight:8});
  const canvas=$('cube-map-render-canvas'),ctx=canvas.getContext('2d');
  canvas.width=rendered.width;canvas.height=rendered.height;
  const image=ctx.createImageData(rendered.width,rendered.height);
  image.data.set(rendered.pixels);ctx.putImageData(image,0,0);
  canvas.style.width=(rendered.width*2)+'px';
  canvas.style.height=(rendered.height*2)+'px';
  canvas.hidden=false;
  cubeRenderEvidence={rom:model,options,x,y,map:rendered.map,
    pixels:rendered.pixels.slice(),cellsJson:JSON.stringify(rendered.cells),
    attributesJson:JSON.stringify(rendered.attributes)};
  cubeRenderSelection=null;$('cube-map-render-jump').disabled=true;
  $('cube-map-render-status').textContent='Rendered '+rendered.columns+' × '+
    rendered.rows+' CUBE RSE metatiles (16 × 16 pixels each). Unsupported custom light palettes and FRLG layouts are refused. ROM/layout and walkability remain unverified.';
  $('cube-map-render-selection').textContent='Tap a rendered cell to inspect raw source offsets.';
}));
$('cube-map-render-canvas').addEventListener('click',event=>safeRun(()=>{
  const snapshot=cubeRenderEvidence;
  if(!snapshot||snapshot.rom!==model||!cubeMapEvidence||
     snapshot.options!==cubeMapEvidence.options)
    throw Error('CUBE rendered map expired; render again');
  const fresh=renderHmaCubeMapViewport(model,mapBankCustomSummary,{
    ...snapshot.options,x:snapshot.x,y:snapshot.y,viewportWidth:10,viewportHeight:8});
  if(JSON.stringify(fresh.map)!==JSON.stringify(snapshot.map)||
     JSON.stringify(fresh.cells)!==snapshot.cellsJson||
     JSON.stringify(fresh.attributes)!==snapshot.attributesJson||
     fresh.pixels.length!==snapshot.pixels.length||
     !fresh.pixels.every((value,i)=>value===snapshot.pixels[i]))
    throw Error('CUBE rendered bytes changed; render again');
  const canvas=$('cube-map-render-canvas'),rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)throw Error('Rendered canvas is not visible');
  const hit=inspectRenderedMapPixel(fresh,
    (event.clientX-rect.left)*canvas.width/rect.width,
    (event.clientY-rect.top)*canvas.height/rect.height);
  if(!hit)return;
  cubeRenderSelection={snapshot,cellOffset:hit.cell.byteOffset};
  $('cube-map-render-jump').disabled=false;
  $('cube-map-render-selection').textContent='Cell ('+hit.cell.x+','+hit.cell.y+
    ') · tile '+hit.cell.tileId+' · raw high bits '+hit.cell.collision+
    ' · behavior 0x'+hex(hit.attribute.behavior,2)+' · layer '+hit.attribute.layer+
    ' · blockmap 0x'+hex(hit.cell.byteOffset)+' · attributes 0x'+
    hex(hit.attribute.attributeOffset)+'. Not verified walkability.';
}));
$('cube-map-render-jump').addEventListener('click',()=>safeRun(()=>{
  const selection=cubeRenderSelection,snapshot=selection?.snapshot;
  if(!snapshot||snapshot!==cubeRenderEvidence||snapshot.rom!==model)
    throw Error('Rendered CUBE selection expired');
  const fresh=renderHmaCubeMapViewport(model,mapBankCustomSummary,{
    ...snapshot.options,x:snapshot.x,y:snapshot.y,viewportWidth:10,viewportHeight:8});
  if(JSON.stringify(fresh.map)!==JSON.stringify(snapshot.map)||
     JSON.stringify(fresh.cells)!==snapshot.cellsJson||
     JSON.stringify(fresh.attributes)!==snapshot.attributesJson||
     fresh.pixels.length!==snapshot.pixels.length||
     !fresh.pixels.every((value,i)=>value===snapshot.pixels[i]))
    throw Error('Rendered CUBE selection changed; render again');
  setPageForOffset(selection.cellOffset);gotoTab('hex');
}));

function drawCubeWarpEvidence(){
  const status=$('cube-warps-status'),list=$('cube-warps-list');
  list.replaceChildren();
  const snapshot=cubeWarpEvidence;
  if(!snapshot){
    status.textContent='No CUBE custom event arrays inspected. Select a map and inspect raw warps.';
    return;
  }
  let fresh;
  try{
    if(!cubeMapEvidence||cubeMapEvidence.options!==snapshot.options)
      throw Error('Selected CUBE map changed');
    fresh=inspectHmaCubeMapEventWarps(ensureModel(),mapBankCustomSummary,snapshot.options);
    if(JSON.stringify(fresh)!==JSON.stringify(snapshot.report))
      throw Error('Event records changed');
  }catch(_err){
    cubeWarpEvidence=null;
    status.textContent='CUBE event records changed or expired. Inspect again before navigation.';
    return;
  }
  status.textContent='Event counts: '+fresh.counts.objects+' objects, '+fresh.counts.warps+
    ' warps, '+fresh.counts.scripts+' triggers, '+fresh.counts.signposts+
    ' signs. Raw records only; target map counts and gameplay access are unverified.';
  if(fresh.eventsOffset===null)return;
  const head=document.createElement('button');head.type='button';head.className='subtle-button';
  head.textContent='Event group at 0x'+hex(fresh.eventsOffset);
  head.addEventListener('click',()=>safeRun(()=>{
    if(cubeWarpEvidence!==snapshot)throw Error('Event inspection expired');
    const now=inspectHmaCubeMapEventWarps(ensureModel(),mapBankCustomSummary,snapshot.options);
    if(JSON.stringify(now)!==JSON.stringify(snapshot.report))throw Error('Event group changed');
    setPageForOffset(now.eventsOffset);gotoTab('hex');
  }));
  list.append(head);
  const labels={objects:'Object',warps:'Warp',scripts:'Trigger',signposts:'Sign'};
  for(const [kind,records] of Object.entries(fresh.arrays)){
    for(const record of records){
      const button=document.createElement('button');button.type='button';
      button.className='subtle-button';
      let info='';
      if(kind==='warps')info=' → bank '+record.targetBank+', map '+
        record.targetMap+', warp '+record.warpId+(record.specialTarget?' · special target':'');
      else if(kind==='objects')info=' · object ID '+record.id+', graphics '+record.graphics+
        ', movement '+record.movement+', flag '+record.flag;
      else if(kind==='scripts')info=' · trigger '+record.trigger+
        ', raw index '+record.indexValue;
      else info=' · kind '+record.kind+', raw argument 0x'+hex(record.rawArgument,8);
      button.textContent=labels[kind]+' #'+record.index+' ('+record.x+','+record.y+')'+
        info+(record.outsideDeclaredMap?' · outside map':'');
      button.addEventListener('click',()=>safeRun(()=>{
        if(cubeWarpEvidence!==snapshot)throw Error('Event inspection expired');
        const now=inspectHmaCubeMapEventWarps(ensureModel(),mapBankCustomSummary,snapshot.options);
        if(JSON.stringify(now)!==JSON.stringify(snapshot.report))
          throw Error('Raw event record changed; inspect again');
        setPageForOffset(now.arrays[kind][record.index].offset);gotoTab('hex');
      }));
      list.append(button);
      if(record.scriptPointerSource!==undefined){
        const source=document.createElement('button');source.type='button';
        source.className='subtle-button';
        source.textContent='Script pointer field · 0x'+hex(record.scriptPointerSource)+
          ' (raw 0x'+hex(record.scriptPointer,8)+')';
        source.addEventListener('click',()=>safeRun(()=>{
          if(cubeWarpEvidence!==snapshot)throw Error('Event inspection expired');
          const now=inspectHmaCubeMapEventWarps(ensureModel(),mapBankCustomSummary,snapshot.options);
          if(JSON.stringify(now)!==JSON.stringify(snapshot.report))
            throw Error('Raw script pointer field changed; inspect again');
          setPageForOffset(now.arrays[kind][record.index].scriptPointerSource);gotoTab('hex');
        }));
        list.append(source);
      }
    }
  }
}
$('cube-map-warps').addEventListener('click',()=>safeRun(()=>{
  if(!cubeMapEvidence)throw Error('Inspect a CUBE custom map first');
  const options=cubeMapEvidence.options;
  const map=inspectHmaCubeMapEntry(ensureModel(),mapBankCustomSummary,options);
  if(JSON.stringify(map)!==JSON.stringify(cubeMapEvidence.report))
    throw Error('Selected CUBE map changed; inspect again');
  const report=inspectHmaCubeMapEventWarps(model,mapBankCustomSummary,options);
  cubeWarpEvidence={options,report};
  drawCubeMapEvidence();
}));

function drawCubeConnectionEvidence(){
  const status=$('cube-connections-status'),list=$('cube-connections-list');
  list.replaceChildren();
  const snapshot=cubeConnectionEvidence;
  if(!snapshot){
    status.textContent='No CUBE custom connections inspected. Select a map first.';
    return;
  }
  let fresh;
  try{
    if(!cubeMapEvidence||cubeMapEvidence.options!==snapshot.options)
      throw Error('Selected CUBE map changed');
    fresh=inspectHmaCubeMapConnections(ensureModel(),mapBankCustomSummary,snapshot.options);
    if(JSON.stringify(fresh)!==JSON.stringify(snapshot.report))
      throw Error('Connection records changed');
  }catch(_err){
    cubeConnectionEvidence=null;
    status.textContent='CUBE connections changed or expired. Inspect again before navigation.';
    return;
  }
  status.textContent=fresh.count+' raw CUBE connection(s). Direction, displacement and target IDs are unverified gameplay links.';
  if(fresh.connectionsOffset===null)return;
  for(const record of [{index:-1,offset:fresh.connectionsOffset},...fresh.connections]){
    const button=document.createElement('button');button.type='button';
    button.className='subtle-button';
    button.textContent=record.index<0?'Connection header · 0x'+hex(record.offset):
      '#'+record.index+' direction '+record.direction+' · displacement '+
      record.displacement+' → bank '+record.targetBank+', map '+record.targetMap+
      ' · source 0x'+hex(record.offset);
    button.addEventListener('click',()=>safeRun(()=>{
      if(cubeConnectionEvidence!==snapshot)throw Error('Connection inspection expired');
      const now=inspectHmaCubeMapConnections(ensureModel(),mapBankCustomSummary,snapshot.options);
      if(JSON.stringify(now)!==JSON.stringify(snapshot.report))
        throw Error('Connection record changed; inspect again');
      const target=record.index<0?now.connectionsOffset:now.connections[record.index].offset;
      setPageForOffset(target);gotoTab('hex');
    }));
    list.append(button);
  }
}
$('cube-map-connections').addEventListener('click',()=>safeRun(()=>{
  if(!cubeMapEvidence)throw Error('Inspect a CUBE custom map first');
  const options=cubeMapEvidence.options;
  const map=inspectHmaCubeMapEntry(ensureModel(),mapBankCustomSummary,options);
  if(JSON.stringify(map)!==JSON.stringify(cubeMapEvidence.report))
    throw Error('Selected CUBE map changed; inspect again');
  const report=inspectHmaCubeMapConnections(model,mapBankCustomSummary,options);
  cubeConnectionEvidence={options,report};
  drawCubeConnectionEvidence();
}));

function drawAnchors(){
  drawMetadataFingerprintStatus();
  drawMapBankMetadataReport();
  const root=$('anchor-list'),selector=$('anchor-group');root.replaceChildren();
  const previous=selector.value;
  selector.replaceChildren(new Option('All categories','all'));
  for(const [name,count] of groupAnchors(metadata))selector.add(new Option(`${name} (${count})`,name));
  selector.value=[...selector.options].some(x=>x.value===previous)?previous:'all';
  $('anchor-count').textContent=metadata.length?`${metadata.length} named anchors`:'No metadata';
  $('metadata-status').textContent=metadataSources.length?`Loaded: ${metadataSources.join(', ')}. ${metadataOffsetPointers.length} OffsetPointer declarations; ${metadataResolution?.anchoredCount||0} anchor-length tables; ${metadataResolution?.listCount||0} list-length tables; ${metadataResolution?.matchedCount||0} ROM-backed word-length tables; ${metadataWordConflicts.size} conflicting word names; ${metadataListConflicts.size} conflicting list names; ${metadataResolution?.offsetCollisionSources||0} unsafe OffsetPointer source claims; ${(metadataResolution?.overlapWitnesses||0)+(metadataResolution?.wordOverlapWitnesses||0)} overlap witnesses (not exhaustive); ${[...metadataResolution?.unresolved.values()||[]].filter(x=>x==='conflicting-duplicate-name').length} conflicting named anchors excluded. ROM metadata compatibility is not independently verified.`:'No metadata loaded. Import TOML produced for this ROM, or fetch a stock-game reference.';
  if(metadataSources.length&&metadataLayoutKind!=='unspecified')
    $('metadata-status').textContent+=' Imported TOML declares a '+metadataLayoutKind+' layout: vanilla stock overlays are refused. This does not authenticate the ROM.';
  if(!model){root.append(semanticChild('div','Open a ROM first.','empty-state'));drawAnchorDetails();return;}
  if(!metadata.length){root.append(semanticChild('div','Import a CUBHMA .toml file to begin.','empty-state'));drawAnchorDetails();return;}
  displayedAnchors=filterAnchors(metadata,$('anchor-find').value,selector.value,180);
  if(!displayedAnchors.length){root.append(semanticChild('div','No matching anchors.','empty-state'));drawAnchorDetails();return;}
  const frag=document.createDocumentFragment();
  for(const anchor of displayedAnchors){
    const b=document.createElement('button');b.type='button';b.className='anchor-entry';
    if(anchor===selectedAnchor)b.classList.add('active');
    b.append(semanticChild('strong',anchor.name));
    b.append(semanticChild('span',anchor.valid?`0x${hex(anchor.address)}`:`0x${hex(anchor.address)} · out of bounds`));
    b.onclick=()=>{selectedAnchor=anchor;drawAnchors();};frag.append(b);
  }
  root.append(frag);
  if(filterAnchors(metadata,$('anchor-find').value,selector.value,181).length>180)root.append(semanticChild('p','Showing first 180 matches. Narrow search to see other entries.','palette-note'));
  drawAnchorDetails();
}
$('anchor-find').addEventListener('input',drawAnchors);
$('anchor-group').addEventListener('change',drawAnchors);
$('anchor-to-hex').addEventListener('click',()=>safeRun(()=>{if(!selectedAnchor?.valid)throw Error('No valid offset selected');setPageForOffset(selectedAnchor.address);gotoTab('hex');}));
$('map-bank-target-scan').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  mapBankTargetEvidence=inspectHmaDeclaredBankTargetWindows(model,mapBankMetadataReport,{wordsPerTarget:4});
  drawMapBankTargetEvidence();
}));
$('map-bank-declared-scan').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  mapBankDeclaredEvidence=inspectHmaDeclaredBankPointerTable(model,mapBankMetadataReport);
  drawMapBankDeclaredEvidence();
}));
$('map-bank-raw-window-scan').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  mapBankRawWindowEvidence=inspectHmaMapBankRawWindow(model,mapBankMetadataReport,{words:16});
  drawMapBankRawWindowEvidence();
}));
$('map-bank-raw-inspect').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  mapBankRawPointerEvidence=inspectHmaMapBankRawPointer(model,mapBankMetadataReport);
  drawMapBankRawPointerEvidence();
}));
$('map-bank-raw-follow').addEventListener('click',()=>safeRun(()=>{
  if(!mapBankRawPointerEvidence)throw Error('Inspect the current raw anchor bytes first');
  const fresh=inspectHmaMapBankRawPointer(ensureModel(),mapBankMetadataReport);
  if(fresh.sourceOffset!==mapBankRawPointerEvidence.sourceOffset||
     fresh.rawWord!==mapBankRawPointerEvidence.rawWord||fresh.targetOffset===null)
    throw Error('Raw pointer changed or has no in-ROM target; inspect again');
  setPageForOffset(fresh.targetOffset);gotoTab('hex');
}));
$('map-bank-metadata-jump').addEventListener('click',()=>safeRun(()=>{
  const report=mapBankMetadataReport;
  if(!model||!report||!['custom-candidate','vanilla-marker'].includes(report.status)||
     report.uniqueDeclarationCount!==1||!report.declarations.length||
     !report.declarations.every(d=>d.addressInBounds===true))
    throw Error('No unambiguous in-bounds map-bank anchor');
  const address=report.declarations[0].address;
  if(address<0||address>model.length-4)throw Error('Map-bank offset no longer fits the ROM');
  setPageForOffset(address);gotoTab('hex');
}));
$('anchor-follow-pointer').addEventListener('click',()=>safeRun(()=>{if(selectedInspection?.pointer===null||!Number.isInteger(selectedInspection?.pointer))throw Error('Not a valid ROM pointer');setPageForOffset(selectedInspection.pointer);gotoTab('hex');}));
$('anchor-to-graphics').addEventListener('click',()=>safeRun(()=>{if(!selectedAnchor?.valid)throw Error('No selected graphic');chooseGraphic('lz',selectedAnchor.address);gotoTab('graphics');}));
$('pcs-reference-picker').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{
    ensureModel();
    if(file.size>1024*1024)throw Error('PCS reference must be at most 1 MiB');
    const parsed=parseHmaPcsReference(await file.text());
    // Atomic replacement: failed imports preserve the previous mapping.
    pcsReference=parsed;pcsReferenceName=file.name;
    $('pcs-reference-status').textContent='Unverified local PCS reference: '+pcsReferenceName+
      '. Game-specific text macros are read-only. This file does not authenticate ROM layout.';
    drawAnchorDetails();
    toast('Local PCS reference loaded for read-only preview');
  }catch(err){toast('PCS reference import failed: '+err.message,true);}
});
$('pcs-reference-clear').addEventListener('click',()=>{
  pcsReference=null;pcsReferenceName='';
  $('pcs-reference-status').textContent='No optional PCS reference loaded.';
  drawAnchorDetails();
});
// Each import is tied to one ROM byte snapshot and request generation.
// Replacing/editing the ROM or starting another import invalidates pending reads.
function metadataImportSnapshot(){
  const current=ensureModel();
  return {model:current,base:current.base,edits:new Map(current.edits)};
}
function assertMetadataImportCurrent(snapshot,serial){
  if(serial!==metadataImportSerial||
     !fingerprintMatchesRom(model,{snapshot}))
    throw Error('ROM changed or a newer metadata import started; import cancelled');
}
function decodeMetadataSource(name,bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>4*1024*1024)
    throw Error('Metadata file must contain 1 byte to 4 MiB');
  return {name,bytes,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
}
$('metadata-picker').addEventListener('change',async e=>{
  const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;
  try{
    const snapshot=metadataImportSnapshot(),serial=++metadataImportSerial,sources=[];
    // Refuse oversized selections before allocating any file buffers.
    if(files.length>16)throw Error('Too many metadata files (maximum 16)');
    let total=0;
    for(const file of files){
      if(!Number.isSafeInteger(file.size)||file.size<1||file.size>4*1024*1024)
        throw Error('Metadata file must contain 1 byte to 4 MiB');
      total+=file.size;
      if(total>16*1024*1024)throw Error('Metadata files exceed 16 MiB total');
    }
    for(const file of files){
      const bytes=new Uint8Array(await file.arrayBuffer());
      assertMetadataImportCurrent(snapshot,serial);
      sources.push(decodeMetadataSource(file.name,bytes));
    }
    assertMetadataImportCurrent(snapshot,serial);
    metadataCommit(sources);
  }catch(err){toast('Metadata import failed: '+err.message,true);}
});
const upstreamPin='3044393183e01af2ae1e907fb37e4a75eda6a8dc';
$('metadata-stock').addEventListener('click',async()=>{
  try{
    const snapshot=metadataImportSnapshot(),serial=++metadataImportSerial;
    // Select upstream metadata by exact game code AND revision, never by filename.
    const {identity,files:names}=resolveHmaStockMetadata(model);
    const code=identity.code;
    if(!await confirmAction('Load stock-game metadata?',`Reference offsets are for stock ${code} ROMs, not necessarily your modified ROM or CUBE. This lookup is read-only. Continue?`))return;
    assertMetadataImportCurrent(snapshot,serial);
    $('metadata-stock').disabled=true;
    const sources=[];
    for(const name of names){
      const url=`https://raw.githubusercontent.com/kcradi/CUBHMA/${upstreamPin}/src/HexManiac.Core/Models/Code/${name}`;
      const response=await fetch(url,{cache:'force-cache'});
      if(!response.ok)throw Error(`${name} download failed (HTTP ${response.status}). Import files manually if offline.`);
      const size=Number(response.headers.get('content-length'));
      if(size>4*1024*1024)throw Error('Upstream metadata exceeds 4 MiB limit');
      const bytes=new Uint8Array(await response.arrayBuffer());
      assertMetadataImportCurrent(snapshot,serial);
      sources.push(decodeMetadataSource(`${name} (upstream ${upstreamPin.slice(0,8)})`,bytes));
    }
    assertMetadataImportCurrent(snapshot,serial);
    metadataCommit(sources);
  }catch(err){toast('Stock metadata: '+err.message,true);}finally{$('metadata-stock').disabled=false;}
});


function clearRawBlockmapSummary(message='Raw blockmap statistics invalidated; scan again.'){
 $('map-summary-list').replaceChildren();
 $('map-summary-status').textContent=message;
 $('map-summary-next').disabled=true;
}
function clearRenderedMap(message='Rendered preview invalidated; inspect again.'){
 clearRawBlockmapSummary();
 activeRenderedMap=null;selectedRenderedHit=null;
 $('map-render-selection').textContent='Tap a rendered metatile to inspect its raw source offsets.';
 $('map-preview-status').textContent='Select an explicit vanilla header and coordinates to preview bytes. No writes.';
 $('map-render-jump').disabled=true;
 $('map-render-canvas').hidden=true;
 $('map-overlay-legend').replaceChildren();
 $('map-overlay-status').textContent='No raw attribute overlay. Enable rendered metatiles to inspect.';
 $('map-visual-compare').disabled=true;
 $('map-visual-compare-queue').disabled=true;
 for(const id of ['map-compare-before','map-compare-after'])$(id).hidden=true;
 $('map-compare-status').textContent='No proposed visual comparison. Preview a cell first.';
 $('map-render-status').textContent=message;
}
function clearMapGrid(message='Map structure changed; inspect again.'){
  lastMapPreviews.cell=null;$('map-review-cell-add').disabled=true;
  clearMapAtlas(message+' Reinspect declared bank counts.');
  clearRenderedMap();
  $('map-grid-legend').replaceChildren();
  $('map-grid-color-status').textContent='No raw cell colours inspected.';
  const root=$('map-grid');root.replaceChildren();
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent=message;root.append(empty);
  $('map-status').textContent=message;
  $('map-layout-status').textContent=message+' Vanilla layouts remain unverified.';
  $('map-bank-status').textContent=message+' Recheck bank pointer provenance.';
}
function clearWarpInspection(message='Select a vanilla map header to inspect warp events.'){
  clearEventInspection('Map or ROM changed; inspect vanilla event records again.');
  clearBlocksetInspection('Map or ROM changed; inspect blockset headers again.');
  inspectedWarpMap=null;selectedWarpPreview=null;lastMapPreviews.warp=null;
  $('map-review-warp-add').disabled=true;
  $('map-warp-preview').disabled=true;
  $('map-warp-preview-status').textContent='Select a raw warp record to preview proposed bytes. No writes.';
  $('map-warp-list').replaceChildren();
  $('map-warp-status').textContent=message;
}
function clearEventInspection(message='Select a vanilla map header to inspect object, script and signpost records.'){
  inspectedEventMap=null;selectedEventPreview=null;lastMapPreviews.event=null;
  $('map-review-event-add').disabled=true;
  $('map-event-preview').disabled=true;
  $('map-event-preview-status').textContent='Select a raw event record to preview proposed bytes. No writes.';
  $('map-event-list').replaceChildren();
  $('map-event-status').textContent=message;
  $('map-script-pointer-list').replaceChildren();
  $('map-script-pointer-status').textContent='No raw script pointer fields inspected.';
  $('map-script-preview-list').replaceChildren();
  $('map-script-preview-status').textContent='No raw script byte prefix inspected.';
}
function clearMapChangeReview(){
 mapReviewQueue=[];mapReviewRom=null;
 lastMapPreviews={cell:null,warp:null,event:null};
 $('map-visual-compare').disabled=true;
 $('map-visual-compare-queue').disabled=true;
 for(const id of ['map-compare-before','map-compare-after'])$(id).hidden=true;
 $('map-compare-status').textContent='Review queue cleared; preview a cell again.';
 for(const id of ['map-review-cell-add','map-review-warp-add','map-review-event-add',
  'map-review-run','map-review-clear','map-review-impact','map-review-roundtrip','map-review-route-delta','map-review-export'])$(id).disabled=true;
 $('map-review-list').replaceChildren();
 $('map-review-impact-list').replaceChildren();
 $('map-review-roundtrip-list').replaceChildren();
 $('map-review-route-delta-list').replaceChildren();
 $('map-review-route-delta-status').textContent='Queue or atlas changed; rerun raw route comparison.';
 $('map-review-roundtrip-status').textContent='Queue or atlas changed; rerun typed roundtrip.';
 $('map-review-impact-status').textContent='No structural impact audit run.';
 $('map-review-status').textContent='No proposed changes queued. No ROM writes.';
}
function removeQueuedMapPreview(index){
 if(mapReviewRom!==model||!Number.isSafeInteger(index)||
    index<0||index>=mapReviewQueue.length)
  throw Error('Queue changed; review proposals again');
 mapReviewQueue=mapReviewQueue.filter((_,i)=>i!==index);
 $('map-visual-compare-queue').disabled=!mapReviewQueue.some(p=>Number.isSafeInteger(p.byteOffset));
 if(!mapReviewQueue.length){clearMapChangeReview();return;}
 $('map-review-list').replaceChildren();
 $('map-review-impact-list').replaceChildren();
 $('map-review-roundtrip-list').replaceChildren();
 $('map-review-route-delta-list').replaceChildren();
 $('map-review-route-delta-status').textContent='Queue or atlas changed; rerun raw route comparison.';
 $('map-review-roundtrip-status').textContent='Queue or atlas changed; rerun typed roundtrip.';
 $('map-review-impact-status').textContent='Queue changed; rerun impact audit.';
 $('map-review-status').textContent=mapReviewQueue.length+
  ' proposed record(s) remain. Rerun review before relying on these previews; no writes.';
 $('map-review-impact').disabled=!inspectedMapAtlas||inspectedMapAtlas.rom!==model;
 $('map-review-roundtrip').disabled=$('map-review-impact').disabled;
 $('map-review-route-delta').disabled=!mapReviewQueue.length||mapReviewQueue.length>16||
  mapReviewQueue.some(p=>!Number.isSafeInteger(p.warpIndex))||
  !inspectedMapAtlas||inspectedMapAtlas.rom!==model;
}
function queueMapChangePreview(kind){
 ensureModel();
 const preview=lastMapPreviews[kind];
 if(!preview)throw Error('Preview the selected '+kind+' record before queueing');
 if(mapReviewRom&&mapReviewRom!==model)
  throw Error('ROM changed; clear the review queue');
 const next=[...mapReviewQueue,preview];
 reviewVanillaChangeSet(model,next,{maxChanges:64,maxBytes:2048});
 mapReviewQueue=next;mapReviewRom=model;
 $('map-visual-compare-queue').disabled=!next.some(p=>Number.isSafeInteger(p.byteOffset));
 $('map-review-run').disabled=false;$('map-review-clear').disabled=false;
 $('map-review-export').disabled=false;
 $('map-review-impact').disabled=!inspectedMapAtlas||inspectedMapAtlas.rom!==model;
 $('map-review-roundtrip').disabled=$('map-review-impact').disabled;
 $('map-review-route-delta').disabled=!mapReviewQueue.length||mapReviewQueue.length>16||
  mapReviewQueue.some(p=>!Number.isSafeInteger(p.warpIndex))||
  !inspectedMapAtlas||inspectedMapAtlas.rom!==model;
 $('map-review-impact-list').replaceChildren();
 $('map-review-roundtrip-list').replaceChildren();
 $('map-review-route-delta-list').replaceChildren();
 $('map-review-route-delta-status').textContent='Queue or atlas changed; rerun raw route comparison.';
 $('map-review-roundtrip-status').textContent='Queue or atlas changed; rerun typed roundtrip.';
 $('map-review-impact-status').textContent='Queue changed; rerun impact audit.';
 $('map-review-list').replaceChildren();
 $('map-review-status').textContent=next.length+
  ' proposed record(s) queued. Recheck originals and overlaps before relying on review; no writes.';
}
for(const kind of ['cell','warp','event'])
 $('map-review-'+kind+'-add').addEventListener('click',()=>safeRun(()=>queueMapChangePreview(kind)));
$('map-review-run').addEventListener('click',()=>safeRun(()=>{
 if(!mapReviewQueue.length||mapReviewRom!==model)
  throw Error('Review queue is empty or belongs to a different ROM');
 const result=reviewVanillaChangeSet(model,mapReviewQueue,{
  maxChanges:64,maxBytes:2048});
 const root=$('map-review-list');root.replaceChildren();
 $('map-review-status').textContent=result.count+' non-overlapping record(s), '+
  result.totalBytes+' original bytes checked, '+result.changedBytes+
  ' proposed byte differences. Preview only; NOT applied or authenticated.';
 for(const entry of result.entries){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=entry.kind+' ROM 0x'+hex(entry.offset)+
   ' · '+entry.length+' bytes · '+(entry.changed?'change':'unchanged')+
   (entry.fieldChanges.length?' · '+entry.fieldChanges.map(f=>
    f.field+': '+f.before+' → '+f.after).join('; '):'')+
   ' · inspect original hex';
  button.addEventListener('click',()=>safeRun(()=>{
   if(mapReviewRom!==model)throw Error('Review belongs to another ROM');
   const fresh=reviewVanillaChangeSet(model,mapReviewQueue,{
    maxChanges:64,maxBytes:2048});
   if(!fresh.entries.some(e=>e.sourceIndex===entry.sourceIndex&&
      e.offset===entry.offset&&e.length===entry.length))
    throw Error('Review changed; run again');
   setPageForOffset(entry.offset);gotoTab('hex');
  }));
  root.append(button);
  const remove=document.createElement('button');remove.type='button';
  remove.className='subtle-button';remove.style.display='block';
  remove.style.margin='0 0 12px';
  remove.textContent='Remove this proposal from queue';
  remove.addEventListener('click',()=>safeRun(()=>
   removeQueuedMapPreview(entry.sourceIndex)));
  root.append(remove);
 }
}));
$('map-review-export').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!mapReviewQueue.length||mapReviewRom!==model)
  throw Error('Review queue is empty or belongs to another ROM');
 const json=exportVanillaChangeReviewJson(model,mapReviewQueue);
 downloadFile(safeName(model.name)+'_map-review.json',json,'application/json');
 $('map-review-status').textContent='Review-only JSON field summary download started. '+
  'No raw ROM byte arrays, executable patch, authenticated layout or ROM writes.';
}));
$('map-review-impact').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!mapReviewQueue.length||mapReviewRom!==model||
    !inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Queue changes and inspect a vanilla atlas for this ROM first');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; inspect again before auditing');
 const result=auditVanillaChangeImpact(model,atlas,mapReviewQueue,{
  maxChanges:64,maxBytes:2048,maxOwners:12,maxConflicts:16});
 const root=$('map-review-impact-list');root.replaceChildren();
 $('map-review-impact-status').textContent=result.reviewed+' queued records across '+
  result.totalMaps+' declared maps: '+result.sharedRecords+' shared, '+
  result.conflictedRecords+' intersecting other structures. Read-only structural hints; NOT authenticated or applied.';
 for(const entry of result.entries){
  const item=document.createElement('button');item.type='button';
  item.className='secondary-button';item.style.display='block';
  item.style.margin='8px 0';item.style.textAlign='left';
  const refs=entry.owners.map(m=>'bank '+m.bankIndex+'/map '+m.mapIndex).join(', ');
  const conflicts=entry.conflicts.map(c=>c.kind+' at 0x'+hex(c.offset)).join(', ');
  item.textContent=entry.kind+' at 0x'+hex(entry.offset)+
   ' · '+entry.ownerCount+' map owner(s): '+refs+
   (entry.ownersTruncated?' (more omitted)':'')+
   (entry.conflictCount?' · WARNING: '+entry.conflictCount+
    ' structural intersection(s): '+conflicts+
    (entry.conflictsTruncated?' (more omitted)':''):'')+
   ' · inspect original hex';
  item.addEventListener('click',()=>safeRun(()=>{
   if(mapReviewRom!==model)throw Error('Review belongs to another ROM');
   auditVanillaChangeImpact(model,inspectedMapAtlas?.atlas,mapReviewQueue,{
    maxChanges:64,maxBytes:2048,maxOwners:12,maxConflicts:16});
   setPageForOffset(entry.offset);gotoTab('hex');
  }));
  root.append(item);
 }
}));
$('map-review-roundtrip').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!mapReviewQueue.length||mapReviewRom!==model||
    !inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Queue changes and inspect a vanilla atlas for this ROM first');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; inspect again before roundtrip audit');
 const result=auditVanillaQueuedChangeRoundtrip(model,atlas,mapReviewQueue,{
  maxChanges:64,maxBytes:2048,maxOwners:32});
 const root=$('map-review-roundtrip-list');root.replaceChildren();
 $('map-review-roundtrip-status').textContent=result.records+' proposed record(s), '+
  result.changedFields+' decoded field change(s), '+result.checkedOwners+
  ' declared map owner(s) checked. Typed overlay roundtrip passed; '+
  'NOT a ROM save/reopen, CUBE authentication or write permission.';
 for(const entry of result.entries){
  const item=document.createElement('button');item.type='button';
  item.className='secondary-button';item.style.display='block';
  item.style.margin='8px 0';item.style.textAlign='left';
  const fields=entry.fields.map(f=>f.field+': '+f.before+' → '+f.after).join(', ');
  const owners=entry.owners.map(o=>'bank '+o.bankIndex+'/map '+o.mapIndex+
   (o.coordinatesInMap?'':' (coordinates outside map)')+
   (o.warpArrivalStatus?' (warp: '+o.warpArrivalStatus+')':'')).join('; ');
  item.textContent=entry.kind+' at 0x'+hex(entry.offset)+' · '+fields+
   ' · '+owners+' · inspect original hex';
  item.addEventListener('click',()=>safeRun(()=>{
   if(mapReviewRom!==model||!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
    throw Error('Roundtrip review belongs to a different ROM or atlas');
   auditVanillaQueuedChangeRoundtrip(model,inspectedMapAtlas.atlas,mapReviewQueue,{
    maxChanges:64,maxBytes:2048,maxOwners:32});
   setPageForOffset(entry.offset);gotoTab('hex');
  }));
  root.append(item);
 }
}));
$('map-review-route-delta').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!mapReviewQueue.length||mapReviewQueue.length>16||
    mapReviewQueue.some(p=>!Number.isSafeInteger(p.warpIndex))||
    mapReviewRom!==model||!inspectedMapAtlas||
    inspectedMapAtlas.rom!==model)
  throw Error('Queue 1–16 vanilla warp previews and inspect the current atlas first');
 const atlas=inspectedMapAtlas.atlas;
 const sourceIndex=Number($('map-atlas-select').value);
 const targetIndex=Number($('map-atlas-route-target').value);
 if(!Number.isSafeInteger(sourceIndex)||!Number.isSafeInteger(targetIndex)||
    sourceIndex<0||targetIndex<0||
    sourceIndex>=atlas.maps.length||targetIndex>=atlas.maps.length)
  throw Error('Select a declared route origin and destination');
 const origin=atlas.maps[sourceIndex],target=atlas.maps[targetIndex];
 const queueSnapshot=[...mapReviewQueue];
 const opts={originBank:origin.bankIndex,originMap:origin.mapIndex,
  targetBank:target.bankIndex,targetMap:target.mapIndex,
  maxMaps:128,maxLinks:8192,maxHops:128,maxChanges:16};
 function inputsUnchanged(){
  const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&mapReviewRom===model&&
   mapReviewQueue.length===queueSnapshot.length&&
   queueSnapshot.every((p,i)=>p===mapReviewQueue[i])&&
   Number($('map-atlas-select').value)===sourceIndex&&
   Number($('map-atlas-route-target').value)===targetIndex&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   counts.length===atlas.bankCount&&
   counts.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged())throw Error('Queue or atlas inputs changed; reinspect first');
 const result=compareVanillaReviewedRawRoute(model,atlas,queueSnapshot,opts);
 const root=$('map-review-route-delta-list');root.replaceChildren();
 const describe=r=>r.status==='raw-reachable'?r.hops+' raw hop(s)':'no resolved raw path';
 $('map-review-route-delta-status').textContent=
  'Original: '+describe(result.before)+'; proposed: '+describe(result.after)+
  '. '+(result.routeChanged?'Shortest raw route changes.':'Raw route unchanged.')+
  ' '+result.reviewedWarps+' typed warp preview(s), '+result.checkedOwners+
  ' owner(s) checked. NO ROM write, CUBE authentication or gameplay travel verification.';
 function freshResult(){
  requireVanillaMapFormat();
  if(!inputsUnchanged())throw Error('Queue or atlas selection changed; rerun comparison');
  const fresh=compareVanillaReviewedRawRoute(model,atlas,queueSnapshot,opts);
  if(fresh.routeChanged!==result.routeChanged||
     JSON.stringify(fresh.before.steps)!==JSON.stringify(result.before.steps)||
     JSON.stringify(fresh.after.steps)!==JSON.stringify(result.after.steps))
   throw Error('Raw route preview changed; rerun comparison');
  return fresh;
 }
 for(const [label,route] of [['Original',result.before],['Proposed',result.after]]){
  for(const [i,step] of route.steps.entries()){
   const button=document.createElement('button');
   button.type='button';button.className='secondary-button';
   button.style.display='block';button.style.margin='8px 0';
   button.style.textAlign='left';
   button.textContent=label+' step '+(i+1)+': '+step.source+' → '+
    step.target+' · '+step.kind+' '+step.index+
    ' · inspect original ROM 0x'+hex(step.sourceOffset);
   button.addEventListener('click',()=>safeRun(()=>{
    freshResult();setPageForOffset(step.sourceOffset);gotoTab('hex');
   }));
   root.append(button);
  }
 }
 if(!result.before.steps.length&&!result.after.steps.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No raw route hops to display for either state.';
  root.append(empty);
 }
}));

$('map-review-clear').addEventListener('click',()=>clearMapChangeReview());

function clearBlocksetInspection(message='Select a vanilla map header to inspect tileset pointers.'){
  $('map-blockset-list').replaceChildren();
  $('map-blockset-status').textContent=message;
}
function clearConnectionInspection(message='Select a vanilla map header to inspect connections.'){
  $('map-connection-list').replaceChildren();
  $('map-connection-status').textContent=message;
}
function requireVanillaMapFormat(){
  ensureModel();
  if(metadataLayoutKind==='expansion'||metadataLayoutKind==='custom')
    throw Error('Imported metadata declares a non-vanilla layout; vanilla map interpretation refused.');
}
function clearMapAtlas(message='Declared atlas invalidated; inspect again.') {
 inspectedMapAtlas=null;atlasBatchStart=0;atlasCoordinateBatchStart=0;atlasScriptAliasStart=0;atlasScriptCrossPageStart=0;atlasIncomingStart=0;atlasIncomingTarget=null;
 $('map-review-impact').disabled=true;
 $('map-review-roundtrip').disabled=true;
 $('map-review-route-delta').disabled=true;
 $('map-review-route-delta-list').replaceChildren();
 $('map-review-route-delta-status').textContent='No reviewed warp route comparison.';
 $('map-review-roundtrip-list').replaceChildren();
 $('map-review-route-delta-list').replaceChildren();
 $('map-review-route-delta-status').textContent='Queue or atlas changed; rerun raw route comparison.';
 $('map-review-roundtrip-status').textContent='Declared atlas invalidated; inspect again.';
 $('map-review-impact-list').replaceChildren();
 $('map-review-roundtrip-list').replaceChildren();
 $('map-review-route-delta-list').replaceChildren();
 $('map-review-route-delta-status').textContent='Queue or atlas changed; rerun raw route comparison.';
 $('map-review-roundtrip-status').textContent='Queue or atlas changed; rerun typed roundtrip.';
 $('map-review-impact-status').textContent='Declared atlas invalidated; inspect again.';
 $('map-atlas-batch-audit').disabled=true;
 $('map-atlas-alias-audit').disabled=true;
 $('map-atlas-raw-census').disabled=true;
 $('map-atlas-graph').disabled=true;
 $('map-atlas-route').disabled=true;
 $('map-atlas-route-target').disabled=true;
 $('map-atlas-route-target').replaceChildren(new Option('Inspect an atlas first',''));
 $('map-atlas-route-list').replaceChildren();
 $('map-atlas-route-status').textContent='No raw map route inspected.';
 $('map-atlas-graph-list').replaceChildren();
 $('map-atlas-graph-status').textContent='No declared raw map network reviewed.';
 $('map-atlas-raw-census-list').replaceChildren();
 $('map-atlas-raw-census-status').textContent='No raw-cell census run.';
 $('map-event-ownership-audit').disabled=true;
 $('map-script-alias-audit').disabled=true;
 $('map-script-alias-list').replaceChildren();
 $('map-script-alias-status').textContent='No shared script-target page reviewed.';
 $('map-script-crosspage-audit').disabled=true;
 $('map-script-crosspage-list').replaceChildren();
 $('map-script-crosspage-status').textContent='No cross-page script target review run.';
 $('map-script-atlas-audit').disabled=true;
 $('map-script-atlas-list').replaceChildren();
 $('map-script-atlas-status').textContent='No full-atlas script target review run.';
 $('map-script-operand-atlas-audit').disabled=true;
 $('map-script-operand-atlas-list').replaceChildren();
 $('map-script-operand-atlas-status').textContent='No script operand alias review run.';
 $('map-event-ownership-list').replaceChildren();
 $('map-event-ownership-status').textContent='No event ownership review run.';
 $('map-atlas-alias-list').replaceChildren();
 $('map-atlas-alias-status').textContent='No shared pointer aliases reviewed.';
 $('map-coordinate-batch-audit').disabled=true;
 $('map-coordinate-batch-list').replaceChildren();
 $('map-coordinate-batch-status').textContent='No atlas-wide coordinate batch inspected.';
 $('map-atlas-batch-list').replaceChildren();
 $('map-atlas-batch-status').textContent='No atlas-wide link batch inspected.';
 $('map-atlas-probe-list').replaceChildren();
 $('map-atlas-probe-status').textContent='No vanilla bank-table candidates inspected.';
 const select=$('map-atlas-select');
 select.replaceChildren(new Option('Inspect an atlas first',''));
 select.disabled=true;
 $('map-atlas-open').disabled=true;
 $('map-atlas-audit').disabled=true;
 $('map-atlas-incoming').disabled=true;
 $('map-warp-return-audit').disabled=true;
 $('map-warp-return-list').replaceChildren();
 $('map-warp-return-status').textContent='No raw warp return-path review run.';
 $('map-atlas-incoming-list').replaceChildren();
 $('map-atlas-incoming-status').textContent='No incoming link page inspected.';
 $('map-event-coordinate-audit').disabled=true;
 $('map-event-coordinate-list').replaceChildren();
 $('map-event-coordinate-status').textContent='No event coordinate audit run.';
 $('map-atlas-audit-list').replaceChildren();
 $('map-atlas-audit-status').textContent='No declared map links audited.';
 $('map-atlas-status').textContent=message;
}
function openDeclaredAtlasMap(target) {
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas for the current ROM');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before navigation');
 const entry=lookupVanillaMapAtlasTarget(atlas,target.bankIndex,target.mapIndex);
 if(!entry||entry.mapHeaderOffset!==target.mapHeaderOffset)
  throw Error('Target not in the declared atlas');
 $('map-bank-count').value=String(atlas.bankCount);
 $('map-bank-index').value=String(entry.bankIndex);
 $('map-bank-map-count').value=String(atlas.bankMapCounts[entry.bankIndex]);
 $('map-bank-map-index').value=String(entry.mapIndex);
 $('map-bank-inspect').click();
}

$('map-atlas-probe').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 const original=model;
 const family=$('map-layout-family').value;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 const start=parseOffset($('map-atlas-probe-start').value);
 const bytes=Number($('map-atlas-probe-bytes').value);
 const result=probeVanillaMapBankTables(model,{
  start,bytes,bankMapCounts:counts,family
 });
 const root=$('map-atlas-probe-list');root.replaceChildren();
 $('map-atlas-probe-status').textContent='Checked '+result.checkedOffsets+
  ' aligned locations; '+result.matches+' structural candidate(s)'+
  (result.truncated?' (first 16 shown)':'')+
  '. These are NOT authenticated CUBE/vanilla layouts.';
 for(const candidate of result.candidates){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Use candidate 0x'+hex(candidate.address)+
   ' · '+candidate.checkedMaps+' explicitly counted maps';
  button.addEventListener('click',()=>safeRun(()=>{
   if(model!==original)throw Error('ROM replaced; probe candidate expired');
   if($('map-layout-family').value!==family||
      (()=>{const current=parseVanillaBankMapCounts($('map-atlas-counts').value);
       return current.length!==counts.length||current.some((n,i)=>n!==counts[i]);})())
    throw Error('Declared probe inputs changed; scan again');
   $('map-bank-offset').value=hex(candidate.address);
   $('map-atlas-inspect').click();
  }));
  root.append(button);
 }
 if(!result.candidates.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No candidates in this bounded window; widen or move the window only with independent format evidence.';
  root.append(empty);
 }
}));
$('map-atlas-inspect').addEventListener('click',()=>safeRun(()=>{
 clearMapAtlas('Inspecting declared vanilla map pointers…');
 requireVanillaMapFormat();
 const atlas=inspectVanillaMapAtlas(model,{
  address:parseOffset($('map-bank-offset').value),
  bankMapCounts:parseVanillaBankMapCounts($('map-atlas-counts').value),
  family:$('map-layout-family').value
 });
 inspectedMapAtlas={atlas,rom:model};
 $('map-review-impact').disabled=!mapReviewQueue.length||mapReviewRom!==model;
 $('map-review-roundtrip').disabled=$('map-review-impact').disabled;
 $('map-review-route-delta').disabled=!mapReviewQueue.length||mapReviewQueue.length>16||
  mapReviewQueue.some(p=>!Number.isSafeInteger(p.warpIndex))||
  !inspectedMapAtlas||inspectedMapAtlas.rom!==model;
 const select=$('map-atlas-select'),options=document.createDocumentFragment();
 for(let i=0;i<atlas.maps.length;i++){
  const entry=atlas.maps[i];
  options.append(new Option('Bank '+entry.bankIndex+' / map '+entry.mapIndex+
   ' · '+entry.width+'×'+entry.height+' · header 0x'+hex(entry.mapHeaderOffset),String(i)));
 }
 select.replaceChildren(options);select.disabled=false;
 $('map-atlas-open').disabled=false;
 $('map-atlas-audit').disabled=false;
 $('map-atlas-incoming').disabled=false;
 $('map-warp-return-audit').disabled=false;
 $('map-event-coordinate-audit').disabled=false;
 $('map-atlas-batch-audit').disabled=false;
 $('map-atlas-alias-audit').disabled=false;
 $('map-atlas-raw-census').disabled=false;
 $('map-atlas-graph').disabled=false;
 $('map-atlas-route').disabled=false;
 const routeTarget=$('map-atlas-route-target');
 routeTarget.replaceChildren(...Array.from(select.options,o=>new Option(o.textContent,o.value)));
 routeTarget.disabled=false;
 $('map-event-ownership-audit').disabled=false;
 $('map-script-alias-audit').disabled=false;
 atlasScriptAliasStart=0;
 $('map-script-crosspage-audit').disabled=false;
 $('map-script-atlas-audit').disabled=false;
 $('map-script-operand-atlas-audit').disabled=false;
 atlasScriptCrossPageStart=0;
 $('map-coordinate-batch-audit').disabled=false;
 $('map-atlas-status').textContent='Inspected '+atlas.mapCount+' explicitly declared maps across '+
  atlas.bankCount+' vanilla-format banks. Pointer/layout bounds checked; no ROM identity, CUBE layout or warp topology authenticated.';
}));
$('map-atlas-select').addEventListener('change',()=>{
 atlasIncomingStart=0;atlasIncomingTarget=null;
 $('map-atlas-incoming').disabled=!inspectedMapAtlas;
 $('map-warp-return-audit').disabled=!inspectedMapAtlas;
 $('map-warp-return-list').replaceChildren();
 $('map-warp-return-status').textContent='Selection changed; review return paths for the selected map.';
 $('map-atlas-incoming-list').replaceChildren();
 $('map-atlas-incoming-status').textContent='Selection changed; scan from the first declared map.';
});
$('map-atlas-open').addEventListener('click',()=>safeRun(()=>{
 if(!inspectedMapAtlas)throw Error('Inspect an atlas first');
 const i=Number($('map-atlas-select').value);
 if(!Number.isSafeInteger(i)||i<0||i>=inspectedMapAtlas.atlas.maps.length)
  throw Error('Select a declared map');
 openDeclaredAtlasMap(inspectedMapAtlas.atlas.maps[i]);
}));
$('map-atlas-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before auditing links');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before auditing');
 const i=Number($('map-atlas-select').value);
 if(!Number.isSafeInteger(i)||i<0||i>=atlas.maps.length)
  throw Error('Select a declared map first');
 const entry=atlas.maps[i];
 $('map-atlas-audit-list').replaceChildren();
 $('map-atlas-audit-status').textContent='Auditing raw vanilla links…';
 const result=auditVanillaMapLinks(model,atlas,{bankIndex:entry.bankIndex,mapIndex:entry.mapIndex});
 const root=$('map-atlas-audit-list');
 $('map-atlas-audit-status').textContent='Bank '+entry.bankIndex+' / map '+entry.mapIndex+
  ': '+result.counts.declared+' declared, '+result.counts.undeclared+
  ' outside supplied counts, '+result.counts.special+' special, '+
  result.counts.needsReview+' raw index warnings. Read-only; topology and CUBE compatibility unverified.';
 if(!result.records.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No raw warp or connection records.';root.append(empty);
 }
 for(const record of result.records){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=record.kind+' '+record.index+' → '+record.targetBank+'/'+
   record.targetMap+(record.targetWarpId===null?'':' warp '+record.targetWarpId)+
   ' · '+record.status+' · '+record.detail+' · ROM 0x'+hex(record.offset);
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model)throw Error('Atlas expired; reinspect');
   setPageForOffset(record.offset);gotoTab('hex');
  }));
  root.append(button);
  if(record.targetHeaderOffset!==null){
   const target=lookupVanillaMapAtlasTarget(atlas,record.targetBank,record.targetMap);
   const open=document.createElement('button');open.type='button';
   open.className='secondary-button';open.style.margin='0 0 8px 8px';
   open.textContent='Open declared destination '+record.targetBank+'/'+record.targetMap;
   open.addEventListener('click',()=>safeRun(()=>openDeclaredAtlasMap(target)));
   root.append(open);
  }
 }
}));


$('map-atlas-incoming').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before scanning incoming links');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before incoming link scan');
 const i=Number($('map-atlas-select').value);
 if(!Number.isSafeInteger(i)||i<0||i>=atlas.maps.length)
  throw Error('Select a declared destination map');
 const target=atlas.maps[i],key=target.bankIndex+'/'+target.mapIndex;
 if(atlasIncomingTarget!==key){atlasIncomingStart=0;atlasIncomingTarget=key;}
 const result=auditVanillaAtlasIncomingLinks(model,atlas,{
  bankIndex:target.bankIndex,mapIndex:target.mapIndex,
  start:atlasIncomingStart,limit:16,maxResults:128
 });
 const root=$('map-atlas-incoming-list');root.replaceChildren();
 $('map-atlas-incoming-status').textContent='Incoming to '+key+
  ': scanned declared maps '+result.start+'–'+(result.end-1)+
  ' of '+result.totalMaps+'. '+result.counts.warps+' raw warps, '+
  result.counts.connections+' connections, '+result.counts.invalidIndex+
  ' invalid warp indexes, '+result.counts.specialIndex+
  ' special warp indexes. '+result.totalResults+' matches'+
  (result.truncated?' (first 128 shown)':'')+
  '. This is a page, not a complete inbound index; CUBE/runtime behavior unverified.'+
  (result.nextStart===null?' All declared pages scanned.':' Continue for next 16 maps.');
 for(const record of result.records){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='From '+record.sourceBank+'/'+record.sourceMap+
   ' · '+record.kind+' '+record.index+
   (record.targetWarpId===null?'':' → warp '+record.targetWarpId)+
   ' · '+record.status+' · ROM 0x'+hex(record.recordOffset);
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model||inspectedMapAtlas.atlas!==atlas)
    throw Error('Atlas expired; reinspect');
   setPageForOffset(record.recordOffset);gotoTab('hex');
  }));
  root.append(button);
  const source=lookupVanillaMapAtlasTarget(atlas,record.sourceBank,record.sourceMap);
  if(source&&source.mapHeaderOffset===record.sourceHeaderOffset){
   const open=document.createElement('button');open.type='button';
   open.className='secondary-button';open.style.margin='0 0 8px 8px';
   open.textContent='Open source map '+record.sourceBank+'/'+record.sourceMap;
   open.addEventListener('click',()=>safeRun(()=>openDeclaredAtlasMap(source)));
   root.append(open);
  }
 }
 if(!result.records.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No incoming raw links found on this page.';
  root.append(empty);
 }
 atlasIncomingStart=result.nextStart??0;
 $('map-atlas-incoming').disabled=result.nextStart===null;
}));

$('map-warp-return-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before reviewing return paths');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before return-path review');
 const i=Number($('map-atlas-select').value);
 if(!Number.isSafeInteger(i)||i<0||i>=atlas.maps.length)
  throw Error('Select a declared map first');
 const entry=atlas.maps[i];
 const result=auditVanillaWarpReturns(model,atlas,{
  bankIndex:entry.bankIndex,mapIndex:entry.mapIndex,maxResults:128
 });
 const root=$('map-warp-return-list');root.replaceChildren();
 $('map-warp-return-status').textContent='Map '+entry.bankIndex+'/'+entry.mapIndex+
  ': '+result.totalWarps+' raw source warps, '+result.counts.reciprocal+
  ' reciprocal records, '+result.counts.differentWarp+' different return indexes, '+
  result.counts.differentMap+' different return maps, '+result.counts.specialReturn+
  ' special returns, '+result.counts.unresolved+' unresolved arrivals'+
  (result.truncated?' (first 128 shown)':'')+
  '. Non-reciprocal links may be intentional. Runtime behavior and CUBE layout unverified.';
 for(const record of result.records){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Warp '+record.sourceWarpIndex+' → '+
   record.targetBank+'/'+record.targetMap+' warp '+record.targetWarpId+
   ' · '+record.status+' ('+record.traceStatus+')'+
   ' · ROM 0x'+hex(record.sourceRecordOffset);
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model||inspectedMapAtlas.atlas!==atlas)
    throw Error('Atlas expired; reinspect');
   setPageForOffset(record.sourceRecordOffset);gotoTab('hex');
  }));
  root.append(button);
  if(record.returnTarget){
   const back=document.createElement('button');back.type='button';
   back.className='secondary-button';back.style.margin='0 0 8px 8px';
   back.textContent='Inspect arrival warp at 0x'+hex(record.returnTarget.recordOffset);
   back.addEventListener('click',()=>safeRun(()=>{
    if(inspectedMapAtlas?.rom!==model||inspectedMapAtlas.atlas!==atlas)
     throw Error('Atlas expired; reinspect');
    setPageForOffset(record.returnTarget.recordOffset);gotoTab('hex');
   }));
   root.append(back);
  }
 }
 if(!result.records.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No raw warp records in this declared map.';
  root.append(empty);
 }
}));

$('map-event-coordinate-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before auditing event coordinates');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before coordinate auditing');
 const i=Number($('map-atlas-select').value);
 if(!Number.isSafeInteger(i)||i<0||i>=atlas.maps.length)
  throw Error('Select a declared map first');
 const entry=atlas.maps[i];
 const result=auditVanillaMapEventCoordinates(model,atlas,{
  bankIndex:entry.bankIndex,mapIndex:entry.mapIndex,maxFindings:128
 });
 const root=$('map-event-coordinate-list');root.replaceChildren();
 $('map-event-coordinate-status').textContent='Map '+entry.bankIndex+'/'+entry.mapIndex+
  ' ('+result.width+'×'+result.height+'): '+result.counts.total+
  ' raw events, '+result.counts.outsideMap+' outside the blockmap, '+
  result.counts.sharedCell+' sharing in-map coordinates. '+
  result.totalFindings+' review hints'+(result.truncated?' (first 128 shown)':'')+
  '. Shared tiles can be intentional; collision bits are raw, not walkability. Read only; CUBE layout unverified.';
 for(const finding of result.findings){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=finding.kind+' '+finding.index+' at ('+finding.x+','+
   finding.y+') · '+finding.status+' · ROM 0x'+hex(finding.offset)+
   (finding.cellOffset===null?'':' · block cell 0x'+hex(finding.cellOffset)+
   ' tile '+finding.rawTileId+' raw high bits '+finding.rawCollision);
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model)throw Error('Atlas expired; reinspect');
   setPageForOffset(finding.offset);gotoTab('hex');
  }));
  root.append(button);
 }
 if(!result.findings.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='All raw event coordinates lie within the declared blockmap, with no shared in-map cells.';
  root.append(empty);
 }
}));

$('map-atlas-batch-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before batch auditing');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before batch auditing');
 const result=auditVanillaAtlasLinkBatch(model,atlas,{
  start:atlasBatchStart,limit:16,maxFindings:128
 });
 const root=$('map-atlas-batch-list');root.replaceChildren();
 $('map-atlas-batch-status').textContent='Scanned maps '+result.start+'–'+(result.end-1)+
  ' of '+result.totalMaps+': '+result.counts.declared+' declared, '+
  result.counts.undeclared+' undeclared, '+result.counts.special+
  ' special, '+result.counts.needsReview+' index warnings. '+
  result.totalFindings+' findings'+(result.truncated?' (first 128 shown)':'')+
  '. Read-only, vanilla format unverified.'+
  (result.nextStart===null?' Catalog scan finished.':' Continue for next 16.');
 for(const finding of result.findings){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Map '+finding.bankIndex+'/'+finding.mapIndex+
   ' · '+finding.kind+' '+finding.index+' → '+finding.targetBank+'/'+
   finding.targetMap+' · '+finding.status+' · ROM 0x'+hex(finding.offset);
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model)throw Error('Atlas expired; reinspect');
   setPageForOffset(finding.offset);gotoTab('hex');
  }));
  root.append(button);
 }
 if(!result.findings.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No non-declared link statuses in this batch.';
  root.append(empty);
 }
 atlasBatchStart=result.nextStart??0;
 $('map-atlas-batch-audit').disabled=result.nextStart===null;
}));

$('map-coordinate-batch-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before reviewing coordinate batches');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before coordinate batch review');
 const result=auditVanillaAtlasEventCoordinateBatch(model,atlas,{
  start:atlasCoordinateBatchStart,limit:16,maxFindings:128
 });
 const root=$('map-coordinate-batch-list');root.replaceChildren();
 $('map-coordinate-batch-status').textContent='Scanned maps '+result.start+
  '–'+(result.end-1)+' of '+result.totalMaps+': '+result.counts.total+
  ' raw events, '+result.counts.outsideMap+' outside map bounds, '+
  result.counts.sharedCell+' shared-cell records. '+result.totalFindings+
  ' review hints'+(result.truncated?' (first 128 shown)':'')+
  '. Shared cells may be intentional; read only, vanilla/CUBE layout unverified.'+
  (result.nextStart===null?' Catalog review finished.':' Continue for next 16.');
 for(const finding of result.findings){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Map '+finding.bankIndex+'/'+finding.mapIndex+
   ' · '+finding.kind+' '+finding.index+' ('+finding.x+','+finding.y+
   ') · '+finding.status+' · ROM 0x'+hex(finding.offset);
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model)throw Error('Atlas expired; reinspect');
   setPageForOffset(finding.offset);gotoTab('hex');
  }));
  root.append(button);
 }
 if(!result.findings.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No out-of-map or shared-cell coordinate findings in this batch.';
  root.append(empty);
 }
 atlasCoordinateBatchStart=result.nextStart??0;
 $('map-coordinate-batch-audit').disabled=result.nextStart===null;
}));



$('map-atlas-graph').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Inspect a declared vanilla atlas before network review');
 const atlas=inspectedMapAtlas.atlas;
 function inputsUnchanged(){
  const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   counts.length===atlas.bankCount&&
   counts.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged())throw Error('Atlas inputs changed; reinspect before network review');
 const selected=Number($('map-atlas-select').value);
 if(!Number.isSafeInteger(selected)||selected<0||selected>=atlas.maps.length)
  throw Error('Select a declared origin map first');
 const origin=atlas.maps[selected];
 const opts={originBank:origin.bankIndex,originMap:origin.mapIndex,
  maxMaps:128,maxLinks:8192,maxRows:32,maxFindings:48};
 const result=auditVanillaAtlasWarpGraph(model,atlas,opts);
 const root=$('map-atlas-graph-list');root.replaceChildren();
 $('map-atlas-graph-status').textContent=
  'From bank '+origin.bankIndex+' / map '+origin.mapIndex+': '+
  result.reachableByRawLinks+'/'+result.mapsInspected+
  ' declared maps reached by raw directed links; '+
  result.counts.resolved+' resolved references, '+
  result.counts.invalidWarp+' invalid raw warp indexes, '+
  result.counts.undeclared+' undeclared targets, '+
  result.counts.special+' special references and '+
  result.counts.oneWayPairs+' pairs without a direct reverse reference. '+
  (result.rowsTruncated?'First 32 map summaries shown. ':'')+
  (result.findingsTruncated?'First 48 findings shown. ':'')+
  'Raw graph only: NOT verified gameplay travel, walkability or CUBE compatibility.';
 for(const row of result.rows){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Bank '+row.bankIndex+' / map '+row.mapIndex+
   ' · '+row.incoming+' inbound / '+row.outgoing+' outbound'+
   ' · '+(row.reachableByRawLinks?'raw-link reached':'not reached by raw links')+
   ' · open declared map';
  button.addEventListener('click',()=>safeRun(()=>{
   requireVanillaMapFormat();
   if(!inputsUnchanged())throw Error('Atlas inputs changed; reinspect');
   const fresh=auditVanillaAtlasWarpGraph(model,atlas,opts);
   const match=fresh.rows.find(x=>x.bankIndex===row.bankIndex&&
    x.mapIndex===row.mapIndex&&x.headerOffset===row.headerOffset&&
    x.incoming===row.incoming&&x.outgoing===row.outgoing&&
    x.reachableByRawLinks===row.reachableByRawLinks);
   if(!match)throw Error('Raw map network changed; rescan first');
   openDeclaredAtlasMap(atlas.maps.find(m=>m.bankIndex===match.bankIndex&&m.mapIndex===match.mapIndex));
  }));
  root.append(button);
 }
 for(const finding of result.findings){
  const line=document.createElement('button');line.type='button';
  line.className='secondary-button';line.style.display='block';
  line.style.margin='8px 0';line.style.textAlign='left';
  line.textContent='Raw reference '+finding.source+' → '+
   (finding.targetId??finding.target)+': '+finding.status+
   (Number.isSafeInteger(finding.offset)?' · inspect ROM bytes':' · structural hint');
  if(!Number.isSafeInteger(finding.offset))line.disabled=true;
  else line.addEventListener('click',()=>safeRun(()=>{
   requireVanillaMapFormat();
   if(!inputsUnchanged())throw Error('Atlas inputs changed; rescan first');
   const fresh=auditVanillaAtlasWarpGraph(model,atlas,opts);
   const match=fresh.findings.find(x=>x.source===finding.source&&
    x.kind===finding.kind&&x.index===finding.index&&
    x.offset===finding.offset&&x.status===finding.status&&
    x.targetId===finding.targetId);
   if(!match)throw Error('Raw link changed; rescan first');
   setPageForOffset(match.offset);gotoTab('hex');
  }));
  root.append(line);
 }
}));

$('map-atlas-route').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Inspect a declared vanilla atlas before raw route inspection');
 const atlas=inspectedMapAtlas.atlas;
 function inputsUnchanged(){
  const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   counts.length===atlas.bankCount&&
   counts.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged())throw Error('Atlas inputs changed; reinspect first');
 const sourceIndex=Number($('map-atlas-select').value);
 const targetIndex=Number($('map-atlas-route-target').value);
 if(!Number.isSafeInteger(sourceIndex)||!Number.isSafeInteger(targetIndex)||
    sourceIndex<0||targetIndex<0||
    sourceIndex>=atlas.maps.length||targetIndex>=atlas.maps.length)
  throw Error('Select a declared origin and destination');
 const origin=atlas.maps[sourceIndex],target=atlas.maps[targetIndex];
 const opts={originBank:origin.bankIndex,originMap:origin.mapIndex,
  targetBank:target.bankIndex,targetMap:target.mapIndex,
  maxMaps:128,maxLinks:8192,maxHops:128};
 const result=inspectVanillaAtlasRawRoute(model,atlas,opts);
 const root=$('map-atlas-route-list');root.replaceChildren();
 $('map-atlas-route-status').textContent=
  'Raw '+origin.bankIndex+'/'+origin.mapIndex+' → '+
  target.bankIndex+'/'+target.mapIndex+': '+
  (result.status==='raw-reachable'?result.hops+' link(s) in the shortest raw path':
   'no directed path through structurally resolved raw links')+
  '. '+result.eligibleLinks+' structurally resolved of '+
  result.linksInspected+' raw links. NOT verified gameplay travel or CUBE compatibility.';
 function freshRoute(){
  requireVanillaMapFormat();
  if(!inputsUnchanged()||
     Number($('map-atlas-select').value)!==sourceIndex||
     Number($('map-atlas-route-target').value)!==targetIndex)
   throw Error('Route selection or atlas changed; rescan first');
  const fresh=inspectVanillaAtlasRawRoute(model,atlas,opts);
  if(fresh.status!==result.status||
     JSON.stringify(fresh.steps)!==JSON.stringify(result.steps))
   throw Error('Raw route changed; rescan before navigation');
  return fresh;
 }
 for(const [i,step] of result.steps.entries()){
  const sourceButton=document.createElement('button');
  sourceButton.type='button';sourceButton.className='secondary-button';
  sourceButton.style.display='block';sourceButton.style.margin='8px 0';
  sourceButton.style.textAlign='left';
  sourceButton.textContent='Step '+(i+1)+': '+step.source+' → '+
   step.target+' via '+step.kind+' '+step.index+
   ' · inspect ROM 0x'+hex(step.sourceOffset);
  sourceButton.addEventListener('click',()=>safeRun(()=>{
   freshRoute();setPageForOffset(step.sourceOffset);gotoTab('hex');
  }));
  root.append(sourceButton);
  const targetButton=document.createElement('button');
  targetButton.type='button';targetButton.className='secondary-button';
  targetButton.style.margin='0 0 8px 8px';
  targetButton.textContent='Open declared destination '+step.target;
  targetButton.addEventListener('click',()=>safeRun(()=>{
   freshRoute();
   const destination=atlas.maps.find(m=>
    m.bankIndex+','+m.mapIndex===step.target);
   if(!destination)throw Error('Declared destination changed');
   openDeclaredAtlasMap(destination);
  }));
  root.append(targetButton);
 }
 if(!result.steps.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent=result.status==='raw-reachable'?
   'Origin and destination are the same declared map.':
   'No structurally resolved directed raw route found in this declared atlas.';
  root.append(empty);
 }
}));

$('map-atlas-raw-census').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Inspect a declared vanilla atlas before raw-cell census');
 const atlas=inspectedMapAtlas.atlas;
 function inputsUnchanged(){
  const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   counts.length===atlas.bankCount&&
   counts.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged())throw Error('Atlas inputs changed; reinspect before census');
 const opts={maxMaps:128,maxUniqueCells:65536,maxRows:32,chunkSize:4096};
 const result=auditVanillaAtlasRawCells(model,atlas,opts);
 const root=$('map-atlas-raw-census-list');root.replaceChildren();
 const common=result.rawHighBitCounts.map((count,value)=>({count,value}))
  .filter(x=>x.count).sort((a,b)=>b.count-a.count||a.value-b.value)
  .slice(0,6).map(x=>x.value+': '+x.count).join(', ');
 $('map-atlas-raw-census-status').textContent=
  'Inspected '+result.mapsInspected+' declared maps, '+
  result.uniqueBlockmaps+' unique blockmaps, '+result.uniqueCells+
  ' physical cells ('+result.logicalCells+' logical map cells; '+
  result.sharedMapReferences+' shared map references). '+
  result.nonzeroRawHighBitCells+' cells have nonzero raw high bits. '+
  'Most common raw values: '+common+'. '+
  (result.rowsTruncated?'First 32 maps shown. ':'')+
  'These values are NOT verified walkability or CUBE collision semantics.';
 for(const row of result.rows){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Bank '+row.bankIndex+' / map '+row.mapIndex+
   ' · '+row.width+'×'+row.height+' · '+row.nonzeroRawHighBitCells+
   ' nonzero raw high-bit cells · '+row.sharedBlockmapReferences+
   ' map reference(s) · inspect raw bytes';
  button.addEventListener('click',()=>safeRun(()=>{
   requireVanillaMapFormat();
   if(!inputsUnchanged())throw Error('Atlas inputs changed; rescan first');
   const fresh=auditVanillaAtlasRawCells(model,atlas,opts);
   const found=fresh.rows.find(m=>m.bankIndex===row.bankIndex&&
    m.mapIndex===row.mapIndex&&m.blockmapOffset===row.blockmapOffset&&
    m.nonzeroRawHighBitCells===row.nonzeroRawHighBitCells);
   if(!found)throw Error('Raw blockmap census changed; rescan first');
   setPageForOffset(found.blockmapOffset);gotoTab('hex');
  }));
  root.append(button);
 }
}));

$('map-atlas-alias-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before reviewing shared pointers');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before shared pointer review');
 const result=auditVanillaAtlasPointerAliases(atlas,{
  maxGroups:64,maxReferences:8
 });
 const root=$('map-atlas-alias-list');root.replaceChildren();
 $('map-atlas-alias-status').textContent='Across '+result.totalMaps+
  ' declared maps: '+result.counts.header+' shared header groups, '+
  result.counts.layout+' shared layout groups, '+result.counts.blockmap+
  ' shared blockmap groups. '+result.totalGroups+' total groups'+
  (result.truncated?' (first 64 shown)':'')+
  '. Shared pointers may be intentional; ownership and CUBE layout unverified.';
 for(const group of result.groups){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Shared '+group.kind+' at 0x'+hex(group.offset)+
   ' · '+group.referenceCount+' map references: '+
   group.references.map(x=>x.bankIndex+'/'+x.mapIndex+
    ' pointer 0x'+hex(x.sourceOffset)).join(', ')+
   (group.referencesTruncated?' (first 8 shown)':'')+
   ' · tap to inspect first pointer source';
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model)throw Error('Atlas expired; reinspect');
   setPageForOffset(group.references[0].sourceOffset);gotoTab('hex');
  }));
  root.append(button);
 }
 if(!result.groups.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No exact shared header, layout or blockmap pointers in the declared atlas.';
  root.append(empty);
 }
}));

$('map-script-alias-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before scanning script aliases');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 function inputsUnchanged(){
  const current=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   current.length===atlas.bankCount&&
   current.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged()||counts.length!==atlas.bankCount)
  throw Error('Atlas inputs changed; reinspect before script alias scan');
 const result=auditVanillaAtlasScriptAliases(model,atlas,{
  startMap:atlasScriptAliasStart,maxMaps:16,maxGroups:32,maxReferences:8
 });
 atlasScriptAliasStart=result.nextStartMap??0;
 $('map-script-alias-audit').textContent=result.nextStartMap===null?
  'Review shared script targets (restart at map 1)':
  'Review shared script targets (next 16 maps)';
 const root=$('map-script-alias-list');root.replaceChildren();
 $('map-script-alias-status').textContent='Inspected declared maps '+
  (result.startMap+1)+'–'+(result.startMap+result.mapsInspected)+
  ' of '+result.totalMaps+': '+result.pointerFields+' object/trigger pointer fields, '+
  result.inRomPointers+' in-ROM, '+result.totalGroups+
  ' shared targets within this page'+
  (result.truncated?' (first 32 groups shown)':'')+
  '. Cross-page aliases are not detected. No CUBE ownership or writes.';
 function addNavigation(label,offset,group,reference){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=label;
  button.addEventListener('click',()=>safeRun(()=>{
   requireVanillaMapFormat();
   if(!inputsUnchanged())throw Error('Atlas inputs changed; reinspect before navigation');
   const fresh=auditVanillaAtlasScriptAliases(model,atlas,{
    startMap:result.startMap,maxMaps:16,maxGroups:32,maxReferences:8
   });
   const match=fresh.groups.find(g=>g.targetOffset===group.targetOffset&&
    g.referenceCount===group.referenceCount);
   if(!match||reference&&!match.references.some(x=>
      x.pointerSourceOffset===reference.pointerSourceOffset&&
      x.bankIndex===reference.bankIndex&&x.mapIndex===reference.mapIndex&&
      x.kind===reference.kind&&x.index===reference.index))
    throw Error('Shared script target changed; rescan before navigation');
   setPageForOffset(offset);gotoTab('hex');
  }));
  root.append(button);
 }
 for(const group of result.groups){
  addNavigation('Shared script target ROM 0x'+hex(group.targetOffset)+
   ' · '+group.referenceCount+' references'+
   (group.referencesTruncated?' (first 8 shown)':'')+
   ' · inspect raw target',group.targetOffset,group,null);
  for(const ref of group.references)
   addNavigation('Bank '+ref.bankIndex+' / map '+ref.mapIndex+
    ' · '+ref.kind+' '+ref.index+' · pointer source ROM 0x'+
    hex(ref.pointerSourceOffset),ref.pointerSourceOffset,group,ref);
 }
 if(!result.groups.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No shared script targets within this page. This does not rule out cross-page sharing.';
  root.append(empty);
 }
}));

$('map-script-crosspage-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before cross-page script review');
 const atlas=inspectedMapAtlas.atlas;
 function inputsUnchanged(){
  const current=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   current.length===atlas.bankCount&&
   current.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged())
  throw Error('Atlas inputs changed; reinspect before cross-page script review');
 const opts={startMap:atlasScriptCrossPageStart,maxMaps:64,
  maxPointerFields:4096,maxGroups:32,maxReferences:8};
 const result=auditVanillaScriptAliasesAcrossPages(model,atlas,opts);
 atlasScriptCrossPageStart=result.nextStartMap??0;
 $('map-script-crosspage-audit').textContent=result.nextStartMap===null?
  'Scan shared script targets across 64 maps (restart)':
  'Scan shared script targets across next 64 maps';
 const root=$('map-script-crosspage-list');root.replaceChildren();
 $('map-script-crosspage-status').textContent='Reviewed declared maps '+
  (result.startMap+1)+'–'+(result.startMap+result.mapsInspected)+
  ' of '+result.totalMaps+': '+result.totalGroups+' shared script targets, '+
  result.pointerFields+' pointer fields ('+result.inRomPointers+' in-ROM)'+
  (result.truncated?' · groups truncated':'')+
  '. Aliases outside this scan window are unknown; no CUBE ownership or writes.';
 function navigate(label,offset,group,reference){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=label;
  button.addEventListener('click',()=>safeRun(()=>{
   requireVanillaMapFormat();
   if(!inputsUnchanged())throw Error('Atlas inputs changed; reinspect before navigation');
   const fresh=auditVanillaScriptAliasesAcrossPages(model,atlas,opts);
   const match=fresh.groups.find(g=>g.targetOffset===group.targetOffset&&
    g.referenceCount===group.referenceCount&&
    g.crossesSixteenMapPage===group.crossesSixteenMapPage);
   if(!match||reference&&!match.references.some(x=>
     x.pointerSourceOffset===reference.pointerSourceOffset&&
     x.bankIndex===reference.bankIndex&&x.mapIndex===reference.mapIndex&&
     x.kind===reference.kind&&x.index===reference.index))
    throw Error('Cross-page script aliases changed; rescan before navigation');
   setPageForOffset(offset);gotoTab('hex');
  }));
  root.append(button);
 }
 for(const group of result.groups){
  navigate('Shared script target ROM 0x'+hex(group.targetOffset)+
   ' · '+group.referenceCount+' references'+
   (group.crossesSixteenMapPage?' · crosses 16-map page boundary':'')+
   (group.referencesTruncated?' · first 8 shown':'')+
   ' · inspect target bytes',group.targetOffset,group,null);
  for(const ref of group.references)
   navigate('Bank '+ref.bankIndex+' / map '+ref.mapIndex+
    ' · '+ref.kind+' '+ref.index+' · source ROM 0x'+
    hex(ref.pointerSourceOffset),ref.pointerSourceOffset,group,ref);
 }
 if(!result.groups.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No shared targets in this scan window. Other windows were not inspected.';
  root.append(empty);
 }
}));


$('map-script-atlas-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before the full-atlas script review');
 const atlas=inspectedMapAtlas.atlas;
 function inputsUnchanged(){
  const current=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   current.length===atlas.bankCount&&
   current.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged())
  throw Error('Atlas inputs changed; reinspect before the full-atlas script review');
 const opts={maxMaps:4096,maxPointerFields:32768,maxGroups:32,maxReferences:8};
 const result=auditVanillaAtlasWideScriptAliases(model,atlas,opts);
 const root=$('map-script-atlas-list');root.replaceChildren();
 $('map-script-atlas-status').textContent='Reviewed all '+result.mapsInspected+
  ' explicitly declared maps: '+result.pointerFields+' script pointer fields ('+
  result.inRomPointers+' in-ROM), '+result.distinctTargets+' distinct targets, '+
  result.totalGroups+' shared targets'+
  (result.truncated?' (first 32 groups shown)':'')+
  '. This is a complete declared-atlas scan, not CUBE layout or ownership verification.';
 function navigate(label,offset,group,reference){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=label;
  button.addEventListener('click',()=>safeRun(()=>{
   requireVanillaMapFormat();
   if(!inputsUnchanged())throw Error('Atlas inputs changed; reinspect before navigation');
   const fresh=auditVanillaAtlasWideScriptAliases(model,atlas,opts);
   const match=fresh.groups.find(g=>g.targetOffset===group.targetOffset&&
    g.referenceCount===group.referenceCount&&
    g.firstMapOrdinal===group.firstMapOrdinal&&
    g.lastMapOrdinal===group.lastMapOrdinal);
   if(!match||reference&&!match.references.some(x=>
     x.pointerSourceOffset===reference.pointerSourceOffset&&
     x.bankIndex===reference.bankIndex&&x.mapIndex===reference.mapIndex&&
     x.kind===reference.kind&&x.index===reference.index))
    throw Error('Atlas-wide script aliases changed; rescan before navigation');
   setPageForOffset(offset);gotoTab('hex');
  }));
  root.append(button);
 }
 for(const group of result.groups){
  navigate('Shared script target ROM 0x'+hex(group.targetOffset)+
   ' · '+group.referenceCount+' references'+
   (group.crossesSixtyFourMapWindow?' · crosses 64-map windows':'')+
   (group.referencesTruncated?' · first 8 shown':'')+
   ' · inspect target bytes',group.targetOffset,group,null);
  for(const ref of group.references)
   navigate('Bank '+ref.bankIndex+' / map '+ref.mapIndex+
    ' · '+ref.kind+' '+ref.index+' · source ROM 0x'+
    hex(ref.pointerSourceOffset),ref.pointerSourceOffset,group,ref);
 }
 if(!result.groups.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No shared script targets in the declared atlas; this is not proof of script ownership.';
  root.append(empty);
 }
}));

$('map-script-operand-atlas-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before the operand alias review');
 const atlas=inspectedMapAtlas.atlas;
 function inputsUnchanged(){
  const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
  return inspectedMapAtlas?.rom===model&&
   parseOffset($('map-bank-offset').value)===atlas.address&&
   $('map-layout-family').value===atlas.family&&
   counts.length===atlas.bankCount&&
   counts.every((n,i)=>n===atlas.bankMapCounts[i]);
 }
 if(!inputsUnchanged())
  throw Error('Atlas inputs changed; reinspect before the operand alias review');
 // Keep synchronous mobile inspection bounded; larger declared atlases
 // must use the explicit local SHA-256 smoke CLI, not a partial UI scan.
 const opts={maxMaps:512,maxPointerFields:8192,maxScripts:1024,
  maxOperandFields:8192,maxGroups:24,maxReferences:8,
  maxBytes:64,maxCommands:16};
 const result=auditVanillaAtlasScriptOperandAliases(model,atlas,opts);
 const root=$('map-script-operand-atlas-list');root.replaceChildren();
 $('map-script-operand-atlas-status').textContent='Reviewed all '+
  result.mapsInspected+' declared maps: '+result.distinctEventScripts+
  ' distinct script roots, '+result.operandFields+' decoded pointer fields, '+
  result.totalGroups+' shared operand targets ('+
  result.mixedRoleGroups+' mixed-role target(s))'+
  (result.truncated?' (first 24 groups shown)':'')+
  '. Source aliases only; not CUBE grammar, target ownership or permission to write.';
 function navigate(label,offset,group,reference){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=label;
  button.addEventListener('click',()=>safeRun(()=>{
   requireVanillaMapFormat();
   if(!inputsUnchanged())
    throw Error('Atlas inputs changed; reinspect before navigation');
   const fresh=auditVanillaAtlasScriptOperandAliases(model,atlas,opts);
   const match=fresh.groups.find(g=>g.targetOffset===group.targetOffset&&
    g.sourceCount===group.sourceCount);
   if(!match||reference&&!match.references.some(ref=>
     ref.pointerSourceOffset===reference.pointerSourceOffset&&
     ref.scriptOffset===reference.scriptOffset&&ref.role===reference.role))
    throw Error('Script operand aliases changed; rescan before navigation');
   setPageForOffset(offset);gotoTab('hex');
  }));
  root.append(button);
 }
 for(const group of result.groups){
  navigate('Shared operand target ROM 0x'+hex(group.targetOffset)+
   ' · '+group.sourceCount+' distinct pointer sources'+
   (group.mixedRoles?' · mixed operand roles: review':'')+
   (group.referencesTruncated?' · first 8 shown':'')+
   ' · inspect target',group.targetOffset,group,null);
  for(const ref of group.references)
   navigate(ref.role+' · source ROM 0x'+hex(ref.pointerSourceOffset)+
    ' · script ROM 0x'+hex(ref.scriptOffset)+
    ' · '+ref.eventRootReferences+' event root(s)',
    ref.pointerSourceOffset,group,ref);
 }
 if(!result.groups.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No shared decoded operand targets in this declared atlas. Unknown commands and untraversed branches remain uninspected.';
  root.append(empty);
 }
}));

$('map-event-ownership-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if(!inspectedMapAtlas||inspectedMapAtlas.rom!==model)
  throw Error('Reinspect the declared atlas before reviewing event ownership');
 const atlas=inspectedMapAtlas.atlas;
 const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
 if(parseOffset($('map-bank-offset').value)!==atlas.address||
    $('map-layout-family').value!==atlas.family||
    counts.length!==atlas.bankCount||
    counts.some((n,i)=>n!==atlas.bankMapCounts[i]))
  throw Error('Atlas inputs changed; reinspect before event ownership review');
 const result=auditVanillaAtlasEventOwnership(model,atlas,{
  maxGroups:64,maxReferences:8,maxConflicts:64});
 const root=$('map-event-ownership-list');root.replaceChildren();
 $('map-event-ownership-status').textContent='Reviewed '+result.mapsWithEvents+
  ' maps with events across '+result.totalMaps+' declared maps: '+
  result.totalGroups+' exact shared event-group/array spans, '+
  result.overlapCount+' potentially overlapping distinct spans. '+
  (result.groupsTruncated||result.overlapsTruncated?'Showing first 64 per category. ':'')+
  'Pointer ownership and CUBE layout remain unauthenticated; no writes.';
 function addRow(label,sourceOffset,stillValid){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=label+' · inspect pointer at 0x'+hex(sourceOffset);
  button.addEventListener('click',()=>safeRun(()=>{
   if(inspectedMapAtlas?.rom!==model)throw Error('Atlas expired; reinspect');
   const fresh=auditVanillaAtlasEventOwnership(model,atlas,{
    maxGroups:64,maxReferences:8,maxConflicts:64});
   if(!stillValid(fresh))throw Error('Event ownership findings changed; review again');
   setPageForOffset(sourceOffset);gotoTab('hex');
  }));
  root.append(button);
 }
 for(const group of result.groups){
  const ref=group.references[0];
  addRow('Shared '+group.kind+' ROM 0x'+hex(group.offset)+
   ' ('+group.size+' bytes) · '+group.referenceCount+' map references: '+
   group.references.map(x=>x.bankIndex+'/'+x.mapIndex).join(', ')+
   (group.referencesTruncated?' (truncated)':''),
   ref.sourceOffset,
   fresh=>fresh.groups.some(g=>g.kind===group.kind&&g.offset===group.offset&&
    g.size===group.size&&g.references.some(x=>x.sourceOffset===ref.sourceOffset)));
 }
 for(const overlap of result.overlaps){
  addRow('Overlap: '+overlap.kind+' 0x'+hex(overlap.offset)+
   ' intersects '+overlap.intersectsKind+' 0x'+hex(overlap.intersectsOffset),
   overlap.reference.sourceOffset,
   fresh=>fresh.overlaps.some(o=>o.kind===overlap.kind&&
    o.offset===overlap.offset&&o.intersectsKind===overlap.intersectsKind&&
    o.intersectsOffset===overlap.intersectsOffset));
 }
 if(!result.groups.length&&!result.overlaps.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No exact event-array aliases or partial overlaps detected in the declared atlas.';
  root.append(empty);
 }
}));

$('map-atlas-select').addEventListener('change',()=>{
 $('map-atlas-audit-list').replaceChildren();
 $('map-atlas-audit-status').textContent='Map selection changed; audit again.';
 $('map-event-coordinate-list').replaceChildren();
 $('map-event-coordinate-status').textContent='Map selection changed; audit coordinates again.';
});
for(const id of ['map-atlas-counts','map-bank-offset','map-layout-family'])
 $(id).addEventListener('change',()=>clearMapAtlas('Declared atlas inputs changed; inspect again.'));
$('map-bank-inspect').addEventListener('click',()=>safeRun(()=>{
  clearWarpInspection();clearConnectionInspection();
  requireVanillaMapFormat();
  const family=$('map-layout-family').value;
  const result=inspectVanillaMapBankEntry(model,{
    address:parseOffset($('map-bank-offset').value),
    bankCount:Number($('map-bank-count').value),
    bankIndex:Number($('map-bank-index').value),
    mapCount:Number($('map-bank-map-count').value),
    mapIndex:Number($('map-bank-map-index').value),
    family
  });
  $('map-layout-offset').value=hex(result.mapHeaderOffset);
  $('map-layout-source').value='header';
  $('map-bank-status').textContent='Unverified '+family+' bank '+result.bankIndex+
    ' / map '+result.mapIndex+' → header 0x'+hex(result.mapHeaderOffset)+
    ' (bank pointer at 0x'+hex(result.bankPointerSource)+
    ', map pointer at 0x'+hex(result.mapPointerSource)+
    '). No CUBE layout authentication; read only.';
  $('map-layout-inspect').click();
  $('map-warp-inspect').click();
  $('map-connection-inspect').click();
  $('map-event-inspect').click();
  $('map-blockset-inspect').click();
}));
$('map-warp-inspect').addEventListener('click',()=>safeRun(()=>{
  clearWarpInspection('Inspecting vanilla events…');
  requireVanillaMapFormat();
  if($('map-layout-source').value!=='header')
    throw Error('Select a vanilla map header, not a layout, for warp inspection');
  const address=parseOffset($('map-layout-offset').value);
  const family=$('map-layout-family').value;
  const result=inspectVanillaMapWarps(model,{address,family});
  const layout=inspectVanillaMapHeader(model,{address,family}).layout;
  inspectedWarpMap={address:layout.blockmapOffset,width:layout.width,
    height:layout.height,warps:result.warps};
  const root=$('map-warp-list');
  $('map-warp-status').textContent=result.eventsOffset===null?
    'No vanilla events pointer. Read only; layout unverified.':
    'Events 0x'+hex(result.eventsOffset)+': '+result.objectCount+' objects, '+
    result.warpCount+' warps, '+result.scriptCount+' script triggers, '+
    result.signpostCount+' signposts. Destinations are raw IDs, NOT verified links.';
  if(!result.warps.length){
    const empty=document.createElement('div');empty.className='empty-state';
    empty.textContent='No warp records in this map.';root.append(empty);
  }
  for(const warp of result.warps){
    const button=document.createElement('button');button.type='button';
    button.className='secondary-button';button.style.display='block';
    button.style.margin='8px 0';button.style.textAlign='left';
    button.textContent='Warp '+warp.index+' ('+warp.x+', '+warp.y+
      ', elevation '+warp.elevation+') → bank '+warp.targetBank+
      ', map '+warp.targetMap+', warp '+warp.warpId+' · ROM 0x'+hex(warp.offset);
    button.setAttribute('aria-label',button.textContent+'; inspect raw hex');
    button.addEventListener('click',()=>safeRun(()=>{setPageForOffset(warp.offset);gotoTab('hex');}));
    root.append(button);
    const plan=document.createElement('button');plan.type='button';
    plan.className='secondary-button';plan.style.margin='0 0 8px 8px';
    plan.textContent='Plan byte changes for warp '+warp.index;
    plan.addEventListener('click',()=>safeRun(()=>{
      if(!model||parseOffset($('map-layout-offset').value)!==address||
         $('map-layout-family').value!==family||
         $('map-layout-source').value!=='header')
        throw Error('Map selection changed; inspect warps again');
      const bytes=Array.from({length:8},(_,i)=>model.read(warp.offset+i));
      selectedWarpPreview={rom:model,address,family,warpIndex:warp.index,expectedBytes:bytes};
      for(const [field,value] of [['x',warp.x],['y',warp.y],
       ['elevation',warp.elevation],['warp-id',warp.warpId],
       ['target-map',warp.targetMap],['target-bank',warp.targetBank]])
        $('map-warp-preview-'+field).value=String(value);
      $('map-warp-preview').disabled=false;
      $('map-warp-preview-status').textContent='Warp '+warp.index+' selected at ROM 0x'+
       hex(warp.offset)+'. Adjust proposed fields and preview; no bytes will be changed.';
    }));
    root.append(plan);
    const atlas=inspectedMapAtlas?.rom===model?inspectedMapAtlas.atlas:null;
    const target=atlas&&atlas.family===family?
      lookupVanillaMapAtlasTarget(atlas,warp.targetBank,warp.targetMap):null;
    if(target){
      const open=document.createElement('button');open.type='button';
      open.className='secondary-button';open.style.margin='0 0 8px 8px';
      open.textContent='Open declared warp destination '+target.bankIndex+'/'+target.mapIndex;
      open.addEventListener('click',()=>safeRun(()=>openDeclaredAtlasMap(target)));
      root.append(open);
    }
    if(atlas&&atlas.family===family){
      const traceButton=document.createElement('button');traceButton.type='button';
      traceButton.className='secondary-button';traceButton.style.margin='0 0 8px 8px';
      traceButton.textContent='Trace recorded arrival for warp '+warp.index;
      traceButton.addEventListener('click',()=>safeRun(()=>{
        requireVanillaMapFormat();
        if(inspectedMapAtlas?.rom!==model||inspectedMapAtlas.atlas!==atlas)
          throw Error('Declared atlas expired; inspect again');
        const sources=atlas.maps.filter(m=>m.mapHeaderOffset===address);
        if(sources.length!==1)
          throw Error('Source map header is absent or aliased; choose an unambiguous atlas entry');
        const source=sources[0];
        const result=traceVanillaWarpArrival(model,atlas,{
          bankIndex:source.bankIndex,mapIndex:source.mapIndex,warpIndex:warp.index
        });
        if(result.status!=='raw-arrival'){
          $('map-warp-status').textContent='Raw warp '+warp.index+': '+result.status+
            '. Cannot navigate to a recorded arrival cell. CUBE behavior unverified.';
          return;
        }
        const destination=result.destination;
        const entry=lookupVanillaMapAtlasTarget(atlas,destination.bankIndex,destination.mapIndex);
        if(!entry||entry.mapHeaderOffset!==destination.headerOffset)
          throw Error('Destination changed; inspect atlas again');
        openDeclaredAtlasMap(entry);
        const next=panMapViewport({width:destination.width,height:destination.height,
          x:0,y:0,dx:destination.x-6,dy:destination.y-5});
        $('map-x').value=String(next.x);$('map-y').value=String(next.y);
        $('map-inspect').click();
        $('map-warp-status').textContent='Raw arrival '+destination.bankIndex+'/'+
          destination.mapIndex+' warp '+destination.warpIndex+' at ('+
          destination.x+', '+destination.y+'), warp record ROM 0x'+
          hex(destination.warpRecordOffset)+', blockmap ROM 0x'+
          hex(destination.blockmapByteOffset)+', tile '+destination.tileId+
          ', raw high bits '+destination.rawCollision+
          '. This is a recorded coordinate, NOT verified runtime teleport behavior.';
      }));
      root.append(traceButton);
    }
  }
  // Only annotate the blockmap when its exact selected offset/dimensions
  // match the inspected header. Never overlay on an unrelated raw map.
  if($('map-offset').value.trim().toUpperCase()===hex(layout.blockmapOffset) &&
     Number($('map-width').value)===layout.width &&
     Number($('map-height').value)===layout.height)
    $('map-inspect').click();
}));

$('map-warp-preview').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 const selection=selectedWarpPreview;
 if(!selection||selection.rom!==model||
    $('map-layout-source').value!=='header'||
    parseOffset($('map-layout-offset').value)!==selection.address||
    $('map-layout-family').value!==selection.family)
  throw Error('Warp selection expired; inspect and select a warp again');
 const readField=id=>{
  const value=$('map-warp-preview-'+id).value.trim();
  if(!value)throw Error('Fill every proposed warp field');
  return Number(value);
 };
 const result=previewVanillaWarpRecordChange(model,{
  address:selection.address,family:selection.family,warpIndex:selection.warpIndex,
  expectedBytes:selection.expectedBytes,
  changes:{x:readField('x'),y:readField('y'),elevation:readField('elevation'),
   warpId:readField('warp-id'),targetMap:readField('target-map'),
   targetBank:readField('target-bank')}
 });
 lastMapPreviews.warp=result;$('map-review-warp-add').disabled=false;
 const format=bytes=>bytes.map(n=>hex(n,2)).join(' ');
 $('map-warp-preview-status').textContent='Warp '+result.warpIndex+' ROM 0x'+
  hex(result.recordOffset)+': '+format(result.before)+' → '+format(result.after)+
  (result.changed?' (proposed change).':' (no difference).')+
  ' Preview only — NOT applied. Ownership, CUBE layout and runtime warp behavior are unverified.';
}));

$('map-connection-inspect').addEventListener('click',()=>safeRun(()=>{
  clearConnectionInspection('Inspecting vanilla connections…');
  requireVanillaMapFormat();
  if($('map-layout-source').value!=='header')
    throw Error('Select a vanilla map header, not a layout, for connection inspection');
  const address=parseOffset($('map-layout-offset').value);
  const result=inspectVanillaMapConnections(model,{address,family:$('map-layout-family').value});
  const root=$('map-connection-list');
  $('map-connection-status').textContent=result.connectionsOffset===null?
    'No vanilla connections pointer. Read only; layout unverified.':
    result.count+' raw map connection(s) at 0x'+hex(result.connectionsOffset)+
    '. Direction codes and destination IDs are NOT authenticated.';
  if(!result.connections.length){
    const empty=document.createElement('div');empty.className='empty-state';
    empty.textContent='No map connection records.';root.append(empty);
  }
  for(const connection of result.connections){
    const button=document.createElement('button');button.type='button';
    button.className='secondary-button';button.style.display='block';
    button.style.margin='8px 0';button.style.textAlign='left';
    button.textContent='Connection '+connection.index+' direction '+connection.direction+
      ', displacement '+connection.displacement+' → bank '+connection.targetBank+
      ', map '+connection.targetMap+' · ROM 0x'+hex(connection.offset);
    button.setAttribute('aria-label',button.textContent+'; inspect raw hex');
    button.addEventListener('click',()=>safeRun(()=>{setPageForOffset(connection.offset);gotoTab('hex');}));
    root.append(button);
    const atlas=inspectedMapAtlas?.rom===model?inspectedMapAtlas.atlas:null;
    const target=atlas&&atlas.family===$('map-layout-family').value?
      lookupVanillaMapAtlasTarget(atlas,connection.targetBank,connection.targetMap):null;
    if(target){
      const open=document.createElement('button');open.type='button';
      open.className='secondary-button';open.style.margin='0 0 8px 8px';
      open.textContent='Open declared connection target '+target.bankIndex+'/'+target.mapIndex;
      open.addEventListener('click',()=>safeRun(()=>openDeclaredAtlasMap(target)));
      root.append(open);
    }
  }
}));

// Read-only raw event records; script pointers and signpost arguments are NOT
// dereferenced or treated as executable semantics.
$('map-event-inspect').addEventListener('click',()=>safeRun(()=>{
  clearEventInspection('Inspecting vanilla object, script and signpost records…');
  requireVanillaMapFormat();
  if($('map-layout-source').value!=='header')
    throw Error('Select a vanilla map header, not a layout, for event inspection');
  const address=parseOffset($('map-layout-offset').value);
  const family=$('map-layout-family').value;
  const result=inspectVanillaMapEvents(model,{address,family});
  const layout=inspectVanillaMapHeader(model,{address,family}).layout;
  inspectedEventMap={address:layout.blockmapOffset,width:layout.width,
    height:layout.height,arrays:result.arrays};
  const root=$('map-event-list');
  $('map-event-status').textContent=result.eventsOffset===null?
    'No vanilla events pointer. Read only; layout unverified.':
    'Raw vanilla records: '+result.counts.objects+' objects, '+
    result.counts.scripts+' script triggers, '+result.counts.signposts+
    ' signposts. Pointers and flags are unverified; no scripts are executed.';
  const labels=[
    ['objects','Object',event=>'ID '+event.id+', graphics '+event.graphics+
      ', elevation '+event.elevation+', movement '+event.movement+
      ', flag '+event.flag+', raw script pointer 0x'+hex(event.scriptPointer)],
    ['scripts','Script trigger',event=>'elevation '+event.elevation+
      ', trigger '+event.trigger+', index '+event.indexValue+
      ', raw script pointer 0x'+hex(event.scriptPointer)],
    ['signposts','Signpost',event=>'elevation '+event.elevation+
      ', kind '+event.kind+', raw argument 0x'+hex(event.rawArgument)]
  ];
  let total=0;
  for(const [key,label,describe] of labels)for(const event of result.arrays[key]){
    total++;
    const button=document.createElement('button');button.type='button';
    button.className='secondary-button';button.style.display='block';
    button.style.margin='8px 0';button.style.textAlign='left';
    button.textContent=label+' '+event.index+' ('+event.x+', '+event.y+
      '), '+describe(event)+' · ROM 0x'+hex(event.offset);
    button.setAttribute('aria-label',button.textContent+'; inspect raw hex');
    button.addEventListener('click',()=>safeRun(()=>{setPageForOffset(event.offset);gotoTab('hex');}));
    root.append(button);
    const plan=document.createElement('button');plan.type='button';
    plan.className='secondary-button';plan.style.margin='0 0 8px 8px';
    plan.textContent='Plan coordinate changes for '+label+' '+event.index;
    plan.addEventListener('click',()=>safeRun(()=>{
     requireVanillaMapFormat();
     if($('map-layout-source').value!=='header'||
        parseOffset($('map-layout-offset').value)!==address||
        $('map-layout-family').value!==family)
      throw Error('Map selection changed; inspect event records again');
     const lengths={objects:24,scripts:16,signposts:12};
     const bytes=Array.from({length:lengths[key]},(_,i)=>model.read(event.offset+i));
     selectedEventPreview={rom:model,address,family,kind:key,index:event.index,
      expectedBytes:bytes};
     $('map-event-preview-x').value=String(event.x);
     $('map-event-preview-y').value=String(event.y);
     $('map-event-preview-elevation').value=String(event.elevation);
     $('map-event-preview').disabled=false;
     $('map-event-preview-status').textContent=label+' '+event.index+
      ' selected at ROM 0x'+hex(event.offset)+
      '. Preview only; no bytes will be changed.';
    }));
    root.append(plan);
  }
  if(!total){
    const empty=document.createElement('div');empty.className='empty-state';
    empty.textContent='No object, script trigger or signpost records.';root.append(empty);
  }
  if($('map-offset').value.trim().toUpperCase()===hex(layout.blockmapOffset) &&
     Number($('map-width').value)===layout.width &&
     Number($('map-height').value)===layout.height)
    $('map-inspect').click();
}));


$('map-event-preview').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 const selection=selectedEventPreview;
 if(!selection||selection.rom!==model||
    $('map-layout-source').value!=='header'||
    parseOffset($('map-layout-offset').value)!==selection.address||
    $('map-layout-family').value!==selection.family)
  throw Error('Event selection expired; inspect and select an event again');
 const field=id=>{
  const value=$('map-event-preview-'+id).value.trim();
  if(!value)throw Error('Fill every proposed event field');
  return Number(value);
 };
 const result=previewVanillaEventCoordinateChange(model,{
  address:selection.address,family:selection.family,kind:selection.kind,
  index:selection.index,expectedBytes:selection.expectedBytes,
  changes:{x:field('x'),y:field('y'),elevation:field('elevation')}
 });
 lastMapPreviews.event=result;$('map-review-event-add').disabled=false;
 const format=bytes=>bytes.map(n=>hex(n,2)).join(' ');
 $('map-event-preview-status').textContent=result.kind+' '+result.index+
  ' · ROM 0x'+hex(result.recordOffset)+' ('+result.recordLength+' bytes): '+
  format(result.before)+' → '+format(result.after)+
  (result.changed?' (proposed change).':' (no difference).')+
  ' NOT applied. Script/flag bytes preserved; CUBE layout and array ownership unverified.';
}));

$('map-script-map-audit').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if($('map-layout-source').value!=='header')
  throw Error('Select a vanilla map header for script audit');
 const original=model,address=parseOffset($('map-layout-offset').value);
 const family=$('map-layout-family').value;
 const opts={address,family,maxRecords:32,maxBytes:64,maxCommands:16};
 const audit=auditVanillaMapEventScripts(model,opts);
 const root=$('map-script-map-audit-list');root.replaceChildren();
 $('map-script-map-audit-status').textContent=
  'Vanilla map script audit: '+audit.inspectedRecords+' of '+
  audit.totalRecords+' object/trigger pointer fields · '+
  audit.counts.inRom+' conventional in-ROM, '+audit.counts.null+
  ' null, '+audit.counts.outsideRom+' outside ROM, '+
  audit.counts.nonRom+' non-ROM · '+audit.counts.decoded+
  ' with decoded prefix commands · '+audit.operandPointerStatuses.inRom+
  ' conventional in-ROM operand pointers'+
  (audit.truncated?' · records truncated':'')+
  '. No CUBE grammar, script ownership, execution or writes.';
 function unchanged(){
  return model===original&&$('map-layout-source').value==='header'&&
   parseOffset($('map-layout-offset').value)===address&&
   $('map-layout-family').value===family;
 }
 for(const record of audit.records){
  const description=record.kind+' '+record.index+
   ' · pointer source ROM 0x'+hex(record.pointerSourceOffset)+
   ' · '+record.pointerStatus+
   (record.preview?' · '+record.preview.decodedCommands+
    ' commands · stop: '+record.preview.stopReason+
    ' · '+record.preview.branchCount+' branch hints · '+
    record.preview.operandPointerCount+' operand pointers':'');
  function addNavigation(label,offset){
   const button=document.createElement('button');button.type='button';
   button.className='secondary-button';button.style.display='block';
   button.style.margin='8px 0';button.style.textAlign='left';
   button.textContent=description+' · '+label;
   button.addEventListener('click',()=>safeRun(()=>{
    requireVanillaMapFormat();
    if(!unchanged())throw Error('Map/ROM selection changed; audit scripts again');
    const fresh=auditVanillaMapEventScripts(model,opts);
    if(!fresh.records.some(item=>
      item.kind===record.kind&&item.index===record.index&&
      item.pointerSourceOffset===record.pointerSourceOffset&&
      item.pointerStatus===record.pointerStatus&&
      item.targetOffset===record.targetOffset))
     throw Error('Script audit pointer changed; audit again');
    setPageForOffset(offset);gotoTab('hex');
   }));
   root.append(button);
  }
  addNavigation('Inspect pointer bytes',record.pointerSourceOffset);
  if(record.targetOffset!==null)
   addNavigation('Inspect raw script target',record.targetOffset);
 }
 if(!audit.records.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No object or trigger script pointers in this map.';
  root.append(empty);
 }
}));

$('map-script-pointer-inspect').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if($('map-layout-source').value!=='header')
  throw Error('Select a vanilla map header for raw script pointers');
 const address=parseOffset($('map-layout-offset').value);
 const family=$('map-layout-family').value;
 const result=inspectVanillaEventScriptPointers(model,{address,family});
 const original=model;
 $('map-script-preview-list').replaceChildren();
 $('map-script-preview-status').textContent='No raw script byte prefix inspected.';
 const root=$('map-script-pointer-list');root.replaceChildren();
 $('map-script-pointer-status').textContent=result.records.length+
  ' raw object/trigger script fields: '+result.counts.inRom+
  ' conventional in-ROM, '+result.counts.null+' zero, '+
  result.counts.outsideRom+' outside ROM, '+result.counts.nonRom+
  ' non-conventional. No scripts decoded, followed or executed.';
 for(const record of result.records){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent=record.kind+' '+record.index+
   ' · pointer field 0x'+hex(record.sourceOffset)+
   ' → raw 0x'+hex(record.rawPointer)+' · '+record.status;
  button.addEventListener('click',()=>safeRun(()=>{
   setPageForOffset(record.sourceOffset);gotoTab('hex');
  }));
  root.append(button);
  if(record.targetOffset!==null){
   const target=document.createElement('button');target.type='button';
   target.className='secondary-button';target.style.margin='0 0 8px 8px';
   target.textContent='Inspect raw destination 0x'+hex(record.targetOffset);
   target.addEventListener('click',()=>safeRun(()=>{
    setPageForOffset(record.targetOffset);gotoTab('hex');
   }));
   root.append(target);
   const preview=document.createElement('button');preview.type='button';
   preview.className='secondary-button';preview.style.margin='0 0 8px 8px';
   preview.textContent='Preview 32 raw bytes (not decoded)';
   preview.addEventListener('click',()=>safeRun(()=>{
    requireVanillaMapFormat();
    if(model!==original||$('map-layout-source').value!=='header'||
       parseOffset($('map-layout-offset').value)!==address||
       $('map-layout-family').value!==family)
      throw Error('Map/ROM selection changed; reinspect raw script pointers');
    const bytes=previewVanillaEventScriptBytes(model,{
      address,family,kind:record.kind,index:record.index,byteCount:32
    });
    const root=$('map-script-preview-list');root.replaceChildren();
    const raw=document.createElement('div');raw.className='palette-note';
    raw.textContent=bytes.bytes.map(value=>hex(value,2)).join(' ');
    root.append(raw);
    $('map-script-preview-status').textContent=bytes.kind+' '+bytes.index+
      ' · pointer field ROM 0x'+hex(bytes.pointerSourceOffset)+
      ' · raw target ROM 0x'+hex(bytes.targetOffset)+
      ' · '+bytes.readBytes+' bytes'+(bytes.truncated?' (ROM end reached)':'')+
      '. Raw prefix only; command boundaries, script length, ownership and CUBE grammar unverified.';
   }));
   root.append(preview);
   const decode=document.createElement('button');decode.type='button';
   decode.className='secondary-button';decode.style.margin='0 0 8px 8px';
   decode.textContent='Inspect vanilla command prefix (limited)';
   decode.addEventListener('click',()=>safeRun(()=>{
    requireVanillaMapFormat();
    if(model!==original||$('map-layout-source').value!=='header'||
       parseOffset($('map-layout-offset').value)!==address||
       $('map-layout-family').value!==family)
      throw Error('Map/ROM selection changed; reinspect script pointers');
    const pointer=previewVanillaEventScriptBytes(model,{
      address,family,kind:record.kind,index:record.index,byteCount:1
    });
    if(pointer.targetOffset!==record.targetOffset)
      throw Error('Script pointer changed; reinspect');
    const decoded=inspectVanillaScriptCommandPrefix(model,{
      address:pointer.targetOffset,family,maxBytes:64,maxCommands:16
    });
    const list=$('map-script-preview-list');list.replaceChildren();
    for(const command of decoded.commands){
      const item=document.createElement('button');item.type='button';
      item.className='secondary-button';item.style.display='block';
      item.style.margin='8px 0';item.style.textAlign='left';
      item.textContent='ROM 0x'+hex(command.offset)+' · '+command.name+
       ' ('+command.length+' bytes) · '+
       command.bytes.map(value=>hex(value,2)).join(' ')+
       (command.args.length?' · '+
        command.args.map(arg=>arg.type+'='+arg.value+
          (arg.target?' ['+arg.target.status+']':'')).join(', '):'');
      item.addEventListener('click',()=>safeRun(()=>{
        if(model!==original)throw Error('ROM replaced; reinspect script');
        setPageForOffset(command.offset);gotoTab('hex');
      }));
      list.append(item);
      // Pointer operands are raw destinations, not authenticated scripts,
      // text or movement data. Recheck the source command before navigation.
      for(const arg of command.args){
        if(arg.type!=='pointer'||arg.target?.status!=='in-rom')continue;
        const targetButton=document.createElement('button');
        targetButton.type='button';targetButton.className='secondary-button';
        targetButton.style.margin='0 8px 8px 0';
        targetButton.textContent='Inspect raw '+command.name+
         ' target ROM 0x'+hex(arg.target.offset);
        targetButton.addEventListener('click',()=>safeRun(()=>{
          if(model!==original)throw Error('ROM replaced; reinspect script');
          const current=inspectVanillaScriptCommandPrefix(model,{
            address:command.offset,family,maxBytes:command.length,maxCommands:1
          }).commands[0];
          if(!current||current.bytes.length!==command.bytes.length||
             current.bytes.some((value,index)=>value!==command.bytes[index]))
            throw Error('Script command bytes changed; reinspect');
          setPageForOffset(arg.target.offset);gotoTab('hex');
        }));
        list.append(targetButton);
      }
    }
    $('map-script-preview-status').textContent=
      'Vanilla fixed-width subset · '+decoded.commands.length+
      ' commands · stopped: '+decoded.stopReason+
      ' at ROM 0x'+hex(decoded.stopOffset)+
      '. Unknown commands stop decoding. No CUBE grammar authentication, script length, control-flow following or write permission.';
   }));
   root.append(decode);
   const branches=document.createElement('button');branches.type='button';
   branches.className='secondary-button';branches.style.margin='0 0 8px 8px';
   branches.textContent='Audit vanilla branch pointer hints';
   branches.addEventListener('click',()=>safeRun(()=>{
    requireVanillaMapFormat();
    if(model!==original||$('map-layout-source').value!=='header'||
       parseOffset($('map-layout-offset').value)!==address||
       $('map-layout-family').value!==family)
      throw Error('Map/ROM selection changed; reinspect script pointers');
    const pointer=previewVanillaEventScriptBytes(model,{
      address,family,kind:record.kind,index:record.index,byteCount:1
    });
    if(pointer.targetOffset!==record.targetOffset)
      throw Error('Script pointer changed; reinspect');
    const audit=auditVanillaScriptBranchTargets(model,{
      address:pointer.targetOffset,family,maxBytes:128,
      maxCommands:32,maxFindings:32
    });
    const list=$('map-script-preview-list');list.replaceChildren();
    for(const finding of audit.findings){
      const line=document.createElement('div');
      line.className='palette-note';
      line.textContent=finding.commandName+
       ' · pointer field ROM 0x'+hex(finding.pointerSourceOffset)+
       ' · '+finding.status+
       (finding.targetOffset===null?'':' · target ROM 0x'+hex(finding.targetOffset));
      const sourceButton=document.createElement('button');sourceButton.type='button';
      sourceButton.className='secondary-button';
      sourceButton.textContent='Inspect pointer bytes';
      sourceButton.addEventListener('click',()=>safeRun(()=>{
        if(model!==original)throw Error('ROM replaced; reinspect');
        setPageForOffset(finding.pointerSourceOffset);gotoTab('hex');
      }));
      line.append(sourceButton);
      if(finding.targetOffset!==null){
        const targetButton=document.createElement('button');targetButton.type='button';
        targetButton.className='secondary-button';
        targetButton.textContent='Inspect target bytes';
        targetButton.addEventListener('click',()=>safeRun(()=>{
          if(model!==original)throw Error('ROM replaced; reinspect');
          setPageForOffset(finding.targetOffset);gotoTab('hex');
        }));
        line.append(targetButton);
      }
      list.append(line);
    }
    $('map-script-preview-status').textContent=
      'Vanilla branch hints: '+audit.total+' pointer operands ('+
      audit.findings.length+' displayed), stopped: '+audit.stopReason+
      (audit.truncated?' · findings truncated':'')+
      '. Targets outside decoded prefix are unresolved, not invalid. No CUBE script ownership, control-flow following or write permission.';
   }));
   root.append(branches);
   const operandButton=document.createElement('button');
   operandButton.type='button';operandButton.className='secondary-button';
   operandButton.style.margin='0 0 8px 8px';
   operandButton.textContent='Review vanilla script operand pointer roles';
   operandButton.addEventListener('click',()=>safeRun(()=>{
    requireVanillaMapFormat();
    if(model!==original||$('map-layout-source').value!=='header'||
       parseOffset($('map-layout-offset').value)!==address||
       $('map-layout-family').value!==family)
      throw Error('Map/ROM selection changed; reinspect script pointers');
    const pointer=previewVanillaEventScriptBytes(model,{
      address,family,kind:record.kind,index:record.index,byteCount:1
    });
    if(pointer.targetOffset!==record.targetOffset)
      throw Error('Script pointer changed; reinspect');
    const auditOptions={address:pointer.targetOffset,family,maxBytes:128,
      maxCommands:32,maxFindings:32};
    const audit=auditVanillaScriptOperandPointers(model,auditOptions);
    const list=$('map-script-preview-list');list.replaceChildren();
    for(const finding of audit.findings){
      const line=document.createElement('div');
      line.className='palette-note';
      line.textContent=finding.commandName+' · '+finding.role+
        ' · '+finding.status+' · pointer ROM 0x'+hex(finding.pointerSourceOffset)+
        (finding.targetOffset===null?'':' → ROM 0x'+hex(finding.targetOffset));
      function navigateOperand(offset,label){
        const button=document.createElement('button');button.type='button';
        button.className='secondary-button';button.textContent=label;
        button.addEventListener('click',()=>safeRun(()=>{
          if(model!==original||$('map-layout-source').value!=='header'||
             parseOffset($('map-layout-offset').value)!==address||
             $('map-layout-family').value!==family)
            throw Error('Map/ROM selection changed; reinspect script pointers');
          const freshPointer=previewVanillaEventScriptBytes(model,{
            address,family,kind:record.kind,index:record.index,byteCount:1
          });
          if(freshPointer.targetOffset!==record.targetOffset)
            throw Error('Script pointer changed; reinspect');
          const fresh=auditVanillaScriptOperandPointers(model,auditOptions);
          if(!fresh.findings.some(item=>
            item.pointerSourceOffset===finding.pointerSourceOffset&&
            item.rawPointer===finding.rawPointer&&
            item.targetOffset===finding.targetOffset&&
            item.role===finding.role&&item.status===finding.status))
            throw Error('Script operand bytes changed; reinspect');
          setPageForOffset(offset);gotoTab('hex');
        }));
        line.append(button);
      }
      navigateOperand(finding.pointerSourceOffset,'Inspect pointer bytes');
      if(finding.targetOffset!==null)
        navigateOperand(finding.targetOffset,'Inspect raw target');
      list.append(line);
    }
    $('map-script-preview-status').textContent=
      'Vanilla operand hints: '+audit.total+' pointer fields ('+
      audit.findings.length+' shown); '+audit.statuses.inRom+
      ' conventional in-ROM, '+audit.statuses.outsideRom+
      ' outside ROM, '+audit.statuses.nonRom+' non-ROM, '+
      audit.statuses.null+' null · stopped: '+audit.stopReason+
      (audit.truncated?' · findings truncated':'')+
      '. Roles are unverified command hints, not target formats or script ownership. No CUBE grammar, traversal or writes.';
   }));
   root.append(operandButton);
  }
 }
 if(!result.records.length){
  const empty=document.createElement('div');empty.className='empty-state';
  empty.textContent='No raw object/trigger script pointer fields.';
  root.append(empty);
 }
}));

// Blockset pointers are syntactically bounded, not proof of CUBE layout.
// Preview uses the existing 4bpp/LZ viewer; no metatile assembly is claimed.
$('map-blockset-inspect').addEventListener('click',()=>safeRun(()=>{
  clearBlocksetInspection('Inspecting vanilla blockset headers…');
  requireVanillaMapFormat();
  if($('map-layout-source').value!=='header')
    throw Error('Select a vanilla map header, not a layout, for blockset inspection');
  const address=parseOffset($('map-layout-offset').value);
  const result=inspectVanillaMapBlocksets(model,{address,family:$('map-layout-family').value});
  $('map-blockset-status').textContent='Unverified vanilla primary/secondary blockset pointers. '+
    'Tileset previews are raw 4bpp tile sheets, NOT assembled or collision-aware map graphics.';
  const root=$('map-blockset-list');
  for(const key of ['primary','secondary']){
    const set=result[key];
    const summary=document.createElement('div');summary.className='palette-note';
    summary.textContent=key+' blockset at 0x'+hex(set.headerOffset)+
      ': tileset 0x'+hex(set.tilesetOffset)+
      ', palette 0x'+hex(set.paletteOffset)+
      ', metatiles 0x'+hex(set.metatileOffset)+
      ', attributes 0x'+hex(set.attributesOffset)+
      ', '+(set.isCompressed?'LZ-compressed':'raw')+' tileset. All offsets unverified.';
    root.append(summary);
    const button=document.createElement('button');button.type='button';
    button.className='secondary-button';button.style.margin='8px 0';
    button.textContent='Preview '+key+' 4bpp tileset (not map rendering)';
    button.addEventListener('click',()=>safeRun(()=>{
      ensureModel();
      $('graphics-offset').value=hex(set.tilesetOffset);
      $('palette-offset').value=hex(set.paletteOffset);
      gotoTab('graphics');
      $('palette-show').click();
      $(set.isCompressed?'graphics-decode':'graphics-show').click();
    }));
    root.append(button);
  }
}));

// This is an explicit, unverified vanilla-format interpretation only.
$('map-layout-inspect').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  if(metadataLayoutKind==='expansion'||metadataLayoutKind==='custom')
    throw Error('Imported metadata declares a non-vanilla layout; vanilla structure interpretation refused.');
  clearWarpInspection();clearConnectionInspection();
  const address=parseOffset($('map-layout-offset').value);
  const family=$('map-layout-family').value,kind=$('map-layout-source').value;
  const parsed=kind==='header'?
    inspectVanillaMapHeader(model,{address,family}):
    inspectVanillaMapLayout(model,{address,family});
  const layout=kind==='header'?parsed.layout:parsed;
  $('map-offset').value=hex(layout.blockmapOffset);
  $('map-width').value=String(layout.width);$('map-height').value=String(layout.height);
  $('map-x').value='0';$('map-y').value='0';
  $('map-grid').replaceChildren();
  $('map-layout-status').textContent=
    'Unverified '+family+' vanilla-format '+kind+' at 0x'+hex(address)+
    ' → layout 0x'+hex(layout.address)+', blockmap 0x'+hex(layout.blockmapOffset)+
    ', '+layout.width+' × '+layout.height+
    '. Pointers and dimensions are syntactically bounded only. NOT CUBE-authenticated; no edits enabled.';
  $('map-inspect').click();
}));

// A manually supplied blockmap address is NOT a verified map layout. This
// view deliberately never interprets the high six bits as walkability.
$('map-inspect').addEventListener('click',()=>safeRun(()=>{
  ensureModel();
  const address=parseOffset($('map-offset').value);
  const width=Number($('map-width').value),height=Number($('map-height').value);
  const x=Number($('map-x').value),y=Number($('map-y').value);
  const preview=inspectBlockMap(model,{address,width,height,x,y,viewportWidth:12,viewportHeight:10});
  const markerIndex=inspectedWarpMap&&inspectedWarpMap.address===address&&
    inspectedWarpMap.width===width&&inspectedWarpMap.height===height?
    indexMapWarpMarkers(inspectedWarpMap.warps,{width,height}):null;
  const eventMarkerIndex=inspectedEventMap&&inspectedEventMap.address===address&&
    inspectedEventMap.width===width&&inspectedEventMap.height===height?
    indexMapEventMarkers(inspectedEventMap.arrays,{width,height}):null;
  clearRenderedMap('Rendered preview disabled or awaiting inspection.');
  const grid=$('map-grid');grid.replaceChildren();
  const rawGridOverlay=$('map-grid-raw-colors').checked?buildRawBlockmapGridOverlay(preview):null;
  let rawGridIndex=0;
  const board=document.createElement('div');board.className='blockmap-grid';
  board.style.gridTemplateColumns='repeat('+preview.columns+', minmax(64px,1fr))';
  for(const row of preview.cells)for(const cell of row){
    const button=document.createElement('button');button.type='button';button.className='blockmap-cell';
    const rawColour=rawGridOverlay?.cells[rawGridIndex];rawGridIndex++;
    if(rawColour)button.style.borderLeft='5px solid rgb('+rawColour.rgb.join(',')+')';
    const warps=markerIndex?.[cell.x+','+cell.y]||[];
    const events=eventMarkerIndex?.[cell.x+','+cell.y]||[];
    button.textContent=cell.tileId+' / '+cell.collision+
      (warps.length?' · W'+warps.join(',W'):'')+
      (events.length?' · '+events.join(','):'');
    button.classList.toggle('has-warp',warps.length>0);
    button.classList.toggle('has-event',events.length>0);
    button.title='('+cell.x+','+cell.y+') tile '+cell.tileId+
      ', raw collision/elevation '+cell.collision+
      (warps.length?', unverified warp(s) '+warps.join(', '):'')+
      (events.length?', unverified object/script/signpost(s) '+events.join(', '):'')+
      ', ROM 0x'+hex(cell.byteOffset);
    button.setAttribute('aria-label',button.title);
    button.addEventListener('click',()=>safeRun(()=>{setPageForOffset(cell.byteOffset);gotoTab('hex');}));
    board.append(button);
  }
  grid.append(board);
  const gridLegend=$('map-grid-legend');gridLegend.replaceChildren();
  if(rawGridOverlay){
    for(const entry of rawGridOverlay.legend){
      const item=document.createElement('span');item.className='map-overlay-legend-item';
      const swatch=document.createElement('span');swatch.className='map-overlay-swatch';
      swatch.style.backgroundColor='rgb('+entry.rgb.join(',')+')';
      item.append(swatch,document.createTextNode(entry.value+' × '+entry.count));
      gridLegend.append(item);
    }
    $('map-grid-color-status').textContent=rawGridOverlay.distinctValues+
      ' distinct raw high-bit value(s) in this grid'+
      (rawGridOverlay.legendTruncated?' (top 12 shown)':'')+
      '. Coloured borders are raw byte categories, NOT passability.';
  }else $('map-grid-color-status').textContent='Raw grid colour coding disabled.';
  if($('map-render-enabled').checked){
    try{
      requireVanillaMapFormat();
      if($('map-layout-source').value!=='header')throw Error('Select an explicit vanilla map header');
      const headerAddress=parseOffset($('map-layout-offset').value);
      const family=$('map-layout-family').value;
      const header=inspectVanillaMapHeader(model,{address:headerAddress,family});
      if(header.layout.blockmapOffset!==address||header.layout.width!==width||header.layout.height!==height)
        throw Error('Selected header does not match blockmap offset and dimensions');
      const rendered=renderVanillaMapViewport(model,{address:headerAddress,family,
        x,y,viewportWidth:12,viewportHeight:10});
      const canvas=$('map-render-canvas'),context=canvas.getContext('2d');
      canvas.width=rendered.width;canvas.height=rendered.height;
      const image=context.createImageData(rendered.width,rendered.height);
      image.data.set(rendered.pixels);context.putImageData(image,0,0);
      const overlayMode=$('map-raw-overlay-mode').value;
      if(overlayMode!=='none'){
        const overlay=buildVanillaRawMapOverlay(rendered,{mode:overlayMode,maxLegend:12});
        for(const cell of overlay.cells){
          context.fillStyle='rgba('+cell.rgb.join(',')+',0.46)';
          context.fillRect(cell.column*16,cell.row*16,16,16);
        }
        const legend=$('map-overlay-legend');legend.replaceChildren();
        for(const entry of overlay.legend){
          const item=document.createElement('span');item.className='map-overlay-legend-item';
          const swatch=document.createElement('span');swatch.className='map-overlay-swatch';
          swatch.style.backgroundColor='rgb('+entry.rgb.join(',')+')';
          item.append(swatch,document.createTextNode(entry.value+' × '+entry.count));
          legend.append(item);
        }
        $('map-overlay-status').textContent=overlay.distinctValues+
          ' distinct raw '+overlay.field+' value(s) in the visible viewport'+
          (overlay.legendTruncated?' (top 12 shown)':'')+
          '. Colours distinguish byte values only; NOT verified collision or walkability.';
      }
      const projected=projectRenderedMapMarkers(rendered,markerIndex,eventMarkerIndex);
      context.font='bold 7px sans-serif';
      for(const marker of projected){
        const left=marker.column*16,top=marker.row*16;
        const label=marker.warps.length?
          'W'+(marker.events.length||marker.warps.length>1?'+':String(marker.warps[0])):
          'E'+(marker.events.length>1?'+':'');
        context.fillStyle='rgba(10,15,28,0.86)';
        context.fillRect(left,top,16,8);
        context.fillStyle='#ffffff';
        context.fillText(label,left+1,top+6,14);
      }
      activeRenderedMap={rom:model,rendered,warpIndex:markerIndex,eventIndex:eventMarkerIndex};
      canvas.style.width=(rendered.width*2)+'px';
      canvas.style.height=(rendered.height*2)+'px';
      canvas.hidden=false;
      let index=0;
      for(const row of rendered.attributes)for(const attr of row){
        const button=board.children[index++];
        button.textContent+=' · B'+hex(attr.behavior,2)+' L'+attr.layer;
        button.title+=', metatile behavior 0x'+hex(attr.behavior,2)+
          ', layer '+attr.layer+', raw attributes at 0x'+hex(attr.attributeOffset)+
          ' (not verified walkability)';
        button.setAttribute('aria-label',button.title);
      }
      $('map-render-status').textContent='Rendered '+rendered.columns+' × '+rendered.rows+
        ' vanilla metatiles, including palette banks and layers. Read-only; CUBE layout and walkability unverified.';
    }catch(err){clearRenderedMap('Cannot render selected map: '+err.message);}
  }
  $('map-status').textContent=preview.columns+' × '+preview.rows+' cells from 0x'+hex(address)+
    (preview.truncated?' (partial viewport)':'')+
    '. Each cell: tile ID / raw collision-elevation (0–63). Re-inspect after edits.';
}));

$('map-render-enabled').addEventListener('change',()=>{clearRenderedMap();if(model)$('map-inspect').click();});
$('map-grid-raw-colors').addEventListener('change',()=>{if(model)$('map-inspect').click();});
$('map-raw-overlay-mode').addEventListener('change',()=>{clearRenderedMap();if(model)$('map-inspect').click();});
$('map-render-canvas').addEventListener('click',event=>safeRun(()=>{
 if(!activeRenderedMap||activeRenderedMap.rom!==model)
  throw Error('Rendered map changed; inspect again');
 const canvas=$('map-render-canvas'),rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)throw Error('Rendered canvas has no visible dimensions');
 const pixelX=(event.clientX-rect.left)*canvas.width/rect.width;
 const pixelY=(event.clientY-rect.top)*canvas.height/rect.height;
 const hit=inspectRenderedMapPixel(activeRenderedMap.rendered,pixelX,pixelY);
 if(!hit)return;
 selectedRenderedHit={rom:model,hit};
 const key=hit.cell.x+','+hit.cell.y;
 const warps=activeRenderedMap.warpIndex?.[key]||[];
 const events=activeRenderedMap.eventIndex?.[key]||[];
 $('map-render-selection').textContent='Cell ('+hit.cell.x+', '+hit.cell.y+
  '): metatile '+hit.cell.tileId+', raw collision/elevation '+hit.cell.collision+
  ', behavior 0x'+hex(hit.attribute.behavior,2)+', layer '+hit.attribute.layer+
  ', blockmap ROM 0x'+hex(hit.cell.byteOffset)+
  ', attributes ROM 0x'+hex(hit.attribute.attributeOffset)+
  (warps.length?', raw warp(s) '+warps.join(', '):'')+
  (events.length?', raw event(s) '+events.join(', '):'')+
  '. Coordinates and walkability are NOT authenticated.';
 $('map-render-jump').disabled=false;
 $('map-preview-x').value=String(hit.cell.x);
 $('map-preview-y').value=String(hit.cell.y);
 $('map-preview-tile').value=String(hit.cell.tileId);
 $('map-preview-collision').value=String(hit.cell.collision);
 $('map-preview-status').textContent='Cell selected. Change a proposed tile or raw collision value, then preview exact bytes. No writes.';
}));
$('map-render-jump').addEventListener('click',()=>safeRun(()=>{
 if(!selectedRenderedHit||selectedRenderedHit.rom!==model||!activeRenderedMap)
  throw Error('Rendered selection expired; inspect again');
 setPageForOffset(selectedRenderedHit.hit.cell.byteOffset);gotoTab('hex');
}));

for(const id of ['map-layout-offset','map-layout-family','map-layout-source','map-offset','map-width','map-height','map-x','map-y']){
 $(id).addEventListener('change',()=>clearRenderedMap('Map selection changed; inspect again.'));
}

for(const [id,dx,dy] of [
  ['map-pan-up',0,-10],['map-pan-down',0,10],
  ['map-pan-left',-12,0],['map-pan-right',12,0]
]){
  $(id).addEventListener('click',()=>safeRun(()=>{
    ensureModel();
    const next=panMapViewport({
      width:Number($('map-width').value),height:Number($('map-height').value),
      x:Number($('map-x').value),y:Number($('map-y').value),dx,dy
    });
    $('map-x').value=String(next.x);$('map-y').value=String(next.y);
    $('map-inspect').click();
  }));
}


$('map-preview-cell').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if($('map-layout-source').value!=='header')
  throw Error('Choose an independently verified vanilla map header first');
 const address=parseOffset($('map-layout-offset').value);
 const family=$('map-layout-family').value;
 const header=inspectVanillaMapHeader(model,{address,family});
 if(header.layout.blockmapOffset!==parseOffset($('map-offset').value)||
    header.layout.width!==Number($('map-width').value)||
    header.layout.height!==Number($('map-height').value))
  throw Error('Selected map header differs from the displayed blockmap');
 let atlas;
 if(inspectedMapAtlas?.rom===model){
  const candidate=inspectedMapAtlas.atlas;
  const counts=parseVanillaBankMapCounts($('map-atlas-counts').value);
  if(parseOffset($('map-bank-offset').value)!==candidate.address||
     candidate.family!==family||counts.length!==candidate.bankCount||
     counts.some((n,i)=>n!==candidate.bankMapCounts[i]))
   throw Error('Declared atlas inputs changed; inspect atlas again');
  if(candidate.maps.some(m=>m.mapHeaderOffset===address))atlas=candidate;
 }
 const proposedTile=$('map-preview-tile').value.trim();
 const proposedCollision=$('map-preview-collision').value.trim();
 const x=Number($('map-preview-x').value),y=Number($('map-preview-y').value);
 const selected=selectedRenderedHit?.rom===model?selectedRenderedHit.hit.cell:null;
 const expectedRaw=selected&&selected.x===x&&selected.y===y?selected.raw:undefined;
 const result=previewVanillaBlockmapCellChange(model,{
  address,family,x,y,
  ...(proposedTile===''?{}:{tileId:Number(proposedTile)}),
  ...(proposedCollision===''?{}:{collision:Number(proposedCollision)}),
  ...(expectedRaw===undefined?{}:{expectedRaw}),...(atlas?{atlas}:{})
 });
 lastMapPreviews.cell=result;$('map-review-cell-add').disabled=false;
 $('map-visual-compare').disabled=false;
 for(const id of ['map-compare-before','map-compare-after'])$(id).hidden=true;
 $('map-compare-status').textContent='Proposed bytes ready. Compare rendered appearance without writing ROM data.';
 const old=result.before.bytes.map(n=>hex(n,2)).join(' ');
 const next=result.after.bytes.map(n=>hex(n,2)).join(' ');
 $('map-preview-status').textContent='ROM 0x'+hex(result.byteOffset)+
  ' · original '+old+' (tile '+result.before.tileId+', raw bits '+result.before.collision+
  ') → proposed '+next+' (tile '+result.after.tileId+', raw bits '+result.after.collision+
  '). '+(result.changed?'Two-byte change preview only.':'No byte difference.')+
  ' Shared blockmap owners: '+(result.aliases.known?result.aliases.total:'unknown (no matching atlas)')+
  '. NOT applied. CUBE layout, collision semantics and write safety unverified.';
}));

$('map-visual-compare').addEventListener('click',()=>safeRun(()=>{
 ensureModel();requireVanillaMapFormat();
 const preview=lastMapPreviews.cell;
 if(!preview)throw Error('Preview the selected vanilla cell before comparing its appearance');
 const currentX=Number($('map-x').value),currentY=Number($('map-y').value);
 const x=Number.isSafeInteger(currentX)&&currentX>=0&&preview.x>=currentX&&preview.x<currentX+12?
  currentX:Math.max(0,preview.x-5);
 const y=Number.isSafeInteger(currentY)&&currentY>=0&&preview.y>=currentY&&preview.y<currentY+10?
  currentY:Math.max(0,preview.y-4);
 const result=compareVanillaBlockmapVisualChange(model,{preview,x,y,viewportWidth:12,viewportHeight:10});
 for(const [id,view] of [['map-compare-before',result.before],['map-compare-after',result.after]]){
  const canvas=$(id),context=canvas.getContext('2d');
  canvas.width=view.width;canvas.height=view.height;
  const image=context.createImageData(view.width,view.height);
  image.data.set(view.pixels);context.putImageData(image,0,0);
  canvas.hidden=false;
 }
 $('map-compare-status').textContent='Proposed cell ('+preview.x+', '+preview.y+
  ') at ROM 0x'+hex(preview.byteOffset)+': '+result.changedPixelCount+
  ' changed rendered pixel(s)'+
  (result.changedPixelBounds?' in '+result.changedPixelBounds.width+' × '+
   result.changedPixelBounds.height+' pixel bounds':'')+
  (result.changedRawCollision?'. Raw high bits changed; this is not a walkability preview.':'')+
  ' Before/after images are local and read-only. No ROM bytes were modified; CUBE layout remains unauthenticated.';
}));


$('map-visual-compare-queue').addEventListener('click',()=>safeRun(()=>{
 ensureModel();requireVanillaMapFormat();
 if(mapReviewRom!==model||!mapReviewQueue.length)
  throw Error('Queue map-cell previews for the current ROM first');
 reviewVanillaChangeSet(model,mapReviewQueue,{maxChanges:64,maxBytes:2048});
 if($('map-layout-source').value!=='header')
  throw Error('Select a declared vanilla map header to compare queued cells');
 const headerAddress=parseOffset($('map-layout-offset').value);
 const family=$('map-layout-family').value;
 const previews=mapReviewQueue.filter(p=>Number.isSafeInteger(p.byteOffset)&&
  p.headerOffset===headerAddress&&p.family===family);
 if(!previews.length)throw Error('No queued cell changes belong to the selected map header');
 const x=Number($('map-x').value),y=Number($('map-y').value);
 const result=compareVanillaBlockmapVisualChangeSet(model,{
  previews,x,y,viewportWidth:12,viewportHeight:10
 });
 for(const [id,view] of [['map-compare-before',result.before],['map-compare-after',result.after]]){
  const canvas=$(id),context=canvas.getContext('2d');
  canvas.width=view.width;canvas.height=view.height;
  const image=context.createImageData(view.width,view.height);
  image.data.set(view.pixels);context.putImageData(image,0,0);
  canvas.hidden=false;
 }
 $('map-compare-status').textContent=result.cells.length+
  ' queued cell proposal(s) for selected vanilla map; '+result.visibleCellCount+
  ' in viewport; '+result.changedPixelCount+' changed rendered pixel(s). '+
  result.changedMetatileCount+' tile ID change(s), '+
  result.changedRawCollisionCount+' raw high-bit change(s). '+
  (mapReviewQueue.length-previews.length)+' other map/warp/event proposal(s) excluded. '+
  'No ROM writes; CUBE layout and walkability remain unauthenticated.';
}));

$('map-summary-scan').addEventListener('click',()=>safeRun(()=>{
 requireVanillaMapFormat();
 if($('map-layout-source').value!=='header')
  throw Error('Select an independently verified vanilla map header first');
 const family=$('map-layout-family').value;
 const headerAddress=parseOffset($('map-layout-offset').value);
 const header=inspectVanillaMapHeader(model,{address:headerAddress,family});
 const address=parseOffset($('map-offset').value);
 const width=Number($('map-width').value),height=Number($('map-height').value);
 if(header.layout.blockmapOffset!==address||
    header.layout.width!==width||header.layout.height!==height)
  throw Error('Selected vanilla header does not match the blockmap offset and dimensions');
 const result=summarizeBlockmapChunk(model,{
  address,width,height,startCell:Number($('map-summary-start').value),maxCells:4096
 });
 const original=model,root=$('map-summary-list');
 root.replaceChildren();
 const flags=result.rawHighBitCounts.map((count,flag)=>({
  flag,count,offset:result.firstRawHighBitOffsets[flag]
 })).filter(entry=>entry.count>0).sort((a,b)=>b.count-a.count||a.flag-b.flag);
 $('map-summary-status').textContent='Raw cells '+result.startCell+'–'+
  (result.startCell+result.scannedCells-1)+' of '+result.totalCells+
  ' ('+result.scannedCells+' scanned). '+flags.length+
  ' distinct six-bit values, '+result.distinctTiles+' distinct tile IDs. '+
  'Top tile IDs: '+result.commonTiles.map(x=>x.tileId+' × '+x.count).join(', ')+
  '. First 16 flag values below; these are NOT verified walkability or CUBE collision rules.';
 for(const entry of flags.slice(0,16)){
  const button=document.createElement('button');button.type='button';
  button.className='secondary-button';button.style.display='block';
  button.style.margin='8px 0';button.style.textAlign='left';
  button.textContent='Raw high bits '+entry.flag+' · '+entry.count+
   ' cells · first ROM 0x'+hex(entry.offset)+' · tap for hex';
  button.addEventListener('click',()=>safeRun(()=>{
   if(model!==original)throw Error('ROM replaced; scan again');
   setPageForOffset(entry.offset);gotoTab('hex');
  }));
  root.append(button);
 }
 $('map-summary-next').disabled=result.nextCell===null;
 $('map-summary-next').dataset.nextCell=result.nextCell===null?'':String(result.nextCell);
}));
$('map-summary-next').addEventListener('click',()=>safeRun(()=>{
 const next=$('map-summary-next').dataset.nextCell;
 if($('map-summary-next').disabled||!/^\d+$/.test(next))
  throw Error('Scan the current map page before continuing');
 $('map-summary-start').value=next;
 $('map-summary-scan').click();
}));
$('map-summary-start').addEventListener('change',()=>clearRawBlockmapSummary('Start cell changed; scan again.'));

updateIndicators();drawGraphics();drawAnchors();renderTab(routeFromHash());
