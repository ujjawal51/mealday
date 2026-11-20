import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savingsComparison} from '../dist/savings.js';
test('Potential savings compare only a supplied baseline to the target, with decimal precision',()=>{
 assert.deepEqual(savingsComparison(600,515),{before:600,target:515,weekly:85,yearly:4420,percent:14,over:0});
 assert.equal(savingsComparison('100.10','90.05').weekly,10.05);
});
test('Missing or invalid spend never produces a savings claim',()=>{
 for(const value of ['',null,undefined,'bad',Infinity,-1,0,50001])assert.equal(savingsComparison(value,515),null);
});
test('A budget at or above usual spending never becomes positive savings',()=>{
 assert.equal(savingsComparison(515,515).weekly,0);
 const result=savingsComparison(400,515);assert.equal(result.weekly,0);assert.equal(result.yearly,0);assert.equal(result.over,115);
});
