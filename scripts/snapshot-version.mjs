// Recovery is additive. Never overwrite a snapshot or replace the live library.
import { DatabaseSync, backup } from 'node:sqlite';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const destination=resolve(process.argv[2]||root+'/artifacts/version-before-native-windows-20261013');
if(!destination.startsWith(root+'/artifacts/')&&!destination.startsWith(root+'\\artifacts\\'))throw Error('Snapshot must be inside this project artifacts directory.');
if(existsSync(destination))throw Error('A version snapshot already exists; never overwrite it.');
mkdirSync(destination,{recursive:true});
const excluded=['output/','archive/','profile/','.extension-integration-data/','exa-results/'];
const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const files=[];
for(const path of candidates){
  if(excluded.some(prefix=>path.startsWith(prefix)))continue;
  const original=resolve(root,path),target=resolve(destination,'source',path);
  if(relative(root,original).startsWith('..')||relative(resolve(destination,'source'),target).startsWith('..'))throw Error('Invalid snapshot source path');
  mkdirSync(dirname(target),{recursive:true});copyFileSync(original,target);
  const hash=digest(original);if(digest(target)!==hash)throw Error('Source snapshot hash mismatch');files.push({path,sha256:hash});
}
cpSync(resolve(root,'dist'),resolve(destination,'desktop-ui'),{recursive:true});
copyFileSync(resolve(root,'stashdock.exe'),resolve(destination,'stashdock.exe'));
const installed='C:/Users/86137/.codex/plugins/cache/personal/stashdock/0.4.27';
for(const folder of ['.codex-plugin','scripts','dist','web','server','bin','skills','notices','assets'])cpSync(installed+'/'+folder,destination+'/plugin/'+folder,{recursive:true});
copyFileSync(installed+'/.mcp.json',destination+'/plugin/.mcp.json');
const database=new DatabaseSync('D:/StashDockData/stashdock.sqlite3',{readOnly:true});
let references;
try{references=database.prepare('SELECT COUNT(*) AS count FROM stash_items').get().count;await backup(database,destination+'/stashdock.sqlite3');}finally{database.close();}
writeFileSync(destination+'/manifest.json',JSON.stringify({createdAt:new Date().toISOString(),root,files,excluded,referenceCount:references,desktopSha256:digest(destination+'/stashdock.exe'),notes:'Runtime/dependency caches are unchanged and excluded. Source, generated desktop UI, installed desktop/plugin and consistent library are saved. Restore code separately; never restore this database over newer references.'},null,2));
console.log(JSON.stringify({snapshot:destination,sourceFiles:files.length,references,desktopHashVerified:digest(resolve(root,'stashdock.exe'))===digest(destination+'/stashdock.exe')}));
