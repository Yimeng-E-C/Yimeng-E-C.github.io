// Flat, overlapping composition. Photo count is data-driven rather than fixed.
export function galleryLayout(count, width, cardWidth, cardHeight, active = null, ratios = []) {
  if(count < 1)return [];
  const middle=(count-1)/2;
  const edge=Math.min(24,cardWidth*.06+6);
  const limit=Math.max(0,(width-cardWidth)/2-edge);
  const step=count>1?Math.min(cardWidth*.57,limit*2/(count-1)):0;
  const ratio=Number.isFinite(ratios[active])&&ratios[active]>0?ratios[active]:1;
  const maxWidth=Math.max(1,Math.min(cardWidth*1.65,width-edge*2));
  const maxHeight=cardHeight;
  const fullWidth=Math.min(maxWidth,maxHeight*ratio,ratio>=1?cardWidth*ratio:cardWidth);
  const fullHeight=fullWidth/ratio;
  return Array.from({length:count},(_,i)=>{
    let x=(i-middle)*step;
    const distance=active===null?0:Math.abs(i-active);
    if(active!==null&&i!==active){
      const edgeWeight=count<3?.7:.35+.65*Math.sin(Math.PI*i/(count-1));
      x+=Math.sign(i-active)*(cardWidth*.34+Math.max(0,fullWidth-cardWidth)*.5)*Math.exp(-(distance-1)*.55)*edgeWeight;
      x=Math.max(-limit,Math.min(limit,x));
    }
    const scale=i===active?1.04:1;
    const w=i===active?fullWidth:cardWidth,h=i===active?fullHeight:cardWidth;
    const bound=Math.max(0,(width-w*scale)/2-6);
    x=Math.max(-bound,Math.min(bound,x));
    return {x,y:i===active?-Math.min(16,cardHeight*.045):0,scale,width:w,height:h,
      z:i===active?count+5:count-Math.ceil(Math.abs(i-middle)),delay:active===null?Math.min(Math.abs(i-middle)*18,100):Math.min(distance*18,100)};
  });
}
