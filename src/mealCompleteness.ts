import type {Ingredient,Recipe} from './engine';
import {mealRoles} from './completeMeals';
import {recipeTotalMinutes} from './recipeTiming';
export function completeMealRoles(r:Recipe,stock:Record<string,Ingredient>){
 const roles=mealRoles(r,stock);
 const starch=r.items.some(([id,n])=>{const i=stock[id];return i&&/rice|bread|pita|regag|rigag|khameer|wheat|bulgur|couscous|freekeh|roti|chapati|pasta|wrap|vermicelli|oat|poha|semolina|millet|sorghum|ragi|quinoa|barley|noodle|cornmeal/i.test(i.name)&&n>=(/slice|wrap|piece|regag|pita/i.test(i.unit)?1:25);});
 return {...roles,starch,vegetables:r.items.reduce((n,[id,amount])=>n+(stock[id]?.category==='Vegetables'&&stock[id]?.unit==='g'?amount:0),0)>=80};
}
// Deterministic, cuisine-aware serving suggestions. Never write over source documents.
export function prepareCompleteMeals(rows:Recipe[],stock:Record<string,Ingredient>):Recipe[]{return rows.map(original=>{
 if(!original.mealTypes?.some(m=>m==='lunch'||m==='dinner'))return original;
 const checked=completeMealRoles(original,stock);
 if(original.mealAssemblyVersion===2&&checked.starch&&checked.protein&&checked.vegetables){const parts=original.componentNames||[original.name];return {...original,mealComplete:true,componentNames:original.name===parts.join(' + ')||original.name===parts[0]?parts:[original.name,...parts.slice(1)]};}
 let r={...original,items:original.items.map(pair=>[...pair] as [string,number]),steps:[...original.steps]},time=recipeTotalMinutes(original);
 let names=[...(original.componentNames||[original.name])],added=0;
 const ready=(id:string,unit:string,pattern:RegExp)=>stock[id]?.unit===unit&&stock[id]?.kind==='plant'&&pattern.test(stock[id].name);
 const canRoti=ready('quality-roti','pieces',/roti/i),canRice=ready('rice','g',/rice/i),canChickpeas=ready('chickpeas','g',/chickpea/i);
 // Upgrade only the exact, identifiable Mealday v1 side instructions and quantities.
 const owned=original.mealAssemblyVersion===1&&original.authorship?.startsWith('Mealday meal combination;')&&names.join(' + ')===original.name;
 if(owned&&r.cuisine==='South Asian'&&names.includes('Rice')&&canRoti&&!/rice|biryani|pulao|khichdi|poha/i.test(names[0])){
  const at=r.items.map(([id,n])=>id==='rice'&&n===60).lastIndexOf(true),step=r.steps.findIndex(s=>s.startsWith('Rinse the measured dry rice and cook it'));
  if(at>=0&&step>=0){r.items[at]=['quality-roti',2];r.steps[step]='Warm two ready-to-eat roti per person in a dry pan according to the packet; serve alongside the main dish.';names=names.map(n=>n==='Rice'?'Roti':n);time-=15;}
 }
 if(owned&&r.cuisine!=='South Asian'&&names.includes('Red Lentil Dal')&&canChickpeas){
  const at=r.items.findIndex((pair,i)=>JSON.stringify(r.items.slice(i,i+4))===JSON.stringify([['lentils',60],['cumin',1],['oil',5],['tomato',60]])),step=r.steps.findIndex(s=>s.startsWith('For the dal, rinse the red lentils.'));
  if(at>=0&&step>=0){r.items[at]=['chickpeas',120];const label=r.cuisine==='Emirati'?'Dango-inspired chickpeas':'Cumin chickpeas';names=names.map(n=>n==='Red Lentil Dal'?label:n);r.steps[step]='For the chickpea side, use 120 g drained canned chickpeas per person. Warm the measured oil, cumin and diced tomato, add chickpeas and a splash of water, and simmer until hot throughout; allow 10 minutes. This is a quick serving suggestion.';time-=20;}
 }
 if(r.cuisine==='South Asian'&&canRoti&&r.items.some(([id])=>id==='pita')&&/arabic bread|pita/i.test(r.name)){
  r.items=r.items.map(([id,n])=>id==='pita'?['quality-roti',2]:[id,n]);
  r.name=r.name.replace(/Arabic bread|pita bread|pita/gi,'Roti');names=names.map(n=>n.replace(/Arabic bread|pita bread|pita/gi,'Roti'));
  r.steps=r.steps.map(step=>step.replace(/Arabic bread|pita bread|pita/gi,'ready-to-eat roti'));
  r.steps.push('Use two ready-to-eat roti per person and warm in a dry pan according to the packet. This Mealday serving adaptation uses roti in place of the original bread.');added+=5;
 }
 if(r.cuisine==='Emirati'&&ready('regag','pieces',/regag/i)&&r.items.some(([id])=>id==='pita')){
  r.items=r.items.map(([id,n])=>id==='pita'?['regag',n]:[id,n]);
  r.name=r.name.replace(/Arabic bread|pita bread|pita/gi,'Regag bread');names=names.map(n=>n.replace(/Arabic bread|pita bread|pita/gi,'Regag bread'));
  r.steps=r.steps.map(step=>step.replace(/Arabic bread|pita bread|pita/gi,'ready-made regag bread'));
  r.steps.push('Warm the measured ready-made regag bread according to the packet and serve alongside the main dish. This Mealday pairing uses regag in place of pita.');added+=5;
 }
 const roles=completeMealRoles(r,stock);
 const append=(name:string,items:[string,number][],step:string,minutes:number)=>{if(items.some(([id])=>!stock[id]))return false;r.items.push(...items);r.steps.push(step);names.push(name);added+=minutes;return true;};
 if(!roles.protein){
  if(r.cuisine==='South Asian'&&ready('lentils','g',/lentil/i))append('Red lentil dal',[['lentils',60],['cumin',1],['oil',5],['tomato',60]],'For the dal, rinse 60 g dry red lentils per person. Warm the measured oil, cumin and chopped tomato; add lentils and water according to the packet. Simmer until fully tender, adding water as needed. Allow 30 minutes and serve alongside the main.',30);
  else if(canChickpeas)append(r.cuisine==='Emirati'?'Dango-inspired chickpeas':'Cumin chickpeas',[['chickpeas',120],['cumin',1],['oil',5]],'For the chickpea side, use 120 g drained canned chickpeas per person. Warm the measured oil and cumin, add chickpeas and a splash of water, and heat thoroughly. Allow 10 minutes. This is a quick meal pairing, not a kitchen-tested traditional recipe.',10);
 }
 if(!roles.starch){
  if(r.cuisine==='South Asian'&&canRoti)append('Roti',[['quality-roti',2]],'Warm two ready-to-eat roti per person in a dry pan according to the packet. Serve with the main dish and sides.',5);
  else if(r.cuisine==='Arab'&&ready('pita','pieces',/pita/i))append('Arabic pita',[['pita',1]],'Warm one ready-made Arabic pita per person in a dry pan according to the packet. Serve alongside the main dish.',5);
  else if(r.cuisine==='Emirati'&&/thareed/i.test(r.name)&&ready('regag','pieces',/regag/i))append('Regag bread',[['regag',1]],'Warm one ready-made regag bread per person according to the packet. Serve with the stew, or break it into the stew just before eating.',5);
  else if(canRice)append('Rice',[['rice',60]],'Rinse 60 g dry rice per person. Cook with water according to the packet, allowing about 20 minutes; serve alongside the main dish.',20);
 }
 if(!completeMealRoles(r,stock).vegetables&&ready('cucumber','g',/cucumber/i))append('Cucumber side',[['cucumber',80]],'Wash and slice 80 g cucumber per person. Serve as a fresh side with the other meal components.',5);
 const complete=completeMealRoles(r,stock),ok=complete.starch&&complete.protein&&complete.vegetables;
 const total=time+added;
 if(!Number.isFinite(total)||total<=0||total>1440||!ok)return {...original,mealComplete:false};
 if(added||time!==recipeTotalMinutes(original))r.appliances=[...new Set([...r.appliances,'Hob'])];
 // Make existing staple/vegetable components visible without adding more food.
 const allNames=names.join(' ');
 if(r.items.some(([id,n])=>id==='quality-roti'&&n>=1)&&!/roti|chapati/i.test(allNames))names.push('Roti');
 if(r.items.some(([id,n])=>id==='rice'&&n>=25)&&!/rice|biryani|machboos|mujadara|pulao|khichdi|aseeda|harees/i.test(allNames))names.push('Rice');
 if(r.items.some(([id,n])=>id==='pita'&&n>=1)&&!/pita|bread/i.test(allNames))names.push('Arabic pita');
 if(r.items.some(([id,n])=>id==='regag'&&n>=1)&&!/regag|bread|thareed/i.test(allNames))names.push('Regag bread');
 if(r.items.some(([id,n])=>id==='cucumber'&&n>=80)&&!/cucumber|salad/i.test(allNames))names.push('Cucumber side');
 const changed=names.length>1&&JSON.stringify(names)!==JSON.stringify(original.componentNames);
 return {...r,name:changed&&names.join(' + ').length<=500?names.join(' + '):r.name,time:total,timing:{prepMinutes:0,cookMinutes:total,waitMinutes:0,estimated:true},mealAssemblyVersion:2,mealComplete:true,componentNames:names,
  ...(added?{authorship:(r.authorship||'Mealday')+'; Mealday complete meal pairing; quantities per person, total elapsed time estimated; kitchen testing pending'}:{})};
});}
