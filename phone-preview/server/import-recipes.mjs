import {catalogueDocuments,seedRecipes} from './recipe-catalogue.mjs';
if(process.argv.includes('--dry-run')){
 const docs=catalogueDocuments();
 console.log(JSON.stringify({dryRun:true,recipes:docs.length,nutritionComplete:docs.filter(r=>r.nutrition.complete).length,photos:docs.filter(r=>r.photo.status!=='missing').length,missingPhotos:docs.filter(r=>r.photo.status==='missing').length}));
}else{
 let client;
 try{
  const uri=process.env.MONGODB_URI;
  if(!uri)throw Error('Set MONGODB_URI in .env before importing.');
  const {MongoClient}=await import('mongodb');client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
  await client.connect();const db=client.db(process.env.MONGODB_DB||'mealday');await db.command({ping:1});
  const result=await seedRecipes(db);
  console.log(JSON.stringify({database:db.databaseName,collection:'recipes',...result}));
 }catch(error){
  console.error('Recipe import failed. Check MongoDB connection, write access and unique recipe IDs. Existing data is preserved; retry after fixing the issue.');
  process.exitCode=1;
 }finally{await client?.close();}
}
