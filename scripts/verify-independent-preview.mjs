// Real packaged MCP worker, isolated test database. No desktop API/window or system browser used.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { createServer } from '../plugins/stashdock/dist/mcp-server.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
const root=resolve('output/playwright'); mkdirSync(root,{recursive:true});
const dataDir=mkdtempSync(join(root,'mcp-test-render-'));
const library=createLocalLibrary({dataDir});
library.importItems([{title:'Preview integration fixture',kind:'web',source:'example.org',url:'https://example.org/',excerpt:'Fixture',content:'Do not replace my content',tags:['Fixture'],favorite:true}]); library.close();
const server=createServer({dataDir,previewWorker:true,htmlUrl:new URL('../plugins/stashdock/web/shelf.html',import.meta.url)});
const client=new Client({name:'Preview verification',version:'1'}); const [a,b]=InMemoryTransport.createLinkedPair();
const states=new Set();
try {
  await server.connect(a); await client.connect(b);
  const deadline=Date.now()+75_000; let item;
  while(Date.now()<deadline){
    const result=await client.callTool({name:'list_stashdock_shelf',arguments:{}}); assert.equal(result.isError,undefined);
    item=result._meta.items[0]; states.add(item.previewStatus || (item.preview?'ready':'unavailable'));
    if(item.preview) break;
    await new Promise(resolve=>setTimeout(resolve,750));
  }
  assert.ok(item?.preview,'Independent renderer did not produce a picture'); assert.equal(item.origin.previewKind,'screenshot');
  writeFileSync(join(root,'mcp-independent-preview-0414.jpg'),Buffer.from(item.preview.split(',')[1],'base64'));
  const stored=createLocalLibrary({dataDir});
  try { const row=(await stored.read())[0]; assert.equal(row.content,'Do not replace my content'); assert.equal(row.favorite,true); assert.deepEqual(row.tags,['Fixture']); }
  finally { stored.close(); }
  console.log(JSON.stringify({packagedWorker:true,desktopRequired:false,systemBrowserRequired:false,states:[...states],imageBytes:item.preview.length,contentPreserved:true,dataDir}));
} finally { await client.close(); await server.close(); }
