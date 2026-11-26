import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditGesture} from '../src/edit-gesture.js';
function fixture(){let now=0,next=0,opened=0,haptics=0;const timers=new Map(),attrs=new Map();const el={isConnected:true,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const g=createEditGesture({now:()=>now,schedule:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id},unschedule:id=>timers.delete(id),vibrate:()=>haptics++});
 const e={pointerType:'touch',pointerId:1,isPrimary:true,clientX:100,clientY:100,currentTarget:el};
 return {g,e,attrs,el,start:()=>g.start(e,()=>opened++),advance(ms){now+=ms;for(const [id,t] of timers)if(t.at<=now){timers.delete(id);t.fn()}},get opened(){return opened},get haptics(){return haptics}};
}
test('short taps never edit, long holds edit once and their follow-up click is suppressed',()=>{
 const f=fixture();f.start();f.advance(499);assert.equal(f.opened,0);f.g.end(f.e);f.advance(500);assert.equal(f.opened,0);
 f.start();assert.equal(f.attrs.get('data-holding'),'true');f.advance(500);assert.equal(f.opened,1);assert.equal(f.haptics,1);assert.equal(f.attrs.has('data-holding'),false);f.advance(1000);assert.equal(f.opened,1);
 f.g.end(f.e);assert.equal(f.g.blockGhostClick({...f.e,detail:1}),true);assert.equal(f.g.blockGhostClick({...f.e,clientX:300,detail:1}),false);assert.equal(f.g.blockGhostClick({...f.e,detail:0}),false);
});
test('scroll movement, cancellation, second finger and detached elements cannot open the editor',()=>{
 for(const cancel of [f=>f.g.move({...f.e,clientY:112}),f=>f.g.cancel(),f=>f.g.secondPointer({...f.e,pointerId:2}),f=>f.el.isConnected=false]){const f=fixture();f.start();cancel(f);f.advance(600);assert.equal(f.opened,0);assert.equal(f.haptics,0)}
});
test('small finger drift is tolerated, mouse and keyboard keep click editing',()=>{
 const f=fixture();f.start();f.g.move({...f.e,clientY:106});f.advance(500);assert.equal(f.opened,1);
 const m=fixture();m.g.start({...m.e,pointerType:'mouse'},()=>{throw Error('mouse hold must not trigger')});m.advance(600);
 assert.equal(m.g.blockClick({...m.e,pointerType:'mouse',detail:1}),false);assert.equal(m.g.blockClick({...m.e,detail:0}),false);assert.equal(m.g.blockClick({...m.e,detail:1}),true);
});
