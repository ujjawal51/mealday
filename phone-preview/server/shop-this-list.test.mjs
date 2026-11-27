import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groceryProviders,shopListLines} from '../dist/shop-this-list.js';
test('Shop this list exports only unmet and unchecked groceries in their canonical units',()=>{
 const items=[{key:'paneer',name:'Paneer',unit:'g',have:150,need:250,packs:2},{key:'rice',name:'Rice',unit:'g',need:100,packs:1},{key:'oil',name:'Oil',unit:'ml',need:0,packs:0}];
 const extras=[{name:'Limes',quantity:'3 pieces'},{name:'Parsley',checked:true}];
 assert.deepEqual(shopListLines(items,['rice'],extras),['Paneer — 250 g','Limes — 3 pieces']);
 assert.deepEqual(groceryProviders.map(p=>new URL(p.url).origin),['https://minutes.noon.com','https://www.talabat.com']);
 assert(groceryProviders.every(p=>!new URL(p.url).search));
});
