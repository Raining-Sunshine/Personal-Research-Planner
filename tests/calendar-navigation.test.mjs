import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateActivation,needsDateSelection} from '../src/calendar-navigation.js';
test('phone compatibility clicks including detail zero always select before opening',()=>{
 for(const [event,environment] of [
  [{detail:0,pointerType:'touch'},{}],
  [{detail:0},{mobileLayout:true}],
  [{detail:1,pointerType:'mouse'},{coarsePointer:true}],
  [{detail:0},{lastPointer:'touch'}],
  [{detail:1,sourceCapabilities:{firesTouchEvents:true}},{}]
 ]){
  const touch=needsDateSelection(event,environment);assert.equal(touch,true);
  const first=dateActivation(null,'2026-11-26',touch);assert.equal(first.open,false);
  assert.equal(dateActivation(first.last,'2026-11-26',touch).open,true);
 }
});
test('selection has no timer, changing dates selects again, view reset disarms default highlight',()=>{
 const first=dateActivation(null,'2026-11-26',true);
 assert.deepEqual(first,{open:false,last:{day:'2026-11-26'}});
 const other=dateActivation(first.last,'2026-11-27',true);assert.equal(other.open,false);
 assert.equal(dateActivation(other.last,'2026-11-27',true).open,true);
 assert.equal(dateActivation(null,'2026-11-27',true).open,false);
});
test('desktop mouse and keyboard still open immediately',()=>{
 for(const event of [{detail:1,pointerType:'mouse'},{detail:0}]){
  assert.equal(needsDateSelection(event),false);
  assert.deepEqual(dateActivation(null,'2026-11-26',false),{open:true,last:null});
 }
});
