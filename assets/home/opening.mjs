import {mountPortraitGrid} from './portrait-grid.mjs?v=d6f60d73512e';
import {mountRibbons} from './ribbon-motion.mjs?v=d6f60d73512e';
const clamp = v => Math.min(1, Math.max(0, v));
const smooth = v => v*v*(3-2*v);
export function mountOpening(root) {
  const stage = root.querySelector('.opening-stage');
  const portraits = mountPortraitGrid(root.querySelector('[data-shared-portrait]'));
  const heroCopy = [...root.querySelectorAll('[data-hero-copy]')];
  const introCopy = [...root.querySelectorAll('[data-intro-copy]')];
  const ribbons = [...root.querySelectorAll('[data-ribbon]')];
  const marquee=mountRibbons(root);
  const ribbonGroup = root.querySelector('.opening-ribbons');
  const profile = root.querySelector('.intro-profile');
  let previous;
  return { update(motion) {
    if(previous!==motion){
      previous=motion;root.classList.toggle('is-enhanced',motion);root.classList.toggle('is-static',!motion);
      if(motion)stage.style.removeProperty('height');
    }
    const p=motion?clamp(-root.getBoundingClientRect().top/Math.max(1,root.offsetHeight-stage.offsetHeight)):0;
    const w=stage.clientWidth,mobile=w<=760;
    const h=motion?stage.clientHeight:Math.max(innerHeight,mobile?630:650);
    const size=mobile?Math.min(w*.62,260,h*.28):Math.min(w*.30,h*.38,390);
    const gap=mobile?16:28;
    const top=mobile?Math.max(80,h*.12):Math.max(98,(h-size-gap-profile.offsetHeight)/2);
    const target={x:(w-size)/2,y:top,size};
    const original=portraits.update({progress:p,width:w,height:h,target,motion});
    const profileTop=motion?top+size+gap:original.gridBottom+32;
    if(!motion)stage.style.height=`${profileTop+profile.offsetHeight+60}px`;
    root.style.setProperty('--profile-top',`${profileTop}px`);
    // Desktop ribbons follow only the original; mobile keeps a lower text band.
    const ribbonCentre=mobile?Math.max(h*.84,profileTop+profile.offsetHeight+22+ribbonGroup.offsetHeight/2):original.y+original.size/2;
    root.style.setProperty('--ribbons-top',`${ribbonCentre}px`);
    const fade=motion?smooth(clamp((p-.67)/.16)):1;
    heroCopy.forEach(el=>el.style.opacity=String(1-smooth(clamp(p/.3))));
    introCopy.forEach(el=>el.style.opacity=String(fade));
    profile.inert=fade<.95;
    ribbons.forEach(el=>{
      el.parentElement.style.opacity=String(fade);
    });
    const bounds=stage.getBoundingClientRect();
    marquee.setActive(motion&&fade>0&&bounds.bottom>0&&bounds.top<innerHeight);
    return p;
  },paint(now){marquee.paint(now,scrollY);},pause(){marquee.setActive(false);portraits.pause();}};
}
