import {createPreviewSlideshow} from './preview-slideshow.js';
import {createCloudBackup} from './cloud-backup.js';
import {createCookingTimer,timerText} from './cooking-timer.js';
import {COOKING_HISTORY_KEY,emptyHistory,loadHistory,hasCooked,recordCook,undoCookedMark,historyEntries} from './cooking-history.js';
import {filterSavedRecipes} from './recipe-filters.js';
import {calculateNutrition,nutritionSource} from './nutrition.js';
import {recipePhotos} from './recipe-photos.js';
import {personalizedApi as api} from './recommendations.js';
const $ = (selector, root = document) => root.querySelector(selector);
const screen = $('#screen');
const dialog = $('#dialog');
const toast = $('#toast');
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const ICONS = {
  week:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-14 5h2m4 0h2"/>',
  recipes:'<path d="M4 4h7c2 0 3 1 3 3v14c0-2-1-3-3-3H4zm16 0h-3c-2 0-3 1-3 3v14c0-2 1-3 3-3h3z"/>',
  shopping:'<path d="M3 9h18l-2 11H5L3 9Zm4 0 4-6m6 6-4-6m-5 9v5m4-5v5m4-5v5"/>',
  pantry:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 11h16m-9-4h2m-2 8h2"/>',
  pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  settings:'<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
  refresh:'<path d="M20 7v5h-5m-11 5v-5h5m-4-3a8 8 0 0 1 13-3l2 2M4 16l2 2a8 8 0 0 0 13-3"/>',
  swap:'<path d="M4 7h15m-4-4 4 4-4 4m5 6H5m4-4-4 4 4 4"/>',
  right:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-3c0-3 12-3 12 0v3m0-15c4 0 4 6 0 6m2 3c3 0 4 2 4 4v2"/>',
  heart:'<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
  wallet:'<path d="M20 8V5H6a3 3 0 0 0 0 6h15v9H6a3 3 0 0 1-3-3V8m18 6h-5v3h5"/>',
  leaf:'<path d="M19 4c-5 0-13 2-13 9 0 4 2 6 6 6 7 0 9-8 7-15ZM5 20l9-9"/>',
  hob:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="3"/><circle cx="16.5" cy="12" r="2.3"/>',
  oven:'<rect x="4" y="2" width="16" height="20" rx="2"/><rect x="7" y="10" width="10" height="8" rx="1"/><path d="M4 7h16m-12-2h.1m4 0h.1m4 0h.1"/>',
  microwave:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 5v14m3-10h.1m0 4h.1M6 12c2 3 4-3 6 0"/>',
  fryer:'<path d="M8 3h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm-4 9h16m-8 3v4"/><circle cx="12" cy="8" r="1.5"/>',
  plate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3.5"/><path d="M2 3v5c0 2 3 2 3 0V3m-1.5 7v11M22 3v18m0-18c-2 2-2 5-2 8h2"/>',
  edit:'<path d="m4 20 4-.8L20 7l-3-3L5 16l-1 4ZM14 7l3 3"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  gear:'<path d="M10 3h4l.6 2.5 1.6.9 2.5-.7 2 3.4-1.9 1.8v2.2l1.9 1.8-2 3.4-2.5-.7-1.6.9L14 21h-4l-.6-2.5-1.6-.9-2.5.7-2-3.4 1.9-1.8v-2.2L3.3 9.1l2-3.4 2.5.7 1.6-.9L10 3Z"/><circle cx="12" cy="12" r="3"/>',
};
const labels = {week:'Plan',recipes:'Meals',shopping:'Shopping',pantry:'Kitchen',plan:'Preferences',settings:'Settings',history:'Cooking history'};
function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||'')+'</svg>';}
const esc = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = amount => new Intl.NumberFormat('en-AE',{minimumFractionDigits:0,maximumFractionDigits:2}).format(amount);
const quantity = n => new Intl.NumberFormat('en-AE',{maximumFractionDigits:2}).format(n);
const cap = word => word.charAt(0).toUpperCase()+word.slice(1);
const defaults = {name:'',city:'Dubai',shop:'LuLu',people:2,budget:150,minutes:30,cuisine:'UAE mix',diet:'Any',days:[0,1,2,3,4],mealTypes:['dinner'],allergies:[],appliances:['Hob'],cuisines:['UAE mix'],priorities:['Everyday']};
const key = 'mealday.android.v1';
function read() {
  try { const value=JSON.parse(localStorage.getItem(key)||'null'); return value&&value.profile&&value.pantry?value:null; }
  catch { return null; }
}
let state = read() || {profile:{...defaults},pantry:{},result:null,checked:[],favorites:[],seed:0};
let storedCookingHistory;
try{storedCookingHistory=JSON.parse(localStorage.getItem(COOKING_HISTORY_KEY)||'null');}catch{}
let cookingHistory=loadHistory(storedCookingHistory,state.cooked,[...(state.result?.meals||[]),...(state.favorites||[])]);
let options=null, view=state.result?'week':'welcome', day=state.profile.days[0], busy=false, error='', toastTimer, requestId=0, recipeSequence=0;
let library={q:'',cuisine:'',diet:'',saved:false,rows:[],count:0,next:null,loading:false,error:''};
let libraryDelay, swapIndex=null;
let detail=null, detailTab='ingredients', guidedStep=null, recipeOrigin='week', recipeScroll=0, recipeSequenceId=0;
const cookingTimer=createCookingTimer({onTick:updateTimerDisplay,onComplete:()=>notify('Your 5-minute timer finished.')});
let cloudApplying=false;
const cloudBackup=createCloudBackup({snapshot:()=>({state:structuredClone(state),history:structuredClone(cookingHistory)}),apply:data=>{
  cloudApplying=true;state=data.state;cookingHistory=loadHistory(data.history);persist();persistHistory();cloudApplying=false;detail=null;guidedStep=null;library.rows=[];library.count=0;
  setView(state.result?'week':'welcome',false);
},changed:()=>{if(view==='settings')render();}});
function persist(){try{localStorage.setItem(key,JSON.stringify(state));if(!cloudApplying)cloudBackup.localChanged();}catch{notify('Browser storage is unavailable. Changes work until this page closes.');}}
function persistHistory(){try{localStorage.setItem(COOKING_HISTORY_KEY,JSON.stringify(cookingHistory));if(!cloudApplying)cloudBackup.localChanged();return true;}catch{notify('Cooking history could not be saved. Keep this page open and allow browser storage.');return false;}}
function logCook(recipe){cookingHistory=recordCook(cookingHistory,recipe,new Date().toISOString(),crypto.randomUUID());persistHistory();}
function notify(message){clearTimeout(toastTimer);toast.textContent=message;toastTimer=setTimeout(()=>toast.textContent='',3500);}
function recommendationSignals(){
  return {ratings:Object.entries(state.recipeJournal||{}).filter(([,entry])=>Number.isInteger(entry.rating)&&entry.rating>=1&&entry.rating<=5).slice(-500).map(([id,entry])=>[id,entry.rating]),saved:state.favorites.map(r=>r.id).slice(-500),cooked:historyEntries(cookingHistory).filter(e=>e.cookedAt).slice(0,80).map(e=>[e.recipeId,e.cookedAt]),previous:(state.result?.meals||[]).map(r=>r.id),plans:(state.planHistory||[]).slice(-6)};
}
function rememberPlan(result){
  return [...(state.planHistory||[]),{at:new Date().toISOString(),ids:result.meals.map(r=>r.id)}].slice(-8);
}
async function request(path,body) {
  if(body&&['/api/plan','/api/swaps','/api/swap'].includes(path))body={...body,signals:recommendationSignals()};
  const url=new URL(path,location.origin);
  const init=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
  const res=await api(new Request(url,init),url);
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Mealday could not finish this action. Please try again.');
  return data;
}
function button(label,action,style='ghost',symbol='',extra=''){
  return '<button type="button" class="button '+style+'" data-action="'+action+'" '+extra+'>'+(symbol?icon(symbol):'')+label+'</button>';
}
function photo(meal){
  return recipePhotos[meal.id]||'/recipe-image-unavailable.svg';
}
function meta(meal){return '<div class="meta"><span>'+icon('time')+esc(meal.minutes)+' min</span><span>'+esc(meal.cuisine)+'</span><span>'+esc(cap(meal.diet))+'</span></div>';}
function initNavigation(){
  for(const b of document.querySelectorAll('.nav button')) {
    const name=b.dataset.view;
    b.innerHTML=icon(name==='plan'?'settings':name==='settings'?'gear':name==='recipes'?'plate':name)+'<span>'+labels[name]+'</span>';
  }
}
function render(){
  document.body.dataset.view=view;
  $('.nav').hidden=['welcome','setup','recipe'].includes(view);
  for(const b of document.querySelectorAll('.nav button')){
    const active=b.dataset.view===view||(b.dataset.view==='week'&&view==='shopping')||(b.dataset.view==='plan'&&view==='pantry')||(b.dataset.view==='settings'&&view==='history');b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  }
  screen.setAttribute('aria-busy',String(busy&&view!=='setup'));
  if(view==='welcome')screen.innerHTML=welcome();
  if(view==='setup'){
    if(busy)screen.innerHTML=renderGeneration();
    else renderWizard();
  }
  if(view==='week')screen.innerHTML=week();
  if(view==='recipes')renderRecipes();
  if(view==='shopping')screen.innerHTML=shopping();
  if(view==='pantry')screen.innerHTML=pantry();
  if(view==='plan')screen.innerHTML=planSettings();
  if(view==='settings')screen.innerHTML=settings();
  if(view==='history')screen.innerHTML=cookingHistoryPage();
  if(view==='recipe'&&detail)renderRecipeDetail(detail);
  if(view==='welcome')previewSlideshow.start();else {previewSlideshow.stop();previewHovered=false;}
}
function heading(title,description){return '<div class="page-head"><h1>'+title+'</h1><p>'+description+'</p></div>';}
function week(){
  const result=state.result,p=state.profile;
  const rows=result?.meals.map(m=>{
    const tag=m.minutes<=30?'Speedy meals':m.diet==='vegan'||m.diet==='vegetarian'?'Plant-based':m.cuisine;
    const tone=m.minutes<=30?'quick':m.diet==='vegan'||m.diet==='vegetarian'?'plant':'home';
    const cost=Number.isFinite(m.ingredientCost)?'<span title="Estimated cost of ingredients used">AED '+money(m.ingredientCost*p.people)+'</span>':'';
    return '<article class="meal-row"><span class="meal-day">'+DAYS[m.day]+(p.mealTypes.length>1?' · '+esc(cap(m.meal)):'')+'</span><button class="meal-open" type="button" data-action="recipe" data-id="'+esc(m.id)+'"><img loading="lazy" src="'+photo(m)+'" alt=""><div class="meal-body"><h3 class="meal-name">'+esc(m.name)+'</h3><span class="meal-tag '+tone+'">'+(hasCooked(cookingHistory,m.id)?'Cooked':esc(tag))+'</span><div class="meta"><span>'+icon('time')+m.minutes+' min</span><span>'+icon('people')+p.people+'</span>'+cost+'</div>'+(m.recommendationReason?'<p class="meal-recommendation">'+esc(m.recommendationReason)+'</p>':'')+'</div></button></article>';
  }).join('');
  const items=result?.items.filter(item=>item.packs>0)||[];
  const bought=items.filter(item=>state.checked.includes(item.key)).length;
  return '<header class="plan-greeting"><h1>'+(p.name?'Chef '+esc(p.name)+'!':'My week')+'</h1>'+button('Planned for '+esc(p.shop),'go-plan','shop-pill','shopping')+'</header>'+
    '<section class="plan-overview" aria-label="Weekly budget and groceries"><div class="overview-card"><span>Est. cost</span><div class="overview-cost"><strong>AED '+money(result?.total||0)+'</strong><small> / '+money(p.budget)+'</small></div><progress max="'+p.budget+'" value="'+Math.min(result?.total||0,p.budget)+'" aria-label="Estimated grocery cost against budget"></progress></div>'+
    '<button class="overview-card grocery-link" type="button" data-action="go-shopping"><span>Tap to view</span><strong>Grocery list</strong><small>'+bought+'/'+items.length+' items bought</small><progress max="'+Math.max(items.length,1)+'" value="'+bought+'" aria-label="Grocery shopping progress"></progress></button></section>'+
    (error?'<p class="notice" role="alert">'+esc(error)+'</p>':'')+
    recommendationSummary(result)+'<div class="meal-list">'+(rows||'<div class="empty">Generate your first plan.</div>')+'</div>'+
    '<div class="week-bottom">'+button(busy?'Planning…':'Rebuild plan','generate','green wide','refresh',busy?'disabled':'')+button('','go-plan','ghost icon-only','settings','aria-label="Plan preferences"')+'</div>';
}
function recommendationSummary(result){
  const info=result?.recommendationInfo;
  if(!info)return '';
  if(info.status!=='applied')return '<p class="plan-personalisation">Your plan fits your preferences. Personalisation was unavailable for this rebuild.</p>';
  const factors=[info.ratings?'ratings':'',info.saved?'saved meals':'',(info.recentCooks||info.recentMeals)?'recent meals':''].filter(Boolean);
  return '<p class="plan-personalisation">Suggestions use your '+esc(factors.join(', '))+'.'+(info.recentRemaining?' Some recent meals remain after balancing your ratings and current limits.':'')+(info.lowRatedRemaining?' Some lower-rated meals remain to fit your current limits.':'')+'</p>';
}
function keepChecked(previous,next,checked){
  const before=new Map((previous?.items||[]).map(item=>[item.key,item]));
  return checked.filter(id=>next.items.some(item=>item.key===id&&item.packs===before.get(id)?.packs&&item.pack===before.get(id)?.pack));
}
async function generate(profile=state.profile){
  if(busy)return;
  const attempt=++requestId;
  busy=true;error='';
  if(!dialog.open)render();
  try{
    const seed=state.seed+1;
    const onboarding=view==='setup';
    if(onboarding)await new Promise(resolve=>setTimeout(resolve,40));
    const result=await request('/api/plan',{profile,pantry:state.pantry,seed});
    if(attempt!==requestId)return;
    if(onboarding&&view==='setup'){
      screen.innerHTML=renderGeneration(true);
      await new Promise(resolve=>setTimeout(resolve,450));
    }
    state={...state,profile,result,seed,checked:[],planHistory:rememberPlan(result)};
    day=profile.days[0];persist();
    if(dialog.open)dialog.close();
    setView('week');
    notify('Your '+result.meals.length+' meals are planned.');
  }catch(err){
    error=err.message;
    if(dialog.open){const message=$('#form-error',dialog);if(message){message.hidden=false;message.textContent=error;}else notify(error);}
  }finally{busy=false;if(['week','setup','plan'].includes(view))render();}
}
function dropdown(name,values,value){
  return '<select class="control" name="'+name+'">'+values.map(v=>'<option '+(String(v)===String(value)?'selected':'')+' value="'+esc(v)+'">'+esc((name==='minutes'||name==='wizard-minutes')?(v===1440?'Plan ahead':v+' minutes'):v)+'</option>').join('')+'</select>';
}
function chips(name,values,selected){
  return '<div class="choice-chips">'+values.map(([value,label])=>'<label><input name="'+name+'" value="'+esc(value)+'" type="checkbox" '+(selected.includes(value)?'checked':'')+'> '+esc(label)+'</label>').join('')+'</div>';
}
function openDialog(title,description,body){
  if(!dialog.open)dialog.showModal();
  dialog.innerHTML='<div class="dialog-head"><div><h2 id="dialog-title">'+esc(title)+'</h2>'+(description?'<p>'+esc(description)+'</p>':'')+'</div>'+button('','close','ghost icon-only','close','aria-label="Close"')+'</div><div class="dialog-body">'+body+'</div>';
  dialog.setAttribute('aria-labelledby','dialog-title');
}
async function preferences(){
  try{options??=await request('/api/options');}catch(err){notify(err.message);return;}
  const p=state.profile;
  const inputs=[
    ['City','city',options.cities],['Supermarket','shop',options.shops],
    ['Diet','diet',options.diets],['Cuisine','cuisine',options.cuisines],
    ['Max cooking time','minutes',[15,20,30,45,60,90,120,240,1440]],
  ].map(([label,name,opts])=>'<label class="field">'+label+dropdown(name,opts,p[name])+'</label>').join('');
  const sets=[['Planning days','days',DAYS.map((d,i)=>[i,d.slice(0,3)])],['Meals','mealTypes',options.meals.map(x=>[x,cap(x)])],['Appliances','appliances',options.appliances.map(x=>[x,x])],['Ingredients to avoid','allergies',options.allergies.map(x=>[x,x])]];
  openDialog('Plan your meals','Choose your kitchen and cooking routine.',
    '<form id="preferences" class="pref-form"><div class="pref-grid">'+inputs+
    '<label class="field">People<input class="control" type="number" name="people" min="1" max="12" required value="'+esc(p.people)+'"></label>'+
    '<label class="field">Grocery budget (AED)<input class="control" type="number" name="budget" min="20" max="5000" step=".01" required value="'+esc(p.budget)+'"></label></div>'+
    sets.map(([label,name,values])=>'<fieldset><legend>'+label+'</legend>'+chips(name,values,p[name])+'</fieldset>').join('')+
    '<p class="subtle">Check packaged ingredients if you have an allergy.</p><p class="notice" hidden id="form-error" role="alert"></p><div class="bottom">'+button('Cancel','close')+'<button class="button primary">Generate plan</button></div></form>');
}
function renderRecipes(snapshot=false){
  if(!snapshot){
    screen.innerHTML=heading('Recipe library','Find something you’ll enjoy making at home.')+
      '<div class="filter-row"><input class="control" type="search" id="search" aria-label="Search recipes" placeholder="Search recipes" value="'+esc(library.q)+'">'+
      '<select class="control" id="cuisine" aria-label="Filter cuisine"><option value="">All cuisines</option>'+['Emirati','Arab','South Asian','Turkish'].map(c=>'<option '+(c===library.cuisine?'selected':'')+'>'+c+'</option>').join('')+'</select>'+
      '<select class="control" id="diet" aria-label="Filter diet"><option value="">All diets</option>'+['Vegan','Vegetarian','Pescatarian','Non-vegetarian'].map(d=>'<option '+(d===library.diet?'selected':'')+'>'+d+'</option>').join('')+'</select>'+
      button(library.saved?'Show all':'Saved recipes','saved','ghost','heart')+'</div><div id="recipe-results" aria-live="polite"></div>';
  }
  const holder=$('#recipe-results');if(!holder)return;
  const rows=library.saved?filterSavedRecipes(state.favorites,library):library.rows;
  const empty=library.saved?(state.favorites.length?'No saved recipes match your search and filters.':'Save recipes you like to find them here.'):'No recipes matched. Try another search or filter.';
  const clearFilters=library.saved&&state.favorites.length&&!rows.length&&(library.q||library.cuisine||library.diet)?button('Clear filters','clear-recipe-filters','ghost small'):'';
  holder.innerHTML=(library.saved?'<p class="saved-result-count">'+rows.length+' of '+state.favorites.length+' saved recipes</p>':'')+(library.error&&!library.saved?'<p role="alert" class="notice">'+esc(library.error)+'</p>':'')+
    (rows.length?'<div class="cards">'+rows.map(r=>'<article class="recipe-card"><img loading="lazy" src="'+photo(r)+'" alt=""><div class="recipe-card-body"><span class="meal-type">'+esc(r.cuisine)+'</span><h3>'+esc(r.name)+'</h3>'+meta(r)+button('View recipe','recipe','ghost small','right','data-id="'+esc(r.id)+'"')+'</div></article>').join('')+'</div>':
    '<div class="empty">'+(library.loading?'Loading recipes…':empty)+clearFilters+'</div>')+
    (!library.saved&&library.next!==null?'<div class="more">'+button(library.loading?'Loading…':'More recipes','more','ghost','right',library.loading?'disabled':'')+'</div>':'');
}
async function loadRecipes(append=false){
  const seq=++recipeSequence;
  if(library.saved){library.loading=false;library.error='';if(view==='recipes')renderRecipes(true);return;}
  library.loading=true;library.error='';
  if(!append){library.rows=[];library.next=null;}
  renderRecipes(true);
  try{
    const q=new URLSearchParams({q:library.q,cuisine:library.cuisine,diet:library.diet,offset:String(append?library.next||0:0)});
    const data=await request('/api/recipes?'+q);
    if(seq!==recipeSequence)return;
    library.rows=append?[...library.rows,...data.recipes]:data.recipes;library.next=data.next;
  }catch(err){if(seq===recipeSequence)library.error=err.message;}
  finally{if(seq===recipeSequence){library.loading=false;if(view==='recipes')renderRecipes(true);}}
}
function shopping(){
  const result=state.result;
  const p=state.profile;
  const items=result?.items.filter(i=>i.packs>0)||[];
  const categories=Map.groupBy?Map.groupBy(items,i=>i.category||'Groceries'):items.reduce((map,item)=>{
    const label=item.category||'Groceries';if(!map.has(label))map.set(label,[]);map.get(label).push(item);return map;
  },new Map());
  const rows=[...categories].map(([name,list])=>'<section class="grocery-group"><h3>'+esc(name)+'</h3><div class="basket-items">'+
    list.map(i=>'<label class="basket-row '+(state.checked.includes(i.key)?'checked':'')+'"><input type="checkbox" data-grocery="'+esc(i.key)+'" '+(state.checked.includes(i.key)?'checked':'')+'><span><strong>'+esc(i.name)+'</strong><small>'+quantity(i.packs)+' × '+quantity(i.pack)+' '+esc(i.unit)+(i.have?' · '+quantity(i.have)+' '+esc(i.unit)+' at home':'')+'</small></span><span class="price">AED '+money(i.cost)+'</span></label>').join('')+
    '</div></section>').join('');
  return '<div class="subpage-back">'+button('Back to plan','go-week','ghost','back')+'</div><header class="utility-heading"><h1>Groceries</h1><p>'+p.days.length+' cooking days · '+p.people+(p.people===1?' person':' people')+'</p>'+button(esc(p.shop),'go-plan','shop-pill','shopping')+'</header>'+
    (!result?'<div class="empty"><strong>No shopping list yet.</strong>Generate a meal plan to get your list.'+button('Plan my meals','start-setup','green')+'</div>':
      '<div class="surface-card shopping-head"><div><p class="section-caption">Estimated grocery total</p><strong>AED '+money(result.total)+'</strong><p class="subtle">'+items.filter(i=>state.checked.includes(i.key)).length+' of '+items.length+' checked · '+esc(p.shop)+'</p></div>'+button('Copy list','copy','ghost','copy',items.length?'':'disabled')+'</div>'+
      '<details class="surface-card price-explanation"><summary>Price &amp; pack details</summary><p>Catalogue estimates. Check availability and final prices at your supermarket.</p></details>'+
      '<div class="shopping-groups">'+(rows||'<div class="surface-card empty">You have enough ingredients for your plan.</div>')+'</div><div class="setting-list pantry-shortcut">'+settingRow('Already have something?','go-pantry','Update your pantry to adjust the grocery list')+'</div>')+extraGroceryList()+button('Add grocery item','grocery-add','primary wide','plus');
}
function extraGroceryList(){return (state.extraGroceries||[]).length?'<section class="grocery-group extra-groceries"><h3>Extra essentials</h3><div class="basket-items">'+state.extraGroceries.map(i=>'<label class="basket-row '+(i.checked?'checked':'')+'"><input type="checkbox" data-extra="'+esc(i.id)+'" '+(i.checked?'checked':'')+'><strong>'+esc(i.name)+'</strong></label>').join('')+'</div></section>':'';}
function pantry(){
  const contents=Object.entries(state.pantry),data=options?.pantry||[];
  return heading('Kitchen','Keep track of what you already have.')+
    '<div class="panel pantry-summary"><strong>'+contents.length+' ingredients at home</strong><p>Add amounts to deduct them from your grocery list.</p></div>'+
    '<div class="pantry-layout"><section class="pantry-list">'+
    (contents.length?contents.map(([id,value])=>{const item=data.find(i=>i.id===id);return '<article class="pantry-entry"><strong>'+esc(item?.name||id)+'</strong><small>'+quantity(value)+' '+esc(item?.unit||'')+'</small>'+button('Remove','pantry-remove','ghost small','','data-id="'+esc(id)+'" aria-label="Remove '+esc(item?.name||id)+'"')+'</article>';}).join(''):
    '<div class="empty">Your pantry is empty. Add an ingredient you already have at home.</div>')+
    '</section><section class="panel"><h3>Update an ingredient</h3><form id="pantry-form" class="pantry-form"><label>Ingredient<select class="control" name="ingredient" required><option value="">Choose ingredient</option>'+data.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+' ('+esc(i.unit)+')</option>').join('')+'</select></label><label>Amount in the selected unit<input class="control" type="number" name="amount" min=".01" max="100000" step=".01" placeholder="e.g. 250" required></label><button class="button primary">'+icon('plus')+'Save ingredient</button></form></section></div>';
}
async function changePantry(id,amount){
  if(busy)return;
  busy=true;
  const next={...state.pantry};
  if(amount===0)delete next[id];else next[id]=amount;
  try{
    const result=state.result?await request('/api/quote',{profile:state.profile,pantry:next,plan:state.result.plan}):null;
    state={...state,checked:result?keepChecked(state.result,result,state.checked):[],pantry:next,result};
    persist();notify(amount?'Pantry saved.':'Ingredient removed.');
  }catch(err){notify(err.message);}
  finally{busy=false;render();}
}
async function showRecipe(id){
  const active=++recipeSequenceId, origin=view;
  try{
    const recipe=await request('/api/recipe/'+encodeURIComponent(id));
    if(active!==recipeSequenceId||view!==origin)return;
    recipeOrigin=origin;
    recipeScroll=window.scrollY;
    detail=recipe;
    if(cookingHistory.events.some(e=>e.recipeId===recipe.id&&!e.name)){cookingHistory={...cookingHistory,events:cookingHistory.events.map(e=>e.recipeId===recipe.id?{...e,name:recipe.name}:e)};persistHistory();}
    detailTab='ingredients';
    guidedStep=null;
    setView('recipe');
    screen.querySelector('h1')?.focus({preventScroll:true});
  }catch(err){if(active===recipeSequenceId&&view===origin)notify(err.message);}
}
function ingredientIcon(item){
  const symbols=[[/garlic/i,'🧄'],[/tomato/i,'🍅'],[/onion/i,'🧅'],[/pepper|chilli/i,'🌶️'],[/carrot/i,'🥕'],[/egg(?!plant)/i,'🥚'],[/oil/i,'🫒'],[/spice|ground|salt/i,'🧂'],[/rice/i,'🍚'],[/pasta|noodle/i,'🍝'],[/bread|pita/i,'🍞'],[/milk/i,'🥛'],[/cheese/i,'🧀'],[/chicken|beef|lamb/i,'🍗'],[/fish|tuna|salmon/i,'🐟'],[/lemon|lime/i,'🍋'],[/bean|lentil|chickpea/i,'🫘'],[/potato/i,'🥔']];
  return symbols.find(([pattern])=>pattern.test(item.name))?.[1]||'🥣';
}
function renderNutrition(r){
  const result=calculateNutrition(r.items);
  const metrics=[['kcal','kcal','Calories'],['protein','g','Protein'],['carbs','g','Carbs'],['fat','g','Fats']];
  const values=metrics.map(([key,unit,label])=>'<div class="macro-value macro-'+key+'"><strong>'+ (result.complete?Math.round(result.totals[key])+ (unit==='g'?'<span>g</span>':''):'—')+'</strong><small>'+esc(label)+(unit==='kcal'?' · kcal':'')+'</small></div>').join('');
  const matched=result.references.length,total=r.items.length;
  const rows=result.references.map(ref=>'<li><a href="https://fdc.nal.usda.gov/food-details/'+ref.fdcId+'/nutrients" target="_blank" rel="noopener noreferrer">'+esc(ref.name)+'</a><span>'+quantity(ref.grams)+' g per serving · '+Math.round(ref.nutrients.kcal)+' kcal</span><small>'+esc(ref.description)+(ref.note?' · '+esc(ref.note):'')+'</small></li>').join('');
  const missing=result.missing.map(item=>'<li><strong>'+esc(item.name)+'</strong><small>'+esc(item.reason)+'</small></li>').join('');
  return '<section class="recipe-panel recipe-nutrition" aria-labelledby="macro-heading"><h2 id="macro-heading" class="recipe-kicker">Macros · per serving</h2><div class="macro-grid">'+values+'</div><p class="nutrition-status '+(result.complete?'complete':'pending')+'">'+(result.complete?'Calculated estimate · USDA ingredient data':'Complete totals unavailable · '+matched+' of '+total+' ingredients matched')+'</p>'+
    (!result.complete?'<p class="nutrition-explanation">Missing nutrition data for '+esc(result.missing.map(x=>x.name).join(', '))+'. Complete macros need verified data for these ingredients.</p>':'')+
    '<details class="nutrition-sources"><summary>Nutrition sources &amp; calculation</summary><p>Per serving, regardless of your household size. Values use the listed edible ingredient amounts; all listed oil is included. Generic matches, brands, portion sizes and cooking losses can change the result.</p><p><a href="'+nutritionSource.url+'" target="_blank" rel="noopener noreferrer">'+esc(nutritionSource.name)+'</a> · checked '+esc(nutritionSource.retrieved)+'.</p><p>Calculation: ingredient grams × nutrients per 100 g ÷ 100, summed before rounding. USDA provides the ingredient references; these recipe totals are calculated estimates.</p>'+(missing?'<h3>References still needed</h3><ul>'+missing+'</ul>':'')+'<h3>Matched ingredients</h3><ul>'+rows+'</ul></details></section>';
}
function renderRecipeDetail(r){
  const people=state.profile.people;
  const isSaved=state.favorites.some(x=>x.id===r.id),cooked=hasCooked(cookingHistory,r.id);
  const index=state.result?.plan.findIndex(slot=>slot.recipeId===r.id)??-1;
  const entry=state.recipeJournal?.[r.id]||{};
  const lastCook=historyEntries(cookingHistory).find(e=>e.recipeId===r.id);
  const stars=Array.from({length:5},(_,i)=>button('','rate-recipe','rating-star'+(i<(entry.rating||0)?' rated':''),'star','data-id="'+(i+1)+'" aria-label="Rate '+(i+1)+' out of 5" aria-pressed="'+(i+1===entry.rating)+'"')).join('');
  const ingredientRows='<ul class="recipe-ingredients">'+r.items.map(item=>'<li><span aria-hidden="true">'+ingredientIcon(item)+'</span><strong>'+esc(item.name)+'</strong><small>'+quantity(item.amount*people)+' '+esc(item.unit)+'</small></li>').join('')+'</ul>';
  const instructions='<div class="recipe-instructions">'+(guidedStep===null?
    button('Cook step-by-step','guide-start','guide-start ghost','right')+'<ol>'+r.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>':
    '<section class="guided-cook recipe-panel"><span class="recipe-kicker">Step '+(guidedStep+1)+' of '+r.steps.length+'</span><p>'+esc(r.steps[guidedStep])+'</p><div class="guided-actions">'+button('Previous','guide-prev','ghost','',''+(guidedStep===0?'disabled':''))+button(guidedStep===r.steps.length-1?'Finish':'Next step','guide-next','green')+'</div></section>')+'</div>';
  const stats=[['time',r.minutes+' min','Total time'],['people',people,people===1?'Serving':'Servings'],['shopping',r.items.length,'Ingredients'],['wallet','AED '+money(r.ingredientCost*people),'Est. cost']];
  screen.innerHTML='<article class="recipe-page"><div class="recipe-cover"><img src="'+photo(r)+'" alt=""><span class="recipe-photo-caption">Illustrative photo</span>'+button('','recipe-back','cover-back','back','aria-label="Back from recipe"')+
    button('','favorite','cover-save'+(isSaved?' is-saved':''),'heart','aria-label="'+(isSaved?'Remove saved recipe':'Save recipe')+'" aria-pressed="'+isSaved+'"' )+'</div><h1 tabindex="-1">'+esc(r.name)+'</h1>'+
    renderNutrition(r)+'<section class="recipe-panel recipe-facts"><h2 class="recipe-kicker">Recipe overview</h2><div>'+stats.map(([symbol,value,label])=>'<div>'+icon(symbol)+'<strong>'+esc(value)+'</strong><small>'+esc(label)+'</small></div>').join('')+'</div></section>'+
    '<section class="recipe-panel recipe-actions"><h2 class="recipe-kicker">Recipe notes</h2><p>'+esc(cap(r.diet))+' · '+esc(r.cuisine)+'</p><div>'+button(cooked?'Cooked':'Mark as cooked','cooked','cook-check'+(cooked?' marked':''),'check','aria-pressed="'+cooked+'" aria-label="'+(cooked?'Undo cooked mark':'Mark as cooked')+'"')+'<div class="recipe-rating" role="group" aria-label="Rate this recipe">'+stars+'</div></div>'+(cooked?'<div class="cooking-record-summary"><p>Last cooked: '+esc(cookingDate(lastCook?.cookedAt))+'</p>'+button('Log another cook','log-cook','ghost small','plus')+'</div>':'')+'</section>'+
    '<div class="recipe-tabs" role="group" aria-label="Recipe sections">'+['ingredients','instructions'].map(tab=>button(cap(tab),'recipe-tab','recipe-tab','','data-id="'+tab+'" aria-pressed="'+(detailTab===tab)+'"')).join('')+'</div>'+
    (detailTab==='ingredients'?ingredientRows:instructions)+renderCookingTimer()+'<label class="personal-notes"><span>Your notes</span><textarea id="recipe-note" maxlength="2000" placeholder="Add a note to this recipe…">'+esc(entry.note||'')+'</textarea></label>'+
    (index>=0?button('Swap this meal','swaps','recipe-swap ghost','swap','data-index="'+index+'"'):'')+
    (r.source?'<p class="recipe-source"><a href="'+esc(r.source)+'" target="_blank" rel="noopener noreferrer">'+esc(r.sourceName||'Recipe source')+'</a>'+(r.licence?' · '+esc(r.licence):'')+'</p>':'')+'</article>';
}
function updateJournal(id,patch){
  state.recipeJournal??={};
  state.recipeJournal[id]={...state.recipeJournal[id],...patch};
  persist();
}
function leaveRecipe(){
  detail=null;
  setView(recipeOrigin);
  window.scrollTo(0,recipeScroll);
}
function moveGuide(step){
  guidedStep=step>=detail.steps.length?null:step;
  renderRecipeDetail(detail);
  screen.querySelector('.recipe-tabs')?.scrollIntoView({block:'start'});
}
async function swaps(index){
  swapIndex=index;
  openDialog('Swap this meal','Options fit your cooking preferences and grocery budget.','<p>Finding suitable meals…</p>');
  try{
    const data=await request('/api/swaps',{profile:state.profile,pantry:state.pantry,plan:state.result.plan,index});
    if(!dialog.open||swapIndex!==index)return;
    openDialog('Swap this meal','Options fit your cooking preferences and grocery budget.',
      data.choices.length?data.choices.map(r=>'<article class="swap-option"><div><strong>'+esc(r.name)+'</strong><p>'+esc(r.minutes)+' min · AED '+money(r.total)+' estimated week</p>'+(r.recommendationReason?'<small>'+esc(r.recommendationReason)+'</small>':'')+'</div>'+button('Choose','apply-swap','primary small','check','data-id="'+esc(r.id)+'"')+'</article>').join(''):'<p class="empty">No other meal fits these settings. Try a longer cooking time or a higher budget.</p>');
  }catch(err){if(dialog.open&&swapIndex===index)openDialog('Swap this meal','','<p class="notice">'+esc(err.message)+'</p>');}
}
async function applySwap(id,buttonNode){
  if(busy)return;
  const index=swapIndex;
  busy=true;buttonNode.disabled=true;
  try{
    const result=await request('/api/swap',{profile:state.profile,pantry:state.pantry,plan:state.result.plan,index,recipeId:id});
    state={...state,checked:keepChecked(state.result,result,state.checked),result,planHistory:rememberPlan(result)};
    persist();dialog.close();if(view==='recipe')leaveRecipe();notify('Meal swapped. Grocery list updated.');
  }catch(err){buttonNode.disabled=false;notify(err.message);}
  finally{busy=false;render();}
}
function setView(target,hash=true){
  view=Object.hasOwn(labels,target)||['welcome','setup','recipe'].includes(target)?target:'week';
  if(hash&&location.hash!=='#'+view)history.replaceState(null,'','#'+view);
  render();
  window.scrollTo(0,0);
  if(view==='recipes'&&!library.saved&&!library.rows.length&&!library.loading)loadRecipes();
  if(view==='pantry'&&!options)request('/api/options').then(data=>{options=data;if(view==='pantry')render();}).catch(err=>notify(err.message));
}
function renderCookingTimer(){
  const timer=cookingTimer.snapshot();
  if(guidedStep===null&&!timer.started)return '';
  return '<section class="recipe-panel cooking-timer" aria-label="Cooking timer"><h2 class="recipe-kicker">Cooking timer</h2>'+
    (timer.started?'<p>'+esc(timer.label)+'</p>':'')+
    '<div class="timer-strip">'+button('<span>'+(timer.active?'Timer running':'5-minute timer')+'</span>','timer','ghost small','time',timer.active?'disabled':'')+
    '<output id="timer" role="timer" aria-label="Time remaining">'+timerText(timer)+'</output>'+
    (timer.started?button('Cancel timer','timer-cancel','ghost small'):'')+'</div></section>';
}
function updateTimerDisplay(timer){
  const output=$('#timer');if(output)output.textContent=timerText(timer);
  const start=$('[data-action="timer"]');
  if(start){start.disabled=timer.active;const text=start.querySelector('span');if(text)text.textContent=timer.active?'Timer running':'5-minute timer';}
}
function startTimer(){
  if(!detail)return;
  cookingTimer.start(300000,detail.name);
  renderRecipeDetail(detail);
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.view){setView(b.dataset.view);$('#main').focus({preventScroll:true});return;}
  const {action,id,index}=b.dataset;
  if(action==='cloud-account'){openCloudAccount();}
  else if(action==='account-login'){location.href='/login.html';}
  else if(action==='account-signup'){location.href='/signup.html';}
  else if(action==='cloud-connect'){await cloudBackup.init();openCloudAccount();}
  else if(action==='cloud-retry'){await cloudBackup.retry();}
  else if(action==='cloud-import'){try{await cloudBackup.importGuest();dialog.close();notify('Guest kitchen import processed. Check Settings for backup status.');}catch(e){notify(e.message);}}
  else if(action==='cloud-logout'){try{await cloudBackup.logout();dialog.close();}catch(e){notify(e.message);}}
  else if(action==='cloud-local'||action==='cloud-remote'){try{await cloudBackup.resolve(action==='cloud-local');dialog.close();}catch(e){notify(e.message);}}
  else if(action==='grocery-add'){openDialog('Add grocery item','Keep extra essentials alongside your meal ingredients.','<form id="extra-grocery-form"><label class="field">Item name<input class="control" name="item" required maxlength="80" placeholder="e.g. Apples"></label><button class="button primary wide">Add item</button></form>');}
  else if(action==='start-setup'){beginWizard(false);}
  else if(action==='review-setup'){beginWizard(true);}
  else if(action==='preview-slide'){selectSlide(Number(id));}
  else if(action==='preview-toggle'){previewAutoplayPaused=!previewAutoplayPaused;previewSlideshow.setPaused(previewAutoplayPaused);updatePreviewSlides();}
  else if(action==='edit-setup'){setView('plan');}
  else if(action==='back-step'){backWizard();}
  else if(action==='next-step'){await nextWizard();}
  else if(action==='pick-one'){
    const field=b.dataset.field;
    wizardDraft[field]=field==='minutes'?Number(id):id;
    error='';renderWizard();
    screen.querySelector('.wizard-choice.selected')?.focus({preventScroll:true});
  }
  else if(action==='pick-many'){toggleWizard(b.dataset.field,id);}
  else if(action==='people'){wizardDraft.people=Math.max(1,Math.min(12,wizardDraft.people+Number(id)));renderWizard();}
  else if(action==='go-history')setView('history');
  else if(action==='go-settings')setView('settings');
  else if(action==='go-home')setView('welcome');
  else if(action==='log-cook'&&detail){logCook(detail);renderRecipeDetail(detail);notify('Another cook added to your history.');}
  else if(action==='go-plan')setView('plan');
  else if(action==='open-recipes')setView('recipes');
  else if(action==='share-plan')sharePlan();
  else if(action==='privacy')showPrivacy();
  else if(action==='edit-name')openDialog('Edit your name','','<form id="name-form"><label class="field">Name<input class="control" name="name" maxlength="40" required value="'+esc(state.profile.name)+'"></label><button class="button green wide">Save name</button></form>');
  else if(action==='clear-saved')openDialog('Reset saved meals?','This clears your favourites list.',button('Cancel','close')+' '+button('Reset saved meals','confirm-saved','danger'));
  else if(action==='confirm-saved'){state.favorites=[];persist();dialog.close();notify('Saved meals cleared.');}
  else if(action==='weekly-reminder')openDialog('Weekly plan reminder','Add a recurring Sunday reminder for 10:00 in your calendar.',
    window.MealdayAndroid?.weeklyReminder?button('Open calendar','open-reminder-calendar','green wide','week'):'<p>This option opens your calendar in the Android app.</p>');
  else if(action==='open-reminder-calendar'){dialog.close();window.MealdayAndroid.weeklyReminder();}
  else if(action==='settings-reset')resetDialog();
  else if(action==='confirm-reset'){dialog.close();resetKitchen();}
  else if(action==='preferences')await preferences();
  else if(action==='day'){day=Number(b.dataset.day);render();$('.day-btn.active')?.focus();}
  else if(action==='generate')await generate();
  else if(action==='go-shopping')setView('shopping');
  else if(action==='go-week')setView('week');
  else if(action==='go-pantry')setView('pantry');
  else if(action==='recipe')await showRecipe(id);
  else if(action==='recipe-back')leaveRecipe();
  else if(action==='recipe-tab'&&detail){
    detailTab=id;guidedStep=null;renderRecipeDetail(detail);
    screen.querySelector('.recipe-tab[aria-pressed="true"]')?.focus({preventScroll:true});
  }
  else if(action==='guide-start'&&detail)moveGuide(0);
  else if(action==='guide-prev'&&detail)moveGuide(guidedStep-1);
  else if(action==='guide-next'&&detail)moveGuide(guidedStep+1);
  else if(action==='rate-recipe'&&detail){
    const rating=Number(id);
    updateJournal(detail.id,{rating:state.recipeJournal?.[detail.id]?.rating===rating?0:rating,ratedAt:new Date().toISOString()});
    notify('Rating saved. It will shape your next rebuild and swap suggestions.');
    renderRecipeDetail(detail);
    screen.querySelector('.rating-star[data-id="'+id+'"]')?.focus({preventScroll:true});
  }
  else if(action==='swaps')await swaps(Number(index));
  else if(action==='apply-swap')await applySwap(id,b);
  else if(action==='close')dialog.close();
  else if(action==='more')await loadRecipes(true);
  else if(action==='saved'){clearTimeout(libraryDelay);library.saved=!library.saved;renderRecipes();await loadRecipes();}
  else if(action==='clear-recipe-filters'){clearTimeout(libraryDelay);library.q='';library.cuisine='';library.diet='';renderRecipes();await loadRecipes();}
  else if(action==='pantry-remove')await changePantry(id,0);
  else if(action==='timer')startTimer();
  else if(action==='timer-cancel'){cookingTimer.cancel();if(detail)renderRecipeDetail(detail);}
  else if(action==='favorite'&&detail){
    const r=detail,found=state.favorites.some(x=>x.id===r.id);
    state.favorites=found?state.favorites.filter(x=>x.id!==r.id):[...state.favorites,{id:r.id,name:r.name,minutes:r.minutes,cuisine:r.cuisine,diet:r.diet}];
    persist();renderRecipeDetail(r);if(view==='recipes'&&library.saved)renderRecipes(true);
  } else if(action==='cooked'&&detail){
    const r=detail;
    if(hasCooked(cookingHistory,r.id)){cookingHistory=undoCookedMark(cookingHistory,r.id,new Date().toISOString());persistHistory();}
    else logCook(r);
    renderRecipeDetail(r);
  } else if(action==='copy'){
    const list=state.result?.items.filter(i=>i.packs>0).map(i=>i.name+' — '+i.packs+' × '+i.pack+' '+i.unit).join('\n')||'';
    try{if(window.MealdayAndroid)window.MealdayAndroid.copy(list);else await navigator.clipboard.writeText(list);notify('Grocery list copied.');}catch{openDialog('Copy grocery list','Select the text to copy it.','<textarea class="control" rows="12" cols="40" readonly>'+esc(list)+'</textarea>');}
  }
});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id==='extra-grocery-form'){event.preventDefault();const name=String(new FormData(form).get('item')||'').trim();if(!name)return;state.extraGroceries=[...(state.extraGroceries||[]),{id:crypto.randomUUID(),name,checked:false}];persist();dialog.close();render();return;}
  if(form.id==='cloud-login'){
    event.preventDefault();const data=new FormData(form),submit=form.querySelector('button[type="submit"]');submit.disabled=true;
    try{await cloudBackup.login(String(data.get('email')),String(data.get('password')),data.get('register')==='on');dialog.close();notify('Account loaded. Check Settings for backup status.');}
    catch(e){const error=form.querySelector('[role="alert"]');error.textContent=e.message;}finally{submit.disabled=false;}return;
  }
  if(form.id==='name-form'){
    event.preventDefault();
    const name=String(new FormData(form).get('name')).trim();
    if(!name)return;
    state.profile={...state.profile,name};
    persist();dialog.close();render();return;
  }
  if(!['preferences','pantry-form','plan-form'].includes(form.id))return;
  event.preventDefault();
  if(busy)return;
  const data=new FormData(form),submit=form.querySelector('button:not([type])');
  if(submit)submit.disabled=true;
  try{
    if(form.id==='preferences'){
      const fields=['city','shop','diet','cuisine'];
      const profile={...state.profile,...Object.fromEntries(fields.map(key=>[key,data.get(key)]))};
      for(const key of ['budget','people','minutes'])profile[key]=Number(data.get(key));
      for(const key of ['appliances','mealTypes','allergies'])profile[key]=data.getAll(key);
      profile.days=data.getAll('days').map(Number);
      if(!profile.days.length||!profile.mealTypes.length){const el=$('#form-error');el.hidden=false;el.textContent='Select at least one day and one meal.';return;}
      await generate(profile);
    } else if(form.id==='plan-form'){
      const profile={...state.profile};
      for(const field of ['name','shop','city','diet'])profile[field]=String(data.get(field)||'').trim();
      for(const field of ['people','budget','minutes'])profile[field]=Number(data.get(field));
      for(const field of ['mealTypes','allergies','appliances','cuisines','priorities'])profile[field]=data.getAll(field);
      profile.days=data.getAll('days').map(Number);
      if(!profile.days.length||!profile.mealTypes.length||!profile.appliances.length||!profile.cuisines.length){notify('Choose at least one day, meal, appliance and cuisine.');return;}
      if(profile.priorities.length>3){notify('Choose up to 3 meal styles.');return;}
      if(profile.cuisines.includes('UAE mix')&&profile.cuisines.length>1)profile.cuisines=profile.cuisines.filter(x=>x!=='UAE mix');
      profile.cuisine=profile.cuisines[0];
      await generate(profile);
    } else await changePantry(String(data.get('ingredient')),Number(data.get('amount')));
  } finally {if(submit)submit.disabled=false;}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.wizardField&&wizardDraft){const field=el.dataset.wizardField;wizardDraft[field]=field==='minutes'?Number(el.value):el.value;updateWizardContinue();return;}
  if(el.dataset.extra){const item=state.extraGroceries?.find(x=>x.id===el.dataset.extra);if(item){item.checked=el.checked;persist();el.closest('.basket-row').classList.toggle('checked',el.checked);}return;}
  if(el.dataset.grocery){const key=el.dataset.grocery;state.checked=el.checked?[...new Set([...state.checked,key])]:state.checked.filter(id=>id!==key);persist();
    el.closest('.basket-row').classList.toggle('checked',el.checked);
    const count=state.result.items.filter(i=>i.packs>0).length;
    $('.shopping-head .subtle').textContent=state.checked.length+' of '+count+' checked · '+state.profile.shop;
  }
  if(el.id==='cuisine'||el.id==='diet'){library[el.id]=el.value;loadRecipes();}
});
document.addEventListener('input',event=>{
  if(event.target.id==='recipe-note'&&detail){updateJournal(detail.id,{note:event.target.value});return;}
  if(event.target.id==='wizard-name'&&wizardDraft){
    wizardDraft.name=event.target.value;
    updateWizardContinue();
    return;
  }
  if(event.target.id==='wizard-budget-range'||event.target.id==='wizard-budget-input'){setWizardBudget(event.target);return;}
  if(event.target.id!=='search')return;
  library.q=event.target.value;clearTimeout(libraryDelay);libraryDelay=setTimeout(()=>loadRecipes(),260);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Enter' && !event.isComposing && event.target.id==='wizard-name'){
    event.preventDefault();
    if(canContinue())nextWizard();
  }
});
dialog.addEventListener('close',()=>{swapIndex=null;});

const places=['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];
const supermarkets=['LuLu','Carrefour','Spinneys','Waitrose','Union Coop','Nesto','Choithrams','Any supermarket'];
const priorities=[['Quick','⚡','Speedy meals'],['Fresh','🥗','Fresh and light'],['Family','🏡','Family favourites'],['Comfort','🍲','Comfort food'],['Everyday','🍽️','Everyday meals'],['None','✨','Surprise me'],['Protein','💪','Protein packed']];
const foodTypes=[['Any','🍽️','No preference'],['Vegetarian','🥕'],['Vegan','🌱'],['Pescatarian','🐟'],['Eggless vegetarian','🥦'],['Non-vegetarian','🍗']];
const allergyOptions=[['None','➖'],['Gluten','🌾'],['Milk','🥛'],['Egg','🥚'],['Peanuts','🥜'],['Tree nuts','🌰'],['Fish','🐟'],['Shellfish','🦐'],['Sesame','🫘'],['Soy','🌱']];
const appliances=[['Microwave','microwave'],['Hob','hob'],['Air fryer','fryer'],['Oven','oven']];
const styles=[['UAE mix','','UAE favourites'],['Emirati'],['Arab','','Arab / Middle Eastern'],['South Asian','','South Asian / Desi'],['Turkish']];
let wizardDraft=null,step=0,editing=false,previewSlide=1;
const goals=[['prep','🗓️','Meal prep for the week'],['simple','✨','Find simple recipes'],['solo','🍽️','Cook for myself'],['family','🏡','Cook for my family']];
const obstacles=[['time','⏱️','Not enough time'],['tired','🌙','Too tired after work'],['difficult','🥣','Cooking feels difficult'],['ideas','💭','I need meal ideas']];
const cookingTimes=[[15,'','Up to 15 min'],[30,'','15–30 min'],[45,'','30–45 min'],[60,'','45–60 min'],[1440,'','60+ min']];

const steps=[
  {title:'What should we call you?',hint:'Your name makes your kitchen feel like yours.',type:'name'},
  {title:'What brings you to Mealday?',hint:'Choose the main thing you want help with.',field:'goal',choices:goals,required:true},
  {title:'Where are you cooking?',hint:'Choose your city in the UAE.',field:'city',choices:places.map(x=>[x,'pin',x]),required:true},
  {title:'Which cuisines do you enjoy?',hint:'Choose your favourites, or explore a UAE mix.',field:'cuisines',choices:styles,multi:true,layout:'tiles'},
  {title:'Which meals should we plan?',hint:'Choose at least one meal for your cooking week.',field:'mealTypes',choices:[['breakfast','plate','Breakfast'],['lunch','plate','Lunch'],['dinner','plate','Dinner']],multi:true},
  {title:'How long do you like to cook?',hint:'Choose the most time you want to spend on a meal.',field:'minutes',choices:cookingTimes,required:true},
  {title:'What is your grocery budget?',hint:'We’ll estimate your weekly shop in AED.',type:'budget'},
  {title:'Choose your supermarket',hint:'We’ll plan your grocery list around your preferred shop. Prices are catalogue estimates.',field:'shop',choices:supermarkets.map(x=>[x,'shopping',x]),required:true},
  {title:'How many are you cooking for?',hint:'We’ll scale your meals and shopping quantities.',type:'people'},
  {title:'Which days will you cook?',hint:'Pick the days you want meals planned for.',field:'days',choices:DAYS.map((x,i)=>[i,'',x]),multi:true,layout:'days'},
  {title:'What are you in the mood for?',hint:'Pick up to 3 meal styles.',field:'priorities',choices:priorities,multi:true,layout:'tiles'},
  {title:'Any dietary needs?',hint:'Choose the diet your meal plan should follow.',field:'diet',choices:foodTypes,required:true,layout:'tiles'},
  {title:'Any ingredients to avoid?',hint:'Choose all that apply, or select None. Always check food labels.',field:'allergies',choices:allergyOptions,multi:true,layout:'tiles'},
  {title:'What appliances do you have?',hint:'Select at least one appliance, then generate your plan.',field:'appliances',choices:appliances,multi:true,layout:'appliance-scene'},
];
let allergiesReviewed=false;
function wizardChoices(field,choices,multi=true){
  const selected=wizardDraft[field];
  return '<div class="quick-choices">'+choices.map(([value,symbol,label])=>{
    const active=value==='None'?allergiesReviewed&&selected.length===0:multi?selected.includes(value):String(selected)===String(value);
    return '<button type="button" class="button quick-choice '+(active?'selected':'')+'" data-action="'+(multi?'pick-many':'pick-one')+'" data-field="'+field+'" data-id="'+esc(value)+'" aria-pressed="'+active+'">'+esc(label||value)+'</button>';
  }).join('')+'</div>';
}
function wizardSection(title,content){return '<fieldset class="quick-section"><legend>'+esc(title)+'</legend>'+content+'</fieldset>';}
const productPreviews=[
  {title:'Your week',description:'See the meals and groceries for your week',
    body:'<div class="mini-heading">My week</div><div class="mini-highlight">Grocery estimate<span>AED 150 budget</span></div><div class="mini-meal"><img src="/bowls.jpg" alt=""><span><b>Monday</b>Chicken rice bowl</span></div><div class="mini-meal"><img src="/hero.jpg" alt=""><span><b>Tuesday</b>Roasted garden bowl</span></div><div class="mini-meal"><img src="/table.jpg" alt=""><span><b>Wednesday</b>Lemon chickpea salad</span></div>'},
  {title:'Recipe details',description:'Open a recipe with ingredients and cooking steps',
    body:'<img class="mini-photo" src="/bowls.jpg" alt=""><div class="mini-heading">Chicken rice bowl</div><div class="mini-stats"><span><b>30 min</b>Cook time</span><span><b>2</b>Serves</span></div><div class="mini-heading">Ingredients</div><div class="mini-ingredient">🍗 Chicken</div><div class="mini-ingredient">🌾 Rice</div><div class="mini-ingredient">🍋 Lemon</div>'},
  {title:'Recipe library',description:'Explore recipes by cuisine',
    body:'<div class="mini-heading">Explore by cuisine</div><div class="mini-cuisines"><div><img src="/table.jpg" alt="">Emirati</div><div><img src="/bowls.jpg" alt="">Middle Eastern</div><div><img src="/hero.jpg" alt="">South Asian</div><div><img src="/table.jpg" alt="">UAE favourites</div></div>'},
];
function welcome(){
  const previews=productPreviews.map((item,index)=>{
    const position=index===previewSlide?'center':index===(previewSlide+2)%3?'left':'right';
    return '<button type="button" class="preview-phone '+position+'" data-action="preview-slide" data-id="'+index+'" tabindex="-1" aria-label="'+esc(item.description)+'"><span class="preview-device">'+item.body+'</span></button>';
  }).join('');
  const dots=productPreviews.map((item,index)=>'<button type="button" class="preview-dot" data-action="preview-slide" data-id="'+index+'" aria-label="'+esc(item.title)+'" aria-pressed="'+(index===previewSlide)+'"></button>').join('');
  return '<div class="phone-welcome"><div class="welcome-brand"><img src="/chef.png" alt="Mealday chef"><span>mealday<span>.</span></span></div><h1>Plan dinners around your budget, your tastes and what’s in your kitchen.</h1><div class="preview-carousel" aria-label="Mealday feature previews">'+previews+'</div><div class="preview-controls"><div class="preview-dots">'+dots+'</div>'+button(previewAutoplayPaused?'Play slideshow':'Pause slideshow','preview-toggle','preview-autoplay','','aria-pressed="'+previewAutoplayPaused+'"')+'</div><div class="wizard-footer">'+button('Get started','start-setup','green wide','right')+'<div class="welcome-account-links">'+button('Log in','account-login')+button('Sign up','account-signup')+'</div></div></div>';
}
let previewAutoplayPaused=Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),previewHovered=false;
const previewSlideshow=createPreviewSlideshow({count:productPreviews.length,initial:previewSlide,
  canAdvance:()=>view==='welcome'&&!document.hidden&&!dialog.open&&!previewHovered&&swipeStart==null&&!document.activeElement?.closest?.('.preview-carousel, .preview-dots'),
  onChange:index=>{previewSlide=index;updatePreviewSlides();}});
previewSlideshow.setPaused(previewAutoplayPaused);
function updatePreviewSlides(){
  if(view!=='welcome')return;
  screen.querySelectorAll('.preview-phone').forEach((node,index)=>{
    node.classList.toggle('center',index===previewSlide);
    node.classList.toggle('left',index===(previewSlide+productPreviews.length-1)%productPreviews.length);
    node.classList.toggle('right',index!==(previewSlide+productPreviews.length-1)%productPreviews.length&&index!==previewSlide);
  });
  screen.querySelectorAll('.preview-dot').forEach((node,index)=>node.setAttribute('aria-pressed',String(index===previewSlide)));
  const control=screen.querySelector('[data-action="preview-toggle"]');
  if(control){control.textContent=previewAutoplayPaused?'Play slideshow':'Pause slideshow';control.setAttribute('aria-pressed',String(previewAutoplayPaused));}
}
function selectSlide(index){previewSlideshow.select(index);}
screen.addEventListener('mouseover',event=>{if(event.target.closest('.preview-carousel'))previewHovered=true;});
screen.addEventListener('mouseout',event=>{if(event.target.closest('.preview-carousel')&&!event.relatedTarget?.closest?.('.preview-carousel'))previewHovered=false;});

let swipeStart;
screen.addEventListener('touchstart',event=>{
  swipeStart=event.target.closest('.preview-carousel')?event.changedTouches[0].clientX:null;
},{passive:true});
screen.addEventListener('touchend',event=>{
  if(swipeStart===null||swipeStart===undefined)return;
  const delta=event.changedTouches[0].clientX-swipeStart;
  swipeStart=null;
  if(Math.abs(delta)>36)selectSlide((previewSlide+(delta<0?1:2))%3);
},{passive:true});
function beginWizard(edit){
  editing=edit;step=0;error='';wizardDraft=JSON.parse(JSON.stringify(state.profile));
  if(!edit&&!state.result)wizardDraft.shop='Any supermarket';
  allergiesReviewed=false;
  wizardDraft.name??='';
  wizardDraft.cuisines??=[wizardDraft.cuisine];wizardDraft.priorities=(wizardDraft.priorities??['Everyday']).slice(0,3);
  setView('setup',false);
}
function backWizard(){
  if(busy)return;
  error='';
  if(step===0){setView(editing?'plan':'welcome',false);return;}
  step--;renderWizard(false);
}
function toggleWizard(field,value){
  if(field==='allergies')allergiesReviewed=true;
  if(field==='days')value=Number(value);
  const now=wizardDraft[field]||[];
  if((field==='allergies'||field==='priorities')&&value==='None'){
    wizardDraft[field]=[];
  }else if(field==='cuisines'&&value==='UAE mix'){
    wizardDraft[field]=now.includes(value)?[]:[value];
  }else if(now.includes(value)){
    wizardDraft[field]=now.filter(x=>x!==value);
  }else if(field!=='priorities'||now.length<3){
    wizardDraft[field]=[...now.filter(x=>field!=='cuisines'||x!=='UAE mix'),value];
  }
  error='';renderWizard();
  Array.from(screen.querySelectorAll('[data-action="pick-many"]')).find(choice=>choice.dataset.id===String(value))?.focus({preventScroll:true});
}
function setWizardBudget(el){
  const value=Number(el.value);
  const input=$('#wizard-budget-input');
  const range=$('#wizard-budget-range');
  if(el===range)input.value=el.value;
  else range.value=String(Math.max(30,Math.min(600,value)));
  wizardDraft.budget=value;
  $('#wizard-budget-value').textContent=el.value?money(value):'—';
  updateWizardContinue();
}
function renderGeneration(ready=false){
  const title=ready?'Your week is ready':(wizardDraft.name?wizardDraft.name+', we’re building your week…':'We’re building your week…');
  const tasks=ready?['Preferences applied','Meals scheduled','Grocery list ready']:['Matching recipes to your preferences','Lining up meals for the week','Putting together your grocery list'];
  return '<section class="wizard generation" role="status"><h1>'+esc(title)+'</h1><div class="food-orbit" aria-hidden="true">'+
    '<div><img src="/brand.svg" alt=""><b>mealday</b></div>'+
    ['🥒','🍋','🥑','🍅','🫑','🥬','🍆','🧄'].map((food,index)=>'<span style="--angle:'+index*45+'deg">'+food+'</span>').join('')+
    '</div><ul class="generation-list">'+tasks.map(task=>'<li><span aria-hidden="true">'+(ready?icon('check'):'')+'</span>'+task+'</li>').join('')+'</ul></section>';
}
function renderWizard(preserveScroll=true){
  const scroll=preserveScroll?screen.querySelector('.wizard-body')?.scrollTop??0:0;
  const current=steps[step],p=wizardDraft;
  if(!p)return;
  let body='';
  if(current.type==='household'){
    body=wizardSection('Household servings','<div class="counter quick-counter">'+button('−','people','counter-button','','data-id="-1" aria-label="One fewer person" '+(p.people===1?'disabled':''))+'<div><strong>'+p.people+'</strong><small>'+(p.people===1?'person':'people')+'</small></div>'+button('+','people','counter-button','','data-id="1" aria-label="One more person" '+(p.people===12?'disabled':''))+'</div>')+wizardSection('Cooking days',wizardChoices('days',DAYS.map((d,i)=>[i,'',d.slice(0,3)])))+wizardSection('Meals to plan',wizardChoices('mealTypes',[['breakfast','','Breakfast'],['lunch','','Lunch'],['dinner','','Dinner']]));
  }else if(current.type==='food'){
    body='<label class="field">Diet'+dropdown('wizard-diet',foodTypes.map(x=>x[0]),p.diet).replace('name="wizard-diet"','data-wizard-field="diet"')+'</label>'+wizardSection('Ingredients to avoid',wizardChoices('allergies',allergyOptions))+'<p class="allergy-note">Select None if no exclusions apply. Always check packaged food labels.</p>';
  }else if(current.type==='name'){
    body='<input id="wizard-name" class="control wizard-name" aria-label="Your name" type="text" autocomplete="given-name" maxlength="40" placeholder="Your first name" value="'+esc(p.name)+'">';
  }else if(current.type==='intro'){
    body='<div class="intro-message"><img src="/chef.png" alt=""><p>Pick your preferences once. Mealday uses them to build a meal plan and shopping list for your kitchen.</p></div>';
  }else if(current.type==='people'){
    body='<div class="counter">'+button('−','people','counter-button','','data-id="-1" aria-label="One fewer person" '+(p.people===1?'disabled':''))+
      '<div><strong>'+p.people+'</strong><small>'+(p.people===1?'person':'people')+'</small></div>'+
      button('+','people','counter-button','','data-id="1" aria-label="One more person" '+(p.people===12?'disabled':''))+'</div>';
  }else if(current.type==='budget'){
    body='<div class="wizard-budget"><small>AED</small><strong id="wizard-budget-value">'+money(p.budget)+'</strong><p>for '+p.days.length+(p.days.length===1?' day':' days')+' · '+p.people+(p.people===1?' person':' people')+'</p></div>'+
     '<input id="wizard-budget-range" aria-label="Shopping budget slider" type="range" min="30" max="600" step="5" value="'+Math.max(30,Math.min(600,p.budget))+'"><div class="range-labels"><span>AED 30</span><span>AED 600</span></div>'+
     '<label class="field">Or enter your budget<input id="wizard-budget-input" class="control" type="number" min="20" max="5000" step="0.01" value="'+esc(p.budget)+'"></label><label class="field quick-time">Maximum cooking time'+dropdown('wizard-minutes',[15,20,30,45,60,90,120,240,1440],p.minutes).replace('name="wizard-minutes"','data-wizard-field="minutes"')+'</label>';
  }else if(current.type==='budget-recap'){
    body='<div class="budget-recap"><span aria-hidden="true">🛒</span><strong>AED '+money(p.budget)+'</strong>'+
      '<p>Grocery budget for '+p.days.length+' cooking '+(p.days.length===1?'day':'days')+' and '+p.people+(p.people===1?' person':' people')+'.</p>'+
      '<p>Mealday uses catalogue prices to estimate your total.</p></div>';
  }else if(current.type==='review'){
    const dinners=p.mealTypes.map(cap).join(', ');
    const days=p.days.map(day=>DAYS[day]).join(', ');
    const time=p.minutes===1440?'60+ min':p.minutes+' min max';
    const mood=p.priorities.map(priority=>priorities.find(([key])=>key===priority)?.[2]||priority);
    const diet=p.diet==='Any'?'Any diet':p.diet;
    const recap=[
      ['shopping','Your shop',p.shop+' · AED '+money(p.budget),p.city+' · weekly grocery budget'],
      ['week','Your cooking week',dinners+' for '+p.people+(p.people===1?' person':' people'),[days,time,p.appliances.join(', ')].join(' · ')],
      ['leaf','Your food preferences',[diet,...mood].join(' · '),[p.cuisines.join(', '),p.allergies.length?'Avoiding '+p.allergies.join(', '):'No ingredients excluded'].join(' · ')],
    ];
    body=wizardSection('Available appliances',wizardChoices('appliances',appliances))+'<p class="quick-help">Select at least one appliance. No oven? Leave it unselected.</p><dl class="wizard-review">'+recap.map(([symbol,label,title,detail])=>'<div><dt>'+label+icon(symbol)+'</dt><dd><strong>'+esc(title)+'</strong><p>'+esc(detail)+'</p></dd></div>').join('')+'</dl><p class="quick-help">Name, shop, city, cuisine and meal styles can be changed later in Preferences.</p>';
  }else{
    const layout=current.layout||'rows';
    const selected=p[current.field];
    const countText=current.field==='days'?selected.length+(selected.length===1?' day selected':' days selected'):
      current.field==='priorities'?selected.length+' of 3 selected':'';
    body='<div class="wizard-options">'+(current.field==='days'?'<p class="selected-count" aria-live="polite">'+countText+'</p>':'')+
      (current.field==='priorities'?'<span class="visually-hidden" aria-live="polite">'+countText+'</span>':'')+
      '<div class="wizard-choices '+layout+'">'+(layout==='appliance-scene'?'<img src="/appliance-kitchen.jpg" alt="">':'')+current.choices.map(([value,symbol,label])=>{
        const active=value==='None'?(current.field!=='allergies'||allergiesReviewed)&&selected.length===0:current.multi?selected.includes(value):String(selected)===String(value);
        const disabled=current.field==='priorities'&&selected.length===3&&!active&&value!=='None';
        const artwork=symbol&&Object.hasOwn(ICONS,symbol)?icon(symbol):esc(symbol);
        return '<button type="button" class="wizard-choice '+(active?'selected':'')+'" data-action="'+(current.multi?'pick-many':'pick-one')+'" data-field="'+current.field+'" data-id="'+esc(value)+'" aria-pressed="'+active+'" '+(disabled?'disabled':'')+'>'+
          (symbol&&layout!=='appliance-scene'?'<span class="choice-icon" aria-hidden="true">'+artwork+'</span>':'')+
          '<span class="choice-label">'+esc(label||value)+'</span><span class="choice-mark" aria-hidden="true">'+(active?'✓':'○')+'</span></button>';
      }).join('')+'</div>'+(current.field==='allergies'?'<p class="allergy-note">Always check packaged food labels.</p>':'')+'</div>';
  }
  screen.innerHTML='<div class="wizard"><div class="wizard-header">'+button('←','back-step','back-circle','','aria-label="Go back" '+(busy?'disabled':''))+
   '<span class="setup-step">'+(step+1)+' of '+steps.length+'</span><progress max="'+steps.length+'" value="'+(step+1)+'" aria-label="Setup progress"></progress></div>'+
   '<div class="wizard-body" data-step="'+(current.type||current.field)+'"><h1>'+esc(current.title)+'</h1>'+
   (current.hint?'<p class="wizard-hint">'+esc(current.hint)+'</p>':'')+body+'</div>'+
   '<div class="wizard-footer">'+(error?'<p class="notice" role="alert">'+esc(error)+'</p>':'')+
   button(step===steps.length-1?'Generate plan':'Continue','next-step','green wide'+(step===steps.length-1?' generate-button':''),'',canContinue()?'':'disabled')+'</div></div>';
  screen.querySelector('.wizard-body').scrollTop=scroll;
}
function canContinue(){
  if(busy||!wizardDraft)return false;
  const current=steps[step],p=wizardDraft;
  if(current.type==='household')return Number.isInteger(p.people)&&p.people>=1&&p.people<=12&&p.days.length>0&&p.mealTypes.length>0;
  if(current.type==='food')return foodTypes.some(x=>x[0]===p.diet)&&allergiesReviewed;
  if(current.type==='review')return p.appliances.length>0;
  if(current.type==='name')return Boolean(p.name.trim());
  if(current.type==='budget')return Number.isFinite(p.budget)&&p.budget>=20&&p.budget<=5000;
  if(current.field==='allergies')return allergiesReviewed;
  if(current.field==='shop')return supermarkets.includes(p.shop);
  if(['days','cuisines','mealTypes','appliances'].includes(current.field))return p[current.field].length>0;
  return !current.required||current.choices.some(([value])=>value===p[current.field]);
}
function updateWizardContinue(){
  const next=screen.querySelector('[data-action="next-step"]');
  if(next)next.disabled=!canContinue();
}
async function nextWizard(){
  if(!canContinue())return;
  const current=steps[step],p=wizardDraft;
  if(current.type==='name')p.name=p.name.trim();
  if(!editing&&current.field==='goal'){
    p.people=p.goal==='solo'?1:p.goal==='family'?4:p.people;
    p.priorities=p.goal==='simple'?['Quick']:p.goal==='family'?['Family']:['Everyday'];
  }
  if(!editing&&current.field==='obstacle'&&['time','tired','difficult'].includes(p.obstacle)){
    p.priorities=[...new Set([...p.priorities,'Quick'])];
  }
  error='';
  if(step<steps.length-1){step++;renderWizard(false);return;}
  await generate({...p,minutes:Number(p.minutes),cuisine:p.cuisines[0]});
}
function planSettings(){
  const p=state.profile;
  const group=(title,name,values,selected)=>'<fieldset class="surface-card plan-section pref-choices"><legend>'+esc(title)+'</legend>'+chips(name,values,selected||[])+'</fieldset>';
  return '<header class="utility-heading"><h1>Preferences</h1><p>Edit any choice here, then rebuild your week.</p></header>'+
    (error?'<p class="notice" role="alert">'+esc(error)+'</p>':'')+
    '<form id="plan-form" class="plan-form">'+group('Cooking days','days',DAYS.map((x,i)=>[i,x.slice(0,3)]),p.days)+
    '<div class="surface-card plan-section"><label class="field">Household servings<input class="control" name="people" type="number" min="1" max="12" required value="'+esc(p.people)+'"></label><label class="field">Weekly budget (AED)<input class="control" name="budget" type="number" min="20" max="5000" step=".01" required value="'+esc(p.budget)+'"></label><label class="field">Maximum cooking time'+dropdown('minutes',[15,20,30,45,60,90,120,240,1440],p.minutes)+'</label></div>'+
    group('Meals to plan','mealTypes',[['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner']],p.mealTypes)+
    '<div class="surface-card plan-section"><label class="field">Diet'+dropdown('diet',foodTypes.map(x=>x[0]),p.diet)+'</label></div>'+
    group('Ingredients to avoid','allergies',allergyOptions.filter(x=>x[0]!=='None').map(x=>[x[0],x[0]]),p.allergies)+'<p class="quick-help">No exclusions? Leave all unchecked. Always check packaged food labels.</p>'+
    group('Available appliances','appliances',appliances.map(x=>[x[0],x[0]]),p.appliances)+
    '<details class="surface-card plan-section optional-preferences"><summary>Personalise further</summary><div class="optional-fields"><label class="field">Your name (optional)<input class="control" name="name" autocomplete="given-name" maxlength="40" value="'+esc(p.name)+'"></label><label class="field">City'+dropdown('city',places,p.city)+'</label><label class="field">Supermarket'+dropdown('shop',supermarkets,p.shop)+'</label>'+group('Cuisines','cuisines',styles.map(x=>[x[0],x[2]||x[0]]),p.cuisines||[p.cuisine])+group('Meal styles · up to 3','priorities',priorities.filter(x=>x[0]!=='None').map(x=>[x[0],x[2]]),p.priorities)+'</div></details>'+
    '<div class="setting-list">'+settingRow('Kitchen pantry','go-pantry','Manage ingredients you already have')+'</div><button class="button green wide" '+(busy?'disabled':'')+'>'+icon('refresh')+(busy?'Building your plan…':'Apply & rebuild plan')+'</button></form>';
}
function settingRow(label,action,note=''){
  return '<button type="button" class="setting-row" data-action="'+action+'"><span><strong>'+label+'</strong>'+(note?'<small>'+note+'</small>':'')+'</span><span aria-hidden="true">›</span></button>';
}
function cookingDate(value){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Date not recorded';}
function cookingHistoryPage(){
  const entries=historyEntries(cookingHistory),recipes=new Set(entries.map(e=>e.recipeId));
  return '<div class="subpage-back">'+button('Back to settings','go-settings','ghost','back')+'</div><header class="utility-heading"><h1>Cooking history</h1><p>Saved independently of your meal plan.</p></header>'+
    '<div class="surface-card cooking-history-summary"><strong>'+entries.length+(entries.length===1?' cook':' cooks')+'</strong><p>'+recipes.size+(recipes.size===1?' recipe':' recipes')+' · Rebuilding your plan keeps this history.</p></div>'+
    (entries.length?'<ul class="cooking-history-list">'+entries.map(e=>'<li class="surface-card"><span class="history-check" aria-hidden="true">'+icon('check')+'</span><div><h2>'+esc(e.name||'Previously cooked recipe')+'</h2><p>'+esc(cookingDate(e.cookedAt))+(e.cookedAt?'':' · imported from your earlier saved marks')+'</p>'+button('View recipe','recipe','ghost small','right','data-id="'+esc(e.recipeId)+'"')+'</div></li>').join('')+'</ul>':'<div class="surface-card empty">No cooked meals yet. Mark a recipe as cooked to start your history.'+button('Browse recipes','open-recipes','ghost small','right')+'</div>');
}
function settings(){
  return '<div class="phone-settings"><header><p>Your account</p><h1>Settings</h1></header>'+
  '<div class="settings-profile"><div><h2>Hi, '+esc(state.profile.name||'Chef')+' '+button('','edit-name','edit-person','edit','aria-label="Edit your name"')+'</h2><p>Shopping at '+esc(state.profile.shop)+'</p></div><span>'+(cloudBackup.info().account?'Account':'On device')+'</span></div>'+
  cloudAccountCard()+'<h2 class="settings-caption">App</h2><div class="setting-list">'+settingRow('Welcome screen','go-home')+settingRow('Recipe library','open-recipes','Browse or find your saved meals')+settingRow('Cooking history','go-history','Your cooked meals, saved across rebuilt plans')+settingRow('Profile & food preferences','edit-setup')+settingRow('Review setup · 14 steps','review-setup')+'<div class="setting-row"><span><strong>Language</strong><small>English</small></span></div>'+settingRow('Reset saved meals','clear-saved','Clear your favourites list')+'</div>'+
  '<h2 class="settings-caption">Notifications</h2><div class="setting-list">'+settingRow('Weekly plan reminder','weekly-reminder','Sunday at 10:00 · Add to calendar')+'</div>'+
  '<h2 class="settings-caption">Support</h2><div class="setting-list">'+settingRow('Share meal plan','share-plan')+'</div>'+
  '<h2 class="settings-caption">Privacy</h2><div class="setting-list">'+settingRow('Privacy policy','privacy')+settingRow('Reset this kitchen','settings-reset','Clear your plan, cooking history, pantry, notes and ratings')+'</div></div>';
}
function sharePlan(){
  const text=state.result?.meals.map(x=>DAYS[x.day]+' · '+cap(x.meal)+': '+x.name).join('\n');
  if(!text){notify('Build a meal plan before sharing.');return;}
  if(window.MealdayAndroid){window.MealdayAndroid.share('My Mealday plan\n\n'+text);return;}
  openDialog('Share your plan','Select the text to copy it.','<textarea class="control" rows="12" cols="40" readonly>'+esc(text)+'</textarea>');
}
function showPrivacy(){
  openDialog('Privacy policy','Mealday Android','<div class="privacy-copy"><p>Mealday stores your cooking preferences, plans, pantry, shopping checkmarks, saved recipes, cooking history, ratings and notes on this device. Cooking history is stored separately from the current plan. The planner runs on this device. Account passwords are hashed by the Mealday backend; session cookies are HttpOnly. When you sign in to a connected backup server, your kitchen data is sent to that server and stored in its MongoDB database. Guest data is imported only when you choose Import guest kitchen. Signing out restores the guest kitchen; pending account changes are retained locally for later sign-in.</p><p>When you share a plan or add a reminder, Android opens the corresponding app. External recipe source links open in your browser.</p><p>Use Reset this kitchen in Settings to clear data stored by Mealday.</p></div>');
}
function resetDialog(){
  openDialog('Reset this kitchen?','','<p class="notice">This resets your current kitchen. If it belongs to an account, the reset will sync to that account when connected. Other account and guest recovery copies on this browser are retained.</p>'+button('Cancel','close')+' '+button('Reset kitchen','confirm-reset','danger'));
}
function resetKitchen(){
  cookingHistory=emptyHistory();persistHistory();
  state={profile:JSON.parse(JSON.stringify(defaults)),pantry:{},result:null,checked:[],favorites:[],seed:0};
  error='';persist();setView('welcome',false);
}
window.mealdayBack=()=>{
  if(dialog.open){dialog.close();return true;}
  if(view==='setup'){backWizard();return true;}
  if(view==='recipe'){leaveRecipe();return true;}
  if(view!=='week'&&view!=='welcome'){setView('week',false);return true;}
  return false;
};

cloudApplying=true;
if(persistHistory()&&Object.hasOwn(state,'cooked')){delete state.cooked;persist();}
cloudApplying=false;
initNavigation();
setView(state.result?'week':'welcome',false);
window.mealdayStarted=true;
if (window.MealdayAndroid && typeof window.MealdayAndroid.ready === 'function') {
  window.MealdayAndroid.ready();
}


function cloudAccountCard(){
  const c=cloudBackup.info();return '<h2 class="settings-caption">Backup & sync</h2><div class="setting-list">'+settingRow(c.account?c.account.email:'Cloud backup & login','cloud-account',c.message)+'</div>';
}
function openCloudAccount(){
  const c=cloudBackup.info();if(!c.account){location.href='/login.html';return;}let content='<p class="notice">'+esc(c.message)+'</p>';
  if(c.account){
    if(c.conflict)content+='<p>Keep this device’s full kitchen, or load the cloud version. This choice applies to the full backup.</p>'+button('Keep this device','cloud-local','primary')+button('Load cloud version','cloud-remote','ghost');
    else content+=button('Sync now','cloud-retry','primary')+(c.hasGuest?button('Import guest kitchen','cloud-import','ghost'):'');
    content+=button('Sign out','cloud-logout','ghost');
  }else if(!['unavailable','checking'].includes(c.status))content+='<form id="cloud-login"><label>Email<input class="control" type="email" name="email" autocomplete="username" required maxlength="254"></label><label>Password<input class="control" type="password" name="password" autocomplete="current-password" minlength="12" maxlength="128" required></label>'+(c.registration?'<label><input type="checkbox" name="register"> Create a new account</label>':'')+'<p role="alert"></p><button type="submit" class="button primary">Continue</button></form>';
  else content+='<p>This preview is using device storage. Connect the Mealday backend to MongoDB to enable account login and backup.</p>'+button('Check connection again','cloud-connect','ghost');
  openDialog('Cloud backup & login','Your kitchen across devices',content);
}

cloudBackup.init();
window.addEventListener("online",()=>cloudBackup.refresh());
window.addEventListener("focus",()=>{if(!dialog.open&&!['recipe','setup'].includes(view))cloudBackup.refresh();});
setInterval(()=>{if(!document.hidden&&!dialog.open&&!detail&&view!=="setup")cloudBackup.refresh();},30000);

// A missing or failed photo must not leave a broken image in a meal card.
document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.getAttribute('src')!=='/recipe-image-unavailable.svg'){img.src='/recipe-image-unavailable.svg';img.alt='Recipe photo unavailable';}},true);
