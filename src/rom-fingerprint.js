/** Streaming SHA-256 ROM identity; local-only and independent of header/TOML claims.
 * SHA-256 identifies exact bytes, not their game, provenance or CUBE compatibility.
 * No complete-ROM snapshot is allocated: hashing uses bounded chunks.
 */
const K=Uint32Array.from([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const rotate=(v,n)=>(v>>>n)|(v<<(32-n));
export class StreamingSha256 {
  constructor(){
    this.h=Uint32Array.from([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    this.block=new Uint8Array(64);this.words=new Uint32Array(64);
    this.used=0;this.total=0;this.done=false;
  }
  compress(){
    const w=this.words,b=this.block,h=this.h;
    for(let i=0;i<16;i++){const p=i*4;w[i]=((b[p]<<24)|(b[p+1]<<16)|(b[p+2]<<8)|b[p+3])>>>0;}
    for(let i=16;i<64;i++){
      const a=w[i-15],c=w[i-2];
      const s0=rotate(a,7)^rotate(a,18)^(a>>>3);
      const s1=rotate(c,17)^rotate(c,19)^(c>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b0,c,d,e,f,g,j]=h;
    for(let i=0;i<64;i++){
      const s1=rotate(e,6)^rotate(e,11)^rotate(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(j+s1+ch+K[i]+w[i])>>>0;
      const s0=rotate(a,2)^rotate(a,13)^rotate(a,22);
      const maj=(a&b0)^(a&c)^(b0&c);
      const t2=(s0+maj)>>>0;
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b0;b0=a;a=(t1+t2)>>>0;
    }
    for(const [i,v] of [a,b0,c,d,e,f,g,j].entries())h[i]=(h[i]+v)>>>0;
  }
  update(data){
    if(this.done)throw Error('SHA-256 already finalised');
    if(!(data instanceof Uint8Array))throw Error('SHA-256 input must be bytes');
    if(!Number.isSafeInteger(this.total+data.length)||this.total+data.length>0x1fffffffffffff/8)
      throw Error('SHA-256 input length exceeds supported bounds');
    this.total+=data.length;
    for(let offset=0;offset<data.length;){
      const take=Math.min(64-this.used,data.length-offset);
      this.block.set(data.subarray(offset,offset+take),this.used);
      this.used+=take;offset+=take;
      if(this.used===64){this.compress();this.used=0;}
    }
    return this;
  }
  digestHex(){
    if(this.done)throw Error('SHA-256 already finalised');
    const bits=this.total*8;
    this.block[this.used++]=0x80;
    if(this.used>56){this.block.fill(0,this.used);this.compress();this.used=0;}
    this.block.fill(0,this.used,56);
    const high=Math.floor(bits/0x100000000),low=bits>>>0;
    for(let i=0;i<4;i++){
      this.block[56+i]=(high>>>(24-i*8))&255;
      this.block[60+i]=(low>>>(24-i*8))&255;
    }
    this.compress();this.done=true;
    return Array.from(this.h,v=>v.toString(16).padStart(8,'0')).join('');
  }
}
export function fingerprintMatchesRom(model,result){
  if(!result||result.snapshot?.model!==model||model.base!==result.snapshot.base)return false;
  const before=result.snapshot.edits,now=model.edits;
  if(!(before instanceof Map)||!(now instanceof Map)||before.size!==now.size)return false;
  for(const [offset,value] of before)if(now.get(offset)!==value)return false;
  return true;
}
/** Hash a stable, captured base + staged edit map, yielding to the browser regularly.
 * A concurrent edit never silently alters the digest's snapshot.
 */
export async function fingerprintRomSha256(model,{chunkSize=65536,signal,onProgress,yieldEvery=16}={}){
  if(!(model?.base instanceof Uint8Array)||!(model.edits instanceof Map))
    throw Error('Expected a ROM model with staged edits');
  if(!Number.isSafeInteger(chunkSize)||chunkSize<64||chunkSize>1024*1024||
     !Number.isSafeInteger(yieldEvery)||yieldEvery<1||yieldEvery>1024)
    throw Error('Invalid fingerprint chunk configuration');
  const base=model.base,edits=new Map(model.edits);
  const ordered=[...edits].sort((a,b)=>a[0]-b[0]);
  for(const [offset,value] of ordered)
    if(!Number.isSafeInteger(offset)||offset<0||offset>=base.length||
       !Number.isInteger(value)||value<0||value>255)
      throw Error('Invalid staged ROM edit');
  const hasher=new StreamingSha256();
  let editIndex=0,parts=0;
  for(let start=0;start<base.length;start+=chunkSize){
    if(signal?.aborted)throw Error('ROM fingerprint cancelled');
    const end=Math.min(base.length,start+chunkSize);
    const chunk=base.slice(start,end);
    while(editIndex<ordered.length&&ordered[editIndex][0]<end){
      const [offset,value]=ordered[editIndex++];
      chunk[offset-start]=value;
    }
    hasher.update(chunk);parts++;
    if(onProgress&&parts%yieldEvery===0)onProgress(end,base.length);
    if(parts%yieldEvery===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(signal?.aborted)throw Error('ROM fingerprint cancelled');
  onProgress?.(base.length,base.length);
  return {sha256:hasher.digestHex(),length:base.length,snapshot:{model,base,edits}};
}
