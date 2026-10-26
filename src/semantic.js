/** CUBHMA TOML named-anchor discovery.
 * Provenance: HMA/CUBHMA uses [[NamedAnchors]] records in its TOML metadata.
 * This parser deliberately reads only Name, Address and Format: it cannot safely
 * reinterpret HMA's full format DSL, repoint data, or edit semantic tables.
 */
const maxMetadataSize=4*1024*1024;
const maxRecords=50000;
function tomlString(value){
  const v=value.trim();
  if(v.startsWith("'''")){const end=v.indexOf("'''",3);return end>=3?v.slice(3,end):null;}
  if(v.startsWith('"""')){const end=v.indexOf('"""',3);return end>=3?v.slice(3,end):null;}
  if(v[0]==='"'||v[0]==="'"){const quote=v[0],end=v.indexOf(quote,1);return end>0?v.slice(1,end):null;}
  return v.split(/\s+#/)[0].trim();
}
function tomlInt(input){
  const v=input.trim().replace(/_/g,'');
  if(/^0x[0-9a-f]+$/i.test(v))return parseInt(v,16);
  if(/^-?[0-9]+$/.test(v))return Number(v);
  return NaN;
}
export function parseHmaNamedAnchors(source,{romSize=Infinity}={}){
  if(typeof source!=='string'||source.length>maxMetadataSize)throw Error('Metadata must be TOML text under 4 MiB');
  if(!(romSize>=0))throw Error('Invalid ROM length');
  const list=[],lines=source.replace(/^\uFEFF/,'').split(/\r?\n/);
  let section='',current=null;
  const flush=()=>{
    if(!current)return;
    const {name,address,format,line}=current;
    if(name&&Number.isSafeInteger(address)&&address>=0){
      list.push({name,address,format:format||'',line,valid:address<romSize});
      if(list.length>maxRecords)throw Error('Too many named anchors');
    }
    current=null;
  };
  for(let i=0;i<lines.length;i++){
    const l=lines[i].trim();
    if(/^\[\[/.test(l)){
      flush();const match=/^\[\[\s*([^\]]+)\s*\]\]/.exec(l);section=match?.[1]?.trim()||'';
      if(section==='NamedAnchors')current={name:'',address:NaN,format:'',line:i+1};
      continue;
    }
    if(/^\[/.test(l)){flush();section='';continue;}
    if(section!=='NamedAnchors'||!current||l.startsWith('#'))continue;
    const m=/^(Name|Address|Format)\s*=\s*(.+)$/.exec(l);
    if(!m)continue;
    if(m[1]==='Address')current.address=tomlInt(m[2]);
    else {const value=tomlString(m[2]);if(value!==null){if(m[1]==='Name')current.name=value;else current.format=value;}}
  }
  flush();
  return list;
}
export function readAnchorInspection(bytes,anchor){
  const readable=bytes instanceof Uint8Array ? i=>bytes[i] : (typeof bytes?.read==='function' ? i=>bytes.read(i) : null);
  if(!readable||!anchor||!Number.isInteger(anchor.address))throw Error('Invalid ROM/anchor');
  const start=anchor.address;if(start<0||start>=bytes.length)throw Error('Anchor outside the selected ROM');
  const view=Uint8Array.from({length:Math.min(64,bytes.length-start)},(_,i)=>readable(start+i));
  const word=(offset,len)=>offset+len<=bytes.length?Array.from({length:len},(_,i)=>readable(offset+i)).reduce((acc,b,i)=>acc+b*2**(i*8),0):null;
  const ptr=word(start,4);
  const romAddress=ptr!==null && ptr>=0x08000000 && ptr<0x0A000000 ? ptr-0x08000000 : null;
  const pointerValid=romAddress!==null&&romAddress<bytes.length;
  return {
    address:start,format:anchor.format,
    bytes:view,byte:readable(start),u16:word(start,2),u32:ptr,
    pointer: pointerValid?romAddress:null,
    pointerCandidate:romAddress!==null&&!pointerValid,
    preview: Array.from(view).map(x=>x>=32&&x<=126?String.fromCharCode(x):'.').join(''),
    isLz10:view[0]===0x10&&view.length>=4,
  };
}
export function groupAnchors(anchors){
  const counts=new Map();
  anchors.forEach(a=>{const k=a.name.split('.')[0]||'Other';counts.set(k,(counts.get(k)||0)+1);});
  return [...counts].sort((a,b)=>b[1]-a[1]);
}
export function filterAnchors(anchors,search='',category='all',limit=180){
  const q=search.trim().toLowerCase();
  return anchors.filter(a=>(category==='all'||a.name.split('.')[0]===category)&&(!q||a.name.toLowerCase().includes(q)||a.format.toLowerCase().includes(q))).slice(0,limit);
}


/**
 * Conservative, read-only subset of CUBHMA ArrayRun's fixed-length table grammar.
 * Source: kcradi/CUBHMA @ 3044393183e01af2ae1e907fb37e4a75eda6a8dc,
 * src/HexManiac.Core/Models/Runs/ArrayRun.cs (ParseSegments / ExtractSingleFormat).
 *
 * This is NOT a replacement for ArrayRun. Dynamic lengths, nested structures,
 * enums, bit arrays, pointers to typed data and text decoding need the upstream
 * model and are intentionally not interpreted here. Unknown tokens fail closed.
 */
export function parseHmaFixedTableFormat(format){
  if(typeof format!=='string')return null;
  const match=/^\[([^\[\]]+)\]([1-9][0-9]*)$/.exec(format.trim());
  if(!match)return null;
  const count=Number(match[2]);
  if(!Number.isSafeInteger(count)||count>1000000)return null;
  const fields=[];
  let rowSize=0;
  for(const token of match[1].trim().split(/\s+/)){
    const field=/^([A-Za-z_][A-Za-z_0-9.]*)(::|:\.|\.[:]|:|\.|""[1-9][0-9]*|<[^<>]*>)([A-Za-z_0-9.|]*)$/.exec(token);
    if(!field)return null;
    const [,name,marker,suffix]=field;
    if(fields.some(f=>f.name===name))return null;
    let type='integer',size;
    if(marker==='.')size=1;
    else if(marker===':')size=2;
    else if(marker===':.'||marker==='.:')size=3;
    else if(marker==='::')size=4;
    else if(marker.startsWith('""')){type='text-bytes';size=Number(marker.slice(2));}
    else {type='pointer';size=4;}
    if(type==='integer'){
      // HMA supports enum names and a hexadecimal display flag (|h), but this
      // preview reports the underlying unsigned scalar only.
      if(suffix && !/^(?:[A-Za-z_0-9.]+)?(?:\|h)?$/.test(suffix))return null;
    }else if(suffix)return null;
    if(!Number.isSafeInteger(size)||size<1||size>1000)return null;
    if(rowSize+size>1024)return null;
    fields.push({name,type,size,offset:rowSize});rowSize+=size;
  }
  if(!fields.length||rowSize*count>Number.MAX_SAFE_INTEGER)return null;
  return {fields,rowSize,count,totalBytes:rowSize*count};
}

/** Read at most a few rows; never materialize or copy the entire ROM. */
export function previewHmaFixedTable(bytes,anchor,{maxRows=8}={}){
  const layout=parseHmaFixedTableFormat(anchor?.format);
  if(!layout)return null;
  const read=bytes instanceof Uint8Array ? i=>bytes[i] : (typeof bytes?.read==='function'?i=>bytes.read(i):null);
  if(!read||!Number.isSafeInteger(bytes?.length)||!Number.isSafeInteger(anchor?.address))throw Error('Invalid ROM/anchor');
  if(anchor.address<0||anchor.address>bytes.length||layout.totalBytes>bytes.length-anchor.address)throw Error('Table extends beyond the selected ROM; preview refused');
  if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>32)throw Error('Invalid table preview limit');
  const rows=[];
  for(let index=0;index<Math.min(layout.count,maxRows);index++){
    const offset=anchor.address+index*layout.rowSize;
    const cells=layout.fields.map(field=>{
      const start=offset+field.offset;
      if(field.type==='text-bytes'){
        const raw=Array.from({length:field.size},(_,i)=>read(start+i));
        return {name:field.name,type:field.type,value:raw.map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' ')};
      }
      let value=0;
      for(let i=0;i<field.size;i++)value+=read(start+i)*2**(8*i);
      if(field.type==='pointer'){
        const target=value>=0x08000000&&value<0x0A000000?value-0x08000000:null;
        return {name:field.name,type:field.type,value:`0x${value.toString(16).toUpperCase().padStart(8,'0')}`,target:target!==null&&target<bytes.length?target:null};
      }
      return {name:field.name,type:field.type,value};
    });
    rows.push({index,offset,cells});
  }
  return {...layout,rows,truncated:rows.length<layout.count};
}



/**
 * Read only [[OffsetPointer]] records from HMA TOML.
 * Upstream PokemonModel.ReadPointer(source) subtracts the metadata Offset from
 * the stored GBA pointer; this is NOT a byte location offset to scan.
 * A missing/ambiguous record fails closed rather than silently guessing.
 */
export function parseHmaOffsetPointers(source,{romSize=Infinity}={}){
  if(typeof source!=='string'||source.length>maxMetadataSize)throw Error('Metadata must be TOML text under 4 MiB');
  if(!(Number.isSafeInteger(romSize)||romSize===Infinity)||romSize<0)throw Error('Invalid ROM length');
  const lines=source.replace(/^\uFEFF/,'').split(/\r?\n/);
  const records=[];let current=null;
  const finish=()=>{
    if(!current)return;
    if(!Number.isSafeInteger(current.address)||current.address<0||
       !Number.isSafeInteger(current.offset)||current.offset<-0x80000000||current.offset>0x7FFFFFFF)
      throw Error('Malformed OffsetPointer record at TOML line '+current.line);
    records.push({address:current.address,offset:current.offset,line:current.line,
      valid:current.address<=romSize-4});
    if(records.length>maxRecords)throw Error('Too many offset pointer records');
    current=null;
  };
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(/^\[\[/.test(line)){
      finish();
      const match=/^\[\[\s*([^\]]+)\s*\]\]/.exec(line);
      if(match?.[1]?.trim()==='OffsetPointer')current={line:i+1,address:NaN,offset:NaN};
      continue;
    }
    if(/^\[/.test(line)){finish();continue;}
    if(!current||line.startsWith('#'))continue;
    const match=/^(Address|Offset)\s*=\s*(.+)$/.exec(line);
    if(!match)continue;
    const raw=match[2].split(/\s+#/)[0].trim();
    let value=tomlInt(raw);
    if(match[1]==='Offset'&&/^0x[0-9a-f]{1,8}$/i.test(raw)&&value>=0x80000000)
      value-=0x100000000;
    if(match[1]==='Address')current.address=value;
    else current.offset=value;
  }
  finish();
  return records;
}

/** Read-only ROM-version guard for stock HMA metadata.
 * Source file names are pinned to kcradi/CUBHMA 3044393183e01af2.
 * Header identification cannot prove that a ROM is stock or identify CUBE.
 */
const HMA_STOCK_PROFILES=Object.freeze({
  BPEE:{0:['default.toml','default.axve.axpe.bpee.toml','default.bpee.toml']},
  BPRE:{0:['default.toml','default.bpre.bpge.toml','default.bpre0.toml'],1:['default.toml','default.bpre.bpge.toml','default.bpre1.toml']},
  BPGE:{0:['default.toml','default.bpre.bpge.toml','default.bpge0.toml'],1:['default.toml','default.bpre.bpge.toml','default.bpge1.toml']},
  AXVE:{0:['default.toml','default.axve.axpe.toml','default.axve0.axpe0.toml'],1:['default.toml','default.axve.axpe.toml','default.axve1.axpe1.toml']},
  AXPE:{0:['default.toml','default.axve.axpe.toml','default.axve0.axpe0.toml'],1:['default.toml','default.axve.axpe.toml','default.axve1.axpe1.toml']},
});
export function identifyHmaRom(bytes){
  const read=bytes instanceof Uint8Array?i=>bytes[i]:typeof bytes?.read==='function'?i=>bytes.read(i):null;
  if(!read||!Number.isSafeInteger(bytes.length)||bytes.length<0xC0)throw Error('Invalid GBA ROM for metadata identification');
  const code=Array.from({length:4},(_,i)=>String.fromCharCode(read(0xAC+i))).join('');
  const revision=read(0xBC);
  let sum=0;for(let i=0xA0;i<=0xBC;i++)sum=(sum+read(i))&255;
  const headerValid=read(0xB2)===0x96&&read(0xBD)===((0x19-sum)&255);
  return {code,revision,headerValid,knownGame:/^[A-Z0-9]{4}$/.test(code)&&Object.hasOwn(HMA_STOCK_PROFILES,code)};
}
export function resolveHmaStockMetadata(bytes){
  const identity=identifyHmaRom(bytes);
  if(!identity.headerValid)throw Error('GBA header validation failed; refusing automatic stock metadata selection');
  const files=HMA_STOCK_PROFILES[identity.code]?.[identity.revision];
  if(!files)throw Error('No verified stock metadata profile for '+identity.code+' revision '+identity.revision);
  return {identity,files:[...files],verifiedStock:false};
}
/** Detect a *known wrong* upstream stock TOML; unknown custom files stay read-only and unverified. */
export function checkHmaMetadataSources(sources,bytes){
  if(!Array.isArray(sources))throw Error('Expected metadata source list');
  const identity=identifyHmaRom(bytes);
  const expected=HMA_STOCK_PROFILES[identity.code]?.[identity.revision]||[];
  const known=new Set([...Object.values(HMA_STOCK_PROFILES).flatMap(byRev=>Object.values(byRev).flat()),
    'default.bpef.toml','default.bpei0.toml','default.bpri.toml','default.bprf0.toml']);
  const checked=[];
  for(const source of sources){
    const filename=String(source?.name||'').split(/[\\/]/).pop().replace(/\s+\(upstream [^)]+\)$/i,'').toLowerCase();
    if(!filename)throw Error('Unnamed metadata source');
    if(known.has(filename)){
      if(!identity.headerValid)throw Error('Cannot validate stock metadata '+filename+': invalid ROM header');
      if(!expected.includes(filename))throw Error('Metadata '+filename+' is incompatible with '+identity.code+' revision '+identity.revision);
      checked.push({filename,kind:'stock-reference'});
    }else checked.push({filename,kind:'unverified-custom'});
  }
  return {identity,sources:checked,warning:'ROM header and filenames cannot authenticate edited ROM layouts or CUBE versions; semantic data is read-only.'};
}


/**
 * Bounded read-only pointer cross-reference inspection.
 * CUBHMA's actual run ownership needs full formatted-run tracking and metadata
 * reconciliation. This identifies ONLY typed pointer slots in the supported
 * fixed-table subset. Raw 4-byte matches are labeled unverified candidates,
 * never as authoritative owners or safe sources for repointing.
 */
export function inspectHmaPointerReferences(bytes,target,anchors,{
  maxTableSlots=120000,maxDeclared=32,maxCandidates=24,maxScanBytes=8*1024*1024,offsetPointers=[]
}={}){
  const read=bytes instanceof Uint8Array?i=>bytes[i]:typeof bytes?.read==='function'?i=>bytes.read(i):null;
  if(!read||!Number.isSafeInteger(bytes?.length)||bytes.length<1)throw Error('Invalid ROM for reference inspection');
  if(!Number.isSafeInteger(target)||target<0||target>=bytes.length||target>=0x02000000)
    throw Error('Target is not a representable in-ROM GBA pointer offset');
  if(!Array.isArray(anchors)||anchors.length>50000)throw Error('Invalid or excessive anchor metadata');
  if(!Array.isArray(offsetPointers)||offsetPointers.length>50000)throw Error('Invalid or excessive offset pointer metadata');
  for(const [name,value,min,max] of [
    ['maxTableSlots',maxTableSlots,1,1000000],['maxDeclared',maxDeclared,1,128],
    ['maxCandidates',maxCandidates,0,128],['maxScanBytes',maxScanBytes,0,128*1024*1024]
  ])if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Invalid reference scan limit: '+name);
  const read32=at=>(read(at)|(read(at+1)<<8)|(read(at+2)<<16)|(read(at+3)<<24))>>>0;
  const needle=0x08000000+target;
  const declared=[],knownSlots=new Set();
  let examinedSlots=0,skippedTables=0,matchedDeclared=0,unsupportedFormats=0;
  for(const anchor of anchors){
    if(!anchor||!Number.isSafeInteger(anchor.address))continue;
    const layout=parseHmaFixedTableFormat(anchor.format);
    if(!layout){if(typeof anchor.format==='string'&&anchor.format.startsWith('['))unsupportedFormats++;continue;}
    const pointerFields=layout.fields.filter(field=>field.type==='pointer');
    if(!pointerFields.length)continue;
    if(anchor.address<0||anchor.address>bytes.length||layout.totalBytes>bytes.length-anchor.address){skippedTables++;continue;}
    const slots=layout.count*pointerFields.length;
    if(slots>maxTableSlots-examinedSlots){skippedTables++;continue;}
    examinedSlots+=slots;
    for(let row=0;row<layout.count;row++){
      const base=anchor.address+row*layout.rowSize;
      for(const field of pointerFields){
        const source=base+field.offset;
        if(read32(source)!==needle)continue;
        // Overlapping/duplicate metadata can describe the same physical slot.
        if(knownSlots.has(source))continue;
        knownSlots.add(source);matchedDeclared++;
        if(declared.length<maxDeclared)
          declared.push({source,kind:'typed-table',table:anchor.name,row,field:field.name});
      }
    }
  }
  // Explicit OffsetPointer sources: HMA decodes target as raw ROM pointer
  // minus Offset. Conflicting declarations for the same source are ambiguous.
  const offsetBySource=new Map();
  let skippedOffsetPointers=0,examinedOffsetPointers=0;
  for(const record of offsetPointers){
    if(!record||!Number.isSafeInteger(record.address)||
       !Number.isSafeInteger(record.offset)||record.offset<-0x80000000||record.offset>0x7FFFFFFF)
      throw Error('Malformed offset pointer metadata');
    const old=offsetBySource.get(record.address);
    if(old!==undefined&&old!==record.offset)
      throw Error('Conflicting offset pointer metadata at 0x'+record.address.toString(16));
    offsetBySource.set(record.address,record.offset);
  }
  for(const [source,offset] of offsetBySource){
    if(source<0||source>bytes.length-4){skippedOffsetPointers++;continue;}
    if(examinedSlots+examinedOffsetPointers>=maxTableSlots){skippedOffsetPointers++;continue;}
    examinedOffsetPointers++;
    const raw=read32(source);
    // HMA BaseModel.ReadPointer validates a conventional GBA pointer first.
    if(raw<0x08000000||raw>=0x0A000000)continue;
    const decoded=raw-0x08000000-offset;
    if(decoded!==target)continue;
    if(knownSlots.has(source))continue;
    knownSlots.add(source);matchedDeclared++;
    if(declared.length<maxDeclared)
      declared.push({source,kind:'offset-pointer',offset});
  }
  // Conventional four-byte aligned byte matches are not proven pointers.
  // Only the first bounded portion is scanned, explicitly reflected in output.
  const span=Math.min(bytes.length,maxScanBytes);
  const candidates=[];let candidateHits=0;
  for(let i=0;i+4<=span;i+=4){
    if(knownSlots.has(i)||read32(i)!==needle)continue;
    candidateHits++;
    if(candidates.length<maxCandidates)candidates.push({source:i,kind:'raw-candidate'});
  }
  return {
    target,declared,candidates,matchedDeclared,candidateHits,
    examinedSlots,skippedTables,unsupportedFormats,examinedOffsetPointers,skippedOffsetPointers,scannedBytes:span,
    rawScanComplete:span===bytes.length,scanAlignment:4,
    declaredTruncated:matchedDeclared>declared.length,candidatesTruncated:candidateHits>candidates.length,
    disclaimer:'Typed-table and OffsetPointer matches rely on unverified metadata; raw candidates are only aligned byte-pattern matches. Neither proves ownership or permits safe repointing.'
  };
}
