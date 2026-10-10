import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
const files=[...new Set(execFileSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),'ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const patterns=[/\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}/,/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}/,/\bwhsec_[A-Za-z0-9]{24,}/,/\bsb_secret_[A-Za-z0-9_-]{24,}/,/\bgh[pousr]_[A-Za-z0-9]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/postgres(?:ql)?:\/\/[^\s:]+:[^\s@${}<>]+@/];
const findings=[];
for(const file of files){
  if(/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.example')){findings.push({file,reason:'Environment file must not be versioned'});continue;}
  if(!statSync(file).isFile()||/\.(png|jpe?g|gif|ico|webp|woff2?|pdf)$/i.test(file))continue;
  const text=readFileSync(file,'utf8');
  text.split(/\r?\n/).forEach((line,index)=>{if(patterns.some(pattern=>pattern.test(line)))findings.push({file,line:index+1,reason:'Possible credential; value omitted'});});
}
console.log(JSON.stringify({scanned:files.length,findings},null,2));
if(findings.length)process.exitCode=1;
