const form=document.querySelector('#account-form');
const mode=document.body.dataset.accountMode;
const signup=mode==='register';
const fields=document.querySelector('#account-fields');
const submit=document.querySelector('#account-submit');
const notice=document.querySelector('#account-notice');
const error=document.querySelector('#account-error');
const retry=document.querySelector('#account-retry');
const success=document.querySelector('#account-success');
let ready=false,working=false;
function message(text){notice.textContent=text;}
async function accountService(){
 if(working)return;ready=false;fields.disabled=true;submit.disabled=true;retry.hidden=true;message('Checking account connection…');
 try{
  const response=await fetch('/api/account',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw Error();const data=await response.json();
  if(!Object.hasOwn(data,'user'))throw Error();
  if(data.user){form.hidden=true;success.hidden=false;success.querySelector('h2').textContent='You’re signed in';success.querySelector('p').textContent='Continue as '+data.user.email+'.';message(data.user.emailVerified?'Your email is verified.':'Your account is connected. Use Verify email below to confirm your address.');return;}
  if(signup&&!data.allowRegistration){message('New accounts are not available on this service yet. You can log in to an existing account or continue as a guest.');return;}
  ready=true;fields.disabled=false;submit.disabled=false;
  message(signup?'Create your account to save your kitchen across devices.':'Sign in to load your saved kitchen.');
 }catch{message('Account service is not connected on this link yet. You can continue as a guest.');retry.hidden=false;}
}
retry.addEventListener('click',accountService);
for(const toggle of document.querySelectorAll('[data-password-toggle]'))toggle.addEventListener('click',()=>{
 const input=document.getElementById(toggle.dataset.passwordToggle);const show=input.type==='password';input.type=show?'text':'password';toggle.textContent=show?'Hide':'Show';toggle.setAttribute('aria-pressed',String(show));
});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!ready||working)return;error.textContent='';
 const email=form.elements.email.value.trim().toLowerCase(),password=form.elements.password.value;
 if(signup&&password!==form.elements.confirmPassword.value){error.textContent='The passwords don’t match.';form.elements.confirmPassword.focus();return;}
 if(!form.reportValidity())return;
 working=true;fields.disabled=true;submit.disabled=true;submit.textContent=signup?'Creating account…':'Logging in…';
 try{
  const response=await fetch('/api/auth/'+mode,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({email,password})});
  let data;try{data=await response.json();}catch{throw Error('Account service could not respond. Please retry.');}
  if(data.requiresVerification&&signup){
   form.reset();form.hidden=true;success.hidden=false;
   success.querySelector('h2').textContent='Check your inbox';
   success.querySelector('p').textContent='Open the verification email, confirm your address, then log in. You can request a new email using Resend verification below.';
   const next=success.querySelector('a');next.href='/login.html';next.textContent='Go to log in';
   message('Your email needs verification.');return;
  }
  if(!response.ok)throw Error(data.error||'Could not complete sign-in. Please try again.');
  if(!data.user?.id)throw Error('Sign-in was not confirmed. Please retry.');
  form.reset();form.hidden=true;success.hidden=false;
  success.querySelector('h2').textContent=signup?'Your account is ready':'Welcome back';
  success.querySelector('p').textContent='Signed in as '+data.user.email+'. Continue to Mealday to load your kitchen. You can import your guest kitchen from Settings.';
  message('Signed in successfully.');
 }catch(e){error.textContent=e.message;fields.disabled=false;submit.disabled=false;}
 finally{working=false;submit.textContent=signup?'Create account':'Log in';}
});
accountService();
