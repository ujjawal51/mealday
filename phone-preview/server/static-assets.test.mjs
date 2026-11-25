import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createApp} from './app.mjs';
import {recipePhotos} from '../dist/recipe-photos.js';
import {readFile} from 'node:fs/promises';
test('Default root start selects the latest UI; HTML, modules, styles and every recipe photo serve from the module directory',async t=>{
 const rootPackage=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
 assert.equal(rootPackage.scripts.start,'node --env-file-if-exists=.env phone-preview/server/index.mjs');
 const server=createServer(createApp({store:{},origin:'http://localhost:3000'}));server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const html=await(await fetch(base)).text();assert.match(html,/id="screen"/);assert.match(html,/src="\/client-[a-f0-9]+\.js"/);assert.match(html,/href="\/app.css"/);
 for(const path of ['/app.js','/app.css','/recipe-photos.js','/api.js','/recipe-image-unavailable.svg','/login.html','/signup.html','/account.css','/google-account.js','/google-signin.js']){
  const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok((await response.arrayBuffer()).byteLength>0,path);
 }
 const login=await(await fetch(base+'/login.html')).text(),signup=await(await fetch(base+'/signup.html')).text();
 for(const page of [login,signup]){assert.match(page,/id="google-account"/);assert.match(page,/src="\/google-account.js"/);assert.doesNotMatch(page,/name="(?:password|confirmPassword)"|Resend verification/);}

 const photos=Object.values(recipePhotos);assert.equal(photos.length,420);
 for(let offset=0;offset<photos.length;offset+=20)await Promise.all(photos.slice(offset,offset+20).map(async path=>{
  const response=await fetch(base+path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/^image\//,path);assert.ok((await response.arrayBuffer()).byteLength>0,path);
 }));
});
