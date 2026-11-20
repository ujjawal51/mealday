// Bounded, cancellable motion. Final values are rendered before animation starts.
export function createOnboardingMotion(host){
  let frames=new Set();
  const reduced=()=>Boolean(host.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  function cancel(){for(const id of frames)host.cancelAnimationFrame?.(id);frames.clear();}
  function pulse(node){if(!node||reduced())return;node.animate?.([{transform:'scale(.94)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],{duration:240,easing:'ease-out'});}
  function counts(root){
    if(!host.requestAnimationFrame||reduced())return;
    root.querySelectorAll?.('[data-count]').forEach(node=>{
      const target=Number(node.dataset.count);if(!Number.isFinite(target))return;
      const suffix=node.dataset.suffix||'';let started;
      const tick=now=>{
        if(started===undefined)started=now;
        const part=Math.min(1,(now-started)/850),ease=1-Math.pow(1-part,3);
        const value=part===1?target:Math.floor(target*ease);
        node.textContent='AED '+new Intl.NumberFormat('en-AE',{maximumFractionDigits:2}).format(value)+suffix;
        if(part<1)schedule(tick);
      };
      schedule(tick);
    });
  }
  function schedule(tick){let id=host.requestAnimationFrame(now=>{frames.delete(id);tick(now);});frames.add(id);}
  return {cancel,pulse,counts};
}
