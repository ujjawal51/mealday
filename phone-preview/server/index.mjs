import {careemLocalTransport,createQuikSandbox} from './quik-sandbox.mjs';
import {createLuluPrices} from './lulu-prices.mjs';
import {createGoogleAuth} from './google-auth.mjs';
import {createServer} from 'node:http';
import {connectStore} from './mongo-store.mjs';
import {createApp} from './app.mjs';
import {serverConfig} from './config.mjs';
try{
 const config=serverConfig();
 const quikSandbox=!config.production&&['127.0.0.1','localhost'].includes(config.host)&&process.env.CAREEM_QUIK_SANDBOX_URL?createQuikSandbox({call:careemLocalTransport(process.env.CAREEM_QUIK_SANDBOX_URL)}):null;
 const store=await connectStore(config.uri,config.dbName);
 const creditLimit=Number(process.env.REEF_DAILY_CREDITS||20);
 if(!Number.isInteger(creditLimit)||creditLimit<0||creditLimit>1000)throw Error('Set REEF_DAILY_CREDITS to an integer from 0 to 1000.');
 const luluPrices=createLuluPrices({key:process.env.REEF_API_KEY||'',reserve:(cost,day)=>store.reservePriceCredits(day,cost,creditLimit)});
 const server=createServer(createApp({...config,store,luluPrices,quikSandbox,googleAuth:createGoogleAuth()}));
 server.requestTimeout=30000;server.headersTimeout=15000;
 server.listen(config.port,config.host,()=>console.log('Mealday ready at '+config.origin+' · Latest phone UI · MongoDB connected'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await store.close();process.exit(0);}));
}catch(error){console.error('Mealday could not start. '+(/^(Set |APP_ORIGIN|A cloud service|PORT |MEALDAY_PROXY_SECRET|Quik sandbox)/.test(error.message)?error.message:'Check MongoDB credentials, network access and database availability.'));process.exitCode=1;}
