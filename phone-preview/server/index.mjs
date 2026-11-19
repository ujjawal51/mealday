import {createServer} from 'node:http';
import {connectStore} from './mongo-store.mjs';
import {createApp} from './app.mjs';
const production=process.env.NODE_ENV==='production';
const origin=process.env.APP_ORIGIN||'http://localhost:3000';
if(production&&!origin.startsWith('https://'))throw Error('Production APP_ORIGIN requires HTTPS.');
if(!process.env.MONGODB_URI)throw Error('Set MONGODB_URI in .env. Copy .env.example first.');
try{
 const store=await connectStore(process.env.MONGODB_URI,process.env.MONGODB_DB||'mealday');
 const server=createServer(createApp({store,origin,production,allowRegistration:production?process.env.ALLOW_REGISTRATION==='true':true}));
 server.requestTimeout=30000;server.headersTimeout=15000;
 server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Mealday ready at '+origin+' · Latest phone UI · MongoDB connected'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await store.close();process.exit(0);}));
}catch{console.error('Could not connect to MongoDB. Check that MongoDB Server is running and MONGODB_URI is correct.');process.exitCode=1;}
