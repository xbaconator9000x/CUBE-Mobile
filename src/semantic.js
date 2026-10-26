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
