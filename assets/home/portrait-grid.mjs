import {portraitGridLayout,proximityWeight,portraitLensLayout,stepPortraitMotion} from './portrait-grid-layout.mjs';
import {createPortraitIdleCycle} from './portrait-idle.mjs';
import {createPortraitHighlightCycle} from './portrait-highlight-cycle.mjs';

export function mountPortraitGrid(root) {
  const stage=root.closest('.opening-stage');
  const tiles=[...root.querySelectorAll('[data-portrait-tile]')];
  const originalIndex=tiles.findIndex(tile=>tile.dataset.original==='true');
  const projectIds=new Set([...root.querySelectorAll('[data-highlight-project]')].map(link=>link.dataset.highlightProject));
  const projects=[...document.querySelectorAll('.highlight-group[id]')].filter(element=>projectIds.has(element.id)).map(element=>({
    id:element.id,title:element.querySelector('h3').textContent.trim(),nextPhoto:0,
    photos:[...element.querySelectorAll('[data-photo-card] img')].map(image=>({src:image.getAttribute('src'),width:image.getAttribute('width'),height:image.getAttribute('height')}))
  }));
  const links=tiles.map(tile=>root.querySelector(`[data-highlight-slot="${tile.dataset.portraitId}"]`));
  const animations=new Map();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const abort=new AbortController(),signal=abort.signal;
  let layout,motion=true,pointer,focused=-1,pinned=-1,tabIndex=originalIndex,raf=0,last=0,visible=true;
  let automatic=-1,idleStationary=false,suspended=false,disposed=false;
  const highlights=createPortraitHighlightCycle({
    indices:tiles.map((_,index)=>index).filter(index=>links[index]),projectCount:projects.length,
    isAvailable:index=>index!==automatic&&index!==focused&&index!==pinned&&!tiles[index].matches(':hover'),
    onPhase:showHighlightPhase
  });
  const idle=createPortraitIdleCycle({count:tiles.length,initialIndex:originalIndex,isAvailable:index=>!highlights.has(index),onChange(index){automatic=index;if(index>=0)idleStationary=true;requestPaint();}});
  const channels=['weight','x','y','lean'];
  const packingFilter={samples:[],moving:false};
  const springs=tiles.map(()=>Object.fromEntries(channels.map(key=>[key,{value:0,velocity:0}])));
  function clearSprings(){springs.forEach(pose=>channels.forEach(key=>{pose[key].value=0;pose[key].velocity=0;}));}
  root.classList.add('is-ready');

  function animateLayer(element,entering){
    animations.get(element)?.cancel();
    const frames=entering?[
      {transform:'scale(0)',offset:0,easing:'cubic-bezier(.16,.8,.3,1)'},
      {transform:'scale(1.035)',offset:.72,easing:'ease-out'},
      {transform:'scale(1)',offset:1}
    ]:[
      {transform:'scale(1)',offset:0,easing:'ease-out'},
      {transform:'scale(1.035)',offset:.18,easing:'cubic-bezier(.55,0,.75,.4)'},
      {transform:'scale(0)',offset:1}
    ];
    animations.set(element,element.animate(frames,{duration:entering?700:500,fill:'forwards'}));
  }
  function activeControl(index){const link=links[index];return link&&!link.hidden&&!link.inert?link:tiles[index];}
  function showHighlightPhase(index,phase,project){
    const tile=tiles[index],link=links[index],photo=tile.querySelector('img'),surface=link.firstElementChild;
    if(phase==='portrait'){
      for(const element of [photo,surface]){animations.get(element)?.cancel();animations.delete(element);}
      tile.style.visibility='';tile.inert=Boolean(layout&&layout.lensStrength===0);link.hidden=true;link.inert=true;
    }else if(phase==='portrait-out'){
      tile.inert=true;animateLayer(photo,false);
    }else if(phase==='highlight-in'){
      const selected=projects[project],image=surface.querySelector('img');
      const picture=selected.photos[selected.nextPhoto++%selected.photos.length];
      if(image&&picture){image.src=picture.src;image.width=Number(picture.width);image.height=Number(picture.height);}
      tile.style.visibility='hidden';link.href=`#${selected.id}`;
      link.setAttribute('aria-label',`查看 Highlight：${selected.title}`);
      link.hidden=false;link.inert=false;animateLayer(surface,true);
    }else if(phase==='highlight-out'){
      link.inert=true;animateLayer(surface,false);
    }else if(phase==='portrait-in'){
      link.hidden=true;link.inert=true;tile.style.visibility='';
      tile.inert=Boolean(layout&&layout.lensStrength===0);animateLayer(photo,true);
    }
    setTab(tabIndex);requestPaint();
  }

  function hasManualResponse() {
    if(focused>=0||pinned>=0)return true;
    return Boolean(pointer&&layout?.rest.some(tile=>Math.hypot(pointer.x-tile.x-tile.size/2,pointer.y-tile.y-tile.size/2)<layout.pitch*1.36));
  }
  function syncIdle() {
    const active=!disposed&&!suspended&&visible&&!document.hidden&&motion&&!reduced.matches&&layout?.travel===0&&layout?.lensStrength===1;
    idle.setEnabled(active&&!hasManualResponse());
    highlights.setEnabled(active);
    if(reduced.matches||!visible||document.hidden||layout?.tiles.every((tile,index)=>index===originalIndex||tile.presence===0))highlights.reset();
  }
  function interactionChanged(){if(hasManualResponse())idleStationary=false;syncIdle();requestPaint();}

  function targets() {
    const empty=()=>tiles.map(()=>({weight:0,x:0,y:0,lean:0}));
    if(!layout)return empty();
    if(!hasManualResponse()&&automatic>=0){
      return tiles.map((_,index)=>({weight:index===automatic?1:0,x:0,y:0,lean:0}));
    }
    const active=focused>=0?focused:pinned;
    let point=pointer;
    if(active>=0){const tile=layout.rest[active];point={x:tile.x+tile.size/2,y:tile.y+tile.size/2};}
    if(!point||layout.lensStrength===0)return empty();
    return layout.rest.map(tile=>{
      const dx=point.x-tile.x-tile.size/2,dy=point.y-tile.y-tile.size/2;
      const weight=proximityWeight(Math.hypot(dx,dy),layout.pitch*1.36);
      const nx=Math.max(-1,Math.min(1,dx/layout.pitch));
      const ny=Math.max(-1,Math.min(1,dy/layout.pitch));
      return {weight,x:reduced.matches?0:nx*weight,y:reduced.matches?0:ny*weight,lean:reduced.matches?0:nx*weight};
    });
  }
  function paint(now,immediate=false) {
    if(!layout)return false;
    const dt=last?Math.max(0,Math.min(.05,(now-last)/1000)):1/60;
    const desired=targets();
    let moving=false;
    springs.forEach((pose,index)=>channels.forEach(key=>{
      if(immediate||reduced.matches){pose[key].value=desired[index][key];pose[key].velocity=0;}
      else moving=stepPortraitMotion(pose[key],desired[index][key],dt,key)||moving;
    }));
    const poses=springs.map(pose=>Object.fromEntries(channels.map(key=>[key,pose[key].value])));
    const arranged=portraitLensLayout(layout,poses,{magnification:fine.matches?.60:.46,stationary:idleStationary,filter:packingFilter,dt,immediate:immediate||reduced.matches});
    moving=packingFilter.moving||moving;
    tiles.forEach((element,index)=>{
      const tile=layout.tiles[index],view=arranged[index];
      const x=view.x+(view.size-tile.size)/2,y=view.y+(view.size-tile.size)/2;
      const size=`${tile.size.toFixed(3)}px`;
      if(element.style.getPropertyValue('--tile-size')!==size)element.style.setProperty('--tile-size',size);
      element.style.transform=`translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) rotate(${view.angle.toFixed(3)}deg) scale(${(view.size/tile.size).toFixed(5)})`;
      const link=links[index];
      if(link){link.style.setProperty('--tile-size',size);link.style.transform=element.style.transform;}
    });
    last=moving?now:0;
    return moving;
  }
  function frame(now) {
    raf=0;
    const moving=paint(now);
    if(moving&&visible&&!document.hidden)raf=requestAnimationFrame(frame);else last=0;
  }
  function requestPaint(){if(!raf&&visible&&!document.hidden&&!suspended&&!disposed)raf=requestAnimationFrame(frame);}
  function locate(event) {
    const rect=stage.getBoundingClientRect();
    pointer={x:event.clientX-rect.left,y:event.clientY-rect.top};
    pinned=focused=-1;interactionChanged();
  }
  function reset() {
    pointer=undefined;focused=pinned=-1;
    tiles.forEach(tile=>tile.setAttribute('aria-pressed','false'));
    interactionChanged();
  }
  function setTab(index) {
    tabIndex=index;
    tiles.forEach((tile,i)=>{
      tile.tabIndex=i===index&&activeControl(i)===tile?0:-1;
      if(links[i])links[i].tabIndex=i===index&&activeControl(i)===links[i]?0:-1;
    });
  }
  stage.addEventListener('pointermove',event=>{
    if(!fine.matches||event.pointerType==='touch'||!motion||!layout?.lensStrength)return;
    locate(event);
  },{signal,passive:true});
  stage.addEventListener('pointerenter',event=>{
    if(fine.matches&&event.pointerType!=='touch'&&motion&&layout?.lensStrength)locate(event);
  },{signal,passive:true});
  stage.addEventListener('pointerleave',()=>{pointer=undefined;interactionChanged();},{signal});
  tiles.forEach((tile,index)=>{
    tile.addEventListener('focus',()=>{
      if(tile.matches(':focus-visible')){focused=index;pinned=-1;pointer=undefined;setTab(index);interactionChanged();}
    },{signal});
    tile.addEventListener('blur',()=>{focused=-1;interactionChanged();},{signal});
    tile.addEventListener('click',event=>{
      if(!layout?.lensStrength)return;
      setTab(index);
      if(!fine.matches||event.detail===0){
        pinned=pinned===index?-1:index;focused=-1;pointer=undefined;
        tiles.forEach((item,i)=>item.setAttribute('aria-pressed',String(i===pinned)));
        interactionChanged();
      }
    },{signal});
    tile.addEventListener('keydown',event=>{
      const row=Math.floor(index/3),column=index%3;
      const destinations={ArrowLeft:row*3+(column+2)%3,ArrowRight:row*3+(column+1)%3,ArrowUp:((row+2)%3)*3+column,ArrowDown:((row+1)%3)*3+column};
      if(event.key==='Escape'){event.preventDefault();reset();return;}
      if(event.key in destinations&&layout?.lensStrength){event.preventDefault();setTab(destinations[event.key]);activeControl(tabIndex).focus({preventScroll:true});}
    },{signal});
  });
  links.forEach((link,index)=>{
    if(!link)return;
    const held=()=>highlights.setHeld(index,link.matches(':hover,:focus-within'));
    link.addEventListener('pointerenter',held,{signal});link.addEventListener('pointerleave',held,{signal});
    link.addEventListener('focus',()=>{focused=index;setTab(index);held();interactionChanged();},{signal});
    link.addEventListener('blur',()=>{focused=-1;held();interactionChanged();},{signal});
    link.addEventListener('keydown',event=>{
      const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};
      if(event.key in moves){event.preventDefault();setTab((index+moves[event.key]+9)%9);activeControl(tabIndex).focus({preventScroll:true});}
      if(event.key==='Escape'){event.preventDefault();highlights.reset();setTab(originalIndex);tiles[originalIndex].focus({preventScroll:true});}
    },{signal});
  });
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))reset();},{signal,passive:true});
  const observer=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(!visible){cancelAnimationFrame(raf);raf=0;last=0;reset();clearSprings();paint(performance.now(),true);}
    else syncIdle();
  });
  observer.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;reset();}else syncIdle();},{signal});
  window.addEventListener('scroll',()=>{idle.setEnabled(false);highlights.setEnabled(false);requestPaint();},{signal,passive:true});
  reduced.addEventListener('change',syncIdle,{signal});
  fine.addEventListener('change',reset,{signal});

  return {
    update(options) {
      suspended=false;
      motion=options.motion;
      layout=portraitGridLayout({...options,originalIndex});
      root.classList.toggle('is-transitioning',layout.travel>0);
      root.classList.toggle('is-settled',layout.travel===1);
      if(layout.lensStrength===0){
        pointer=undefined;focused=pinned=-1;clearSprings();
        tiles.forEach((tile,index)=>{tile.inert=index!==originalIndex;tile.setAttribute('aria-pressed','false');});
        setTab(originalIndex);
      }else tiles.forEach((tile,index)=>tile.inert=highlights.has(index));
      links.forEach(link=>{if(link&&layout.lensStrength===0)link.inert=true;});
      syncIdle();
      const moving=paint(performance.now(),!motion);
      if(moving)requestPaint();
      return {...layout.tiles[originalIndex],gridBottom:layout.top+layout.cellSize*3+layout.gap*2};
    },
    pause(){suspended=true;idle.setEnabled(false);highlights.reset();cancelAnimationFrame(raf);raf=0;last=0;pointer=undefined;focused=pinned=-1;clearSprings();paint(performance.now(),true);},
    destroy(){disposed=true;idle.destroy();highlights.destroy();for(const animation of animations.values())animation.cancel();cancelAnimationFrame(raf);observer.disconnect();abort.abort();}
  };
}
