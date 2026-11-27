export function createQuikSandboxUi({openDialog,esc,dialog,onAvailability}){
  let status,load;
  const qty=n=>new Intl.NumberFormat('en-AE',{maximumFractionDigits:3}).format(n);
  const aed=cents=>new Intl.NumberFormat('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)+' AED';
  const disclaimer='Sandbox simulation only. Prices, stock and delivery times are fixture data, not live. No order or payment is possible.';
  const request=async(action,value)=>{
    const response=await fetch('/api/quik-sandbox/'+action,value?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}:{});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Careem sandbox could not respond.');
    return data;
  };
  function check(){
    if(status!==undefined||load)return;
    load=request('status').then(r=>{status=r.enabled===true;if(status)onAvailability();}).catch(()=>{status=false;});
  }
  function connect(items){
    if(!status)return;
    const lines=items.filter(i=>i.need>0).map(({key,name,unit,need})=>({key,name,unit,need}));
    if(!lines.length||lines.length>30){
      openDialog('Careem Quik sandbox',disclaimer,'<p>'+(!lines.length?'No groceries are needed for this plan.':'This sandbox supports up to 30 recipe grocery lines.')+'</p>');
      return;
    }
    openDialog('Careem Quik sandbox',disclaimer,'<form id="quik-area-form"><label class="field">Test delivery area<select class="control" name="location"><option value="marina">Dubai Marina (test location)</option><option value="london">London (out-of-area test)</option></select></label><p>This uses '+
      lines.length+' recipe grocery lines still needed after pantry deductions. Added extras are not included.</p><button type="submit" class="button green wide">Find sandbox products</button><p role="status"></p></form>');
    const form=dialog.querySelector('#quik-area-form');
    form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopPropagation();
      const submit=form.querySelector('button'),out=form.querySelector('[role=status]');if(submit.disabled)return;
      submit.disabled=true;out.textContent='Checking fixture availability…';
      try{
        const data=await request('review',{location:new FormData(form).get('location'),items:lines});
        if(!form.isConnected||!dialog.open)return;
        if(!data.serviceable){out.textContent='No fixture delivery coverage for this test location.';return;}
        showReview(data);
      }catch(e){out.textContent=e.message;}
      finally{submit.disabled=false;}
    });
  }
  function showReview(data){
    const choices=data.lines.map((line,index)=>{
      const entries=line.options.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.title+' · '+qty(i.pack)+' '+i.unit+' per pack · '+i.packs+' pack(s) · '+aed(i.priceCents)+' per pack')+'</option>').join('');
      return '<label class="field">'+esc(line.name)+' <small>· '+esc(qty(line.need)+' '+line.unit)+' needed</small>'+ (entries?
        '<select class="control" required name="product-'+index+'"><option value="">Choose exact product</option>'+entries+'</select>':
        '<p>No available match with a verified pack size in this sandbox.</p>')+'</label>';
    }).join('');
    const missing=data.lines.some(line=>!line.options.length);
    openDialog('Review sandbox basket',disclaimer,'<form id="quik-review-form"><p>'+esc(data.merchantName||'Careem Quik')+
      (data.etaMinutes?' · Fixture ETA '+qty(data.etaMinutes)+' min':'')+'</p>'+choices+
      '<p>Review the exact product label, pack and dietary suitability. Nothing is substituted automatically.</p>'+
      (missing?'<p>Some ingredients are missing. No partial total is shown.</p>':
      '<label><input type="checkbox" name="confirmed" required> I agree to update the simulated Careem basket with these choices.</label><button type="submit" class="button green wide">Build sandbox basket and quote</button>')+'<p role="status"></p></form>');
    if(missing)return;
    const form=dialog.querySelector('#quik-review-form');
    form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopPropagation();
      const submit=form.querySelector('button'),out=form.querySelector('[role=status]');if(submit.disabled)return;
      const values=new FormData(form);
      const selections=data.lines.map((line,i)=>({key:line.key,id:values.get('product-'+i)}));
      submit.disabled=true;out.textContent='Getting the fixture basket quote…';
      try{
        const result=await request('quote',{reviewId:data.reviewId,selections,confirmed:values.has('confirmed')});
        if(!form.isConnected||!dialog.open)return;
        const {quote}=result;
        const knownFees={delivery_fee:'Delivery fee',service_fee:'Service fee'};
        const fees=quote.fees.map(f=>'<div><dt>'+esc(Object.hasOwn(knownFees,f.label)?knownFees[f.label]:f.label.replaceAll('_',' '))+'</dt><dd>'+aed(f.cents)+'</dd></div>').join('');
        openDialog('Sandbox quote',disclaimer,'<dl><div><dt>Grocery subtotal</dt><dd>'+aed(quote.subtotalCents)+'</dd></div>'+fees+
          '<div><dt>Total</dt><dd><strong>'+aed(quote.totalCents)+'</strong></dd></div></dl>'+
          (quote.etaMinutes?'<p>Fixture ETA '+qty(quote.etaMinutes)+' minutes.</p>':'')+'<p>Checkout is disabled.</p>');
      }catch(e){out.textContent=e.message;submit.disabled=false;}
    });
  }
  return {check,connect,button:()=>status?'<button type="button" data-action="quik-sandbox" class="button ghost wide">Try Careem Quik (sandbox)</button>':''};
}
