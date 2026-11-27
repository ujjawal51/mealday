import {localDay,validCalorie,calorieRows,recipeCalories} from './calorie-log.js';
export function createCalorieTracker({screen,escape:esc,request,account,notify}){
 let day=localDay(),photo=null,objectUrl='',estimate=null,photoBusy=false,token=0,availability=null,recipe=null,recipeList=[],searchToken=0,lookupTimer,scope='',editId=null,draft={name:'',kcal:'',source:'Manual'};
 const active=()=>document.body.dataset.view==='calories';
 const storeKey=()=> 'mealday.calories.v1:'+encodeURIComponent(account()?.id||'guest');
 const input=(selector)=>screen.querySelector(selector);
 function rows(){try{return calorieRows(JSON.parse(localStorage.getItem(storeKey())||'[]'));}catch{return [];}}
 function write(next){try{localStorage.setItem(storeKey(),JSON.stringify(next.slice(0,500)));return true;}catch{notify('Could not save calories on this device.');return false;}}
 function release(){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';photo=null;estimate=null;photoBusy=false;token++;}
 function leave(){release();clearTimeout(lookupTimer);searchToken++;draft={name:'',kcal:'',source:'Manual'};editId=null;recipe=null;recipeList=[];}
 function show(){
  const key=storeKey();if(scope&&scope!==key){leave();availability=null;}scope=key;
  const logged=rows().filter(r=>r.day===day),total=logged.reduce((n,r)=>n+r.kcal,0);
  screen.innerHTML='<section class="calorie-page"><header class="calorie-hero"><p>MEALDAY · FOOD LOG</p><h1>Calorie tracker</h1><div><strong>'+total.toLocaleString()+'</strong> kcal logged</div><label>Day <input type="date" data-calorie="day" max="'+localDay()+'" value="'+esc(day)+'"></label></header>'+
   '<section class="calorie-card" aria-labelledby="cal-photo"><h2 id="cal-photo">Log a meal</h2>'+
   (objectUrl?'<img class="food-preview" src="'+esc(objectUrl)+'" alt="Selected meal photo">':'<p>Take a meal photo, use a Mealday recipe estimate, or enter calories yourself.</p>')+
   '<div class="calorie-photo-actions"><button type="button" class="button green" data-calorie="camera">Take photo</button><button type="button" class="button ghost" data-calorie="upload">Choose photo</button></div><input type="file" data-calorie="photo" id="cal-camera" accept="image/*" capture="environment" hidden><input type="file" data-calorie="photo" id="cal-upload" accept="image/*" hidden>'+
   (objectUrl?'<p class="calorie-help">The photo stays on this screen unless you choose an AI estimate.</p>'+photoActions():'')+
   '<details class="calorie-search" '+(recipe||recipeList.length?'open':'')+'><summary>Use a Mealday recipe estimate</summary><label class="field">Find a recipe<input class="control" type="search" data-calorie="recipe-search" placeholder="e.g. Paneer bhurji"></label><div class="calorie-matches" aria-live="polite">'+matches()+'</div></details>'+
   '<form id="calorie-form"><label class="field">Meal name<input class="control" name="meal" maxlength="100" value="'+esc(draft.name)+'" required placeholder="e.g. Paneer bhurji and roti"></label>'+
   '<label class="field">Calories (kcal)<input class="control" name="kcal" type="number" min="1" max="10000" step="1" inputmode="numeric" value="'+esc(draft.kcal)+'" required></label>'+
   '<p class="calorie-help">Source: '+esc(draft.source)+'. You can adjust the number before saving.</p><button class="button green wide" type="submit">'+(editId?'Save changes':'Log meal')+'</button></form></section>'+
   '<section class="calorie-card" aria-labelledby="cal-log"><h2 id="cal-log">Meals logged</h2><p class="calorie-help">Your log is stored on this device. Photos are not saved with entries.</p>'+
   (logged.length?'<ul class="calorie-list">'+logged.map(r=>'<li><div><strong>'+esc(r.name)+'</strong><small>'+esc(r.source)+' · '+r.kcal+' kcal</small></div><button class="button ghost small" type="button" data-calorie="edit" data-id="'+esc(r.id)+'" aria-label="'+esc('Edit '+r.name)+'">Edit</button><button class="button ghost small" type="button" data-calorie="remove" data-id="'+esc(r.id)+'" aria-label="'+esc('Remove '+r.name)+'">Remove</button></li>').join('')+'</ul>':'<p>No meals logged for this day yet.</p>')+'</section></section>';
 }
 function photoActions(){
  if(estimate)return '<div class="calorie-estimate"><strong>'+esc(estimate.name)+' · '+estimate.minKcal+'–'+estimate.maxKcal+' kcal</strong><p>'+esc(estimate.portion)+' · Rough AI estimate. Check the serving and adjust before saving.</p><button type="button" class="button ghost" data-calorie="use-photo">Use estimate</button></div>';
  if(!availability?.configured)return '<p class="calorie-help">Automatic photo estimates aren’t available here yet. Use a recipe estimate or enter calories.</p>';
  if(!availability.signedIn)return '<p class="calorie-help">Sign in to estimate from a photo. You can still log a meal manually.</p>';
  return '<button type="button" class="button ghost wide" data-calorie="estimate" '+(photoBusy?'disabled':'')+'>'+(photoBusy?'Estimating…':'Estimate with AI')+'</button><p class="calorie-help">Only this action sends the image to OpenAI. Choose a photo that contains food only.</p>';
 }
 function matches(){
  if(recipe)return '<p><strong>'+esc(recipe.name)+'</strong></p><label class="field">Servings eaten<input class="control" type="number" min=".1" max="12" step=".1" data-calorie="servings" value="1"></label>'+
   (recipe.nutrition?.complete?'<button class="button ghost" type="button" data-calorie="use-recipe">Use recipe calories</button>':'<p>Complete nutrition is unavailable for this recipe. You can enter calories yourself.</p>');
  return recipeList.map(r=>'<button class="button ghost small" type="button" data-calorie="recipe" data-id="'+esc(r.id)+'">'+esc(r.name)+'</button>').join(' ');
 }
 function rememberDraft(){
  const form=input('#calorie-form');if(form){draft.name=form.elements.meal.value;draft.kcal=form.elements.kcal.value;}
 }
 async function enter(openCamera=false){
  show();
  if(openCamera)input('#cal-camera')?.click();
  const expected=scope;
  try{const response=await fetch('/api/calories/status',{credentials:'same-origin'});if(response.ok&&active()&&scope===expected){
   availability=await response.json();if(active()&&scope===expected&&photo){rememberDraft();show();}
  }}catch{}
 }
 async function includePhoto(file){
  if(!file)return;
  if(!/^image\/(?:jpeg|png|webp|heic|heif|avif)$/i.test(file.type)||file.size>15*1024*1024){notify('Choose a JPG, PNG, WebP or supported phone photo under 15 MB.');return;}
  rememberDraft();release();photo=file;objectUrl=URL.createObjectURL(file);show();
 }
 async function encodeImage(){
  const image=new Image();image.src=objectUrl;
  if(image.decode)await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
  if(!image.naturalWidth||!image.naturalHeight)throw Error('This image could not be opened. Try a JPG or PNG.');
  const ratio=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  let url=canvas.toDataURL('image/jpeg',.78);if(url.length>520000)url=canvas.toDataURL('image/jpeg',.55);
  if(url.length>520000||!url.startsWith('data:image/jpeg;base64,'))throw Error('Could not prepare this photo. Try another one.');
  return url.split(',')[1];
 }
 async function click(button){
  const action=button.dataset.calorie;if(!action||!active())return false;
  if(scope!==storeKey()){show();return true;}
  const id=button.dataset.id;
  if(action==='camera'||action==='upload'){input(action==='camera'?'#cal-camera':'#cal-upload')?.click();return true;}
  rememberDraft();
  if(action==='estimate'&&photo&&!photoBusy&&availability?.signedIn){
   const seq=++token,expected=scope;photoBusy=true;show();
   try{
    const image=await encodeImage();if(!active()||seq!==token||scope!==expected)return true;
    const response=await fetch('/api/calories/estimate',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({image})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Estimate unavailable.');
    if(active()&&seq===token&&scope===expected)estimate=data;
   }catch(e){if(active()&&seq===token)notify(e.message||'Photo estimate unavailable.');}
   finally{if(active()&&seq===token){rememberDraft();photoBusy=false;show();}}
  }
  if(action==='use-photo'&&estimate){draft={name:estimate.name,kcal:Math.round((estimate.minKcal+estimate.maxKcal)/2),source:'Photo estimate'};show();input('[name=kcal]')?.focus();}
  if(action==='recipe'){
   const seq=++searchToken,expected=scope;
   try{const data=await request('/api/recipe/'+encodeURIComponent(id));if(active()&&seq===searchToken&&scope===expected){recipe=data;rememberDraft();show();}}catch{notify('Recipe is unavailable.');}
  }
  if(action==='use-recipe'&&recipe){
   const kcal=recipeCalories(recipe.nutrition,Number(input('[data-calorie=servings]').value));
   if(!kcal){notify('Enter between 0.1 and 12 servings.');return true;}
   draft={name:recipe.name.slice(0,100),kcal,source:'Recipe estimate'};show();input('[name=kcal]')?.focus();
  }
  if(action==='edit'){
   const entry=rows().find(r=>r.id===id);if(entry){editId=id;draft={name:entry.name,kcal:entry.kcal,source:entry.source};show();input('[name=meal]')?.focus();}
  }
  if(action==='remove'){
   if(write(rows().filter(r=>r.id!==id))){if(editId===id){editId=null;draft={name:'',kcal:'',source:'Manual'};}show();notify('Meal removed.');}
  }
  return true;
 }
 function change(el){
  if(!active())return;
  if(el.dataset.calorie==='photo')void includePhoto(el.files?.[0]);
  if(el.dataset.calorie==='day'&&/^\d{4}-\d{2}-\d{2}$/.test(el.value)&&el.value<=localDay()){
   day=el.value;leave();show();
  }
 }
 function search(el){
  if(!active()||el.dataset.calorie!=='recipe-search')return;
  clearTimeout(lookupTimer);const seq=++searchToken,q=el.value.trim(),expected=scope;
  if(q.length<2){recipeList=[];input('.calorie-matches').innerHTML='';return;}
  lookupTimer=setTimeout(async()=>{
   try{const result=await request('/api/recipes?q='+encodeURIComponent(q));
    if(!active()||seq!==searchToken||scope!==expected||!el.isConnected)return;
    recipe=null;recipeList=result.recipes.slice(0,6);input('.calorie-matches').innerHTML=matches()||'<p>No matching recipes.</p>';
   }catch{if(active()&&seq===searchToken&&el.isConnected)input('.calorie-matches').textContent='Recipes are unavailable. Enter calories manually.';}
  },250);
 }
 function save(form){
  if(scope!==storeKey()){leave();show();notify('Your account changed. Please enter the meal again.');return;}
  const name=form.elements.meal.value.trim(),kcal=Number(form.elements.kcal.value);
  if(!name||name.length>100||!validCalorie(kcal)){notify('Enter a meal name and whole calories from 1 to 10,000.');return;}
  const entry={id:editId||crypto.randomUUID(),day,name,kcal,source:draft.source};
  if(write([entry,...rows().filter(r=>r.id!==entry.id)])){leave();show();notify('Meal logged.');}
 }
 return {show,enter,leave,click,change,search,save};
}
