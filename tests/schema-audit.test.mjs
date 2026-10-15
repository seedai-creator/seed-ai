import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSchema} from '../scripts/schema-audit.mjs';
const fixture=()=>({tables:{company:{rls:true,policies:{own:{using:'owner = uid()'}},grants:{anon:false}}},functions:{'save()':{bodyHash:'digest',securityDefiner:true,grants:{anon:false,authenticated:true}}}});
test('schema audit distinguishes missing objects, altered authorization and unrelated tables',()=>{
 const expected=fixture(),actual=fixture();
 actual.tables.landing={rls:true};
 assert.equal(compareSchema(expected,actual).matches,true);
 assert.equal(compareSchema(expected,actual).extra.length,1);
 actual.tables.company.rls=false;
 actual.functions['save()'].grants.anon=true;
 let result=compareSchema(expected,actual);
 assert.equal(result.matches,false);
 assert.deepEqual(result.changed.map(r=>r.field),['rls','grants']);
 delete actual.functions['save()'];
 result=compareSchema(expected,actual);
 assert.equal(result.missing[0].name,'save()');
 assert.equal(result.migrationHistoryRepaired,false);
});
test('comparison ignores JSON key order, but not body drift, null settings or missing evidence',()=>{
 const actual=fixture();actual.functions['save()'].grants={authenticated:true,anon:false};
 assert.equal(compareSchema(fixture(),actual).matches,true);
 actual.functions['save()'].bodyHash='changed';
 assert.equal(compareSchema(fixture(),actual).matches,false);
 assert.throws(()=>compareSchema({tables:{},functions:{}},actual));
 assert.throws(()=>compareSchema(fixture(),{}));
});
