import {createGoogleAuth} from './google-auth.mjs';
import {createServer} from 'node:http';
import {connectStore} from './mongo-store.mjs';
import {createApp} from './app.mjs';
import {serverConfig} from './config.mjs';
try{
 const config=serverConfig();
 const store=await connectStore(config.uri,config.dbName);
 const server=createServer(createApp({...config,store,googleAuth:createGoogleAuth()}));
 server.requestTimeout=30000;server.headersTimeout=15000;
 server.listen(config.port,config.host,()=>console.log('Mealday ready at '+config.origin+' · Latest phone UI · MongoDB connected'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await store.close();process.exit(0);}));
}catch(error){console.error('Mealday could not start. '+(/^(Set |APP_ORIGIN|A cloud service|PORT |MEALDAY_PROXY_SECRET)/.test(error.message)?error.message:'Check MongoDB credentials, network access and database availability.'));process.exitCode=1;}
