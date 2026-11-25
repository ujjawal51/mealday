import {randomUUID} from 'node:crypto';
import {seedRecipes} from './recipe-catalogue.mjs';
export async function connectStore(uri,dbName){
  const {MongoClient}=await import('mongodb');
  const client=new MongoClient(uri,{maxPoolSize:10,serverSelectionTimeoutMS:5000});
  await client.connect();const db=client.db(dbName);await db.command({ping:1});
  const hello=await db.command({hello:1}),transactions=!!(hello.setName||hello.msg==='isdbgrid');
  try{
    const markers=db.collection('catalogue_metadata');
    if(!await markers.findOne({_id:'initial-import'})){
      if(!await db.collection('recipes').countDocuments({},{limit:1}))await seedRecipes(db);
      await markers.updateOne({_id:'initial-import'},{$setOnInsert:{createdAt:new Date().toISOString()}},{upsert:true});
    }
  }catch(error){await client.close();throw error;}
  const users=db.collection('users'),sessions=db.collection('sessions'),kitchens=db.collection('kitchens'),googleChallenges=db.collection('google_challenges');
  await Promise.all([users.createIndex({email:1},{unique:true}),sessions.createIndex({expiresAt:1},{expireAfterSeconds:0}),users.createIndex({googleSub:1},{unique:true,sparse:true}),googleChallenges.createIndex({expiresAt:1},{expireAfterSeconds:0})]);
  return {
    close:()=>client.close(),
    ping:()=>db.command({ping:1}),
    async saveFeedback(submission){
      const inbox=db.collection('feedback_submissions');
      try{
        await inbox.insertOne({...submission,createdAt:new Date(),status:'new'},{writeConcern:{w:'majority'}});
        return true;
      }catch(error){
        if(error.code!==11000)throw error;
        const previous=await inbox.findOne({_id:submission._id},{readConcern:{level:'majority'}});
        if(!previous)throw error;
        return Object.entries(submission).every(([key,value])=>previous[key]===value);
      }
    },
    async reservePriceCredits(day,cost,limit){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isInteger(cost)||cost<1||!Number.isInteger(limit)||limit<cost)return false;
      const usage=db.collection('price_api_usage'),id='reef:'+day;
      try{await usage.updateOne({_id:id},{$setOnInsert:{spent:0}},{upsert:true});}catch(error){if(error.code!==11000)throw error;}
      return (await usage.updateOne({_id:id,spent:{$lte:limit-cost}},{$inc:{spent:cost}})).modifiedCount===1;
    },
    storePriceRecords:(shop,city,keys)=>db.collection('store_price_records').find({shop,city,ingredientId:{$in:keys}},{projection:{_id:0}}).limit(2001).toArray(),
    publishedRecipes:()=>db.collection('recipes').find({published:true},{projection:{_id:0,id:1,data:1,ingredients:1,photo:1,published:1}}).sort({id:1}).limit(2001).toArray(),
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
    issueGoogleChallenge:challenge=>googleChallenges.insertOne(challenge),
    consumeGoogleChallenge:(hash,at)=>googleChallenges.findOneAndDelete({_id:hash,expiresAt:{$gt:at}}),
    markGoogleReauthenticated:(id,at)=>sessions.updateOne({_id:id},{$set:{deleteVerifiedAt:at}}),
    async googleUser({sub,email,authoritative},{allowRegistration=true}={}){
      if(!transactions)throw Object.assign(Error('Google sign-in requires a MongoDB replica set.'),{status:503});
      return client.withSession(session=>session.withTransaction(async()=>{
        let user=await users.findOne({googleSub:sub},{session});
        if(user){
          if(user.email!==email){
            if(await users.findOne({email},{session}))throw Object.assign(Error('This Google email is already linked to another account.'),{status:409});
            await users.updateOne({_id:user._id},{$set:{email}},{session});user={...user,email};
          }
          return user;
        }
        user=await users.findOne({email},{session});
        if(user){
          if(user.googleSub||!authoritative)throw Object.assign(Error('This existing account cannot be linked automatically. Your saved data has been kept.'),{status:409});
          const version=(user.authVersion||0)+1;
          await users.updateOne({_id:user._id},{$set:{googleSub:sub,emailVerifiedAt:new Date().toISOString(),authVersion:version},$unset:{password:'',passwordHash:'',salt:'',verificationRequired:'',resetEmailHash:'',resetEmailExpiresAt:'',verifyEmailHash:'',verifyEmailExpiresAt:''}},{session});
          await sessions.deleteMany({userId:user._id},{session});
          return {...user,googleSub:sub,authVersion:version};
        }
        if(!allowRegistration)throw Object.assign(Error('New accounts are not enabled.'),{status:403});
        user={_id:randomUUID(),email,googleSub:sub,emailVerifiedAt:new Date().toISOString(),createdAt:new Date().toISOString(),authVersion:0};
        await users.insertOne(user,{session});return user;
      }));
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
        await googleChallenges.deleteMany({userId},{session});
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
