// Local catalogue fixtures only. No production writes or paid provider requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
const docs=catalogueDocuments(),manifest=JSON.parse(await readFile(new URL('../source/generated-recipe-images.json',import.meta.url)));
const state={profile:{name:'Image test',city:'Dubai',shop:'LuLu',people:1,budget:200,minutes:90,cuisine:'UAE mix',cuisines:['UAE mix'],diet:'Any',days:[0],mealTypes:['dinner'],allergies:[],appliances:['Hob'],priorities:[]},pantry:{},favorites:[],checked:[],result:{meals:[],plan:[],items:[],total:0}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({origin,store:{publishedRecipes:async()=>docs,storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.addInitScript(value=>localStorage.setItem('mealday.android.v1',JSON.stringify(value)),state);const page=await context.newPage();await page.goto(origin);await page.locator('.nav [data-view=recipes]').click();
 for(const a of manifest.images){const doc=docs.find(d=>d.id===a.id);await page.getByRole('searchbox',{name:'Search recipes'}).fill(doc.data.name);await page.locator('[data-action=recipe][data-id="'+a.id+'"]').click();await page.waitForSelector('.recipe-page');assert.equal(await page.locator('.recipe-cover>img').getAttribute('src'),a.path);await page.waitForFunction(()=>document.querySelector('.recipe-cover>img')?.naturalWidth>0);assert.equal(await page.locator('.recipe-photo-caption').innerText(),'AI meal illustration');await page.getByRole('button',{name:'Back from recipe',exact:true}).click();}
 console.log('Image browser passed: all 18 previously missing images load and decode on actual recipe screens with illustration captions.');await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
