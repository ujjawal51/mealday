import {isIP} from 'node:net';
import {timingSafeEqual} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {token,digest,passwordHash,passwordMatches,validateAccount,validateSnapshot} from './security.mjs';
const DAY=86400000;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon'};
export function createApp({store,origin,production=false,allowRegistration=!production,proxySecret='',googleAuth=null,allowPasswordAuth=false,staticRoot=resolve(fileURLToPath(new URL('../dist/',import.meta.url)))}){
  const limits=new Map();let dummy;
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
        if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Cross-site request rejected.'});
        if(!['GET','HEAD'].includes(req.method)){
          if(req.headers.origin!==origin)return send(403,{error:'Origin rejected.'});
          if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'JSON required.'});
        }
        const rawCookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
        let session=rawCookie&&/^[\w-]{43}$/.test(rawCookie)?await store.session(digest(rawCookie)):null;
        let accountUser=session?await store.userByEmail(session.email):null;
        if(session&&(!accountUser||String(accountUser._id)!==String(session.userId)||(session.authVersion||0)!==(accountUser.authVersion||0))){await store.deleteSession(digest(rawCookie));session=null;accountUser=null;}
        if(path==='/api/account'&&req.method==='GET')return send(200,{user:session?{id:session.userId,email:session.email,emailVerified:!!accountUser.emailVerifiedAt,authMethod:session.authMethod||'password'}:null,csrf:session?.csrf||null,allowRegistration:false,googleSignIn:!!googleAuth});
        async function body(){let chunks=[],size=0;for await(const part of req){size+=part.length;if(size>2*1024*1024)throw Object.assign(Error('Backup is too large.'),{status:413});chunks.push(part);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}}
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
        if(path==='/api/account'&&req.method==='DELETE'){
          const key='delete:'+session.userId,stamp=Date.now();let rate=limits.get(key);
          if(!rate||rate.until<stamp){if(limits.size>=10000)limits.clear();rate={count:0,until:stamp+15*60000};limits.set(key,rate);}
          if(++rate.count>5)return send(429,{error:'Too many attempts. Try again in 15 minutes.'});
          const value=await body();
          if(value?.confirmation!=='DELETE')return send(400,{error:'Type DELETE to confirm.'});
          if(session.authMethod==='google'){
            const verified=Date.parse(session.deleteVerifiedAt);
            if(!Number.isFinite(verified)||verified<Date.now()-5*60000)return send(403,{error:'Confirm with Google before deleting your account.',reauthRequired:true});
          }else{
            if(typeof value.password!=='string'||value.password.length<1||value.password.length>128)return send(400,{error:'Enter your current password.'});
            if(!await passwordMatches(value.password,accountUser.password||accountUser))return send(401,{error:'Password is incorrect. Your account has not been deleted.'});
          }
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
      try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(req.method==='HEAD'?undefined:bytes);}catch{return send(404,{error:'Not found.'});}
    }catch(error){send(error.status||503,{error:error.status?error.message:'The database is unavailable. Your local data is still on this device.'});}
  };
}
