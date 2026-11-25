const badInput=message=>Object.assign(Error(message),{status:400});

export function validateFeedback(value){
  const {submissionId,kind,rating=null,message='',replyEmail=''}=value||{};
  if(typeof submissionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(submissionId)){
    throw badInput('Invalid submission reference.');
  }
  if(!['rating','feature','support'].includes(kind))throw badInput('Choose a feedback type.');
  if(kind==='rating'?(!Number.isInteger(rating)||rating<1||rating>5):rating!==null){
    throw badInput('Choose a rating from 1 to 5.');
  }
  if(typeof message!=='string'||message.length>2000||(kind!=='rating'&&!message.trim())){
    throw badInput('Enter a message of up to 2,000 characters.');
  }
  if(typeof replyEmail!=='string'||replyEmail.length>254||
    (replyEmail&&(kind!=='support'||!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(replyEmail)))){
    throw badInput('Enter a valid reply email or leave it blank.');
  }
  return {_id:submissionId,kind,rating,message:message.trim().replace(/\r\n/g,'\n'),replyEmail};
}
