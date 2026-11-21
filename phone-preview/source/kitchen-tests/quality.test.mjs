import assert from 'node:assert/strict';
import test from 'node:test';
import {recipeVersion,validateCook,kitchenStatus,structuralIssues} from '../../scripts/recipe-quality.mjs';
const ingredients={rice:{name:'Dry rice',unit:'g'}};
const recipe={id:'test',name:'Rice',time:25,timing:{prepMinutes:5,cookMinutes:20,waitMinutes:0},appliances:['Hob'],items:[['rice',70]],steps:['Rinse the measured rice.','Cook according to packet instructions.']};
const version=recipeVersion(recipe,ingredients);
// Synthetic unit fixtures, never written to the real kitchen evidence records.
const cook=(id,day)=>({id,recipeId:'test',recipeVersion:version,tester:'Fixture tester',cookedAt:`2026-01-0${day}T12:00:00Z`,servings:2,prepMinutes:5,cookMinutes:20,waitMinutes:0,yieldGrams:400,tasteScore:4,quantitiesWork:true,methodWorks:true,timeWorks:true,observations:'Fixture observation of quantities, texture, taste and actual timing.',evidence:`evidence/${id}.jpg`,evidenceSha256:id.repeat(64)});
const one=cook('a',1),two=cook('b',2),hashes={[one.evidence]:one.evidenceSha256,[two.evidence]:two.evidenceSha256};
test('metadata flags and personal feedback cannot verify a recipe',()=>{
 assert.equal(kitchenStatus({...recipe,qualityReview:{kitchenTested:true},rating:5},ingredients,[],{}).status,'kitchen-test-pending');
 assert.equal(kitchenStatus(recipe,ingredients,[one],hashes).status,'kitchen-test-pending');
});
test('two distinct successful current cooks are required; later failures revoke status',()=>{
 assert.equal(kitchenStatus(recipe,ingredients,[one,two],hashes).status,'kitchen-tested');
 assert.equal(kitchenStatus(recipe,ingredients,[one,{...two,tasteScore:2}],hashes).status,'kitchen-test-pending');
 assert.equal(kitchenStatus(recipe,ingredients,[one,{...two,timeWorks:false}],hashes).status,'kitchen-test-pending');
 assert.equal(kitchenStatus(recipe,ingredients,[one,{...two,evidenceSha256:one.evidenceSha256}],hashes).status,'kitchen-test-pending');
 assert.equal(kitchenStatus(recipe,ingredients,[one,{...two,cookedAt:one.cookedAt}],hashes).status,'kitchen-test-pending');
 const failed={...cook('c',3),methodWorks:false};assert.equal(kitchenStatus(recipe,ingredients,[one,two,failed],{...hashes,[failed.evidence]:failed.evidenceSha256}).status,'kitchen-test-pending');
});
test('ingredients, amounts, method, timing and equipment edits invalidate evidence',()=>{
 for(const changed of [{...recipe,items:[['rice',90]]},{...recipe,steps:['Use a different method.','Serve the rice.']},{...recipe,time:30},{...recipe,appliances:['Oven']},{...recipe,quantityNotes:['Use cooked rice']}]){
  assert.notEqual(recipeVersion(changed,ingredients),version);
  assert.equal(kitchenStatus(changed,ingredients,[one,two],hashes).status,'kitchen-test-pending');
 }
 assert.notEqual(recipeVersion(recipe,{rice:{name:'Cooked rice',unit:'g'}}),version);
});
test('incomplete forms, missing evidence, nonfinite values and future dates fail closed',()=>{
 assert.deepEqual(validateCook(one,{recipe,ingredients,evidenceHash:one.evidenceSha256}).errors,[]);
 for(const patch of [{cookedAt:null},{cookedAt:'2099-01-01T12:00:00Z'},{tester:null},{servings:0},{yieldGrams:0},{prepMinutes:NaN},{waitMinutes:-1},{tasteScore:0},{quantitiesWork:null},{observations:''},{evidenceSha256:null}]){
  assert(validateCook({...one,...patch},{recipe,ingredients,evidenceHash:one.evidenceSha256}).errors.length,JSON.stringify(patch));
 }
 assert(validateCook(one,{recipe,ingredients,evidenceHash:'different'}).errors.length);
});
test('structural checks reject unknown units, invalid quantities, incomplete methods and mismatched timings',()=>{
 assert.deepEqual(structuralIssues(recipe,ingredients),[]);
 for(const changed of [{...recipe,items:[['unknown',2]]},{...recipe,items:[['rice',Infinity]]},{...recipe,items:[['rice',0]]},{...recipe,steps:['Mix']},{...recipe,time:5},{...recipe,timing:{prepMinutes:1,cookMinutes:-2,waitMinutes:26}}])assert(structuralIssues(changed,ingredients).length);
});
