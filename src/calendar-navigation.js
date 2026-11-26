// Some mobile browsers emit compatibility clicks with detail=0 or omit
// pointerType. Do not interpret either as proof of a mouse/keyboard click.
export function needsDateSelection(event,{mobileLayout=false,coarsePointer=false,lastPointer=''}={}){
 return mobileLayout||coarsePointer||event.pointerType==='touch'||event.pointerType==='pen'||event.sourceCapabilities?.firesTouchEvents===true||lastPointer==='touch'||lastPointer==='pen';
}
// This is select-then-open, not a timed double-click. The initially highlighted
// date still needs a first deliberate tap; changing views resets the selection arm.
export function dateActivation(previous,day,touch){
 if(!touch)return {open:true,last:null};
 const open=previous?.day===day;
 return {open,last:open?null:{day}};
}
