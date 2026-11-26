import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,validateState,overlaps,daysBetween,addDays,nextMilestone} from '../src/model.js';
import {createHandler} from '../src/server.js';
test('date arithmetic crosses month, leap day, and year boundaries',()=>{assert.equal(addDays('2024-02-28',1),'2024-02-29');assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(daysBetween('2026-11-26','2026-12-03'),7)});
test('multi-day tasks appear on both range endpoints',()=>{const i={start:'2026-11-20',end:'2026-11-27'};assert.ok(overlaps(i,'2026-11-27','2026-11-27'));assert.ok(!overlaps(i,'2026-11-28','2026-11-28'))});
test('document validation rejects invalid dates, orphan tasks and invalid color',()=>{assert.ok(validateState(seed()));for(const patch of [{start:'2026-02-30'},{projectId:null},{color:'red'},{end:'2000-01-01'}]){const d=seed();Object.assign(d.items[0],patch);assert.equal(validateState(d),false)}});
test('next milestone keeps overdue incomplete items visible',()=>{const p={id:'p'},items=[{projectId:'p',type:'milestone',start:'2026-11-01',done:false},{projectId:'p',type:'milestone',start:'2026-12-01',done:false}];assert.equal(nextMilestone(p,items),items[0]);items[0].done=true;assert.equal(nextMilestone(p,items),items[1])});
