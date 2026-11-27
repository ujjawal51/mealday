// Careem Quik development bridge. No OAuth, checkout, or production host allowed.
import {randomUUID} from 'node:crypto';

const locations={
  marina:{latitude:25.0866,longitude:55.1474},
  london:{latitude:51.5074,longitude:-0.1278},
};
const ttl=5*60e3, object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const uid=x=>typeof x==='string'&&/^[0-9a-f-]{36}$/.test(x);
const identifier=x=>Number.isSafeInteger(x)&&x>0;
const money=x=>Number.isFinite(x)&&x>=0&&x<=1000000?Math.round(x*100):null;
const text=(x,n=120)=>typeof x==='string'?x.trim().slice(0,n):'';
const bad=(code,message)=>Object.assign(new Error(message),{status:code});
const norm=x=>text(x).toLowerCase().trim().replace(/\s+/g,' ');
const term=x=>{
  const value=norm(x).replace(/\s*\([^)]*\)\s*$/,'').trim();
  return value==='fresh milk'?'milk':value;
};

function unitType(unit){
  const u=norm(unit);
  return ({g:['g',1],kg:['g',1000],ml:['ml',1],l:['ml',1000],pc:['pieces',1],pcs:['pieces',1],piece:['pieces',1],pieces:['pieces',1],eggs:['pieces',1],pk:['pieces',1],count:['pieces',1]})[u];
}
function parsePack(description){
  // Accept only an explicit single usable quantity at the end, or a stated multiplier.
  const m=text(description,500).match(/\((?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pieces?|pcs?|pk|count)\)\s*$/i);
  if(!m)return null;
  const [unit,factor]=unitType(m[3]),pack=Number(m[2])*Number(m[1]||1)*factor;
  return Number.isFinite(pack)&&pack>0?{unit,pack}:null;
}
export function reviewProducts(requirement,group,merchantId){
  const unit=unitType(requirement.unit);
  if(!unit||!Array.isArray(group))return [];
  const sought=term(requirement.name);
  if(!sought)return [];
  const pattern=new RegExp('(?:^|[^a-z])'+sought.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z])','i');
  return group.flatMap(p=>{
    if(!identifier(p?.id)||p.catalog_id!==merchantId||p.active!==true||p.is_available!==true||p.currency?.code!=='AED')return [];
    const title=text(p.item_localized||p.item),priceCents=money(p.price?.total),pack=parsePack(p.description);
    // A group's relevance alone does not make adjacent results (e.g. milk versus yogurt) equivalent.
    const isBreadLoaf=sought==='bread'&&/\b(?:sourdough|whole[- ]wheat|white|rye) loaf\b/i.test(title);
    if((!pattern.test(title)&&!isBreadLoaf)||!pack||pack.unit!==unit[0]||priceCents===null)return [];
    const requiredMicro=Math.round(requirement.need*unit[1]*1e6),packMicro=Math.round(pack.pack*1e6);
    if(requiredMicro<1||packMicro<1)return [];
    const packs=Math.ceil(requiredMicro/packMicro);
    if(!Number.isSafeInteger(packs)||packs>100)return [];
    return [{id:String(p.id),title,pack:pack.pack,unit:pack.unit,packs,priceCents}];
  }).filter((p,i,all)=>all.findIndex(x=>x.id===p.id)===i).slice(0,8);
}
function matchBasket(basket,id,merchantId,selected){
  if(basket?.id!==id||(basket.merchant_id??basket.merchant?.id)!==merchantId||basket.currency?.code!=='AED'||
    !Array.isArray(basket.items)||basket.items.length!==selected.length||basket.missing_items?.length)return false;
  const counts=new Map(basket.items.map(i=>[String(i.catalog_item_id),i.count]));
  return counts.size===selected.length&&selected.every(i=>counts.get(i.id)===i.packs);
}
function basketQuote(raw,id,merchantId,selected){
  if(raw.merchant?.id!==merchantId||!matchBasket(raw.basket,id,merchantId,selected))return null;
  const subtotalCents=money(raw.basket.price?.net_total),totalCents=money(raw.price?.price?.total);
  if(subtotalCents===null||totalCents===null)return null;
  const fees=Array.isArray(raw.price.fees)?raw.price.fees.flatMap(x=>{
    const label=text(x?.type,40),cents=money(x?.value);
    return label&&cents!==null?[{label,cents}]:[];
  }):[];
  const eta=raw.merchant.eta_in_minutes;
  return {subtotalCents,totalCents,fees,etaMinutes:identifier(eta)?eta:null};
}
const toolsAllowed=new Set(['is_grocery_area_serviceable','search_groceries_items','create_grocery_cart_with_quantities','cart_get_basket_price']);
export function careemLocalTransport(url,fetcher=fetch){
  // Restrict even the opt-in app to an exact loopback MCP endpoint; never send credentials.
  if(!/^http:\/\/127\.0\.0\.1:\d{1,5}\/mcp$/.test(url)||Number(new URL(url).port)>65535)throw Error('Quik sandbox requires an explicit loopback MCP URL.');
  return async (name,args)=>{
    if(!toolsAllowed.has(name))throw Error('Tool not enabled in Mealday sandbox.');
    let session='',version='2025-06-18';
    const call=async(message,id)=>{
      const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
      if(session){headers['Mcp-Session-Id']=session;headers['MCP-Protocol-Version']=version;}
      const response=await fetcher(url,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...message,...(id?{id}:{})}),redirect:'error',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw Error('MCP request failed');
      session=response.headers.get('mcp-session-id')||session;
      if(!id)return;
      if(response.headers.get('content-type')?.includes('application/json')){
        const env=await response.json();if(env.id!==id||env.error)throw Error('MCP tool failed');return env.result;
      }
      if(!response.headers.get('content-type')?.includes('text/event-stream')||!response.body)throw Error('Invalid MCP response');
      const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer='',bytes=0;
      try{for(;;){
        const chunk=await reader.read();if(chunk.done)break;
        bytes+=chunk.value.length;if(bytes>1_000_000)throw Error('MCP response too large');
        buffer+=chunk.value;
        const events=buffer.split(/\r?\n\r?\n/);buffer=events.pop();
        for(const event of events){
          const body=event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!body)continue;
          const env=JSON.parse(body);if(env.id===id){if(env.error)throw Error('MCP tool failed');return env.result;}
        }
      }}finally{void reader.cancel().catch(()=>{});}
      throw Error('MCP response missing');
    };
    try{
      const init=await call({method:'initialize',params:{protocolVersion:version,capabilities:{},clientInfo:{name:'Mealday Quik sandbox',version:'1.0.0'}}},1);
      if(init?.serverInfo?.name!=='careem-mcp-service')throw Error('Unexpected MCP service');
      version=init.protocolVersion;
      await call({method:'notifications/initialized'});
      const result=await call({method:'tools/call',params:{name,arguments:args}},2);
      if(result?.isError)throw Error('MCP tool failed');
      const value=result?.structuredContent??JSON.parse(result?.content?.find(c=>c.type==='text')?.text||'null');
      if(!object(value))throw Error('MCP response missing');
      return value;
    }finally{
      if(session)void Promise.resolve(fetcher(url,{method:'DELETE',headers:{'Mcp-Session-Id':session,'MCP-Protocol-Version':version},redirect:'error',signal:AbortSignal.timeout(2000)})).catch(()=>{});
    }
  };
}
export function createQuikSandbox({call,now=Date.now}){
  const reviews=new Map();
  const sweep=()=>{for(const [id,v] of reviews)if(v.expires<=now())reviews.delete(id);};
  const invoke=async (name,args)=>{
    try {const result=await call(name,args);if(!object(result))throw Error();return result;}
    catch{throw bad(503,'Careem Quik sandbox is unavailable. No order was placed.');}
  };
  return {
    async review(input){
      sweep();
      if(!object(input)||!Object.hasOwn(locations,input.location)||!Array.isArray(input.items)||input.items.length<1||input.items.length>30)throw bad(400,'Use a sandbox area and 1 to 30 grocery lines.');
      const keys=new Set();
      const items=input.items.map(i=>{
        const key=text(i?.key,100),name=text(i?.name),unit=text(i?.unit,30),need=i?.need;
        if(!/^[\w-]+$/.test(key)||keys.has(key)||!name||!unit||!Number.isFinite(need)||need<=0||need>100000)throw bad(400,'Review the grocery quantities and try again.');
        keys.add(key);return {key,name,unit,need};
      });
      const coords=locations[input.location],coverage=await invoke('is_grocery_area_serviceable',coords);
      if(coverage.error||typeof coverage.serviceable!=='boolean')throw bad(503,'The sandbox could not check this area.');
      if(!coverage.serviceable)return {mode:'sandbox',serviceable:false};
      const terms=[...new Set(items.map(i=>term(i.name)).filter(Boolean))];
      if(!terms.length)throw bad(400,'No searchable ingredients.');
      const found=await invoke('search_groceries_items',{...coords,search_terms:terms,limit:8});
      if(found.error||!identifier(found.merchant_id)||found.domain!=='quik'||!Array.isArray(found.groups)){
        if(typeof found.error==='string'&&found.error.toLowerCase().startsWith('no items found'))return {mode:'sandbox',serviceable:true,lines:items.map(i=>({...i,options:[]}))};
        throw bad(503,'The sandbox could not confirm a Quik store and its products.');
      }
      const lines=items.map(i=>{
        const products=found.groups.filter(g=>norm(g?.name)===term(i.name)).flatMap(g=>Array.isArray(g.items)?g.items:[]);
        return {...i,options:reviewProducts(i,products,found.merchant_id)};
      });
      if(reviews.size>=128)throw bad(429,'Too many sandbox reviews. Wait a few minutes and retry.');
      const reviewId=randomUUID(),merchantName=text(found.merchant_name),eta=found.merchant_eta_minutes;
      reviews.set(reviewId,{coords,merchantId:found.merchant_id,lines,expires:now()+ttl});
      return {mode:'sandbox',reviewId,serviceable:true,merchantName,etaMinutes:identifier(eta)?eta:null,lines};
    },
    async quote(input){
      sweep();
      if(!uid(input?.reviewId)||input.confirmed!==true||!Array.isArray(input.selections)||input.selections.length>30)throw bad(400,'Confirm exact sandbox products before requesting a quote.');
      const review=reviews.get(input.reviewId);
      if(!review)throw bad(410,'This sandbox review expired. Search again.');
      const byKey=new Map(input.selections.map(s=>[s?.key,s?.id]));
      if(byKey.size!==input.selections.length||byKey.size!==review.lines.length)throw bad(400,'Choose one available pack for every ingredient; no partial quote is shown.');
      const selected=review.lines.map(line=>{
        const p=line.options.find(x=>x.id===byKey.get(line.key));if(!p)throw bad(400,'A selected product is no longer in this review.');
        return {...p,keyword:term(line.name)};
      });
      if(new Set(selected.map(i=>i.id)).size!==selected.length)throw bad(400,'Separate ingredients cannot share a single SKU in this preview.');
      const signature=selected.map(i=>i.id).join('|');
      if(review.signature&&review.signature!==signature)throw bad(409,'Search again before changing an already confirmed basket.');
      if(review.promise)return review.promise;
      review.signature=signature;
      // Keep the same promise even on failure: a retry must not repeat a cart mutation.
      review.promise=(async()=>{
        const payload={...review.coords,merchant_id:review.merchantId,items:selected.map(i=>({catalog_item_id:i.id,keyword:i.keyword,price:i.priceCents/100,quantity:i.packs}))};
        const cart=await invoke('create_grocery_cart_with_quantities',payload);
        const data=cart.data;
        if(cart.error||!identifier(data?.basket_id)||data.unavailable_keywords?.length||
          !matchBasket(data.current_basket,data.basket_id,review.merchantId,selected))
          throw bad(409,'The sandbox basket does not match these products and quantities. No quote or order was created.');
        const raw=await invoke('cart_get_basket_price',{...review.coords,merchant_id:review.merchantId,domain:'shops',business_type:'quik'});
        const quote=!raw.error&&basketQuote(raw,data.basket_id,review.merchantId,selected);
        if(!quote)throw bad(409,'The sandbox quote does not match this basket. No order was placed.');
        return {mode:'sandbox',selected,quote,canCheckout:false};
      })();
      return review.promise;
    },
  };
}
