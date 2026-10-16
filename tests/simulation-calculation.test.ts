import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,interval,divide,multiply,normalizePeriod,displayQuantity,displayCalculation,type Quantity} from '../src/lib/simulation/calculation';
const q=(value:number,unit:Quantity['unit'],period:Quantity['period']='ONCE',max=value,approximate=false):Quantity=>({...interval(value,max,approximate),unit,period,currency:['MONEY','MONEY_PER_UNIT'].includes(unit)?'BRL':null,scope:'product:A'});
const price=(v:number)=>q(v,'MONEY_PER_UNIT');
const volume=(v:number)=>q(v,'UNITS','MONTH');
const money=(v:number)=>q(v,'MONEY','MONTH');
const ratio=(v:number)=>q(v,'RATIO');
test('simulator: price change produces conditional 11000 / 10450 / 9900, never a prediction',()=>{
 const changed=calculate('CHANGED_PRICE',{price:price(100),change_ratio:ratio(.1)}).output;
 for(const [units,expected] of [[100,11000],[95,10450],[90,9900]]){
  const r=calculate('REVENUE',{price:changed,volume:volume(units)});
  assert.ok(Math.abs(r.output.min-expected)<1e-9);assert.equal(r.version,'1.0.1');assert.equal(r.output.period,'MONTH');
 }
});
test('simulator: conditional volume reduction feeds revenue and contribution without an invented input',()=>{
 const reduced=calculate('REDUCED_VOLUME',{volume:volume(100),loss_ratio:ratio(.1)});
 assert.equal(reduced.output.min,90);assert.equal(reduced.output.period,'MONTH');assert.equal(reduced.output.unit,'UNITS');
 assert.deepEqual(reduced.limitations,['CONDITIONAL_VOLUME_NOT_A_FORECAST']);
 assert.equal(calculate('REVENUE',{price:price(110),volume:reduced.output}).output.min,9900);
 assert.equal(calculate('TOTAL_CONTRIBUTION',{price:price(110),variable_cost:price(60),volume:reduced.output}).output.min,4500);
 const range=calculate('REDUCED_VOLUME',{volume:{...volume(100),max:120,approximate:true},loss_ratio:{...ratio(.1),max:.2}}).output;
 assert.equal(range.min,80);assert.equal(range.max,108);assert.equal(range.approximate,true);
 assert.equal(calculate('REDUCED_VOLUME',{volume:volume(100),loss_ratio:ratio(1)}).output.min,0);
 assert.throws(()=>calculate('REDUCED_VOLUME',{volume:volume(100),loss_ratio:ratio(1.1)}),/INVALID_RATIO/);
 assert.throws(()=>calculate('REDUCED_VOLUME',{volume:money(100),loss_ratio:ratio(.1)}),/EXPECTED_UNITS/);
 assert.throws(()=>calculate('REDUCED_VOLUME',{volume:volume(100),loss_ratio:{...ratio(.1),scope:'other'}}),/SCOPE_MISMATCH/);
});

test('simulator: discount distinguishes revenue from contribution and required whole sales',()=>{
 const current=calculate('TOTAL_CONTRIBUTION',{price:price(200),variable_cost:price(120),volume:volume(100)}).output;
 const discounted=calculate('CHANGED_PRICE',{price:price(200),change_ratio:ratio(-.2)}).output;
 const contribution=calculate('CONTRIBUTION_PER_UNIT',{price:discounted,variable_cost:price(120)}).output;
 assert.equal(current.min,8000);assert.equal(discounted.min,160);assert.equal(contribution.min,40);
 assert.equal(calculate('REQUIRED_REVENUE_VOLUME',{baseline_revenue:money(20000),new_price:discounted}).output.min,125);
 assert.equal(calculate('REQUIRED_CONTRIBUTION_VOLUME',{baseline_contribution:current,new_contribution_per_unit:contribution}).output.min,200);
});
test('simulator: fully loaded hiring cost and contribution determine break-even, not new sales',()=>{
 const r=calculate('HIRING_BREAK_EVEN_SALES',{fully_loaded_cost:money(6500),contribution_per_sale:price(400)});
 assert.equal(r.output.min,16.25);assert.equal(Math.ceil(r.output.max),17);
 assert.equal(displayCalculation(r,'pt-BR'),'17');assert.equal(r.output.min,16.25);
 assert.equal(calculate('BREAK_EVEN_REVENUE',{additional_cost:money(6500),contribution_ratio:ratio(.4)}).output.min,16250);
});
test('simulator: incremental contribution compares losses without rejecting signed results',()=>{
 const result=calculate('INCREMENTAL_CONTRIBUTION',{scenario_contribution:money(-100),baseline_contribution:money(-500),additional_cost:money(50)});
 assert.equal(result.output.min,350);
 assert.throws(()=>calculate('INCREMENTAL_CONTRIBUTION',{scenario_contribution:money(100),baseline_contribution:money(500),additional_cost:money(-50)}),/NEGATIVE_INPUT/);
});
test('simulator: marketing makes CPL and conversion conditional; no hidden scale elasticity',()=>{
 const leads=calculate('MARKETING_LEADS',{spend:money(10000),conditional_cpl:{...price(10),max:15}});
 assert.equal(leads.output.max,1000);assert.ok(leads.output.min>666&&leads.output.min<667);
 assert.deepEqual(leads.limitations,['CONDITIONAL_CPL_NOT_A_FORECAST']);
 const sales=calculate('MARKETING_SALES',{conditional_leads:leads.output,conditional_conversion:ratio(.1)});
 assert.equal(sales.output.max,100);assert.ok(sales.output.min<67);
});
test('simulator: capacity exposes overflow and preserves approximation',()=>{
 const cap={...volume(1000),approximate:true};
 const util=calculate('CAPACITY_UTILIZATION',{required_volume:volume(1200),capacity:cap}).output;
 const gap=calculate('CAPACITY_GAP',{required_volume:volume(1200),capacity:cap}).output;
 assert.equal(util.min,1.2);assert.equal(gap.min,200);assert.equal(gap.approximate,true);
 assert.match(displayQuantity(gap,'pt-BR'),/^≈ /);
});
test('simulator: payback counts contribution periods without confusing revenue and profit',()=>{
 const r=calculate('SIMPLE_PAYBACK',{investment:q(100000,'MONEY'),incremental_period_contribution:money(5000)});
 assert.equal(r.output.min,20);assert.equal(r.output.period,'MONTH');
 assert.throws(()=>calculate('SIMPLE_PAYBACK',{investment:money(100000),incremental_period_contribution:money(5000)}),/PAYBACK_REQUIRES/);
});
test('simulator: intervals retain bounds and do not replace them by midpoint',()=>{
 assert.deepEqual(multiply(interval(100,120,true),interval(20,30)),interval(2000,3600,true));
 assert.deepEqual(divide(interval(100,120),interval(2,4)),interval(25,60));
 assert.throws(()=>divide(interval(1),interval(-1,1)),/ZERO_DENOMINATOR/);
 assert.throws(()=>interval(10,5),/INVALID_RANGE/);assert.throws(()=>interval(Infinity),/INVALID_RANGE/);
});
test('simulator: currency, scope, dimensions, negative inputs and period mismatch fail closed',()=>{
 assert.throws(()=>calculate('TOTAL_CONTRIBUTION',{price:price(100),variable_cost:{...price(60),currency:'EUR'},volume:volume(100)}),/CURRENCY_MISMATCH/);
 assert.throws(()=>calculate('REVENUE',{price:price(100),volume:{...volume(100),scope:'product:B'}}),/SCOPE_MISMATCH/);
 assert.throws(()=>calculate('CAPACITY_GAP',{required_volume:volume(100),capacity:q(20,'UNITS','WEEK')}),/PERIOD_MISMATCH/);
 assert.throws(()=>calculate('REVENUE',{price:price(100),volume:money(100)}),/EXPECTED_UNITS/);
 assert.throws(()=>calculate('REVENUE',{price:price(-10),volume:volume(100)}),/NEGATIVE_INPUT/);
 assert.throws(()=>calculate('MARKETING_SALES',{conditional_leads:volume(100),conditional_conversion:ratio(1.2)}),/INVALID_RATIO/);
 assert.throws(()=>calculate('HIRING_BREAK_EVEN_SALES',{fully_loaded_cost:money(100),contribution_per_sale:price(0)}),/NON_POSITIVE/);
});
test('simulator: explicit normalization preserves scope/currency and forbids silent 30-day months',()=>{
 assert.equal(normalizePeriod(money(100),'YEAR').min,1200);
 assert.equal(normalizePeriod(q(70,'UNITS','WEEK'),'DAY').min,10);
 assert.throws(()=>normalizePeriod(money(100),'DAY'),/EXPLICIT_PERIOD_DURATION/);
 const normalized=normalizePeriod(money(310),'DAY',{source:31,target:1});assert.equal(normalized.min,10);assert.equal(normalized.currency,'BRL');
 assert.throws(()=>normalizePeriod(price(100),'MONTH'),/NON_RECURRING/);
});
test('simulator: immutable audit inputs and localized, approximate presentation',()=>{
 const p=price(100);const r=calculate('REVENUE',{price:p,volume:volume(100)});p.min=1;
 assert.equal(r.inputs.price.min,100);
 const approximate=q(12345,'MONEY','MONTH',23456,true);
 assert.match(displayQuantity(approximate,'en-US'),/≈ R\$/);
 assert.match(displayQuantity(approximate,'pt-BR'),/12\.000/);
 for(const locale of ['pt-BR','pt-PT','en-US','es-ES'])assert.ok(displayQuantity(r.output,locale).length>0);
});
