import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weeklyCalendar,kitchenBackup} from '../dist/settings-tools.js';
test('Browser reminder schedules next weekly occurrence with a notification and safe calendar syntax',()=>{
 const now=new Date(2026,10,22,11,0),ics=weeklyCalendar(0,'10:00',now);
 assert.match(ics,/DTSTART:20261129T100000\r\n/);assert.match(ics,/RRULE:FREQ=WEEKLY;BYDAY=SU/);assert.match(ics,/BEGIN:VALARM/);assert.match(ics,/TRIGGER:-PT10M/);
 assert.throws(()=>weeklyCalendar(8,'10:00'),/valid/);assert.throws(()=>weeklyCalendar(0,'10:00\r\nSUMMARY:Injected'),/valid/);
});
test('Kitchen download includes notes, ratings, saved recipes and cooking history without changing them',()=>{
 const state={profile:{name:'Chef'},favorites:[{id:'rice'}],recipeJournal:{rice:{rating:5,note:'Less salt'}}},history={version:1,events:[{id:'event',recipeId:'rice'}]};const before=JSON.stringify({state,history});
 const parsed=JSON.parse(kitchenBackup(state,history,new Date('2026-11-20T00:00:00Z')));
 assert.equal(parsed.app,'Mealday');assert.equal(parsed.version,1);assert.deepEqual(parsed.state,state);assert.deepEqual(parsed.history,history);assert.equal(JSON.stringify({state,history}),before);
});
