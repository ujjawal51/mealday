import {createHash} from 'node:crypto';
export const MAX_PRICE_AGE_MS=24*60*60*1000;
const shops=['LuLu','Carrefour','Spinneys','Waitrose','Union Coop','Nesto','Choithrams'];
const cities=['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];
const safeText=(s,n=200)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const validId=x=>safeText(x,150)&&/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const url=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const fail=message=>{throw Object.assign(Error(message),{status:400});};
export function ingredientSignature(ingredient){return createHash('sha256').update(JSON.stringify({name:ingredient.name,unit:ingredient.unit,kind:ingredient.kind,allergens:[...new Set([ingredient.allergen,...(ingredient.allergens||[])].filter(Boolean))].sort()})).digest('hex');}
export function priceRequest(body){
 if(!body||!cities.includes(body.city)||(!shops.includes(body.shop)&&body.shop!=='Any supermarket')||!Array.isArray(body.items)||body.items.length>100)fail('Choose a supported shop, city and up to 100 grocery items.');
 if(body.locationId!==undefined&&body.locationId!==''&&!validId(body.locationId))fail('Invalid store location.');
 const seen=new Set();
 const items=body.items.map(i=>{if(!i||!validId(i.key)||seen.has(i.key)||!Number.isFinite(i.need)||i.need<=0||i.need>1e6||!safeText(i.unit,30))fail('Invalid or duplicate ingredient quantity.');seen.add(i.key);return {key:i.key,need:i.need,unit:i.unit};});
 return {shop:body.shop,city:body.city,locationId:body.locationId||'',items};
}
export function validateOffer(record,ingredient,now=Date.now()){
 const errors=[];const r=record||{};
 if(!shops.includes(r.shop)||!cities.includes(r.city)||!validId(r.ingredientId)||!validId(r.locationId)||!safeText(r.locationName)||!safeText(r.productId)||!safeText(r.productName)||!url(r.productUrl))errors.push('Store, city, location and exact product are required.');
 if(!ingredient||r.ingredientSignature!==ingredientSignature(ingredient))errors.push('Reviewed ingredient identity does not match the current catalogue.');
 if(!Number.isFinite(r.packQuantity)||r.packQuantity<=0||r.packQuantity>1e6||r.unit!==ingredient?.unit||!safeText(r.packLabel)||!safeText(r.quantityBasis,500))errors.push('A positive usable pack quantity in the ingredient unit, pack label and quantity basis are required.');
 if(!Number.isFinite(r.price)||r.price<=0||r.price>100000||Math.abs(Math.round(r.price*100)-r.price*100)>1e-7||r.currency!=='AED'||r.taxIncluded!==true)errors.push('A positive AED pack price including VAT is required, with at most two decimals.');
 if(!['in-stock','out-of-stock','unknown'].includes(r.availability))errors.push('Availability must be explicit.');
 if(r.stockPacks!==undefined&&r.stockPacks!==null&&(!Number.isInteger(r.stockPacks)||r.stockPacks<0))errors.push('Stock pack quantity must be a nonnegative integer or unknown.');
 const checked=typeof r.checkedAt==='string'?Date.parse(r.checkedAt):NaN,expires=typeof r.validUntil==='string'?Date.parse(r.validUntil):NaN;
 if(!Number.isFinite(checked)||checked>now||!Number.isFinite(expires)||expires<=checked||expires>checked+MAX_PRICE_AGE_MS)errors.push('Original check time and expiry (within 24 hours) are required.');
 if(!['retailer-page','receipt','partner-feed'].includes(r.source?.type)||!safeText(r.source?.name)||!url(r.source?.url))errors.push('A named, linked source is required.');
 const reviewed=Date.parse(r.review?.at);
 if(r.review?.approved!==true||!safeText(r.review?.by)||!Number.isFinite(reviewed)||reviewed<checked||reviewed>now)errors.push('A reviewer must approve the product, quantity basis and source after the observation.');
 return errors;
}
export function quoteStorePrices(body,records,ingredients,now=Date.now()){
 if(!Array.isArray(records)||records.length>2000)throw Object.assign(Error('Price records exceed the supported size.'),{status:503});
 const request=priceRequest(body),scoped=records.filter(r=>r.shop===request.shop&&r.city===request.city&&request.items.some(i=>i.key===r.ingredientId));
 const usable=scoped.filter(r=>!validateOffer(r,ingredients[r.ingredientId],now).length);
 const locations=[...new Map(usable.map(r=>[r.locationId,{id:r.locationId,name:r.locationName}])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 const locationId=request.locationId||(locations.length===1?locations[0].id:'');
 const location=locations.find(l=>l.id===locationId);
 let knownCents=0,matched=0;
 const items=request.items.map(item=>{
  const unknown=status=>({key:item.key,status});
  if(!scoped.some(r=>r.ingredientId===item.key))return unknown('no-reviewed-match');
  if(!ingredients[item.key]||ingredients[item.key].unit!==item.unit)return unknown('ingredient-changed');
  if(!location&&locations.length>0)return unknown('choose-location');
  // Keep the newest observation for each SKU, including its latest stock state.
  const newest=new Map();
  for(const r of scoped.filter(r=>r.ingredientId===item.key&&r.locationId===locationId))if(!newest.has(r.productId)||Date.parse(r.checkedAt)>Date.parse(newest.get(r.productId).checkedAt))newest.set(r.productId,r);
  const valid=[...newest.values()].filter(r=>!validateOffer(r,ingredients[item.key],now).length);
  const fresh=valid.filter(r=>Date.parse(r.validUntil)>now&&now-Date.parse(r.checkedAt)<MAX_PRICE_AGE_MS);
  const available=fresh.filter(r=>r.availability==='in-stock');
  const calculated=available.map(r=>{
   const needMicro=Math.max(1,Math.ceil(item.need*1e6-1e-7)),packMicro=Math.floor(r.packQuantity*1e6+1e-7);
   const packs=packMicro>0?Math.ceil(needMicro/packMicro):Infinity;
   return {r,packs,cents:packs*Math.round(r.price*100)};
  }).filter(x=>Number.isSafeInteger(x.packs)&&Number.isSafeInteger(x.cents)&&(!Number.isInteger(x.r.stockPacks)||x.r.stockPacks>=x.packs)).sort((a,b)=>a.cents-b.cents||Date.parse(b.r.checkedAt)-Date.parse(a.r.checkedAt));
  if(!calculated.length){const last=fresh[0]||valid[0];return {...unknown(!valid.length?'no-reviewed-match':!fresh.length?'stale':!available.length?(fresh.some(r=>r.availability==='out-of-stock')?'out-of-stock':'stock-unknown'):'insufficient-stock'),...(last?{checkedAt:last.checkedAt,validUntil:last.validUntil,productName:last.productName}:{})};}
  const {r,packs,cents}=calculated[0];if(!Number.isSafeInteger(knownCents+cents))return unknown('price-overflow');matched++;knownCents+=cents;
  return {key:item.key,status:'recorded-price',productId:r.productId,productName:r.productName,productUrl:url(r.productUrl),packQuantity:r.packQuantity,packLabel:r.packLabel,quantityBasis:r.quantityBasis,unit:r.unit,packs,price:r.price,subtotal:cents/100,availability:r.availability,stockPacks:r.stockPacks??null,checkedAt:r.checkedAt,validUntil:r.validUntil,source:{type:r.source.type,name:r.source.name,url:url(r.source.url)}};
 });
 const complete=items.length>0&&matched===items.length;
 return {shop:request.shop,city:request.city,locationId,locationName:location?.name||null,locations,status:!items.length?'no-purchases':!location&&locations.length>0?'choose-location':complete?'complete-records':matched?'partial-records':'no-records',matched,totalLines:items.length,items,recordedSubtotal:complete?knownCents/100:null,knownSubtotal:knownCents/100,calculatedAt:new Date(now).toISOString(),checkoutVerified:false,scope:'Dated product-price records only. Delivery charges, substitutions, checkout total and current delivery availability are not verified.'};
}
