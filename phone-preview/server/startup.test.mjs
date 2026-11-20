import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const dist=new URL('../dist/',import.meta.url);
async function boot(stored=null){
 const classes={toggle(){},contains(){return false;}};
 const node=()=>({innerHTML:'',dataset:{},classList:classes,setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},querySelector(){return null;}});
 const screen=node(),nav=node(),dialog=node(),main=node(),toast=node();
 screen.querySelector=s=>s==='.wizard-body'?{scrollTop:0}:null;screen.querySelectorAll=()=>[];
 const nodes={'#screen':screen,'.nav':nav,'#dialog':dialog,'#main':main,'#toast':toast};
 const buttons=['week','recipes','cookbook','shopping','settings'].map(view=>({...node(),dataset:{view},classList:{toggle(){}},setAttribute(){},removeAttribute(){}}));
 const storage=new Map(stored?[['mealday.android.v1',JSON.stringify(stored)]]:[]);
 const events={};
 const context=vm.createContext({console,Intl,URL,URLSearchParams,Request,Response,crypto,TextEncoder,TextDecoder,HTMLImageElement:class{},setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{origin:'https://mealday.test',hash:''},history:{replaceState(){}},fetch:async()=>new Response('{}',{status:404}),document:{body:{dataset:{}},hidden:false,querySelector:s=>nodes[s]||null,querySelectorAll:()=>buttons,getElementById:id=>nodes['#'+id],addEventListener:(name,fn)=>{events[name]=fn;}}});
 vm.runInContext('window=this;window.addEventListener=function(name,fn){ };window.scrollTo=function(){};Object.hasOwn=undefined;structuredClone=undefined;',context);
 const html=await readFile(new URL('index.html',dist),'utf8'),entry=html.match(/src="\/(client-[a-f0-9]+\.js)"/)[1];
 assert.ok(html.indexOf('/startup.js')<html.indexOf('/'+entry));
 vm.runInContext(await readFile(new URL('startup.js',dist),'utf8'),context);
 try{vm.runInContext(await readFile(new URL(entry,dist),'utf8'),context);}catch(e){throw Error(e.message);}
 return {screen,buttons,context,storage,events};
}
test('Fresh phone boots the shipped classic bundle without module loading or modern hasOwn/structuredClone APIs',async()=>{
 const {screen,buttons,context}=await boot();assert.equal(context.mealdayStarted,true);assert.match(screen.innerHTML,/Build your plan/);assert.match(screen.innerHTML,/Made delicious/);assert.ok(buttons.every(b=>b.innerHTML.includes('<svg')));
});
test('Existing kitchen survives the new entrypoint and renders its plan',async()=>{
 const state={profile:{name:'Chef',days:[0],people:1,mealTypes:['dinner'],shop:'LuLu',budget:100},pantry:{},checked:[],favorites:[],result:{meals:[],items:[],total:0}};
 const {screen,storage}=await boot(state);assert.match(screen.innerHTML,/Your plans/);assert.equal(JSON.parse(storage.get('mealday.android.v1')).profile.name,'Chef');
});

test('All 14 onboarding screens return, keep choices on Back, and require explicit allergy review',async()=>{
 const {screen,events,storage}=await boot();
 const click=async(action,id,field)=>events.click({target:{closest:()=>({dataset:{action,id,field}})}});
 const next=()=>click('next-step');
 const at=n=>assert.match(screen.innerHTML,new RegExp('>'+n+' of 14<'));
 await click('start-setup');at(1);
 events.input({target:{id:'wizard-name',value:'Test Chef'}});await next();at(2);
 await click('pick-one','family','goal');await next();at(3);
 await click('pick-one','Dubai','city');await next();at(4);
 await click('pick-many','Arab','cuisines');await next();at(5);
 await next();at(6);await click('pick-one','45','minutes');await next();at(7);
 await next();at(8);await click('pick-one','Carrefour','shop');await next();at(9);
 assert.match(screen.innerHTML,/>4<\/strong>/);await next();at(10);
 await next();at(11);await next();at(12);await next();at(13);
 await next();at(13);await click('pick-many','None','allergies');await next();at(14);
 assert.match(screen.innerHTML,/Generate plan/);assert.match(screen.innerHTML,/appliance-kitchen/);
 await click('back-step');at(13);assert.match(screen.innerHTML,/aria-pressed="true"/);
 assert.equal(storage.has('mealday.android.v1'),false,'Unfinished wizard must not overwrite the kitchen');
});
