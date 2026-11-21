import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const mapping=JSON.parse(await readFile(new URL('../source/nutrition-mapping.json',import.meta.url),'utf8'));
const macros=['kcal','protein','carbs','fat'];
for(const [id,m] of Object.entries(mapping.ingredients)){
 if(m.status!=='mapped')continue;
 const f=mapping.foods[m.referenceId??m.fdcId];
 if(!f)throw Error('Missing food reference: '+id);
 const values=f.basis?f.nutrients:f.per100g;
 if(!values||!macros.every(k=>Number.isFinite(values[k])&&values[k]>=0))throw Error('Incomplete macros: '+id);
 if(f.basis?(!Number.isFinite(f.basis.amount)||f.basis.amount<=0||f.basis.unit!==m.unit||!Number.isFinite(m.unitsPerInput)||m.unitsPerInput<=0):(!Number.isFinite(m.gramsPerUnit)||m.gramsPerUnit<=0))throw Error('Invalid conversion: '+id);
 if(m.referenceId&&(!f.source?.name||!/^https:\/\//.test(f.source.url)||!f.source.retrieved))throw Error('Missing source: '+id);
}
await writeFile(new URL('../dist/nutrition-data.js',import.meta.url),'export const nutritionData='+JSON.stringify(mapping)+';\nexport const nutritionDataVersion='+JSON.stringify(createHash('sha256').update(JSON.stringify(mapping)).digest('hex'))+';\n');
