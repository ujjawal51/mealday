import {ingredientPicture} from './ingredient-pictures.js';
import {publicImage} from './catalogue-schema.js';
import {illustratedPhotoIds} from './illustrated-photo-ids.js';
import {recipeLabel} from './recipe-labels.js';
import {carryoverRows,confirmLeftovers} from './meal-carryover.js';
import {groceryProviders,shopListLines} from './shop-this-list.js';
import {mountGoogleSignIn} from './google-signin.js';
import {createOnboardingMotion} from './onboarding-motion.js';
import {savingsComparison} from './savings.js';
import {weeklyCalendar,kitchenBackup} from './settings-tools.js';
import {createPreviewSlideshow} from './preview-slideshow.js';
import {createCloudBackup} from './cloud-backup.js';
import {createCookingTimer,timerText} from './cooking-timer.js';
import {COOKING_HISTORY_KEY,emptyHistory,loadHistory,hasCooked,recordCook,undoCookedMark,historyEntries} from './cooking-history.js';
import {filterSavedRecipes} from './recipe-filters.js';
import {calculateNutrition,nutritionSource} from './nutrition.js';
import {personalizedApi as api} from './lazy-api.js';
const $ = (selector, root = document) => root.querySelector(selector);
const screen = $('#screen');
const dialog = $('#dialog');
const toast = $('#toast');
const feedbackAttempts=new WeakMap();
const feedbackDraftKey='mealday.feedback-draft.v1';
const onboardingMotion=createOnboardingMotion(window);
let previousWizardStep=-1;
let wizardStory=null,storyCardsPaused=false;
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
Object.assign(ICONS,{cloud:'<path d="M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-1 4.5 4.5 0 1 1 0 9Z"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18"/>',share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>'});
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
let libraryDelay, carryoverPlan=null, carryoverFormRows=[], swapIndex=null,shoppingFilter='all',shoppingPricesOpen=false;
let detail=null, detailTab='ingredients', guidedStep=null, recipeOrigin='week', recipeScroll=0, recipeSequenceId=0;
const cookingTimer=createCookingTimer({onTick:updateTimerDisplay,onComplete:()=>notify('Your 5-minute timer finished.')});
let cloudApplying=false,deletingAccount=false;
const cloudBackup=createCloudBackup({snapshot:()=>({state:structuredClone(state),history:structuredClone(cookingHistory)}),apply:data=>{
  cloudApplying=true;state=data.state;cookingHistory=loadHistory(data.history);persist();persistHistory();cloudApplying=false;detail=null;guidedStep=null;library.rows=[];library.count=0;
  setView(state.result?'week':'welcome',false);
},changed:()=>{if(['settings','account'].includes(view))render();}});
function persist(){try{localStorage.setItem(key,JSON.stringify(state));if(!cloudApplying)cloudBackup.localChanged();}catch{notify('Browser storage is unavailable. Changes work until this page closes.');}}
function persistHistory(){try{localStorage.setItem(COOKING_HISTORY_KEY,JSON.stringify(cookingHistory));if(!cloudApplying)cloudBackup.localChanged();return true;}catch{notify('Cooking history could not be saved. Keep this page open and allow browser storage.');return false;}}
function logCook(recipe){cookingHistory=recordCook(cookingHistory,recipe,new Date().toISOString(),crypto.randomUUID());persistHistory();}
function notify(message){clearTimeout(toastTimer);toast.textContent=message;toastTimer=setTimeout(()=>toast.textContent='',3500);}
function recommendationSignals(){
  return {ratings:Object.entries(state.recipeJournal||{}).filter(([,entry])=>Number.isInteger(entry.rating)&&entry.rating>=1&&entry.rating<=5).slice(-500).map(([id,entry])=>[id,entry.rating]),saved:state.favorites.map(r=>r.id).slice(-500),cooked:(state.suggestionsReset?[]:historyEntries(cookingHistory)).filter(e=>e.cookedAt).slice(0,80).map(e=>[e.recipeId,e.cookedAt]),previous:(state.suggestionsReset?[]:state.result?.meals||[]).map(r=>r.id),plans:(state.planHistory||[]).slice(-6)};
}
function rememberPlan(result){
  return [...(state.planHistory||[]),{at:new Date().toISOString(),ids:result.meals.map(r=>r.id)}].slice(-8);
}
let lastCatalogueMode='live';
async function request(path,body) {
  if(body&&['/api/plan','/api/swaps','/api/swap'].includes(path))body={...body,signals:recommendationSignals()};
  const url=new URL(path,location.origin);
  const init=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
  const res=await api(new Request(url,init),url);
  const mode=res.headers.get('X-Mealday-Catalogue');
  if(mode&&mode!==lastCatalogueMode){
    if(mode==='cached-offline')notify('Recipe service unavailable. Using your last synced catalogue; recent edits may be missing.');
    if(mode==='bundled-offline')notify('Recipe service unavailable. Using the packaged offline recipes; recent edits may be missing.');
    lastCatalogueMode=mode;
  }
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Mealday could not finish this action. Please try again.');
  return data;
}
function button(label,action,style='ghost',symbol='',extra=''){
  return '<button type="button" class="button '+style+'" data-action="'+action+'" '+extra+'>'+(symbol?icon(symbol):'')+label+'</button>';
}
function catalogueNotice(){
  if(lastCatalogueMode==='live')return '';
  return '<p class="notice" role="status">'+(lastCatalogueMode==='cached-offline'?'Showing your last synced recipe catalogue.':'Showing packaged offline recipes.')+' Recent changes may be missing. '+button('Retry live recipes','refresh-recipes','ghost small')+'</p>';
}
function photo(meal){
  const image=meal.imageUrl;
  return publicImage((image==='/recipe-image-unavailable.svg'||!image)&&illustratedPhotoIds.has(meal.id)?'/recipes/'+meal.id+'.webp':image);
}
function meta(meal){return '<div class="meta"><span>'+icon('time')+esc(meal.minutes)+' min</span><span>'+esc(meal.cuisine)+'</span><span>'+esc(cap(meal.diet))+'</span></div>';}
function initNavigation(){
  for(const b of document.querySelectorAll('.nav button')) {
    const name=b.dataset.view;
    b.innerHTML=icon(name==='plan'?'settings':name==='settings'?'gear':name==='recipes'?'plate':name)+'<span>'+labels[name]+'</span>';
  }
}
function render(){
  onboardingMotion.cancel();
  document.body.dataset.view=view;
  $('.nav').hidden=['welcome','quick-start','setup','recipe','account','shopping','add-grocery'].includes(view);
  for(const b of document.querySelectorAll('.nav button')){
    const active=b.dataset.view===view||(b.dataset.view==='plan'&&view==='pantry')||(b.dataset.view==='settings'&&view==='history');b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  }
  screen.setAttribute('aria-busy',String(busy&&view!=='setup'));
  if(view==='welcome')screen.innerHTML=welcome();
  if(view==='quick-start')screen.innerHTML=quickStart();
  if(view==='setup'){
    if(busy)screen.innerHTML=renderGeneration();
    else renderWizard();
  }
  if(view==='week')screen.innerHTML=week();
  if(view==='recipes')renderRecipes();
  if(view==='shopping'){screen.innerHTML=shopping();refreshStorePrices();}
  if(view==='add-grocery')screen.innerHTML=addGrocery();
  if(view==='pantry')screen.innerHTML=pantry();
  if(view==='plan')screen.innerHTML=planSettings();
  if(view==='settings')screen.innerHTML=settings();
  if(view==='history')screen.innerHTML=cookingHistoryPage();
  if(view==='account'){
    screen.innerHTML=onboardingAccount();
    const holder=screen.querySelector('[data-google-signin]');
    if(holder){const chosen=structuredClone(wizardDraft);mountGoogleSignIn(holder,{onSuccess:async()=>{await cloudBackup.init();wizardDraft=chosen;await finishOnboarding();}});}
  }
  if(view==='recipe'&&detail)renderRecipeDetail(detail);
  if(view==='welcome')previewSlideshow.start();else {previewSlideshow.stop();previewHovered=false;}
}
function heading(title,description){return '<div class="page-head"><h1>'+title+'</h1><p>'+description+'</p></div>';}
function week(){
  const result=state.result,p=state.profile;
  const rows=result?.meals.map(m=>{
    const selected=priorities.find(([id])=>m.matchedStyles?.includes(id));
    const tag=selected?.[2]||(m.minutes<=30?'Speedy meals':m.diet==='vegan'||m.diet==='vegetarian'?'Plant-based':m.cuisine);
    const tone=m.minutes<=30?'quick':m.diet==='vegan'||m.diet==='vegetarian'?'plant':'home';
    const cost=Number.isFinite(m.ingredientCost)?'<span title="Estimated cost of ingredients used">AED '+money(m.ingredientCost*p.people)+'</span>':'';
    return '<article class="meal-row"><span class="meal-day">'+DAYS[m.day]+(p.mealTypes.length>1?' · '+esc(cap(m.meal)):'')+'</span><button class="meal-open" type="button" data-action="recipe" data-id="'+esc(m.id)+'"><img loading="lazy" src="'+photo(m)+'" alt=""><div class="meal-body"><h3 class="meal-name">'+esc(recipeLabel(m.id,m.componentNames?.[0]||m.name))+'</h3><span class="meal-tag '+tone+'">'+(hasCooked(cookingHistory,m.id)?'Cooked':esc(tag))+'</span><div class="meta"><span>'+icon('time')+m.minutes+' min</span><span>'+icon('people')+p.people+'</span>'+cost+'</div>'+(m.recommendationReason?'<p class="meal-recommendation">'+esc(m.recommendationReason)+'</p>':'')+'</div></button></article>';
  }).join('');
  const items=result?.items.filter(item=>item.packs>0)||[];
  const extras=state.extraGroceries||[],total=items.length+extras.length;
  const bought=items.filter(item=>state.checked.includes(item.key)).length+extras.filter(i=>i.checked).length;
  return '<header class="plan-greeting"><p class="plan-salutation">Good '+(new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening')+'</p><h1>'+(p.name?'Chef '+esc(p.name)+'!':'My week')+'</h1>'+button('Planned for '+esc(p.shop),'go-plan','shop-pill','shopping')+'</header>'+
    '<section class="plan-overview" aria-label="Weekly budget and groceries"><div class="overview-card"><span>Grocery estimate</span><div class="overview-cost"><strong>AED '+money(result?.total||0)+'</strong><small> / '+money(p.budget)+'</small></div><progress max="'+p.budget+'" value="'+Math.min(result?.total||0,p.budget)+'" aria-label="Estimated grocery cost against budget"></progress><small class="estimate-disclaimer">Catalogue estimate · delivery not included</small></div>'+
    '<button class="overview-card grocery-link" type="button" data-action="go-shopping"><span>Tap to view</span><strong>Grocery list</strong><small>'+bought+'/'+total+' items bought</small><progress max="'+Math.max(total,1)+'" value="'+bought+'" aria-label="Grocery shopping progress"></progress></button></section>'+
    (error?'<p class="notice" role="alert">'+esc(error)+'</p>':'')+
    recommendationSummary(result)+'<div class="meal-list">'+(rows||'<div class="empty">Generate your first plan.</div>')+'</div>'+
    nextWeekShortcut()+'<div class="week-bottom">'+button(busy?'Planning…':'Rebuild plan','generate','green wide','refresh',busy?'disabled':'')+button('','go-plan','ghost icon-only','settings','aria-label="Plan preferences"')+'</div>';
}
function recommendationSummary(result){
  const info=result?.recommendationInfo;
  if(!info)return '';
  if(info.status!=='applied')return '<p class="plan-personalisation">Your plan fits your preferences. Personalisation was unavailable for this rebuild.</p>';
  const factors=[info.ratings?'ratings':'',info.saved?'saved meals':'',(info.recentCooks||info.recentMeals)?'recent meals':''].filter(Boolean);
  return '<p class="plan-personalisation">Suggestions use your '+esc(factors.join(', '))+'.'+(info.recentRemaining?' Some recent meals remain after balancing your ratings and current limits.':'')+(info.lowRatedRemaining?' Some lower-rated meals remain to fit your current limits.':'')+'</p>';
}
function swapCostText(cents){
  return cents>0?'Save AED '+priceMoney(cents/100):cents<0?'Costs AED '+priceMoney(-cents/100)+' more':'No change in estimated grocery spend';
}
function nextWeekShortcut(){
  if(!state.result?.plan?.length||!leftoverRows().length)return '';
  const last=state.lastSwapEstimate;
  return '<section class="surface-card carryover-card"><h2>Leftovers for next week</h2><p>At the end of your week, confirm what is actually left before reusing it.</p>'+
   (Number.isSafeInteger(last)?'<p><small>Last swap estimate</small><br><strong>'+esc(swapCostText(last))+'</strong></p>':'')+
   button('Review leftovers','review-leftovers','ghost wide')+'</section>';
}
function leftoverRows(){return carryoverRows(state.result?.items||[],state.carryoverCandidates||[]);}
function reviewLeftovers(){
  if(busy)return;
  carryoverPlan=state.result;carryoverFormRows=leftoverRows();
  if(!carryoverPlan||!carryoverFormRows.length)return;
  openDialog('Leftovers for next week','Only amounts you confirm are carried into the next plan.',
   '<form id="leftover-form"><p>Estimates assume you buy the planned packs and cook all the planned meals. Check what you actually have and can still use. For ingredients already in your pantry, enter the remaining amount or 0.</p>'+
   '<div class="carryover-rows">'+carryoverFormRows.map(row=>'<label class="carryover-row"><span><strong>'+esc(row.name)+'</strong><small>'+(row.expected==null?'Removed from a recent plan':('Expected: '+quantity(row.expected)+' '+esc(row.unit)))+'</small></span><span><input class="control" type="number" inputmode="decimal" name="leftover-'+esc(row.key)+'" aria-label="'+esc(row.name+' remaining in '+row.unit)+'" min="0" max="100000" step=".01" '+(state.pantry[row.key]>0?'required':'')+'><small>'+esc(row.unit)+'</small></span></label>').join('')+'</div>'+
   '<p id="form-error" role="alert" hidden></p><button class="button green wide" type="submit">Confirm and plan next week</button></form>');
}
function showSwapImpact(impact){
  const changed=impact.rows.map(row=>'<li><strong>'+esc(row.name)+'</strong> · '+row.fromPacks+' → '+row.toPacks+' planned packs<br><small>Expected remaining: '+quantity(row.beforeLeft)+' → '+quantity(row.afterLeft)+' '+esc(row.unit)+'</small></li>').join('');
  openDialog('Swap updated','Whole-basket estimate, not a checkout saving.',
   '<div class="carryover-card"><strong>'+esc(swapCostText(impact.savedCents))+'</strong><p>Estimated weekly groceries: AED '+priceMoney(impact.beforeCents/100)+' → AED '+priceMoney(impact.afterCents/100)+'. This does not include delivery or groceries you already paid for.</p>'+
   (changed?'<h3>Pack and leftover changes</h3><ul class="swap-impact-list">'+changed+'</ul>':'')+
   '<p>At the end of the week, use Review leftovers to confirm what you still have.</p></div>');
}
function keepChecked(previous,next,checked){
  const before=new Map((previous?.items||[]).map(item=>[item.key,item]));
  return checked.filter(id=>next.items.some(item=>item.key===id&&item.packs===before.get(id)?.packs&&item.pack===before.get(id)?.pack));
}
async function generate(profile=state.profile,rollover=null){
  if(busy)return;
  const attempt=++requestId;
  busy=true;error='';
  if(!dialog.open)render();
  try{
    const seed=state.seed+1;
    const onboarding=['quick-start','setup','account'].includes(view);
    if(onboarding)await new Promise(resolve=>setTimeout(resolve,40));
    const result=await request('/api/plan',{profile,pantry:rollover?.pantry??state.pantry,seed});
    if(attempt!==requestId)return;
    if(rollover&&state.result!==rollover.plan)throw Error('Your plan changed. Review leftovers again.');
    if(onboarding&&['setup','account'].includes(view)){
      screen.innerHTML=renderGeneration(true);
      await new Promise(resolve=>setTimeout(resolve,720));
    }
    state={...state,...(rollover?{pantry:rollover.pantry,carryoverCandidates:[]}:{}),profile,result,seed,checked:[],suggestionsReset:false,planHistory:rememberPlan(result)};
    day=profile.days[0];persist();
    if(onboarding)clearPendingSetup();
    if(dialog.open)dialog.close();
    setView('week');
    notify(rollover?'Next week planned with your confirmed pantry.':'Your '+result.meals.length+' meals are planned.');
  }catch(err){
    error=err.message;
    if(dialog.open){const message=$('#form-error',dialog);if(message){message.hidden=false;message.textContent=error;}else notify(error);}
  }finally{busy=false;if(['week','quick-start','setup','plan'].includes(view))render();}
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
  holder.innerHTML=catalogueNotice()+(library.saved?'<p class="saved-result-count">'+rows.length+' of '+state.favorites.length+' saved recipes</p>':'')+(library.error&&!library.saved?'<p role="alert" class="notice">'+esc(library.error)+'</p>':'')+
    (rows.length?'<div class="cards">'+rows.map(r=>'<article class="recipe-card"><img loading="lazy" src="'+photo(r)+'" alt=""><div class="recipe-card-body"><span class="meal-type">'+esc(r.cuisine)+'</span><h3>'+esc(recipeLabel(r.id,r.name))+'</h3>'+meta(r)+button(r.unavailable?'No longer published':'View recipe','recipe','ghost small','right','data-id="'+esc(r.id)+'"'+(r.unavailable?' disabled':''))+'</div></article>').join('')+'</div>':
    '<div class="empty">'+(library.loading?'Loading recipes…':empty)+clearFilters+'</div>')+
    (!library.saved&&library.next!==null?'<div class="more">'+button(library.loading?'Loading…':'More recipes','more','ghost','right',library.loading?'disabled':'')+'</div>':'');
}
async function loadRecipes(append=false){
  const seq=++recipeSequence;
  if(library.saved){
    library.loading=true;library.error='';
    try{const data=await request('/api/saved-recipes?ids='+encodeURIComponent(state.favorites.map(r=>r.id).join(',')));
      if(seq===recipeSequence){const current=new Map(data.recipes.map(r=>[r.id,r]));state.favorites=state.favorites.map(r=>current.get(r.id)||{...r,unavailable:true});}
    }catch(error){if(seq===recipeSequence)library.error=error.message;}
    finally{if(seq===recipeSequence){library.loading=false;if(view==='recipes')renderRecipes(true);}}
    return;
  }
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
let storePriceState={key:'',data:null,error:'',loading:false,at:0},priceLocation='',priceRequestSequence=0,priceContext='',priceExpiryTimer;
function priceInput(){const context=state.profile.shop+'|'+state.profile.city;if(priceContext!==context){priceContext=context;priceLocation='';}return {shop:state.profile.shop,city:state.profile.city,locationId:priceLocation,items:(state.result?.items||[]).filter(i=>i.packs>0).map(i=>({key:i.key,need:i.need,unit:i.unit}))};}
function priceKey(){return JSON.stringify(priceInput());}
async function refreshStorePrices(force=false){
 if(!state.result)return;
 const input=priceInput(),key=JSON.stringify(input);
 if(!force&&storePriceState.key===key&&(storePriceState.loading||Date.now()-storePriceState.at<60000))return;
 const sequence=++priceRequestSequence;
 storePriceState={key,data:null,error:'',loading:true,at:Date.now()};if(view==='shopping')screen.innerHTML=shopping();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('/api/store-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Price records unavailable.');
  if(!Array.isArray(data.items)||!Number.isInteger(data.matched))throw Error('Invalid price response.');
  if(sequence===priceRequestSequence&&priceKey()===key&&storePriceState.key===key){
    storePriceState={key,data,error:'',loading:false,at:Date.now()};clearTimeout(priceExpiryTimer);
    const expiry=Math.min(...data.items.filter(i=>i.status==='recorded-price').map(i=>Date.parse(i.validUntil)));
    if(Number.isFinite(expiry))priceExpiryTimer=setTimeout(()=>{if(storePriceState.key!==key||sequence!==priceRequestSequence)return;storePriceState={key,data:null,error:'Price records expired. Check again for dated prices.',loading:false,at:0};if(view==='shopping')refreshStorePrices(true);},Math.max(1,expiry-Date.parse(data.calculatedAt)));
  }
 }catch{if(sequence===priceRequestSequence&&storePriceState.key===key)storePriceState={key,data:null,error:'Price records could not be checked. Catalogue estimates are shown.',loading:false,at:Date.now()};}
 finally{clearTimeout(timer);if(view==='shopping'&&priceKey()===key)screen.innerHTML=shopping();}
}
function currentStorePrices(){return storePriceState.key===priceKey()?storePriceState:null;}
function priceMoney(value){return Number(value).toFixed(2);}
function storePricePanel(){
 const status=currentStorePrices(),data=status?.data;
 let copy=status?.loading?'Checking product-price records…':status?.error||'No checked product prices recorded for this store and city. Store selection does not change the catalogue estimates.';
 if(data?.status==='no-purchases')copy='No products need buying.';
 else if(data?.status==='choose-location')copy='Choose the location these recorded prices apply to.';
 else if(data?.matched)copy=data.matched+' of '+data.totalLines+' items have recent, reviewed price records. '+(data.recordedSubtotal===null?'A complete recorded subtotal is unavailable.':'This is a recorded product subtotal, not a live checkout quote.');
 const total=data?.recordedSubtotal;
 const location=(data?.locations?.length>1||data?.locations?.length&&!data.locationName)?'<label class="field">Price location<select id="store-price-location" class="control"><option value="">Choose location</option>'+data.locations.map(l=>'<option value="'+esc(l.id)+'" '+(l.id===priceLocation?'selected':'')+'>'+esc(l.name)+'</option>').join('')+'</select></label>':data?.locationName?'<p>'+esc(data.locationName)+' · '+esc(data.city)+'</p>':'';
 return '<section class="surface-card store-prices" aria-label="Supermarket price records"><h2>Supermarket price records</h2><p class="store-price-status" role="status">'+esc(copy)+'</p>'+location+(total!==null&&total!==undefined?'<p class="recorded-price-total"><strong>AED '+priceMoney(total)+'</strong> · recorded product subtotal</p>':data?.matched?'<p class="known-price-subtotal">AED '+priceMoney(data.knownSubtotal)+' · matched items only</p>':'')+'<p>Price, usable pack quantity and reported stock are checked per product. Delivery fees, checkout totals and current delivery availability are not confirmed. Extra essentials are not priced.</p>'+button(status?.loading?'Checking…':'Check price records','check-store-prices','ghost small','refresh',status?.loading?'disabled':'')+'</section>';
}
function priceDate(value){return new Date(value).toLocaleString('en-AE',{timeZone:'Asia/Dubai',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' UAE';}
function storePriceRow(item){
 const record=currentStorePrices()?.data?.items.find(r=>r.key===item.key);
 if(record?.status==='recorded-price')return '<div class="store-product-record"><a href="'+esc(record.productUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(record.productName)+'</a><p>'+record.packs+' × '+esc(record.packLabel)+' · AED '+priceMoney(record.price)+' per pack</p><p>'+esc(record.quantityBasis)+'</p><small>Price checked '+esc(priceDate(record.checkedAt))+' · valid until '+esc(priceDate(record.validUntil))+'</small><small>Reported in stock'+(record.stockPacks===null?' · available quantity not confirmed':' · '+record.stockPacks+' packs reported')+' · <a href="'+esc(record.source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(record.source.name)+'</a></small></div>';
 const reasons={'stale':'Price record expired.','out-of-stock':'Reported out of stock.','stock-unknown':'Availability not confirmed.','insufficient-stock':'Not enough stock reported.','ingredient-changed':'Ingredient match needs review.','price-overflow':'Price calculation needs review.','choose-location':'Choose a price location.','no-reviewed-match':'No reviewed product match.'};
 return '<div class="store-product-record catalogue-record"><small>'+esc((record?.status&&record.status!=='no-reviewed-match'?(reasons[record.status]||'Price record needs a recheck.'):'')+(record?.checkedAt?' Last observation '+priceDate(record.checkedAt):''))+'</small></div>';
}
function shoppingItems(){return (state.result?.items||[]).filter(i=>i.packs>0);}
function shoppingVisible(bought){return shoppingFilter==='all'||(shoppingFilter==='bought'?bought:!bought);}
function shopping(){
 const items=shoppingItems(),extras=state.extraGroceries||[],total=items.length+extras.length;
 const bought=items.filter(i=>state.checked.includes(i.key)).length+extras.filter(i=>i.checked).length;
 const groups=new Map();for(const item of items){const category=item.category||'Pantry';if(!groups.has(category))groups.set(category,[]);groups.get(category).push(item);}
 const ordered=[...groups].sort(([a],[b])=>((/vegetable/i.test(a)?0:/pantry|groc|grain/i.test(a)?1:2)-(/vegetable/i.test(b)?0:/pantry|groc|grain/i.test(b)?1:2)));
 let shown=0;
 const rows=ordered.map(([name,list])=>{
  const visible=list.filter(i=>shoppingVisible(state.checked.includes(i.key)));if(!visible.length)return '';shown+=visible.length;
  return '<section class="grocery-group"><h3><span>'+esc(name==='Vegetables'?'Fruit & veg':name==='Pantry'?'Herbs, spices & pantry':name)+'</span><span>'+visible.length+'</span></h3><div class="basket-items">'+visible.map(i=>{
   const record=currentStorePrices()?.data?.items.find(r=>r.key===i.key),recorded=record?.status==='recorded-price',checked=state.checked.includes(i.key);
   const packs=recorded?record.packs:i.packs,pack=recorded?record.packLabel:quantity(i.pack)+' '+i.unit;
   const have=Number(i.have)||0,remaining=Math.max(0,i.need-have);
   return '<div class="priced-grocery-item"><label class="basket-row '+(checked?'checked':'')+'"><input aria-label="Bought '+esc(i.name)+'" type="checkbox" data-grocery="'+esc(i.key)+'" '+(checked?'checked':'')+'><img class="ingredient-image" src="'+ingredientPicture(i.name)+'" alt="" width="42" height="42" loading="lazy" decoding="async"><span class="basket-copy"><strong>'+esc(i.name)+'</strong><span class="basket-pack">'+packs+' × '+esc(pack)+'</span><small class="basket-needed">('+quantity(remaining)+' '+esc(i.unit)+' needed)</small><small class="basket-quantities">Recipe '+quantity(i.need)+' · At home '+quantity(have)+' · Needed '+quantity(remaining)+' '+esc(i.unit)+'</small><small class="basket-price-kind">'+(recorded?'Recorded product price':'Catalogue estimate')+'</small></span><span class="basket-buy-quantity">'+(packs>1?packs+' × ':'')+esc(pack)+'</span><span class="price">'+'AED '+priceMoney(recorded?record.subtotal:i.cost)+'</span></label>'+storePriceRow(i)+'</div>';
  }).join('')+'</div></section>';
 }).join('');
 const extraRows=extraGroceryList();shown+=extras.filter(i=>shoppingVisible(i.checked)).length;
 const tabs=[['all','All'],['todo','To buy'],['bought','Bought']].map(([id,label])=>button(label,'shopping-filter','shopping-tab'+(shoppingFilter===id?' selected':''),'','data-id="'+id+'" aria-pressed="'+(shoppingFilter===id)+'"')).join('');
 return '<div class="shopping-page clean-grocery-list '+(shoppingPricesOpen?'show-prices':'')+'"><header class="grocery-header">'+button('←','go-week','grocery-back','','aria-label="Back to my week"')+'<p>This week</p><h1>Grocery list</h1><div class="grocery-store-pill"><span class="grocery-store-name">'+esc(state.profile.shop)+'</span><span class="grocery-done">'+bought+'/'+total+' done</span></div><span class="shopping-progress-label" aria-live="polite">'+bought+' / '+total+' items bought</span><progress class="shopping-progress" value="'+bought+'" max="'+Math.max(1,total)+'" aria-label="Shopping progress"></progress></header><div class="grocery-actions">'+button('Copy list','copy','grocery-copy')+button('Share','shopping-share','grocery-share')+'</div>'+button('Shop this list','shop-this-list','ghost wide','shopping',shopListLines(items,state.checked,extras).length?'':'disabled')+button('+ Add groceries','grocery-add','green wide grocery-add')+'<section class="shopping-list-card"><div class="shopping-groups">'+rows+extraRows+(!shown?'<div class="shopping-empty">'+(shoppingFilter==='bought'?'No items bought yet.':shoppingFilter==='todo'?'Everything is bought. You’re ready to cook!':state.result?'You have enough ingredients for your plan.':'Plan your meals to build a shopping list.')+'</div>':'')+'</div></section><section class="grocery-list-tools"><h2>List tools</h2><div class="shopping-toolbar"><div class="shopping-tabs" role="group" aria-label="Filter shopping list">'+tabs+'</div>'+button('Reset','shopping-reset','shopping-reset','','aria-label="Reset bought items" '+(!bought?'disabled':''))+'</div>'+button(shoppingPricesOpen?'Hide price details':'Prices & product options','shopping-prices','ghost wide','','aria-expanded="'+shoppingPricesOpen+'"')+'</section>'+
 (state.result?'<section class="shopping-price-area" aria-label="Grocery pricing"><div class="surface-card shopping-head"><div><p class="section-caption">Estimated grocery total</p><strong>AED '+priceMoney(state.result.total)+'</strong><p class="subtle">'+esc(state.profile.shop)+' · '+esc(state.profile.city||'Dubai')+'<br>Delivery and checkout fees not included</p></div>'+button('Change store','go-plan','ghost small')+'</div>'+storePricePanel()+button('Compare with my checkout','compare-checkout','ghost wide')+'<details class="surface-card price-explanation"><summary>Estimate &amp; pack details</summary><p>Catalogue estimates use assumed pack prices. Selected retailer products are shown separately with source and retrieval time. Delivery fees and checkout availability are not confirmed.</p></details></section>':'')+nextWeekShortcut()+'<div class="setting-list pantry-shortcut">'+settingRow('Already have something?','go-pantry','Update your pantry to adjust the grocery list')+'</div></div>';

}
function openShopThisList(){
 const lines=shopListLines(shoppingItems(),state.checked,state.extraGroceries||[]);
 if(!lines.length){notify('No groceries left to buy.');return;}
 openDialog('Shop this list','Copy the groceries you still need, then open a store.',
  '<div class="shop-handoff"><p>Add the items manually. Each store confirms prices, stock and delivery at checkout. Mealday does not fill or place an order.</p>'+
  '<label for="shop-copy-text">To-buy list ('+lines.length+')</label><textarea class="control" id="shop-copy-text" rows="5" readonly>'+esc(lines.join('\n'))+'</textarea>'+
  button('Copy to-buy list','shop-copy','green wide','copy')+'<p class="shop-copy-status" role="status" aria-live="polite"></p>'+
  '<div class="shop-provider-links">'+groceryProviders.map(p=>'<a class="button ghost wide" href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open '+esc(p.name)+'</a>').join('')+'</div></div>');
}
async function copyShopList(){
 const input=$('#shop-copy-text',dialog),status=$('.shop-copy-status',dialog);
 if(!input||!status)return;
 try{
  if(window.MealdayAndroid?.copy)window.MealdayAndroid.copy(input.value);
  else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(input.value);
  else throw Error('Clipboard not available');
  status.textContent='To-buy list copied.';
 }catch{
  input.focus();input.select();status.textContent='List selected. Use your device’s Copy command.';
 }
}
function openCheckoutComparison(){
  openDialog('Compare with my checkout','Manual comparison · nothing is saved or sent.',
    '<form id="checkout-comparison"><p>Use the same basket and quantities. Leave unrelated extras out. The catalogue estimates the grocery subtotal, not delivery.</p>'+
    '<label class="field">Retailer grocery subtotal (AED)<input class="control" type="number" name="subtotal" min="0" max="50000" step=".01" required></label>'+
    '<label class="field">Delivery and checkout fees (AED)<input class="control" type="number" name="fees" min="0" max="10000" step=".01" placeholder="0"></label>'+
    '<button type="submit" class="button green wide">Compare totals</button><p><output aria-live="polite"></output></p></form>');
}
function addGrocery(){
 return '<section class="add-grocery-page"><div class="grocery-sheet-handle" aria-hidden="true"></div><header class="add-grocery-header">'+button('←','grocery-cancel','grocery-back','','aria-label="Back to grocery list"')+'<h1>Add groceries</h1></header><form id="extra-grocery-form"><label class="field" for="grocery-item">Item</label><input id="grocery-item" class="control" name="item" required maxlength="80" placeholder="e.g. Bananas" autocomplete="off"><label class="field" for="grocery-quantity">Quantity (optional)</label><input id="grocery-quantity" class="control" name="quantity" maxlength="80" placeholder="e.g. 2 lb" autocomplete="off"><button class="button green wide" type="submit" disabled>Add to list</button></form></section>';
}
function extraGroceryList(){
 const items=(state.extraGroceries||[]).filter(i=>shoppingVisible(i.checked));if(!items.length)return '';
 return '<section class="grocery-group extra-groceries"><h3><span>Extra essentials</span><span>'+items.length+'</span></h3><div class="basket-items">'+items.map(i=>'<div class="priced-grocery-item"><label class="basket-row '+(i.checked?'checked':'')+'"><input aria-label="Bought '+esc(i.name)+'" type="checkbox" data-extra="'+esc(i.id)+'" '+(i.checked?'checked':'')+'><img class="ingredient-image" src="'+ingredientPicture(i.name)+'" alt="" width="42" height="42" loading="lazy"><span class="basket-copy"><strong>'+esc(i.name)+'</strong><small>Extra item · unpriced</small></span><span class="basket-buy-quantity">'+esc(i.quantity||'')+'</span></label></div>').join('')+'</div></section>';
}
function groceryListText(){
 const lines=shoppingItems().map(i=>{
  const choice=window.MealdayLuluPrices?.choice(i.key),r=currentStorePrices()?.data?.items.find(x=>x.key===i.key),mark=state.checked.includes(i.key)?'[x] ':'[ ] ';
  if(choice?.quote){const p=choice.products[0];return mark+i.name+' — '+choice.quote.packs+' × '+p.packLabel+' ('+p.name+', LuLu UAE online AED '+priceMoney(choice.quote.subtotal)+', retrieved '+choice.checkedAt+')';}
  return mark+(r?.status==='recorded-price'?i.name+' — '+r.packs+' × '+r.packLabel+' ('+r.productName+', recorded AED '+priceMoney(r.subtotal)+', checked '+r.checkedAt+')':i.name+' — '+i.packs+' × '+i.pack+' '+i.unit+' (catalogue estimate AED '+priceMoney(i.cost)+')');
 });
 for(const i of state.extraGroceries||[])lines.push((i.checked?'[x] ':'[ ] ')+i.name+(i.quantity?' — '+i.quantity:'')+' (extra item, unpriced)');
 return 'Mealday shopping list\n'+lines.join('\n');
}
async function shareGroceries(){
 const text=groceryListText();
 try{if(navigator.share){await navigator.share({title:'Mealday shopping list',text});return;}}catch(e){if(e.name==='AbortError')return;}
 try{if(window.MealdayAndroid)window.MealdayAndroid.copy(text);else await navigator.clipboard.writeText(text);notify('Grocery list copied.');}catch{openDialog('Share grocery list','Copy your list below.','<textarea class="control" rows="12" readonly aria-label="Grocery list to share">'+esc(text)+'</textarea>');}
}
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
function ingredientIcon(item){return '<img class="ingredient-image" src="'+ingredientPicture(item.name)+'" alt="" width="24" height="24" loading="lazy">';}
function mealComponents(r){return r.mealComplete&&r.componentNames?.length>1?'<p class="meal-components">Includes: '+r.componentNames.slice(1).map(esc).join(' · ')+'</p>':'';}
function renderNutrition(r){
  const result=r.nutrition||calculateNutrition(r.items);
  const metrics=[['kcal','kcal','Calories'],['protein','g','Protein'],['carbs','g','Carbs'],['fat','g','Fats']];
  const values=metrics.map(([key,unit,label])=>'<div class="macro-value macro-'+key+'"><strong>'+ (result.complete?Math.round(result.totals[key])+ (unit==='g'?'<span>g</span>':''):'—')+'</strong><small>'+esc(label)+(unit==='kcal'?' · kcal':'')+'</small></div>').join('');
  const matched=result.references.length,total=r.items.length;
  const rows=result.references.map(ref=>'<li><a href="'+esc(ref.url)+'" target="_blank" rel="noopener noreferrer">'+esc(ref.name)+'</a><span>'+(ref.grams===null?quantity(ref.amount)+' '+esc(ref.unit):quantity(ref.grams)+' g')+' per serving · '+Math.round(ref.nutrients.kcal)+' kcal</span><small>'+esc(ref.description)+(ref.note?' · '+esc(ref.note):'')+'</small><small>'+esc(ref.source?.name||'Ingredient reference')+' · checked '+esc(ref.source?.retrieved||nutritionSource.retrieved)+'</small></li>').join('');
  const missing=result.missing.map(item=>'<li><strong>'+esc(item.name)+'</strong><small>'+esc(item.reason)+'</small></li>').join('');
  return '<section class="recipe-panel recipe-nutrition" aria-labelledby="macro-heading"><h2 id="macro-heading" class="recipe-kicker">Macros · per serving</h2><div class="macro-grid">'+values+'</div><p class="nutrition-status '+(result.complete?'complete':'pending')+'">'+(result.complete?'Calculated estimate · sourced ingredient references':'Complete totals unavailable · '+matched+' of '+total+' ingredients matched')+'</p>'+
    (!result.complete?'<p class="nutrition-explanation">Missing nutrition data for '+esc(result.missing.map(x=>x.name).join(', '))+'. Complete macros need verified data for these ingredients.</p>':'')+
    '<details class="nutrition-sources"><summary>Nutrition sources &amp; calculation</summary><p>Per serving, regardless of your household size. Values use the listed ingredient amounts and disclosed edible yields; all listed oil and whole dried lime are counted. Named brands, reference spice blends and bread portions are estimates and can differ from your ingredients. Cooking losses and retained nutrients are not modelled.</p><p>'+esc(nutritionSource.name)+' · checked '+esc(nutritionSource.retrieved)+'. Individual source links are listed below.</p><p>Calculation: ingredient quantity × its source conversion × reference nutrients, summed before rounding. Carbs include fibre when the source reports it; otherwise the source carbohydrate value is retained. Gram, ml and named-serving references keep their original units. These are calculated estimates, not laboratory-tested dishes.</p>'+(missing?'<h3>References still needed</h3><ul>'+missing+'</ul>':'')+'<h3>Matched ingredients</h3><ul>'+rows+'</ul></details></section>';
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

  screen.innerHTML=catalogueNotice()+'<article class="recipe-page"><div class="recipe-cover"><img src="'+photo(r)+'" alt=""><span class="recipe-photo-caption">'+(r.photoStatus==='generated'?'AI meal illustration':'Meal illustration')+'</span>'+button('','recipe-back','cover-back','back','aria-label="Back from recipe"')+
    button('','favorite','cover-save'+(isSaved?' is-saved':''),'heart','aria-label="'+(isSaved?'Remove saved recipe':'Save recipe')+'" aria-pressed="'+isSaved+'"' )+'</div><h1 tabindex="-1">'+esc(recipeLabel(r.id,r.componentNames?.[0]||r.name))+'</h1>'+mealComponents(r)+
    renderNutrition(r)+
    '<section class="recipe-panel recipe-actions"><h2 class="recipe-kicker">Recipe notes</h2><p>Cook time: '+esc(r.minutes)+' min <span aria-hidden="true">&nbsp; | &nbsp;</span> Serves: '+people+'</p><div>'+button(cooked?'Cooked':'Mark as cooked','cooked','cook-check'+(cooked?' marked':''),'check','aria-pressed="'+cooked+'" aria-label="'+(cooked?'Undo cooked mark':'Mark as cooked')+'"')+'<div class="recipe-rating" role="group" aria-label="Rate this recipe">'+stars+'</div></div>'+(cooked?'<div class="cooking-record-summary"><p>Last cooked: '+esc(cookingDate(lastCook?.cookedAt))+'</p>'+button('Log another cook','log-cook','ghost small','plus')+'</div>':'')+'</section>'+
    '<div class="recipe-tabs" role="group" aria-label="Recipe sections">'+['ingredients','instructions'].map(tab=>button(cap(tab),'recipe-tab','recipe-tab','','data-id="'+tab+'" aria-pressed="'+(detailTab===tab)+'"')).join('')+'</div>'+
    (detailTab==='ingredients'?ingredientRows:instructions)+'<details class="recipe-panel recipe-quality"><summary>Kitchen test pending · cooking notes</summary><p>Quantities, cooking time and taste have not been validated by Mealday in a kitchen. The '+esc(r.minutes)+' min total is an estimate; allow extra time on your first cook.</p><p>Ingredient amounts are scaled to '+people+' '+(people===1?'serving':'servings')+'. Check ingredient labels for raw, cooked or drained quantities. Your ratings and cooking history are personal feedback.</p></details>'+renderCookingTimer()+'<label class="personal-notes"><span>Your notes</span><textarea id="recipe-note" maxlength="2000" placeholder="Add a note to this recipe…">'+esc(entry.note||'')+'</textarea></label>'+
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
      data.choices.length?data.choices.map(r=>'<article class="swap-option"><div><strong>'+esc(recipeLabel(r.id,r.name))+'</strong><p>'+esc(r.minutes)+' min · AED '+money(r.total)+' estimated week</p><small>'+esc(swapCostText(-Math.round(r.change*100)))+'</small>'+(r.recommendationReason?'<small>'+esc(r.recommendationReason)+'</small>':'')+'</div>'+button('Choose','apply-swap','primary small','check','data-id="'+esc(r.id)+'"')+'</article>').join(''):'<p class="empty">No other meal fits these settings. Try a longer cooking time or a higher budget.</p>');
  }catch(err){if(dialog.open&&swapIndex===index)openDialog('Swap this meal','','<p class="notice">'+esc(err.message)+'</p>');}
}
async function applySwap(id,buttonNode){
  if(busy)return;
  const index=swapIndex,previous=state.result;
  busy=true;buttonNode.disabled=true;
  try{
    const result=await request('/api/swap',{profile:state.profile,pantry:state.pantry,plan:state.result.plan,index,recipeId:id});
    if(state.result!==previous)throw Error('Your plan changed. Open the swap again.');
    const impact=result.swapImpact;
    const removed=new Map((state.carryoverCandidates||[]).map(row=>[row.key,row]));
    for(const row of impact?.rows||[])if(row.removed)removed.set(row.key,{key:row.key,name:row.name,unit:row.unit});
    state={...state,checked:keepChecked(state.result,result,state.checked),result,lastSwapEstimate:impact?.savedCents,carryoverCandidates:[...removed.values()].slice(-100),planHistory:rememberPlan(result)};
    persist();dialog.close();if(view==='recipe')leaveRecipe();if(impact)showSwapImpact(impact);else notify('Meal swapped. Grocery list updated.');
  }catch(err){buttonNode.disabled=false;notify(err.message);}
  finally{busy=false;render();}
}
function setView(target,hash=true){
  view=Object.hasOwn(labels,target)||['welcome','quick-start','setup','recipe','account','add-grocery'].includes(target)?target:'week';
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
  if(action==='shopping-filter'){shoppingFilter=['all','todo','bought'].includes(id)?id:'all';screen.innerHTML=shopping();screen.querySelector('[data-action="shopping-filter"][data-id="'+shoppingFilter+'"]').focus({preventScroll:true});}
  else if(action==='shopping-reset'){const ids=new Set(shoppingItems().map(i=>i.key));state.checked=state.checked.filter(key=>!ids.has(key));for(const item of state.extraGroceries||[])item.checked=false;persist();screen.innerHTML=shopping();notify('Bought items reset.');}
  else if(action==='shopping-prices'){shoppingPricesOpen=!shoppingPricesOpen;screen.innerHTML=shopping();}
  else if(action==='compare-checkout'&&view==='shopping'&&state.result){openCheckoutComparison();}
  else if(action==='shopping-share'){await shareGroceries();}
  else if(action==='shop-this-list')openShopThisList();
  else if(action==='shop-copy')await copyShopList();
  else if(action==='setup-account-mode'){setupAccountMode=id;error='';render();}
  else if(action==='setup-account-back'){if(setupAccountBusy)return;error='';setupAccountMode='choice';wizardStory='benefits';setView('setup',false);}
  else if(action==='setup-account-guest'||action==='setup-account-continue'){await finishOnboarding();}
  else if(action==='cloud-account'){openCloudAccount();}
  else if(action==='account-login'){location.href='/login.html';}
  else if(action==='account-signup'){location.href='/signup.html';}
  else if(action==='cloud-connect'){await cloudBackup.init();openCloudAccount();}
  else if(action==='cloud-retry'){await cloudBackup.retry();}
  else if(action==='cloud-import'){try{await cloudBackup.importGuest();dialog.close();notify('Guest kitchen import processed. Check Settings for backup status.');}catch(e){notify(e.message);}}
  else if(action==='cloud-logout'){try{await cloudBackup.logout();dialog.close();}catch(e){notify(e.message);}}
  else if(action==='cloud-local'||action==='cloud-remote'){try{await cloudBackup.resolve(action==='cloud-local');dialog.close();}catch(e){notify(e.message);}}
  else if(action==='grocery-add')setView('add-grocery');
  else if(action==='grocery-cancel')setView('shopping');
  else if(action==='quick-start'){error='';quickDraft=structuredClone(state.profile);quickAdvanced=false;setView('quick-start',false);}
  else if(action==='quick-cancel'){if(!busy){error='';setView(state.result?'week':'welcome',false);}}
  else if(action==='quick-fewer'){if(!busy&&quickDraft.days.length>1){
    quickDraft={...quickDraft,days:quickDraft.days.slice(0,shorterDayCount(quickDraft))};await generate(quickDraft);
  }}
  else if(action==='quick-more-time'){if(!busy&&quickDraft.minutes<30){quickDraft={...quickDraft,minutes:30};await generate(quickDraft);}}
  else if(action==='start-setup'){beginWizard(false);}
  else if(action==='review-setup'){beginWizard(true);}
  else if(action==='preview-slide'){selectSlide(Number(id));}
  else if(action==='preview-toggle'){previewAutoplayPaused=!previewAutoplayPaused;previewSlideshow.setPaused(previewAutoplayPaused);updatePreviewSlides();}
  else if(action==='edit-setup'){setView('plan');}
  else if(action==='back-step'){backWizard();}
  else if(action==='next-step'){await nextWizard();}
  else if(action==='story-next'){await nextStory();}
  else if(action==='story-motion'){storyCardsPaused=!storyCardsPaused;renderStory();}
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
  else if(action==='welcome-back'){if(state.result)setView('week');else window.history.back();}
  else if(action==='log-cook'&&detail){logCook(detail);renderRecipeDetail(detail);notify('Another cook added to your history.');}
  else if(action==='go-plan')setView('plan');
  else if(action==='open-recipes')setView('recipes');
  else if(action==='share-plan')sharePlan();
  else if(action==='share-app')openDialog('Share Mealday','Copy this link to invite someone.','<input class="control" readonly aria-label="Mealday link" value="'+esc(location.origin)+'"><p class="quick-help">Select the link and copy it into your preferred messaging app.</p>');
  else if(action==='privacy')showPrivacy();
  else if(action==='export-backup'){downloadKitchen();}
  else if(action==='rate-app'||action==='request-feature')openFeedback(action==='rate-app'?'rating':'feature');
  else if(action==='contact')openFeedback('support');
  else if(action==='subscription')openDialog('Manage subscription','No billing is connected to this version.','<p>This Mealday preview does not sell or manage paid subscriptions. No subscription can be cancelled or changed here.</p>'+button('Done','close','green wide'));
  else if(action==='terms')openDialog('Terms of service','Mealday preview information','<div class="privacy-copy"><p>Mealday helps you plan meals and organise a grocery list. Prices and nutrition totals are estimates; recipe photographs are representative.</p><p>Check ingredients, allergens and food labels before cooking. Store availability, ordering and payments are not included in this preview.</p><p>Your kitchen is stored on your device unless you sign in to a connected backup server. See Privacy policy for details. There is no paid subscription on this version.</p></div>'+button('Done','close','green wide'));
  else if(action==='reset-suggestions')openDialog('Reset suggested meal history?','Start fresh with your next suggestions.','<p>This clears previous plan suggestions. Your current plan, favourites, ratings, notes and cooking history are kept.</p>'+button('Cancel','close')+' '+button('Reset suggestions','confirm-suggestions','danger'));
  else if(action==='confirm-suggestions'){state.planHistory=[];state.suggestionsReset=true;persist();dialog.close();notify('Suggested meal history cleared. Rebuild your plan for fresh suggestions.');}
  else if(action==='delete-account'){
    if(deletingAccount)return;
    if(!cloudBackup.info().account){notify('Sign in to delete your account.');return;}
    deletingAccount=true;b.disabled=true;b.setAttribute('aria-busy','true');b.querySelector('strong').textContent='Deleting account…';
    try{
      const result=await cloudBackup.deleteAccount();
      clearPendingSetup();setView('welcome');notify(result.localCleared?'Account deleted.':'Account deleted. Clear this browser’s site data to remove remaining local copies.');
    }catch(e){notify(e.message);}
    finally{deletingAccount=false;if(view==='settings')render();}
  }
  else if(action==='language'){openDialog('App language','English is the current app language.','<div class="language-active">'+icon('check')+'<span><strong>English</strong><small>Active language</small></span></div><p class="quick-help">Other languages are not available yet.</p>'+button('Done','close','green wide'));}
  else if(action==='edit-name')openDialog('Edit your name','','<form id="name-form"><label class="field">Name<input class="control" name="name" maxlength="40" required value="'+esc(state.profile.name)+'"></label><button class="button green wide">Save name</button></form>');
  else if(action==='clear-saved')openDialog('Reset saved meals?','This clears your favourites list.',button('Cancel','close')+' '+button('Reset saved meals','confirm-saved','danger'));
  else if(action==='confirm-saved'){state.favorites=[];persist();dialog.close();notify('Saved meals cleared.');}
  else if(action==='weekly-reminder')openReminder();
  else if(action==='open-reminder-calendar'){dialog.close();window.MealdayAndroid.weeklyReminder();}
  else if(action==='settings-reset')resetDialog();
  else if(action==='confirm-reset'){dialog.close();resetKitchen();}
  else if(action==='preferences')await preferences();
  else if(action==='day'){day=Number(b.dataset.day);render();$('.day-btn.active')?.focus();}
  else if(action==='generate')await generate();
  else if(action==='go-shopping')setView('shopping');
  else if(action==='check-store-prices')await refreshStorePrices(true);
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
  else if(action==='review-leftovers')reviewLeftovers();
  else if(action==='swaps')await swaps(Number(index));
  else if(action==='apply-swap')await applySwap(id,b);
  else if(action==='close'){if(!deletingAccount)dialog.close();}
  else if(action==='refresh-recipes'){if(detail){const id=detail.id;leaveRecipe();await showRecipe(id);}else await loadRecipes();}
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
    const list=groceryListText();
    try{if(window.MealdayAndroid)window.MealdayAndroid.copy(list);else await navigator.clipboard.writeText(list);notify('Grocery list copied.');}catch{openDialog('Copy grocery list','Select the text to copy it.','<textarea class="control" rows="12" cols="40" readonly>'+esc(list)+'</textarea>');}
  }
});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id==='quick-start-form'){
    event.preventDefault();if(busy)return;
    const data=new FormData(form);
    const next={...quickDraft};
    for(const field of ['shop','city','diet','cuisine'])next[field]=String(data.get(field));
    for(const field of ['people','budget','minutes'])next[field]=Number(data.get(field));
    next.cuisines=[next.cuisine];
    for(const field of ['allergies','appliances','mealTypes'])next[field]=data.getAll(field);
    next.days=data.getAll('days').map(Number);
    quickAdvanced=Boolean(form.querySelector('details')?.open);
    quickDraft=next;
    if(!next.days.length||!next.mealTypes.length||!next.appliances.length){
      error='Choose at least one cooking day, meal and appliance.';quickAdvanced=true;render();return;
    }
    await generate(next);return;
  }
  if(form.id==='leftover-form'){
    event.preventDefault();
    if(busy||!form.isConnected)return;
    if(state.result!==carryoverPlan){reviewLeftovers();notify('The plan changed. Check the updated amounts.');return;}
    const submit=form.querySelector('[type=submit]');submit.disabled=true;
    try{
      const data=new FormData(form);
      const amounts=new Map(carryoverFormRows.map(row=>[row.key,data.get('leftover-'+row.key)]));
      const pantry=confirmLeftovers(state.pantry,carryoverFormRows,amounts);
      await generate(state.profile,{pantry,plan:carryoverPlan});
    }catch(error){
      const tip=form.querySelector('#form-error');tip.hidden=false;tip.textContent=error.message;
    }finally{submit.disabled=false;}
    return;
  }
  if(form.id==='checkout-comparison'){
    event.preventDefault();
    const data=new FormData(form),amount=String(data.get('subtotal')??''),fees=String(data.get('fees')??'');
    const cents=v=>/^\d+(?:\.\d{1,2})?$/.test(v)?Math.round(Number(v)*100):NaN;
    const subtotal=cents(amount),fee=fees===''?0:cents(fees),estimate=Math.round((state.result?.total??0)*100);
    const result=form.querySelector('output');
    if(!Number.isSafeInteger(subtotal)||!Number.isSafeInteger(fee)||subtotal>5000000||fee>1000000){result.textContent='Enter valid AED amounts with up to two decimal places.';return;}
    const diff=subtotal-estimate;
    result.textContent='Your checkout total: AED '+priceMoney((subtotal+fee)/100)+'. Grocery subtotal: '+(diff===0?'matches the catalogue estimate':'AED '+priceMoney(Math.abs(diff)/100)+(diff>0?' above':' below')+' the catalogue estimate')+'. Entered by you, not verified by Mealday.';
    return;
  }
  if(form.id==='feedback-form'){
    event.preventDefault();
    await submitFeedback(form);
    return;
  }
  if(form.id==='reminder-form'){
    event.preventDefault();const data=new FormData(form),day=Number(data.get('day')),time=String(data.get('time'));
    try{const calendar=weeklyCalendar((day+1)%7,time);downloadFile('mealday-weekly-reminder.ics',calendar,'text/calendar;charset=utf-8');state.reminder={day,time};persist();dialog.close();render();notify('Calendar file downloaded. Open it in your calendar to enable reminders.');}catch(e){notify(e.message);}return;
  }
  if(form.id==='extra-grocery-form'){event.preventDefault();if(view!=='add-grocery'||!form.isConnected)return;const data=new FormData(form),name=String(data.get('item')||'').trim().slice(0,80),quantity=String(data.get('quantity')||'').trim().slice(0,80);if(!name)return;state.extraGroceries=[...(state.extraGroceries||[]),{id:crypto.randomUUID(),name,quantity,checked:false}];shoppingFilter='all';persist();setView('shopping');return;}
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
      profile.cuisines=[profile.cuisine];
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
  if(el.id==='store-price-location'){priceLocation=el.value;refreshStorePrices(true);return;}
  if(el.dataset.wizardField&&wizardDraft){const field=el.dataset.wizardField;wizardDraft[field]=field==='minutes'?Number(el.value):el.value;updateWizardContinue();return;}
  if(el.dataset.extra){const item=state.extraGroceries?.find(x=>x.id===el.dataset.extra);if(item){item.checked=el.checked;persist();screen.innerHTML=shopping();}return;}
  if(el.dataset.grocery){const id=el.dataset.grocery;state.checked=el.checked?[...new Set([...state.checked,id])]:state.checked.filter(key=>key!==id);persist();screen.innerHTML=shopping();Array.from(screen.querySelectorAll('[data-grocery]')).find(input=>input.dataset.grocery===id)?.focus({preventScroll:true});}
  if(el.id==='cuisine'||el.id==='diet'){library[el.id]=el.value;loadRecipes();}
});
document.addEventListener('input',event=>{
  if(event.target.form?.id==='checkout-comparison'){event.target.form.querySelector('output').textContent='';return;}
  if(event.target.form?.id==='extra-grocery-form'){event.target.form.querySelector('button[type=submit]').disabled=!event.target.form.elements.namedItem('item').value.trim();return;}
  if(event.target.id==='recipe-note'&&detail){updateJournal(detail.id,{note:event.target.value});return;}
  if(event.target.id==='wizard-name'&&wizardDraft){
    wizardDraft.name=event.target.value;
    updateWizardContinue();
    return;
  }
  if(event.target.id==='wizard-usual-spend'&&wizardDraft){
    wizardDraft.usualWeeklySpend=event.target.value;
    const result=$('#savings-comparison');
    if(result){onboardingMotion.cancel();result.innerHTML=savingsResult(wizardDraft);onboardingMotion.counts(result);}
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
const priorities=[['Quick','⚡','Speedy meals'],['Fresh','⚖️','Fresh and light'],['Family','👨‍👩‍👧‍👦','Family favs'],['Comfort','🥦','Healthy comfort'],['Everyday','🥡','Everyday favourites'],['None','✨','Surprise me'],['Protein','💪','Protein packed']];
const foodTypes=[['Any','🚫','None'],['Vegetarian','🥕'],['Vegan','🌱'],['Pescatarian','🐟'],['Eggless vegetarian','🥦'],['Non-vegetarian','🍗']];
const allergyOptions=[['None','🚫','None'],['Gluten','🌾','Gluten free'],['Milk','🥛','Dairy free'],['Egg','🥚','Egg free'],['Peanuts','🥜','Peanut free'],['Tree nuts','🌰','Tree nut free'],['Fish','🐟','Fish free'],['Shellfish','🦐','Shellfish free'],['Sesame','🌰','Sesame free'],['Soy','🫘','Soy free']];
const appliances=[['Microwave','microwave'],['Hob','hob'],['Air fryer','fryer'],['Oven','oven']];
const styles=[['UAE mix','','UAE favourites'],['Emirati'],['Arab','','Arab / Middle Eastern'],['South Asian','','South Asian / Desi'],['Turkish']];
let wizardDraft=null,step=0,editing=false,previewSlide=2;

const pendingSetupKey='mealday.pending-setup.v1';
let setupAccountMode='choice',setupAccountEmail='',setupAccountBusy=false;
function savePendingSetup(){
  try{localStorage.setItem(pendingSetupKey,JSON.stringify({profile:wizardDraft,at:Date.now()}));}
  catch{notify('Keep this tab open to retain your selected preferences.');}
}
function clearPendingSetup(){try{localStorage.removeItem(pendingSetupKey);}catch{}}
function pendingSetup(){
  try{
    const pending=JSON.parse(localStorage.getItem(pendingSetupKey)||'null'),p=pending?.profile;
    if(!p||!Number.isFinite(pending.at)||Date.now()-pending.at>86400000||pending.at>Date.now()+60000)return null;
    if(typeof p.name!=='string'||!Array.isArray(p.days)||!p.days.length||!Array.isArray(p.mealTypes)||!p.mealTypes.length||!Array.isArray(p.cuisines)||!p.cuisines.length||!Array.isArray(p.appliances)||!p.appliances.length)return null;
    return p;
  }catch{return null;}
}
async function finishOnboarding(){
  if(busy||!wizardDraft)return;
  const p=structuredClone(wizardDraft);error='';wizardStory=null;
  setView('setup',false);
  await generate({...p,minutes:Number(p.minutes),cuisine:p.cuisines[0]});
  if(error){clearPendingSetup();quickDraft={...p,cuisine:p.cuisines[0]};quickAdvanced=true;setView('quick-start',false);}
}
function onboardingAccount(){
  const c=cloudBackup.info(),p=wizardDraft||state.profile,formMode=setupAccountMode!=='choice',signup=setupAccountMode==='register';
  const disabled=setupAccountBusy||busy;
  const available=!['checking','unavailable'].includes(c.status);
  const title=c.account?'Your kitchen, connected.':'Your week starts here.';
  const copy=c.account?'Build your next plan with the preferences you just chose.':'Continue with Google to save your plan, favourite meals and cooking memories.';
  let actions='';
  if(c.account){actions='<p class="setup-account-identity">Signed in as '+esc(c.account.email)+'</p>'+button('Build my week','setup-account-continue','green wide','',''+(disabled?'disabled':''));}
  else actions='<div data-google-signin class="google-signin"></div><p class="setup-account-password-help">New to Mealday? Your first Google sign-in creates an account.</p>';

  return '<section class="setup-account '+(formMode?'setup-account-form-mode':'')+'"><header>'+button('←','setup-account-back','back-circle','','aria-label="Back to your preferences" '+(disabled?'disabled':''))+'<span>mealday<span>.</span></span></header><div class="setup-account-content"><div class="setup-account-avatar"><img src="/chef.png" alt="Mealday chef" width="104" height="132"><span aria-hidden="true">✦</span></div><p class="setup-account-eyebrow">YOUR KITCHEN, YOUR WAY</p><h1>'+title+'</h1><p class="setup-account-copy">'+copy+'</p><p class="setup-account-recap">'+esc(p.people)+' '+(p.people===1?'person':'people')+'<span>·</span>'+esc(p.days.length)+' cooking '+(p.days.length===1?'day':'days')+'<span>·</span>AED '+esc(money(p.budget))+'</p><div class="setup-account-actions">'+actions+'</div>'+
    (error?'<p class="setup-account-error" role="alert">'+esc(error)+'</p>':'')+
    '<p class="setup-account-legal">By creating an account, you agree to our '+button('Terms of service','terms','setup-account-text')+' and '+button('Privacy policy','privacy','setup-account-text')+'.</p>'+
    (!c.account?button('Continue without an account','setup-account-guest','setup-account-skip','',''+(disabled?'disabled':'')):'')+
    '</div><footer>'+icon('shield')+'<span>Your preferences stay with you.</span></footer></section>';
}

const ageGroups=[['under25','','24 and under'],['25-34','','25–34'],['35-44','','35–44'],['45-54','','45–54'],['55plus','','55+'],['private','','Prefer not to say']];
const savingsChoices=[['definitely','','Definitely'],['likely','','Most likely'],['somewhat','','Somewhat'],['no','','Not really']];
const discoveryChoices=[['instagram','social-instagram','Instagram'],['tiktok','social-tiktok','TikTok'],['youtube','social-youtube','YouTube'],['facebook','social-facebook','Facebook'],['word','💬','Word of mouth'],['google','social-play','Google Play'],['other','🌐','Somewhere else']];
const goals=[['prep','📅','Meal prep for the week'],['simple','✨','Find simple recipes'],['solo','🍽️','Feed myself'],['family','👨‍👩‍👧‍👦','Feed my family']];
const obstacles=[['time','⏱️','Not enough time'],['tired','😴','Too tired after work'],['difficult','🤔','Cooking feels difficult'],['ideas','💭','I need meal ideas']];
const cookingTimes=[[15,'','Up to 15 min'],[30,'','15–30 min'],[45,'','30–45 min'],[60,'','45–60 min'],[1440,'','60+ min']];

const steps=[
  {title:'How old are you?',hint:'We only use this information to personalise your experience.',type:'identity'},
  {title:'What are you trying to achieve?',field:'goal',choices:goals,required:true},
  {title:'What prevents you from doing that?',field:'obstacle',choices:obstacles,required:true},
  {title:'Do you feel like you could save more on your shopping?',field:'savingConfidence',choices:savingsChoices,required:true},
  {title:'How long do you usually spend cooking your meals?',hint:'We’ll match recipes to your routine.',field:'minutes',choices:cookingTimes,required:true},
  {title:'Where did you hear about us?',field:'heardAbout',choices:discoveryChoices,required:true},
  {title:'Choose your shop',hint:'We’ll plan your weekly shop around it. Prices are estimates.',field:'shop',choices:supermarkets.map(x=>[x,'',x]),required:true,layout:'shops'},
  {title:'How many are you cooking for?',hint:'We’ll scale your meals and budget.',type:'people'},
  {title:'Which days will you cook?',hint:'Pick the days you want meals planned for.',field:'days',choices:DAYS.map((day,index)=>[index,'',day]),multi:true,layout:'days'},
  {title:'Which meals should we plan?',hint:'Choose at least one meal.',field:'mealTypes',choices:[['breakfast','🌅','Breakfast'],['lunch','☀️','Lunch'],['dinner','🌙','Dinner']],multi:true},
  {title:'Where are you cooking?',hint:'Choose your city in the UAE.',field:'city',choices:places.map(city=>[city,'pin',city]),required:true},
  {title:'Which cuisines do you enjoy?',hint:'Choose your favourites, or explore a UAE mix.',field:'cuisines',choices:styles,multi:true,layout:'tiles'},
  {title:'What’s your weekly budget?',hint:'Slide to what you’re happy to spend on those days.',type:'budget'},
  {title:'A little planning can add up.',type:'budget-recap'},
  {title:'What are you in the mood for?',hint:'Pick up to 3.',field:'priorities',choices:priorities,multi:true,layout:'tiles'},
  {title:'Any dietary needs?',hint:'Choose the diet that fits your kitchen.',field:'diet',choices:foodTypes,required:true,layout:'tiles'},
  {title:'Any allergies?',hint:'Pick all that apply, or select None.',field:'allergies',choices:allergyOptions,multi:true,layout:'tiles'},
  {title:'What appliances do you have?',hint:'Select at least one to plan with.',field:'appliances',choices:appliances,multi:true,layout:'appliance-scene'},
];
let allergiesReviewed=false;
function onboardingIcon(symbol){
  const shapes={
    'social-instagram':'<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#d6457b" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#d6457b" stroke-width="2.2"/><circle cx="18" cy="6" r="1.2" fill="#d6457b"/>',
    'social-youtube':'<rect x="1" y="5" width="22" height="15" rx="5" fill="#f00035"/><path d="m10 9 6 3.5-6 3.5z" fill="white"/>',
    'social-facebook':'<circle cx="12" cy="12" r="11" fill="#0866ff"/><path d="M14 22v-9h3l.5-4H14V7c0-1.3.5-2 2-2h2V2.5c-1-.3-2-.4-3-.4-3 0-5 1.8-5 5V9H7v4h3v9" fill="white"/>',
    'social-tiktok':'<path d="M14 2h3c.4 3 2 4 5 4v3c-2 0-3.6-.6-5-1.6V16a6 6 0 1 1-6-6h1v3.2h-1a2.8 2.8 0 1 0 3 2.8Z" fill="#202020"/>',
    'social-play':'<path d="M4 2v20l11-10Z" fill="#35ae70"/><path d="m4 2 14 8-3 2Z" fill="#4da9ed"/><path d="m4 22 14-8-3-2Z" fill="#f1bd35"/><path d="m18 10 4 2-4 2-3-2Z" fill="#ed635c"/>'
  };
  return shapes[symbol]?'<svg viewBox="0 0 24 24" aria-hidden="true">'+shapes[symbol]+'</svg>':Object.hasOwn(ICONS,symbol)?icon(symbol):esc(symbol);
}
function shopArtwork(name){return '<span class="shop-wordmark shop-'+name.toLowerCase().replace(/[^a-z]/g,'')+'">'+(name==='Any supermarket'?'<span aria-hidden="true">🛒</span><small>Any supermarket</small>':esc(name))+'</span>';}
function wizardChoices(field,choices,multi=true){
  const selected=wizardDraft[field];
  return '<div class="quick-choices">'+choices.map(([value,symbol,label])=>{
    const active=value==='None'?allergiesReviewed&&selected.length===0:multi?selected.includes(value):String(selected)===String(value);
    return '<button type="button" class="button quick-choice '+(active?'selected':'')+'" data-action="'+(multi?'pick-many':'pick-one')+'" data-field="'+field+'" data-id="'+esc(value)+'" aria-pressed="'+active+'">'+(symbol?'<span class="quick-choice-icon" aria-hidden="true">'+onboardingIcon(symbol)+'</span>':'')+esc(label||value)+'</button>';
  }).join('')+'</div>';
}
function wizardSection(title,content){return '<fieldset class="quick-section"><legend>'+esc(title)+'</legend>'+content+'</fieldset>';}
const productPreviews=[
  {title:'Your week',description:'See the meals and groceries for your week',
    body:'<div class="mini-heading">My week</div><div class="mini-highlight">Grocery estimate<span>AED 150 budget</span></div><div class="mini-meal"><img src="/bowls.jpg" alt=""><span><b>Monday</b>Chicken rice bowl</span></div><div class="mini-meal"><img src="/hero.jpg" alt=""><span><b>Tuesday</b>Roasted garden bowl</span></div><div class="mini-meal"><img src="/table.jpg" alt=""><span><b>Wednesday</b>Lemon chickpea salad</span></div>'},
  {title:'Recipe details',description:'Open a recipe with ingredients and cooking steps',
    body:'<img class="mini-photo" src="/bowls.jpg" alt=""><div class="mini-heading">Chicken rice bowl</div><div class="mini-stats"><span><b>30 min</b>Cook time</span><span><b>2</b>Serves</span></div><div class="mini-heading">Ingredients</div><div class="mini-ingredient">🍗 Chicken</div><div class="mini-ingredient">🌾 Rice</div><div class="mini-ingredient">🍋 Lemon</div>'},
  {title:'Recipe library',description:'Explore recipes by cuisine',
    body:'<div class="mini-heading">Explore by cuisine</div><div class="mini-cuisines"><div><img src="/recipes/arab-mujadara.webp" alt="">Emirati<small>Rice · Grills · Seafood</small></div><div><img src="/recipes/arab-ful.webp" alt="">Middle Eastern<small>Mezze · Beans · Flatbreads</small></div><div><img src="/recipes/mealday-aloo-egg-curry-complete.webp" alt="">South Asian<small>Curry · Rice · Biryani</small></div><div><img src="/recipes/arab-shakshuka.webp" alt="">Mediterranean<small>Fresh · Colourful · Simple</small></div><div><img src="/recipes/draft-hummus-chicken-bowl-complete.webp" alt="">UAE favourites<small>Meals for your week</small></div></div><div class="mini-nav" aria-hidden="true"><span>▤</span><span>♥</span><span>☷</span><span>⚙</span></div>'},
];
function previewAutoplayIcon(){return '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">'+(previewAutoplayPaused?'<path d="M6 3l11 7-11 7z"/>':'<path d="M5 3h3v14H5zm7 0h3v14h-3z"/>')+'</svg>';}
function welcome(){
  const previews=productPreviews.map((item,index)=>{
    const position=index===previewSlide?'center':index===(previewSlide+2)%3?'left':'right';
    return '<button type="button" class="preview-phone '+position+'" data-action="preview-slide" data-id="'+index+'" tabindex="-1" aria-label="'+esc(item.description)+'"><span class="preview-device">'+item.body+'</span></button>';
  }).join('');
  const dots=productPreviews.map((item,index)=>'<button type="button" class="preview-dot" data-action="preview-slide" data-id="'+index+'" aria-label="'+esc(item.title)+'" aria-pressed="'+(index===previewSlide)+'"></button>').join('');
  return '<div class="phone-welcome">'+button('Back','welcome-back','welcome-back','back','aria-label="Back"')+'<div class="welcome-brand"><img src="/chef.png" alt="Mealday chef"><span>mealday<span>.</span></span></div><h1>Plan dinners around your budget, your tastes and what’s in your kitchen.</h1><div class="preview-carousel" aria-label="Mealday feature previews">'+previews+'</div><div class="preview-controls"><div class="preview-dots">'+dots+'</div>'+button(previewAutoplayIcon(),'preview-toggle','preview-autoplay','','aria-label="'+(previewAutoplayPaused?'Play slideshow':'Pause slideshow')+'" aria-pressed="'+previewAutoplayPaused+'"')+'</div><div class="wizard-footer">'+button('Get started','quick-start','green wide','right')+'<div class="welcome-account-links">'+button('Log in','account-login')+button('Sign up','account-signup')+button('Guided setup','start-setup')+'</div></div></div>';
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
  if(control){control.innerHTML=previewAutoplayIcon();control.setAttribute('aria-label',previewAutoplayPaused?'Play slideshow':'Pause slideshow');control.setAttribute('aria-pressed',String(previewAutoplayPaused));}
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
  clearPendingSetup();setupAccountMode='choice';error='';
  editing=edit;step=0;wizardStory=null;previousWizardStep=-1;error='';wizardDraft=JSON.parse(JSON.stringify(state.profile));
  if(!edit&&!state.result)wizardDraft.shop='Any supermarket';
  allergiesReviewed=false;
  wizardDraft.name??='';
  wizardDraft.cuisines??=[wizardDraft.cuisine];wizardDraft.priorities=(wizardDraft.priorities??['Everyday']).slice(0,3);
  setView('setup',false);
}
function backWizard(){
  if(busy)return;
  error='';
  if(wizardStory){wizardStory=null;renderWizard(false);return;}
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
  onboardingMotion.pulse($('#wizard-budget-value'));
  updateWizardContinue();
}
function renderGeneration(ready=false){
  const title=ready?'Your week is ready':(wizardDraft.name?wizardDraft.name+', we’re building your week…':'We’re building your week…');
  const tasks=ready?['Preferences applied','Meals scheduled','Grocery list ready']:['Matching recipes to your preferences','Lining up meals for the week','Putting together your grocery list'];
  return '<section class="wizard generation '+(ready?'generation-ready':'generation-working')+'" role="status"><h1>'+esc(title)+'</h1><div class="food-orbit" aria-hidden="true">'+
    '<div><img src="/chef.png" alt=""><b>mealday</b></div>'+
    ['🥒','🍋','🥑','🍅','🫑','🥬','🍆','🧄'].map((food,index)=>'<span class="food-track" style="--angle:'+index*45+'deg"><i>'+food+'</i></span>').join('')+
    '</div><ul class="generation-list">'+tasks.map((task,index)=>'<li style="--task-delay:'+index*160+'ms"><span aria-hidden="true">'+(ready?icon('check'):'')+'</span>'+task+'</li>').join('')+'</ul></section>';
}
function storyWall(){
  const rows=[
    [['📅','Your cooking days','A plan that follows the days you choose.'],['🍽️','Meals for your household','Portions shaped around your servings.'],['🥕','A place for your pantry','Keep track of ingredients you already have.']],
    [['🛒','One shopping list','Bring recipe ingredients together in one place.'],['💚','Save your favourites','Keep meals you want to cook again.'],['📝','Your own recipe notes','Remember the tweaks that worked for you.']],
    [['👨‍🍳','Cook step by step','Follow the recipe one step at a time.'],['⭐','Your tastes matter','Ratings help shape future suggestions.'],['🥗','Find your next meal','Search recipes and filter your favourites.']]
  ];
  return '<div class="ref-card-wall '+(storyCardsPaused?'ref-paused':'')+'">'+rows.map((cards,index)=>{
    const row=cards.map(([symbol,title,copy])=>'<article class="ref-feature-card"><span aria-hidden="true">'+symbol+'</span><b>'+title+'</b><p>'+copy+'</p></article>').join('');
    return '<div class="ref-wall-row row-'+index+'"><div class="ref-wall-track"><div class="ref-card-set">'+row+'</div><div class="ref-card-set" aria-hidden="true">'+row+'</div></div></div>';
  }).join('')+'</div>';
}
function renderStory(){
  onboardingMotion.cancel();
  const p=wizardDraft;
  let body='',title='';
  if(wizardStory==='chef'){
    title='Planning for meals is time-consuming…';
    body='<div class="ref-chef-stage"><img src="/chef.png" alt="Mealday chef"></div><p class="ref-story-copy">Tell us what you enjoy. We’ll help bring your meals and shopping list together.</p>';
  }else if(wizardStory==='time'){
    title='Plan your week in one place';
    body='<div class="ref-stopwatch" aria-hidden="true">'+icon('time')+'</div><p class="ref-time-copy">Choose your meals together, then cook at your own pace.</p><div class="ref-time-chart" aria-label="One weekly plan for '+p.days.length+' cooking days"><div><i class="ref-bar-plan"></i><b>1</b><span>weekly plan</span></div><div><i class="ref-bar-days" style="--day-height:'+Math.max(25,p.days.length/7*125)+'px"></i><b>'+p.days.length+'</b><span>cooking '+(p.days.length===1?'day':'days')+'</span></div></div><p class="ref-chart-caption">Less deciding. More time for your kitchen.</p>';
  }else{
    title='Made for your weekly kitchen';
    body='<p class="ref-wall-hint">Your meals, your preferences, your routine.</p>'+storyWall()+button(storyCardsPaused?'Play card animation':'Pause card animation','story-motion','ref-motion-control','','aria-pressed="'+storyCardsPaused+'"');
  }
  screen.innerHTML='<div class="wizard reference-story story-'+wizardStory+'"><div class="wizard-header">'+button('←','back-step','back-circle','','aria-label="Go back"')+'<span class="setup-step">'+(step+1)+' of '+steps.length+'</span><progress max="'+steps.length+'" value="'+(step+1)+'" aria-label="Setup progress"></progress></div><div class="wizard-body ref-story-body" data-step="story-'+wizardStory+'"><h1>'+title+'</h1>'+body+'</div><div class="wizard-footer">'+button(wizardStory==='benefits'?'Build my week':'Continue','story-next','green wide')+'</div></div>';
}
async function nextStory(){
  if(busy||!wizardStory)return;
  const last=wizardStory==='benefits';wizardStory=null;
  if(last){if(editing||cloudBackup.info().account)await finishOnboarding();else{savePendingSetup();setupAccountMode='choice';setView('account',false);}}
  else{step++;renderWizard(false);}
}
function savingsResult(p){
  const result=savingsComparison(p.usualWeeklySpend,p.budget);
  if(!result)return '<div class="ref-savings-empty"><p>Enter your usual spend above to compare it with your AED '+money(p.budget)+' budget.</p></div>';
  if(!result.weekly)return '<div class="savings-neutral"><b>No savings projected yet</b><p>'+(result.over?'Your budget is AED '+money(result.over)+' above your usual spend.':'Your budget matches your usual spend.')+' You can go back to adjust it.</p></div>';
  return '<div class="ref-savings-reveal"><p class="ref-save-lead">You could spend less by</p><strong class="ref-save-value" data-delay="850" data-count="'+result.weekly+'" aria-label="AED '+money(result.weekly)+'">AED '+money(result.weekly)+'</strong><p class="ref-save-period">on these meals each week</p><div class="ref-save-year"><b data-delay="1900" data-count="'+result.yearly+'" data-suffix=" / year" aria-label="AED '+money(result.yearly)+' per year">AED '+money(result.yearly)+' / year</b><p>if you meet this budget for 52 weeks</p></div></div>';
}
function renderWizard(preserveScroll=true){
  if(wizardStory){renderStory();return;}
  onboardingMotion.cancel();
  const entering=previousWizardStep!==step;
  const direction=step<previousWizardStep?'back':'forward';
  const progressFrom=Math.max(0,previousWizardStep+1)/steps.length;
  previousWizardStep=step;
  const scroll=preserveScroll?screen.querySelector('.wizard-body')?.scrollTop??0:0;
  const current=steps[step],p=wizardDraft;
  if(!p)return;
  let body='';
  if(current.type==='food'){
    body='<label class="field">Diet'+dropdown('wizard-diet',foodTypes.map(x=>x[0]),p.diet).replace('name="wizard-diet"','data-wizard-field="diet"')+'</label>'+wizardSection('Ingredients to avoid',wizardChoices('allergies',allergyOptions))+'<p class="allergy-note">Select None if no exclusions apply. Always check packaged food labels.</p>';
  }else if(current.type==='identity'){
    body='<label class="identity-name">Your first name<input id="wizard-name" class="control wizard-name" aria-label="Your name" autocomplete="given-name" maxlength="40" placeholder="Your first name" value="'+esc(p.name)+'"></label><div class="wizard-choices rows">'+ageGroups.map(([value,symbol,label])=>'<button type="button" class="wizard-choice '+(p.ageGroup===value?'selected':'')+'" data-action="pick-one" data-field="ageGroup" data-id="'+value+'" aria-pressed="'+(p.ageGroup===value)+'">'+label+'</button>').join('')+'</div>';
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
     '<label class="field">Or enter your budget<input id="wizard-budget-input" class="control" type="number" min="20" max="5000" step="0.01" value="'+esc(p.budget)+'"></label>';
  }else if(current.type==='budget-recap'){
    body='<div class="reference-savings"><div class="ref-surprise" aria-hidden="true">🤯</div><details class="ref-spend-editor" '+(savingsComparison(p.usualWeeklySpend,p.budget)?'':'open')+'><summary>Compare your weekly spend</summary><p>Your budget: <b>AED '+money(p.budget)+'</b> · '+p.days.length+' cooking days · '+p.people+' people</p><label for="wizard-usual-spend">Usual spend on these same meals (AED)</label><input id="wizard-usual-spend" class="control" type="number" inputmode="decimal" min="0.01" max="50000" step="0.01" placeholder="e.g. 600" value="'+esc(p.usualWeeklySpend??'')+'"></details><div id="savings-comparison" aria-live="polite" aria-atomic="true">'+savingsResult(p)+'</div><p class="ref-estimate-note">Potential savings from your spend versus your chosen budget. Catalogue prices are estimates; savings are not guaranteed.</p></div>';
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
      '<div class="wizard-choices '+layout+(current.multi?'':' single-choice')+'">'+(layout==='appliance-scene'?'<img src="/appliance-kitchen.jpg" alt="">':'')+current.choices.map(([value,symbol,label])=>{
        const active=value==='None'?(current.field!=='allergies'||allergiesReviewed)&&selected.length===0:current.multi?selected.includes(value):String(selected)===String(value);
        const disabled=current.field==='priorities'&&selected.length===3&&!active&&value!=='None';
        const artwork=onboardingIcon(symbol);
        return '<button type="button" class="wizard-choice '+(active?'selected':'')+'" data-action="'+(current.multi?'pick-many':'pick-one')+'" data-field="'+current.field+'" data-id="'+esc(value)+'" aria-pressed="'+active+'" '+(disabled?'disabled':'')+'>'+
          (symbol&&layout!=='appliance-scene'?'<span class="choice-icon" aria-hidden="true">'+artwork+'</span>':'')+
          '<span class="choice-label">'+(layout==='shops'?shopArtwork(value):esc(label||value))+'</span><span class="choice-mark" aria-hidden="true">'+(active?'✓':'○')+'</span></button>';
      }).join('')+'</div>'+(current.field==='allergies'?'<p class="allergy-note">Always check packaged food labels.</p>':'')+'</div>';
  }
  screen.innerHTML='<div class="wizard"><div class="wizard-header">'+button('←','back-step','back-circle','','aria-label="Go back" '+(busy?'disabled':''))+
   '<span class="setup-step">'+(step+1)+' of '+steps.length+'</span><span class="wizard-progress" style="--progress-from:'+(entering?progressFrom:(step+1)/steps.length)+';--progress-to:'+((step+1)/steps.length)+'"><progress max="'+steps.length+'" value="'+(step+1)+'" aria-label="Setup progress"></progress><span aria-hidden="true"></span></span></div>'+
   '<div class="wizard-body '+(entering?'motion-'+direction:'motion-selection')+'" data-step="'+(current.type||current.field)+'"><h1>'+esc(current.title)+'</h1>'+
   (current.hint?'<p class="wizard-hint">'+esc(current.hint)+'</p>':'')+body+'</div>'+
   '<div class="wizard-footer">'+(error?'<p class="notice" role="alert">'+esc(error)+'</p>':'')+
   button(step===steps.length-1?'Generate plan':'Continue','next-step','green wide'+(step===steps.length-1?' generate-button':''),'',canContinue()?'':'disabled')+'</div></div>';
  screen.querySelector('.wizard-body').scrollTop=scroll;
  onboardingMotion.counts(screen);
  if(!entering&&current.type==='people')onboardingMotion.pulse(screen.querySelector('.counter strong'));
}
function canContinue(){
  if(busy||!wizardDraft)return false;
  const current=steps[step],p=wizardDraft;
  if(current.type==='people')return Number.isInteger(p.people)&&p.people>=1&&p.people<=12;
  if(current.type==='food')return foodTypes.some(x=>x[0]===p.diet)&&allergiesReviewed;
  if(current.type==='review')return p.appliances.length>0;
  if(current.type==='identity')return Boolean(p.name.trim())&&ageGroups.some(([id])=>id===p.ageGroup);
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
  if(current.type==='name'||current.type==='identity')p.name=p.name.trim();
  if(!editing&&current.field==='goal'){
    p.people=p.goal==='solo'?1:p.goal==='family'?4:p.people;
    p.priorities=p.goal==='simple'?['Quick']:p.goal==='family'?['Family']:['Everyday'];
  }
  if(!editing&&current.field==='obstacle'&&['time','tired','difficult'].includes(p.obstacle)){
    p.priorities=[...new Set([...p.priorities,'Quick'])];
  }
  error='';
  if(current.field==='obstacle'){wizardStory='chef';renderStory();return;}
  if(current.field==='heardAbout'){wizardStory='time';renderStory();return;}
  if(step<steps.length-1){step++;renderWizard(false);return;}
  wizardStory='benefits';renderStory();
}
let quickDraft=null,quickAdvanced=false;
function shorterDayCount(p){
  const matches=Number(error.match(/^Only (\d+) different /)?.[1]);
  return matches>0&&matches<p.days.length?matches:p.days.length-1;
}
function quickStart(){
  const p=quickDraft||structuredClone(state.profile);
  const field=(title,name,values,selected)=>'<label class="field">'+title+dropdown(name,values,selected)+'</label>';
  const multi=(title,name,values,selected)=>'<fieldset class="quick-section"><legend>'+title+'</legend>'+chips(name,values,selected)+'</fieldset>';
  const cuisine='<label class="field">Cuisine<select name="cuisine" class="control">'+styles.map(([value,,label])=>'<option value="'+esc(value)+'" '+(value===p.cuisine?'selected':'')+'>'+esc(label||value)+'</option>').join('')+'</select></label>';
  const hint=error?'<div class="notice" role="alert"><strong>Let’s adjust your plan</strong><p>'+esc(error.replace(/ after recent-history exclusions/,'').replace(/,? or allow recently suggested meals in Plan settings/,''))+'</p><p>Your budget, diet and exclusions stay as entered. Edit the time or days below.</p></div>':'';
  return '<section class="quick-start-page"><header>'+button('Back','quick-cancel','ghost small','back',busy?'disabled':'')+'<p class="section-caption">MEALDAY · QUICK START</p><h1>Plan your first week</h1><p>See your meals and grocery estimate without signing up.</p></header>'+
    hint+'<form id="quick-start-form" class="plan-form"><fieldset class="surface-card quick-start-fields" '+(busy?'disabled':'')+'><legend>Your dinner plan</legend>'+
    '<label class="field">People<input class="control" name="people" type="number" min="1" max="12" step="1" required value="'+esc(p.people)+'"></label>'+cuisine+
    '<label class="field">Weekly budget (AED)<input class="control" name="budget" type="number" min="20" max="5000" step="0.01" required value="'+esc(p.budget)+'"></label>'+
    '<p class="quick-help">Default: 5 weekday dinners · 30 minutes · hob. Change any of these below.</p>'+
    '<details class="optional-preferences" '+(quickAdvanced||error?'open':'')+'><summary>Diet, allergies &amp; cooking preferences</summary><div class="optional-fields">'+
    '<div class="quick-start-grid">'+field('City','city',places,p.city)+field('Store (estimates only)','shop',supermarkets,p.shop)+field('Maximum cooking time','minutes',[15,20,30,45,60,90,120,240,1440],p.minutes)+field('Diet','diet',foodTypes.map(x=>x[0]),p.diet)+'</div>'+
    multi('Ingredients to avoid','allergies',allergyOptions.filter(x=>x[0]!=='None').map(x=>[x[0],x[0]]),p.allergies)+'<p class="quick-help">Always check ingredient labels.</p>'+
    multi('Appliances','appliances',appliances.map(x=>[x[0],x[0]]),p.appliances)+multi('Cooking days','days',DAYS.map((name,i)=>[i,name]),p.days)+
    multi('Meals to plan','mealTypes',[['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner']],p.mealTypes)+'</div></details>'+
    '<button type="submit" class="button green wide">'+(busy?'Building your plan…':'Build my week')+'</button>'+
    (error&&p.minutes<30?button('Try up to 30 minutes','quick-more-time','ghost wide'):'')+
    (error&&p.days.length>1?button('Try '+shorterDayCount(p)+(shorterDayCount(p)===1?' day':' days'),'quick-fewer','ghost wide'):'')+'</fieldset></form></section>';
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
    '<details class="surface-card plan-section optional-preferences"><summary>Personalise further</summary><div class="optional-fields"><label class="field">Your name (optional)<input class="control" name="name" autocomplete="given-name" maxlength="40" value="'+esc(p.name)+'"></label><label class="field">City'+dropdown('city',places,p.city)+'</label><label class="field">Supermarket'+dropdown('shop',supermarkets,p.shop)+'</label>'+group('Cuisines','cuisines',styles.map(x=>[x[0],x[2]||x[0]]),p.cuisines||[p.cuisine])+group('Meal styles · up to 3','priorities',priorities.filter(x=>x[0]!=='None').map(x=>[x[0],x[2]]),p.priorities)+'<details class="meal-style-rules"><summary>How meal styles match</summary><p>Recipes match any chosen style, plus every other filter. Speedy: 30 min or less. Everyday: 60 min or less, up to 15 ingredients. Family: a rice, pasta, potato, bread or wrap dish in 45 min or less. Comfort: a warm staple or pulse dish. Fresh: at least 150 g vegetables and up to 600 estimated kcal per serving. Protein: at least 25 g estimated protein per serving. Fresh and Protein require complete nutrition data.</p></details>'+'</div></details>'+
    '<div class="setting-list">'+settingRow('Kitchen pantry','go-pantry','Manage ingredients you already have')+'</div><button class="button green wide" '+(busy?'disabled':'')+'>'+icon('refresh')+(busy?'Building your plan…':'Apply & rebuild plan')+'</button></form>';
}
function settingRow(label,action,note=''){
  const symbols={'edit-name':'people','edit-setup':'leaf','open-recipes':'recipes','go-history':'week','go-pantry':'pantry','go-home':'hob','review-setup':'check','language':'globe','weekly-reminder':'bell','cloud-account':'cloud','export-backup':'download','share-plan':'share','privacy':'shield','clear-saved':'heart','settings-reset':'refresh'};
  const disabled=(action==='share-plan'&&!state.result)||(action==='delete-account'&&deletingAccount);
  return '<button type="button" class="setting-row '+(['clear-saved','settings-reset'].includes(action)?'setting-destructive':'')+'" data-action="'+action+'" '+(disabled?'disabled':'')+'><span class="setting-symbol" aria-hidden="true">'+icon(symbols[action]||'gear')+'</span><span class="setting-label"><strong>'+esc(label)+'</strong>'+(note?'<small>'+esc(note)+'</small>':'')+'</span><span class="setting-chevron" aria-hidden="true">›</span></button>';
}

function cookingDate(value){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Date not recorded';}
function cookingHistoryPage(){
  const entries=historyEntries(cookingHistory),recipes=new Set(entries.map(e=>e.recipeId));
  return '<div class="subpage-back">'+button('Back to settings','go-settings','ghost','back')+'</div><header class="utility-heading"><h1>Cooking history</h1><p>Saved independently of your meal plan.</p></header>'+
    '<div class="surface-card cooking-history-summary"><strong>'+entries.length+(entries.length===1?' cook':' cooks')+'</strong><p>'+recipes.size+(recipes.size===1?' recipe':' recipes')+' · Rebuilding your plan keeps this history.</p></div>'+
    (entries.length?'<ul class="cooking-history-list">'+entries.map(e=>'<li class="surface-card"><span class="history-check" aria-hidden="true">'+icon('check')+'</span><div><h2>'+esc(e.name||'Previously cooked recipe')+'</h2><p>'+esc(cookingDate(e.cookedAt))+(e.cookedAt?'':' · imported from your earlier saved marks')+'</p>'+button('View recipe','recipe','ghost small','right','data-id="'+esc(e.recipeId)+'"')+'</div></li>').join('')+'</ul>':'<div class="surface-card empty">No cooked meals yet. Mark a recipe as cooked to start your history.'+button('Browse recipes','open-recipes','ghost small','right')+'</div>');
}
function settings(){
 const section=(title,content)=>'<section class="settings-section"><h2>'+title+'</h2><div class="setting-list">'+content+'</div></section>';
 const reminder=state.reminder;
 return '<div class="phone-settings simple-settings"><header class="settings-heading"><p>Your account</p><h1>settings</h1></header>'+
 section('App',settingRow('Rate Mealday','rate-app')+settingRow('Request a feature','request-feature')+settingRow('Language','language','English')+settingRow('Reset saved meals','clear-saved','Clear your favourites list')+settingRow('Reset suggested meal history','reset-suggestions','Get fresher regenerate suggestions'))+
 section('Notifications','<button class="setting-row reminder-row" type="button" data-action="weekly-reminder"><span class="setting-label"><strong>Weekly plan reminder</strong><small>'+(reminder?DAYS[reminder.day]+' at '+reminder.time:'Sunday at 10:00')+' — download a calendar reminder</small></span><span class="reminder-toggle" aria-hidden="true"><span></span></span></button>')+
 section('Support',settingRow('Share Mealday','share-app')+settingRow('Contact us','contact','Send a private message'))+
 section('Legal',settingRow('Privacy policy','privacy')+settingRow('Terms of service','terms'))+
 section('Account',settingRow(deletingAccount?'Deleting account…':'Delete my account','delete-account'))+
 '<details class="settings-extra"><summary>Kitchen &amp; backup</summary><div class="setting-list">'+settingRow('Edit your name','edit-name')+settingRow('Profile & food preferences','edit-setup')+settingRow('Cooking history','go-history')+settingRow('Review setup · '+steps.length+' steps','review-setup')+settingRow('Welcome screen','go-home')+settingRow('Backup & login','cloud-account')+settingRow('Download kitchen backup','export-backup')+settingRow('Share meal plan','share-plan')+settingRow('Reset this kitchen','settings-reset')+'</div></details></div>';
}
function readFeedbackDraft(){
  try{return localStorage.getItem(feedbackDraftKey)||'';}catch{return '';}
}
function openFeedback(kind){
  const raw=readFeedbackDraft();
  let draft={};
  try{const saved=JSON.parse(raw);if(saved?.kind===kind)draft=saved;}catch{}
  const isRating=kind==='rating',isSupport=kind==='support';
  const title=isRating?'Rate Mealday':isSupport?'Contact us':'Request a feature';
  const question=isRating?'Your feedback (optional)':isSupport?'How can we help?':'What would you like Mealday to do?';
  openDialog(title,'Your submission goes privately to the Mealday team.',
    '<form id="feedback-form"><input type="hidden" name="kind" value="'+kind+'">'+
    (isRating?'<label class="field">Your rating<select class="control" name="rating" required><option value="">Choose a rating</option>'+[5,4,3,2,1].map(n=>'<option value="'+n+'" '+(draft.rating===n?'selected':'')+'>'+n+' out of 5</option>').join('')+'</select></label>':'')+
    '<label class="field">'+question+'<textarea class="control" name="message" maxlength="2000" rows="5" '+(isRating?'':'required')+'>'+esc(draft.message||'')+'</textarea></label>'+
    (isSupport?'<label class="field">Reply email (optional)<input class="control" name="replyEmail" type="email" autocomplete="email" maxlength="254"></label><p class="quick-help">Add your email if you’d like a reply. Keep passwords and payment details out of your message.</p>':'')+
    '<p class="notice" role="alert" hidden></p><button class="button green wide" type="submit">'+(isSupport?'Send message':'Send feedback')+'</button></form>');
  if(draft.kind)feedbackAttempts.set($('#feedback-form',dialog),{draft:raw});
}
async function submitFeedback(form){
  const submit=form.querySelector('button[type="submit"]');
  if(submit.disabled)return;
  const error=form.querySelector('[role="alert"]'),data=new FormData(form);
  const kind=data.get('kind'),message=String(data.get('message')||'').trim();
  error.hidden=true;
  if(kind!=='rating'&&!message){error.textContent='Enter a message before sending.';error.hidden=false;return;}
  const payload={kind,message,rating:kind==='rating'?Number(data.get('rating')):null,replyEmail:String(data.get('replyEmail')||'').trim()};
  const fingerprint=JSON.stringify(payload),previous=feedbackAttempts.get(form);
  const label=submit.textContent,fields=form.querySelectorAll('textarea, input, select');
  submit.disabled=true;submit.textContent='Sending…';
  fields.forEach(field=>{field.disabled=true;});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  let failure='Delivery could not be confirmed. Please try again.';
  try{
    const submissionId=previous?.fingerprint===fingerprint?previous.id:crypto.randomUUID();
    feedbackAttempts.set(form,{fingerprint,id:submissionId,draft:previous?.draft});
    const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...payload,submissionId}),credentials:'omit',signal:controller.signal});
    if(response.status===409)feedbackAttempts.set(form,{draft:previous?.draft});
    if(!response.ok){
      failure=response.status===429?'Too many submissions. Please try again later.':'Your message could not be sent. Please try again.';
      throw Error(failure);
    }
    const result=await response.json();
    if(response.status!==201||result?.reference!==submissionId)throw Error(failure);
    if(previous?.draft&&readFeedbackDraft()===previous.draft){try{localStorage.removeItem(feedbackDraftKey);}catch{}}
    const title=kind==='support'?'Message sent':'Feedback sent';
    if(dialog.open&&form.isConnected){
      openDialog(title,'Thanks for helping us improve Mealday.','<p>Reference: <strong>'+esc(result.reference)+'</strong></p>'+button('Done','close','green wide'));
    }else notify(title+'. Reference: '+result.reference);
  }catch{
    if(dialog.open&&form.isConnected){error.textContent=failure;error.hidden=false;}else notify(failure);
  }finally{
    clearTimeout(timer);
    fields.forEach(field=>{field.disabled=false;});
    submit.disabled=false;submit.textContent=label;
  }
}

function downloadFile(name,content,type){
 const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function downloadKitchen(){downloadFile('mealday-kitchen-backup.json',kitchenBackup(state,cookingHistory),'application/json');notify('Kitchen backup downloaded. Keep the file somewhere safe.');}
function openReminder(){
 const reminder=state.reminder||{day:6,time:'10:00'};
 openDialog('Weekly plan reminder','Choose a time in your local calendar.',
 '<form id="reminder-form"><label class="field">Day<select class="control" name="day">'+DAYS.map((name,i)=>'<option value="'+i+'" '+(i===reminder.day?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label class="field">Time<input class="control" name="time" type="time" value="'+esc(reminder.time)+'" required></label><p class="quick-help">Download and open the calendar file, then save the repeating event in your calendar. Calendar notifications follow your calendar app’s settings.</p><button class="button green wide" type="submit">Download calendar reminder</button></form>'+(window.MealdayAndroid?.weeklyReminder?button('Use Android calendar','open-reminder-calendar','ghost wide'):''));
}

function sharePlan(){
  const text=state.result?.meals.map(x=>DAYS[x.day]+' · '+cap(x.meal)+': '+recipeLabel(x.id,x.name)).join('\n');
  if(!text){notify('Build a meal plan before sharing.');return;}
  if(window.MealdayAndroid){window.MealdayAndroid.share('My Mealday plan\n\n'+text);return;}
  openDialog('Share your plan','Select the text to copy it.','<textarea class="control" rows="12" cols="40" readonly>'+esc(text)+'</textarea>');
}
function showPrivacy(){
  openDialog('Privacy policy','Mealday Android','<div class="privacy-copy"><p>Mealday stores your cooking preferences, plans, pantry, shopping checkmarks, saved recipes, cooking history, recipe ratings and notes on this device. Cooking history is stored separately from the current plan. The planner runs on this device. Google verifies sign-ins; Mealday session cookies are HttpOnly. When you sign in to a connected backup server, your kitchen data is sent to that server and stored in its MongoDB database. Guest data is imported only when you choose Import guest kitchen. Signing out restores the guest kitchen; pending account changes are retained locally for later sign-in.</p><p>App ratings, feature requests and support messages are stored in a private database for the Mealday team. If you provide a reply email in Contact us, the team can use it to respond. Submissions are independent of your Mealday account.</p><p>Plan sharing uses Android sharing or a copyable text view. Calendar reminders are downloaded as a file for you to open and save in your calendar. A downloaded backup contains your kitchen data; keep it private. External recipe source links open in your browser.</p><p>Use Reset this kitchen in Settings to clear data stored by Mealday.</p></div>');
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
  if(dialog.open){if(!deletingAccount)dialog.close();return true;}
  if(view==='add-grocery'){setView('shopping',false);return true;}
  if(view==='account'){if(setupAccountBusy)return true;wizardStory='benefits';setupAccountMode='choice';setView('setup',false);return true;}
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
  const c=cloudBackup.info();if(!c.account){
    if(['unavailable','checking'].includes(c.status)){openDialog('Backup & login','Your kitchen is saved on this device.','<p class="quick-help">'+esc(c.message)+'</p><p>Download a copy of your preferences, saved meals, notes, ratings and cooking history. Online login and sync will become available when this deployment connects to a Mealday server.</p><div class="dialog-settings-actions">'+button('Download kitchen backup','export-backup','green wide')+button('Check cloud connection','cloud-connect','ghost wide')+button('Done','close','ghost wide')+'</div>');return;}
    location.href='/login.html';return;
  }let content='<p class="notice">'+esc(c.message)+'</p>';
  if(c.account){
    if(c.conflict)content+='<p>Keep this device’s full kitchen, or load the cloud version. This choice applies to the full backup.</p>'+button('Keep this device','cloud-local','primary')+button('Load cloud version','cloud-remote','ghost');
    else content+=button('Sync now','cloud-retry','primary')+(c.hasGuest?button('Import guest kitchen','cloud-import','ghost'):'');
    content+=button('Sign out','cloud-logout','ghost');
  }
  openDialog('Cloud backup & login','Your kitchen across devices',content);
}

dialog.addEventListener('cancel',event=>{if(deletingAccount)event.preventDefault();});
cloudBackup.init().then(()=>{
  const pending=pendingSetup();
  if(pending&&view==='welcome'){wizardDraft=pending;step=steps.length-1;editing=false;setView('account',false);}
});
window.addEventListener("online",()=>cloudBackup.refresh());
window.addEventListener("focus",()=>{if(!dialog.open&&!['recipe','setup'].includes(view))cloudBackup.refresh();});
setInterval(()=>{if(!document.hidden&&!dialog.open&&!detail&&view!=="setup")cloudBackup.refresh();},30000);

// A missing or failed photo must not leave a broken image in a meal card.
document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.classList.contains('ingredient-image')){if(img.getAttribute('src')!=='/ingredients/basket.png')img.src='/ingredients/basket.png';else img.hidden=true;return;}if(img instanceof HTMLImageElement&&img.getAttribute('src')!=='/recipe-image-unavailable.svg'){img.src='/recipe-image-unavailable.svg';img.alt='Recipe photo unavailable';}},true);

window.addEventListener('focus',()=>{if(view==='recipes'&&!library.loading)loadRecipes();if(view==='shopping')refreshStorePrices(true);});
