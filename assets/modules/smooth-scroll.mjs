// Optional adapter, independently written for upstream Lenis 1.1.20.
// Default off. Reuses the browser's native touch and anchor behavior.
export async function mountSmoothScroll({signal} = {}) {
  const {default: Lenis} = await import('../vendor/lenis/lenis.mjs');
  if (signal?.aborted) return () => {};
  const lenis = new Lenis({lerp:0.09, smoothWheel:true, syncTouch:false});
  let frame = 0;
  const tick = time => { lenis.raf(time); frame = requestAnimationFrame(tick); };
  frame = requestAnimationFrame(tick);
  let destroyed = false;
  const dispose = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    lenis.destroy();
    signal?.removeEventListener('abort', dispose);
  };
  signal?.addEventListener('abort', dispose, {once:true});
  return dispose;
}
