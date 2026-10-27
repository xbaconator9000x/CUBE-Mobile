import {readFileSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const blocked=/\.(?:gba|gbc|gb|nds|3ds|sav|srm|state|sgm|ips|ups|bps|xdelta|rom|iso|cue|zip|7z|rar|pem|p12|pfx|apk)$/i;
const secretPatterns=[
 /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
 /gh[pousr]_[A-Za-z0-9]{36,}/,
 /github_pat_[A-Za-z0-9_]{50,}/,
 /AKIA[0-9A-Z]{16}/,
 /sk-proj-[A-Za-z0-9_-]{20,}/,
 /xox[baprs]-[A-Za-z0-9-]{24,}/
];
export function validateTrackedPath(path){
 if(typeof path!=='string'||!path||path.includes('\\')||path.startsWith('/')||
    path.split('/').some(part=>part==='..'||part===''))
  throw new Error('Unsafe tracked path');
 if(blocked.test(path)||/(?:^|\/)\.env(?:\..*)?$/i.test(path)||
    /(?:^|\/)(?:node_modules|\.git)\//.test(path))
  throw new Error('Forbidden tracked asset: '+path);
 return true;
}
export function detectCredentialSignature(content){
 if(typeof content!=='string')throw new TypeError('Expected UTF-8 text');
 return secretPatterns.some(pattern=>pattern.test(content));
}
export function auditTrackedFiles(paths,readFile,statFile){
 if(!Array.isArray(paths))throw new TypeError('Expected tracked file list');
 let checked=0;
 for(const path of paths){
  validateTrackedPath(path);
  const stat=statFile(path);
  if(!stat.isFile()||stat.size>4*1024*1024)
   throw new Error('Non-regular or oversized tracked file: '+path);
  const data=readFile(path);
  if(detectCredentialSignature(data.toString('utf8')))
   throw new Error('Credential-like content in tracked file: '+path);
  checked++;
 }
 return checked;
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'})
  .split('\0').filter(Boolean);
 const checked=auditTrackedFiles(tracked,
  path=>readFileSync(resolve(root,path)),
  path=>lstatSync(resolve(root,path)));
 console.log('Repository safety: '+checked+' tracked regular files inspected; no blocked assets or matching credential signatures.');
}
