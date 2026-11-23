const META='mealday.cloud.v1';
const CACHE='mealday.cloud.cache.';
function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
function save(key,value){localStorage.setItem(key,JSON.stringify(value));}
export function mergeGuest(cloud,guest){
  if(!cloud)return structuredClone(guest);
  const favorites=new Map([...guest.state.favorites,...cloud.state.favorites].map(r=>[r.id,r]));
  const events=new Map();
  for(const e of [...guest.history.events,...cloud.history.events]){
    const old=events.get(e.id);
    events.set(e.id,old?.undoneAt&&!e.undoneAt?old:e);
  }
  return {state:{...guest.state,...cloud.state,favorites:[...favorites.values()],recipeJournal:{...guest.state.recipeJournal,...cloud.state.recipeJournal}},history:{version:1,events:[...events.values()]}};
}
export function createCloudBackup({snapshot,apply,changed}){
  let meta=read(META,{owner:null,revision:0,dirty:false}),account=null,csrf=null,status='checking',message='Checking backup availability…',registration=false,delay,working=false,conflict=false,initializing=0;
  function update(next,text){status=next;message=text;changed?.();}
  function cache(){save(CACHE+(meta.owner||'guest'),snapshot());save(META,meta);if(meta.owner)save('mealday.cloud.account.'+meta.owner,meta);}
  async function call(path,method='GET',body){
    const res=await fetch(path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf||''},...(body?{body:JSON.stringify(body)}:{})});
    let data;try{data=await res.json();}catch{throw Error('Backup server is not connected on this deployment.');}
    if(!res.ok){const e=Error(data.error||'Backup request failed.');e.status=res.status;throw e;}return data;
  }
  function adopt(data,revision){apply(data);meta={owner:account.id,revision,dirty:false};cache();}
  async function sync(){
    clearTimeout(delay);
    if(!account||meta.owner!==account.id||conflict||working)return;
    working=true;let savedSuccessfully=false;update('syncing','Saving your kitchen…');
    try{
      const data=snapshot();const before=JSON.stringify(data);
      const saved=await call('/api/kitchen','PUT',{revision:meta.revision,data});meta.revision=saved.revision;savedSuccessfully=true;
      meta.dirty=before!==JSON.stringify(snapshot());cache();update(meta.dirty?'pending':'synced',meta.dirty?'New changes waiting to sync.':'Backed up · '+new Date(saved.updatedAt).toLocaleString());
    }catch(e){
      if(e.status===409){conflict=true;update('conflict','Another device changed your backup. Choose a version before syncing.');}
      else {if(e.status===401){account=null;csrf=null;}update('pending',e.status===401?'Session expired. Sign in again; changes are saved on this device.':'Not synced. '+e.message);}
    }finally{working=false;if(savedSuccessfully&&meta.dirty&&!conflict){clearTimeout(delay);delay=setTimeout(sync,800);}}
  }
  async function pull(){
    const remote=await call('/api/kitchen');
    if(meta.owner===account.id&&meta.dirty){
      if(meta.revision!==remote.revision){conflict=true;update('conflict','Both devices have changes. Your local version is preserved. Choose which to keep.');return;}
      await sync();return;
    }
    if(remote.data){adopt(remote.data,remote.revision);update('synced','Your account backup is loaded.');}
    else{
      meta={owner:account.id,revision:0,dirty:false};
      const cached=read(CACHE+account.id);
      if(cached){apply(cached);meta.dirty=true;cache();await sync();}
      else{apply({state:{profile:{name:'',city:'Dubai',shop:'LuLu',people:2,budget:150,minutes:30,cuisine:'UAE mix',diet:'Any',days:[0,1,2,3,4],mealTypes:['dinner'],allergies:[],appliances:['Hob'],cuisines:['UAE mix'],priorities:['Everyday']},pantry:{},result:null,checked:[],favorites:[],seed:0},history:{version:1,events:[]}});cache();update('ready','Account ready. Import your guest kitchen, or start a new plan.');}
    }
  }
  return {
    info:()=>({account,status,message,registration,conflict,hasGuest:!!read(CACHE+'guest')}),
    async init(){
      initializing++;
      try{const data=await call('/api/account');if(!Object.hasOwn(data,'user'))throw Error();account=data.user;csrf=data.csrf;registration=data.allowRegistration;
        if(account){if(meta.owner!==account.id)cache();await pull();}
        else update('guest',meta.owner?'Sign in again to sync this account’s local changes.':'Guest mode · saved on this device only.');
      }catch{update('unavailable','Cloud backup is not connected on this deployment. Your data stays on this device.');}finally{initializing--;}
    },
    localChanged(){
      try{if(meta.owner){meta.dirty=true;cache();}else save(CACHE+'guest',snapshot());}catch{update('pending','Local storage is full. Keep this page open and retry backup.');return;}
      if(account&&meta.owner===account.id&&!conflict){update('pending','Changes saved on device · waiting to sync.');clearTimeout(delay);delay=setTimeout(sync,800);}
    },
    async login(email,password,register=false){
      clearTimeout(delay);if(working)throw Error('Please wait for the current backup to finish.');cache();
      const data=await call('/api/auth/'+(register?'register':'login'),'POST',{email,password});
      account=data.user;csrf=data.csrf;conflict=false;
      const savedMeta=read('mealday.cloud.account.'+account.id);
      if(meta.owner!==account.id){const cached=read(CACHE+account.id);meta=savedMeta||{owner:account.id,revision:0,dirty:false};if(cached&&meta.dirty)apply(cached);}
      await pull();
    },
    async logout(){
      if(working)throw Error('Please wait for the current backup to finish.');
      clearTimeout(delay);cache();if(meta.owner)save('mealday.cloud.account.'+meta.owner,meta);
      await call('/api/auth/logout','POST',{});account=null;csrf=null;conflict=false;meta={owner:null,revision:0,dirty:false};
      const guest=read(CACHE+'guest');if(guest)apply(guest);else apply({state:{profile:{name:'',city:'Dubai',shop:'LuLu',people:2,budget:150,minutes:30,cuisine:'UAE mix',diet:'Any',days:[0,1,2,3,4],mealTypes:['dinner'],allergies:[],appliances:['Hob'],cuisines:['UAE mix'],priorities:['Everyday']},pantry:{},result:null,checked:[],favorites:[],seed:0},history:{version:1,events:[]}});
      cache();update('guest','Signed out · guest kitchen is on this device only.');
    },
    async deleteAccount(){
      if(!account||meta.owner!==account.id)throw Error('Sign in before deleting your account.');
      if(working||initializing)throw Error('Please wait for the current backup to finish, then try again.');
      const owner=account.id;clearTimeout(delay);working=true;
      try{
        const result=await call('/api/account','DELETE',{});
        if(result.deleted!==true)throw Error('Account deletion was not confirmed.');
        account=null;csrf=null;conflict=false;meta={owner:null,revision:0,dirty:false};
        let cleared=true;
        for(const key of [CACHE+owner,CACHE+owner+'.conflict','mealday.cloud.account.'+owner]){try{localStorage.removeItem(key);}catch{cleared=false;}}
        const guest=read(CACHE+'guest')||{state:{profile:{name:'',city:'Dubai',shop:'LuLu',people:2,budget:150,minutes:30,cuisine:'UAE mix',diet:'Any',days:[0,1,2,3,4],mealTypes:['dinner'],allergies:[],appliances:['Hob'],cuisines:['UAE mix'],priorities:['Everyday']},pantry:{},result:null,checked:[],favorites:[],seed:0},history:{version:1,events:[]}};
        apply(guest);try{cache();}catch{cleared=false;}
        update('guest',cleared?'Account deleted. You are now using your guest kitchen.':'Account deleted online. Clear this browser’s site data to remove its remaining local copies.');
        return {localCleared:cleared};
      }finally{working=false;if(account&&meta.dirty&&!conflict)delay=setTimeout(sync,800);}
    },
    async importGuest(){
      if(!account||conflict||working)throw Error('Sign in and resolve pending backup changes first.');
      if(meta.dirty){await sync();if(meta.dirty||conflict)throw Error('Sync current account changes before importing.');}
      const guest=read(CACHE+'guest');if(!guest)throw Error('No guest kitchen to import.');
      const remote=await call('/api/kitchen');adopt(mergeGuest(remote.data,guest),remote.revision);meta.dirty=true;cache();await sync();
    },
    async resolve(useLocal){
      if(!account||working)return;
      const remote=await call('/api/kitchen');conflict=false;
      if(useLocal){meta.revision=remote.revision;meta.dirty=true;cache();await sync();}
      else {if(!remote.data)throw Error('No cloud version exists. Keep the local version instead.');save(CACHE+account.id+'.conflict',snapshot());adopt(remote.data,remote.revision);update('synced','Cloud version loaded. Previous local version retained as a conflict recovery copy.');}
    },
    async refresh(){
      if(!account||working||conflict)return;
      if(meta.dirty){await sync();return;}
      working=true;
      try{const remote=await call('/api/kitchen');if(!meta.dirty&&remote.data&&remote.revision!==meta.revision){adopt(remote.data,remote.revision);update('synced','Updated from your account backup.');}}
      catch(e){if(e.status===401){account=null;csrf=null;}update('pending',e.status===401?'Session expired. Sign in again to sync.':'Unable to reach backup server. Your local kitchen is retained.');}
      finally{working=false;}
    },
    retry:sync
  };
}
