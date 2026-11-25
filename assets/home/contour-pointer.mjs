// A critically damped position filter; energy comes from the filtered velocity,
// so raw pointer-event bursts cannot suddenly distort the field.
export function createContourPointer() {
  const x={value:0,velocity:0,target:0},y={value:0,velocity:0,target:0};
  let energy=0;
  function advance(state,dt){
    const omega=6,offset=state.value-state.target,momentum=state.velocity+omega*offset,decay=Math.exp(-omega*dt);
    state.value=state.target+(offset+momentum*dt)*decay;
    state.velocity=(state.velocity-omega*momentum*dt)*decay;
  }
  return {
    point(px,py){
      if(Math.hypot(px-x.target,py-y.target)<.0006)return;
      x.target=Math.max(-.5,Math.min(.5,px));y.target=Math.max(-.5,Math.min(.5,py));
    },
    step(dt,still=false){
      if(still){x.value=y.value=x.velocity=y.velocity=energy=0;return {x:0,y:0,energy:0};}
      advance(x,dt);advance(y,dt);
      const target=Math.min(1.2,Math.hypot(x.velocity,y.velocity)*.9);
      energy+=(target-energy)*(1-Math.exp(-dt/(target>energy?.24:.6)));
      return {x:x.value,y:y.value,energy};
    }
  };
}
