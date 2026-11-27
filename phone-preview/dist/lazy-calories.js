import {caloriesUrl} from './calories-url.js';
let pending;
export function loadCalorieTracker(){
 if(window.MealdayCalorieTrackerFactory)return Promise.resolve(window.MealdayCalorieTrackerFactory);
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const fail=()=>{clearTimeout(timeout);script.remove();pending=null;reject(Error('Could not open the calorie tracker.'));};
  const timeout=setTimeout(fail,12000);
  script.src=caloriesUrl;script.async=true;
  script.onload=()=>{if(!window.MealdayCalorieTrackerFactory){fail();return;}clearTimeout(timeout);resolve(window.MealdayCalorieTrackerFactory);};
  script.onerror=fail;document.head.appendChild(script);
 });
 return pending;
}
