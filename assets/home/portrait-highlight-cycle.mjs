// Each slot owns its lifecycle; the launch cadence is independent of the hold.
export function createPortraitHighlightCycle({indices,projectCount,onPhase,isAvailable=()=>true,interval=2500,initialDelay=interval,out=500,enter=700,hold=5000,random=Math.random,schedule=setTimeout,cancel=clearTimeout}) {
  const active=new Map();
  let timer,enabled=false,disposed=false,previous=-1,project=-1;
  function later(slot,delay,fn){slot.timer=schedule(()=>{slot.timer=undefined;fn();},delay);}
  function phase(slot,name){slot.phase=name;onPhase(slot.index,name,slot.project);}
  function restore(slot){
    phase(slot,'highlight-out');
    later(slot,out,()=>{
      phase(slot,'portrait-in');
      later(slot,enter,()=>{active.delete(slot.index);phase(slot,'portrait');});
    });
  }
  function launch(){
    const available=indices.filter(index=>!active.has(index)&&isAvailable(index));
    const choices=available.filter(index=>index!==previous);
    const pool=choices.length?choices:available;
    if(!pool.length||!projectCount)return;
    const index=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
    previous=index;project=(project+1)%projectCount;
    const slot={index,project,held:false,expired:false};active.set(index,slot);
    phase(slot,'portrait-out');
    later(slot,out,()=>{
      phase(slot,'highlight-in');
      later(slot,enter,()=>{
        phase(slot,'highlight-hold');
        later(slot,hold,()=>{slot.expired=true;if(!slot.held)restore(slot);});
      });
    });
  }
  function queue(delay=interval){timer=schedule(()=>{timer=undefined;if(!enabled||disposed)return;launch();queue();},delay);}
  function stop(){if(timer!==undefined)cancel(timer);timer=undefined;enabled=false;}
  return {
    has:index=>active.has(index),
    setEnabled(value){const next=Boolean(value)&&!disposed;if(next===enabled)return;stop();enabled=next;if(enabled)queue(initialDelay);},
    setHeld(index,value){const slot=active.get(index);if(!slot)return;slot.held=Boolean(value);if(!slot.held&&slot.expired&&slot.phase==='highlight-hold')restore(slot);},
    reset(){stop();for(const slot of active.values()){if(slot.timer!==undefined)cancel(slot.timer);phase(slot,'portrait');}active.clear();},
    destroy(){this.reset();disposed=true;}
  };
}
