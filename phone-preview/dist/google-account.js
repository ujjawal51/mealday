import {mountGoogleSignIn} from './google-signin.js';
history.replaceState(null,'',location.pathname);
const container=document.querySelector('#google-account');
fetch('/api/account',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).then(data=>{
 if(data.user){document.querySelector('#signed-in').hidden=false;document.querySelector('#signed-email').textContent=data.user.email;}
 mountGoogleSignIn(container,{onSuccess:()=>location.assign('/')});
}).catch(()=>mountGoogleSignIn(container,{onSuccess:()=>location.assign('/')}));
