import {mountSmoothScroll} from '../modules/smooth-scroll.mjs?v=d6f60d73512e';
import {mountJourney} from './journey.mjs?v=d6f60d73512e';
import {mountOpening} from './opening.mjs?v=d6f60d73512e';
import {mountPhotoRails} from './photo-rail.mjs?v=d6f60d73512e';
import {mountCareerTimeline} from './career-timeline.mjs?v=d6f60d73512e';
import {mountTextReveals} from './text-reveal.mjs?v=d6f60d73512e';
import {mountContourField} from './contour-field.mjs?v=d6f60d73512e';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = matchMedia('(hover: hover) and (pointer: fine)');
const canvas = document.querySelector('#contours');
const background = mountContourField(canvas);
const scenes = [...document.querySelectorAll('[data-scene]')];
const readingAreas = [...document.querySelectorAll('.intro-profile,.education-copy,.professional-records,.highlight-caption,.collection-title')];
const textReveals = mountTextReveals();
const journey = mountJourney(document.querySelector('.journey'), textReveals);
const opening = mountOpening(document.querySelector('.opening'));
const rails = mountPhotoRails();
const career = mountCareerTimeline(document.querySelector('.professional-section'), textReveals);

let width=innerWidth,height=innerHeight,raf=0,lastFrame=0,elapsed=0,dirty=true,disposed=false;
let dark=false;
let smoothAbort;
let observer;

function size() {
  width=innerWidth;height=innerHeight;
  background.resize(width,height);
  dirty=true;
}
function position() {
  journey.update(!reduced.matches);
  const openingProgress=opening.update(!reduced.matches);
  career.update(!reduced.matches);
  const sample=height*.45;
  let active=scenes[0];
  for(const section of scenes){if(section.getBoundingClientRect().top<=sample)active=section;}
  const nextDark=active?.dataset.scene==='dark'||(active?.classList.contains('opening')&&openingProgress>.42);
  if(nextDark!==dark){dark=nextDark;document.body.classList.toggle('dark-scene',dark);}
  const areas=readingAreas.map(element=>element.getBoundingClientRect())
    .filter(rect=>rect.bottom>0&&rect.top<height&&rect.width&&rect.height)
    .slice(0,5).map(rect=>({x:rect.left+rect.width/2,y:rect.top+rect.height/2,w:rect.width,h:rect.height}));
  background.setView(dark,scrollY,areas);
  dirty=false;
}
function tick(now){
  if(disposed||document.hidden)return;
  const delta=now-lastFrame;
  if(delta>=1000/(width<=760?24:30)){lastFrame=now;elapsed+=Math.min(delta,60);if(dirty)position();background.paint(elapsed);opening.paint(elapsed);}
  if(!reduced.matches)raf=requestAnimationFrame(tick);
}
function requestUpdate(){dirty=true;if(reduced.matches){position();background.paint(0,true);}}
function configure(){
  cancelAnimationFrame(raf);smoothAbort?.abort();observer?.disconnect();
  document.body.classList.toggle('motion-on',!reduced.matches);
  const items=[...document.querySelectorAll('[data-arrive]')];
  items.forEach(el=>el.classList.remove('awaiting','arrived'));
  if(!reduced.matches&&'IntersectionObserver' in window){
    observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting){target.classList.remove('awaiting');target.classList.add('arrived');observer.unobserve(target);}}),{rootMargin:'0px 0px -8% 0px',threshold:0});
    items.forEach(el=>{if(el.getBoundingClientRect().top>=height){el.classList.add('awaiting');observer.observe(el);}});
  }
  if(!reduced.matches&&pointer.matches){smoothAbort=new AbortController();mountSmoothScroll({signal:smoothAbort.signal}).catch(()=>{});}
  size();position();background.paint(elapsed,reduced.matches);lastFrame=performance.now();
  requestAnimationFrame(()=>document.body.classList.add('scene-ready'));
  if(!reduced.matches&&!document.hidden)raf=requestAnimationFrame(tick);
}
window.addEventListener('scroll',requestUpdate,{passive:true});
window.addEventListener('resize',()=>{size();requestUpdate();},{passive:true});
window.addEventListener('pointermove',event=>{if(pointer.matches)background.point(event.clientX/width-.5,event.clientY/height-.5);},{passive:true});
document.addEventListener('pointerleave',()=>background.point(0,0));
document.addEventListener('focusin',event=>event.target.closest('[data-arrive]')?.classList.remove('awaiting'));
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);if(document.hidden){smoothAbort?.abort();}else configure();});
reduced.addEventListener('change',configure);pointer.addEventListener('change',configure);
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);smoothAbort?.abort();observer?.disconnect();opening.pause();});
window.addEventListener('pageshow',event=>{if(event.persisted){disposed=false;configure();}});
document.fonts?.ready.then(()=>{rails.refresh();requestUpdate();});
configure();
