// Allow the entrance to settle before the two-second hold, then fully return.
export function createPortraitIdleCycle({count,initialIndex=0,onChange,isAvailable=()=>true,wait=1100,enter=900,hold=2000,rest=1600,random=Math.random,schedule=setTimeout,cancel=clearTimeout}) {
  let timer,enabled=false,disposed=false,first=true,selected=-1,previous=-1;
  function clear(){if(timer!==undefined){cancel(timer);timer=undefined;}}
  function select(index){if(index!==selected){selected=index;onChange(index);}}
  function nextIndex(){
    if(first){first=false;return Math.max(0,Math.min(count-1,initialIndex));}
    const available=Array.from({length:count},(_,index)=>index).filter(isAvailable);
    const different=available.filter(index=>index!==previous);
    const choices=different.length?different:available;
    return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]??-1;
  }
  function queue(delay=wait){
    timer=schedule(()=>{
      timer=undefined;
      if(!enabled||disposed)return;
      const next=nextIndex();
      if(next<0){queue();return;}
      previous=next;select(previous);
      timer=schedule(()=>{
        timer=undefined;
        if(!enabled||disposed)return;
        select(-1);queue(rest);
      },enter+hold);
    },delay);
  }
  return {
    setEnabled(value){
      const next=Boolean(value)&&count>0&&!disposed;
      if(next===enabled)return;
      enabled=next;clear();select(-1);
      if(enabled)queue();
    },
    destroy(){disposed=true;enabled=false;clear();select(-1);}
  };
}
