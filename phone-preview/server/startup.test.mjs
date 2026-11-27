import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const dist=new URL('../dist/',import.meta.url);
async function boot(stored=null,{fetch:fetcher=async()=>new Response('{}',{status:404})}={}){
 const classes={toggle(){},contains(){return false;}};
 const node=()=>({innerHTML:'',dataset:{},classList:classes,setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},querySelector(){return null;}});
 const screen=node(),nav=node(),dialog=node(),main=node(),toast=node();
 dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 screen.querySelector=s=>s==='.wizard-body'?{scrollTop:0}:null;screen.querySelectorAll=()=>[];
 const nodes={'#screen':screen,'.nav':nav,'#dialog':dialog,'#main':main,'#toast':toast};
 const buttons=['week','recipes','plan','settings'].map(view=>({...node(),dataset:{view},classList:{toggle(){}},setAttribute(){},removeAttribute(){}}));
 const storage=new Map(stored?[['mealday.android.v1',JSON.stringify(stored)]]:[]);
 const events={};
 const context=vm.createContext({console,Intl,URL,URLSearchParams,Request,Response,AbortController,FormData:class{constructor(form){this.fields=form.fields;}get(key){return this.fields[key]??null;}},crypto,TextEncoder,TextDecoder,HTMLImageElement:class{},setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{origin:'https://mealday.test',hash:''},history:{replaceState(){}},fetch:fetcher,document:{body:{dataset:{}},hidden:false,querySelector:s=>nodes[s]||null,querySelectorAll:()=>buttons,getElementById:id=>nodes['#'+id],addEventListener:(name,fn)=>{events[name]=fn;}}});
 vm.runInContext('window=this;window.addEventListener=function(name,fn){ };window.scrollTo=function(){};Object.hasOwn=undefined;structuredClone=undefined;',context);
 const html=await readFile(new URL('index.html',dist),'utf8'),entry=html.match(/src="\/(client-[a-f0-9]+\.js)"/)[1];
 assert.ok(html.indexOf('/startup.js')<html.indexOf('/'+entry));
 vm.runInContext(await readFile(new URL('startup.js',dist),'utf8'),context);
 try{vm.runInContext(await readFile(new URL(entry,dist),'utf8'),context);}catch(e){throw Error(e.message);}
 return {screen,buttons,context,storage,events,dialog};
}
test('Fresh phone boots the shipped classic bundle without module loading or modern hasOwn/structuredClone APIs',async()=>{
 const {screen,buttons,context}=await boot();assert.equal(context.mealdayStarted,true);assert.match(screen.innerHTML,/Get started/);assert.match(screen.innerHTML,/Plan dinners/);assert.match(screen.innerHTML,/src="\/chef.png" alt="Mealday chef"/);assert.match(screen.innerHTML,/Pause slideshow/);assert.ok(buttons.every(b=>b.innerHTML.includes('<svg')));
});
test('Existing kitchen survives the new entrypoint and renders its plan',async()=>{
 const state={profile:{name:'Chef',days:[0],people:1,mealTypes:['dinner'],shop:'LuLu',budget:100},pantry:{},checked:[],favorites:[],result:{meals:[],items:[],total:0}};
 const {screen,storage}=await boot(state);assert.match(screen.innerHTML,/My week|Chef/);assert.equal(JSON.parse(storage.get('mealday.android.v1')).profile.name,'Chef');
});

test('All 18 onboarding screens return, keep choices on Back, and require explicit allergy review',async()=>{
 const {screen,events,storage}=await boot();
 const click=async(action,id,field)=>events.click({target:{closest:()=>({dataset:{action,id,field}})}});
 const next=()=>click('next-step');
 const at=n=>assert.match(screen.innerHTML,new RegExp('>'+n+' of 18<'));
 await click('start-setup');at(1);
 assert.match(screen.innerHTML,/How old are you/);assert.match(screen.innerHTML,/24 and under/);
 events.input({target:{id:'wizard-name',value:'Test Chef'}});await next();at(1);
 await click('pick-one','25-34','ageGroup');await next();at(2);
 assert.match(screen.innerHTML,/👨‍👩‍👧‍👦/);await click('pick-one','family','goal');await next();at(3);
 assert.match(screen.innerHTML,/😴/);await click('pick-one','time','obstacle');await next();assert.match(screen.innerHTML,/story-chef/);await click('back-step');at(3);await next();await click('story-next');at(4);
 await click('pick-one','likely','savingConfidence');await next();at(5);
 await click('pick-one','45','minutes');await next();at(6);
 assert.match(screen.innerHTML,/social|<svg/);assert.match(screen.innerHTML,/Instagram/);await click('pick-one','instagram','heardAbout');await next();assert.match(screen.innerHTML,/story-time/);await click('story-next');at(7);
 assert.match(screen.innerHTML,/shop-wordmark/);await click('pick-one','Carrefour','shop');await next();at(8);
 assert.match(screen.innerHTML,/>4<\/strong>/);assert.doesNotMatch(screen.innerHTML,/data-field="days"|data-field="mealTypes"|City &amp;/);
 await click('people','1');assert.match(screen.innerHTML,/>5<\/strong>/);await next();at(9);
 assert.match(screen.innerHTML,/Which days will you cook/);assert.doesNotMatch(screen.innerHTML,/data-field="mealTypes"|class="counter"/);
 await click('pick-many','6','days');await next();at(10);
 assert.match(screen.innerHTML,/Which meals should we plan/);assert.doesNotMatch(screen.innerHTML,/data-field="days"|class="counter"/);
 await click('pick-many','lunch','mealTypes');await next();at(11);
 await click('pick-one','Dubai','city');await next();at(12);
 await click('pick-many','Arab','cuisines');await next();at(13);
 await next();at(14);assert.match(screen.innerHTML,/catalogue prices/i);assert.doesNotMatch(screen.innerHTML,/1040|save an average/);
 await next();at(15);await next();at(16);await next();at(17);
 await next();at(17);await click('pick-many','None','allergies');await next();at(18);
 assert.match(screen.innerHTML,/Generate plan/);assert.match(screen.innerHTML,/appliance-kitchen/);await next();assert.match(screen.innerHTML,/story-benefits/);assert.match(screen.innerHTML,/ref-wall-row row-2/);await click('story-motion');assert.match(screen.innerHTML,/ref-paused/);await click('back-step');at(18);
 await click('back-step');at(17);assert.match(screen.innerHTML,/aria-pressed="true"/);
 for(let n=16;n>=10;n--){await click('back-step');at(n);}
 assert.match(screen.innerHTML,/data-field="mealTypes" data-id="lunch" aria-pressed="true"/);
 await click('back-step');at(9);assert.match(screen.innerHTML,/data-field="days" data-id="6" aria-pressed="true"/);
 await click('back-step');at(8);assert.match(screen.innerHTML,/>5<\/strong>/);
 assert.equal(storage.has('mealday.android.v1'),false,'Unfinished wizard must not overwrite the kitchen');
});

test('Settings actions open real controls and saved-meal reset preserves notes and ratings',async()=>{
 const {screen,events,dialog,storage}=await boot({profile:{name:'Chef',city:'Dubai',shop:'LuLu',days:[0],people:1,budget:100,mealTypes:['dinner']},pantry:{},favorites:[{id:'rice'}],recipeJournal:{rice:{rating:5,note:'Keep'}},checked:[],result:null});
 const click=async(action)=>events.click({target:{closest:()=>({dataset:{action}})}});
 await events.click({target:{closest:()=>({dataset:{view:'settings'}})}});
 assert.match(screen.innerHTML,/Your account/);assert.match(screen.innerHTML,/Download kitchen backup/);
 await click('weekly-reminder');assert.match(dialog.innerHTML,/id="reminder-form"/);assert.match(dialog.innerHTML,/type="time"/);assert.match(dialog.innerHTML,/Download calendar reminder/);
 await click('close');await click('language');assert.match(dialog.innerHTML,/Active language/);
 await click('close');await click('edit-name');assert.match(dialog.innerHTML,/id="name-form"/);
 await click('close');await click('cloud-account');assert.match(dialog.innerHTML,/Download kitchen backup/);assert.match(dialog.innerHTML,/Check cloud connection/);
 await click('close');
 await click('reset-suggestions');assert.match(dialog.innerHTML,/confirm-suggestions/);await click('confirm-suggestions');
 await click('rate-app');assert.match(dialog.innerHTML,/Enjoying Mealday/);await click('rating-continue');assert.match(dialog.innerHTML,/feedback-form/);await click('close');
 await click('request-feature');assert.match(dialog.innerHTML,/What would you like Mealday/);await click('close');
 await click('subscription');assert.match(dialog.innerHTML,/No billing is connected/);await click('close');
 await click('delete-account');assert.equal(dialog.open,false);assert.doesNotMatch(dialog.innerHTML,/delete-account-form/);
 await click('clear-saved');assert.match(dialog.innerHTML,/confirm-saved/);await click('confirm-saved');
 const saved=JSON.parse(storage.get('mealday.android.v1'));assert.equal(saved.suggestionsReset,true);assert.deepEqual(saved.planHistory,[]);assert.equal(saved.favorites.length,0);assert.equal(saved.recipeJournal.rice.rating,5);assert.equal(saved.recipeJournal.rice.note,'Keep');
});

test('The shipped support form waits for a receipt and retries with the same reference',async()=>{
 const requests=[];
 const {dialog,events}=await boot(null,{fetch:async(path,options)=>{
   if(path!=='/api/feedback')return new Response('{}',{status:404});
   assert.equal(options.credentials,'omit');
   const body=JSON.parse(options.body);requests.push(body);
   if(requests.length===1)return new Response('{}',{status:503});
   return Response.json({reference:body.submissionId},{status:201});
 }});
 await events.click({target:{closest:()=>({dataset:{action:'contact'}})}});
 assert.match(dialog.innerHTML,/How can we help/);
 assert.match(dialog.innerHTML,/name="replyEmail"/);
 assert.doesNotMatch(dialog.innerHTML,/github|Save feedback draft/i);
 const button={disabled:false,textContent:'Send message'},alert={},input={disabled:false};
 const form={id:'feedback-form',isConnected:true,fields:{kind:'support',message:'Need help',replyEmail:'guest@example.com'},
   querySelector:selector=>selector.startsWith('button')?button:alert,querySelectorAll:()=>[input]};
 const submit=()=>events.submit({target:form,preventDefault(){}});
 const pending=submit();
 assert.equal(button.disabled,true);
 assert.equal(input.disabled,true);
 await submit();
 await pending;
 assert.equal(requests.length,1);
 assert.match(alert.textContent,/could not be sent/);
 assert.equal(button.disabled,false);
 assert.equal(form.fields.message,'Need help');
 await submit();
 assert.deepEqual(requests[0],requests[1]);
 assert.match(dialog.innerHTML,/Message sent/);
 assert.ok(dialog.innerHTML.includes(requests[1].submissionId));
});
