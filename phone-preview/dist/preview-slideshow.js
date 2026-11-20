// One timer per home carousel. Manual navigation gets a fresh reading interval.
export function createPreviewSlideshow({count,initial=0,onChange,canAdvance=()=>true,interval=4000,schedule=setInterval,unschedule=clearInterval}){
  if(!Number.isInteger(count)||count<1||!Number.isInteger(initial)||initial<0||initial>=count)throw new RangeError('Invalid slideshow.');
  let index=initial,timer=null,paused=false,running=false;
  function stopTimer(){if(timer!==null){unschedule(timer);timer=null;}}
  function tick(){if(running&&!paused&&canAdvance()){index=(index+1)%count;onChange(index);}}
  function startTimer(){if(running&&!paused&&count>1&&timer===null)timer=schedule(tick,interval);}
  return {
    start(){running=true;startTimer();},
    stop(){running=false;stopTimer();},
    select(next){if(!Number.isInteger(next)||next<0||next>=count)return;index=next;onChange(index);stopTimer();startTimer();},
    setPaused(value){paused=Boolean(value);stopTimer();startTimer();},
    current:()=>index,
  };
}
