import {validateSnapshot} from './catalogue-schema.js';
export function createLiveCatalogue({install,fetcher=(...args)=>fetch(...args),storage,clock=()=>Date.now(),status=()=>{}}){
 try{if(storage===undefined)storage=globalThis.localStorage;}catch{}
 const key='mealday.public-catalogue.v1';let current,pending,loaded=false,mode='bundled-offline';
 const report=value=>{mode=value;status(value);};
 function apply(value){const snapshot=validateSnapshot(value);if(current?.revision!==snapshot.revision)install(snapshot);current=snapshot;}
 function cached(){try{const value=JSON.parse(storage?.getItem(key)||'null');if(value&&clock()-value.savedAt>=0&&clock()-value.savedAt<7*86400000)apply(value.snapshot);}catch{}}
 async function refresh(){
  if(pending)return pending;
  pending=(async()=>{
   if(!loaded){loaded=true;cached();}
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetcher('/api/catalogue',{credentials:'omit',cache:'no-store',headers:current?{'If-None-Match':'"'+current.revision+'"'}:{},signal:controller.signal});
    if(response.status===304){if(!current)throw Error('Missing cached catalogue');report('live');return;}
    if(!response.ok)throw Error('Recipe service unavailable');
    const value=await response.json();apply(value);
    try{storage?.setItem(key,JSON.stringify({savedAt:clock(),snapshot:current}));}catch{}
    report('live');
   }catch{report(current?'cached-offline':'bundled-offline');}
   finally{clearTimeout(timer);}
  })().finally(()=>{pending=null;});
  return pending;
 }
 return {refresh,mode:()=>mode};
}
