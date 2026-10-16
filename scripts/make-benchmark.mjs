import { mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
const [source,dest='benchmark',raw='600']=process.argv.slice(2);
const count=Number(raw);
if(!source||!Number.isInteger(count)||count<1||count>100000)throw Error('Usage: node scripts/make-benchmark.mjs source.jpg dest 600 (1..100000)');
const info=await stat(source);if(!info.isFile())throw Error('Source is not a file');
await mkdir(dest,{recursive:true});
for(let i=0;i<count;i++){await copyFile(source,path.join(dest,`sample-${String(i).padStart(6,'0')}.jpg`));if(i%100===0)console.log(`${i}/${count}`);}
console.log(`${count} copies, ${(info.size*count/1024**3).toFixed(2)} GiB. Repeated content measures I/O and scheduling, not parser diversity.`);
