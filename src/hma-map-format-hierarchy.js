/**
 * Conservative read-only HMA map format hierarchy extractor.
 * Ported from pinned kcradi/CUBHMA MapModel.cs Format.ExtractPointerContent
 * and its custom MapFormat / LayoutFormat / EventsFormat fallback.
 * This parses metadata text only: it does not authenticate a ROM or execute DSL.
 */
const names=Object.freeze(['layout','events','connections','objects',
 'warps','scripts','signposts','primaryBlockset']);
export function extractHmaPointerContent(format,prefix,{maxLength=8192,maxDepth=32}={}){
 if(typeof format!=='string'||typeof prefix!=='string'||
    !/^[A-Za-z][A-Za-z0-9]*<$/.test(prefix))
  throw new TypeError('Expected HMA format string and named pointer prefix');
 if(!Number.isSafeInteger(maxLength)||maxLength<1||maxLength>65536||
    !Number.isSafeInteger(maxDepth)||maxDepth<1||maxDepth>128)
  throw new RangeError('Invalid bounded HMA pointer-format limits');
 if(format.length>maxLength)throw new RangeError('HMA map format exceeds byte budget');
 let at=format.indexOf(prefix);
 while(at>=0){
  if(at===0||' [<'.includes(format[at-1]))break;
  at=format.indexOf(prefix,at+1);
 }
 if(at<0)return null;
 const start=at+prefix.length;
 if(format[start]!=='[')return null;
 let depth=0,closing=-1;
 for(let i=start;i<format.length;i++){
  if(format[i]==='['){
   depth++;if(depth>maxDepth)throw new RangeError('HMA pointer nesting too deep');
  }else if(format[i]===']'){
   depth--;if(depth<0)throw new RangeError('Unbalanced HMA pointer brackets');
   if(depth===0){closing=i;break;}
  }
 }
 if(closing<0)throw new RangeError('Unterminated HMA pointer format');
 const end=format.indexOf('>',closing+1);
 if(end<0||end-closing>64||
    /[\[\]<>]/.test(format.slice(closing+1,end)))
  throw new RangeError('Malformed HMA pointer format suffix');
 return format.slice(start,end);
}
export function inspectHmaMapFormatHierarchy(mapBankFormat){
 if(typeof mapBankFormat!=='string')
  throw new TypeError('Provide the HMA map-bank table format text');
 const mapFormat=extractHmaPointerContent(mapBankFormat,'map<');
 if(mapFormat===null)return Object.freeze({
  status:'unresolved',mapFormat:null,vanillaMarker:false,
  readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false
 });
 const vanillaMarker=mapFormat.includes(' cave. ');
 const supportedShape=mapFormat.endsWith(']1');
 const layout=extractHmaPointerContent(mapFormat,'layout<');
 const events=extractHmaPointerContent(mapFormat,'events<');
 const connections=extractHmaPointerContent(mapFormat,'connections<');
 const objects=events===null?null:extractHmaPointerContent(events,'objects<');
 const warps=events===null?null:extractHmaPointerContent(events,'warps<');
 const scripts=events===null?null:extractHmaPointerContent(events,'scripts<');
 const signposts=events===null?null:extractHmaPointerContent(events,'signposts<');
 const primaryBlockset=layout===null?null:
  extractHmaPointerContent(layout,'primaryBlockset<');
 const sections=Object.freeze({layout,events,connections,objects,
  warps,scripts,signposts,primaryBlockset});
 return Object.freeze({
  status:!supportedShape?'unsupported-shape':
   vanillaMarker?'vanilla-marker':'custom-candidate',
  mapFormat,sections,sectionCount:names.filter(n=>sections[n]!==null).length,
  vanillaMarker,supportedShape,
  readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false,
  writeAuthorized:false
 });
}
