// Uses a real disposable MongoDB database; requires an explicitly supplied test URI.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connectStore} from './mongo-store.mjs';
if(!process.env.MONGODB_TEST_URI)throw Error('Set MONGODB_TEST_URI to a disposable MongoDB instance.');
const name='mealday_test_'+randomUUID().replaceAll('-','');
let store=await connectStore(process.env.MONGODB_TEST_URI,name);
try{
 const budgetResults=await Promise.all(Array.from({length:20},()=>store.reservePriceCredits('2026-11-23',2,6)));
 assert.equal(budgetResults.filter(Boolean).length,3);
 await store.close();store=await connectStore(process.env.MONGODB_TEST_URI,name);
 assert.equal(await store.reservePriceCredits('2026-11-23',1,6),false);
 assert.equal(await store.reservePriceCredits('2026-11-24',1,6),true);
 assert.equal(await store.createUser({_id:'one',email:'a@example.com'}),true);
 assert.equal(await store.createUser({_id:'two',email:'a@example.com'}),false);
 assert.equal((await store.userByEmail('a@example.com'))._id,'one');
 await store.saveSession({_id:'hashed',userId:'one',expiresAt:new Date(Date.now()+60000)});
 assert.equal((await store.session('hashed')).userId,'one');
 await store.saveSession({_id:'expired',userId:'one',expiresAt:new Date(Date.now()-60000)});
 assert.equal(await store.session('expired'),null);
 assert.equal((await store.saveKitchen('one',0,{rating:5})).revision,1);
 assert.equal(await store.saveKitchen('one',0,{rating:1}),null);
 const races=await Promise.all([store.saveKitchen('one',1,{rating:4}),store.saveKitchen('one',1,{rating:3})]);
 assert.equal(races.filter(Boolean).length,1);
 assert.equal(await store.kitchen('two'),null);
 await store.close();store=await connectStore(process.env.MONGODB_TEST_URI,name);
 assert.equal((await store.kitchen('one')).revision,2);
 await store.deleteSession('hashed');assert.equal(await store.session('hashed'),null);
 const at=new Date(),expiry=new Date(at.getTime()+60000);
 await store.issueGoogleChallenge({_id:'challenge',purpose:'signin',expiresAt:expiry});
 assert.equal((await store.consumeGoogleChallenge('challenge',at)).purpose,'signin');assert.equal(await store.consumeGoogleChallenge('challenge',at),null);
 await store.issueGoogleChallenge({_id:'expired-challenge',purpose:'signin',expiresAt:new Date(at.getTime()-1)});assert.equal(await store.consumeGoogleChallenge('expired-challenge',at),null);
 const linked=await store.googleUser({sub:'google-one',email:'a@example.com',authoritative:true});assert.equal(linked._id,'one');assert.equal(linked.authVersion,1);assert.equal((await store.kitchen('one')).revision,2);
 assert.equal((await store.googleUser({sub:'google-one',email:'a@example.com',authoritative:true}))._id,'one');
 await assert.rejects(store.googleUser({sub:'different-sub',email:'a@example.com',authoritative:true}),{status:409});
 await store.createUser({_id:'external',email:'external@example.com'});await assert.rejects(store.googleUser({sub:'external-sub',email:'external@example.com',authoritative:false}),{status:409});
 const fresh=await store.googleUser({sub:'new-google',email:'new@gmail.com',authoritative:true});assert.equal(fresh.password,undefined);assert.equal(fresh.googleSub,'new-google');
 const {MongoClient}=await import('mongodb');const inspector=new MongoClient(process.env.MONGODB_TEST_URI);await inspector.connect();
 try{
  const db=inspector.db(name);
  await store.createUser({_id:'other',email:'keep@example.com'});await store.saveKitchen('other',0,{note:'keep'});
  await db.collection('accounts').insertMany([{userId:'one',private:'remove'},{userId:'other',private:'keep'}]);
  await db.collection('plan_history').insertMany([{userId:'one',recipeId:'rice'},{userId:'other',recipeId:'rice'}]);
  await store.saveSession({_id:'delete-session',userId:'one',email:'a@example.com',expiresAt:new Date(Date.now()+60000)});
  assert.equal(await store.deleteAccount('one',999),false);assert(await store.userByEmail('a@example.com'));
  const work=await Promise.allSettled([store.deleteAccount('one',1),store.saveKitchen('one',2,{note:'in-flight edit'}),store.saveSession({_id:'racing-session',userId:'one',email:'a@example.com',expiresAt:new Date(Date.now()+60000)})]);
  assert.equal(work[0].status,'fulfilled');assert.equal(work[0].value,true);
  assert.equal(await store.userByEmail('a@example.com'),null);assert.equal(await store.kitchen('one'),null);
  for(const collection of ['sessions','accounts','plan_history'])assert.equal(await db.collection(collection).countDocuments({userId:'one'}),0);
  assert(await store.userByEmail('keep@example.com'));assert.deepEqual((await store.kitchen('other')).data,{note:'keep'});
  assert.equal(await db.collection('accounts').countDocuments({userId:'other'}),1);assert.equal(await db.collection('plan_history').countDocuments({userId:'other'}),1);
  assert.equal(await db.collection('recipes').countDocuments(),420);
  const {catalogueDocuments,seedRecipes}=await import('./recipe-catalogue.mjs');
  const catalogue=catalogueDocuments(),original=catalogue[0],edited=catalogue[1];
  await db.collection('recipes').updateOne({id:original.id},{$set:{nutrition:{complete:false,totals:null},privateNote:'keep this'}});
  await db.collection('recipes').updateOne({id:edited.id},{$set:{'data.items.0.1':999,nutrition:{custom:true}}});
  await seedRecipes(db);
  const refreshed=await db.collection('recipes').findOne({id:original.id});assert.equal(refreshed.nutrition.dataVersion,original.nutrition.dataVersion);assert.deepEqual(refreshed.nutrition.totals,original.nutrition.totals);assert.equal(refreshed.privateNote,'keep this');
  assert.deepEqual((await db.collection('recipes').findOne({id:edited.id})).nutrition,{custom:true});

  // Real MongoDB edits feed the central catalogue; deletion stays deleted after reconnect.
  const {liveCatalogue}=await import('./live-catalogue.mjs');
  const liveDoc=structuredClone(original);liveDoc.id=liveDoc.data.id='central-mongo-test';liveDoc.data.name='Inserted in MongoDB';liveDoc.data.timing=null;liveDoc.privateNote='must stay private';
  await db.collection('recipes').insertOne(liveDoc);
  let snapshot=await liveCatalogue(store);assert(snapshot.recipes.some(r=>r.id==='central-mongo-test'));assert(!JSON.stringify(snapshot).includes('must stay private'));
  const revision=snapshot.revision;
  await db.collection('recipes').updateOne({id:liveDoc.id},{$set:{'data.name':'Edited in MongoDB','data.items.0.1':82,'data.steps.0':'An updated preparation method.'}});
  snapshot=await liveCatalogue(store);assert.notEqual(snapshot.revision,revision);assert.equal(snapshot.recipes.find(r=>r.id===liveDoc.id).items[0][1],82);
  await db.collection('recipes').updateOne({id:liveDoc.id},{$set:{published:false}});assert(!(await liveCatalogue(store)).recipes.some(r=>r.id===liveDoc.id));
  await db.collection('recipes').deleteOne({id:catalogue.at(-1).id});
  await store.close();store=await connectStore(process.env.MONGODB_TEST_URI,name);
  assert.equal(await db.collection('recipes').countDocuments({id:catalogue.at(-1).id}),0,'Do not resurrect deleted seeds on startup');

  const {ingredientSignature,quoteStorePrices}=await import('./store-prices.mjs');
  const {recipeIngredients}=await import('../dist/api.js');const now=Date.now();
  const priceRecord={shop:'Carrefour',city:'Dubai',ingredientId:'rice',ingredientSignature:ingredientSignature(recipeIngredients.rice),locationId:'fixture-zone',locationName:'Fixture branch',productId:'fixture-rice',productName:'Fixture rice',productUrl:'https://www.carrefouruae.com/fixture',packQuantity:500,packLabel:'500 g',quantityBasis:'Fixture dry ingredient weight.',unit:'g',price:7.5,currency:'AED',taxIncluded:true,availability:'in-stock',checkedAt:new Date(now-60000).toISOString(),validUntil:new Date(now+3600000).toISOString(),source:{type:'retailer-page',name:'Fixture source',url:'https://www.carrefouruae.com/fixture'},review:{approved:true,by:'Fixture',at:new Date(now-30000).toISOString()}};
  await db.collection('store_price_records').insertOne(priceRecord);
  assert.equal((await store.storePriceRecords('Carrefour','Dubai',['rice'])).length,1);
  assert.equal((await store.storePriceRecords('LuLu','Dubai',['rice'])).length,0);
  assert.equal((await store.storePriceRecords('Carrefour','Ajman',['rice'])).length,0);
  const recorded=quoteStorePrices({shop:'Carrefour',city:'Dubai',items:[{key:'rice',need:750,unit:'g'}]},await store.storePriceRecords('Carrefour','Dubai',['rice']),recipeIngredients,now);
  assert.equal(recorded.recordedSubtotal,15);assert.equal(recorded.checkoutVerified,false);
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{fileURLToPath}=await import('node:url'),{promisify}=await import('node:util'),{execFile}=await import('node:child_process');
  const folder=await mkdtemp(join(tmpdir(),'mealday-price-import-'));
  try{
    const path=join(folder,'observations.json');const update={...priceRecord,price:8.25,checkedAt:new Date(now-10000).toISOString(),review:{approved:true,by:'Fixture',at:new Date(now-5000).toISOString()},source:{...priceRecord.source,credentials:'fixture-secret'},privateToken:'fixture-secret'};
    await writeFile(path,JSON.stringify([update]));const run=(...args)=>promisify(execFile)(process.execPath,[fileURLToPath(new URL('./import-store-prices.mjs',import.meta.url)),...args],{env:{...process.env,MONGODB_URI:process.env.MONGODB_TEST_URI,MONGODB_DB:name}});
    assert.equal(JSON.parse((await run('--file',path,'--dry-run')).stdout).written,0);
    assert.equal((await store.storePriceRecords('Carrefour','Dubai',['rice']))[0].price,7.5);
    assert.equal(JSON.parse((await run('--file',path)).stdout).written,1);
    const imported=(await store.storePriceRecords('Carrefour','Dubai',['rice']))[0];assert.equal(imported.price,8.25);assert(!JSON.stringify(imported).includes('fixture-secret'));
    assert.equal(JSON.parse((await run('--signature','rice')).stdout).ingredientSignature,priceRecord.ingredientSignature);
  }finally{await rm(folder,{recursive:true,force:true});}


  await assert.rejects(store.saveKitchen('one',0,{note:'must not resurrect'}),{status:401});
  await assert.rejects(store.saveSession({_id:'after-delete',userId:'one',expiresAt:new Date(Date.now()+60000)}),{status:401});
 }finally{await inspector.close();}
 console.log('Real MongoDB integration passed: unique accounts, sessions, expiry, isolation, atomic conflict checks and reconnect persistence.');
}finally{
 await store.close();
 const {MongoClient}=await import('mongodb');const client=new MongoClient(process.env.MONGODB_TEST_URI);
 await client.connect();await client.db(name).dropDatabase();await client.close();
}
