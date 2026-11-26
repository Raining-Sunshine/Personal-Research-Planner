// Keep this controller outside row components: opening a modal can re-render
// and replace a row before the browser emits its compatibility click.
export function createEditGesture({schedule=setTimeout,unschedule=clearTimeout,now=Date.now,vibrate=()=>{}}={}){
 let active=null,timer=null,blocked=null;
 function cancel(){if(timer!==null)unschedule(timer);timer=null;active?.element?.removeAttribute('data-holding');active=null}
 return {
  start(e,activate){
   cancel();if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
   if(e.isPrimary===false)return;
   active={id:e.pointerId,x:e.clientX,y:e.clientY,element:e.currentTarget};
   blocked={x:e.clientX,y:e.clientY,until:now()+1000};
   active.element?.setAttribute('data-holding','true');
   timer=schedule(()=>{
    timer=null;if(!active||active.element?.isConnected===false){cancel();return}
    active.element?.removeAttribute('data-holding');
    blocked={x:active.x,y:active.y,until:now()+1000};
    try{vibrate(20)}catch{/* Haptics are optional, never a prerequisite for editing. */}
    activate();
   },500);
  },
  move(e){if(active&&e.pointerId===active.id&&Math.hypot(e.clientX-active.x,e.clientY-active.y)>10)cancel()},
  end(e){if(active&&e.pointerId===active.id){blocked={x:active.x,y:active.y,until:now()+700};cancel()}},
  secondPointer(e){if(active&&e.pointerId!==active.id)cancel()},
  cancel,
  blockClick(e){
   // Enter/Space and assistive-technology activation remain accessible.
   if(e.detail===0)return false;
   if(e.pointerType==='touch'||e.pointerType==='pen'||e.sourceCapabilities?.firesTouchEvents)return true;
   return !!(blocked&&now()<blocked.until&&Math.hypot(e.clientX-blocked.x,e.clientY-blocked.y)<24);
  },
  blockGhostClick(e){return e.detail!==0&&!!(blocked&&now()<blocked.until&&Math.hypot(e.clientX-blocked.x,e.clientY-blocked.y)<24)},
 };
}
