import assert from 'node:assert/strict';
import {cp,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

// Only an existing fixture's exact nonce-owned manifests are accepted here.
// Never inspect or replace the daily product's NativeMessagingHosts entries.
export async function createNativeRecovery({root,home,suffix,desktop,manifests,env}) {
  const entries=[];
  for(const path of manifests.filter(path=>path.endsWith('.'+suffix+'.both.json'))) {
    const bytes=await readFile(path,'utf8'),value=JSON.parse(bytes);
    if(value.name!=='app.stashdock.desktop.'+suffix+'.both')continue;
    assert.equal(value.path,desktop);entries.push({path,bytes,value});
  }
  assert.ok(entries.length,'The fixture must own a desktop manifest.');
  const retired=desktop+'.retired',upgrade=join(root,'升级 Desktop.app/Contents/MacOS/stashdock-browser');
  const original=join(root,'library/stashdock.sqlite3'),moved=join(root,'外接盘/library/stashdock.sqlite3');
  let desktopMissing=false,libraryMissing=false,movedLibrary=false;
  async function installUpgrade() {
    for(const {path,value} of entries)await writeFile(path,JSON.stringify({...value,path:upgrade}));
  }
  return {
    database:()=>movedLibrary?moved:original,
    async mutate(phase) {
      switch(phase) {
        case 'desktop-missing':await rename(desktop,retired);desktopMissing=true;break;
        case 'desktop-restored':await rename(retired,desktop);desktopMissing=false;break;
        case 'desktop-upgraded': {
          await mkdir(join(root,'升级 Desktop.app/Contents/MacOS'),{recursive:true});await cp(desktop,upgrade);
          const invoke=(path,action)=>spawnSync(path,[action,'desktop'],{env,encoding:'utf8',timeout:5000});
          const registered=invoke(upgrade,'--register');assert.equal(registered.status,0,registered.stderr);
          const oldUninstall=invoke(desktop,'--unregister');assert.equal(oldUninstall.status,0,oldUninstall.stderr);
          for(const browser of ['Google/Chrome','Microsoft Edge','Mozilla']) {
            const current=JSON.parse(await readFile(join(home,'Library/Application Support',browser,'NativeMessagingHosts/app.stashdock.desktop.json'),'utf8'));
            assert.equal(current.path,upgrade,'The old uninstaller must preserve the new registration.');
          }
          await installUpgrade();await rename(desktop,retired);desktopMissing=true;break;
        }
        case 'desktop-uninstalled':for(const {path} of entries)await rm(path);break;
        case 'desktop-reinstalled':await installUpgrade();break;
        case 'library-moved': {
          await mkdir(join(root,'外接盘/library'),{recursive:true});
          const db=new DatabaseSync(original);
          try{db.prepare('VACUUM INTO ?').run(moved);db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('library_location_v1',?)").run(join(root,'外接盘/library'));}finally{db.close();}
          movedLibrary=true;break;
        }
        case 'library-unavailable':await rename(moved,moved+'.offline');libraryMissing=true;break;
        case 'library-restored':await rename(moved+'.offline',moved);libraryMissing=false;break;
        default:throw Error('Unknown owned recovery phase.');
      }
      return {ok:true};
    },
    async restore() {
      if(libraryMissing)await rename(moved+'.offline',moved);
      if(desktopMissing)await rename(retired,desktop);
      for(const {path,bytes} of entries)await writeFile(path,bytes);
    },
  };
}
