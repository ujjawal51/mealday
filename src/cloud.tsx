import {t} from './i18n';
import React,{useEffect,useRef,useState} from 'react';
import {createClient,Session} from '@supabase/supabase-js';
import {cloudUrl,cloudKey,useMongoBackend} from './cloud-config';
import {snapshotKey,preserveLocalChanges} from './cloudSnapshot';

class MongoCloudClient {
  private authListeners: ((event: string, session: any) => void)[] = [];

  auth = {
    getSession: async () => {
      const token = localStorage.getItem('mealday.session-token');
      if (!token) return { data: { session: null }, error: null };
      try {
        const res = await fetch('/api/auth/session', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.session) {
          return { data: { session: json.session }, error: null };
        }
        localStorage.removeItem('mealday.session-token');
        return { data: { session: null }, error: null };
      } catch (e: any) {
        return { data: { session: null }, error: e };
      }
    },
    onAuthStateChange: (cb: (event: string, session: any) => void) => {
      this.authListeners.push(cb);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.authListeners = this.authListeners.filter(l => l !== cb);
            }
          }
        }
      };
    },
    signUp: async ({ email, password }: any) => {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          return { data: { session: null, user: null }, error: new Error(json.error || 'Signup failed') };
        }
        if (json.session?.access_token) {
          localStorage.setItem('mealday.session-token', json.session.access_token);
          this.notifyAuth('SIGNED_IN', json.session);
        }
        return { data: { session: json.session, user: json.user }, error: null };
      } catch (e: any) {
        return { data: { session: null, user: null }, error: e };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          return { data: { session: null, user: null }, error: new Error(json.error || 'Login failed') };
        }
        if (json.session?.access_token) {
          localStorage.setItem('mealday.session-token', json.session.access_token);
          this.notifyAuth('SIGNED_IN', json.session);
        }
        return { data: { session: json.session, user: json.user }, error: null };
      } catch (e: any) {
        return { data: { session: null, user: null }, error: e };
      }
    },
    signOut: async () => {
      const token = localStorage.getItem('mealday.session-token');
      try {
        if (token) {
          await fetch('/api/auth/signout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } catch {}
      localStorage.removeItem('mealday.session-token');
      this.notifyAuth('SIGNED_OUT', null);
      return { error: null };
    },
    resend: async () => {
      return { error: null };
    }
  };

  private notifyAuth(event: string, session: any) {
    for (const listener of this.authListeners) {
      try { listener(event, session); } catch {}
    }
  }

  from(table: string) {
    const token = localStorage.getItem('mealday.session-token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    if (table === 'mealday_accounts') {
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, _val: any) => ({
            maybeSingle: async () => {
              try {
                const res = await fetch('/api/account', { headers });
                const json = await res.json();
                return { data: json.data || null, error: res.ok ? null : new Error(json.error) };
              } catch (e: any) {
                return { data: null, error: e };
              }
            }
          })
        })
      };
    }

    if (table === 'mealday_plan_history') {
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, _val: any) => ({
            gte: (_col2: string, _val2: any) => ({
              order: (_col3: string, _opts: any) => ({
                limit: (_n: number) => ({
                  then: async (resolve: any) => {
                    try {
                      const res = await fetch('/api/plan-history', { headers });
                      const json = await res.json();
                      resolve({ data: json.data || [], error: null });
                    } catch (e: any) {
                      resolve({ data: [], error: e });
                    }
                  }
                })
              })
            })
          })
        }),
        upsert: async (rows: any[]) => {
          try {
            const res = await fetch('/api/plan-history', {
              method: 'POST',
              headers,
              body: JSON.stringify({ items: rows })
            });
            return { error: res.ok ? null : new Error('Failed to save history') };
          } catch (e: any) {
            return { error: e };
          }
        },
        delete: () => ({
          eq: async (_col: string, _val: any) => {
            try {
              const res = await fetch('/api/plan-history', {
                method: 'DELETE',
                headers
              });
              return { error: res.ok ? null : new Error('Failed to clear history') };
            } catch (e: any) {
              return { error: e };
            }
          }
        })
      };
    }

    if (table === 'mealday_cuisine_catalogue') {
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, _val: any) => ({
            limit: async (_n: number) => {
              try {
                const res = await fetch('/api/catalogue');
                const json = await res.json();
                return { data: json.data || [], error: null };
              } catch (e: any) {
                return { data: [], error: e };
              }
            }
          })
        })
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      })
    };
  }

  async rpc(fn: string, params: any) {
    const token = localStorage.getItem('mealday.session-token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    if (fn === 'mealday_save') {
      try {
        const res = await fetch('/api/account/save', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            profile: params.p_profile,
            kitchen: params.p_kitchen,
            revision: params.p_revision
          })
        });
        const json = await res.json();
        if (!res.ok) {
          return { data: null, error: new Error(json.error || 'Save failed') };
        }
        return { data: json.data, error: null };
      } catch (e: any) {
        return { data: null, error: e };
      }
    }
    return { data: null, error: new Error('Unknown RPC: ' + fn) };
  }

  functions = {
    invoke: async (fn: string, options: any) => {
      const token = localStorage.getItem('mealday.session-token') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      if (fn === 'delete-mealday-account') {
        try {
          const res = await fetch('/api/account/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify(options?.body || {})
          });
          const json = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(json.error || 'Delete failed') };
          }
          return { data: json.data || { deleted: true }, error: null };
        } catch (e: any) {
          return { data: null, error: e };
        }
      }

      return { data: null, error: null };
    }
  };
}

const initialAuthUrl=new URL(window.location.href);
const initialAuthHash=new URLSearchParams(initialAuthUrl.hash.slice(1));
const confirmationReturn=initialAuthUrl.searchParams.get('auth')==='confirmed';
const confirmationError=initialAuthUrl.searchParams.has('error_code')||initialAuthHash.has('error_code');
export const cloud: any = useMongoBackend ? new MongoCloudClient() : createClient(cloudUrl,cloudKey);
export const authReturn='https://mealday-kitchen-app.ujjawal-0x.chatgpt.site/?auth=confirmed';
export type KitchenSnapshot={profile:any;kitchen:{plan:any[];pantry:Record<string,number>;checked:string[];saved:string[];ratings:Record<string,number>;personalRecipes?:any[];recipeNotes?:Record<string,string>;mealHistory?:{recipeId:string;at:number}[];ready:boolean}};
export function useCloud(snapshot:KitchenSnapshot,load:(s:KitchenSnapshot)=>void,clear:()=>void){
 const [session,setSession]=useState<Session|null>(null);const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const [base,setBase]=useState('');const [hasCloud,setHasCloud]=useState(false);const [revision,setRevision]=useState(0);const [loading,setLoading]=useState(true);
 const snapshotRef=useRef(snapshot);snapshotRef.current=snapshot;
 const generation=useRef(0);
 const loadRef=useRef(load),clearRef=useRef(clear),uid=useRef<string|null>(null);loadRef.current=load;clearRef.current=clear;
 const read=async(s:Session,explicit=false)=>{const request=++generation.current;const sameOwner=localStorage.getItem('mealday.cloud-owner')===s.user.id;uid.current=s.user.id;setBusy(true);setStatus('Loading your account…');try{const {data,error}=await cloud.from('mealday_accounts').select('*').eq('user_id',s.user.id).maybeSingle();if(request!==generation.current)return;if(error)throw error;localStorage.setItem('mealday.cloud-owner',s.user.id);if(data){const value={profile:data.profile,kitchen:data.kitchen};let lastCloud:any=null;try{lastCloud=JSON.parse(localStorage.getItem('mealday.cloud-base.'+s.user.id)||'null')}catch{}const keep=!explicit&&preserveLocalChanges(snapshotRef.current,lastCloud,sameOwner);if(!keep)loadRef.current(value);setBase(snapshotKey(value));localStorage.setItem('mealday.cloud-base.'+s.user.id,JSON.stringify(value));setRevision(Number(data.revision));setHasCloud(true);setStatus(keep?'Your unsaved changes are kept on this device. Save to sync them.':'Account data loaded.');}else{setRevision(0);setHasCloud(false);setBase('');setStatus('No cloud data yet. Choose Save to account to upload this kitchen.');}}catch(e:any){if(request===generation.current)setStatus(e.message||'Could not load account.');}finally{if(request===generation.current){setBusy(false);setLoading(false)}}};
 useEffect(()=>{let active=true;const handle=(s:Session|null)=>{if(!active)return;const prior=localStorage.getItem('mealday.cloud-owner');if((s&&prior&&prior!==s.user.id)||(!s&&prior)){clearRef.current();localStorage.removeItem('mealday.cloud-base.'+prior);localStorage.removeItem('mealday.cloud-owner');}setSession(s);if(s&&uid.current!==s.user.id){setLoading(true);void read(s)}if(!s){generation.current++;uid.current=null;setLoading(false);setBusy(false);setRevision(0);setHasCloud(false);setBase('');}};cloud.auth.getSession().then(({data}:any)=>handle(data?.session||null));const {data}=cloud.auth.onAuthStateChange((_event:any,s:any)=>{window.setTimeout(()=>handle(s),0)});return()=>{active=false;generation.current++;uid.current=null;data?.subscription?.unsubscribe?.()};},[]);
 const save=async()=>{if(!session||busy)return;setBusy(true);setStatus('Saving…');try{const {data,error}=await cloud.rpc('mealday_save',{p_profile:snapshot.profile,p_kitchen:snapshot.kitchen,p_revision:revision});if(error)throw error;setRevision(Number(data.revision));setBase(snapshotKey(snapshot));localStorage.setItem('mealday.cloud-base.'+session.user.id,JSON.stringify(snapshot));setHasCloud(true);setStatus('Saved to your account.');}catch(e:any){setStatus(e.message?.includes('SYNC_CONFLICT')?'Another tab or device changed this kitchen. Reload from account before saving.':e.message||'Save failed. Please retry.');}finally{setBusy(false)}};
 const logout=async()=>{setBusy(true);const {error}=await cloud.auth.signOut();if(error){setStatus(error.message);setBusy(false);setOpen(true);return;}clearRef.current();if(session)localStorage.removeItem('mealday.cloud-base.'+session.user.id);localStorage.removeItem('mealday.cloud-owner');setOpen(false);setBusy(false)};
 const remove=async()=>{if(!session)return {deleted:false,error:'Sign in required.'};if(busy)return {deleted:false,error:'Another account action is in progress.'};setBusy(true);setStatus('Deleting your account…');try{const {data,error}=await cloud.functions.invoke('delete-mealday-account',{body:{confirm:'DELETE'}});if(error)throw error;if(data?.deleted!==true)throw new Error('Account deletion was not confirmed. Please retry.');await cloud.auth.signOut({scope:'local'});clearRef.current();localStorage.removeItem('mealday.cloud-base.'+session.user.id);localStorage.removeItem('mealday.cloud-owner');setSession(null);setOpen(false);setStatus('Account deleted.');return {deleted:true};}catch(e:any){const message=e.message||'Deletion failed. Please retry.';setStatus(message);return {deleted:false,error:message};}finally{setBusy(false)}};
 return {session,open,setOpen,busy,status,loading,save,logout,remove,reload:()=>session&&read(session,true),hasCloud,dirty:snapshotKey(snapshot)!==base};
}
export function AccountPanel({account}:{account:ReturnType<typeof useCloud>}){
 const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[working,setWorking]=useState(false),[confirm,setConfirm]=useState('');
 const [showPassword,setShowPassword]=useState(false),[isError,setIsError]=useState(false);
 const authDialog=useRef<HTMLDialogElement>(null);
 const showAuth=account.open&&!account.session;
 useEffect(()=>{
  if(!confirmationReturn&&!confirmationError)return;
  let active=true;
  void cloud.auth.getSession().then(({data,error}:any)=>{
   if(!active)return;
   account.setOpen(true);
   setIsError(confirmationError||!!error);
   if(confirmationError||error)setMessage('This confirmation link is invalid or expired. Request a fresh email below.');
   else if(!data.session)setMessage('Sign in to continue. If your email is still unconfirmed, request a fresh link below.');
   const url=new URL(window.location.href);
   for(const key of ['auth','error','error_code','error_description'])url.searchParams.delete(key);
   if(confirmationError)url.hash='';
   window.history.replaceState(window.history.state,'',url);
  });
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  const dialog=authDialog.current;
  if(showAuth&&dialog&&!dialog.open)dialog.showModal();
 },[showAuth]);
 const closeAuth=()=>{setPassword('');setShowPassword(false);account.setOpen(false)};
 const switchMode=(next:string)=>{setMode(next);setMessage('');setIsError(false);setPassword('');setShowPassword(false)};
 const explain=(error:any,fallback:string)=>{
  const messages:Record<string,string>={
   invalid_credentials:'Email or password is incorrect. Check your details and try again.',
   email_not_confirmed:'Confirm your email first. You can request a new link below.',
   email_address_invalid:'Enter a valid email address that can receive confirmation.',
   email_address_not_authorized:'Confirmation emails are restricted for this project. Contact Mealday support.',
   over_email_send_rate_limit:'Too many emails were requested. Wait a minute and try again.',
   weak_password:'Choose a stronger password and try again.'
  };
  setIsError(true);setMessage(messages[error?.code]||error?.message||fallback);
 };
 const resend=async()=>{
  if(working||!email.trim())return;
  setWorking(true);setMessage('');setIsError(false);
  try{const {error}=await cloud.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:authReturn}});if(error)throw error;setMessage('If a confirmation is pending, check your inbox and spam folder for the new link.')}
  catch(error){explain(error,'Could not resend the confirmation email.')}finally{setWorking(false)}
 };
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(working)return;
  setWorking(true);setMessage('');setIsError(false);
  try{
   if(mode==='signup'){
    const {data,error}=await cloud.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:authReturn}});
    if(error)throw error;
    if(!data.session){setMode('login');setMessage('Check your inbox for the confirmation link. Then come back to sign in.')}
   }else{
    const {error}=await cloud.auth.signInWithPassword({email:email.trim(),password});
    if(error)throw error;
   }
   setPassword('');setShowPassword(false);
  }catch(error){explain(error,'Could not continue. Please try again.')}finally{setWorking(false)}
 };
 if(!account.open)return null;
 if(showAuth)return <dialog ref={authDialog} className="mealday-auth" aria-labelledby="mealday-auth-title" onCancel={e=>{e.preventDefault();closeAuth()}}>
  <header className="mealday-auth-header"><img src="/assets/mealday-mark.svg" alt=""/><b>Mealday</b><button type="button" onClick={closeAuth}>Back to Mealday</button></header>
  <div className="mealday-auth-layout">
   <aside aria-hidden="true"><img src="/assets/mealday-kitchen-sage.webp" alt=""/><p>Your weekly kitchen, wherever you are.</p></aside>
   <main className="mealday-auth-form">
    <div className="mealday-auth-tabs" aria-label="Account options"><button type="button" disabled={working} aria-pressed={mode==='login'} onClick={()=>switchMode('login')}>Sign in</button><button type="button" disabled={working} aria-pressed={mode==='signup'} onClick={()=>switchMode('signup')}>Sign up</button></div>
    <h1 id="mealday-auth-title">{mode==='signup'?'Create your account':'Welcome back'}</h1>
    <p>{mode==='signup'?'Create an account to save your meal plans and shopping lists.':'Sign in to access your saved Mealday kitchen.'}</p>
    <form onSubmit={submit} aria-busy={working}>
     <label className="field"><span>Email address</span><input type="email" autoComplete="username" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/></label>
     <label className="field"><span>Password</span><input type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?8:undefined} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <button className="link auth-password-toggle" type="button" onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide password':'Show password'}</button>
     {mode==='signup'&&<small>Use at least 8 characters.</small>}
     <button className="primary" disabled={working}>{working?'Please wait…':mode==='signup'?'Create account':'Sign in'}</button>
    </form>
    {message&&<p className={'auth-feedback'+(isError?' auth-feedback-error':'')} role={isError?'alert':'status'}>{message}</p>}
    {mode==='login'&&<button className="link" disabled={working||!email.trim()} onClick={resend}>Resend confirmation email</button>}
   </main>
  </div>
 </dialog>;
 return <div className="modal"><button className="modal-backdrop" aria-label="Close account" onClick={()=>account.setOpen(false)}/><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title"><div className="section-heading"><h2 id="account-title">{account.session?'Your Mealday account':mode==='signup'?'Create your account':'Welcome back'}</h2><button aria-label="Close account" onClick={()=>account.setOpen(false)}>{t("Close")}</button></div><p className="account-email">{account.session?.user.email}</p><p>Save this kitchen to access your profile, meals, pantry and favourites on another device. Your first save uploads the preferences you entered, including ingredient exclusions.</p><p className="account-status" role="status">{account.status}</p><button className="primary" disabled={account.busy} onClick={account.save}>{account.busy?'Please wait…':account.hasCloud?'Save changes to account':'Save this kitchen to account'}</button>{account.hasCloud&&<button className="secondary" disabled={account.busy} onClick={()=>{setMode('reload')}}>Load saved account data</button>}{mode==='reload'&&<div className="account-warning"><p>Loading replaces unsaved changes on this browser.</p><button className="secondary" onClick={()=>{account.reload();setMode('login')}}>Replace with saved account data</button></div>}<button className="link" disabled={account.busy} onClick={()=>setMode('logout')}>{t("Sign out")}</button>{mode==='logout'&&<div className="account-warning"><p>Unsaved changes will be cleared from this browser. Save first if you want to keep them.</p><button className="secondary" disabled={account.busy} onClick={account.logout}>Sign out & clear local data</button></div>}<details className="account-danger"><summary>Delete account and all saved data</summary><p>This permanently deletes your login, cloud kitchen and local Mealday data. Type DELETE to confirm.</p><input aria-label="Type DELETE to delete account" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="DELETE"/><button className="delete-data-button" disabled={confirm!=='DELETE'||account.busy} onClick={account.remove}>Permanently delete my account</button></details></section></div>;
}
