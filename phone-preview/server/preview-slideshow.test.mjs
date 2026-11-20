import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewSlideshow} from '../dist/preview-slideshow.js';
function fixture(){
 const timers=new Map(),changes=[];let serial=0,allowed=true;
 const carousel=createPreviewSlideshow({count:3,initial:1,onChange:i=>changes.push(i),canAdvance:()=>allowed,schedule:(fn,delay)=>{assert.equal(delay,4000);const id=++serial;timers.set(id,fn);return id;},unschedule:id=>timers.delete(id)});
 return {carousel,timers,changes,setAllowed:v=>allowed=v,tick:()=>{for(const fn of [...timers.values()])fn();}};
}
test('Home preview advances every four seconds, wraps, and owns only one timer',()=>{
 const f=fixture();f.carousel.start();f.carousel.start();assert.equal(f.timers.size,1);
 f.tick();f.tick();f.tick();assert.deepEqual(f.changes,[2,0,1]);
 const queued=[...f.timers.values()][0];f.carousel.stop();assert.equal(f.timers.size,0);queued();assert.deepEqual(f.changes,[2,0,1]);
});
test('Paused, hidden or interacting previews stay still; manual navigation resets the reading interval',()=>{
 const f=fixture();f.carousel.start();f.setAllowed(false);f.tick();assert.equal(f.carousel.current(),1);
 f.setAllowed(true);f.carousel.setPaused(true);assert.equal(f.timers.size,0);f.carousel.select(2);assert.equal(f.carousel.current(),2);assert.equal(f.timers.size,0);
 f.carousel.setPaused(false);const oldTimer=[...f.timers.keys()][0];f.carousel.select(0);assert.equal(f.timers.size,1);assert.ok(!f.timers.has(oldTimer));f.tick();assert.equal(f.carousel.current(),1);
 f.carousel.select(99);assert.equal(f.carousel.current(),1);
});
