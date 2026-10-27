/**
 * Conservative HMA custom-map pointer multiplicity audit.
 * CUBHMA MapModel.cs extracts the first named pointer format from each scope.
 * Before using that as evidence, detect duplicate same-name declarations.
 * This is metadata-only and does not claim to implement HMA's full DSL.
 */
import {extractHmaPointerContent} from './hma-map-format-hierarchy.js';

function occurrences(text,name){
 if(text===null)return 0;
 // HMA can legitimately reuse a field name inside a nested array, e.g.
 // connections<[count:: connections<[...]/count>]1>. Only repeated fields
 // at the SAME nesting depth are ambiguous. Ignore backtick DSL macros.
 let depth=0,quoted=false,firstDepth=null,count=0;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='\`'){quoted=!quoted;continue;}
  if(quoted)continue;
  if(ch==='['){depth++;continue;}
  if(ch===']'){depth--;continue;}
  if(text.startsWith(name+'<',i)&&
     (i===0||' [<\\n\\t'.includes(text[i-1]))){
    if(firstDepth===null)firstDepth=depth;
    if(depth===firstDepth)count++;
  }
 }
 return count;
}

export function auditHmaMapPointerMultiplicity(bankFormat){
 if(typeof bankFormat!=='string'||bankFormat.length>8192)
  throw new RangeError('Expected bounded HMA map-bank format text');
 const mapFormat=extractHmaPointerContent(bankFormat,'map<');
 const layout=mapFormat===null?null:extractHmaPointerContent(mapFormat,'layout<');
 const events=mapFormat===null?null:extractHmaPointerContent(mapFormat,'events<');
 const scopes=[
  ['banks',bankFormat,['map']],
  ['map',mapFormat,['layout','events','connections']],
  ['events',events,['objects','warps','scripts','signposts']],
  ['layout',layout,['primaryBlockset','secondaryBlockset']]
 ];
 const duplicates=[],counts={};
 for(const [scope,format,names] of scopes){
  for(const name of names){
   const count=occurrences(format,name);
   counts[scope+'.'+name]=count;
   if(count>1)duplicates.push(Object.freeze({scope,name,count}));
  }
 }
 return Object.freeze({
  ambiguous:duplicates.length>0,
  duplicates:Object.freeze(duplicates),
  counts:Object.freeze(counts),
  readOnly:true,romAuthenticated:false,writeAuthorized:false
 });
}
