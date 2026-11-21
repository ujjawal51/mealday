import {OAuth2Client} from 'google-auth-library';
export function createGoogleAuth({clientId=process.env.GOOGLE_CLIENT_ID,verifyIdToken,now=()=>Date.now()}={}){
 if(!clientId)return null;
 const client=new OAuth2Client(clientId);
 return {clientId,async verify(credential,nonce){
  if(typeof credential!=='string'||credential.length>20000||typeof nonce!=='string')throw Error('Google sign-in could not be verified. Try again.');
  const payload=verifyIdToken?await verifyIdToken(credential):(await client.verifyIdToken({idToken:credential,audience:clientId})).getPayload();
  const audience=Array.isArray(payload?.aud)?payload.aud:[payload?.aud];
  if(!payload||!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)||!audience.includes(clientId)||(payload.azp&&payload.azp!==clientId)||payload.nonce!==nonce||!Number.isFinite(payload.exp)||payload.exp*1000<=now()||!Number.isFinite(payload.iat)||payload.iat*1000>now()+60000||payload.email_verified!==true||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||typeof payload.email!=='string'||payload.email.length>254||!/^\S+@\S+\.\S+$/.test(payload.email))throw Error('Google sign-in could not be verified. Try again.');
  const email=payload.email.toLowerCase();
  return {sub:payload.sub,email,authoritative:email.endsWith('@gmail.com')||typeof payload.hd==='string'&&!!payload.hd};
 }};
}
