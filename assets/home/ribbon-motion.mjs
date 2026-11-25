export function createRibbonMotion(direction=-1) {
  let phase=0,boost=0,lastScroll;
  return {
    resetScroll(value){lastScroll=value;boost=0;},
    step(dt,pageScroll,width,baseSpeed=24){
      const velocity=lastScroll===undefined||dt<=0?0:Math.abs(pageScroll-lastScroll)/dt;
      lastScroll=pageScroll;
      const target=Math.min(3.5,velocity/650);
      boost+=(target-boost)*(1-Math.exp(-dt/(target>boost?.14:.55)));
      const speed=baseSpeed*(1+boost);
      if(width>0)phase=(phase+speed*dt/width)%1;
      return {x:(direction<0?-phase:phase-1)*width,speed};
    }
  };
}

export function mountRibbons(root) {
  let active=false,last;
  const tracks=[...root.querySelectorAll('[data-ribbon]')].map(track=>{
    const cycle=track.querySelector('[data-ribbon-cycle]'),duplicate=cycle.nextElementSibling;
    return {track,cycle,duplicate,phrase:cycle.textContent,copies:1,width:0,base:24,motion:createRibbonMotion(Number(track.dataset.ribbon))};
  });
  function measure(){
    tracks.forEach(item=>{
      const unit=item.cycle.getBoundingClientRect().width/item.copies;
      if(!unit)return;
      const count=Math.max(1,Math.ceil(item.track.parentElement.clientWidth/unit));
      if(count!==item.copies){item.copies=count;item.cycle.textContent=item.duplicate.textContent=item.phrase.repeat(count);}
      item.width=item.cycle.getBoundingClientRect().width;
      item.base=Math.max(14,Math.min(36,parseFloat(getComputedStyle(item.track).fontSize)*.25));
    });
  }
  const observer=new ResizeObserver(measure);
  tracks.forEach(item=>observer.observe(item.track.parentElement));
  document.fonts?.ready.then(measure);measure();
  return {
    setActive(value){if(active!==value){active=value;last=undefined;tracks.forEach(item=>item.motion.resetScroll(scrollY));}},
    paint(now,pageScroll){
      if(!active){last=undefined;return;}
      const dt=last===undefined?1/30:Math.min(.06,Math.max(0,(now-last)/1000));last=now;
      tracks.forEach(item=>{
        const state=item.motion.step(dt,pageScroll,item.width,item.base);
        item.track.style.transform=`translate3d(${state.x.toFixed(3)}px,0,0)`;
      });
    }
  };
}
