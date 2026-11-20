import {engineUrl} from './engine-url.js';
let pending;
// Render the kitchen first. The full catalogue is downloaded only for recipe operations.
export function loadRecipeEngine(){
  if(window.MealdayRecipeEngine)return Promise.resolve(window.MealdayRecipeEngine);
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const fail=()=>{clearTimeout(timeout);script.remove();pending=null;reject(new Error('Recipe data could not load. Check your connection and try again.'));};
    const timeout=setTimeout(fail,20000);
    script.src=engineUrl;script.async=true;
    script.onload=()=>{clearTimeout(timeout);if(window.MealdayRecipeEngine)resolve(window.MealdayRecipeEngine);else fail();};
    script.onerror=fail;
    document.head.appendChild(script);
  });
  return pending;
}
export async function personalizedApi(request,url){return (await loadRecipeEngine())(request,url);}
