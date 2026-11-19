import assert from 'node:assert/strict';
import {filterSavedRecipes} from '../dist/recipe-filters.js';
import {api} from '../dist/api.js';
async function get(query){const url=new URL('/api/recipes?'+new URLSearchParams(query),'https://mealday.test');return (await api(new Request(url),url)).json();}
const catalogue=[];
for(let offset=0;;offset+=18){const page=await get({offset});catalogue.push(...page.recipes);if(page.next===null)break;}
assert.equal(catalogue.length,402);
const original=structuredClone(catalogue);
let cases=0;
for(const q of ['',' rice ','LENTIL','zz-no-match-zz'])for(const cuisine of ['','Emirati','Arab','South Asian','Turkish'])for(const diet of ['','Vegan','Vegetarian','Pescatarian','Non-vegetarian']){
 const filters={q,cuisine,diet};const actual=filterSavedRecipes(catalogue,filters),expected=await get(filters);
 assert.equal(actual.length,expected.count,JSON.stringify(filters));
 assert.deepEqual(actual.slice(0,18),expected.recipes,JSON.stringify(filters));cases++;
}
assert.deepEqual(catalogue,original,'Search must not remove saved recipes');
assert.deepEqual(filterSavedRecipes([],{}),[]);
const subset=catalogue.slice(0,7);
assert(filterSavedRecipes(subset,{q:'rice'}).every(r=>subset.includes(r)),'Saved search must not leak unsaved recipes');
assert.deepEqual(filterSavedRecipes(subset,{}),subset,'Clearing filters restores all saved meals');
console.log(`${cases} search/cuisine/diet combinations match the library API; saved lists stay intact.`);
