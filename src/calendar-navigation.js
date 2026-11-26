// Use a completed click/tap, never pointerdown, so swiping does not select days.
// Keep the first tap in an App ref: selecting a day re-renders the calendar.
export function dateActivation(previous,day,touch,now){
 if(!touch)return {open:true,last:null};
 const open=!!previous&&previous.day===day&&now-previous.time>=0&&now-previous.time<=400;
 return {open,last:open?null:{day,time:now}};
}
