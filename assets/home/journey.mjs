// Original choreography: centered education opens into a quiet horizontal gallery.
const clamp = value => Math.min(1, Math.max(0, value));
const phase = (p,a,b) => clamp((p-a)/(b-a));
const smooth = t => t*t*(3-2*t);
export function mountJourney(root, textReveals) {
  const stage=root.querySelector('.journey-stage');
  const copy=root.querySelector('.education-copy');
  const title=root.querySelector('[data-align-line]');
  const records=[...root.querySelectorAll('[data-education-record]')].map(el=>[...el.querySelectorAll('[data-record-line]')]);
  const lines=[title,...records.flat()];
  const gallery=root.querySelector('.education-gallery-wrap');
  let previous,lastCopyWidth;
  return {update(motion){
    if(previous!==motion){previous=motion;root.classList.toggle('is-enhanced',motion);}
    if(!motion){
      [root,copy,gallery,...lines].forEach(el=>el.removeAttribute('style'));
      gallery.inert=false;
      return;
    }
    const p=clamp(-root.getBoundingClientRect().top/Math.max(1,root.offsetHeight-stage.offsetHeight));
    const shift=smooth(phase(p,.38,.64));
    root.classList.toggle('education-aligned',shift>.5);
    const width=stage.clientWidth,mobile=width<=760;
    const startW=Math.min(900,width*.9),endW=width*(mobile?.9:.35);
    const copyW=startW+(endW-startW)*shift;
    const left=(width-startW)/2+((width*(mobile?.05:.06))-(width-startW)/2)*shift;
    root.style.setProperty('--education-shift',String(shift));
    copy.style.width=`${copyW}px`;
    copy.style.left=`${left}px`;
    if(lastCopyWidth===undefined||Math.abs(copyW-lastCopyWidth)>1){
      lastCopyWidth=copyW;textReveals.reflow(copy);
    }
    lines.forEach(el=>{const x=(1-shift)*Math.max(0,(copy.clientWidth-el.offsetWidth)/2);el.style.transform=`translate3d(${x}px,0,0)`;});
    records.forEach((record,index)=>record.forEach((el,line)=>{
      const appear=smooth(phase(p,.015+index*.09+line*.012,.065+index*.09+line*.012));
      if(el.hasAttribute('data-text-reveal')){
        el.style.removeProperty('opacity');
        if(el.getBoundingClientRect().top<innerHeight)textReveals.show(el);
      }else el.style.opacity=String(appear);
    }));
    const entered=smooth(phase(p,mobile?.59:.40,mobile?.78:.66));
    gallery.style.transform=`translate3d(${(1-entered)*width*.75}px,0,0)`;
    gallery.style.opacity=String(entered);
    gallery.inert=entered<.95;
  }};
}
