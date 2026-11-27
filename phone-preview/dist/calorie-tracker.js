import {localDay,validCalorie,calorieRows,recipeCalories} from './calorie-log.js';
const mealTypes=['Breakfast','Lunch','Dinner','Snack'];
const empty=()=>({name:'',kcal:'',source:'Manual',portion:'',mealType:'Dinner'});
const glyphs={
 camera:'<path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="4"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m4 18 5-5 3 3 4-4 5 5"/>',
 book:'<path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 5h10m-10 4h10m-10 4h7"/>',
 plate:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
 edit:'<path d="m4 20 5-1L20 8l-4-4L5 15l-1 5Zm10-14 4 4"/>',
 back:'<path d="m14 6-6 6 6 6M8 12h12"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
};
const icon=name=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'+glyphs[name]+'</svg>';
const displayDay=(day,opts)=>new Date(day+'T12:00:00').toLocaleDateString(undefined,opts);
function endingWeek(day){
 const date=new Date(day+'T12:00:00');
 return Array.from({length:7},(_,i)=>{const d=new Date(date);d.setDate(d.getDate()-6+i);return localDay(d);});
}
export function createCalorieTracker({screen,escape:esc,request,account,notify}){
 let step='journal',manualBack='journal',day=localDay(),photo=null,objectUrl='',estimate=null,scanError='',token=0,scanAbort=null,availability=null,recipe=null,results=[],searchToken=0,lookupTimer,availabilitySeq=0,photoSeq=0,scope='',editId=null,draft=empty(),entryError='',statusText='';
 const active=()=>document.body.dataset.view==='calories';
 const storeKey=()=> 'mealday.calories.v1:'+encodeURIComponent(account()?.id||'guest');
 const $=q=>screen.querySelector(q);
 const btn=(label,action,variant='secondary',symbol='',attrs='')=>'<button type="button" class="scan-btn '+variant+'" data-calorie="'+action+'" '+attrs+'>'+(symbol?icon(symbol):'')+'<span>'+label+'</span></button>';
 const image=(klass='')=>'<img class="scan-photo '+klass+'" src="'+esc(objectUrl)+'" alt="Selected meal photo">';
 const hiddenInputs='<input type="file" data-calorie="photo" id="cal-camera" accept="image/*" capture="environment" hidden><input type="file" data-calorie="photo" id="cal-upload" accept="image/*" hidden>';
 function rows(){try{return calorieRows(JSON.parse(localStorage.getItem(storeKey())||'[]'));}catch{return [];}}
 function write(next){try{localStorage.setItem(storeKey(),JSON.stringify(next.slice(0,500)));return true;}catch{notify('Could not save calories on this device.');return false;}}
 function abortScan(){scanAbort?.abort();scanAbort=null;token++;}
 function release(){photoSeq++;abortScan();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';photo=null;estimate=null;scanError='';}
 function resetDraft(){clearTimeout(lookupTimer);searchToken++;draft=empty();editId=null;recipe=null;results=[];entryError='';}
 function leave(){release();resetDraft();step='journal';statusText='';availability=null;day=localDay();availabilitySeq++;}
 function go(next){step=next;show();window.scrollTo(0,0);$('h1')?.focus({preventScroll:true});}
 function head(title,kicker,back=''){
  return '<header class="scan-head">'+(back?btn('Back',back,'icon-only','back','aria-label="Back"'):'')+
   '<div><p>'+esc(kicker)+'</p><h1 tabindex="-1">'+title+'</h1></div>'+
   (step==='capture'?btn('Food log','journal','pill','book'):'')+'</header>';
 }
 function track(activeStep){
  return '<ol class="scan-steps" aria-label="Photo logging steps">'+['Photo','Review','Log'].map((x,i)=>'<li '+(i===activeStep?'aria-current="step"':'')+'><b>'+(i+1)+'</b>'+x+'</li>').join('')+'</ol>';
 }
 function capture(){
  return head('Scan a meal','Calorie tracker')+track(0)+
   '<div class="scan-viewfinder" aria-hidden="true"><div class="scan-frame"></div><div class="scan-plate">'+icon('plate')+'</div><span>Centre your whole plate</span></div>'+
   '<div class="scan-capture"><p>Use good light and include the whole portion.</p>'+btn('Take photo','camera','shutter','camera')+
   '<div class="scan-secondary">'+btn('Choose photo','upload','secondary','image')+btn('Enter manually','manual','secondary','edit')+'</div></div>'+
   '<div class="scan-recipe-link">'+btn('Use a Mealday recipe','recipes','text','book')+'</div>';
 }
 function review(){
  const ready=availability?.configured&&availability.signedIn;
  const provider=availability?.provider==='cloudflare'?'Cloudflare Workers AI':'OpenAI';
  return head('Review your photo','Scan a meal','capture')+track(1)+image()+
   '<section class="scan-sheet"><h2>Does the whole meal fit?</h2><p>If anything is cut off, retake the photo.</p>'+
   (ready?btn('Estimate with AI','estimate','primary')+'<small>Only tapping Estimate with AI sends this photo to '+provider+'. Use a food-only photo.</small>':
   '<div class="scan-notice" role="status">'+(!availability?'Checking photo estimate availability…':availability.configured?'Sign in to use automatic photo estimates.':'Automatic photo estimates aren’t available right now. The photo alone won’t calculate calories.')+' You can still log this meal.</div>')+
   '<div class="scan-secondary">'+btn('Retake','camera')+btn('Choose photo','upload','secondary','image')+'</div>'+
   '<div class="scan-secondary">'+btn('Use a Mealday recipe','recipes','secondary','book')+btn('Enter manually','manual','secondary','edit')+'</div></section>';
 }
 function progress(){
  return head('Estimating calories','Scan a meal')+track(1)+'<div class="scan-processing">'+image()+'<div class="scan-line"></div></div>'+
   '<section class="scan-sheet" role="status" aria-live="polite"><h2>Looking at your meal…</h2><p>We’re estimating from what’s visible. You’ll review the serving and calories before saving.</p></section>'+btn('Cancel','cancel-scan','secondary');
 }
 function result(){
  return head('Scan result','Scan a meal','review')+track(1)+image('compact')+
   '<section class="scan-sheet estimate-sheet"><span class="scan-badge">AI estimate</span><h2>'+esc(estimate.name)+'</h2><p>'+esc(estimate.portion)+'</p>'+
   '<div class="scan-range"><strong>'+esc(estimate.minKcal)+'–'+esc(estimate.maxKcal)+'</strong><span>estimated kcal</span></div>'+
   '<p>Portions and hidden ingredients can change this estimate.</p>'+btn('Review &amp; edit','use-photo','primary')+btn('Retake photo','camera','text','camera')+'</section>';
 }
 function failure(){
  return head('Scan unavailable','Scan a meal','review')+(objectUrl?image('compact'):'')+'<section class="scan-sheet"><h2>Couldn’t estimate this photo</h2><p role="alert">'+esc(scanError)+'</p>'+
   btn('Try again','estimate','primary')+'<div class="scan-secondary">'+btn('Retake','camera')+btn('Enter manually','manual','secondary','edit')+'</div>'+btn('Use a Mealday recipe','recipes','text','book')+'</section>';
 }
 function recipeChoices(){
  if(recipe)return '<div class="scan-recipe-selection"><h2>'+esc(recipe.name)+'</h2><label class="field">Servings eaten<input class="control" type="number" min=".1" max="12" step=".1" data-calorie="servings" value="1"></label>'+
   (recipeCalories(recipe.nutrition,1)?'<output class="scan-range" aria-live="polite" data-kcal-preview>'+recipeCalories(recipe.nutrition,1)+' estimated kcal</output>'+btn('Use recipe calories','use-recipe','primary'):'<p>Complete nutrition isn’t available for this recipe.</p>'+btn('Enter manually','manual','secondary'))+'</div>';
  return results.map(r=>btn(esc(r.name),'recipe','recipe-option', 'plate','data-id="'+esc(r.id)+'"')).join('');
 }
 let recipeBack='journal';
 function recipes(){
  return head('Find your meal','Recipe estimate',recipeBack)+
   '<section class="scan-sheet"><h2>Mealday recipes</h2><p>Calories are estimated from the recipe and the servings you ate.</p><label class="field">Find a recipe<input class="control" type="search" data-calorie="recipe-search" placeholder="e.g. Lentil soup"></label><div class="calorie-matches" aria-live="polite">'+recipeChoices()+'</div></section>';
 }
 function edit(){
  const back=editId?'journal':draft.source==='Photo estimate'?'result':draft.source==='Recipe estimate'?'recipe-back':objectUrl&&manualBack!=='recipes'?'review':manualBack==='recipes'?'recipe-back':manualBack;
  return head(editId?'Edit meal':'Confirm meal','Your food log',back)+track(2)+
   '<section class="scan-sheet '+(objectUrl?'with-thumb':'')+'">'+(objectUrl?image('thumb'):'')+'<span class="scan-badge">'+esc(draft.source)+'</span>'+
   '<form id="calorie-form"><label class="field">Meal name<input class="control" name="meal" maxlength="100" required value="'+esc(draft.name)+'" placeholder="e.g. Paneer bhurji"></label>'+
   '<label class="field">Portion (optional)<input class="control" name="portion" maxlength="160" value="'+esc(draft.portion)+'" placeholder="e.g. 1 bowl"></label>'+
   '<label class="field">Meal type<select class="control" name="mealType">'+mealTypes.map(x=>'<option '+(x===draft.mealType?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
   '<label class="field">Calories (kcal)<input class="control" name="kcal" required type="number" min="1" max="10000" step="1" inputmode="numeric" value="'+esc(draft.kcal)+'"></label>'+
   '<p class="scan-muted">Logging for '+esc(displayDay(day,{month:'short',day:'numeric'}))+'. You can change these values before saving.</p>'+
   (entryError?'<p role="alert">'+esc(entryError)+'</p>':'')+
   '<button class="scan-btn primary" type="submit">'+icon('check')+'<span>'+(editId?'Save changes':'Log meal')+'</span></button></form></section>';
 }
 function remove(){
  return head('Remove meal?','Your food log','edit-back')+
   '<section class="scan-sheet"><p>Remove '+esc(draft.name)+' from this day’s log?</p>'+btn('Remove from log','remove','danger')+btn('Keep meal','edit-back','secondary')+'</section>';
 }
 function journal(){
  const all=rows(),logged=all.filter(r=>r.day===day),total=logged.reduce((n,r)=>n+r.kcal,0),today=localDay();
  return head('Food log','Calorie tracker')+
   (statusText?'<p class="scan-saved" role="status">'+icon('check')+esc(statusText)+'</p>':'')+
   '<div class="journal-date"><strong>'+esc(day===today?'Today':displayDay(day,{weekday:'long',month:'short',day:'numeric'}))+'</strong>'+
   '<label class="scan-date-label">Pick a date<input type="date" data-calorie="day" aria-label="Log date" max="'+today+'" value="'+esc(day)+'"></label></div>'+
   '<div class="journal-week" aria-label="Recent days">'+endingWeek(today).map(d=>btn(esc(displayDay(d,{weekday:'short'}))+'<b>'+esc(displayDay(d,{day:'numeric'}))+'</b>','journal-day','day','',
   'data-id="'+d+'" aria-label="'+esc(displayDay(d,{weekday:'long',month:'short',day:'numeric'}))+'" aria-pressed="'+(d===day)+'"')).join('')+'</div>'+
   '<section class="journal-total"><div><p>ENERGY LOGGED</p><strong>'+total.toLocaleString()+'</strong><span> kcal</span></div><span class="journal-total-icon">'+icon('plate')+'</span></section>'+
   '<section class="scan-sheet tracker-actions"><h2>Log a meal</h2>'+btn('Scan a meal','capture','primary','camera')+
   '<p class="tracker-availability" role="status" '+(availabilityText()?'':'hidden')+'>'+esc(availabilityText())+'</p>'+
   '<div class="scan-secondary">'+btn('Find a recipe','recipes','secondary','book')+btn('Add manually','manual','secondary','edit')+'</div></section>'+
   '<section class="scan-sheet"><h2>Logged meals</h2>'+
   (logged.length?'<ul class="journal-meals">'+logged.map(r=>'<li><div><strong>'+esc(r.name)+'</strong><small>'+esc([r.mealType,r.portion,r.source].filter(Boolean).join(' · '))+'</small></div><b>'+r.kcal+' kcal</b>'+
   btn('Edit','edit','icon-only','edit','data-id="'+esc(r.id)+'" aria-label="'+esc('Edit '+r.name)+'"')+'</li>').join('')+'</ul>':
   '<div class="journal-empty">'+icon('plate')+'<p>No meals logged for this day.</p></div>')+
   '<small>Saved on this device. Photos aren’t included in the log.</small></section>';
 }
 function show(){
  const key=storeKey();if(scope&&scope!==key)leave();scope=key;
  const screenHtml=({capture,review,progress,result,failure,recipes,edit,journal,remove})[step]();
  screen.innerHTML='<section class="calorie-flow" data-stage="'+step+'">'+screenHtml+hiddenInputs+
   (step==='edit'&&editId?btn('Remove meal','ask-remove','danger'):'')+'</section>';
 }
 function availabilityText(){return availability?.configured===false?'Automatic photo estimates are off. Use a recipe or add calories manually.':availability?.configured&&!availability.signedIn?'Sign in to get automatic photo estimates.':'';}
 function updateAvailability(){if(step==='review')show();else if(step==='journal'){const p=$('.tracker-availability');if(p){p.textContent=availabilityText();p.hidden=!p.textContent;}}}
 async function enter(){
  show();
  const expected=scope,seq=++availabilitySeq;
  const current=()=>active()&&scope===expected&&storeKey()===expected&&seq===availabilitySeq;
  try{
   const response=await fetch('/api/calories/status',{credentials:'same-origin'});
   const data=response.ok?await response.json():{configured:false,signedIn:false};
   if(current()){availability=data;updateAvailability();}
  }catch{if(current()&&!availability){availability={configured:false,signedIn:false};updateAvailability();}}
 }
 function syncAccount(){if(active()&&scope!==storeKey())void enter();}
 async function includePhoto(file){
  if(!file)return;
  const known=/^image\/(?:jpeg|png|webp|heic|heif|avif)$/i.test(file.type)||(!file.type&&/\.(?:jpe?g|png|webp|heic|heif|avif)$/i.test(file.name));
  if(!known||file.size>15*1024*1024||!file.size){notify('Choose a JPG, PNG, WebP or supported phone photo under 15 MB.');return;}
  const seq=++photoSeq,expected=storeKey(),expectedStep=step,nextUrl=URL.createObjectURL(file),preview=new Image();
  const loaded=new Promise(resolve=>{preview.onload=()=>resolve(true);preview.onerror=()=>resolve(false);});
  preview.src=nextUrl;
  const ok=preview.decode?await preview.decode().then(()=>true,()=>false):await loaded;
  if(!active()||seq!==photoSeq||storeKey()!==expected||step!==expectedStep||!ok){
   URL.revokeObjectURL(nextUrl);
   if(active()&&seq===photoSeq&&storeKey()===expected&&step===expectedStep&&!ok)notify('This photo could not be opened. Try a JPG or PNG.');
   return;
  }
  release();resetDraft();photo=file;objectUrl=nextUrl;go('review');
  if(!availability)void enter();
 }
 async function encodeImage(url){
  const image=new Image();image.src=url;
  if(image.decode)await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
  if(!image.naturalWidth||!image.naturalHeight)throw Error('This photo could not be opened. Try a JPG or PNG.');
  const ratio=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);
  let jpeg=canvas.toDataURL('image/jpeg',.78);if(jpeg.length>520000)jpeg=canvas.toDataURL('image/jpeg',.55);
  if(jpeg.length>520000||!jpeg.startsWith('data:image/jpeg;base64,'))throw Error('Could not prepare this photo. Try another one.');
  return jpeg.split(',')[1];
 }
 async function runEstimate(){
  if(!photo||!availability?.configured||!availability.signedIn||step==='progress')return;
  abortScan();const seq=token,expected=scope,url=objectUrl,controller=new AbortController();scanAbort=controller;go('progress');
  const valid=()=>active()&&scope===expected&&storeKey()===expected&&seq===token;
  try{
   const image=await encodeImage(url);if(!valid())return;
   const response=await fetch('/api/calories/estimate',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({image}),signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'The estimate is unavailable.');
   if(valid()){estimate=data;go('result');}
  }catch(err){if(valid()){scanError=err.message||'Please try another photo.';go('failure');}}
  finally{if(seq===token)scanAbort=null;}
 }
 async function click(button){
  const action=button.dataset.calorie,id=button.dataset.id;if(!action||!active())return false;
  if(scope!==storeKey()){show();return true;}
  if(action==='camera'||action==='upload'){const input=$(action==='camera'?'#cal-camera':'#cal-upload');if(input){input.value='';input.click();}return true;}
  if(action==='capture'){release();resetDraft();statusText='';go('capture');}
  if(action==='review'&&objectUrl){abortScan();go('review');}
  if(action==='journal'){release();resetDraft();statusText='';go('journal');}
  if(action==='cancel-scan'){abortScan();go('review');}
  if(action==='estimate')await runEstimate();
  if(action==='manual'){manualBack=step==='journal'?'journal':step==='recipes'?'recipes':'capture';resetDraft();go('edit');}
  if(action==='recipe-back')go('recipes');
  if(action==='recipes'){resetDraft();recipeBack=step==='journal'?'journal':objectUrl?'review':'capture';go('recipes');}
  if(action==='result'&&estimate)go('result');
  if(action==='journal-day'&&/^\d{4}-\d{2}-\d{2}$/.test(id)&&id<=localDay()){day=id;statusText='';go('journal');}
  if(action==='use-photo'&&estimate){draft={...empty(),name:estimate.name,kcal:Math.round((estimate.minKcal+estimate.maxKcal)/2),portion:estimate.portion,source:'Photo estimate'};go('edit');}
  if(action==='recipe'){
   const seq=++searchToken,expected=scope;
   try{const r=await request('/api/recipe/'+encodeURIComponent(id));if(active()&&step==='recipes'&&scope===expected&&seq===searchToken){recipe=r;show();}}catch{notify('Recipe is unavailable. You can enter calories manually.');}
  }
  if(action==='use-recipe'&&recipe){
   const serving=Number($('[data-calorie=servings]').value),kcal=recipeCalories(recipe.nutrition,serving);
   if(kcal){draft={...empty(),name:recipe.name.slice(0,100),kcal,portion:serving+(serving===1?' serving':' servings'),source:'Recipe estimate'};go('edit');}
   else notify('Enter between 0.1 and 12 servings.');
  }
  if(action==='edit'){
   const entry=rows().find(r=>r.id===id);if(entry){editId=id;draft={...empty(),...entry};go('edit');}
  }
  if(action==='ask-remove'&&editId)go('remove');
  if(action==='edit-back'&&editId)go('edit');
  if(action==='remove'&&editId&&write(rows().filter(r=>r.id!==editId))){resetDraft();statusText='Meal removed.';go('journal');}
  return true;
 }
 function change(el){
  if(!active())return;
  if(el.dataset.calorie==='photo')void includePhoto(el.files?.[0]);
  if(el.dataset.calorie==='day'&&/^\d{4}-\d{2}-\d{2}$/.test(el.value)&&el.value<=localDay()){
   day=el.value;statusText='';go('journal');
  }
 }
 function search(el){
  if(!active())return;
  if(el.dataset.calorie==='servings'){const kcal=recipeCalories(recipe?.nutrition,Number(el.value));const out=$('[data-kcal-preview]');if(out)out.textContent=kcal?kcal+' estimated kcal':'Enter 0.1 to 12 servings.';return;}
  if(el.dataset.calorie!=='recipe-search')return;
  clearTimeout(lookupTimer);const seq=++searchToken,q=el.value.trim(),expected=scope;
  recipe=null;results=[];
  if(q.length<2){$('.calorie-matches').innerHTML='';return;}
  lookupTimer=setTimeout(async()=>{
   try{const found=await request('/api/recipes?q='+encodeURIComponent(q));
    if(!active()||step!=='recipes'||seq!==searchToken||scope!==expected||!el.isConnected)return;
    results=found.recipes.slice(0,6);$('.calorie-matches').innerHTML=recipeChoices()||'<p>No matching recipes.</p>';
   }catch{if(active()&&seq===searchToken&&el.isConnected)$('.calorie-matches').textContent='Recipes are unavailable. Enter calories manually.';}
  },230);
 }
 function save(form){
  if(scope!==storeKey()){show();notify('Your account changed. Please enter the meal again.');return;}
  const name=form.elements.meal.value.trim(),kcal=Number(form.elements.kcal.value),portion=form.elements.portion.value.trim(),mealType=form.elements.mealType.value;
  if(!name||name.length>100||!validCalorie(kcal)||portion.length>160||!mealTypes.includes(mealType)){
   draft={...draft,name,kcal,portion,mealType};entryError='Enter a meal name and whole calories from 1 to 10,000.';show();return;
  }
  const entry={id:editId||crypto.randomUUID(),day,name,kcal,source:draft.source,portion,mealType};
  if(write([entry,...rows().filter(r=>r.id!==entry.id)])){statusText=editId?'Meal updated.':'Meal logged.';release();resetDraft();go('journal');}
 }
 function back(){
  if(step==='capture')return false;
  const control=$('.scan-head [aria-label=Back]')||$('.calorie-flow [data-calorie=cancel-scan]');
  if(control){void click(control);return true;}
  return false;
 }
 return {show,enter,leave,syncAccount,click,change,search,save,back};
}
