export function serverConfig(env=process.env){
 const production=env.NODE_ENV==='production';
 const candidate=env.APP_ORIGIN||env.RENDER_EXTERNAL_URL||(production?'':'http://localhost:3000');
 let url;try{url=new URL(candidate);}catch{throw Error('Set APP_ORIGIN to the HTTPS address visitors open.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||(production&&url.protocol!=='https:'))throw Error('APP_ORIGIN must be an origin, using HTTPS in production.');
 const uri=env.MONGODB_URI;
 if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri))throw Error('Set MONGODB_URI in the hosting secret settings.');
 if(env.RENDER==='true'&&/^mongodb:\/\/(?:[^@/]+@)?(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/?]|$)/i.test(uri))throw Error('A cloud service cannot use your PC’s localhost MongoDB. Configure a reachable MongoDB cluster.');
 const port=Number(env.PORT||3000);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer from 1 to 65535.');
 const proxySecret=env.MEALDAY_PROXY_SECRET||'';
 if(proxySecret&&proxySecret.length<32)throw Error('MEALDAY_PROXY_SECRET must contain at least 32 characters.');
 return {production,origin:url.origin,uri,dbName:env.MONGODB_DB||'mealday',host:env.HOST||(production?'0.0.0.0':'127.0.0.1'),port,allowRegistration:production?env.ALLOW_REGISTRATION==='true':true,proxySecret};
}
