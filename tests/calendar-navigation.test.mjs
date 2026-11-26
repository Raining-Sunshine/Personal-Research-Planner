import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateActivation} from '../src/calendar-navigation.js';
test('mouse opens immediately; touch requires two completed taps on the same date',()=>{
 assert.deepEqual(dateActivation(null,'2026-11-26',false,100),{open:true,last:null});
 const first=dateActivation(null,'2026-11-26',true,100);
 assert.equal(first.open,false);
 assert.deepEqual(dateActivation(first.last,'2026-11-26',true,400),{open:true,last:null});
 assert.equal(dateActivation(first.last,'2026-11-27',true,400).open,false);
 assert.equal(dateActivation(first.last,'2026-11-26',true,600).open,false);
 assert.equal(dateActivation(null,'2026-11-26',true,400).open,false);
});
