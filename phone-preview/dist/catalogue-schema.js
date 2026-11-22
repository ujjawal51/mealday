// Public catalogue allowlist: no account fields, private notes or arbitrary HTML/URLs.
const idOK=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,149}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const text=(v,max=500)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const list=(v,choices)=>Array.isArray(v)&&v.length<=choices.length&&v.every(x=>choices.includes(x))&&new Set(v).size===v.length;
export function publicImage(value){
 if(typeof value!=='string'||value.length>2000)return '/recipe-image-unavailable.svg';
 if(/^\/(?!\/)[a-zA-Z0-9/_\-.]+$/.test(value))return value;
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 return '/recipe-image-unavailable.svg';
}
export function publicRecipe(doc){
 const r=doc?.data,definitions=doc?.ingredients;
 if(doc?.published!==true||!r||!idOK(doc.id)||r.id!==doc.id||!text(r.name)||!['vegan','vegetarian','meat','fish'].includes(r.diet)||!['Emirati','Arab','South Asian','Turkish','UAE mix'].includes(r.cuisine)||r.reviewStatus==='draft'||!list(r.mealTypes,['breakfast','lunch','dinner'])||!r.mealTypes.length||!list(r.appliances,['Hob','Oven','Microwave','Air fryer'])||!Number.isInteger(r.time)||r.time<=0||r.time>1440||!Array.isArray(r.items)||!r.items.length||r.items.length>80||!Array.isArray(r.steps)||r.steps.length<2||r.steps.length>80||!r.steps.every(s=>text(s,4000)))return null;
 const ingredients=Object.create(null),items=[];
 for(const pair of r.items){
  if(!Array.isArray(pair)||pair.length!==2)return null;
  const [id,n]=pair,i=definitions?.[id];
  if(!idOK(id)||!Number.isFinite(n)||n<=0||n>100000||!i||!text(i.name)||!text(i.unit,30)||!Number.isFinite(i.pack)||i.pack<=0||!Number.isFinite(i.price)||i.price<0||!text(i.category,100)||!['plant','dairy','egg','meat','fish'].includes(i.kind))return null;
  const allergens=[...new Set([i.allergen,...(Array.isArray(i.allergens)?i.allergens:[])].filter(Boolean))];
  if(!allergens.every(a=>['Gluten','Milk','Egg','Peanuts','Tree nuts','Fish','Shellfish','Sesame','Soy','Mustard'].includes(a)))return null;
  ingredients[id]={name:i.name,unit:i.unit,pack:i.pack,price:i.price,category:i.category,kind:i.kind,...(i.allergen?{allergen:i.allergen}:{}),...(Array.isArray(i.allergens)?{allergens:i.allergens}:{})};items.push([id,n]);
 }
 let timing;
 if(r.timing!==undefined){const t=r.timing;if(!t||!['prepMinutes','cookMinutes','waitMinutes'].every(k=>Number.isInteger(t[k])&&t[k]>=0)||t.prepMinutes+t.cookMinutes+t.waitMinutes!==r.time)return null;timing={prepMinutes:t.prepMinutes,cookMinutes:t.cookMinutes,waitMinutes:t.waitMinutes,estimated:true,...(text(t.waitKind,100)?{waitKind:t.waitKind}:{})};}
 else timing={prepMinutes:0,cookMinutes:r.time,waitMinutes:0,estimated:true}; // Explicit total prevents stale bundled ID-specific timings.
 const data={id:r.id,name:r.name,time:r.time,timing,diet:r.diet,cuisine:r.cuisine,mealTypes:r.mealTypes,appliances:r.appliances,items,steps:r.steps,imageUrl:publicImage(r.imageUrl||doc.photo?.path),tags:Array.isArray(r.tags)?r.tags.filter(x=>text(x,100)).slice(0,20):[],reviewStatus:'preview',image:0};
 for(const key of ['familyId','baseRecipeId','authorship','sourceName','licence'])if(text(r[key],1000))data[key]=r[key];
 if(typeof r.sourceUrl==='string'){try{const u=new URL(r.sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password)data.sourceUrl=u.href;}catch{}}
 return {data,ingredients};
}
export function publicSnapshot(documents){
 const recipes=[],ingredients=Object.create(null),seen=new Set();let rejected=0;
 for(const doc of documents){const row=publicRecipe(doc);if(!row){rejected++;continue;}if(seen.has(row.data.id))throw Error('Duplicate recipe IDs');seen.add(row.data.id);
  for(const [id,item] of Object.entries(row.ingredients)){if(ingredients[id]&&JSON.stringify(ingredients[id])!==JSON.stringify(item))throw Error('Conflicting shared ingredient definitions');ingredients[id]=item;}
  recipes.push(row.data);
 }
 recipes.sort((a,b)=>a.id.localeCompare(b.id));
 return {schemaVersion:1,recipes,ingredients,rejected};
}
export function validateSnapshot(snapshot){
 if(snapshot?.schemaVersion!==1||typeof snapshot.revision!=='string'||!/^[a-f0-9]{64}$/.test(snapshot.revision)||!Array.isArray(snapshot.recipes)||snapshot.recipes.length>2000||!snapshot.ingredients||typeof snapshot.ingredients!=='object')throw Error('Invalid live catalogue');
 const parsed=publicSnapshot(snapshot.recipes.map(data=>({id:data.id,data,ingredients:snapshot.ingredients,published:true})));
 if(parsed.rejected||parsed.recipes.length!==snapshot.recipes.length)throw Error('Incomplete live catalogue');
 return {...parsed,revision:snapshot.revision};
}
