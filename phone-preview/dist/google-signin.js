let loading,active=0,pending;
function library(){
 if(window.google?.accounts?.id)return Promise.resolve();
 if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>{loading=null;reject(Error('Google sign-in could not load. Check your connection and try again.'));};document.head.append(script);});
 return loading;
}
export async function mountGoogleSignIn(container,{purpose='signin',onSuccess=()=>{}}={}){
 pending?.abort();const controller=new AbortController();pending=controller;
 const version=++active;let busy=false;
 const current=()=>container.isConnected&&active===version;
 container.replaceChildren();
 const button=document.createElement('div'),status=document.createElement('p'),retry=document.createElement('button');
 status.className='google-signin-status';status.setAttribute('role','status');status.textContent='Preparing Google sign-in…';
 retry.type='button';retry.className='button ghost wide';retry.textContent='Try Google sign-in again';retry.hidden=true;
 retry.onclick=()=>mountGoogleSignIn(container,{purpose,onSuccess});
 container.append(button,status,retry);
 try{
  const response=await fetch('/api/auth/google/challenge?purpose='+purpose,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Google sign-in is unavailable.');
  if(!current())return;
  await library();if(!current())return;
  window.google.accounts.id.initialize({client_id:data.clientId,nonce:data.nonce,auto_select:false,callback:async result=>{
   if(busy||!current())return;busy=true;status.textContent=purpose==='delete'?'Confirming your Google account…':'Signing you in…';
   try{
    const res=await fetch('/api/auth/google',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:result.credential})});
    const value=await res.json();if(!res.ok)throw Error(value.error||'Google sign-in failed.');
    if(!current())return;
    status.textContent=purpose==='delete'?'Google account confirmed.':'Signed in with Google.';
    await onSuccess(value);
   }catch(e){if(current()){status.textContent=e.message;retry.hidden=false;}}
   finally{busy=false;}
  }});
  window.google.accounts.id.renderButton(button,{type:'standard',theme:'outline',size:'large',text:'continue_with',shape:'pill',width:Math.min(320,container.clientWidth||320)});
  status.textContent=purpose==='delete'?'Confirm the Google account belonging to this Mealday account.':'Use your Google account to sign in or create a Mealday account.';
 }catch(e){if(current()){const disabled=document.createElement('button');disabled.type='button';disabled.className='button wide';disabled.disabled=true;disabled.textContent='Continue with Google';button.replaceChildren(disabled);status.textContent=e.message;retry.hidden=false;}}
}
