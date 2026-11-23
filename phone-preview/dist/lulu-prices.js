// LuLu product lookup is separate from Mealday's generic grocery estimates.
(()=>{
 'use strict';
 const choices=new Map();let context='',active=null,sequence=0,provider=null,expiryTimer,scheduled=false;
 const node=(tag,copy,cls)=>{const e=document.createElement(tag);if(copy!==undefined)e.textContent=copy;if(cls)e.className=cls;return e;};
 const money=value=>'AED '+Number(value).toFixed(2);
 const date=value=>new Date(value).toLocaleString('en-AE',{timeZone:'Asia/Dubai'});
 function kitchen(){try{return JSON.parse(localStorage.getItem('mealday.android.v1'))||{};}catch{return {};}}
 function owner(){try{return JSON.parse(localStorage.getItem('mealday.cloud.v1'))?.owner||'';}catch{return '';}}
 function items(){return (kitchen().result?.items||[]).filter(i=>i.packs>0);}
 function currentKey(){const k=kitchen();return JSON.stringify([owner(),k.profile?.shop,k.profile?.city,items().map(i=>[i.key,i.need,i.have||0,i.unit])]);}
 function close(){sequence++;active=null;const d=document.getElementById('lulu-product-dialog');if(d){d.close();d.remove();}}
 function stale(choice){return !choice||Date.parse(choice.validUntil)<=Date.now();}
 function render(){
  const key=currentKey();if(context!==key){context=key;choices.clear();close();}
  if(document.body.dataset.view!=='shopping'||kitchen().profile?.shop!=='LuLu'){document.getElementById('lulu-price-panel')?.remove();return;}
  const base=document.querySelector('.store-prices');if(!base)return;
  for(const [id,value] of choices)if(stale(value))choices.delete(id);
  let panel=document.getElementById('lulu-price-panel');
  if(!panel){
   panel=node('section',undefined,'surface-card store-prices');panel.id='lulu-price-panel';panel.setAttribute('aria-label','LuLu UAE online prices');
   panel.append(node('h2','LuLu UAE online prices'),node('p','Choose the exact product for each ingredient. Prices are supplied by ReefAPI for the UAE online catalogue; your delivery area and checkout price are not verified.'));
   panel.append(node('p',undefined,'lulu-connection'));panel.append(node('p',undefined,'lulu-selected-total'));base.after(panel);
  }
  const connection=provider===null?'Checking price connection…':provider.configured?'Product lookup configured. Choose a product below.':'LuLu price lookup is not configured.';
  if(panel.querySelector('.lulu-connection').textContent!==connection)panel.querySelector('.lulu-connection').textContent=connection;
  const selected=items().map(i=>choices.get(i.key)).filter(c=>c?.quote&&!stale(c)),total=selected.reduce((sum,c)=>sum+Math.round(c.quote.subtotal*100),0)/100;
  const text=selected.length?money(total)+' · '+selected.length+' of '+items().length+' selected items (UAE online reference; delivery fees and extra essentials excluded).':'No LuLu products selected. Catalogue estimates above remain separate.';
  if(panel.querySelector('.lulu-selected-total').textContent!==text)panel.querySelector('.lulu-selected-total').textContent=text;
  for(const input of document.querySelectorAll('input[data-grocery]')){
   const id=input.dataset.grocery,item=items().find(i=>i.key===id),host=input.closest('.priced-grocery-item');if(!item||!host)continue;
   let box=host.querySelector('.lulu-ingredient');
   if(box&&box.dataset.version===String(choices.get(id)?.checkedAt||'empty')+String(!!provider?.configured))continue;
   box?.remove();box=node('div',undefined,'store-product-record lulu-ingredient');box.dataset.version=String(choices.get(id)?.checkedAt||'empty')+String(!!provider?.configured);
   const choice=choices.get(id);
   if(choice){
    const p=choice.products[0],link=node('a',p.name);link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
    box.append(node('p',choice.quote?choice.quote.packs+' × '+p.packLabel+' = '+money(choice.quote.subtotal)+' · LuLu UAE online':money(p.price)+' per '+p.packLabel+' · pack total unavailable'));
    box.append(node('small','Retrieved '+date(choice.checkedAt)+' UAE · '+(p.inStock===true?'Reported in stock':p.inStock===false?'Reported out of stock':'Availability unknown')+' · delivery-area availability unverified.'));
    if(!choice.quote)box.append(node('small','Pack units, stock or order limit do not support this quantity. This product is excluded from the selected subtotal.'));
   }
   const button=node('button',choice?'Change / recheck LuLu product':'Find LuLu price','button ghost small');button.type='button';button.disabled=!provider?.configured;
   button.onclick=()=>open(item);box.append(button);host.append(box);
  }
  clearTimeout(expiryTimer);if(choices.size)expiryTimer=setTimeout(()=>schedule(),Math.max(1,Math.min(...[...choices.values()].map(c=>Date.parse(c.validUntil)))-Date.now()+20));
 }
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render();});}
 async function api(path,body){
  const accountResponse=await fetch('/api/account',{credentials:'same-origin',signal:AbortSignal.timeout(10000)}),account=await accountResponse.json();
  if(!accountResponse.ok||!account.user||!account.csrf)throw Error('Sign in to Mealday to check LuLu prices.');
  const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':account.csrf},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'LuLu price lookup failed.');
  return value;
 }
 function open(item){
  close();const d=node('dialog');d.id='lulu-product-dialog';d.style.cssText='width:min(94vw,520px);max-height:85vh;border:0;border-radius:22px;padding:22px;color:#234336;background:#fff;overflow:auto';
  const title=node('h2','Choose a LuLu product'),hint=node('p','Match the ingredient, product and pack. UAE online catalogue prices may differ at your delivery address.');
  const form=node('form'),label=node('label','Search LuLu products'),input=node('input');input.className='control';input.required=true;input.minLength=2;input.maxLength=80;input.value=item.name.replace(/\([^)]*\)/g,'').trim();label.append(input);
  const search=node('button','Search','button green');search.type='submit';const cancel=node('button','Close','button ghost');cancel.type='button';cancel.onclick=close;
  const status=node('p');status.setAttribute('role','status');const results=node('div');results.className='lulu-results';form.append(label,search);d.append(title,hint,form,status,results,cancel);document.body.append(d);d.showModal();active={id:item.key,key:context};
  d.addEventListener('cancel',event=>{event.preventDefault();close();});
  d.addEventListener('click',event=>event.stopPropagation());
  async function lookup(){
   const seq=++sequence,key=context;search.disabled=true;results.replaceChildren();status.textContent='Checking LuLu products…';
   // Never retain a previous selected price when a recheck is unsuccessful.
   choices.delete(item.key);schedule();
   try{
    const response=await api('/api/lulu/search',{query:input.value.trim()});
    if(seq!==sequence||key!==currentKey()||!d.open)return;
    status.textContent=response.products.length?'Choose the exact product. Prices retrieved '+date(response.checkedAt)+' UAE.':'No suitable products returned. Try a simpler product name.';
    for(const product of response.products){
     const card=node('article');card.className='surface-card';card.style.marginBottom='12px';
     const link=node('a',product.name);link.href=product.url;link.target='_blank';link.rel='noopener noreferrer';
     card.append(link,node('p',money(product.price)+' · '+product.packLabel),node('small',product.inStock===true?'Reported in stock':product.inStock===false?'Reported out of stock':'Availability unknown'));
     if(product.badges.length)card.append(node('p',product.badges.join(' · ')));
     const select=node('button','Use this product','button ghost small');select.type='button';
     select.onclick=async()=>{
      if(search.disabled)return;search.disabled=true;for(const b of results.querySelectorAll('button'))b.disabled=true;status.textContent='Rechecking this product…';
      try{
       const remaining=Math.max(0,item.need-(item.have||0));
       const value=await api('/api/lulu/product',{productId:product.id,need:remaining,unit:item.unit});
       if(seq!==sequence||key!==currentKey()||!d.open)return;
       if(/drained|cooked|edible|desalted/i.test(item.name)){value.quote=null;}
       choices.set(item.key,value);close();schedule();
      }catch(error){if(seq===sequence&&key===currentKey()&&d.open){status.textContent=error.message;for(const b of results.querySelectorAll('button'))b.disabled=false;}}
      finally{search.disabled=false;}
     };
     card.append(select);results.append(card);
    }
   }catch(error){if(seq===sequence&&key===currentKey()&&d.open)status.textContent=error.message;}
   finally{if(seq===sequence)search.disabled=false;}
  }
  form.onsubmit=event=>{event.preventDefault();if(!search.disabled)lookup();};
  lookup();
 }
 function init(){
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-view']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});window.addEventListener('focus',schedule);
  fetch('/api/lulu/status',{credentials:'same-origin',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():{configured:false}).then(value=>{provider=value;schedule();}).catch(()=>{provider={configured:false};schedule();});schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
