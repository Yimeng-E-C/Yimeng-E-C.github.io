export const clamp = value => Math.max(0,Math.min(1,value));
export const smooth = value => {const t=clamp(value);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

// The resting grid reserves room for magnification. Pointer distances always use
// these coordinates, so neighbours cannot chase their own moving hit areas.
export function portraitGridLayout({width,height,progress,target,originalIndex=4}) {
  const mobile=width<=760;
  const bounds={left:mobile?12:48,right:width-(mobile?12:48),top:84,bottom:height-32};
  // Reserve the same full-size zoom envelope above and below every row.
  const zoomSpan=.70+.27*1.65;
  const side=Math.max(1,Math.min(width-(mobile?32:112),height-(mobile?172:160),(bounds.right-bounds.left)/zoomSpan,(bounds.bottom-bounds.top)/zoomSpan,900));
  const size=side*.27;
  const gap=side*.08;
  const span=size*3+gap*2;
  const centerX=width/2;
  const desiredY=mobile?Math.max(112,(height-side)*.40)+side/2:(bounds.top+bounds.bottom)/2;
  const centerY=Math.max(bounds.top+side*zoomSpan/2,Math.min(bounds.bottom-side*zoomSpan/2,desiredY));
  const left=centerX-span/2,top=centerY-span/2;
  const rest=Array.from({length:9},(_,index)=>({
    x:left+(index%3)*(size+gap),y:top+Math.floor(index/3)*(size+gap),size
  }));
  const travel=smooth((progress-.08)/.66);
  const tiles=Array.from({length:9},(_,index)=>{
    const row=Math.floor(index/3),column=index%3;
    const {x,y}=rest[index];
    if(index===originalIndex)return {x:mix(x,target.x,travel),y:mix(y,target.y,travel),size:mix(size,target.size,travel),presence:1,original:true};
    const delay=(row===1||column===1)?0:.015;
    const out=clamp((progress-.025-delay)/.23);
    // A slight anticipation, then shrink around its own centre. Reversible on scroll.
    const presence=out===1?0:1-(1.9*out*out*out-.9*out*out);
    return {x,y,size,presence,original:false};
  });
  return {
    tiles,rest,side,gap,cellSize:size,pitch:size+gap,left,top,centerX,centerY,
    bounds,
    travel,lensStrength:1-smooth((progress-.025)/.12)
  };
}

export function proximityWeight(distance,radius) {
  return radius>0?smooth(1-distance/radius):0;
}

// Directional movement is critically damped. A lower damping ratio on scale
// retains a restrained pop; release takes longer and does not rebound.
export function stepPortraitMotion(state,target,dt,channel='weight') {
  const releasing=channel==='weight'&&target<state.value;
  return stepPortraitSpring(state,target,dt,channel==='weight'?(releasing?10.2:12.5):11,channel==='weight'&&!releasing?.82:1);
}

export function stepPortraitSpring(state,target,dt,omega=19,damping=1) {
  const offset=state.value-target;
  if(damping<1){
    const frequency=omega*Math.sqrt(1-damping*damping);
    const decay=Math.exp(-damping*omega*dt);
    const cosine=Math.cos(frequency*dt),sine=Math.sin(frequency*dt);
    const momentum=(state.velocity+damping*omega*offset)/frequency;
    const wave=offset*cosine+momentum*sine;
    state.value=target+decay*wave;
    state.velocity=decay*(-damping*omega*wave-offset*frequency*sine+momentum*frequency*cosine);
  }else{
    const momentum=state.velocity+omega*offset;
    const decay=Math.exp(-omega*dt);
    state.value=target+(offset+momentum*dt)*decay;
    state.velocity=(state.velocity-omega*momentum*dt)*decay;
  }
  if(Math.abs(state.value-target)<.0001&&Math.abs(state.velocity)<.001){state.value=target;state.velocity=0;}
  return state.velocity!==0||state.value!==target;
}

// Local packing: distant portraits are anchored. Only nearby portraits can give
// way, with a distance-dependent movement budget. All constraints use the actual
// animated, rotated bounds, including the short scale overshoot.
export function portraitLensLayout(layout,poses,{magnification=.60,stationary=false,filter,dt=1/60,immediate=false}={}) {
  const strength=layout.lensStrength;
  const spacing=stationary?1:Math.max(3.5,layout.side*.007);
  const constrain=(value,low,high)=>Math.max(low,Math.min(high,value));
  // Filter the packing correction after the spring, where contact jitter starts.
  // Keeping it separate leaves the portrait's own pop responsive.
  if(filter){
    if(filter.side!==layout.side||immediate||stationary||strength===0)filter.samples=[];
    filter.side=layout.side;filter.moving=false;
  }
  const alpha=1-Math.exp(-Math.max(0,dt)/.085);
  const soften=(previous,target)=>Math.abs(target-previous)<.025?target:mix(previous,target,alpha);
  const nodes=poses.map((pose,index)=>{
    const rest=layout.rest[index];
    const weight=Math.max(0,Math.min(1.08,pose.weight))*strength;
    const activity=smooth(weight*3.5);
    const angle=stationary?0:pose.lean*4.2*strength*activity;
    const factor=Math.abs(Math.cos(angle*Math.PI/180))+Math.abs(Math.sin(angle*Math.PI/180));
    const rx=rest.x+rest.size/2,ry=rest.y+rest.size/2;
    const limit=stationary?0:layout.pitch*.18*activity*(1-smooth(weight));
    // Cap growth at its existing centre instead of pushing edge rows inward.
    const maxExtent=Math.max(1,2*Math.min(rx-layout.bounds.left,layout.bounds.right-rx,ry-layout.bounds.top,layout.bounds.bottom-ry));
    const slotExtent=stationary?2*(layout.pitch-spacing)-layout.cellSize:Infinity;
    const presence=layout.tiles[index].presence??1;
    const extent=Math.min(layout.cellSize*(1+magnification*weight)*factor*presence,maxExtent,slotExtent);
    const minX=Math.max(rx-limit,layout.bounds.left+extent/2),maxX=Math.min(rx+limit,layout.bounds.right-extent/2);
    const minY=Math.max(ry-limit,layout.bounds.top+extent/2),maxY=Math.min(ry+limit,layout.bounds.bottom-extent/2);
    const dx=stationary?0:pose.x*layout.cellSize*.070*strength*activity;
    const dy=stationary?0:pose.y*layout.cellSize*.050*strength*activity;
    return {
      rx,ry,cx:constrain(rx+dx,minX,maxX),cy:constrain(ry+dy,minY,maxY),
      minX,maxX,minY,maxY,extent,factor,angle,weight,
      freeX:constrain(rx+dx,minX,maxX),freeY:constrain(ry+dy,minY,maxY),desiredExtent:extent,presence,
      mobility:stationary?0:clamp(4*weight*(1-clamp(weight)))
    };
  });

  const pairs=[];
  nodes.forEach((a,i)=>nodes.slice(i+1).forEach((b,j)=>pairs.push([a,b,i,i+j+1])));
  for(let iteration=0;iteration<10;iteration++){
    let moved=false;
    for(const [a,b] of pairs){
      const required=(a.extent+b.extent)/2+spacing;
      const ox=required-Math.abs(b.cx-a.cx),oy=required-Math.abs(b.cy-a.cy);
      if(ox<=.001||oy<=.001)continue;
      const axis=ox<oy?'X':'Y',key=axis==='X'?'cx':'cy',restKey=axis==='X'?'rx':'ry';
      const direction=Math.sign(b[restKey]-a[restKey])||1;
      const aCapacity=Math.max(0,direction>0?a[key]-a['min'+axis]:a['max'+axis]-a[key]);
      const bCapacity=Math.max(0,direction>0?b['max'+axis]-b[key]:b[key]-b['min'+axis]);
      const need=(axis==='X'?ox:oy)+.02;
      const total=a.mobility+b.mobility;
      if(total===0)continue;
      let aMove=Math.min(aCapacity,need*a.mobility/total);
      const bMove=Math.min(bCapacity,need-aMove);
      aMove+=Math.min(aCapacity-aMove,Math.max(0,need-aMove-bMove));
      a[key]-=direction*aMove;b[key]+=direction*bMove;
      moved=moved||aMove+bMove>.001;
    }
    if(!moved)break;
  }

  if(filter)nodes.forEach((node,index)=>{
    const previous=filter.samples[index];
    const targetX=node.cx-node.freeX,targetY=node.cy-node.freeY;
    const enabled=!immediate&&!stationary&&strength>0&&node.weight>0;
    const x=enabled?soften(previous?.x??0,targetX):targetX;
    const y=enabled?soften(previous?.y??0,targetY):targetY;
    node.cx=constrain(node.freeX+x,node.minX,node.maxX);
    node.cy=constrain(node.freeY+y,node.minY,node.maxY);
    filter.moving=filter.moving||Math.abs(x-targetX)>.025||Math.abs(y-targetY)>.025;
    filter.samples[index]={x,y,shrink:enabled?(previous?.shrink??0):0};
  });

  // A short-lived pile-up from rapid pointer changes is resolved by reducing
  // only the conflicting local magnification. Shrinking cannot create a new
  // collision, and a distant anchored portrait keeps both its position and size.
  for(const [a,b] of pairs){
    let deficit=a.extent+b.extent-2*(Math.max(Math.abs(b.cx-a.cx),Math.abs(b.cy-a.cy))-spacing);
    if(deficit<=.001)continue;
    for(const floor of [1,.72]){
      const ca=a.weight>0?Math.max(0,a.extent-layout.cellSize*a.factor*a.presence*floor):0;
      const cb=b.weight>0?Math.max(0,b.extent-layout.cellSize*b.factor*b.presence*floor):0;
      if(ca+cb===0)continue;
      const amount=Math.min(deficit+.02,ca+cb);
      const da=amount*ca/(ca+cb),db=amount-da;
      a.extent-=da;b.extent-=db;deficit-=amount;
      if(deficit<=0)break;
    }
  }

  // Shrink immediately when needed for clearance; release that correction
  // gradually so repeated contact does not flicker between two sizes.
  if(filter)nodes.forEach((node,index)=>{
    const sample=filter.samples[index];
    const needed=node.desiredExtent-node.extent;
    const shrink=Math.max(needed,soften(sample.shrink,needed));
    node.extent=Math.max(0,node.desiredExtent-shrink);
    filter.moving=filter.moving||shrink-needed>.025;
    sample.shrink=shrink;
  });

  return nodes.map((node,index)=>{
    const rest=layout.rest[index],tile=layout.tiles[index];
    const dx=node.cx-node.rx,dy=node.cy-node.ry;
    const size=tile.size*(node.extent/node.factor/layout.cellSize);
    return {
      x:tile.x+tile.size/2+dx-size/2,
      y:tile.y+tile.size/2+dy-size/2,
      size,angle:node.angle,extent:size*node.factor
    };
  });
}
