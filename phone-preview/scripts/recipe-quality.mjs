import {createHash} from 'node:crypto';
export function recipeVersion(recipe,ingredients){
 return createHash('sha256').update(JSON.stringify({name:recipe.name,time:recipe.time,timing:recipe.timing||null,appliances:recipe.appliances,items:recipe.items.map(([id,amount])=>({id,amount,...ingredients[id]})),steps:recipe.steps,quantityNotes:recipe.quantityNotes||[]})).digest('hex');
}
export function structuralIssues(recipe,ingredients){
 const issues=[];
 if(!recipe.items?.length)issues.push('No ingredients');
 for(const [id,amount] of recipe.items||[]){if(!ingredients[id]?.unit)issues.push('Unknown ingredient or unit: '+id);if(!Number.isFinite(amount)||amount<=0)issues.push('Invalid amount: '+id);}
 if(!Array.isArray(recipe.steps)||recipe.steps.length<2||recipe.steps.some(s=>typeof s!=='string'||s.trim().length<8))issues.push('Incomplete method');
 if(!Number.isInteger(recipe.time)||recipe.time<=0)issues.push('Invalid elapsed time');
 if(recipe.timing){const phases=['prepMinutes','cookMinutes','waitMinutes'].map(k=>recipe.timing[k]);if(phases.some(v=>!Number.isFinite(v)||v<0)||phases.reduce((a,b)=>a+b,0)!==recipe.time)issues.push('Elapsed time does not match phases');}
 return issues;
}
export function validateCook(record,{recipe,ingredients,evidenceHash,now=new Date()}){
 const errors=[];
 if(record.recipeVersion!==recipeVersion(recipe,ingredients))errors.push('Recipe changed: repeat the cook test');
 if(typeof record.id!=='string'||!record.id.trim()||typeof record.tester!=='string'||!record.tester.trim())errors.push('Test ID and tester are required');
 const date=new Date(record.cookedAt);if(typeof record.cookedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(record.cookedAt)||!Number.isFinite(+date)||date>now)errors.push('Cook date must be valid and not in the future');
 if(!Number.isInteger(record.servings)||record.servings<1)errors.push('Actual servings required');
 for(const key of ['prepMinutes','cookMinutes','waitMinutes'])if(!Number.isFinite(record[key])||record[key]<0)errors.push('Measured '+key+' required');
 if(!(record.prepMinutes+record.cookMinutes+record.waitMinutes>0))errors.push('Measured elapsed time required');
 if(!Number.isFinite(record.yieldGrams)||record.yieldGrams<=0)errors.push('Measured finished edible yield required');
 if(!Number.isInteger(record.tasteScore)||record.tasteScore<1||record.tasteScore>5)errors.push('Taste score must be 1–5');
 for(const key of ['quantitiesWork','methodWorks','timeWorks'])if(typeof record[key]!=='boolean')errors.push(key+' must be explicitly recorded');
 if(typeof record.observations!=='string'||record.observations.trim().length<20)errors.push('Record quantity, texture, flavour and timing observations');
 if(!record.evidence||!record.evidenceSha256||record.evidenceSha256!==evidenceHash)errors.push('Matching local cooking evidence required');
 const passes=!errors.length&&record.quantitiesWork&&record.methodWorks&&record.timeWorks&&record.tasteScore>=3;
 return {errors,passes};
}
export function kitchenStatus(recipe,ingredients,records,evidenceHashes){
 const version=recipeVersion(recipe,ingredients);
 const current=records.filter(r=>r.recipeId===recipe.id&&r.recipeVersion===version).sort((a,b)=>String(a.cookedAt).localeCompare(String(b.cookedAt))||String(a.id).localeCompare(String(b.id)));
 const last=current.slice(-2);
 const distinct=new Set(last.map(r=>r.id)).size===2&&new Set(last.map(r=>r.evidenceSha256)).size===2&&new Set(last.map(r=>r.cookedAt)).size===2;
 const verified=distinct&&last.every(r=>validateCook(r,{recipe,ingredients,evidenceHash:evidenceHashes[r.evidence]}).passes)&&!structuralIssues(recipe,ingredients).length;
 return {version,status:verified?'kitchen-tested':'kitchen-test-pending',currentCookTests:current.length};
}
