import {seedRecipes} from './recipe-catalogue.mjs';
export async function connectStore(uri,dbName){
  const {MongoClient}=await import('mongodb');
  const client=new MongoClient(uri,{maxPoolSize:10,serverSelectionTimeoutMS:5000});
  await client.connect();const db=client.db(dbName);await db.command({ping:1});
  try{const result=await seedRecipes(db);console.log(`Recipe catalogue: ${result.present} available, ${result.inserted} imported, ${result.existing} already present.`);}catch(error){await client.close();throw error;}
  const users=db.collection('users'),sessions=db.collection('sessions'),kitchens=db.collection('kitchens');
  await Promise.all([users.createIndex({email:1},{unique:true}),sessions.createIndex({expiresAt:1},{expireAfterSeconds:0})]);
  return {
    close:()=>client.close(),
    userByEmail:email=>users.findOne({email}),
    async createUser(user){try{await users.insertOne(user);return true;}catch(e){if(e.code===11000)return false;throw e;}},
    // A hashed token also satisfies the earlier root app's unique token index.
    saveSession:session=>sessions.insertOne({...session,token:session._id}),
    session:id=>sessions.findOne({_id:id,expiresAt:{$gt:new Date()}}),
    deleteSession:id=>sessions.deleteOne({_id:id}),
    kitchen:userId=>kitchens.findOne({_id:userId}),
    async saveKitchen(userId,revision,data){
      const value={data,revision:revision+1,updatedAt:new Date().toISOString()};
      if(revision===0){try{await kitchens.insertOne({_id:userId,...value});return value;}catch(e){if(e.code===11000)return null;throw e;}}
      const result=await kitchens.updateOne({_id:userId,revision},{$set:value});return result.matchedCount?value:null;
    }
  };
}
