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
