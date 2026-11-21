import {seedRecipes} from './recipe-catalogue.mjs';
export async function connectStore(uri,dbName){
  const {MongoClient}=await import('mongodb');
  const client=new MongoClient(uri,{maxPoolSize:10,serverSelectionTimeoutMS:5000});
  await client.connect();const db=client.db(dbName);await db.command({ping:1});
  try{const result=await seedRecipes(db);console.log(`Recipe catalogue: ${result.present} available, ${result.inserted} imported, ${result.existing} already present.`);}catch(error){await client.close();throw error;}
  const users=db.collection('users'),sessions=db.collection('sessions'),kitchens=db.collection('kitchens');
  await Promise.all([users.createIndex({email:1},{unique:true}),sessions.createIndex({expiresAt:1},{expireAfterSeconds:0}),users.createIndex({resetEmailHash:1},{sparse:true}),users.createIndex({verifyEmailHash:1},{sparse:true})]);
  return {
    close:()=>client.close(),
    ping:()=>db.command({ping:1}),
    userByEmail:email=>users.findOne({email}),
    async createUser(user){try{await users.insertOne(user);return true;}catch(e){if(e.code===11000)return false;throw e;}},
    // A hashed token also satisfies the earlier root app's unique token index.
    saveSession:session=>sessions.insertOne({...session,token:session._id}),
    session:id=>sessions.findOne({_id:id,expiresAt:{$gt:new Date()}}),
    deleteSession:id=>sessions.deleteOne({_id:id}),
    async issueEmailToken(userId,purpose,hash,expiresAt,at){
      const prefix=purpose==='reset'?'resetEmail':'verifyEmail',last=prefix+'SentAt';
      const result=await users.updateOne({_id:userId,$or:[{[last]:{$exists:false}},{[last]:{$lte:new Date(at.getTime()-60000)}}]},{$set:{[prefix+'Hash']:hash,[prefix+'ExpiresAt']:expiresAt,[last]:at}});
      return result.modifiedCount===1;
    },
    cancelEmailToken:(userId,purpose,hash)=>{
      const prefix=purpose==='reset'?'resetEmail':'verifyEmail';
      return users.updateOne({_id:userId,[prefix+'Hash']:hash},{$unset:{[prefix+'Hash']:'',[prefix+'ExpiresAt']:'',[prefix+'SentAt']:''}});
    },
    async consumeEmailToken(purpose,hash,at,password){
      const prefix=purpose==='reset'?'resetEmail':'verifyEmail';
      const update={$set:{emailVerifiedAt:at.toISOString()},$unset:{[prefix+'Hash']:'',[prefix+'ExpiresAt']:''}};
      if(purpose==='reset'){
        update.$set.password=password;update.$set.passwordChangedAt=at.toISOString();
        update.$inc={authVersion:1};
        Object.assign(update.$unset,{passwordHash:'',salt:'',verifyEmailHash:'',verifyEmailExpiresAt:''});
      }
      const user=await users.findOneAndUpdate({[prefix+'Hash']:hash,[prefix+'ExpiresAt']:{$gt:at}},update,{returnDocument:'after'});
      if(user&&purpose==='reset')await sessions.deleteMany({userId:user._id});
      return user;
    },
    kitchen:userId=>kitchens.findOne({_id:userId}),
    async saveKitchen(userId,revision,data){
      const value={data,revision:revision+1,updatedAt:new Date().toISOString()};
      if(revision===0){try{await kitchens.insertOne({_id:userId,...value});return value;}catch(e){if(e.code===11000)return null;throw e;}}
      const result=await kitchens.updateOne({_id:userId,revision},{$set:value});return result.matchedCount?value:null;
    }
  };
}
