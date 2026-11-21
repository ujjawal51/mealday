import {token,digest,passwordHash} from './security.mjs';
const durations={reset:30*60000,verify:24*60*60000};
export const requestMessage='If an eligible account exists, an email will arrive shortly. Check your inbox and spam folder.';
export function createEmailRecovery({store,origin,mailer,now=()=>Date.now()}){
 function available(){if(!mailer)throw Object.assign(Error('Account email is not configured yet. Please try again later.'),{status:503});}
 async function sendLink(user,purpose){
  available();
  const raw=token(),time=now(),expiresAt=new Date(time+durations[purpose]);
  const issued=await store.issueEmailToken(user._id,purpose,digest(raw),expiresAt,new Date(time));
  if(!issued)return;
  const url=new URL(purpose==='reset'?'/reset-password.html':'/verify-email.html',origin);
  url.hash=new URLSearchParams({token:raw}).toString();
  try{await mailer.send({to:user.email,subject:purpose==='reset'?'Reset your Mealday password':'Verify your Mealday email',text:(purpose==='reset'?'Choose a new Mealday password':'Confirm your Mealday email address')+':\n\n'+url.href+'\n\nThis link expires in '+(purpose==='reset'?'30 minutes':'24 hours')+' and works once. If you did not request this, ignore this email.'});}
  catch(error){await store.cancelEmailToken(user._id,purpose,digest(raw));throw error;}
 }
 return {
  enabled:!!mailer,
  sendLink,
  async request(email,purpose){
   available();
   if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw Object.assign(Error('Enter a valid email address.'),{status:400});
   const user=await store.userByEmail(email.trim().toLowerCase());
   if(user&&(purpose!=='verify'||!user.emailVerifiedAt)){
    // Do not reveal account existence or email-provider failures to anonymous callers.
    try{await sendLink(user,purpose);}catch{}
   }
   return {ok:true,message:requestMessage};
  },
  async consume(purpose,raw,password){
   available();
   if(typeof raw!=='string'||!(/^[\w-]{43}$/).test(raw))throw Object.assign(Error('This link is invalid or expired. Request a new one.'),{status:400});
   let hash;
   if(purpose==='reset'){
    if(typeof password!=='string'||password.length<12||password.length>128)throw Object.assign(Error('Use a password of 12–128 characters.'),{status:400});
    hash=await passwordHash(password);
   }
   const user=await store.consumeEmailToken(purpose,digest(raw),new Date(now()),hash);
   if(!user)throw Object.assign(Error('This link is invalid or expired. Request a new one.'),{status:400});
   return {ok:true,message:purpose==='reset'?'Password updated. Sign in with your new password.':'Email verified. You can now sign in.'};
  }
 };
}
