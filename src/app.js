import {RomModel, MAX_BYTES, hex, parseOffset, parseHexBytes, applyBps, applyIps, crc32, paletteAt, gba4bppTile, decodeLz10, scanLz10Graphics} from './core.js';
import {parseHmaNamedAnchors,collectHmaNamedAnchors,readAnchorInspection,groupAnchors,filterAnchors,previewHmaFixedTable,resolveHmaStockMetadata,checkHmaMetadataSources,inspectHmaPointerReferences,parseHmaOffsetPointers,resolveHmaTableLayouts,collectHmaLists,collectHmaMatchedWords} from './semantic.js';
import {inspectFixedTextBytes} from './text-inspection.js';
import {decodeHmaPcsFallback} from './pcs-default.js';
import {parseHmaPcsReference,decodeHmaPcsReference} from './pcs-reference.js';
import {fingerprintRomSha256,fingerprintMatchesRom} from './rom-fingerprint.js';

const $=id=>document.getElementById(id), qa=q=>[...document.querySelectorAll(q)];
let metadata=[],metadataSources=[],metadataLayoutKind='unspecified',metadataOffsetPointers=[],metadataLists=[],metadataListConflicts=new Set(),metadataMatchedWords=[],metadataWordConflicts=new Set(),metadataWordSnapshot=null,metadataResolution=null,selectedAnchor=null;
let pcsReference=null,pcsReferenceName='';
let fingerprintResult=null,fingerprintAbort=null;
let model=null, currentTab='home', page=0, selected=null, patchFile=null, paletteOffset=null, graphicsSource=null, tilePage=0, palette=null, graphicCandidates=[], scanToken=0, scanning=false, toastTimer=null;
const PER_PAGE=128;
const tiles=$('tile-canvas'),ctx=tiles.getContext('2d',{willReadFrequently:false});
ctx.imageSmoothingEnabled=false;
const controls=['rom-fingerprint','hex-prev','hex-next','hex-jump','hex-find','hex-offset','hex-search','graphics-offset','palette-offset','graphics-show','graphics-decode','palette-show','palette-reset','graphics-scan','save-rom','save-project','export-ips','discard-button','edit-unlock'];
const tabs={home:['YOUR WORKSPACE','ROM Workbench'],hex:['BINARY INSPECTOR','Hex editor'],anchors:['ROM SEMANTICS','Named data'],graphics:['GBA GRAPHICS','Graphics explorer'],patches:['PATCH WORKFLOW','Patch tools'],changes:['REVIEW & EXPORT','Changes']};
function toast(message,bad=false){const t=$('toast');t.textContent=message;t.classList.toggle('error',bad);t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),4300);}
function safeRun(fn){try{const result=fn();if(result?.catch) result.catch(err=>toast(err.message||String(err),true));}catch(err){toast(err.message||String(err),true);}}
function confirmAction(title,description){return new Promise(resolve=>{const d=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-text').textContent=description;d.showModal();d.addEventListener('close',()=>resolve(d.returnValue==='yes'),{once:true});});}
function ensureModel(){if(!model)throw Error('Open a GBA ROM first');return model;}
// A fragment route works both in an HTTPS-installed PWA and in a locally opened
// file:// standalone HTML app. Each tab change creates a real history entry,
// allowing Android's system Back gesture/button to return to the previous tab.
const routeFromHash=()=>{
  const match=/^#\/(home|hex|anchors|graphics|patches|changes)$/.exec(location.hash);
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
  }
  controls.forEach(id=>$(id).disabled=!active);
  $('rom-fingerprint').disabled=!active||!!fingerprintAbort;
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
}
function installModel(name,bytes){fingerprintAbort?.abort();fingerprintAbort=null;fingerprintResult=null;$('rom-fingerprint-status').textContent='Ready to compute a local SHA-256. Layout remains unverified.';pcsReference=null;pcsReferenceName='';$('pcs-reference-status').textContent='No optional PCS reference loaded.';metadata=[];metadataSources=[];metadataLayoutKind='unspecified';metadataOffsetPointers=[];metadataLists=[];metadataListConflicts=new Set();metadataMatchedWords=[];metadataWordConflicts=new Set();metadataWordSnapshot=null;metadataResolution=null;selectedAnchor=null;model=new RomModel(name,bytes);page=0;selected=null;patchFile=null;resetGraphicState();$('patch-filename').textContent='No patch selected';$('patch-picker').value='';$('edit-unlock').checked=false;$('hex-offset').value='000000';$('selected-offset').value='';$('selected-value').value='';updateIndicators();drawHex();drawAnchors();drawGraphics();drawChanges();toast(`${name} opened locally · ${formatSize(bytes.length)}`);}
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
    $('rom-fingerprint-status').textContent='SHA-256: '+result.sha256+
      ' ('+formatSize(result.length)+', current staged bytes). Identity only — CUBE layout NOT verified.';
  }catch(err){
    if(model===current)$('rom-fingerprint-status').textContent='Fingerprint unavailable: '+err.message;
  }finally{
    if(fingerprintAbort===controller)fingerprintAbort=null;
    updateIndicators();
  }
});
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
  if(model.write(selected,parseInt(val,16))){invalidateDecodedGraphic();toast(`Staged edit at 0x${hex(selected)}`);}drawHex();updateIndicators();
}));
$('undo-button').addEventListener('click',()=>safeRun(()=>{if(model.undo()){invalidateDecodedGraphic();drawHex();drawGraphics();updateIndicators();}}));
$('redo-button').addEventListener('click',()=>safeRun(()=>{if(model.redo()){invalidateDecodedGraphic();drawHex();drawGraphics();updateIndicators();}}));
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
      const result=graphicsSource.bytes?{data:graphicsSource.bytes,consumed:graphicsSource.compressedBytes}:decodeLz10(model.snapshot(),graphicsSource.offset);
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
  const next=kind==='lz'?decodeLz10(model.snapshot(),offset):null;
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
  const data=model.snapshot(),chunkSize=1024*1024,limit=128;
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
    const restored=model.loadProject(project);invalidateDecodedGraphic();drawHex();drawGraphics();drawChanges();updateIndicators();toast(`Restored ${restored} bytes of checked edits.`);
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
  if(yes){model.reset();page=0;selected=null;resetGraphicState();$('edit-unlock').checked=false;drawHex();drawGraphics();drawChanges();updateIndicators();toast('Reset to original ROM.');}
});
window.addEventListener('beforeunload',e=>{if(model?.dirty){e.preventDefault();e.returnValue='';}});
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) navigator.serviceWorker.register('./sw.js').catch(()=>{});



// Named-data discovery is intentionally read-only until CUBHMA's full format
// engine, game fingerprints and pointer allocator have been ported and tested.
let displayedAnchors=[], selectedInspection=null;
const encodeHex=bytes=>Array.from(bytes).map((b,i)=>hex(b,2)+(i%16===15?'\n':' ')).join('').trim();
function metadataReset(){metadata=[];metadataSources=[];metadataLayoutKind='unspecified';metadataOffsetPointers=[];metadataLists=[];metadataListConflicts=new Set();metadataMatchedWords=[];metadataWordConflicts=new Set();metadataWordSnapshot=null;metadataResolution=null;selectedAnchor=null;selectedInspection=null;drawAnchors();}
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
function drawAnchors(){
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
$('metadata-picker').addEventListener('change',async e=>{
  const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;
  try{ensureModel();const sources=[];
    for(const file of files){if(file.size>4*1024*1024)throw Error('Metadata file is too large');sources.push({name:file.name,text:await file.text()});}
    metadataCommit(sources);
  }catch(err){toast(`Metadata import failed: ${err.message}`,true);}
});
const upstreamPin='3044393183e01af2ae1e907fb37e4a75eda6a8dc';
$('metadata-stock').addEventListener('click',async()=>{
  try{
    ensureModel();
    // Select the upstream metadata by exact game code AND revision. Unknown revisions are not guessed.
    const {identity,files:names}=resolveHmaStockMetadata(model);
    const code=identity.code;
    if(!await confirmAction('Load stock-game metadata?',`Reference offsets are for stock ${code} ROMs, not necessarily your modified ROM or CUBE. This lookup is read-only. Continue?`))return;
    $('metadata-stock').disabled=true;
    const sources=[];
    for(const name of names){
      const url=`https://raw.githubusercontent.com/kcradi/CUBHMA/${upstreamPin}/src/HexManiac.Core/Models/Code/${name}`;
      const response=await fetch(url,{cache:'force-cache'});
      if(!response.ok)throw Error(`${name} download failed (HTTP ${response.status}). Import files manually if offline.`);
      sources.push({name:`${name} (upstream ${upstreamPin.slice(0,8)})`,text:await response.text()});
    }
    metadataCommit(sources);
  }catch(err){toast(`Stock metadata: ${err.message}`,true);}finally{$('metadata-stock').disabled=false;}
});

updateIndicators();drawGraphics();drawAnchors();renderTab(routeFromHash());
