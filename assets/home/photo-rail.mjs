import {galleryLayout} from './photo-layout.mjs';

// Original implementation of a hover-and-release photo group; no dragging or scroll track.
export function mountPhotoRails() {
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const instances=[...document.querySelectorAll('[data-photo-rail]')].map(rail=>{
    const cards=[...rail.querySelectorAll('[data-photo-card]')];
    if(!cards.length)return null;
    const sizer=document.createElement('span');
    sizer.className='photo-sizer';sizer.setAttribute('aria-hidden','true');rail.append(sizer);
    const ratios=cards.map(card=>Number(card.dataset.photoRatio)||1);
    let hovered=null,focused=null,tapped=null,index=Math.floor(cards.length/2),lastPointer='mouse';
    let leaveTimer,entered=false,entering=false,animations=[],lastSize='';
    const transform=({x,y,scale})=>`translate3d(calc(-50% + ${x}px),calc(-50% + ${y}px),0) scale(${scale})`;
    const dimensions=()=>({width:rail.clientWidth,w:sizer.offsetWidth,h:sizer.offsetHeight});
    function render(){
      const {width,w,h}=dimensions();
      const active=hovered??focused??tapped;
      const positions=galleryLayout(cards.length,width,w,h,active,ratios);
      rail.dataset.active=active===null?'none':String(active);
      cards.forEach((card,i)=>{
        card.style.width=`${positions[i].width}px`;
        card.style.height=`${positions[i].height}px`;
        card.style.transform=transform(positions[i]);
        card.style.zIndex=String(positions[i].z);
        card.style.transitionDelay=`${positions[i].delay}ms`;
        card.setAttribute('aria-pressed',String(active===i));
        card.tabIndex=i===index?0:-1;
      });
    }
    function resetHover(){clearTimeout(leaveTimer);hovered=null;render();}
    function finishEntrance(){
      entering=false;rail.classList.remove('gallery-entering');render();
    }
    function enter(){
      if(entered)return;
      entered=true;
      rail.dataset.entered='true';
      render();
      if(reduced.matches)return;
      entering=true;rail.classList.add('gallery-entering');
      const {width,w,h}=dimensions();
      const positions=galleryLayout(cards.length,width,w,h);
      const centre=(cards.length-1)/2;
      animations=cards.map((card,i)=>card.animate([
        {transform:transform({x:0,y:60,scale:.96}),opacity:0,offset:0,easing:'cubic-bezier(.16,1,.3,1)'},
        {transform:transform({x:0,y:0,scale:1}),opacity:1,offset:.3},
        {transform:transform({x:0,y:0,scale:1}),opacity:1,offset:.43,easing:'cubic-bezier(.22,1.35,.36,1)'},
        {transform:transform(positions[i]),opacity:1,offset:1}
      ],{duration:950,delay:Math.min(Math.abs(i-centre)*38,210),fill:'backwards'}));
      Promise.all(animations.map(a=>a.finished.catch(()=>{}))).then(finishEntrance);
    }
    function measure(){
      const size=dimensions(),stamp=`${size.width}:${size.w}:${size.h}`;
      if(entering&&lastSize&&stamp!==lastSize){animations.forEach(a=>a.cancel());finishEntrance();}
      lastSize=stamp;
      render();
    }
    cards.forEach((card,i)=>{
      const img=card.querySelector('img');
      const readRatio=()=>{
        if(img?.naturalWidth&&img.naturalHeight){ratios[i]=img.naturalWidth/img.naturalHeight;render();}
      };
      img?.addEventListener('load',readRatio);readRatio();
      card.addEventListener('pointerenter',event=>{
        if(entering||event.pointerType==='touch'||!fine.matches)return;
        clearTimeout(leaveTimer);hovered=i;index=i;render();
      });
      card.addEventListener('pointerleave',event=>{
        if(event.pointerType==='touch')return;
        leaveTimer=setTimeout(()=>{if(hovered===i)resetHover();},65);
      });
      card.addEventListener('focus',()=>{
        if(card.matches(':focus-visible')){focused=i;index=i;render();}
      });
      card.addEventListener('click',event=>{
        if(fine.matches&&lastPointer!=='touch'&&event.detail>0)return;
        index=i;tapped=tapped===i?null:i;focused=null;render();
      });
    });
    rail.addEventListener('pointerdown',event=>{
      lastPointer=event.pointerType;
      if(event.pointerType==='mouse'){
        event.preventDefault();
        if(rail.contains(document.activeElement))document.activeElement.blur();
      }
    });
    rail.addEventListener('pointerleave',resetHover);
    rail.addEventListener('focusout',event=>{
      if(!rail.contains(event.relatedTarget)){focused=null;render();}
    });
    rail.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=index+1;
      if(event.key==='ArrowLeft')next=index-1;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=cards.length-1;
      if(event.key==='Escape'){
        event.preventDefault();hovered=focused=tapped=null;
        if(rail.contains(document.activeElement))document.activeElement.blur();
        render();return;
      }
      if(next!==undefined){
        event.preventDefault();index=Math.max(0,Math.min(cards.length-1,next));
        hovered=null;focused=index;tapped=null;
        cards[index].focus({preventScroll:true});render();
      }
    });
    document.addEventListener('pointerdown',event=>{
      if(tapped!==null&&!rail.contains(event.target)){tapped=null;render();}
    },{passive:true});
    const observer=new ResizeObserver(measure);observer.observe(rail);
    const visible=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){enter();visible.disconnect();}
    },{threshold:.25});
    rail.dataset.entered='false';measure();visible.observe(rail);
    reduced.addEventListener('change',()=>{
      if(reduced.matches){animations.forEach(a=>a.cancel());finishEntrance();}
    });
    return {measure};
  }).filter(Boolean);
  return {refresh(){instances.forEach(instance=>instance.measure());}};
}
