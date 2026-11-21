// Server-only gateway for retaining the existing Sites URL. No MongoDB credentials belong here.
const unavailable=()=>new Response(JSON.stringify({error:'The cloud backup service is not connected yet.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createGateway(fetchUpstream=fetch){
 return {async fetch(request,env){
  const secret=env.MEALDAY_PROXY_SECRET;
  let backend;try{backend=new URL(env.MEALDAY_BACKEND_URL);}catch{return unavailable();}
  const visitor=new URL(request.url);
  if(!secret||secret.length<32||backend.protocol!=='https:'||backend.username||backend.password||backend.pathname!=='/'||backend.search||backend.hash||backend.origin===visitor.origin)return unavailable();
  if(!['GET','HEAD','POST','PUT','DELETE'].includes(request.method))return new Response(null,{status:405});
  // Whitelist headers: never transmit Sites identity cookies, identity headers or bearer tokens upstream.
  const headers=new Headers();
  for(const key of ['accept','content-type','origin','x-csrf-token','sec-fetch-site']){const value=request.headers.get(key);if(value)headers.set(key,value);}
  const session=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>/^__Host-mealday_(?:session|google)=[\w-]{43}$/.test(s));
  if(session.length)headers.set('cookie',session.join('; '));
  headers.set('x-mealday-proxy-key',secret);
  const ip=request.headers.get('cf-connecting-ip');if(ip)headers.set('x-mealday-client-ip',ip);
  const target=new URL(visitor.pathname+visitor.search,backend);
  try{
   const response=await fetchUpstream(target.href,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',signal:AbortSignal.timeout(20000),duplex:'half'});
   // Reject redirects rather than risking a key being forwarded to another host.
   if(response.status>=300&&response.status<400&&response.status!==304)return unavailable();
   const outgoing=new Headers();
   for(const key of ['content-type','x-content-type-options','referrer-policy']){const value=response.headers.get(key);if(value)outgoing.set(key,value);}
   outgoing.set('Cache-Control','no-store');
   const cookies=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')].filter(Boolean);
   for(const cookie of cookies)if(/^__Host-mealday_(?:session|google)=/.test(cookie)&&!/;\s*Domain=/i.test(cookie)&&/;\s*Secure(?:;|$)/i.test(cookie)&&/;\s*HttpOnly(?:;|$)/i.test(cookie))outgoing.append('Set-Cookie',cookie);
   return new Response(response.body,{status:response.status,headers:outgoing});
  }catch{return unavailable();}
 }};
}
export default createGateway();
