import {seedRecipes} from './recipe-catalogue.mjs';
export async function connectStore(uri,dbName){
  const {MongoClient}=await import('mongodb');
  const client=new MongoClient(uri,{maxPoolSize:10,serverSelectionTimeoutMS:5000});
  await client.connect();const db=client.db(dbName);await db.command({ping:1});
  const hello=await db.command({hello:1}),transactions=!!(hello.setName||hello.msg==='isdbgrid');
  try{const result=await seedRecipes(db);console.log(`Recipe catalogue: ${result.present} available, ${result.inserted} imported, ${result.existing} already present.`);}catch(error){await client.close();throw error;}
  const users=db.collection('users'),sessions=db.collection('sessions'),kitchens=db.collection('kitchens');
  await Promise.all([users.createIndex({email:1},{unique:true}),sessions.createIndex({expiresAt:1},{expireAfterSeconds:0}),users.createIndex({resetEmailHash:1},{sparse:true}),users.createIndex({verifyEmailHash:1},{sparse:true})]);
  return {
    close:()=>client.close(),
    ping:()=>db.command({ping:1}),
    userByEmail:email=>users.findOne({email}),
    async createUser(user){try{await users.insertOne(user);return true;}catch(e){if(e.code===11000)return false;throw e;}},
    // A hashed token also satisfies the earlier root app's unique token index.
    saveSession:record=>transactions?client.withSession(session=>session.withTransaction(async()=>{
      const owner=await users.updateOne({_id:record.userId},{$inc:{accountWriteVersion:1}},{session});
      if(!owner.matchedCount)throw Object.assign(Error('This account is no longer available.'),{status:401});
      await sessions.insertOne({...record,token:record._id},{session});
    })):sessions.insertOne({...record,token:record._id}),
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
    async deleteAccount(userId,authVersion){
      if(!transactions)throw Object.assign(Error('Account deletion requires a MongoDB replica set. Contact the service administrator.'),{status:503});
      return client.withSession(session=>session.withTransaction(async()=>{
        const user=await users.findOne({_id:userId},{session});
        if(!user||(user.authVersion||0)!==authVersion)return false;
        await users.deleteOne({_id:userId},{session});
        await kitchens.deleteMany({_id:userId},{session});
        await sessions.deleteMany({userId},{session});
        await db.collection('accounts').deleteMany({userId},{session});
        await db.collection('plan_history').deleteMany({userId},{session});
        return true;
      }));
    },
    async saveKitchen(userId,revision,data){
      if(transactions)return client.withSession(session=>session.withTransaction(async()=>{
        const owner=await users.updateOne({_id:userId},{$inc:{accountWriteVersion:1}},{session});
        if(!owner.matchedCount)throw Object.assign(Error('This account is no longer available.'),{status:401});
        const old=await kitchens.findOne({_id:userId},{session});
        if((old?.revision||0)!==revision)return null;
        const value={data,revision:revision+1,updatedAt:new Date().toISOString()};
        if(!old)await kitchens.insertOne({_id:userId,...value},{session});
        else await kitchens.updateOne({_id:userId,revision},{$set:value},{session});
        return value;
      }));
      const value={data,revision:revision+1,updatedAt:new Date().toISOString()};
      if(revision===0){try{await kitchens.insertOne({_id:userId,...value});return value;}catch(e){if(e.code===11000)return null;throw e;}}
      const result=await kitchens.updateOne({_id:userId,revision},{$set:value});return result.matchedCount?value:null;
    }
  };
}
