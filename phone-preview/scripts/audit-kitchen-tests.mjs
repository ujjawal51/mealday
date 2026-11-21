import {readFile,writeFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {recipeCatalogue,recipeIngredients} from '../dist/api.js';
import {recipeVersion,structuralIssues,validateCook,kitchenStatus} from './recipe-quality.mjs';
const root=fileURLToPath(new URL('../source/kitchen-tests/',import.meta.url));
const records=JSON.parse(await readFile(resolve(root,'records.json'),'utf8'));
const hashes={},ids=new Set();
for(const record of records){
 if(ids.has(record.id))throw Error('Duplicate cook test ID: '+record.id);ids.add(record.id);
 const recipe=recipeCatalogue.get(record.recipeId);if(!recipe)throw Error('Unknown recipe: '+record.recipeId);
 const evidence=await realpath(resolve(root,record.evidence||''));
 if(!evidence.startsWith(resolve(root,'evidence')+sep))throw Error('Evidence must be inside kitchen-tests/evidence');
 const bytes=await readFile(evidence);if(!bytes.length)throw Error('Empty evidence');
 hashes[record.evidence]=createHash('sha256').update(bytes).digest('hex');
 // Historical evidence remains on record after edits; it cannot validate the current recipe.
 if(record.recipeVersion===recipeVersion(recipe,recipeIngredients)){
  const result=validateCook(record,{recipe,ingredients:recipeIngredients,evidenceHash:hashes[record.evidence]});
  if(result.errors.length)throw Error(record.id+': '+result.errors.join('; '));
 }
}
const templateId=process.argv.indexOf('--template');
if(templateId>=0){const recipe=recipeCatalogue.get(process.argv[templateId+1]);if(!recipe)throw Error('Pass an existing recipe ID after --template');console.log(JSON.stringify({id:null,recipeId:recipe.id,recipeVersion:recipeVersion(recipe,recipeIngredients),tester:null,cookedAt:null,servings:null,prepMinutes:null,cookMinutes:null,waitMinutes:null,yieldGrams:null,tasteScore:null,quantitiesWork:null,methodWorks:null,timeWorks:null,observations:'',evidence:'evidence/REPLACE-WITH-ACTUAL-COOK-PHOTO.jpg',evidenceSha256:null},null,2));process.exit(0);}
const recipes=[...recipeCatalogue.values()].map(r=>({id:r.id,name:r.name,...kitchenStatus(r,recipeIngredients,records,hashes),deskReviewed:r.qualityReview?.status==='desk-reviewed',estimatedMinutes:r.time,structuralIssues:structuralIssues(r,recipeIngredients)}));
const report={scope:'Structural audit is not physical cooking or taste validation. Two successful documented cooks of the current recipe are required for kitchen-tested status.',total:recipes.length,kitchenTested:recipes.filter(r=>r.status==='kitchen-tested').length,pending:recipes.filter(r=>r.status!=='kitchen-tested').length,deskReviewed:recipes.filter(r=>r.deskReviewed).length,structuralBlockers:recipes.filter(r=>r.structuralIssues.length).length,recipes};
const target=new URL('../source/kitchen-tests/coverage.json',import.meta.url),text=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==text)throw Error('Kitchen test coverage is stale. Run npm run audit:kitchen.');}else await writeFile(target,text);
console.log(`Kitchen audit: ${report.kitchenTested}/${report.total} physically tested; ${report.pending} pending; ${report.deskReviewed} desk-reviewed; ${report.structuralBlockers} structural blockers.`);
if(report.structuralBlockers)process.exitCode=1;
