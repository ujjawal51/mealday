import assert from 'node:assert/strict';
import {createCookingTimer,timerText} from '../dist/cooking-timer.js';
let time=0,job=null,completed=0,cleared=0;
const timer=createCookingTimer({now:()=>time,schedule:callback=>(job=callback,1),unschedule:()=>{cleared++;job=null;},onComplete:()=>completed++});
assert.equal(timer.start(300000,'Pasta'),true);
assert.equal(timerText(timer.snapshot()),'5:00');
time=65000;job();
// Re-rendering or changing steps only reads state: it must not reset/cancel.
const stepTwo=timer.snapshot();assert.equal(timerText(stepTwo),'3:55');
assert.equal(stepTwo.label,'Pasta');assert.equal(cleared,0);
assert.equal(timer.start(300000,'Different recipe'),false);
time=130000;assert.equal(timerText(timer.snapshot()),'2:50');
// Deadline-based countdown catches up even if background callbacks are delayed.
time=301000;const delayedTick=job;delayedTick();delayedTick();
assert.equal(timerText(timer.snapshot()),'Time’s up');assert.equal(completed,1);assert.equal(cleared,1);
assert.equal(timer.start(300000,'Soup'),true);
time+=1000;assert.equal(timerText(timer.snapshot()),'4:59');
timer.cancel();assert.equal(timer.snapshot().started,false);assert.equal(job,null);assert.equal(completed,1);
assert.throws(()=>timer.start(-1),RangeError);
console.log('Cooking timer checks passed: re-render continuity, duplicate start, background catch-up, one completion and cancel.');
