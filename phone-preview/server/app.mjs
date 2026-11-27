import {priceRequest,quoteStorePrices} from './store-prices.mjs';
import {liveCatalogue,catalogueSummary,catalogueDetail,matchesCatalogueTag} from './live-catalogue.mjs';
import {isIP} from 'node:net';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
const compress=promisify(gzip);
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {token,digest,passwordHash,passwordMatches,validateAccount,validateSnapshot} from './security.mjs';
import {validateFeedback} from './feedback.mjs';
const DAY=86400000;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon'};
export function createApp({store,origin,production=false,allowRegistration=!production,proxySecret='',googleAuth=null,allowPasswordAuth=false,luluPrices=null,photoCalories=null,staticRoot=resolve(fileURLToPath(new URL('../dist/',import.meta.url)))}){
  const limits=new Map();let dummy,wireCache;
  const googleCookieName=production?'__Host-mealday_google':'mealday_google';
  const googleCookie=(value,maxAge)=>`${googleCookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production?'; Secure':''}`;
  const cookieName=production?'__Host-mealday_session':'mealday_session';
  const cookie=(value,maxAge)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production?'; Secure':''}`;
  return async(req,res)=>{
    const send=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
    try{
      const path=new URL(req.url,origin).pathname;
      if(['/forgot-password.html','/reset-password.html','/verify-email.html'].includes(path)&&req.method==='GET'){res.writeHead(303,{Location:'/login.html','Cache-Control':'no-store'});return res.end();}
      if(path==='/api/health'&&req.method==='GET'){
        if(store.ping)await store.ping();
        return send(200,{ok:true,database:'connected'});
      }
      let trustedProxy=false;
      if(proxySecret){
        const provided=Buffer.from(String(req.headers['x-mealday-proxy-key']||'')),expected=Buffer.from(proxySecret);
        trustedProxy=provided.length===expected.length&&timingSafeEqual(provided,expected);
        if(!trustedProxy)return send(403,{error:'Use the configured Mealday app address.'});
      }
      if(path.startsWith('/api/')){
        const publicRecipeRead=req.method==='GET'&&(path==='/api/catalogue'||path==='/api/recipes'||path.startsWith('/api/recipe/'));
        if(req.headers['sec-fetch-site']==='cross-site'&&!publicRecipeRead)return send(403,{error:'Cross-site request rejected.'});
        if(!['GET','HEAD'].includes(req.method)){
          if(req.headers.origin!==origin)return send(403,{error:'Origin rejected.'});
          if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'JSON required.'});
        }
        if(path==='/api/feedback'){
          if(req.method!=='POST')return send(405,{error:'Method not allowed.'},{Allow:'POST'});
          const forwarded=String(req.headers['x-mealday-client-ip']||'');
          const ip=trustedProxy&&isIP(forwarded)?forwarded:req.socket.remoteAddress;
          const key='feedback:'+ip,stamp=Date.now();let rate=limits.get(key);
          if(!rate||rate.until<=stamp){if(limits.size>=10000)limits.clear();rate={count:0,until:stamp+600000};limits.set(key,rate);}
          if(++rate.count>20)return send(429,{error:'Too many submissions. Please try again later.'},{'Retry-After':String(Math.ceil((rate.until-stamp)/1000))});
          const submission=validateFeedback(await body(16384,'Feedback is too large.'));
          try{
            if(!await store.saveFeedback(submission))return send(409,{error:'This reference is already in use. Please try again.'});
          }catch{return send(503,{error:'Feedback could not be sent. Please try again.'});}
          return send(201,{reference:submission._id});
        }
        if(path==='/api/store-prices'){
          if(req.method!=='POST')return send(405,{error:'Send a grocery price request.'},{Allow:'POST'});
          let raw='',size=0;
          for await(const chunk of req){size+=chunk.length;if(size>30000)return send(413,{error:'Price request is too large.'});raw+=chunk.toString();}
          let input;try{input=priceRequest(JSON.parse(raw));}catch(error){return send(400,{error:error.status?error.message:'Invalid price request.'});}
          const records=store.storePriceRecords?await store.storePriceRecords(input.shop,input.city,input.items.map(i=>i.key)):[];
          const catalogue=records.length?await liveCatalogue(store):{ingredients:{}};
          return send(200,quoteStorePrices(input,records,catalogue.ingredients));
        }
        if(path==='/api/catalogue'||path==='/api/recipes'||path.startsWith('/api/recipe/')){
          if(req.method!=='GET')return send(405,{error:'Method not allowed.'},{Allow:'GET'});
          const snapshot=await liveCatalogue(store),etag='W/"'+snapshot.revision+'"';
          if(path==='/api/catalogue'){
            const headers={'ETag':etag,'Cache-Control':'no-cache','Vary':'Accept-Encoding'};
            if(matchesCatalogueTag(req.headers['if-none-match'],etag)){res.writeHead(304,headers);return res.end();}
            const accepts=String(req.headers['accept-encoding']||'').split(',').map(v=>v.trim()).find(v=>/^gzip(?:\s*;|$)/i.test(v));
            if(accepts&&!/;\s*q\s*=\s*0(?:\.0*)?(?:\s*;|\s*$)/i.test(accepts)){
              if(wireCache?.revision!==snapshot.revision){
                const compressed=compress(JSON.stringify(snapshot));
                const cached={revision:snapshot.revision,compressed};wireCache=cached;
                compressed.catch(()=>{if(wireCache===cached)wireCache=undefined;});
              }
              const bytes=await wireCache.compressed;
              res.writeHead(200,{...headers,'Content-Type':'application/json','Content-Encoding':'gzip','Content-Length':bytes.length,'X-Content-Type-Options':'nosniff'});return res.end(bytes);
            }
            return send(200,snapshot,headers);
          }
          if(path.startsWith('/api/recipe/')){
            const id=decodeURIComponent(path.slice('/api/recipe/'.length)),recipe=snapshot.recipes.find(r=>r.id===id);
            return recipe?send(200,catalogueDetail(recipe,snapshot.ingredients)):send(404,{error:'Recipe not found or no longer published.'});
          }
          const params=new URL(req.url,origin).searchParams,q=(params.get('q')||'').slice(0,100).toLowerCase(),cuisine=params.get('cuisine'),diet=params.get('diet');
          const diets={Vegan:'vegan',Vegetarian:'vegetarian',Pescatarian:'fish','Non-vegetarian':'meat'};
          const matches=snapshot.recipes.filter(r=>(!q||r.name.toLowerCase().includes(q))&&(!cuisine||r.cuisine===cuisine)&&(!diet||r.diet===diets[diet]));
          const offset=Math.min(10000,Math.max(0,parseInt(params.get('offset')||'0',10)||0));
          return send(200,{recipes:matches.slice(offset,offset+18).map(catalogueSummary),count:matches.length,next:offset+18<matches.length?offset+18:null,revision:snapshot.revision});
        }
        if(path==='/api/lulu/status'&&req.method==='GET')return send(200,luluPrices?luluPrices.status():{configured:false});
        const rawCookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
        let session=rawCookie&&/^[\w-]{43}$/.test(rawCookie)?await store.session(digest(rawCookie)):null;
        let accountUser=session?await store.userByEmail(session.email):null;
        if(session&&(!accountUser||String(accountUser._id)!==String(session.userId)||(session.authVersion||0)!==(accountUser.authVersion||0))){await store.deleteSession(digest(rawCookie));session=null;accountUser=null;}
        if(path==='/api/calories/status'&&req.method==='GET')return send(200,{configured:!!photoCalories,signedIn:!!session});
        if(path==='/api/calories/estimate'&&req.method==='POST'){
          if(!photoCalories)return send(503,{error:'Automatic photo estimates are not available.'});
          if(!session)return send(401,{error:'Sign in to estimate from a photo.'});
          const value=await body(525000,'Meal photo is too large.');
          return send(200,await photoCalories.estimate(String(session.userId),value?.image));
        }
        if(path==='/api/account'&&req.method==='GET')return send(200,{user:session?{id:session.userId,email:session.email,emailVerified:!!accountUser.emailVerifiedAt,authMethod:session.authMethod||'password'}:null,csrf:session?.csrf||null,allowRegistration:false,googleSignIn:!!googleAuth});
        if(path==='/api/auth/google/challenge'&&req.method==='GET'){
          if(!googleAuth)return send(503,{error:'Google sign-in is being configured. Please try again later.'});
          const purpose=new URL(req.url,origin).searchParams.get('purpose')==='delete'?'delete':'signin';
          if(purpose==='delete'&&!session)return send(401,{error:'Sign in before confirming account deletion.'});
          const key='google:'+req.socket.remoteAddress,stamp=Date.now();let rate=limits.get(key);
          if(!rate||rate.until<stamp){if(limits.size>=10000)limits.clear();rate={count:0,until:stamp+15*60000};limits.set(key,rate);}
          if(++rate.count>30)return send(429,{error:'Too many sign-in requests. Try again later.'});
          const nonce=token();await store.issueGoogleChallenge({_id:digest(nonce),purpose,userId:purpose==='delete'?session.userId:null,expiresAt:new Date(Date.now()+600000)});
          return send(200,{clientId:googleAuth.clientId,nonce},{'Set-Cookie':googleCookie(nonce,600)});
        }
        if(path==='/api/auth/google'&&req.method==='POST'){
          if(!googleAuth)return send(503,{error:'Google sign-in is being configured. Please try again later.'});
          const ip=trustedProxy&&isIP(String(req.headers['x-mealday-client-ip']||''))?req.headers['x-mealday-client-ip']:req.socket.remoteAddress;
          const key='google-post:'+ip,stamp=Date.now();let rate=limits.get(key);
          if(!rate||rate.until<stamp){if(limits.size>=10000)limits.clear();rate={count:0,until:stamp+15*60000};limits.set(key,rate);}
          if(++rate.count>30)return send(429,{error:'Too many sign-in attempts. Try again later.'});
          const nonce=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(googleCookieName+'='))?.slice(googleCookieName.length+1);
          if(!nonce||!/^[\w-]{43}$/.test(nonce))return send(400,{error:'Start Google sign-in again.'});
          const value=await body();let claims;
          try{claims=await googleAuth.verify(value?.credential,nonce);}catch{return send(401,{error:'Google sign-in could not be verified. Try again.'});}
          const challenge=await store.consumeGoogleChallenge(digest(nonce),new Date());
          if(!challenge)return send(400,{error:'This sign-in attempt expired or was already used. Try again.'},{'Set-Cookie':googleCookie('',0)});
          if(challenge.purpose==='delete'){
            if(!session||String(session.userId)!==String(challenge.userId)||accountUser.googleSub!==claims.sub)return send(403,{error:'Use the Google account that belongs to this Mealday account.'},{'Set-Cookie':googleCookie('',0)});
            await store.markGoogleReauthenticated(digest(rawCookie),new Date().toISOString());
            return send(200,{reauthenticated:true},{'Set-Cookie':googleCookie('',0)});
          }
          const user=await store.googleUser(claims,{allowRegistration});
          if(rawCookie)await store.deleteSession(digest(rawCookie));
          const secret=token(),csrf=token();await store.saveSession({_id:digest(secret),userId:user._id,email:user.email,csrf,authMethod:'google',authVersion:user.authVersion||0,expiresAt:new Date(Date.now()+7*DAY)});
          return send(200,{user:{id:user._id,email:user.email,authMethod:'google'},csrf},{'Set-Cookie':[cookie(secret,7*86400),googleCookie('',0)]});
        }
        if(['/api/auth/forgot-password','/api/auth/request-verification','/api/auth/reset-password','/api/auth/verify-email'].includes(path))return send(410,{error:'Email verification and password recovery have been removed. Continue with Google.'});
        if(['/api/auth/login','/api/auth/register'].includes(path)&&req.method==='POST'){
          if(!allowPasswordAuth)return send(410,{error:'Continue with Google to sign in or create your account.'});
          const forwarded=String(req.headers['x-mealday-client-ip']||'');const ip=trustedProxy&&isIP(forwarded)?forwarded:req.socket.remoteAddress;const stamp=Date.now();let rate=limits.get(ip);
          if(!rate||rate.until<stamp){if(limits.size>=10000)limits.clear();rate={count:0,until:stamp+15*60000};limits.set(ip,rate);}
          if(++rate.count>15)return send(429,{error:'Too many attempts. Try again in 15 minutes.'});
          if(path.endsWith('register')&&!allowRegistration)return send(403,{error:'Account registration is disabled on this server.'});
          const {email,password}=validateAccount(await body(),{registration:path.endsWith('register')});let user=await store.userByEmail(email);
          if(path.endsWith('register')){
            if(user)return send(409,{error:'Cannot create this account. Try signing in.'});
            user={_id:randomUUID(),email,password:await passwordHash(password),createdAt:new Date().toISOString(),verificationRequired:false};
            if(!await store.createUser(user))return send(409,{error:'Cannot create this account. Try signing in.'});

          }else{
            dummy??=await passwordHash(token());
            const matches=await passwordMatches(password,user?.password||user||dummy);
            if(!user||!matches)return send(401,{error:'Email or password is incorrect.'});
          }
          if(rawCookie)await store.deleteSession(digest(rawCookie));
          const secret=token(),csrf=token();await store.saveSession({_id:digest(secret),userId:user._id,email,csrf,authVersion:user.authVersion||0,expiresAt:new Date(Date.now()+7*DAY)});
          return send(200,{user:{id:user._id,email,emailVerified:!!user.emailVerifiedAt},csrf},{'Set-Cookie':cookie(secret,7*86400)});
        }
        if(!session)return send(401,{error:'Sign in to access your backup.'});
        if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)return send(403,{error:'Session verification failed. Refresh and try again.'});
        if(['/api/lulu/search','/api/lulu/product'].includes(path)){
          if(req.method!=='POST')return send(405,{error:'Use POST for a price lookup.'},{Allow:'POST'});
          if(!luluPrices)return send(503,{error:'LuLu price lookup is not configured.'});
          const stamp=Date.now(),rateKey='lulu:'+session.userId;let rate=limits.get(rateKey);
          if(!rate||rate.until<stamp){if(limits.size>=10000)limits.clear();rate={count:0,until:stamp+60000};limits.set(rateKey,rate);}
          if(++rate.count>10)return send(429,{error:'Please wait a minute before another price lookup.'});
          let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'Price lookup request is too large.'});raw+=chunk.toString();}
          let input;try{input=JSON.parse(raw);}catch{return send(400,{error:'Invalid price request.'});}
          return send(200,await luluPrices[path.endsWith('/search')?'search':'product'](input));
        }
        if(path==='/api/account'&&req.method==='DELETE'){
          const key='delete:'+session.userId,stamp=Date.now();let rate=limits.get(key);
          if(!rate||rate.until<stamp){if(limits.size>=10000)limits.clear();rate={count:0,until:stamp+15*60000};limits.set(key,rate);}
          if(++rate.count>5)return send(429,{error:'Too many attempts. Try again in 15 minutes.'});
          // The authenticated session identifies the owner. Origin, JSON and CSRF
          // checks above still protect this one-click destructive action.
          await body();
          if(!await store.deleteAccount(session.userId,accountUser.authVersion||0))return send(409,{error:'Your account changed. Sign in again before deleting it.'});
          return send(200,{ok:true,deleted:true},{'Set-Cookie':cookie('',0)});
        }
        if(path==='/api/auth/logout'&&req.method==='POST'){await store.deleteSession(digest(rawCookie));return send(200,{ok:true},{'Set-Cookie':cookie('',0)});}
        if(path==='/api/kitchen'&&req.method==='GET'){
          const kitchen=await store.kitchen(session.userId);return send(200,kitchen?{revision:kitchen.revision,data:kitchen.data,updatedAt:kitchen.updatedAt}:{revision:0,data:null});
        }
        if(path==='/api/kitchen'&&req.method==='PUT'){
          const value=await body();if(!Number.isSafeInteger(value.revision)||value.revision<0)return send(400,{error:'Invalid backup revision.'});
          const result=await store.saveKitchen(session.userId,value.revision,validateSnapshot(value.data));
          return result?send(200,{revision:result.revision,updatedAt:result.updatedAt}):send(409,{error:'Another device changed this backup. Choose which version to keep.'});
        }
        return send(404,{error:'API route not found.'});
      }
      if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed.'});
      const file=resolve(staticRoot,'.'+decodeURIComponent(path==='/'?'/index.html':path));
      if(!file.startsWith(staticRoot+sep))return send(403,{error:'Forbidden.'});
      try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':/^\/(?:client|engine|calories)-[0-9a-f]{12}\.js$/.test(path)?'public, max-age=31536000, immutable':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(req.method==='HEAD'?undefined:bytes);}catch{return send(404,{error:'Not found.'});}
    }catch(error){send(error.status||503,{error:error.status?error.message:'The database is unavailable. Your local data is still on this device.'});}
    async function body(maxBytes=2*1024*1024,tooLarge='Backup is too large.'){
      const chunks=[];let size=0;
      for await(const part of req.iterator({destroyOnReturn:false})){
        size+=part.length;
        if(size>maxBytes){req.resume();throw Object.assign(Error(tooLarge),{status:413});}
        chunks.push(part);
      }
      try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}
    }
  };
}
