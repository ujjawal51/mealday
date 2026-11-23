// Read-only LuLu UAE catalogue access. Credentials never leave this server.
const TTL=5*60000;
const fail=(message,status=503)=>{throw Object.assign(Error(message),{status});};
const text=(v,n=200)=>typeof v==='string'&&v.trim()&&v.length<=n?v.trim():null;
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=100000&&Math.abs(v*100-Math.round(v*100))<1e-7?v:null;
function sourceUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='gcc.luluhypermarket.com'&&u.pathname.startsWith('/en-ae/')&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function plainPack(label){
 const match=typeof label==='string'&&label.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|g|grams?|kilograms?|ml|l|litres?|liters?|pcs?|pieces?|eggs?)$/i);
 if(!match)return null;
 let quantity=Number(match[1]),unit=match[2].toLowerCase();
 if(!Number.isFinite(quantity)||quantity<=0||quantity>1e6)return null;
 if(/^(kg|kilogram)/.test(unit)){quantity*=1000;unit='g';}
 else if(/^(g|gram)/.test(unit))unit='g';
 else if(/^(l|litre|liter)/.test(unit)){quantity*=1000;unit='ml';}
 else if(unit==='ml')unit='ml';else unit='count';
 return {quantity,unit};
}
export function normalizeLuluProduct(row){
 if(!row||row.hidden_in_country===true)return null;
 const id=text(String(row.product_id||''),80),name=text(row.name),url=sourceUrl(row.url),price=amount(row.price);
 if(!id||!/^[a-zA-Z0-9_-]+$/.test(id)||!name||!url||price===null||row.currency!=='AED')return null;
 const packLabel=text(row.pack_size,100)||'Pack size not provided',pack=plainPack(packLabel);
 const stock=Number.isSafeInteger(row.stock)&&row.stock>=0?row.stock:null;
 const max=Number.isSafeInteger(row.max_order_quantity)&&row.max_order_quantity>=0?row.max_order_quantity:null;
 return {id,name,url,price,currency:'AED',packLabel,pack,brand:text(row.brand)||'',sku:text(String(row.sku||''),100)||'',inStock:row.in_stock===true?true:row.in_stock===false?false:null,stock,maxOrderQuantity:max,badges:Array.isArray(row.badges)?row.badges.filter(v=>typeof v==='string').slice(0,6).map(v=>v.slice(0,100)):[],regularPrice:amount(row.regular_price)};
}
export function luluPackQuote(product,need,unit){
 if(!Number.isFinite(need)||need<=0||need>1e6)return null;
 const requested=/^(egg|eggs|piece|pieces|pc|pcs)$/.test(unit)?'count':unit;
 if(!product.pack||product.pack.unit!==requested||product.inStock!==true)return null;
 const packs=Math.ceil(Math.ceil(need*1e6-1e-7)/Math.floor(product.pack.quantity*1e6+1e-7));
 if(!Number.isSafeInteger(packs)||packs<1||(product.stock!==null&&packs>product.stock)||(product.maxOrderQuantity!==null&&packs>product.maxOrderQuantity))return null;
 const cents=packs*Math.round(product.price*100);return Number.isSafeInteger(cents)?{packs,subtotal:cents/100}:null;
}
export function createLuluPrices({key='',reserve,fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();let blockedUntil=0;
 const status=()=>({configured:!!key,provider:'ReefAPI',country:'ae',scope:'LuLu UAE online catalogue; delivery-area price and checkout availability are not verified.',locationVerified:false,checkoutVerified:false});
 async function request(action,input){
  if(!key)fail('LuLu price lookup is not configured.');
  const args=action==='search'?{query:text(input?.query,80)}:{product_id:text(input?.productId,80)};
  if(action==='search'&&(!args.query||args.query.length<2))fail('Enter a product name with 2–80 characters.',400);
  if(action==='product'&&(!args.product_id||!/^[a-zA-Z0-9_-]+$/.test(args.product_id)))fail('Choose a valid LuLu product.',400);
  const cacheKey=action+':'+(args.query?args.query.toLowerCase():args.product_id),old=cache.get(cacheKey);
  if(old&&Date.parse(old.validUntil)>now())return {...old,cached:true};
  if(pending.has(cacheKey))return pending.get(cacheKey);
  if(blockedUntil>now())fail('LuLu price service is temporarily unavailable. Try again later.');
  if(pending.size>=2)fail('Price lookup is busy. Try again shortly.',429);
  const work=(async()=>{
   if(!reserve||!await reserve(action==='search'?2:1,new Date(now()).toISOString().slice(0,10)))fail('Today’s LuLu lookup limit has been reached. Please try tomorrow.',429);
   let envelope;
   try{
    const response=await fetchImpl('https://api.reefapi.com/luluhypermarket/v1/'+action,{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-api-key':key},body:JSON.stringify({...args,country:'ae',language:'en',...(action==='search'?{page:1,page_size:10}:{})}),signal:AbortSignal.timeout(15000)});
    if(!response.ok){if([401,402,403,429].includes(response.status))blockedUntil=now()+60000;fail('LuLu provider could not complete the lookup. Check service credentials or credits.');}
    const decoder=new TextDecoder();let raw='',size=0;for await(const bytes of response.body){size+=bytes.length;if(size>1024*1024)fail('LuLu response was too large.');raw+=decoder.decode(bytes,{stream:true});}
    envelope=JSON.parse(raw+decoder.decode());
   }catch(error){if(error.status)throw error;fail('LuLu price service could not be reached. Please try again.');}
   const data=envelope?.data;
   if(envelope?.ok!==true||envelope?.meta?.mode!=='live'||data?.country!=='ae'||data?.currency!=='AED')fail('LuLu returned an unsupported country, currency or response.');
   const received=now(),stamp=Date.parse(envelope.meta.fetched_at);
   if(!Number.isFinite(stamp)||stamp>received+60000||stamp<received-TTL)fail('LuLu returned a missing or outdated price timestamp.');
   const rows=action==='search'?data.results:[data.product||data];
   if(!Array.isArray(rows))fail('LuLu returned an unsupported product response.');
   const products=rows.slice(0,10).map(normalizeLuluProduct).filter(Boolean);
   if(action==='product'&&(!products.length||products[0].id!==args.product_id))fail('The selected LuLu product could not be verified.');
   const value={...status(),products,checkedAt:new Date(stamp).toISOString(),validUntil:new Date(Math.min(stamp,received)+TTL).toISOString(),cached:false};
   cache.delete(cacheKey);cache.set(cacheKey,value);if(cache.size>100)cache.delete(cache.keys().next().value);
   return value;
  })();
  pending.set(cacheKey,work);try{return await work;}finally{pending.delete(cacheKey);}
 }
 return {status,search:input=>request('search',input),product:async input=>{const value=await request('product',input);return {...value,quote:luluPackQuote(value.products[0],input.need,input.unit)};}};
}
