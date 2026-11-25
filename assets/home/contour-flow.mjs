// Independently authored coherent flow: evolving noise, drifting local eddies,
// and an eased composition. No reference-site shaders or artwork are included.
const mix = (a, b, t) => a + (b - a) * t;
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const gradients = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];

function hash(x, y, z) {
  let h = Math.imul(x, 1597334677) ^ Math.imul(y, 3812015801) ^ Math.imul(z, 958689347);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}
function dot(x, y, z, dx, dy, dz) {
  const g = gradients[hash(x,y,z) % gradients.length];
  return g[0]*dx + g[1]*dy + g[2]*dz;
}
export function flowNoise(x, y, z) {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const dx=x-ix,dy=y-iy,dz=z-iz,fx=fade(dx),fy=fade(dy),fz=fade(dz);
  const front=mix(
    mix(dot(ix,iy,iz,dx,dy,dz),dot(ix+1,iy,iz,dx-1,dy,dz),fx),
    mix(dot(ix,iy+1,iz,dx,dy-1,dz),dot(ix+1,iy+1,iz,dx-1,dy-1,dz),fx),fy);
  const back=mix(
    mix(dot(ix,iy,iz+1,dx,dy,dz-1),dot(ix+1,iy,iz+1,dx-1,dy,dz-1),fx),
    mix(dot(ix,iy+1,iz+1,dx,dy-1,dz-1),dot(ix+1,iy+1,iz+1,dx-1,dy-1,dz-1),fx),fy);
  return mix(front,back,fz);
}

function wander(time, period, seed) {
  const phase=time/period,index=Math.floor(phase);
  const a=hash(index,seed,17)/4294967295*2-1;
  const b=hash(index+1,seed,17)/4294967295*2-1;
  return mix(a,b,fade(phase-index));
}

export function flowPose(seconds, scroll=0, pointer={x:0,y:0,energy:0}, impulse=0) {
  const t=seconds+23;
  const angle=.52*wander(t,17.3,81);
  return {
    cosine:Math.cos(angle),sine:Math.sin(angle),
    zoom:1.36+.42*wander(t+9,14.7,36),
    x:.84*wander(t,12.9,41),y:.72*wander(t+5,18.3,73)+scroll,
    z:seconds*.095+.55*wander(t,11.6,16),
    warp:.72+.30*wander(t,10.1,27),
    ax:.92*wander(t,9.7,62),ay:.85*wander(t+12,13.4,29),
    bx:.96*wander(t+5,16.1,55),by:.86*wander(t,10.9,94),
    spinA:.50+.50*wander(t+4,8.3,47),
    spinB:-.48+.38*wander(t+9,12.1,68),
    radius:1.5+.65*wander(t,13.7,19),
    pointerX:pointer.x,pointerY:pointer.y,pointerEnergy:pointer.energy,
    impulse,
  };
}

export function sampleFlow(u, v, pose) {
  const {cosine:c,sine:s,zoom,z}=pose;
  let x=(u*c-v*s)*zoom+pose.x;
  let y=(u*s+v*c)*zoom+pose.y;
  const a=x-pose.ax,b=y-pose.ay,d=x-pose.bx,e=y-pose.by;
  const first=pose.spinA*Math.exp(-(a*a+b*b)*pose.radius);
  const second=pose.spinB*Math.exp(-(d*d+e*e)*1.3);
  x-=b*first+e*second;
  y+=a*first+d*second;
  const px=u-pose.pointerX,py=v-pose.pointerY;
  const wake=pose.pointerEnergy*Math.exp(-(px*px+py*py)*4.6);
  x-=py*wake*.85;
  y+=px*wake*.85+pose.impulse*.18*Math.exp(-(u*u+v*v)*.7);
  const wx=x+pose.warp*flowNoise(x*.82+4.1,y*.82-7.2,z*.67+5.3);
  const wy=y+pose.warp*flowNoise(x*.78-8.6,y*.78+2.9,z*.59-3.7);
  return 1.48*flowNoise(wx*.91,wy*.91,z)
    +.42*flowNoise(wx*2.08+13.4,wy*2.08-5.6,z*1.23+4.8)
    +.13*flowNoise(wx*4.32-3.7,wy*4.32+11.2,z*1.6+8.4);
}
