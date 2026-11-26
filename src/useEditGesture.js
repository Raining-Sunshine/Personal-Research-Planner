import {useEffect,useRef} from 'react';
import {createEditGesture} from './edit-gesture.js';
export function useEditGesture(){
 const ref=useRef(null);
 if(!ref.current)ref.current=createEditGesture({vibrate:ms=>navigator.vibrate?.(ms)});
 useEffect(()=>{
  const g=ref.current;
  const click=e=>{if(g.blockGhostClick(e)){e.preventDefault();e.stopImmediatePropagation()}};
  const visibility=()=>{if(document.hidden)g.cancel()};
  document.addEventListener('pointerdown',g.secondPointer,true);
  document.addEventListener('pointermove',g.move,{passive:true});
  document.addEventListener('pointerup',g.end,true);
  document.addEventListener('pointercancel',g.cancel,true);
  document.addEventListener('scroll',g.cancel,true);
  document.addEventListener('click',click,true);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('blur',g.cancel);
  return()=>{g.cancel();document.removeEventListener('pointerdown',g.secondPointer,true);document.removeEventListener('pointermove',g.move);document.removeEventListener('pointerup',g.end,true);document.removeEventListener('pointercancel',g.cancel,true);document.removeEventListener('scroll',g.cancel,true);document.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',g.cancel)};
 },[]);
 return activate=>({
  'data-edit-gesture':true,
  'aria-describedby':'edit-gesture-hint',
  onPointerDown:e=>ref.current.start(e,activate),
  onPointerLeave:()=>ref.current.cancel(),
  onContextMenu:e=>{if(window.matchMedia('(any-pointer: coarse)').matches)e.preventDefault()},
  onDoubleClick:e=>{e.stopPropagation();e.preventDefault()},
  onClick:e=>{e.stopPropagation();if(ref.current.blockClick(e)){e.preventDefault();return}activate()},
 });
}
