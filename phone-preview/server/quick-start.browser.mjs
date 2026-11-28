// Fresh guest on the production entrypoint, with the published catalogue and no external writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
const rows=catalogueDocuments();
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
server.on('request',createApp({origin,store:{publishedRecipes:async()=>rows,storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:320,height:740},reducedMotion:'reduce'});
 await page.goto(origin);
 await page.getByRole('button',{name:'Quick start',exact:true}).click();
 await page.getByRole('heading',{name:'Plan your first week'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('spinbutton',{name:'People',exact:true}).fill('3');
 await page.locator('[name=cuisine]').selectOption('South Asian');
 await page.getByText('Diet, allergies & cooking preferences',{exact:true}).click();
 await page.locator('[name=minutes]').selectOption('15');
 await page.getByRole('button',{name:'Build my week'}).click();
 await page.getByRole('alert').waitFor({timeout:25000});
 assert.match(await page.getByRole('alert').innerText(),/recipes match/);
 assert.equal(await page.locator('[name=minutes]').inputValue(),'15');
 assert.equal(await page.locator('[name=cuisine]').inputValue(),'South Asian');
 assert.equal(await page.locator('[name=days]:checked').count(),5);
 assert.equal(await page.evaluate(()=>localStorage.getItem('mealday.android.v1')),null);
 await page.getByRole('button',{name:'Try 2 days',exact:true}).waitFor();
 await page.getByRole('button',{name:'Try up to 30 minutes',exact:true}).click();
 await page.waitForSelector('body[data-view=week]',{timeout:30000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));
 assert.equal(saved.profile.people,3);assert.equal(saved.profile.budget,150);assert.equal(saved.profile.shop,'LuLu');assert.equal(saved.profile.city,'Dubai');
 assert.equal(saved.result.meals.length,5);assert(saved.result.total<=150);
 assert.equal(new Set(saved.result.meals.map(m=>m.id)).size,5);
 for(const meal of saved.result.meals){assert.equal(meal.cuisine,'South Asian');assert.equal(meal.mealComplete,true);assert(meal.minutes<=30);}
 await page.getByText('Catalogue estimate · delivery not included',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Manage subscription'}).count(),0);
 await page.getByRole('button',{name:/Contact us/}).click();
 const support=page.getByRole('dialog',{name:'Contact us'});
 assert.match(await support.innerText(),/privately/);assert.equal(await support.getByRole('link').count(),0);
 assert.equal(await support.getByRole('textbox',{name:'How can we help?'}).count(),1);
 console.log(JSON.stringify({message:'Guest planning and recovery passed',total:saved.result.total,meals:saved.result.meals.map(m=>m.name)}));
} finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
