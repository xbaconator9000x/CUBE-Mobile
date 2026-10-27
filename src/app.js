import {RomModel, MAX_BYTES, hex, parseOffset, parseHexBytes, applyBps, applyIps, crc32, paletteAt, gba4bppTile, decodeLz10, scanLz10Graphics} from './core.js';
import {parseHmaNamedAnchors,collectHmaNamedAnchors,readAnchorInspection,groupAnchors,filterAnchors,previewHmaFixedTable,resolveHmaStockMetadata,checkHmaMetadataSources,inspectHmaPointerReferences,parseHmaOffsetPointers,resolveHmaTableLayouts,collectHmaLists,collectHmaMatchedWords} from './semantic.js';
import {inspectFixedTextBytes} from './text-inspection.js';
import {decodeHmaPcsFallback} from './pcs-default.js';
import {parseHmaPcsReference,decodeHmaPcsReference} from './pcs-reference.js';
import {fingerprintRomSha256,fingerprintMatchesRom} from './rom-fingerprint.js';
import {compareRomIdentity} from './rom-compatibility.js';
import {fingerprintMetadataFiles,compareRomMetadataFingerprintRecords} from './metadata-fingerprint.js';
import {inspectBlockMap} from './map-blocks.js';
import {inspectVanillaMapLayout,inspectVanillaMapHeader} from './map-layouts.js';
import {inspectVanillaMapBankEntry,inspectVanillaMapWarps} from './map-discovery.js';
import {parseVanillaBankMapCounts,inspectVanillaMapAtlas,lookupVanillaMapAtlasTarget} from './map-atlas.js';
import {auditVanillaMapLinks} from './map-link-audit.js';
import {inspectVanillaMapConnections} from './map-connections.js';
import {inspectVanillaMapEvents} from './map-events.js';
import {inspectVanillaMapBlocksets} from './map-blocksets.js';
import {panMapViewport,indexMapWarpMarkers,indexMapEventMarkers,inspectRenderedMapPixel,projectRenderedMapMarkers} from './map-viewport.js';
import {renderVanillaMapViewport} from './map-render.js';

const $=id=>document.getElementById(id), qa=q=>[...document.querySelectorAll(q)];
let metadata=[],metadataSources=[],metadataLayoutKind='unspecified',metadataOffsetPointers=[],metadataLists=[],metadataListConflicts=new Set(),metadataMatchedWords=[],metadataWordConflicts=new Set(),metadataWordSnapshot=null,metadataResolution=null,selectedAnchor=null;
let pcsReference=null,pcsReferenceName='';
let fingerprintResult=null,fingerprintAbort=null;
let metadataFingerprints=[],metadataImportSerial=0;
let inspectedWarpMap=null,inspectedEventMap=null,inspectedMapAtlas=null;
let activeRenderedMap=null,selectedRenderedHit=null;
let model=null, currentTab='home', page=0, selected=null, patchFile=null, paletteOffset=null, graphicsSource=null, tilePage=0, palette=null, graphicCandidates=[], scanToken=0, scanning=false, toastTimer=null;
const PER_PAGE=128;
const tiles=$('tile-canvas'),ctx=tiles.getContext('2d',{willReadFrequently:false});
ctx.imageSmoothingEnabled=false;
const controls=['rom-fingerprint','rom-fingerprint-check','hex-prev','hex-next','hex-jump','hex-find','hex-offset','hex-search','graphics-offset','palette-offset','graphics-show','graphics-decode','palette-show','palette-reset','graphics-scan','map-inspect','map-layout-inspect','map-bank-inspect','map-atlas-inspect','map-warp-inspect','map-connection-inspect','map-event-inspect','map-blockset-inspect','map-pan-up','map-pan-down','map-pan-left','map-pan-right','save-rom','save-project','export-ips','discard-button','edit-unlock'];
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
}
function installModel(name,bytes){clearMapAtlas('ROM replaced; declared atlas invalidated.');metadataImportSerial++;metadataFingerprints=[];clearRenderedMap('ROM replaced. Select vanilla header again.');$('map-grid').innerHTML='<div class="empty-state">No blockmap inspected.</div>';$('map-bank-status').textContent='ROM replaced. Re-enter independently verified vanilla bank location and counts.';clearWarpInspection('ROM replaced. Select a vanilla map header again.');clearConnectionInspection('ROM replaced. Select a vanilla map header again.');$('map-layout-status').textContent='ROM replaced. No vanilla-format layout inspected.';$('map-status').textContent='ROM replaced. Enter a verified offset and inspect again.';pcsReference=null;fingerprintAbort?.abort();fingerprintAbort=null;fingerprintResult=null;$('rom-fingerprint-status').textContent='Ready to compute a local SHA-256. Layout remains unverified.';$('rom-fingerprint-expected').value='';$('rom-fingerprint-compare-status').textContent='Paste a reference digest after hashing to compare exact bytes. No layout authentication.';pcsReferenceName='';$('pcs-reference-status').textContent='No optional PCS reference loaded.';metadata=[];metadataSources=[];metadataLayoutKind='unspecified';metadataOffsetPointers=[];metadataLists=[];metadataListConflicts=new Set();metadataMatchedWords=[];metadataWordConflicts=new Set();metadataWordSnapshot=null;metadataResolution=null;selectedAnchor=null;model=new RomModel(name,bytes);page=0;selected=null;patchFile=null;resetGraphicState();$('patch-filename').textContent='No patch selected';$('patch-picker').value='';$('edit-unlock').checked=false;$('hex-offset').value='000000';$('selected-offset').value='';$('selected-value').value='';updateIndicators();drawHex();drawAnchors();drawGraphics();drawChanges();toast(`${name} opened locally · ${formatSize(bytes.length)}`);}
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
  if(model.write(selected,parseInt(val,16))){invalidateDecodedGraphic();clearWarpInspection('ROM bytes changed; inspect warps again.');clearConnectionInspection('ROM bytes changed; inspect connections again.');clearMapGrid('ROM bytes changed; inspect map cells again.');clearConnectionInspection('ROM bytes changed; inspect connections again.');clearMapGrid('ROM bytes changed; inspect map cells again.');toast(`Staged edit at 0x${hex(selected)}`);}drawHex();updateIndicators();
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
function metadataReset(){metadataImportSerial++;metadataFingerprints=[];clearWarpInspection('Metadata reset; inspect warps again.');clearConnectionInspection('Metadata reset; inspect connections again.');clearMapGrid('Metadata reset; inspect map again.');metadata=[];metadataSources=[];metadataLayoutKind='unspecified';metadataOffsetPointers=[];metadataLists=[];metadataListConflicts=new Set();metadataMatchedWords=[];metadataWordConflicts=new Set();metadataWordSnapshot=null;metadataResolution=null;selectedAnchor=null;selectedInspection=null;drawAnchors();}
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
function drawAnchors(){
  drawMetadataFingerprintStatus();
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


function clearRenderedMap(message='Rendered preview invalidated; inspect again.'){
 activeRenderedMap=null;selectedRenderedHit=null;
 $('map-render-selection').textContent='Tap a rendered metatile to inspect its raw source offsets.';
 $('map-render-jump').disabled=true;
 $('map-render-canvas').hidden=true;
 $('map-render-status').textContent=message;
}
function clearMapGrid(message='Map structure changed; inspect again.'){
  clearMapAtlas(message+' Reinspect declared bank counts.');
  clearRenderedMap();
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
  inspectedWarpMap=null;
  $('map-warp-list').replaceChildren();
  $('map-warp-status').textContent=message;
}
function clearEventInspection(message='Select a vanilla map header to inspect object, script and signpost records.'){
  inspectedEventMap=null;
  $('map-event-list').replaceChildren();
  $('map-event-status').textContent=message;
}
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
 inspectedMapAtlas=null;
 const select=$('map-atlas-select');
 select.replaceChildren(new Option('Inspect an atlas first',''));
 select.disabled=true;
 $('map-atlas-open').disabled=true;
 $('map-atlas-audit').disabled=true;
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
$('map-atlas-inspect').addEventListener('click',()=>safeRun(()=>{
 clearMapAtlas('Inspecting declared vanilla map pointers…');
 requireVanillaMapFormat();
 const atlas=inspectVanillaMapAtlas(model,{
  address:parseOffset($('map-bank-offset').value),
  bankMapCounts:parseVanillaBankMapCounts($('map-atlas-counts').value),
  family:$('map-layout-family').value
 });
 inspectedMapAtlas={atlas,rom:model};
 const select=$('map-atlas-select'),options=document.createDocumentFragment();
 for(let i=0;i<atlas.maps.length;i++){
  const entry=atlas.maps[i];
  options.append(new Option('Bank '+entry.bankIndex+' / map '+entry.mapIndex+
   ' · '+entry.width+'×'+entry.height+' · header 0x'+hex(entry.mapHeaderOffset),String(i)));
 }
 select.replaceChildren(options);select.disabled=false;
 $('map-atlas-open').disabled=false;
 $('map-atlas-audit').disabled=false;
 $('map-atlas-status').textContent='Inspected '+atlas.mapCount+' explicitly declared maps across '+
  atlas.bankCount+' vanilla-format banks. Pointer/layout bounds checked; no ROM identity, CUBE layout or warp topology authenticated.';
}));
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
$('map-atlas-select').addEventListener('change',()=>{
 $('map-atlas-audit-list').replaceChildren();
 $('map-atlas-audit-status').textContent='Map selection changed; audit again.';
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
  }
  // Only annotate the blockmap when its exact selected offset/dimensions
  // match the inspected header. Never overlay on an unrelated raw map.
  if($('map-offset').value.trim().toUpperCase()===hex(layout.blockmapOffset) &&
     Number($('map-width').value)===layout.width &&
     Number($('map-height').value)===layout.height)
    $('map-inspect').click();
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
  const board=document.createElement('div');board.className='blockmap-grid';
  board.style.gridTemplateColumns='repeat('+preview.columns+', minmax(64px,1fr))';
  for(const row of preview.cells)for(const cell of row){
    const button=document.createElement('button');button.type='button';button.className='blockmap-cell';
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

updateIndicators();drawGraphics();drawAnchors();renderTab(routeFromHash());
