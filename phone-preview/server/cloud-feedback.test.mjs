import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudBackup} from '../dist/cloud-backup.js';
import {emptyHistory,recordCook,undoCookedMark,hasCooked} from '../dist/cooking-history.js';

// Drive the browser's real backup controller, including its debounce callbacks.
test('Edits during a save are automatically drained: rating, notes and independent cooking history',async t=>{
  const previous={fetch:globalThis.fetch,localStorage:globalThis.localStorage,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
  t.after(()=>Object.assign(globalThis,previous));
  const storage=new Map(),timers=new Map();let timerId=0,release,started,offline=false;
  globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};
  globalThis.clearTimeout=id=>timers.delete(id);
  let remote={revision:1,data:{state:{profile:{name:'Cook'},pantry:{},favorites:[],checked:[],recipeJournal:{}},history:emptyHistory()}},writes=0;
  let local=structuredClone(remote.data);
  globalThis.fetch=async(path,options={})=>{
    if(offline)throw Error('offline');
    if(path==='/api/account')return Response.json({user:{id:'cook'},csrf:'test',allowRegistration:true});
    if(options.method!=='PUT')return Response.json(structuredClone(remote));
    const body=JSON.parse(options.body);assert.equal(body.revision,remote.revision);
    writes++;
    if(writes===1){started();await new Promise(resolve=>{release=resolve;});}
    remote={revision:remote.revision+1,data:body.data,updatedAt:new Date().toISOString()};
    return Response.json(remote);
  };
  const client=createCloudBackup({snapshot:()=>structuredClone(local),apply:value=>{local=structuredClone(value);}});
  await client.init();
  local.state.recipeJournal.rice={rating:4,note:'Less salt'};client.localChanged();
  const sent=new Promise(resolve=>{started=resolve;});const saving=client.retry();await sent;
  local.state.recipeJournal.rice={rating:5,note:'Less salt; add lemon 🥣'};
  local.history=recordCook(local.history,{id:'rice',name:'Rice'},'2026-11-21T06:00:00Z','cook-1');
  client.localChanged();
  // The original debounce can fire while the older network request is in flight.
  for(const [id,fn] of [...timers]){timers.delete(id);await fn();}
  release();await saving;
  assert.equal(client.info().status,'pending');
  assert.equal(timers.size,1,'A successful older save must schedule the new changes');
  for(const [id,fn] of [...timers]){timers.delete(id);await fn();}
  assert.equal(writes,2);assert.equal(client.info().status,'synced');assert.deepEqual(remote.data,local);

  // A clean second session loads all three fields, then returns an undo and cleared feedback.
  let secondData;
  const second=createCloudBackup({snapshot:()=>structuredClone(secondData),apply:value=>{secondData=structuredClone(value);}});
  await second.init();assert.equal(secondData.state.recipeJournal.rice.rating,5);
  assert.equal(secondData.state.recipeJournal.rice.note,'Less salt; add lemon 🥣');assert(hasCooked(secondData.history,'rice'));
  secondData.state.recipeJournal.rice={rating:0,note:''};
  secondData.history=undoCookedMark(secondData.history,'rice','2026-11-21T07:00:00Z');
  secondData.state.result=null; // Rebuilding/clearing the plan must retain the history record.
  second.localChanged();await second.retry();await client.refresh();
  assert.deepEqual(local,secondData);assert.equal(local.history.events.length,1);assert(!hasCooked(local.history,'rice'));

  offline=true;local.state.recipeJournal.rice.note='Offline note';client.localChanged();await client.retry();
  assert.equal(client.info().status,'pending');assert.equal(timers.size,0,'Offline saves must not spin in a retry loop');
  offline=false;await client.refresh();assert.equal(client.info().status,'synced');assert.equal(remote.data.state.recipeJournal.rice.note,'Offline note');
});
