// Public synthetic kitchen; no production account or supplier requests.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
const meals=[['arab-shakshuka','Classic Shakshuka with Pita',30,15.95],['arab-ful','Ful medames with Arabic bread',15,10.58],['arab-mujadara','Mujadara — lentils, rice & onions',35,20.28],['arab-hummus','Hummus, cucumber & pita plate',10,11.87],['arab-adas-complete','Red lentil soup, rice & cucumber',50,13.67]].map(([id,name,minutes,ingredientCost],day)=>({id,name,minutes,ingredientCost,day,meal:'dinner',diet:'vegetarian',cuisine:'Arab',imageUrl:'/recipes/'+id+'.webp'}));
const state={profile:{name:'Ujjawal',shop:'LuLu',city:'Dubai',people:1,days:[0,1,2,3,4],mealTypes:['dinner'],budget:90,minutes:60,cuisine:'Arab',diet:'Any',allergies:[],appliances:['Hob'],cuisines:['Arab'],priorities:['Everyday']},pantry:{},checked:['onion'],favorites:[],extraGroceries:[{id:'extra',name:'Bananas',quantity:'2 lb',checked:true}],result:{total:72.35,meals,plan:meals.map(m=>({id:m.id,day:m.day,meal:m.meal})),items:[{key:'onion',name:'Onion',need:250,have:0,pack:1000,packs:1,cost:5,category:'Vegetables',unit:'g'}]}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
server.on('request',createApp({origin,store:{storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>localStorage.setItem('mealday.android.v1',JSON.stringify(value)),state);
 const page=await context.newPage();await page.goto(origin);
 await page.getByRole('heading',{name:'Chef Ujjawal!',exact:true}).waitFor();
 const font=await page.evaluate(async()=>{
  const faces=await document.fonts.load('650 14px "Exo 2"','Classic Shakshuka');
  return {loaded:faces.some(face=>face.status==='loaded'),title:getComputedStyle(document.querySelector('.meal-name')).fontFamily,button:getComputedStyle(document.querySelector('.week-bottom .green')).fontFamily};
 });
 assert.equal(font.loaded,true);
 assert.match(font.title,/^"Exo 2"/);
 assert.match(font.button,/^"Exo 2"/);
 const asset=await page.request.get(origin+'/fonts/exo-2-latin.woff2');
 assert.equal(asset.status(),200);
 assert.equal(asset.headers()['content-type'],'font/woff2');
 assert.match(await page.locator('.plan-salutation').innerText(),/GOOD (MORNING|AFTERNOON|EVENING)/);
 assert.match(await page.locator('.overview-cost').innerText(),/AED 72\.35\s*\/ 90/);
 assert.equal(await page.locator('.meal-row').count(),5);
 assert.equal(await page.locator('.meal-day').first().innerText(),'MONDAY');
 const first=page.locator('.meal-row').first();
 const [card,badge,photo]=await Promise.all([first.boundingBox(),first.locator('.meal-day').boundingBox(),first.locator('img').boundingBox()]);
 assert(Math.abs((card.x+card.width/2)-(badge.x+badge.width/2))<2,'Day badge is centred on the card');
 assert(badge.y<card.y&&badge.y+badge.height>card.y,'Day badge straddles the card border');
 assert(Math.abs(photo.width-photo.height)<1,'Meal thumbnail is square');
 assert.equal(await first.getByRole('button',{name:'Swap Monday dinner'}).isEnabled(),true);
 assert.equal(await page.getByRole('button',{name:'Share plan',exact:true}).isEnabled(),true);
 assert.match(await page.locator('.grocery-link').innerText(),/2\/2 items bought/);
 await page.waitForFunction(()=>[...document.querySelectorAll('.meal-open img')].every(i=>i.complete&&i.naturalWidth>0));
 if(process.env.MEALDAY_PLAN_PREVIEW)await page.screenshot({path:process.env.MEALDAY_PLAN_PREVIEW});
 if(process.env.PLAN_SCREENSHOT==='1')console.log('PLAN_SCREENSHOT '+(await page.screenshot()).toString('base64'));
 await page.getByRole('button',{name:/Tap to view Grocery list/}).click();await page.getByRole('heading',{name:'Grocery list',exact:true}).waitFor();assert.match(await page.locator('body').evaluate(node=>getComputedStyle(node).fontFamily),/^"Exo 2"/);assert.equal(await page.locator('.grocery-done').innerText(),'2/2 done');
 await page.getByRole('button',{name:'Shop or share',exact:true}).click();
 await page.getByRole('heading',{name:'Shop or share',exact:true}).waitFor();
 await page.getByRole('button',{name:'Carrefour',exact:true}).click();
 assert.match(await page.getByRole('link',{name:'Open Carrefour'}).getAttribute('href'),/^https:\/\/www\.carrefouruae\.com/);
 await page.getByRole('button',{name:'Grocery list',exact:true}).click();
 await page.getByRole('button',{name:'Back to my week',exact:true}).click();
 await page.getByRole('button',{name:'View Monday meal plan',exact:true}).click();
 await page.getByRole('heading',{name:'Monday · Meal plan',exact:true}).waitFor();
 await page.getByRole('button',{name:'View recipe',exact:true}).click();
 await page.getByRole('heading',{name:'Classic Shakshuka with Pita',exact:true}).waitFor();
 await page.getByRole('button',{name:'Back from recipe',exact:true}).click();
 await page.getByRole('heading',{name:'Monday · Meal plan',exact:true}).waitFor();
 await page.locator('.nav [data-view=week]').click();
 await page.getByRole('button',{name:'Plan preferences',exact:true}).click();await page.waitForSelector('body[data-view=plan]');
 await page.locator('.nav [data-view=week]').click();
 await page.locator('.meal-open').first().click();await page.waitForSelector('body[data-view=recipe]');
 assert.equal(await page.locator('.recipe-page h1').innerText(),'Classic Shakshuka with Pita');
 await page.evaluate(()=>window.mealdayBack());await page.waitForSelector('body[data-view=week]');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);}
 assert.equal(await page.getByRole('button',{name:'Rebuild plan',exact:true}).isEnabled(),true);
 const checkType=async (p,selector)=>{
  const target=p.locator(selector).first();
  await target.waitFor();
  // Read the current connected element. View updates can replace the visible node
  // between Playwright resolving a locator and evaluating its computed style.
  await p.waitForFunction(selector=>{
   const node=document.querySelector(selector);
   return node?.isConnected&&getComputedStyle(node).fontFamily.startsWith('"Exo 2"');
  },selector,{timeout:5000});
  assert.equal(await p.evaluate(async()=>(await document.fonts.load('650 14px "Exo 2"','Mealday')).some(face=>face.status==='loaded')),true);
  for(const width of [320,390]){
   await p.setViewportSize({width,height:844});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),selector+' at '+width);
  }
 };
 await checkType(page,'.nav button');
 await page.locator('.nav [data-view=pantry]').click();
 // The initial search field is replaced when ingredient options arrive.
 await page.locator('#kitchen-results [data-kitchen-item]').first().waitFor();
 await checkType(page,'#kitchen-search');
 await page.locator('.nav [data-view=plan]').click();await checkType(page,'.preferences-heading h1');
 await page.locator('.nav [data-view=shopping]').click();await checkType(page,'#screen h1');
 await page.locator('.nav [data-view=settings]').click();await checkType(page,'.setting-row');
 await page.locator('[data-action=open-recipes]').click();await checkType(page,'#screen h1');
 await page.locator('.nav [data-view=plan]').click();
 await page.locator('.preference-camera').click();await page.getByRole('heading',{name:'Food log',exact:true}).waitFor();await checkType(page,'#screen h1');
 const welcome=await browser.newPage({viewport:{width:390,height:844}});
 await welcome.goto(origin);
 await checkType(welcome,'.phone-welcome h1');
 await welcome.getByRole('button',{name:'Get started',exact:true}).click();await checkType(welcome,'.wizard h1');
 for(const path of ['/login.html','/signup.html']){
  await welcome.goto(origin+path);await checkType(welcome,'.account-heading');
 }
 await welcome.close();
 console.log('Shared typography passed: Mealday screens, forms, navigation, onboarding and standalone sign-in.');
 console.log('Plan layout passed: five meal photos, actual AED budget, extras-aware grocery progress, grocery/preferences/recipe navigation and responsive widths.');
 await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
