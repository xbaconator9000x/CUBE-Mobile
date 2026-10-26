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

/**
 * Merge TOML anchor records without hiding contradictory declarations.
 * Identical declarations may be de-duplicated; differing address/format for
 * one name remain visible so resolveHmaTableLayouts can reject that name.
 * CUBHMA's metadata overlay precedence is not implemented or authenticated.
 */
export function collectHmaNamedAnchors(sources,{romSize=Infinity}={}){
  if(!Array.isArray(sources)||sources.length>1000)throw Error('Invalid metadata source list');
  const anchors=[],seen=new Map(),conflictedNames=new Set();
  for(const source of sources){
    if(typeof source?.name!=='string'||!source.name.trim())throw Error('Unnamed metadata source');
    const parsed=parseHmaNamedAnchors(source.text,{romSize});
    for(const anchor of parsed){
      const signature=JSON.stringify([anchor.address,anchor.format]);
      let signatures=seen.get(anchor.name);
      if(!signatures){signatures=new Set();seen.set(anchor.name,signatures);}
      if(signatures.has(signature))continue;
      if(signatures.size)conflictedNames.add(anchor.name);
      signatures.add(signature);
      anchors.push({...anchor,source:source.name});
      if(anchors.length>maxRecords)throw Error('Too many distinct named anchor declarations');
    }
  }
  anchors.sort((a,b)=>a.name.localeCompare(b.name)||a.address-b.address||a.format.localeCompare(b.format));
  return {anchors,conflictedNames};
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
 * Read-only HMA [[List]] metadata. Upstream StoredMetadata supports numbered
 * entries (including sparse indexes), inline arrays and multiline arrays.
 * A list supplies its NUMBER OF ENTRIES to ArrayRun.ParseLengthFromAnchor only
 * when no named anchor of that name exists. UnmappedConstant is not a length
 * source: upstream uses MatchedWords / WordRun for ROM-backed constants.
 * Unsupported list syntax is rejected instead of inventing a count.
 */
const maxListEntries=100000;
function hmaListLine(text){
  // Strip comments and find a closing array bracket only outside quoted strings.
  let quote='',output='',close=false;
  for(let i=0;i<text.length;i++){
    if(quote){
      if(text.startsWith(quote,i)){output+=quote;i+=quote.length-1;quote='';}
      else output+=text[i];
      continue;
    }
    if(text[i]==='#')break;
    const triple=text.slice(i,i+3);
    if(triple==="'''"||triple==='"""'){quote=triple;output+=triple;i+=2;continue;}
    if(text[i]==="'"||text[i]==='"'){quote=text[i];output+=text[i];continue;}
    if(text[i]===']'){
      if(text.slice(i+1).trim()&&!/^\s*#/.test(text.slice(i+1)))throw Error('Unexpected text after HMA list array');
      close=true;break;
    }
    output+=text[i];
  }
  return {content:output,close};
}
function hmaListItems(source){
  const values=[];let text=source.trim();
  while(text){
    const m=/^(?:'''([\s\S]*?)'''|"""([\s\S]*?)"""|'([^'\r\n]*)'|"([^"\r\n]*)")/.exec(text);
    if(!m)throw Error('Unsupported HMA list item syntax');
    values.push(m.slice(1).find(x=>x!==undefined));
    if(values.length>maxListEntries)throw Error('HMA list exceeds entry limit');
    text=text.slice(m[0].length).trimStart();
    if(!text)break;
    if(text[0]!==',')throw Error('HMA list entries must be comma separated');
    text=text.slice(1).trimStart();
  }
  return values;
}
export function parseHmaLists(source){
  if(typeof source!=='string'||source.length>maxMetadataSize)throw Error('Metadata must be TOML text under 4 MiB');
  const lines=source.replace(/^\uFEFF/,'').split(/\r?\n/);
  const records=[];let current=null;
  const finish=()=>{
    if(!current)return;
    if(!current.name||!current.entries.length)throw Error('Incomplete HMA List at line '+current.line);
    records.push(current);
    if(records.length>maxRecords)throw Error('Too many HMA lists');
    current=null;
  };
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(/^\[\[/.test(line)){
      finish();
      const m=/^\[\[\s*([^\]]+?)\s*\]\]/.exec(line);
      if(m?.[1]==='List')current={name:'',entries:[],line:i+1};
      continue;
    }
    if(/^\[/.test(line)){finish();continue;}
    if(!current||!line||line.startsWith('#'))continue;
    const name=/^Name\s*=\s*(.+)$/.exec(line);
    if(name){
      const value=tomlString(name[1]);
      if(!value||current.name)throw Error('Invalid HMA List name at line '+(i+1));
      current.name=value;continue;
    }
    const entry=/^(0x[0-9a-f]+|[0-9]+)\s*=\s*(.+)$/i.exec(line);
    if(!entry){
      // A malformed index must never be silently skipped: doing so could
      // produce a believable but incorrect list-derived table length.
      if(/^(?:0x|[0-9])[^=]*=/.test(line))throw Error('Unsupported HMA list index at line '+(i+1));
      continue;
    }
    const start=tomlInt(entry[1]);
    if(!Number.isSafeInteger(start)||start>maxListEntries)throw Error('HMA list index exceeds limit');
    let value=entry[2].trim(),items;
    if(value.startsWith('[')){
      let part=hmaListLine(value.slice(1)),body=part.content;
      while(!part.close){
        if(++i>=lines.length)throw Error('Unterminated HMA list array');
        part=hmaListLine(lines[i]);
        body+='\n'+part.content;
      }
      items=hmaListItems(body);
    }else{
      const part=hmaListLine(value);
      if(part.close)throw Error('Unexpected closing bracket in HMA list');
      items=hmaListItems(part.content);
      if(items.length!==1)throw Error('Expected one HMA list entry');
    }
    if(start+items.length>maxListEntries)throw Error('HMA list exceeds entry limit');
    // Mirrors StoredMetadata's append semantics for numbered items: gaps are
    // padded with null, existing positions are never overwritten.
    while(current.entries.length<start)current.entries.push(null);
    for(const item of items)current.entries.push(item);
  }
  finish();
  return records;
}
export function collectHmaLists(sources){
  if(!Array.isArray(sources)||sources.length>1000)throw Error('Invalid metadata source list');
  const lists=[],byName=new Map(),conflictedNames=new Set();
  for(const source of sources){
    if(typeof source?.name!=='string'||!source.name.trim())throw Error('Unnamed metadata source');
    for(const list of parseHmaLists(source.text)){
      const prior=byName.get(list.name);
      if(prior&&JSON.stringify(prior.entries)!==JSON.stringify(list.entries))
        conflictedNames.add(list.name);
      if(!prior){byName.set(list.name,list);lists.push({...list,source:source.name});}
    }
  }
  return {lists,conflictedNames};
}


/**
 * Read-only HMA [[MatchedWords]] records (StoredMetadata.cs / WordRun.cs).
 * A name may legitimately have several ROM-backed word locations. Each must
 * agree on its decoded value before the name can supply a table row count.
 * UnmappedConstant is deliberately not a substitute for a ROM-backed word.
 */
export function parseHmaMatchedWords(source,{romSize=Infinity}={}){
  if(typeof source!=='string'||source.length>maxMetadataSize)throw Error('Metadata must be TOML text under 4 MiB');
  if(!(romSize===Infinity||(Number.isSafeInteger(romSize)&&romSize>=0)))throw Error('Invalid ROM length');
  const records=[],lines=source.replace(/^\uFEFF/,'').split(/\r?\n/);
  let current=null;
  const finish=()=>{
    if(!current)return;
    const {name,address,length,offset,multOffset,note,line}=current;
    if(!name||!Number.isSafeInteger(address)||address<0||
       ![1,2,4].includes(length)||!Number.isSafeInteger(offset)||
       offset< -0x80000000||offset>0x7FFFFFFF||
       !Number.isSafeInteger(multOffset)||multOffset<1||multOffset>0x7FFFFFFF)
      throw Error('Malformed MatchedWords record at TOML line '+line);
    records.push({name,address,length,offset,multOffset,note,line,
      valid:address<=romSize-length});
    if(records.length>maxRecords)throw Error('Too many MatchedWords records');
    current=null;
  };
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(/^\[\[/.test(line)){
      finish();
      const section=/^\[\[\s*([^\]]+?)\s*\]\]/.exec(line);
      if(section?.[1]==='MatchedWords')
        current={name:'',address:NaN,length:4,offset:0,multOffset:1,note:null,line:i+1,seen:new Set()};
      continue;
    }
    if(/^\[/.test(line)){finish();continue;}
    if(!current||!line||line.startsWith('#'))continue;
    const match=/^(Name|Address|Length|Offset|MultOffset|Note)\s*=\s*(.+)$/.exec(line);
    if(!match)continue;
    const [,key,value]=match;
    if(current.seen.has(key))throw Error('Duplicate MatchedWords '+key+' at TOML line '+(i+1));
    current.seen.add(key);
    if(key==='Name'||key==='Note'){
      const decoded=tomlString(value);
      if(decoded===null||key==='Name'&&!decoded)throw Error('Invalid MatchedWords '+key+' at TOML line '+(i+1));
      if(key==='Name')current.name=decoded;
      else current.note=decoded;
      continue;
    }
    const raw=value.split(/\s+#/)[0].trim();
    let number=tomlInt(raw);
    if(key==='Offset'&&/^0x[0-9a-f]{1,8}$/i.test(raw)&&number>=0x80000000)
      number-=0x100000000;
    if(!Number.isSafeInteger(number))throw Error('Invalid MatchedWords '+key+' at TOML line '+(i+1));
    if(key==='Address')current.address=number;
    if(key==='Length')current.length=number;
    if(key==='Offset')current.offset=number;
    if(key==='MultOffset')current.multOffset=number;
  }
  finish();
  return records;
}
export function collectHmaMatchedWords(sources,{romSize=Infinity}={}){
  if(!Array.isArray(sources)||sources.length>1000)throw Error('Invalid metadata source list');
  const words=[],atSource=new Map(),conflictedNames=new Set();
  for(const source of sources){
    if(typeof source?.name!=='string'||!source.name.trim())throw Error('Unnamed metadata source');
    for(const word of parseHmaMatchedWords(source.text,{romSize})){
      const signature=JSON.stringify([word.name,word.length,word.offset,word.multOffset]);
      const prior=atSource.get(word.address);
      if(prior){
        if(prior.signature===signature)continue;
        conflictedNames.add(prior.name);
        conflictedNames.add(word.name);
      }else atSource.set(word.address,{signature,name:word.name});
      words.push({...word,source:source.name});
      if(words.length>maxRecords)throw Error('Too many distinct MatchedWords declarations');
    }
  }
  return {words,conflictedNames};
}
/**
 * WordRun.Read decodes (raw - ValueOffset) / MultOffset, while the pinned
 * ArrayRun.ParseLengthFromAnchor constant path uses raw / MultOffset -
 * ValueOffset. When those differ, interpretation is ambiguous: fail closed
 * rather than use a plausible but wrong row count.
 */
export function resolveHmaMatchedWordCounts(words,bytes,{conflictingWords=new Set()}={}){
  if(!Array.isArray(words)||words.length>maxRecords||!(conflictingWords instanceof Set))
    throw Error('Invalid MatchedWords metadata');
  const byName=new Map(),unresolved=new Map(),groups=new Map(),seen=new Map();
  const read=bytes instanceof Uint8Array?i=>bytes[i]:typeof bytes?.read==='function'?i=>bytes.read(i):null;
  const validRom=read&&Number.isSafeInteger(bytes.length)&&bytes.length>=0;
  const spans=[];
  for(const word of words){
    if(!word||typeof word.name!=='string'||!word.name||
       !Number.isSafeInteger(word.address)||word.address<0||
       ![1,2,4].includes(word.length)||
       !Number.isSafeInteger(word.offset)||word.offset< -0x80000000||word.offset>0x7FFFFFFF||
       !Number.isSafeInteger(word.multOffset)||word.multOffset<1||word.multOffset>0x7FFFFFFF)
      throw Error('Malformed MatchedWords metadata');
    if(!groups.has(word.name))groups.set(word.name,[]);
    const signature=JSON.stringify([word.name,word.length,word.offset,word.multOffset]);
    const old=seen.get(word.address);
    if(old){
      if(old.signature===signature)continue;
      unresolved.set(old.name,'conflicting-matched-word-location');
      unresolved.set(word.name,'conflicting-matched-word-location');
    }else seen.set(word.address,{signature,name:word.name});
    groups.get(word.name).push(word);
    spans.push({name:word.name,start:word.address,end:word.address+word.length});
  }
  spans.sort((a,b)=>a.start-b.start||b.end-a.end);
  let longest=null;
  for(const span of spans){
    if(longest&&span.start<longest.end){
      unresolved.set(span.name,'overlapping-matched-word-sources');
      unresolved.set(longest.name,'overlapping-matched-word-sources');
    }
    if(!longest||span.end>longest.end)longest=span;
  }
  for(const [name,group] of groups){
    if(conflictingWords.has(name)){unresolved.set(name,'conflicting-matched-word-location');continue;}
    if(unresolved.has(name))continue;
    if(!validRom){unresolved.set(name,'matched-word-rom-required');continue;}
    let count=null,reason=null;
    for(const word of group){
      if(word.address>bytes.length-word.length){reason='matched-word-out-of-bounds';break;}
      let raw=0;
      for(let i=0;i<word.length;i++)raw+=read(word.address+i)*2**(i*8);
      if(!Number.isSafeInteger(raw)||raw<0){reason='invalid-matched-word-value';break;}
      const wordRun=(raw-word.offset)/word.multOffset;
      const arrayRun=raw/word.multOffset-word.offset;
      if(!Number.isSafeInteger(wordRun)||!Number.isSafeInteger(arrayRun)||wordRun!==arrayRun){
        reason='ambiguous-matched-word-arithmetic';break;
      }
      if(count!==null&&count!==wordRun){reason='disagreeing-matched-word-values';break;}
      count=wordRun;
    }
    if(reason)unresolved.set(name,reason);
    else byName.set(name,{count,words:group.map(w=>({address:w.address,length:w.length,offset:w.offset,multOffset:w.multOffset}))});
  }
  return {byName,unresolved,sourceCount:spans.length};
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
    // A scalar suffix can name an HMA enum. Preserve the raw integer and
    // resolve a label only from a non-conflicting, explicitly imported List.
    // Other enum sources (including table-derived options) remain unsupported.
    const enumName=type==='integer' ? suffix.replace(/\|h$/,'') : '';
    fields.push({name,type,size,offset:rowSize,...(enumName?{enumName}:{})});rowSize+=size;
  }
  if(!fields.length||rowSize*count>Number.MAX_SAFE_INTEGER)return null;
  return {fields,rowSize,count,totalBytes:rowSize*count};
}


/**
 * Conservative named-array length resolution, inspired by upstream ArrayRun's
 * LengthFromAnchor and ParentOffset (kcradi/CUBHMA pinned at 3044393183e0).
 *
 * Supports exact named-array counts and the two bounded ParentOffset margins
 * (parent count + BeginningMargin + EndMargin). Constants, lists, streaming
 * lengths, parent field counts and other grammar remain unresolved.
 * These are METADATA CLAIMS, not ROM-authenticated ownership or write access.
 *
 * The dependency queue is linear in anchor count (no recursive stack or
 * quadratic dependency walks). The overlap sweep reports a witness per
 * overlapping interval, NOT an exhaustive list of all overlapping pairs.
 */
/**
 * ArrayRun.ParentOffset.Parse: one positive margin adds rows at the end,
 * one negative margin removes rows at the beginning. Two signed margins
 * explicitly describe beginning and end. This deliberately accepts only
 * unambiguous bounded decimal forms, not the upstream permissive fallback.
 */
export function parseHmaParentLengthToken(token){
  if(typeof token!=='string')return null;
  const match=/^([A-Za-z_][A-Za-z_0-9.]*)([+-][0-9]+)?([+-][0-9]+)?$/.exec(token);
  if(!match)return null;
  const first=match[2]===undefined?0:Number(match[2]);
  const second=match[3]===undefined?null:Number(match[3]);
  if(!Number.isSafeInteger(first)||Math.abs(first)>1000000||
     (second!==null&&(!Number.isSafeInteger(second)||Math.abs(second)>1000000)))return null;
  const beginning=second!==null?first:Math.min(0,first);
  const end=second!==null?second:Math.max(0,first);
  return {parent:match[1],beginningMargin:beginning,endMargin:end};
}
/** Binary-search an intersecting half-open byte span without quadratic scans. */
function hmaSpanIndex(spans){
  const prefixEnd=[],prefixIndex=[];
  let max=-1,idx=-1;
  for(let i=0;i<spans.length;i++){
    if(spans[i].end>max){max=spans[i].end;idx=i;}
    prefixEnd.push(max);prefixIndex.push(idx);
  }
  return {find(start,end){
    let lo=0,hi=spans.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(spans[mid].start<end)lo=mid+1;else hi=mid;}
    const last=lo-1;
    return last>=0&&prefixEnd[last]>start?spans[prefixIndex[last]]:null;
  }};
}
export function resolveHmaTableLayouts(anchors,{romSize=Infinity,maxOverlaps=128,lists=[],conflictingLists=new Set(),matchedWords=[],conflictingWords=new Set(),offsetPointers=[],rom=null}={}){
  const wordResolution=resolveHmaMatchedWordCounts(matchedWords,rom,{conflictingWords});
  if(rom&&romSize!==Infinity&&rom.length!==romSize)throw Error('MatchedWords ROM length mismatch');
  if(!Array.isArray(lists)||lists.length>50000||!(conflictingLists instanceof Set))throw Error('Invalid HMA list metadata');
  const listByName=new Map(),listConflicts=new Set(conflictingLists);
  for(const list of lists){
    if(typeof list?.name!=='string'||!list.name||!Array.isArray(list.entries)||list.entries.length<1||list.entries.length>maxListEntries)
      throw Error('Invalid HMA list metadata');
    const previous=listByName.get(list.name);
    if(previous&&JSON.stringify(previous.entries)!==JSON.stringify(list.entries))listConflicts.add(list.name);
    if(!previous)listByName.set(list.name,list);
  }
  if(!Array.isArray(offsetPointers)||offsetPointers.length>50000)throw Error('Invalid or excessive offset pointer metadata');
  if(!Array.isArray(anchors)||anchors.length>50000)throw Error('Invalid or excessive anchor metadata');
  if(!(romSize===Infinity||(Number.isSafeInteger(romSize)&&romSize>=0)))
    throw Error('Invalid ROM length');
  if(!Number.isSafeInteger(maxOverlaps)||maxOverlaps<0||maxOverlaps>1000)
    throw Error('Invalid overlap reporting limit');
  const entries=new Map(),duplicateNames=new Set();
  for(const anchor of anchors){
    if(!anchor||typeof anchor.name!=='string'||!anchor.name||
       !Number.isSafeInteger(anchor.address)||anchor.address<0||
       typeof anchor.format!=='string')continue;
    const previous=entries.get(anchor.name);
    if(previous&&(previous.address!==anchor.address||previous.format!==anchor.format))
      duplicateNames.add(anchor.name);
    else if(!previous)entries.set(anchor.name,anchor);
  }
  const byName=new Map(),unresolved=new Map(),children=new Map(),waiting=new Map(),queue=[];
  const accept=(anchor,layout,kind,lengthFrom=null,parentMargins=null)=>{
    if(!layout){unresolved.set(anchor.name,'invalid-adjusted-length');return;}
    if(layout.totalBytes>romSize-anchor.address){
      unresolved.set(anchor.name,'out-of-bounds');return;
    }
    byName.set(anchor.name,{anchor,layout,kind,lengthFrom,parentMargins});
    queue.push(anchor.name);
  };
  for(const [name,anchor] of entries){
    if(duplicateNames.has(name)){unresolved.set(name,'conflicting-duplicate-name');continue;}
    const fixed=parseHmaFixedTableFormat(anchor.format);
    if(fixed){accept(anchor,fixed,'fixed');continue;}
    const match=/^\[([^\[\]]+)\](.+)$/.exec(anchor.format.trim());
    if(!match){if(anchor.format.startsWith('['))unresolved.set(name,'unsupported-format');continue;}
    if(!parseHmaFixedTableFormat('['+match[1]+']1')){
      unresolved.set(name,'unsupported-fields');continue;
    }
    const margins=parseHmaParentLengthToken(match[2]);
    if(!margins){unresolved.set(name,'unsupported-length-expression');continue;}
    const parent=margins.parent;
    if(!entries.has(parent)&&listByName.has(parent)){
      if(listConflicts.has(parent)){unresolved.set(name,'conflicting-list-name');continue;}
      const count=listByName.get(parent).entries.length+margins.beginningMargin+margins.endMargin;
      const layout=Number.isSafeInteger(count)&&count>=1&&count<=1000000
        ?parseHmaFixedTableFormat('['+match[1]+']'+count):null;
      accept(anchor,layout,'named-list-count',parent,{
        beginning:margins.beginningMargin,end:margins.endMargin
      });
      continue;
    }
    if(!entries.has(parent)&&wordResolution.byName.has(parent)){
      const count=wordResolution.byName.get(parent).count+margins.beginningMargin+margins.endMargin;
      const layout=Number.isSafeInteger(count)&&count>=1&&count<=1000000
        ?parseHmaFixedTableFormat('['+match[1]+']'+count):null;
      accept(anchor,layout,'matched-word-count',parent,{
        beginning:margins.beginningMargin,end:margins.endMargin
      });
      continue;
    }
    if(!entries.has(parent)){
      unresolved.set(name,wordResolution.unresolved.get(parent)||'missing-length-anchor');
      continue;
    }
    waiting.set(name,{anchor,body:match[1],parent,margins});
    if(!children.has(parent))children.set(parent,[]);
    children.get(parent).push(name);
  }
  for(let i=0;i<queue.length;i++){
    const name=queue[i],parent=byName.get(name);
    for(const childName of children.get(name)||[]){
      const child=waiting.get(childName);
      if(!child)continue;
      waiting.delete(childName);
      const count=parent.layout.count+child.margins.beginningMargin+child.margins.endMargin;
      const layout=Number.isSafeInteger(count)&&count>=1&&count<=1000000
        ?parseHmaFixedTableFormat('['+child.body+']'+count):null;
      accept(child.anchor,layout,'anchored-count',name,{
        beginning:child.margins.beginningMargin,end:child.margins.endMargin
      });
    }
  }
  for(const name of waiting.keys())unresolved.set(name,'unresolved-or-cyclic-length-anchor');
  // This is a read-only, conservative byte-claim audit, not CUBHMA's
  // authoritative run graph. The prefix-max interval lookup finds one
  // intersection in O(log n), avoiding a 50k x 50k metadata scan.
  const spans=[...byName.values()].map(x=>({
    name:x.anchor.name,start:x.anchor.address,end:x.anchor.address+x.layout.totalBytes
  })).sort((a,b)=>a.start-b.start||b.end-a.end||a.name.localeCompare(b.name));
  const overlaps=[],conflicted=new Set();let overlapWitnesses=0,maxSpan=null;
  const witness=(first,second,start,end)=>{
    if(overlaps.length<maxOverlaps)overlaps.push({first,second,start,end});
  };
  for(const span of spans){
    if(maxSpan&&span.start<maxSpan.end){
      overlapWitnesses++;conflicted.add(span.name);conflicted.add(maxSpan.name);
      witness(maxSpan.name,span.name,span.start,Math.min(span.end,maxSpan.end));
    }
    if(!maxSpan||span.end>maxSpan.end)maxSpan=span;
  }
  // Include even unresolved MatchedWords source claims: a malformed/ambiguous
  // constant must not allow another table to assume its bytes are free.
  const wordSpans=matchedWords.filter(w=>w.address<=romSize-w.length)
    .map(w=>({name:w.name,start:w.address,end:w.address+w.length}))
    .sort((a,b)=>a.start-b.start||b.end-a.end);
  const wordIndex=hmaSpanIndex(wordSpans),tableIndex=hmaSpanIndex(spans);
  const ambiguousWordNames=new Set();
  let wordOverlapWitnesses=0;
  for(const table of spans){
    const word=wordIndex.find(table.start,table.end);
    if(!word)continue;
    conflicted.add(table.name);wordOverlapWitnesses++;
    witness('MatchedWords:'+word.name,table.name,
      Math.max(word.start,table.start),Math.min(word.end,table.end));
  }
  // Mark EVERY word source intersecting a table, not merely the first word
  // found in a large table. Otherwise another count can be trusted unsafely.
  for(const word of wordSpans)
    if(tableIndex.find(word.start,word.end))ambiguousWordNames.add(word.name);

  const offsetBySource=new Map(),conflictedOffsetPointers=new Set();
  let invalidOffsetPointers=0;
  for(const pointer of offsetPointers){
    if(!pointer||!Number.isSafeInteger(pointer.address)||pointer.address<0||
       !Number.isSafeInteger(pointer.offset)||pointer.offset<-0x80000000||pointer.offset>0x7FFFFFFF)
      throw Error('Malformed offset pointer metadata');
    const old=offsetBySource.get(pointer.address);
    if(old!==undefined&&old!==pointer.offset)
      throw Error('Conflicting offset pointer metadata at 0x'+pointer.address.toString(16));
    if(pointer.address>romSize-4){invalidOffsetPointers++;continue;}
    offsetBySource.set(pointer.address,pointer.offset);
  }
  const offsetSpans=[...offsetBySource].map(([source,offset])=>({
    source,offset,start:source,end:source+4
  })).sort((a,b)=>a.start-b.start);
  const offsetIndex=hmaSpanIndex(offsetSpans);
  for(let i=1;i<offsetSpans.length;i++){
    const left=offsetSpans[i-1],right=offsetSpans[i];
    if(right.start<left.end){
      conflictedOffsetPointers.add(left.source);
      conflictedOffsetPointers.add(right.source);
    }
  }
  // OffsetPointer can coexist with a table ONLY at the exact start of a
  // complete four-byte pointer field. Scalar bytes, partial fields and
  // cross-row references are conflicting byte claims.
  const pointerFieldOffsets=new Map();
  const compatible=(table,source)=>{
    if(source<table.start||source+4>table.end)return false;
    const layout=byName.get(table.name)?.layout;
    if(!layout)return false;
    let fields=pointerFieldOffsets.get(table.name);
    if(!fields){
      fields=new Set(layout.fields.filter(f=>f.type==='pointer').map(f=>f.offset));
      pointerFieldOffsets.set(table.name,fields);
    }
    return fields.has((source-table.start)%layout.rowSize);
  };
  for(const pointer of offsetSpans){
    const word=wordIndex.find(pointer.start,pointer.end);
    if(word){
      conflictedOffsetPointers.add(pointer.source);
      ambiguousWordNames.add(word.name);
    }
    const table=tableIndex.find(pointer.start,pointer.end);
    if(table&&(conflicted.has(table.name)||!compatible(table,pointer.source))){
      conflictedOffsetPointers.add(pointer.source);
      conflicted.add(table.name);
    }
  }
  // Reverse pass catches all words intersecting offset sources, including
  // multiple independent WordRuns within the same four-byte pointer slot.
  for(const word of wordSpans){
    const pointer=offsetIndex.find(word.start,word.end);
    if(pointer){
      ambiguousWordNames.add(word.name);
      conflictedOffsetPointers.add(pointer.source);
    }
  }
  // A source that intersects multiple adjacent table claims may initially
  // have flagged only one; suppress every table it touches.
  const invalidOffsetSpans=offsetSpans.filter(p=>conflictedOffsetPointers.has(p.source));
  const invalidOffsetIndex=hmaSpanIndex(invalidOffsetSpans);
  for(const table of spans)
    if(invalidOffsetIndex.find(table.start,table.end))conflicted.add(table.name);

  // An unresolved anchor is a one-byte *minimum* occupied claim, not a
  // free-space marker. Check it against EVERY supported claim class, including
  // standalone WordRuns and OffsetPointers with no containing table.
  // A sorted-start binary search visits each claimed span once, rather than
  // walking every unknown anchor against every WordRun/OffsetPointer.
  const unresolvedStarts=[...new Map(anchors.filter(anchor=>
    anchor&&typeof anchor.name==='string'&&
    Number.isSafeInteger(anchor.address)&&anchor.address>=0&&
    anchor.address<romSize&&!byName.has(anchor.name)
  ).map(anchor=>[anchor.name+'@'+anchor.address,anchor])).values()]
    .sort((a,b)=>a.address-b.address||a.name.localeCompare(b.name));
  const unknownLowerBound=address=>{
    let lo=0,hi=unresolvedStarts.length;
    while(lo<hi){
      const mid=(lo+hi)>>>1;
      if(unresolvedStarts[mid].address<address)lo=mid+1;else hi=mid;
    }
    return lo;
  };
  let unresolvedAnchorCollisionCount=0;
  const reserveUnknownStart=(span,label)=>{
    const first=unknownLowerBound(span.start);
    const after=unknownLowerBound(span.end); // half-open; adjacent is safe
    if(after===first)return false;
    unresolvedAnchorCollisionCount+=after-first;
    const anchor=unresolvedStarts[first];
    witness('UnresolvedAnchor:'+anchor.name,label,anchor.address,anchor.address+1);
    return true;
  };
  for(const table of spans)
    if(reserveUnknownStart(table,table.name))conflicted.add(table.name);
  for(const word of wordSpans)
    if(reserveUnknownStart(word,'MatchedWords:'+word.name))
      ambiguousWordNames.add(word.name);
  for(const pointer of offsetSpans)
    if(reserveUnknownStart(pointer,'OffsetPointer:0x'+pointer.source.toString(16)))
      conflictedOffsetPointers.add(pointer.source);

  for(const name of queue){
    const table=byName.get(name);
    if(table.kind==='matched-word-count'&&ambiguousWordNames.has(table.lengthFrom))
      conflicted.add(name);
    if(table.kind==='anchored-count'&&conflicted.has(table.lengthFrom))
      conflicted.add(name);
  }
  // Descendant conflicts may have been established only after the first
  // pointer pass. Explicit pointer sources inside them are unsafe too.
  const unsafeTableIndex=hmaSpanIndex(spans.filter(s=>conflicted.has(s.name)));
  for(const pointer of offsetSpans)
    if(unsafeTableIndex.find(pointer.start,pointer.end))
      conflictedOffsetPointers.add(pointer.source);
  return {byName,unresolved,conflicted,overlaps,overlapWitnesses,
    overlapTruncated:overlapWitnesses+wordOverlapWitnesses+unresolvedAnchorCollisionCount>overlaps.length,
    wordOverlapWitnesses,unresolvedAnchorCollisionCount,
    conflictedOffsetPointers,invalidOffsetPointers,
    offsetCollisionSources:conflictedOffsetPointers.size,
    resolvedCount:byName.size,anchoredCount:[...byName.values()].filter(x=>x.kind==='anchored-count').length,
    listCount:[...byName.values()].filter(x=>x.kind==='named-list-count').length,
    matchedCount:[...byName.values()].filter(x=>x.kind==='matched-word-count').length,
    wordResolution,
    disclaimer:'Read-only metadata byte-claim collisions, not authenticated run ownership. Unsupported formats and conflicting claims cannot be edited or repointed.'};

}

/** Read at most a few rows; never materialize or copy the entire ROM. */
export function previewHmaFixedTable(bytes,anchor,{maxRows=8,tableResolution=null,lists=[],conflictingLists=new Set(),anchors=[]}={}){
  let layout=parseHmaFixedTableFormat(anchor?.format);
  if(tableResolution){
    const resolved=tableResolution.byName?.get(anchor?.name);
    if(!resolved||resolved.anchor.address!==anchor.address||resolved.anchor.format!==anchor.format)return null;
    if(tableResolution.conflicted?.has(anchor.name))throw Error('Overlapping metadata claims: table preview refused');
    layout=resolved.layout;
  }
  if(!layout)return null;
  const read=bytes instanceof Uint8Array ? i=>bytes[i] : (typeof bytes?.read==='function'?i=>bytes.read(i):null);
  if(!read||!Number.isSafeInteger(bytes?.length)||!Number.isSafeInteger(anchor?.address))throw Error('Invalid ROM/anchor');
  if(anchor.address<0||anchor.address>bytes.length||layout.totalBytes>bytes.length-anchor.address)throw Error('Table extends beyond the selected ROM; preview refused');
  if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>32)throw Error('Invalid table preview limit');
  // Labels are hints only: CUBHMA enums may also refer to named tables,
  // whose dynamic options are not implemented. Named anchors take precedence.
  if(!Array.isArray(lists)||!Array.isArray(anchors)||!(conflictingLists instanceof Set))
    throw Error('Invalid enum preview metadata');
  const namedAnchors=new Set(anchors.map(a=>a.name));
  const labelLists=new Map();
  for(const list of lists){
    if(!list||typeof list.name!=='string'||!Array.isArray(list.entries))continue;
    if(labelLists.has(list.name)){labelLists.set(list.name,null);continue;}
    labelLists.set(list.name,list.entries);
  }
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
      const options=field.enumName&&!conflictingLists.has(field.enumName)&&
        !namedAnchors.has(field.enumName)?labelLists.get(field.enumName):null;
      const label=Array.isArray(options)&&value<options.length?options[value]:null;
      return {name:field.name,type:field.type,value,
        ...(typeof label==='string'?{enumLabel:label,enumSource:field.enumName}:{})};
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

/**
 * Read-only CUBHMA expansion-layout evidence from imported TOML.
 * Pinned upstream StoredMetadata.cs (3044393183e01af2) recognises both the
 * General MetadataLayout marker and trainer-party tpte formatted runs.
 * These are claims made by the TOML, NOT fingerprints of the selected ROM.
 */
export function inspectHmaMetadataLayout(source){
  if(typeof source!=='string'||source.length>maxMetadataSize)
    throw Error('Metadata must be TOML text under 4 MiB');
  const lines=source.replace(/^\uFEFF/,'').split(/\r?\n/);
  let marker=null;
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    const match=/^MetadataLayout\s*=\s*(.*)$/.exec(line);
    if(!match)continue;
    if(marker!==null)throw Error('Duplicate MetadataLayout declarations at TOML line '+(i+1));
    // CUBHMA serializes triple-quoted values; accept other simple TOML quoted
    // strings but reject malformed/unquoted declarations rather than guessing.
    const quoted=/^(?:'''(.*?)'''|"""(.*?)"""|'([^']*)'|"([^"]*)")\s*(?:#.*)?$/.exec(match[1].trim());
    if(!quoted)throw Error('Invalid MetadataLayout declaration at TOML line '+(i+1));
    marker=quoted.slice(1).find(v=>v!==undefined).trim();
  }
  const tpteAnchors=parseHmaNamedAnchors(source)
    .filter(anchor=>anchor.format.includes('\x60tpte\x60')).map(anchor=>anchor.name);
  const kind=marker?.toLowerCase()==='expansion'||tpteAnchors.length?'expansion':
    marker?'custom':'unspecified';
  return {kind,marker:marker||null,viaTpte:tpteAnchors.length>0,tpteAnchors};
}

/** Detect a *known wrong* upstream stock TOML; unknown custom files stay read-only and unverified. */
export function checkHmaMetadataSources(sources,bytes){
  if(!Array.isArray(sources))throw Error('Expected metadata source list');
  const identity=identifyHmaRom(bytes);
  // Filename-only checks are supported for existing stock-metadata callers;
  // only supplied TOML text can provide expansion-layout evidence.
  const layouts=sources.map(source=>inspectHmaMetadataLayout(source?.text===undefined?'':source.text));
  const declared=layouts.map(item=>item.marker?.toLowerCase()).filter(Boolean);
  if(new Set(declared).size>1)throw Error('Conflicting MetadataLayout declarations across imported TOMLs');
  const layoutKind=layouts.some(item=>item.kind==='expansion')?'expansion':
    layouts.some(item=>item.kind==='custom')?'custom':'unspecified';
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
  if(layoutKind!=='unspecified'&&checked.some(item=>item.kind==='stock-reference'))
    throw Error('Refusing vanilla stock metadata overlay on '+layoutKind+' (CUBE/custom) metadata layout');
  return {identity,sources:checked,
    layout:{kind:layoutKind,marker:declared[0]||null,viaTpte:layouts.some(item=>item.viaTpte)},
    warning:'Layout markers describe imported TOML, not the ROM. Header and filenames cannot authenticate CUBE versions; semantic data is read-only.'};
}


/**
 * Bounded read-only pointer cross-reference inspection.
 * CUBHMA's actual run ownership needs full formatted-run tracking and metadata
 * reconciliation. This identifies ONLY typed pointer slots in the supported
 * fixed-table subset. Raw 4-byte matches are labeled unverified candidates,
 * never as authoritative owners or safe sources for repointing.
 */
export function inspectHmaPointerReferences(bytes,target,anchors,{
  maxTableSlots=120000,maxDeclared=32,maxCandidates=24,maxScanBytes=8*1024*1024,offsetPointers=[],lists=[],conflictingLists=new Set(),matchedWords=[],conflictingWords=new Set()
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
  const offsetBySource=new Map();
  let skippedOffsetPointers=0,examinedOffsetPointers=0,skippedConflictedOffsetPointers=0;
  for(const record of offsetPointers){
    if(!record||!Number.isSafeInteger(record.address)||
       !Number.isSafeInteger(record.offset)||record.offset<-0x80000000||record.offset>0x7FFFFFFF)
      throw Error('Malformed offset pointer metadata');
    const old=offsetBySource.get(record.address);
    if(old!==undefined&&old!==record.offset)
      throw Error('Conflicting offset pointer metadata at 0x'+record.address.toString(16));
    offsetBySource.set(record.address,record.offset);
  }
  const declared=[],knownSlots=new Set();
  const tableResolution=resolveHmaTableLayouts(anchors,{romSize:bytes.length,maxOverlaps:0,lists,conflictingLists,matchedWords,conflictingWords,offsetPointers,rom:bytes});
  let examinedSlots=0,skippedTables=0,matchedDeclared=0,unsupportedFormats=0,conflictedTables=0;
  for(const anchor of anchors){
    if(!anchor||!Number.isSafeInteger(anchor.address))continue;
    const resolved=tableResolution.byName.get(anchor.name);
    const layout=resolved?.anchor.address===anchor.address&&resolved?.anchor.format===anchor.format?resolved.layout:null;
    if(!layout){if(typeof anchor.format==='string'&&anchor.format.startsWith('['))unsupportedFormats++;continue;}
    if(tableResolution.conflicted.has(anchor.name)){conflictedTables++;continue;}
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
        if(offsetBySource.has(source))continue; // explicit HMA OffsetPointer overrides generic table interpretation
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
  for(const [source,offset] of offsetBySource){
    if(source<0||source>bytes.length-4){skippedOffsetPointers++;continue;}
    if(tableResolution.conflictedOffsetPointers.has(source)){skippedConflictedOffsetPointers++;continue;}
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
    if(knownSlots.has(i)||offsetBySource.has(i)||read32(i)!==needle)continue;
    candidateHits++;
    if(candidates.length<maxCandidates)candidates.push({source:i,kind:'raw-candidate'});
  }
  return {
    target,declared,candidates,matchedDeclared,candidateHits,
    examinedSlots,skippedTables,unsupportedFormats,conflictedTables,anchoredTables:tableResolution.anchoredCount,listTables:tableResolution.listCount,matchedTables:tableResolution.matchedCount,examinedOffsetPointers,skippedOffsetPointers,skippedConflictedOffsetPointers,scannedBytes:span,
    rawScanComplete:span===bytes.length,scanAlignment:4,
    declaredTruncated:matchedDeclared>declared.length,candidatesTruncated:candidateHits>candidates.length,
    disclaimer:'Fixed/linked/list/MatchedWords table and OffsetPointer matches rely on unverified metadata; overlapping table/word/offset-pointer claims are excluded. Raw candidates are only aligned byte-pattern matches. Neither proves ownership or permits safe repointing.'
  };
}
