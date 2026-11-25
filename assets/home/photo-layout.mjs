// Flat, overlapping composition. Photo count is data-driven rather than fixed.
export function galleryLayout(count, width, cardWidth, cardHeight, active = null, ratios = [], enlargement = 1, viewportHeight = Infinity) {
  if(count < 1)return [];
  const middle=(count-1)/2;
  const edge=Math.min(24,cardWidth*.06+6);
  const limit=Math.max(0,(width-cardWidth)/2-edge);
  const step=count>1?Math.min(cardWidth*.57,limit*2/(count-1)):0;
  const ratio=Number.isFinite(ratios[active])&&ratios[active]>0?ratios[active]:1;
  const zoom=Number.isFinite(enlargement)?Math.max(1,Math.min(2,enlargement)):1;
  const thumbnailWidth=Math.min(cardWidth*.78,width*.24);
  // Reserve a visible 70% of each adjacent thumbnail, even on narrow rails.
  const peek=thumbnailWidth*.7;
  const leftReserve=active>0?peek:0;
  const rightReserve=active!==null&&active<count-1?peek:0;
  const maxWidth=Math.max(1,Math.min(cardWidth*1.65*zoom,(width-edge*2-leftReserve-rightReserve)/1.04));
  const maxHeight=zoom>1?Math.min(cardHeight*zoom,viewportHeight*.86/1.04):cardHeight;
  const fullWidth=Math.min(maxWidth,maxHeight*ratio,(ratio>=1?cardWidth*ratio:cardWidth)*zoom);
  const fullHeight=fullWidth/ratio;
  const activeHalf=fullWidth*1.04/2;
  const activeX=active===null?0:Math.max(-width/2+edge+leftReserve+activeHalf,
    Math.min(width/2-edge-rightReserve-activeHalf,(active-middle)*step));
  return Array.from({length:count},(_,i)=>{
    let x=i===active?activeX:(i-middle)*step;
    const distance=active===null?0:Math.abs(i-active);
    if(active!==null&&i!==active){
      const side=Math.sign(i-active);
      const adjacentX=activeX+side*(activeHalf-thumbnailWidth/2+peek);
      const outerX=side*(width/2-edge-thumbnailWidth/2);
      const remaining=side<0?active-1:count-active-2;
      const spread=remaining>0?Math.min(thumbnailWidth*.2,Math.abs(outerX-adjacentX)/remaining):0;
      x=adjacentX+side*(distance-1)*spread;
    }
    const scale=i===active?1.04:1;
    const w=i===active?fullWidth:active===null?cardWidth:thumbnailWidth,h=i===active?fullHeight:w;
    const bound=Math.max(0,(width-w*scale)/2-6);
    x=Math.max(-bound,Math.min(bound,x));
    return {x,y:i===active?-Math.min(16,cardHeight*.045):0,scale,width:w,height:h,
      z:active===null?count-i:i===active?count*2+5:count*2-distance*2+(i<active?1:0),
      delay:active===null?Math.min(Math.abs(i-middle)*18,100):0};
  });
}
