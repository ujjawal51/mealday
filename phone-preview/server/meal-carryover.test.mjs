import assert from 'node:assert/strict';
import {test} from 'node:test';
import {carryoverRows,confirmLeftovers,swapBasketImpact} from '../dist/meal-carryover.js';
const item=(required,packs,have=0)=>({key:'paneer',name:'Paneer',unit:'g',required,packs,have,pack:200,cost:packs*8.75});
test('A swap within the same pack saves nothing but changes projected leftovers',()=>{
 const r=swapBasketImpact([item(180,1)],[item(90,1)]);
 assert.equal(r.savedCents,0);
 assert.deepEqual(r.rows[0],{key:'paneer',name:'Paneer',unit:'g',fromPacks:1,toPacks:1,beforeLeft:20,afterLeft:110,removed:false});
});
test('Savings use whole baskets, not the price of a recipe or one changed ingredient',()=>{
 const r=swapBasketImpact([item(350,2)],[item(180,1),{...item(60,1),key:'new',cost:3.95}]);
 assert.equal(r.savedCents,480);
 assert.equal(swapBasketImpact([item(180,1)],[item(350,2)]).savedCents,-875);
 assert.equal(swapBasketImpact([item(170,0,180)],[]).rows[0].afterLeft,180);
});
test('Carryover is a measured replacement, never a credit or implicit purchase',()=>{
 const rows=carryoverRows([item(180,1,250)],[{key:'rice',name:'Rice',unit:'g'}]);
 const previous={paneer:250,flour:40},actual=new Map([['paneer','65'],['rice','']]);
 assert.throws(()=>confirmLeftovers(previous,rows,new Map()),/Enter what is left for Paneer/);
 const next=confirmLeftovers(previous,rows,actual);
 assert.deepEqual(next,{paneer:65,flour:40});
 assert.deepEqual(confirmLeftovers(next,rows,actual),next);
 assert.deepEqual(confirmLeftovers(previous,rows,new Map([['paneer','0']])),{flour:40});
 assert.throws(()=>confirmLeftovers(previous,rows,new Map([['paneer','1.555']])),/valid amount/);
 assert.equal(previous.paneer,250);
});
