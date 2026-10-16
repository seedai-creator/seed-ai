import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_EXECUTION,parseExecution,recommendationFromDiagnosis,nextStep,relevantExecution,type ExecutionCommand} from '../src/lib/execution/domain';
const id='11111111-1111-4111-8111-111111111111',company='22222222-2222-4222-8222-222222222222';
const action={id,company_id:company,version:1,status:'TODO',strategy_id:'plan',position:1,title:'Analisar vendas perdidas',deadline:'2026-01-01'};
const snapshot={...EMPTY_EXECUTION,plans:[{id:'plan',company_id:company,version:1,status:'ACTIVE',objective:'Melhorar vendas'}],actions:[action]};
const command:ExecutionCommand={kind:'ACTION',target_type:'ACTION',target_id:id,version:1,scope:'CURRENT_COMPANY',assertion:'EXPLICIT',quote:'Analisei as vendas',status:'COMPLETED',description:null,reason:null,hypothesis:null,indicator:null,baseline:null,observed:null,target:null,unit:null,currency:null,start:null,end:null};
test('explicit contextual action is accepted; guesses, other companies, attachments and stale targets are rejected',()=>{
 assert.equal(parseExecution({commands:[command]},command.quote,snapshot,null).length,1);
 for(const c of [{...command,scope:'OTHER'},{...command,scope:'SIMULATION'},{...command,assertion:'AMBIGUOUS'}])assert.equal(parseExecution({commands:[c]},command.quote,snapshot,null).length,0);
 assert.equal(parseExecution({commands:[command]},command.quote,snapshot,null,true).length,0);
 assert.throws(()=>parseExecution({commands:[{...command,version:2}]},command.quote,snapshot,null));
 assert.throws(()=>parseExecution({commands:[command]},'Ainda não fiz',snapshot,null));
 assert.throws(()=>parseExecution({commands:[{...command,quote:''}]},'Ainda não fiz',snapshot,null));
 assert.equal(parseExecution({commands:[command]},command.quote,{...snapshot,allowed_operations:['RESULT']},null).length,0);
});
test('results preserve unknown and zero, reject invented numbers and incompatible periods',()=>{
 const result={...command,kind:'RESULT',status:'PARTIAL',description:'Ainda não medi',observed:null};
 assert.equal(parseExecution({commands:[result]},command.quote,snapshot,null)[0].observed,null);
 assert.throws(()=>parseExecution({commands:[{...result,observed:0}]},command.quote,snapshot,null));
 assert.equal(parseExecution({commands:[{...result,quote:'Tive 0 vendas',observed:0}]},'Tive 0 vendas',snapshot,null)[0].observed,0);
 assert.throws(()=>parseExecution({commands:[{...result,start:'2026-10-10',end:'2026-10-01'}]},command.quote,snapshot,null));
});
test('overdue never completes; explicit blocking and dependencies change the next action',()=>{
 assert.equal(nextStep(snapshot,new Date('2026-10-05'))?.overdue,true);assert.equal(action.status,'TODO');
 const second={...action,id:'second',position:2,title:'Ajustar abordagem'};
 assert.equal(nextStep({...snapshot,actions:[{...action,status:'BLOCKED'},second]})?.action?.id,'second');
 assert.equal(nextStep({...snapshot,actions:[{...action,status:'BLOCKED'},{...second,depends_on:[id]}]})?.blocked,true);
 assert.equal(nextStep({...snapshot,actions:[{...action,status:'COMPLETED'}]})?.review,true);
});
test('lifecycle start is not a result period and cannot invent an action deadline',()=>{
 const start={...command,status:'IN_PROGRESS',start:'2026-10-05',end:null};
 const parsed=parseExecution({commands:[start]},command.quote,snapshot,null)[0];
 assert.equal(parsed.start,null);assert.equal(parsed.end,null);assert.equal(start.start,'2026-10-05');
 const experiment={...action,status:'PLANNED',execution_status:'READY'};
 const e=parseExecution({commands:[{...start,kind:'EXPERIMENT_STATUS',target_type:'EXPERIMENT',status:'RUNNING'}]},command.quote,{...snapshot,experiments:[experiment]},null)[0];
 assert.equal(e.start,null);assert.equal(e.status,'RUNNING');
 const alias=parseExecution({commands:[{...start,kind:'EXPERIMENT_STATUS',target_type:'EXPERIMENT'}]},command.quote,{...snapshot,experiments:[experiment]},null)[0];
 assert.equal(alias.status,'RUNNING');
 assert.throws(()=>parseExecution({commands:[{...command,end:'2026-02-30'}]},command.quote,snapshot,null));
});
test('learning retrieval is bounded and relevant; withheld recommendations cannot become plans',()=>{
 const s={...snapshot,learnings:[{id:'payment',company_id:company,version:1,status:'ACTIVE',statement:'Parcelamento teve resultado inconclusivo'},{id:'other',company_id:company,version:1,status:'ACTIVE',statement:'Entrega atrasada'}]};
 assert.equal(relevantExecution(s,'Quero mudar o parcelamento').learnings.length,1);
 assert.equal(recommendationFromDiagnosis(null),null);
 assert.equal(parseExecution({commands:[{...command,kind:'REVIEW',target_type:'PLAN',target_id:'plan'}]},command.quote,snapshot,null).length,0);
});
test('withheld strategic review preserves explicit factual updates and does not authorize learning',()=>{
 const review={...command,kind:'REVIEW',target_type:'PLAN',target_id:'plan',status:'SUPERSEDED'};
 const commands=parseExecution({commands:[command,review]},command.quote,snapshot,null);
 assert.deepEqual(commands.map(c=>c.kind),['ACTION']);
 assert.throws(()=>parseExecution({commands:[{...review,extra:'invalid'}]},command.quote,snapshot,null));
});
