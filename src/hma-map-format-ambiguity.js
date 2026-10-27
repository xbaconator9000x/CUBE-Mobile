/**
 * Conservative HMA custom-map pointer multiplicity audit.
 * CUBHMA MapModel.cs extracts the first named pointer format from each scope.
 * Before using that as evidence, detect duplicate same-name declarations.
 * This is metadata-only and does not claim to implement HMA's full DSL.
 */
import {extractHmaPointerContent} from './hma-map-format-hierarchy.js';

function occurrences(text,name){
 if(text===null)return 0;
 let count=0,at=text.indexOf(name+'<');
 while(at>=0){
  if(at===0||' [<\n\t'.includes(text[at-1]))count++;
  at=text.indexOf(name+'<',at+1);
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
