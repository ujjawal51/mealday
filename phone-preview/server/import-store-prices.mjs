// Import reviewed observations only; this command does not manufacture live retailer data.
import {readFile} from 'node:fs/promises';
import {validateOffer,ingredientSignature} from './store-prices.mjs';
import {liveCatalogue} from './live-catalogue.mjs';
const path=process.argv[process.argv.indexOf('--file')+1];
const signatureId=process.argv.includes('--signature')?process.argv[process.argv.indexOf('--signature')+1]:null;
if((!process.argv.includes('--file')||!path)&&!signatureId)throw Error('Pass --file PATH.json, or --signature INGREDIENT_ID; use --dry-run to validate without writes.');
if(!process.env.MONGODB_URI)throw Error('Configure MONGODB_URI privately. Do not paste credentials in chat.');
const {MongoClient}=await import('mongodb');const client=new MongoClient(process.env.MONGODB_URI);
try{
 await client.connect();const db=client.db(process.env.MONGODB_DB||'mealday');
 const snapshot=await liveCatalogue({publishedRecipes:()=>db.collection('recipes').find({published:true},{projection:{_id:0,id:1,data:1,ingredients:1,photo:1,published:1}}).limit(2001).toArray()});
 if(signatureId){const i=snapshot.ingredients[signatureId];if(!i)throw Error('Unknown ingredient ID.');console.log(JSON.stringify({ingredientId:signatureId,ingredient:i,ingredientSignature:ingredientSignature(i)}));}
 else{
 const records=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(records)||records.length>2000)throw Error('Expected an array of at most 2000 observations.');
 const seen=new Set();
 for(const [index,r] of records.entries()){
  const errors=validateOffer(r,snapshot.ingredients[r.ingredientId]);if(errors.length)throw Error('Record '+index+': '+errors.join(' '));
  const key=JSON.stringify([r.shop,r.city,r.locationId,r.productId,r.ingredientId]);if(seen.has(key))throw Error('Duplicate SKU match in input.');seen.add(key);
 }
 if(process.argv.includes('--dry-run')){console.log(JSON.stringify({valid:records.length,written:0}));}
 else{
  const collection=db.collection('store_price_records');await collection.createIndex({shop:1,city:1,locationId:1,productId:1,ingredientId:1},{unique:true});
  let written=0,skipped=0;
  for(const r of records){
   const key={shop:r.shop,city:r.city,locationId:r.locationId,productId:r.productId,ingredientId:r.ingredientId};const old=await collection.findOne(key);
   if(old&&Date.parse(old.checkedAt)>Date.parse(r.checkedAt)){skipped++;continue;}
   // Persist only the defined observation fields, never arbitrary provider credentials or private payloads.
   const fields=['ingredientSignature','productName','productUrl','packQuantity','packLabel','quantityBasis','unit','price','currency','taxIncluded','availability','stockPacks','checkedAt','validUntil','source','review','locationName'];
   const data={...key,...Object.fromEntries(fields.filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))};
   data.source={type:r.source.type,name:r.source.name,url:r.source.url};data.review={approved:true,by:r.review.by,at:r.review.at};
   if(old){const result=await collection.replaceOne({...key,checkedAt:old.checkedAt},data);if(result.matchedCount)written++;else skipped++;}
   else{try{await collection.insertOne(data);written++;}catch(error){if(error.code===11000)skipped++;else throw error;}}
  }
  console.log(JSON.stringify({written,skippedOlder:skipped}));
 }
 }
}finally{await client.close();}
