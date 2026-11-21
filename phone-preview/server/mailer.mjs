export function createMailer(env=process.env,fetcher=fetch){
 const key=env.RESEND_API_KEY,from=env.MAIL_FROM;
 if(!key||!from)return null;
 return {async send({to,subject,text}){
  let response;
  try{response=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text})});}
  catch{throw Error('Account email could not be delivered. Try again later.');}
  if(!response.ok)throw Error('Account email could not be delivered. Try again later.');
 }};
}
