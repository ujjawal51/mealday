const mode=document.body.dataset.recoveryMode,form=document.querySelector('#recovery-form'),fields=document.querySelector('#recovery-fields'),submit=document.querySelector('#recovery-submit'),status=document.querySelector('#recovery-status'),error=document.querySelector('#account-error');
let raw=new URLSearchParams(location.hash.slice(1)).get('token')||'';
history.replaceState(null,'',location.pathname);
let busy=false;
const confirming=mode==='verify'&&!!raw;
if(confirming){fields.replaceChildren();fields.hidden=true;submit.textContent='Confirm email address';}
async function request(path,body){
 const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 let data;try{data=await response.json();}catch{throw Error('The account service could not respond. Please try again.');}
 if(!response.ok)throw Error(data.error||'Could not complete this request.');
 return data;
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;error.textContent='';
 if(!confirming&&!form.reportValidity())return;
 if(mode==='reset'&&form.elements.password.value!==form.elements.confirm.value){error.textContent='The passwords don’t match.';return;}
 busy=true;fields.disabled=true;submit.disabled=true;
 try{
  let result;
  if(mode==='reset')result=await request('/api/auth/reset-password',{token:raw,password:form.elements.password.value});
  else if(confirming)result=await request('/api/auth/verify-email',{token:raw});
  else result=await request(mode==='forgot'?'/api/auth/forgot-password':'/api/auth/request-verification',{email:form.elements.email.value});
  status.textContent=result.message;form.reset();
  if(mode==='reset'||confirming){raw='';form.hidden=true;const link=document.createElement('a');link.className='account-continue';link.href='/login.html';link.textContent='Go to log in';status.after(link);}
 }catch(e){error.textContent=e.message;}
 finally{busy=false;fields.disabled=false;submit.disabled=false;}
});
async function init(){
 try{
  const response=await fetch('/api/account',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error();
  const data=await response.json();
  if(!data.emailRecovery){status.textContent='Email recovery is not available yet. Please try again later.';return;}
  if(mode==='reset'&&!/^[\w-]{43}$/.test(raw)){status.textContent='Open the reset link from your email, or request a new link below.';return;}
  if(mode==='verify'&&!confirming&&data.user){form.elements.email.value=data.user.email;if(data.user.emailVerified){status.textContent='Your email is already verified.';form.hidden=true;return;}}
  status.textContent=confirming?'Press Confirm email address to finish verification.':'';
  fields.disabled=false;submit.disabled=false;
 }catch{status.textContent='Unable to reach the account service. Refresh to try again.';}
}
init();
