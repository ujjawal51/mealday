// One session timer, owned by the cooking session rather than rendered steps.
export function createCookingTimer({now=()=>Date.now(),schedule=setInterval,unschedule=clearInterval,onTick=()=>{},onComplete=()=>{}}={}){
  let deadline=null,interval=null,label='';
  const snapshot=()=>({active:deadline!==null&&now()<deadline,started:deadline!==null,remaining:deadline===null?0:Math.max(0,Math.ceil((deadline-now())/1000)),label});
  function tick(){
    const value=snapshot();
    onTick(value);
    if(deadline!==null&&!value.active&&interval!==null){unschedule(interval);interval=null;onComplete(value);}
  }
  return {
    snapshot,
    start(durationMs=300000,recipeLabel=''){
      if(snapshot().active)return false;
      if(!Number.isFinite(durationMs)||durationMs<=0)throw new RangeError('Timer duration must be positive.');
      if(interval!==null)unschedule(interval);
      deadline=now()+durationMs;label=recipeLabel;
      interval=schedule(tick,1000);tick();return true;
    },
    cancel(){if(interval!==null)unschedule(interval);interval=null;deadline=null;label='';onTick(snapshot());}
  };
}
export function timerText(value){return !value.started?'':value.remaining?Math.floor(value.remaining/60)+':'+String(value.remaining%60).padStart(2,'0'):'Time’s up';}
