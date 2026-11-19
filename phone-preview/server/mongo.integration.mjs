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
 console.log('Real MongoDB integration passed: unique accounts, sessions, expiry, isolation, atomic conflict checks and reconnect persistence.');
}finally{
 await store.close();
 const {MongoClient}=await import('mongodb');const client=new MongoClient(process.env.MONGODB_TEST_URI);
 await client.connect();await client.db(name).dropDatabase();await client.close();
}
