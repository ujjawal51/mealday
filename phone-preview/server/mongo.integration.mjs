// Uses a real disposable MongoDB database; requires an explicitly supplied test URI.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connectStore} from './mongo-store.mjs';
if(!process.env.MONGODB_TEST_URI)throw Error('Set MONGODB_TEST_URI to a disposable MongoDB instance.');
const name='mealday_test_'+randomUUID().replaceAll('-','');
let store=await connectStore(process.env.MONGODB_TEST_URI,name);
try{
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

  await assert.rejects(store.saveKitchen('one',0,{note:'must not resurrect'}),{status:401});
  await assert.rejects(store.saveSession({_id:'after-delete',userId:'one',expiresAt:new Date(Date.now()+60000)}),{status:401});
 }finally{await inspector.close();}
 console.log('Real MongoDB integration passed: unique accounts, sessions, expiry, isolation, atomic conflict checks and reconnect persistence.');
}finally{
 await store.close();
 const {MongoClient}=await import('mongodb');const client=new MongoClient(process.env.MONGODB_TEST_URI);
 await client.connect();await client.db(name).dropDatabase();await client.close();
}
