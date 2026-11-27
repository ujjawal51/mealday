// Original Mealday serving suggestions. Times are estimated, not kitchen-tested.
// Quantities are per person and use the catalogue's documented cooked/drained units.
import {publicRecipe} from '../dist/catalogue-schema.js';
import {prepareCompleteMeals} from '../dist/meal-completeness.js';

const roti=['quality-roti',2], pita=['pita',1], oil=['oil',5], cumin=['cumin',1], lemon=['lemon',.25], cucumber=['cucumber',90], tomato=['tomato',100], pepper=['pepper',90], onion=['onion',45], carrot=['carrot',90], yogurt=['yogurt',100], garlic=['emiratiGarlic',3];
const warmRoti='Warm the ready-to-eat roti according to the packet and serve with the main.';
const warmPita='Warm the pita according to the packet and serve alongside.';
const readyRice='Use fully cooked chilled rice stored according to its label. Reheat once until steaming throughout and serve immediately.';
const rows=[];
function add(code,name,time,diet,items,steps,{cuisine='South Asian',mealTypes=['dinner'],appliances=['Hob'],side}={}){
 const id='mealday-quick-'+code;
 rows.push({id,name,time,diet,items,steps,cuisine,mealTypes,appliances,timing:{prepMinutes:5,cookMinutes:time-5,waitMinutes:0,estimated:true},familyId:id,
  authorship:'Original Mealday weeknight adaptation; estimated elapsed time; kitchen testing pending.',
  imageUrl:'/recipe-image-unavailable.svg',reviewStatus:'preview',tags:['Quick'],mealAssemblyVersion:2,componentNames:[name,...(side?[side]:[])],mealComplete:true});
}
add('paneer-bhurji','Paneer bhurji with roti',15,'vegetarian',[['paneer',110],roti,pepper,tomato,onion,oil,cumin],['Dice the vegetables and crumble the paneer. Sauté onion, pepper and cumin in oil until softened.','Add tomato and crumble in the paneer. Cook until hot throughout.',warmRoti]);
add('besan-chilla','Pepper besan chilla with cucumber yogurt',20,'vegetarian',[['besan',75],['semolina',30],pepper,yogurt,cucumber,oil,cumin],['Mix besan, semolina, cumin and finely diced pepper with enough water to make a pourable batter. Stir well.','Brush a hot pan with the measured oil. Spread thin pancakes and cook on both sides until set with no raw batter.','Slice the cucumber and stir it into the yogurt. Serve alongside the chilla.']);
add('rajma-roti','Quick rajma masala with roti',15,'vegan',[['quality-kidney',150],roti,tomato,onion,['spinach',85],oil,cumin],['Rinse and drain canned kidney beans. Sauté finely chopped onion, cumin and tomato in oil until soft.','Add beans, spinach and a splash of water. Simmer until steaming and the spinach has wilted.',warmRoti]);
add('lemon-rice','Lemon rice with green beans and eggs',15,'vegetarian',[['kg-33687560eec7',170],['egg',2],['kg-f370339ada05',100],oil,cumin,lemon],['Slice the green beans and pan-cook with cumin in the measured oil until tender. Push aside and scramble the eggs until fully set.',readyRice,'Fold the hot rice into the beans and eggs and finish with lemon.']);
add('blackeye-appam','Pepper black-eyed bean roast with rice appam',15,'vegan',[['target-blackeye',150],['target-desi-appam',130],pepper,onion,oil,cumin],['Drain and rinse the canned black-eyed beans. Stir-fry the diced pepper and onion with cumin and oil until they soften.','Add the beans and stir over heat until steaming. Heat the ready-to-eat appam as directed on its packet and serve.']);
add('tuna-hoppers','Lemon tuna and carrot stir-fry with rice hoppers',15,'fish',[['tuna',105],['target-desi-hoppers',150],carrot,onion,oil,cumin,lemon],['Grate the carrot, slice the onion and drain the tuna. Sauté the vegetables with oil and cumin until tender.','Fold in the tuna and heat through. Warm the ready-cooked string hoppers according to the pack and finish the plate with lemon.']);
add('lentil-puttu','Tomato brown lentils with coconut puttu',15,'vegan',[['quality-cooked-lentils',150],['target-desi-puttu',150],tomato,onion,oil,cumin],['Rinse and drain the canned lentils. Sauté finely chopped onion and cumin in oil, then add tomato and cook until it softens.','Add the lentils and a splash of water and simmer until hot. Warm the ready-to-eat puttu as directed and serve.']);
add('spinach-egg-roti','Palak egg scramble with roti',15,'vegetarian',[['egg',2],['spinach',100],roti,onion,oil,cumin],['Wash and chop the spinach; finely dice the onion. Sauté the onion and cumin, then wilt the spinach.','Beat in the eggs and stir over heat until the eggs are set throughout.',warmRoti]);
add('dahi-poha','Cucumber dahi poha with spiced corn',15,'vegetarian',[['poha',65],yogurt,cucumber,['target-corn',65],oil,cumin],['Prepare the poha according to the packet, then drain well.','Warm drained canned corn with the measured oil and cumin until hot. Dice the cucumber.','Mix the prepared poha, cucumber and chilled yogurt and serve with the corn immediately.']);
add('fava-vermicelli','Cumin fava and carrot semiya',20,'vegan',[['vermicelli',70],['fava',130],carrot,pepper,oil,cumin],['Cook the vermicelli according to the packet and drain.','In the oil, sauté grated carrot and diced pepper with cumin until tender. Add the cooked fava and heat through.','Toss in the cooked vermicelli and serve hot.']);
add('pepper-chicken-roll','Lemon pepper chicken roti rolls',20,'meat',[['chicken',130],roti,pepper,cucumber,oil,lemon,cumin],['Wash and slice the vegetables; keep raw chicken and its utensils separate. Thinly slice the chicken and stir-fry in oil with cumin until its thickest piece reaches 75°C.','Add the pepper and cook until tender. Warm the roti according to the packet.', 'Fill each roti with the hot chicken and pepper, sliced cucumber and lemon.']);
add('tawa-masala-corn-potato','Tawa potato and masala corn with roti and dahi',20,'vegetarian',[['potato',170],['target-corn',80],roti,yogurt,tomato,oil,cumin],['Dice the potatoes small and simmer in water until tender; drain.','Toss the potatoes, drained corn, chopped tomato and cumin in the measured oil until hot.','Warm the roti according to the pack and serve with yogurt.']);
const tr={cuisine:'Turkish',mealTypes:['lunch','dinner']};
add('turkish-menemen','Menemen with warm bread',20,'vegetarian',[['egg',2],pepper,tomato,['bread',2],oil,onion],['Sauté finely diced onion and pepper in the oil. Add chopped tomato and simmer until thickened.','Stir in beaten eggs and cook until the eggs have set. Serve with bread.'],tr);
add('turkish-piyaz','White bean piyaz with pita',15,'vegan',[['quality-whitebeans',155],tomato,cucumber,onion,parsley(),lemon,oil,pita],['Drain and rinse the white beans. Dice the tomato and cucumber and thinly slice the onion.','Toss the beans and vegetables with washed parsley, lemon and oil. Serve immediately with pita.'],{...tr,appliances:[]});
add('turkish-bulgur','Tomato bulgur pilaf with chickpeas',30,'vegan',[['bulgur',65],['chickpeas',115],tomato,pepper,onion,oil],['Sauté the diced onion and pepper in oil, then stir in chopped tomato.','Add the bulgur and water according to the packet. Simmer until tender.','Fold in the rinsed, drained chickpeas and heat until steaming throughout.'],tr);
add('turkish-patlican','Aubergine and yogurt pita plate',25,'vegetarian',[['eggplant',160],yogurt,pita,garlic,oil,tomato],['Dice the aubergine and cook in oil, stirring, until tender throughout. Dice the tomato.','Stir grated garlic into the yogurt. Serve the aubergine and tomato with the yogurt and warm pita.'],tr);
add('turkish-tavuk','Turkish-style chicken sauté with pita',25,'meat',[['chicken',130],pita,pepper,tomato,onion,oil,lemon],['Dice the vegetables separately from the raw chicken. Cut the chicken into small pieces and cook in oil until the thickest piece reaches 75°C.','Add onion, pepper and tomato and simmer until tender. Finish with lemon.',warmPita],tr);
add('turkish-fava','Turkish-style lemon fava spread with pita',20,'vegan',[['fava',155],pita,cucumber,carrot,oil,lemon,parsley()],['Drain the cooked fava beans. Simmer with a splash of water until hot, then mash with lemon and olive oil.','Wash and cut the cucumber, carrot and parsley. Serve the fava spread warm with pita and vegetables.'],tr);
function parsley(){return ['parsley',8];}
export function dinnerCoverageDocuments(stock){
 return rows.map(data=>{
  const ingredients=Object.fromEntries(data.items.map(([id])=>[id,stock[id]]));
  const doc={id:data.id,name:data.name,cuisine:data.cuisine,published:true,data,ingredients,importSource:'mealday-dinner-coverage-v1'};
  const parsed=publicRecipe(doc);
  const meal=parsed&&prepareCompleteMeals([parsed.data],stock)[0];
  if(!meal?.mealComplete||meal.time!==data.time)throw Error('Invalid quick dinner: '+data.id);
  return doc;
 });
}
export async function installDinnerCoverage(db,loadSnapshot){
 const markers=db.collection('catalogue_metadata'),key='dinner-coverage-v1';
 if(await markers.findOne({_id:key}))return;
 const stock=(await loadSnapshot()).ingredients,collection=db.collection('recipes'),docs=dinnerCoverageDocuments(stock);
 await collection.createIndex({id:1},{unique:true});
 const now=new Date().toISOString();
 await collection.bulkWrite(docs.map(doc=>({updateOne:{filter:{id:doc.id},update:{$setOnInsert:{...doc,importedAt:now,updatedAt:now}},upsert:true}})));
 // The same dishes are valid at multiple mealtimes. Rename only unedited, known originals.
 const titleFixes=[
 [
  "coverage-ar-protein-0",
  "Chicken Tomato Breakfast Pita"
 ],
 [
  "coverage-ar-protein-5",
  "Tuna Chickpea Breakfast Toast + Cucumber side + Arabic pita"
 ],
 [
  "coverage-desi-protein-1",
  "Palak Chicken Breakfast Toast"
 ],
 [
  "coverage-desi-protein-3",
  "Keema Aloo Breakfast Toast"
 ],
 [
  "coverage-desi-protein-5",
  "Tuna Chana Breakfast Toast + Cucumber side"
 ],
 [
  "coverage-em-protein-3",
  "Beef Potato Breakfast Hash + Regag bread"
 ],
 [
  "coverage-em-protein-5",
  "Tuna Dango Breakfast Plate + Cucumber side + Regag bread"
 ],
 [
  "target-ar-bissara",
  "Fava Bissara Breakfast with Pita + Cucumber side"
 ],
 [
  "target-ar-chicken-harira",
  "Chicken Harira Breakfast Bowl"
 ],
 [
  "target-em-beef-barley-soup-complete",
  "Beef & Barley-Flake Breakfast Soup + Rice + Cucumber"
 ],
 [
  "target-em-chicken-date-flatcakes",
  "Chicken & Date Besan Breakfast Flatcakes + Rice + Cucumber side"
 ],
 [
  "target-em-chicken-semolina",
  "Saffron Chicken Semolina Breakfast Porridge"
 ],
 [
  "target-em-fish-potatocakes-complete",
  "Loomi Fish & Potato Breakfast Cakes + Rice + Cucumber"
 ],
 [
  "target-em-lamb-arayes",
  "Bzar Lamb-Stuffed Breakfast Regag bread"
 ],
 [
  "target-em-liver-regag",
  "Bzar Liver & Onion Breakfast Regag"
 ],
 [
  "target-em-mackerel-ricecakes",
  "Mackerel & Saffron Rice Breakfast Cakes + Cucumber side"
 ],
 [
  "target-em-shrimp-eggs",
  "Shrimp & Tomato Breakfast Scramble with Regag"
 ],
 [
  "target-em-tuna-oat-pancakes",
  "Tuna & Corn Oat Breakfast Pancakes + Cucumber side"
 ]
];
 const clean=name=>name.replace(/\bBreakfast +/i,'');
 await Promise.all(titleFixes.map(async([id,original])=>{
  const row=await collection.findOne({id,published:true,'data.name':{$eq:original}});
  if(!row)return;
  const title=clean(row.data.name),parts=row.data.componentNames?.map(clean);
  await collection.updateOne({_id:row._id,'data.name':row.data.name},{$set:{name:title,'data.name':title,...(parts?{'data.componentNames':parts}:{}),updatedAt:now}});
 }));
 await markers.updateOne({_id:key},{$setOnInsert:{createdAt:now}},{upsert:true});
}
