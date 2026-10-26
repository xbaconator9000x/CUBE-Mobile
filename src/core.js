/* CUBHMA Mobile Lab: independent, data-only GBA ROM primitives. No upstream code bundled. */
export const MAX_BYTES = 128 * 1024 * 1024;
export const hex = (n, digits=6) => (Number(n) >>> 0).toString(16).toUpperCase().padStart(digits, '0');
export function parseOffset(text, { allowPointer=true }={}) {
  let s=String(text).trim().replace(/[_\s]/g,'');
  if (!s) throw Error('Enter an offset');
  let n;
  if (/^0x[0-9a-f]+$/i.test(s)) n=parseInt(s.slice(2),16);
  else if (/^[0-9a-f]+h$/i.test(s)) n=parseInt(s.slice(0,-1),16);
  else if (/^[0-9a-f]+$/i.test(s)) n=parseInt(s,16); // editor offsets are hexadecimal
  else throw Error('Offsets must be hexadecimal (example: 1A2B or 0x08001A2B)');
  if (!Number.isSafeInteger(n)) throw Error('Offset too large');
  if (allowPointer && n>=0x08000000 && n < 0x0A000000) n-=0x08000000;
  return n;
}
export function parseHexBytes(str){
  let s=String(str).trim().replace(/(?:0x)/gi,'').replace(/[\s,_-]/g,'');
  if(!s || !/^[0-9a-f]+$/i.test(s) || s.length%2) throw Error('Enter complete hexadecimal byte pairs, e.g. 12 AB 00');
  if(s.length>8192) throw Error('Search pattern too long');
  return Uint8Array.from(s.match(/../g), x=>parseInt(x,16));
}
export function gbaHeader(data){
  if(!(data instanceof Uint8Array) || data.length<0xC0) throw Error('Not enough bytes for a GBA header');
  const ascii=(from,len)=>Array.from(data.subarray(from,from+len)).map(c=>c>=32&&c<=126?String.fromCharCode(c):'?').join('').replace(/\?+$/,'').trim();
  const title=ascii(0xA0,12), code=ascii(0xAC,4);
  const family=code.startsWith('BPR')?'FireRed family':code.startsWith('BPG')?'LeafGreen family':code.startsWith('BPE')?'Emerald family':code.startsWith('AXV')?'Ruby family':code.startsWith('AXP')?'Sapphire family':'Unknown or custom';
  let sum=0; for(let i=0xA0;i<=0xBC;i++) sum=(sum+data[i])&255;
  const expected=(0x19-sum)&255;
  return {title:title||'Untitled',code:code||'????',family,expected,stored:data[0xBD],fixedValid:data[0xB2]===0x96,checksumValid:expected===data[0xBD],size:data.length};
}
const crcTable=(()=>{ const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);table[i]=c>>>0;}return table;})();
export function crc32(data,start=0,end=data.length) {
  let c=0xFFFFFFFF;for(let i=start;i<end;i++)c=crcTable[(c^data[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;
}
const read32=(data,o)=>((data[o]|(data[o+1]<<8)|(data[o+2]<<16)|(data[o+3]<<24))>>>0);
function bpsVar(data, state, end){
  let value=0, shift=1;
  for(let i=0;i<12;i++){
    if(state.pos>=end)throw Error('Truncated BPS instruction');
    const b=data[state.pos++]; const term=(b&127)*shift;
    if(!Number.isSafeInteger(term+value))throw Error('BPS varint overflow');
    value+=term;
    if(b&128)return value;
    shift*=128;value+=shift;
    if(!Number.isSafeInteger(value))throw Error('BPS varint overflow');
  }
  throw Error('BPS varint too long');
}
function bpsSigned(data,state,end){let n=bpsVar(data,state,end);return (n&1)?-Math.floor(n/2):Math.floor(n/2);}
export function applyBps(source,patch){
  if(!(source instanceof Uint8Array) || !(patch instanceof Uint8Array))throw Error('Expected binary ROM and patch');
  if(patch.length<19 || String.fromCharCode(...patch.subarray(0,4))!=='BPS1')throw Error('Not a BPS1 patch');
  const end=patch.length-12;
  if(crc32(patch,0,patch.length-4)!==read32(patch,patch.length-4))throw Error('BPS patch CRC mismatch');
  if(crc32(source)!==read32(patch,patch.length-12))throw Error('BPS source CRC mismatch: wrong base ROM');
  const state={pos:4}; const srcLen=bpsVar(patch,state,end),outLen=bpsVar(patch,state,end),metaLen=bpsVar(patch,state,end);
  if(srcLen!==source.length)throw Error('BPS source size mismatch');
  if(outLen<0xC0 || outLen>MAX_BYTES)throw Error('Target ROM exceeds safe size limits');
  if(metaLen<0 || state.pos+metaLen>end)throw Error('BPS metadata truncated');
  state.pos+=metaLen;
  const out=new Uint8Array(outLen); let cursor=0, sourceRel=0, targetRel=0;
  while(cursor<out.length){
    const action=bpsVar(patch,state,end),kind=action%4,count=Math.floor(action/4)+1;
    if(count>out.length-cursor)throw Error('BPS instruction exceeds target');
    if(kind===0){
      if(cursor+count>source.length)throw Error('BPS source read exceeds ROM');
      out.set(source.subarray(cursor,cursor+count),cursor);
    }else if(kind===1){
      if(state.pos+count>end)throw Error('Truncated BPS literal');
      out.set(patch.subarray(state.pos,state.pos+count),cursor);state.pos+=count;
    }else if(kind===2){
      sourceRel+=bpsSigned(patch,state,end);
      if(!Number.isSafeInteger(sourceRel)||sourceRel<0||sourceRel+count>source.length)throw Error('BPS source copy out of bounds');
      out.set(source.subarray(sourceRel,sourceRel+count),cursor);sourceRel+=count;
    }else{
      targetRel+=bpsSigned(patch,state,end);
      if(!Number.isSafeInteger(targetRel)||targetRel<0||targetRel>=cursor)throw Error('BPS target copy out of bounds');
      for(let j=0;j<count;j++){
        if(targetRel+j>=cursor+j)throw Error('Invalid BPS target copy');
        out[cursor+j]=out[targetRel+j];
      }
      targetRel+=count;
    }
    cursor+=count;
  }
  if(state.pos!==end)throw Error('Extra BPS instructions after target');
  if(crc32(out)!==read32(patch,patch.length-8))throw Error('BPS target CRC mismatch');
  return out;
}
export function applyIps(source,patch){
  if(!(source instanceof Uint8Array)||!(patch instanceof Uint8Array))throw Error('Expected binary data');
  if(patch.length<8 || String.fromCharCode(...patch.subarray(0,5))!=='PATCH')throw Error('Not an IPS patch');
  let p=5; const records=[]; let required=source.length,truncate=null;
  while(true){
    if(p+3>patch.length)throw Error('Missing IPS EOF');
    if(patch[p]===69&&patch[p+1]===79&&patch[p+2]===70){p+=3;break;}
    if(p+5>patch.length)throw Error('Truncated IPS record');
    const off=patch[p]*65536+patch[p+1]*256+patch[p+2],len=patch[p+3]*256+patch[p+4];p+=5;
    if(len===0){
      if(p+3>patch.length)throw Error('Truncated IPS RLE');
      const count=patch[p]*256+patch[p+1],value=patch[p+2];p+=3;
      if(off+count>MAX_BYTES)throw Error('IPS writes past max ROM size');
      records.push({off,len:count,value});required=Math.max(required,off+count);
    } else {
      if(p+len>patch.length)throw Error('Truncated IPS bytes');
      if(off+len>MAX_BYTES)throw Error('IPS writes past max ROM size');
      records.push({off,len,bytes:patch.subarray(p,p+len)});p+=len;required=Math.max(required,off+len);
    }
  }
  if(p!==patch.length){
    if(p+3!==patch.length)throw Error('Unexpected data after IPS EOF');
    truncate=patch[p]*65536+patch[p+1]*256+patch[p+2];
    if(truncate<0xC0 || truncate>MAX_BYTES)throw Error('Invalid IPS truncate size');
    if(required>truncate && records.some(r=>r.off+r.len>truncate))throw Error('IPS record exceeds truncation size');
    required=truncate;
  }
  const out=new Uint8Array(required);out.set(source.subarray(0,required));
  for(const r of records){if(r.bytes)out.set(r.bytes,r.off);else out.fill(r.value,r.off,r.off+r.len);}
  return out;
}
export function buildIps(edits, original){
  if(!edits.size)throw Error('No edits to export');
  const sorted=[...edits.entries()].sort((a,b)=>a[0]-b[0]);
  if(sorted.at(-1)[0]>0xFFFFFF)throw Error('IPS cannot encode changes past 16 MiB; save a ROM copy');
  const output=[80,65,84,67,72];let i=0;
  while(i<sorted.length){
    let start=sorted[i][0],data=[];
    if(start===0x454F46){start--;data.push(original[start]);}
    let expected=start+data.length;
    while(i<sorted.length && sorted[i][0]===expected && data.length<65535){data.push(sorted[i][1]);i++;expected++;}
    if(!data.length)throw Error('Invalid IPS range');
    output.push((start>>>16)&255,(start>>>8)&255,start&255,(data.length>>>8)&255,data.length&255,...data);
  }
  output.push(69,79,70);return Uint8Array.from(output);
}
export function bgr555(value){
  const r=value&31,g=(value>>>5)&31,b=(value>>>10)&31;
  const up=n=>(n<<3)|(n>>>2);
  return {r:up(r),g:up(g),b:up(b),css:`rgb(${up(r)},${up(g)},${up(b)})`};
}
export function paletteAt(bytes,offset){
  if(offset<0||offset+32>bytes.length)throw Error('Palette needs 32 bytes at this offset');
  return Array.from({length:16},(_,i)=>{const v=bytes[offset+i*2]|(bytes[offset+i*2+1]<<8);return {...bgr555(v),value:v};});
}
/** GBA BIOS LZ77 (0x10) decompression. Bounded to avoid untrusted-ROM zip bombs. */
export const MAX_GRAPHIC_BYTES = 512 * 1024;
export function decodeLz10(bytes, offset=0, {maxOutput=MAX_GRAPHIC_BYTES}={}) {
  if (!(bytes instanceof Uint8Array)) throw Error('Expected ROM bytes');
  if (!Number.isInteger(offset) || offset < 0 || offset + 4 > bytes.length) throw Error('LZ77 header outside ROM');
  if (bytes[offset] !== 0x10) throw Error('Not a GBA LZ77 (0x10) stream at this offset');
  const size = bytes[offset+1] | (bytes[offset+2] << 8) | (bytes[offset+3] << 16);
  if (!size || size > maxOutput) throw Error(`LZ77 output must be 1–${maxOutput} bytes`);
  const output = new Uint8Array(size);
  let ip=offset+4, op=0;
  while (op < size) {
    if (ip >= bytes.length) throw Error('Truncated LZ77 flags');
    const flags=bytes[ip++];
    for (let bit=7;bit>=0 && op<size;bit--) {
      if (flags & (1<<bit)) {
        if (ip+2>bytes.length) throw Error('Truncated LZ77 back-reference');
        const b0=bytes[ip++],b1=bytes[ip++];
        const count=(b0>>>4)+3, distance=(((b0&15)<<8)|b1)+1;
        if (distance>op) throw Error('Invalid LZ77 back-reference before beginning');
        if (op+count>size) throw Error('LZ77 back-reference exceeds output length');
        for (let j=0;j<count;j++) {output[op]=output[op-distance];op++;}
      } else {
        if (ip>=bytes.length) throw Error('Truncated LZ77 literal');
        output[op++]=bytes[ip++];
      }
    }
  }
  return {data:output,consumed:ip-offset};
}
/** Scan one bounded ROM interval for syntactically valid LZ77 tile candidates.
 * Not a sprite classifier: a decoded 4bpp-looking stream can still be non-graphic data.
 */
export function scanLz10Graphics(bytes, {start=0,end=bytes.length,maxResults=128,minBytes=256,maxBytes=MAX_GRAPHIC_BYTES}={}) {
  if (!(bytes instanceof Uint8Array)) throw Error('Expected ROM bytes');
  if (!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>bytes.length) throw Error('Invalid scan region');
  const matches=[];
  for (let offset=start;offset<Math.min(end,bytes.length-3);offset++) {
    if(bytes[offset]!==0x10)continue;
    const size=bytes[offset+1]|(bytes[offset+2]<<8)|(bytes[offset+3]<<16);
    if(size<minBytes||size>maxBytes||size%32!==0)continue;
    try {
      const {consumed}=decodeLz10(bytes,offset,{maxOutput:maxBytes});
      matches.push({offset,size,compressedBytes:consumed,tileCount:size/32});
      if(matches.length>=maxResults)break;
    }catch(_){ /* A 0x10 byte is not sufficient evidence of a valid stream. */ }
  }
  return matches;
}
export function gba4bppTile(bytes,tileOffset,palette){
  if(tileOffset<0 || tileOffset+32>bytes.length)throw Error('Tile needs 32 bytes');
  const pixels=new Uint8Array(64);
  for(let i=0;i<32;i++){pixels[i*2]=bytes[tileOffset+i]&15;pixels[i*2+1]=bytes[tileOffset+i]>>>4;}
  return pixels;
}
export class RomModel {
  constructor(name,data){
    if(!(data instanceof Uint8Array)||data.length<0xC0||data.length>MAX_BYTES)throw Error('ROM must be 192 bytes to 128 MiB');
    this.name=String(name||'game.gba');this.original=data.slice();this.base=data.slice();this.edits=new Map();this.undoStack=[];this.redoStack=[];this.appliedPatch=false;
    this.originCrc=crc32(this.original);this.baseCrc=this.originCrc;
  }
  get length(){return this.base.length;}
  get dirty(){return this.edits.size>0 || this.appliedPatch;}
  read(pos){if(pos<0||pos>=this.base.length)throw Error('Offset beyond ROM');return this.edits.has(pos)?this.edits.get(pos):this.base[pos];}
  hasEdit(pos){return this.edits.has(pos);}
  _write(pos,val){if(val===this.base[pos])this.edits.delete(pos);else this.edits.set(pos,val);}
  write(pos,value){
    if(!Number.isInteger(pos)||pos<0||pos>=this.length)throw Error('Offset outside ROM');
    if(!Number.isInteger(value)||value<0||value>255)throw Error('Byte must be between 00 and FF');
    const before=this.read(pos);if(before===value)return false;
    this._write(pos,value);this.undoStack.push({pos,before,after:value});if(this.undoStack.length>5000)this.undoStack.shift();this.redoStack=[];return true;
  }
  undo(){const e=this.undoStack.pop();if(!e)return false;this._write(e.pos,e.before);this.redoStack.push(e);return true;}
  redo(){const e=this.redoStack.pop();if(!e)return false;this._write(e.pos,e.after);this.undoStack.push(e);return true;}
  discardEdits(){this.edits.clear();this.undoStack=[];this.redoStack=[];}
  reset(){this.base=this.original.slice();this.baseCrc=this.originCrc;this.appliedPatch=false;this.discardEdits();}
  snapshot(){const out=this.base.slice();for(const [i,v] of this.edits)out[i]=v;return out;}
  switchPatched(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length<0xC0||bytes.length>MAX_BYTES)throw Error('Invalid patched ROM');
    this.base=bytes.slice();this.baseCrc=crc32(this.base);this.appliedPatch=true;this.discardEdits();
  }
  find(pattern,starting=0){
    if(!pattern.length)throw Error('Search for at least one byte');
    const size=this.length;
    for(let p=Math.max(0,starting);p<=size-pattern.length;p++){
      if(this.read(p)!==pattern[0])continue;
      let good=true;for(let j=1;j<pattern.length;j++){if(this.read(p+j)!==pattern[j]){good=false;break;}}
      if(good)return p;
    }
    return -1;
  }
  fillList(start,count){
    const rows=[];for(let i=start;i<Math.min(this.length,start+count);i++){rows.push({offset:i,byte:this.read(i),edited:this.hasEdit(i)});}return rows;
  }
  header(){const data=this.base.slice(0,0xC0);for(const [i,v] of this.edits){if(i<0xC0)data[i]=v;}return {...gbaHeader(data),size:this.length};}
  fixHeader(){const checksum=this.header().expected;this.write(0xBD,checksum);return checksum;}
  exportIps(){if(this.appliedPatch)throw Error('After applying a patch, save a ROM copy first. IPS export only covers raw edits on an unpatched ROM');return buildIps(this.edits,this.base);}
  project(){
    return {format:'cubhma-mobile-lab',version:1,fileName:this.name,originalSize:this.original.length,originalCrc32:hex(this.originCrc,8),baseCrc32:hex(this.baseCrc,8),patchApplied:this.appliedPatch,edits:[...this.edits.entries()].sort((a,b)=>a[0]-b[0]).map(([offset,value])=>[offset,value])};
  }
  loadProject(project){
    if(!project||project.format!=='cubhma-mobile-lab'||project.version!==1)throw Error('Unrecognised project format');
    if(project.patchApplied)throw Error('This sidecar references a patched ROM. Reopen the saved patched ROM before importing a sidecar');
    if(this.appliedPatch)throw Error('Reset or reload an unpatched ROM before restoring a sidecar');
    if(project.originalSize!==this.length||project.originalCrc32!==hex(this.originCrc,8)||project.baseCrc32!==hex(this.baseCrc,8))throw Error('ROM CRC or size differs from project. No changes imported');
    if(!Array.isArray(project.edits)||project.edits.length>1000000)throw Error('Invalid project edit list');
    const newEdits=new Map();
    for(const e of project.edits){
      if(!Array.isArray(e)||e.length!==2||!Number.isInteger(e[0])||e[0]<0||e[0]>=this.length||!Number.isInteger(e[1])||e[1]<0||e[1]>255)throw Error('Invalid edit in project; nothing imported');
      if(newEdits.has(e[0]))throw Error('Duplicate project edit; nothing imported');
      if(e[1]!==this.base[e[0]])newEdits.set(e[0],e[1]);
    }
    this.discardEdits();this.edits=newEdits;
    return newEdits.size;
  }
}
