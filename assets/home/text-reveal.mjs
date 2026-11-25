// Independent line-by-line colour wipe. Text stays in the semantic DOM; no duplicate copy.
export function mountTextReveals() {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const states=new Map();
  let observer,resizeFrame;

  function complete(state) {
    state.status='done';
    state.element.dataset.revealState='done';
    state.element.textContent=state.text;
    state.element.style.width=state.originalWidth;
    state.animations.forEach(animation=>animation.cancel());
    state.animations=[];
    observer?.unobserve(state.element);
  }

  function prepare(state) {
    const element=state.element;
    element.style.width=state.originalWidth;
    element.textContent=state.text;
    const node=element.firstChild;
    if(!node||!element.getBoundingClientRect().width)return false;
    const measuredWidth=element.getBoundingClientRect().width;
    const range=document.createRange(),lines=[];
    let previousTop,offset=0;
    // Measure actual browser wrapping so both narrow screens and loaded fonts retain it.
    // Character boundaries also capture line breaks inside hyphenated words.
    for(const character of state.text) {
      range.setStart(node,offset);
      offset+=character.length;
      range.setEnd(node,offset);
      const rect=range.getClientRects()[0];
      if(!rect)continue;
      if(/\s/.test(character)&&lines.length){lines[lines.length-1]+=character;continue;}
      if(previousTop===undefined||Math.abs(rect.top-previousTop)>2) {
        lines.push('');previousTop=rect.top;
      }
      lines[lines.length-1]+=character;
    }
    if(!lines.length)return false;
    const centered=getComputedStyle(element).textAlign==='center';
    state.lines=lines.map(text=>{
      const line=document.createElement('span');
      line.className='text-wipe-line';
      line.textContent=text;
      if(centered)line.style.marginInline='auto';
      const cover=document.createElement('span');
      cover.className='text-wipe-cover';
      cover.setAttribute('aria-hidden','true');
      line.append(cover);
      return {line,cover};
    });
    element.replaceChildren(...state.lines.map(item=>item.line));
    // A max-content heading must retain the same width while its lines are masked.
    element.style.width=`${measuredWidth}px`;
    element.dataset.revealState='pending';
    return true;
  }

  function show(element) {
    const state=states.get(element);
    if(!state||state.status!=='pending')return;
    if(reduced.matches){complete(state);return;}
    if(!state.lines.length&&!prepare(state))return;
    state.status='running';element.dataset.revealState='running';
    const delay=Number(element.dataset.revealDelay)||0;
    state.animations=state.lines.flatMap(({line,cover},index)=>{
      const stagger=delay+index*95;
      return [
        line.animate([
          {clipPath:'inset(-.08em 100% -.12em 0)'},
          {clipPath:'inset(-.08em -.1em -.12em -.1em)'}
        ],{duration:560,delay:stagger,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}),
        cover.animate([{transform:'scaleX(1)'},{transform:'scaleX(0)'}],
          {duration:640,delay:stagger+260,easing:'cubic-bezier(.65,0,.35,1)',fill:'both'})
      ];
    });
    Promise.all(state.animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
      if(state.status==='running')complete(state);
    });
  }

  if('IntersectionObserver' in window) {
    observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting)show(entry.target);});
    },{rootMargin:'0px',threshold:0});
  }
  document.querySelectorAll('[data-text-reveal]').forEach(element=>{
    const state={element,text:element.textContent.replace(/\s+/g,' ').trim(),originalWidth:element.style.width,status:'pending',lines:[],animations:[]};
    states.set(element,state);
    if(reduced.matches||!observer){complete(state);return;}
    prepare(state);
    if(!element.dataset.textReveal)observer.observe(element);
  });

  function refresh() {
    states.forEach(state=>{
      if(state.status==='running')complete(state);
      else if(state.status==='pending')prepare(state);
    });
  }
  window.addEventListener('resize',()=>{
    cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(refresh);
  },{passive:true});
  document.fonts?.ready.then(refresh);
  reduced.addEventListener('change',()=>{
    if(reduced.matches)states.forEach(complete);
  });
  // Keyboard navigation never has to wait for a decorative reveal.
  document.addEventListener('focusin',event=>{
    if(!event.target.matches('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'))return;
    states.forEach(state=>{
      if(state.status!=='done'&&event.target.contains(state.element))complete(state);
    });
  });
  return {show,reflow(root){states.forEach(state=>{
    if(state.status==='pending'&&root.contains(state.element))prepare(state);
  });}};
}
