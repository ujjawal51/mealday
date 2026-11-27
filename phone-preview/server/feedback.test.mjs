import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {createApp} from './app.mjs';

test('private feedback accepts guest submissions and returns only a write receipt',async t=>{
  const origin='https://mealday.test',inbox=new Map();
  let unavailable=false;
  const store={async saveFeedback(submission){
    if(unavailable)throw Error('fixture database failure');
    const prior=inbox.get(submission._id);
    if(prior)return JSON.stringify(prior)===JSON.stringify(submission);
    inbox.set(submission._id,submission);
    return true;
  }};
  const server=createServer(createApp({store,origin}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const url='http://127.0.0.1:'+server.address().port+'/api/feedback';
  const submit=(value,headers={})=>fetch(url,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(value)});
  const support={submissionId:randomUUID(),kind:'support',message:'  Grocery list question 🥘  ',replyEmail:'person@example.com',accountData:'ignored'};
  let response=await submit(support,{origin:'https://other.test'});
  assert.equal(response.status,403);
  response=await submit(support,{'content-type':'text/plain'});
  assert.equal(response.status,415);
  response=await fetch(url);
  assert.equal(response.status,405);
  assert.equal(inbox.size,0);
  for(const invalid of [{message:' '},{replyEmail:'bad email'},{rating:3},{kind:'unknown'},{submissionId:'bad'}]){
    assert.equal((await submit({...support,...invalid})).status,400);
  }
  assert.equal((await submit({...support,message:'x'.repeat(17000)})).status,413);
  assert.equal(inbox.size,0);
  unavailable=true;
  response=await submit(support);
  assert.equal(response.status,503);
  assert.doesNotMatch(await response.text(),/fixture|person@example/);
  unavailable=false;
  response=await submit(support);
  assert.equal(response.status,201);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{reference:support.submissionId});
  assert.deepEqual(inbox.get(support.submissionId),{
    _id:support.submissionId,kind:'support',rating:null,message:'Grocery list question 🥘',replyEmail:'person@example.com'
  });
  assert.equal((await submit(support)).status,201);
  assert.equal((await submit({...support,message:'Different question'})).status,409);
  assert.equal(inbox.size,1);
  assert.equal((await submit({submissionId:randomUUID(),kind:'rating',rating:5})).status,201);
  assert.equal((await submit({submissionId:randomUUID(),kind:'feature',message:'More meal filters'})).status,201);
  for(let i=0;i<8;i++)await submit(support);
  response=await submit(support);
  assert.equal(response.status,429);
  assert.ok(Number(response.headers.get('retry-after'))>0);
});
