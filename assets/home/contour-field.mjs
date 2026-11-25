import {flowPose,sampleFlow} from './contour-flow.mjs?v=d6f60d73512e';
import {createContourPointer} from './contour-pointer.mjs?v=d6f60d73512e';

// Original continuous contour field, with locally changing shape and density.
const mix=(a,b,t)=>a+(b-a)*t;
const levels=[-.64,-.37,-.13,.12,.36,.63];
const weights=[.56,.90,.64,1,.74,.46];

function strokeContour(ctx,values,columns,rows,step,level) {
  const stride=columns+1,vertices=new Map();
  const valueAt=(x,y)=>values[y*stride+x];
  function vertex(key,x1,y1,x2,y2) {
    if(vertices.has(key))return key;
    const a=valueAt(x1,y1),b=valueAt(x2,y2);
    const t=Math.max(0,Math.min(1,(level-a)/(b-a||1)));
    vertices.set(key,{x:mix(x1,x2,t)*step,y:mix(y1,y2,t)*step,links:[]});
    return key;
  }
  function connect(a,b) {
    vertices.get(a).links.push(b);vertices.get(b).links.push(a);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
    const a=valueAt(x,y),b=valueAt(x+1,y),c=valueAt(x+1,y+1),d=valueAt(x,y+1);
    const corners=[a>=level,b>=level,c>=level,d>=level];
    const edges=[];
    if(corners[0]!==corners[1])edges.push(vertex(`h${x}:${y}`,x,y,x+1,y));
    if(corners[1]!==corners[2])edges.push(vertex(`v${x+1}:${y}`,x+1,y,x+1,y+1));
    if(corners[2]!==corners[3])edges.push(vertex(`h${x}:${y+1}`,x,y+1,x+1,y+1));
    if(corners[3]!==corners[0])edges.push(vertex(`v${x}:${y}`,x,y,x,y+1));
    if(edges.length===2)connect(edges[0],edges[1]);
    else if(edges.length===4) {
      // Resolve saddle cells consistently as the surface deforms.
      const centre=(a+b+c+d)/4>=level;
      if(centre===corners[0]){connect(edges[0],edges[1]);connect(edges[2],edges[3]);}
      else {connect(edges[0],edges[3]);connect(edges[1],edges[2]);}
    }
  }
  const visited=new Set();
  ctx.beginPath();
  function trace(key) {
    if(visited.has(key))return;
    const start=key,points=[];
    let closed=false;
    while(key!==undefined&&!visited.has(key)) {
      visited.add(key);
      const point=vertices.get(key);points.push(point);
      const next=point.links.find(link=>!visited.has(link));
      if(next===undefined){closed=points.length>2&&point.links.includes(start);break;}
      key=next;
    }
    if(points.length<2)return;
    // Quadratic joins remove the angular appearance of the sampling grid.
    if(closed) {
      const first=points[0],last=points.at(-1);
      ctx.moveTo((last.x+first.x)/2,(last.y+first.y)/2);
      points.forEach((point,index)=>{
        const next=points[(index+1)%points.length];
        ctx.quadraticCurveTo(point.x,point.y,(point.x+next.x)/2,(point.y+next.y)/2);
      });
      ctx.closePath();
    } else {
      ctx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length-1;i++) {
        const point=points[i],next=points[i+1];
        ctx.quadraticCurveTo(point.x,point.y,(point.x+next.x)/2,(point.y+next.y)/2);
      }
      const end=points.at(-1);ctx.lineTo(end.x,end.y);
    }
  }
  // Open curves first, then any remaining closed contours.
  vertices.forEach((point,key)=>{if(point.links.length===1)trace(key);});
  vertices.forEach((_,key)=>trace(key));
  ctx.stroke();
}

export function mountContourField(canvas) {
  const ctx=canvas?.getContext('2d',{alpha:true});
  if(!ctx)return {resize(){},setView(){},point(){},paint(){}};
  const ink=document.createElement('canvas'),lineCtx=ink.getContext('2d',{alpha:true});
  const tone=document.createElement('canvas'),toneCtx=tone.getContext('2d',{alpha:true});
  let width=1,height=1,dpr=1,step=24,columns=1,rows=1,values=new Float32Array(4);
  let pixels;
  let dark=0,targetDark=0,initial=true,scroll=0,targetScroll=0;
  const pointer=createContourPointer();
  let areas=[],impulse=0,previousScroll=0,lastPaint;

  function resize(w,h) {
    width=w;height=h;dpr=Math.min(devicePixelRatio||1,w<=760?1.25:1.5);
    for(const surface of [canvas,ink]){surface.width=Math.round(w*dpr);surface.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);lineCtx.setTransform(dpr,0,0,dpr,0,0);
    step=Math.max(16,Math.min(27,Math.min(w,h)/30));
    columns=Math.ceil(w/step);rows=Math.ceil(h/step);
    values=new Float32Array((columns+1)*(rows+1));
    tone.width=columns+1;tone.height=rows+1;
    pixels=toneCtx.createImageData(tone.width,tone.height);
  }

  function wash(context,x,y,rx,ry,colour,opacity) {
    context.save();context.translate(x,y);context.scale(rx,ry);
    const gradient=context.createRadialGradient(0,0,0,0,0,1);
    gradient.addColorStop(0,`rgba(${colour},${opacity})`);
    gradient.addColorStop(.5,`rgba(${colour},${opacity*.38})`);
    gradient.addColorStop(1,`rgba(${colour},0)`);
    context.fillStyle=gradient;context.fillRect(-1,-1,2,2);context.restore();
  }

  function paint(milliseconds,still=false) {
    const dt=lastPaint===undefined?1/30:Math.min(.1,Math.max(0,(milliseconds-lastPaint)/1000));
    lastPaint=milliseconds;
    dark=still?targetDark:mix(dark,targetDark,1-Math.exp(-dt*4));
    const filteredPointer=pointer.step(dt,still);
    scroll=still?0:mix(scroll,targetScroll,1-Math.exp(-dt*3));
    impulse=still?0:impulse*Math.exp(-dt*2.1);
    const time=still?0:milliseconds/1000;
    const scale=Math.min(width,height)*.92;
    const pose=flowPose(time,scroll,{x:filteredPointer.x*width/scale,y:filteredPointer.y*height/scale,energy:filteredPointer.energy},impulse);
    ctx.clearRect(0,0,width,height);lineCtx.clearRect(0,0,width,height);

    // Broad tonal regions follow the same eddies as the lines, rather than
    // drifting in an unrelated, uniformly moving gradient.
    wash(ctx,width*(.35+pose.ax*.16),height*(.35+pose.ay*.14),
      width*.73,height*.79,'117,130,92',mix(.025,.065,dark));
    wash(ctx,width*(.72+pose.bx*.12),height*(.7+pose.by*.16),
      width*.68,height*.76,'12,20,13',mix(.014,.07,dark));

    for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++) {
      const u=(x*step-width*.5)/scale,v=(y*step-height*.5)/scale;
      const index=y*(columns+1)+x,value=sampleFlow(u,v,pose);
      values[index]=value;
      const density=Math.min(1,Math.abs(value)*1.35);
      const positive=value>=0;
      pixels.data[index*4]=positive?126:12;
      pixels.data[index*4+1]=positive?142:20;
      pixels.data[index*4+2]=positive?88:13;
      pixels.data[index*4+3]=Math.round(density*density*mix(7,positive?23:31,dark));
    }
    toneCtx.putImageData(pixels,0,0);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(tone,0,0,tone.width,tone.height,-step/2,-step/2,(columns+1)*step,(rows+1)*step);
    const colour=[mix(105,151,dark),mix(119,164,dark),mix(91,126,dark)].map(Math.round).join(',');
    lineCtx.lineCap='round';lineCtx.lineJoin='round';
    levels.forEach((level,index)=>{
      lineCtx.lineWidth=index===3?1.05:.78;
      lineCtx.strokeStyle=`rgba(${colour},${mix(.24,.22,dark)*weights[index]})`;
      strokeContour(lineCtx,values,columns,rows,step,level);
    });

    // Reduce only the line layer around visible copy, keeping the open areas richer.
    lineCtx.globalCompositeOperation='destination-out';
    areas.forEach(area=>wash(lineCtx,area.x,area.y,Math.max(120,area.w*.66),Math.max(100,area.h*.8),'0,0,0',.5));
    lineCtx.globalCompositeOperation='source-over';
    ctx.drawImage(ink,0,0,ink.width,ink.height,0,0,width,height);
  }

  return {
    resize,paint,
    point:pointer.point,
    setView(isDark,pageScroll,readingAreas) {
      if(!initial)impulse=Math.max(-1,Math.min(1,impulse+(pageScroll-previousScroll)/Math.max(height,1)*.8));
      previousScroll=pageScroll;
      targetDark=isDark?1:0;targetScroll=pageScroll*.00004;areas=readingAreas;
      if(initial){dark=targetDark;scroll=targetScroll;initial=false;}
    }
  };
}
