import {
  assertPlanPreferences, assertWithinBudget, basket, canonicalIngredients,
  dishKey, generateDayPlan, initialProfile, recipes, stock, total,
  type Profile, type Recipe, type Slot,
} from '../domain/src/engine';
import {mealSwapChoices} from '../domain/src/mealSwapChoices';
import {recipeTotalMinutes} from '../domain/src/recipeTiming';

const diets = ['Any','Vegetarian','Eggless vegetarian','Vegan','Pescatarian','Non-vegetarian'];
const cuisines = ['UAE mix','Emirati','Arab','South Asian','Turkish'];
const meals = ['breakfast','lunch','dinner'];
const appliances = ['Hob','Oven','Microwave','Air fryer'];
const allergies = ['Gluten','Milk','Egg','Peanuts','Tree nuts','Fish','Shellfish','Sesame','Soy'];
const cities = ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];
const shops = ['LuLu','Carrefour','Spinneys','Waitrose','Union Coop','Nesto','Choithrams','Any supermarket'];
const catalog = new Map(recipes.filter(r => r.reviewStatus !== 'draft' && r.mealTypes?.length && Number.isFinite(recipeTotalMinutes(r))).map(r => [r.id,r]));
const pantryCatalog = canonicalIngredients();

class InputError extends Error {}
const valid = (value: boolean, message: string) => { if (!value) throw new InputError(message); };
const record = (x: any) => x !== null && typeof x === 'object' && !Array.isArray(x);
const inRange = (x: number, min: number, max: number) => Number.isFinite(x) && x >= min && x <= max;
function selected(x: any, options: string[], label: string, required = true): string[] {
  if (!Array.isArray(x) || x.length > options.length || (required && !x.length) ||
      x.some(value => !options.includes(value)) || new Set(x).size !== x.length) throw new InputError('Choose valid '+label+'.');
  return x;
}
function profile(x: any): Profile {
  valid(record(x), 'Choose your kitchen preferences.');
  valid(Number.isInteger(x.people) && inRange(x.people,1,12), 'Household size must be 1–12.');
  valid(inRange(x.budget,20,5000), 'Enter an estimated grocery budget from AED 20 to 5,000.');
  valid([15,20,30,45,60,90,120,240,1440].includes(x.minutes), 'Choose your cooking time.');
  valid(diets.includes(x.diet) && cuisines.includes(x.cuisine), 'Choose a supported diet and cuisine.');
  valid(cities.includes(x.city) && shops.includes(x.shop), 'Choose a supported city and supermarket.');
  valid(Array.isArray(x.days) && x.days.length >= 1 && x.days.length <= 7 &&
    x.days.every((n: number) => Number.isInteger(n) && inRange(n,0,6)) &&
    new Set(x.days).size === x.days.length,'Select at least one planning day.');
  return {
    ...initialProfile, people:x.people,budget:x.budget,minutes:x.minutes,diet:x.diet,cuisine:x.cuisine,
    city:x.city,shop:x.shop,days:[...x.days].sort(),mealTypes:selected(x.mealTypes,meals,'meal types'),
    appliances:selected(x.appliances,appliances,'appliances',false),allergies:selected(x.allergies,allergies,'ingredient exclusions',false),
    cuisines: x.cuisines ? selected(x.cuisines,cuisines,'cuisines') : [x.cuisine],
    preferredStyles: x.priorities ? selected(x.priorities,['Everyday','Quick','Family','Comfort','Fresh','Protein'],'priorities',false) : [],
    allowRepeats:true,
  };
}
function pantry(x: any) {
  if (x === undefined) return {};
  valid(record(x) && Object.keys(x).length <= 100, 'Choose up to 100 pantry ingredients.');
  for (const [id,value] of Object.entries(x)) valid(Object.hasOwn(pantryCatalog,id) && typeof value === 'number' && inRange(value,0,100000), 'Invalid pantry ingredient or amount.');
  return Object.fromEntries(Object.entries(x)) as Record<string,number>;
}
function slots(x: any,p: Profile): Slot[] {
  valid(Array.isArray(x) && x.length === p.days.length * p.mealTypes!.length && x.length <= 21, 'Build a plan for these preferences first.');
  const keys = new Set<string>(), families = new Set<string>();
  return x.map((s: any) => {
    valid(record(s) && p.days.includes(s.day) && p.mealTypes!.includes(s.meal) && catalog.has(s.recipeId),
      'A meal is missing or no longer available.');
    const key = s.day+':'+s.meal, family = dishKey(catalog.get(s.recipeId)!);
    valid(!keys.has(key) && !families.has(family),'Every slot and dish must be distinct.');
    keys.add(key); families.add(family);
    return {day:s.day,meal:s.meal,recipeId:s.recipeId,mode:"cook"};
  });
}
function summary(r: Recipe) {
  return {id:r.id,name:r.name,minutes:recipeTotalMinutes(r),cuisine:r.cuisine||'UAE mix',diet:r.diet,meals:r.mealTypes};
}
function ingredientCost(r: Recipe) {
  const cost=r.items.reduce((sum,[id,amount])=>{
    const item=stock[id];
    return item?.pack>0?sum+amount/item.pack*item.price:sum;
  },0);
  return Math.round(cost*100)/100;
}
function source(url?:string) {
  try { const parsed = new URL(url||''); return parsed.protocol==='https:' && !parsed.username && !parsed.password ? parsed.href : undefined; }
  catch { return undefined; }
}
function planResult(plan:Slot[],p:Profile,kitchen:Record<string,number>) {
  assertPlanPreferences(plan,p);
  return {plan,meals:plan.map(s=>{
    const recipe=catalog.get(s.recipeId)!;
    return {...summary(recipe),ingredientCost:ingredientCost(recipe),day:s.day,meal:s.meal};
  }),
    items:basket(plan,p,kitchen), total:total(plan,p,kitchen), currency:'AED'};
}
export const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readBody(request:Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new InputError('Send a JSON request.');
  const reader=request.body?.getReader();
  if (!reader) throw new InputError('No request body.');
  let size=0, raw='';
  const decoder=new TextDecoder();
  for (;;) {
    const {value,done}=await reader.read();
    if (done) break;
    size+=value.byteLength;
    if(size>32000){await reader.cancel();throw new InputError('This request is too large.');}
    raw+=decoder.decode(value,{stream:true});
  }
  try {
    const x=JSON.parse(raw+decoder.decode());
    if(!record(x)) throw Error();
    return x;
  } catch { throw new InputError('Invalid request data.'); }
}
export async function api(request:Request,url:URL) {
  const path=url.pathname,method=request.method;
  try {
    if (path==='/api/health' && method==='GET') return json({ok:true,recipes:catalog.size,currency:'AED'});
    if (path==='/api/options' && method==='GET') return json({diets,cuisines,meals,appliances,allergies,cities,shops,
      pantry:Object.entries(pantryCatalog).filter(([id])=>id!=='water').map(([id,i])=>({id,name:i.name,unit:i.unit})).sort((a,b)=>a.name.localeCompare(b.name))});
    if (path==='/api/recipes' && method==='GET') {
      const q=(url.searchParams.get('q')||'').trim().slice(0,100).toLowerCase();
      const cuisine=url.searchParams.get('cuisine'), diet=url.searchParams.get('diet');
      const offset=Math.min(1000,Math.max(0,Number.parseInt(url.searchParams.get('offset')||'0',10)||0));
      const byDiet:Record<string,string>={Vegan:'vegan',Vegetarian:'vegetarian',Pescatarian:'fish','Non-vegetarian':'meat'};
      const matches=[...catalog.values()].filter(r=>(!q||r.name.toLowerCase().includes(q))&&(!cuisine||r.cuisine===cuisine)&&(!diet||r.diet===byDiet[diet]));
      return json({recipes:matches.slice(offset,offset+18).map(summary), count:matches.length, next:offset+18<matches.length?offset+18:null});
    }
    if (path.startsWith('/api/recipe/') && method==='GET') {
      const r=catalog.get(path.slice('/api/recipe/'.length));
      if (!r) return json({error:'Recipe not found.'},404);
      return json({...summary(r),ingredientCost:ingredientCost(r),items:r.items.map(([id,amount])=>({id,name:stock[id].name,unit:stock[id].unit,amount})),
        steps:r.steps,appliances:r.appliances,source:source(r.sourceUrl),sourceName:r.sourceName||r.authorship,licence:r.licence});
    }
    if (['/api/plan','/api/quote','/api/swaps','/api/swap'].includes(path) && method==='POST') {
      const body=await readBody(request),p=profile(body.profile),kitchen=pantry(body.pantry);
      if (path==='/api/plan') {
        const seed=Number.isSafeInteger(body.seed)?body.seed:0;
        const plan=generateDayPlan(p,kitchen,seed);
        assertWithinBudget(plan,p,kitchen);
        return json(planResult(plan,p,kitchen));
      }
      const plan=slots(body.plan,p);
      assertPlanPreferences(plan,p);
      if(path==='/api/quote') return json(planResult(plan,p,kitchen));
      valid(Number.isInteger(body.index)&&inRange(body.index,0,plan.length-1),'Choose a meal in the plan.');
      const choices=mealSwapChoices(plan,body.index,p,kitchen).filter(x=>catalog.has(x.recipe.id)&&x.allowed);
      if(path==='/api/swaps') return json({choices:choices.slice(0,18).map(x=>({...summary(x.recipe),total:x.cost,change:x.change}))});
      const choice=choices.find(x=>x.recipe.id===body.recipeId);
      if(!choice) return json({error:'This swap exceeds your budget or does not match your preferences.'},422);
      return json(planResult(choice.plan,p,kitchen));
    }
    return json({error:'This endpoint is unavailable.'},404);
  } catch (error) {
    if(error instanceof InputError) return json({error:error.message},400);
    const message=error instanceof Error?error.message:'Could not complete this request.';
    if(request.method==='POST') return json({error:message},422);
    console.error('Mealday API',error);
    return json({error:'The recipe service could not respond.'},500);
  }
}
