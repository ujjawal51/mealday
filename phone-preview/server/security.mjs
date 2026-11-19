import {scrypt,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export const token=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export async function passwordHash(password,salt=randomBytes(16).toString('hex')){
  const hash=await derive(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
  return {salt,hash:hash.toString('hex')};
}
export async function passwordMatches(password,stored){
  if(stored&&typeof stored.passwordHash==='string'&&typeof stored.salt==='string'){
    // Read the original root app's salted scrypt hashes without rewriting accounts.
    if(!/^[a-f0-9]{128}$/i.test(stored.passwordHash)||!/^[a-f0-9]{32}$/i.test(stored.salt))return false;
    const supplied=await derive(password,stored.salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    return timingSafeEqual(supplied,Buffer.from(stored.passwordHash,'hex'));
  }
  if(!stored||typeof stored.salt!=='string'||typeof stored.hash!=='string'||!/^[a-f0-9]{128}$/i.test(stored.hash))return false;
  const supplied=await passwordHash(password,stored.salt);
  return timingSafeEqual(Buffer.from(supplied.hash,'hex'),Buffer.from(stored.hash,'hex'));
}
export function validateAccount(body,{registration=true}={}){
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=body.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<(registration?12:1)||password.length>128)throw Object.assign(Error(registration?'Use a valid email and a password of 12–128 characters.':'Use a valid email and password.'),{status:400});
  return {email,password};
}
export function validateSnapshot(value){
  const fail=()=>{throw Object.assign(Error('Invalid kitchen backup.'),{status:400});};
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(!object(value)||!object(value.state)||!object(value.history))fail();
  const s=value.state,h=value.history;
  if(!object(s.profile)||!object(s.pantry)||!Array.isArray(s.favorites)||s.favorites.length>1000||!Array.isArray(s.checked)||s.checked.length>5000)fail();
  if(h.version!==1||!Array.isArray(h.events)||h.events.length>20000)fail();
  if(s.recipeJournal!==undefined&&!object(s.recipeJournal))fail();
  for(const r of Object.values(s.recipeJournal||{}))if(!object(r)||(r.rating!==undefined&&(!Number.isInteger(r.rating)||r.rating<0||r.rating>5))||(r.note!==undefined&&(typeof r.note!=='string'||r.note.length>2000)))fail();
  function inspect(v,depth=0){
    if(depth>35)fail();
    if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(k.startsWith('$')||k.includes('.')||['__proto__','constructor','prototype'].includes(k))fail();inspect(x,depth+1);}
  }
  inspect(value);return JSON.parse(JSON.stringify(value));
}
