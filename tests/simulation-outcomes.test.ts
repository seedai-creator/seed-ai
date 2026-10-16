import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAssumptions,type ObservedResult} from '../src/lib/simulation/outcomes';
import type {Simulation} from '../src/lib/simulation/domain';
const simulation={extraction:{inputs:[{id:'cpl',label:'CPL',kind:'USER_ASSUMPTION',value:{min:10,max:10,approximate:false,unit:'MONEY_PER_UNIT',currency:'BRL',period:'ONCE',scope:'ads:meta'}}]}} as unknown as Simulation;
const result:ObservedResult={id:'result',metric_type:'CPL',description:'CPL subiu para 12.5',observed_value:12.5,unit:'MONEY_PER_UNIT',currency_code:'BRL',period_start:null,period_end:null,created_at:'2026-10-10T12:00:00Z'};
test('simulation result: CPL 25% above assumed baseline invalidates that assumption, not a universal strategy',()=>{
 const a=assessAssumptions(simulation,[result],'ads:meta','2026-10-06');assert.equal(a.length,1);assert.equal(a[0].status,'NOT_SUPPORTED');assert.equal(a[0].result_id,'result');
});
test('simulation result: unknown scope, currency, units, past observations and missing numbers stay unknown',()=>{
 for(const r of [{...result,currency_code:'EUR'},{...result,unit:'MONEY'},{...result,observed_value:null},{...result,created_at:'2026-09-01T00:00:00Z'},{...result,period_start:'2026-09-01',period_end:'2026-09-30'}])assert.equal(assessAssumptions(simulation,[r],'ads:meta','2026-10-06')[0].status,'UNKNOWN');
 assert.equal(assessAssumptions(simulation,[result],'ads:other','2026-10-06')[0].status,'UNKNOWN');
});
test('simulation result: matching calendar periods are required; daily results cannot satisfy monthly assumptions',()=>{
 const s=structuredClone(simulation);s.extraction.inputs[0].value.period='MONTH';
 assert.equal(assessAssumptions(s,[{...result,period_start:'2026-11-01',period_end:'2026-11-30',created_at:'2026-12-01'}],'ads:meta','2026-10-06')[0].status,'NOT_SUPPORTED');
 assert.equal(assessAssumptions(s,[{...result,period_start:'2026-11-01',period_end:'2026-11-01'}],'ads:meta','2026-10-06')[0].status,'UNKNOWN');
});
