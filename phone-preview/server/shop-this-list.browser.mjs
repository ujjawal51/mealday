import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({origin,store:{}}));
const state={profile:{shop:'LuLu',city:'Dubai',budget:100,days:[0],mealTypes:['dinner']},pantry:{paneer:150},checked:['rice'],favorites:[],extraGroceries:[{id:'lime',name:'Limes',quantity:'3 pieces',checked:false}],
 result:{total:25,plan:[],meals:[],items:[
 {key:'paneer',name:'Paneer',unit:'g',have:150,need:250,packs:2,pack:200,cost:18,category:'Chilled'},
 {key:'rice',name:'Rice',unit:'g',have:0,need:100,packs:1,pack:1000,cost:7,category:'Pantry'}
 ]}};
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>{
  localStorage.setItem('mealday.android.v1',JSON.stringify(value));
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.denyCopy)throw Error('Clipboard blocked');window.lastCopied=text;}}});
 },state);
 const page=await context.newPage();await page.goto(origin);await page.getByRole('button',{name:'Shopping',exact:true}).click();
 await page.getByRole('button',{name:'Shop this list',exact:true}).click();
 const dialog=page.getByRole('dialog'),text=dialog.getByRole('textbox',{name:/To-buy list/});
 assert.equal(await text.inputValue(),'Paneer — 250 g\nLimes — 3 pieces');
 assert.match(await dialog.innerText(),/Add the items manually/);
 const copy=dialog.getByRole('button',{name:'Copy to-buy list',exact:true});await copy.click();
 await dialog.getByText('To-buy list copied.').waitFor();
 assert.equal(await page.evaluate(()=>window.lastCopied),await text.inputValue());
 await page.evaluate(()=>{window.denyCopy=true});await copy.click();
 await dialog.getByText(/List selected/).waitFor();
 assert.equal(await text.evaluate(el=>el.selectionEnd-el.selectionStart),(await text.inputValue()).length);
 const providers=[['Open noon Minutes','https://minutes.noon.com/uae-en/'],['Open talabat mart','https://www.talabat.com/uae/talabat-mart']];
 for(const [name,url] of providers){
  const link=dialog.getByRole('link',{name,exact:true});assert.equal(await link.getAttribute('href'),url);assert.equal(await link.getAttribute('target'),'_blank');
  await context.route(url,route=>route.fulfill({body:'Public storefront navigation test',contentType:'text/plain'}));
  const [tab]=await Promise.all([context.waitForEvent('page'),link.click()]);
  await tab.waitForURL(url);assert.equal(await tab.locator('body').innerText(),'Public storefront navigation test');await tab.close();
 }
 console.log('Phone storefront handoff passed: exact to-buy quantities, two public routes, copy and denied-clipboard fallback. No provider made a network request or received a cart.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
