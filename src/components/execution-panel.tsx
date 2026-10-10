"use client";
import {useEffect,useEffectEvent,useState} from 'react';
import {readExecution,acceptRecommendation} from '@/app/execution/actions';
import {EMPTY_EXECUTION,nextStep,type ExecutionSnapshot} from '@/lib/execution/domain';
import {useI18n} from '@/lib/i18n/provider';
export function ExecutionPanel({companyId,conversationId,version,mode,onContinue,onAccepted}:{companyId:string;conversationId:string;version:number;mode:'chat'|'plan';onContinue:(planId:string,prompt:string)=>void;onAccepted:()=>void}){
 const {t,locale}=useI18n();const [data,setData]=useState<ExecutionSnapshot>(EMPTY_EXECUTION),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const loaded=useEffectEvent((s:ExecutionSnapshot)=>{setData(s);setError('');});
 const failed=useEffectEvent(()=>setError(t('execution.error')));
 useEffect(()=>{let active=true;void readExecution(companyId).then(s=>{if(active)loaded(s);}).catch(()=>{if(active)failed();});return()=>{active=false;};},[companyId,conversationId,version]);
 const r=data.allowed_operations?.includes('ACCEPT')===false?undefined:data.recommendations.find(r=>r.status==='PROPOSED'&&(mode==='plan'||r.conversation_id===conversationId));
 const [simulationId,setSimulationId]=useState('');
 const candidates=(data.simulations??[]).filter(s=>s.conversation_id===r?.conversation_id&&!s.plan_id);
 const linkLabel=locale==='en-US'?'Link to chosen scenario':locale==='es-ES'?'Vincular al escenario elegido':'Vincular ao cenário escolhido';
 const noLink=locale==='en-US'?'No simulation link':locale==='es-ES'?'Sin vínculo con simulación':'Sem vínculo com simulação';
 const selector=candidates.length>0&&<label>{linkLabel}<select value={simulationId} onChange={e=>setSimulationId(e.target.value)} disabled={busy}><option value=''>{noLink}</option>{candidates.map(s=><option key={s.id} value={s.id}>{String(s.question).slice(0,100)}</option>)}</select></label>;
 const next=nextStep(data);const plan=next?.plan;const actions=data.actions.filter(a=>a.strategy_id===plan?.id).sort((a,b)=>Number(a.position)-Number(b.position));
 async function accept(){if(!r)return;setBusy(true);try{await acceptRecommendation(companyId,r.id,r.version,simulationId||undefined);setData(await readExecution(companyId));onAccepted();}catch{setError(t('execution.error'));}finally{setBusy(false);}}
 function continuePlan(){if(!plan||!next)return;const focus=String(next.action?.title??plan.current_focus??plan.name);const prompt=next.review?t('execution.reviewPrompt',{focus}):next.blocked?t('execution.blockPrompt',{focus}):t('execution.continuePrompt',{focus});onContinue(plan.id,prompt);}
 if(mode==='chat')return <>{r&&<div className="execution-cta">{selector}<button type="button" className="text-button" disabled={busy} onClick={accept}>{t('execution.create')}</button></div>}{error&&<p role="alert">{error}</p>}</>;
 return <section className="execution-plan" aria-label={t('core.plan')}>
 {error&&<p role="alert">{error}</p>}
 {!plan&&<><p>{t('execution.empty')}</p>{r&&<article><h2>{String(r.title)}</h2><p>{String(r.recommendation)}</p><p>{String(r.rationale_summary)}</p>{selector}<button className="primary-button" disabled={busy} onClick={accept}>{t('execution.create')}</button></article>}</>}
 {plan&&next&&<><p className="core-eyebrow">{t('execution.goal')}</p><h2>{String(plan.objective)}</h2><p className="core-eyebrow">{t('execution.focus')}</p><p>{String(plan.current_focus??plan.strategy)}</p>
 <h3>{t('execution.steps')}</h3><ol className="execution-steps">{actions.map(a=><li key={a.id}><span aria-hidden="true">{a.status==='COMPLETED'?'✓':a.status==='IN_PROGRESS'?'●':'○'}</span><div><strong>{String(a.title)}</strong><small>{t(('execution.'+a.status) as 'execution.TODO')}{a.deadline?' · '+new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(String(a.deadline)+'T12:00:00Z')):''}</small>{a.status==='BLOCKED'&&<p>{String(a.block_reason??'')}</p>}</div></li>)}</ol>
 <div className="execution-next"><p className="core-eyebrow">{next.review?t('execution.review'):t('execution.next')}</p><h3>{next.review?t('execution.resultQuestion'):String(next.action?.title??plan.current_focus??plan.name)}</h3>{next.overdue&&<p>{t('execution.overdue')}</p>}{next.blocked&&<p>{t('execution.blocked')}</p>}<button className="primary-button" onClick={continuePlan}>{t('execution.continue')}</button></div>
 {data.experiments.filter(e=>e.plan_id===plan.id&&['RUNNING','COMPLETED'].includes(String(e.execution_status))).map(e=><article key={e.id}><p className="core-eyebrow">{t('execution.test')}</p><h3>{String(e.name)}</h3><p>{String(e.start_date)} — {String(e.end_date)}</p><p>{t('execution.compareLater')}</p></article>)}
 {data.results.filter(r=>r.plan_id===plan.id).slice(0,3).map(r=><article key={r.id}><h3>{t('execution.observed')}</h3><p>{String(r.description)}</p><small>{t(r.status==='PARTIAL'?'execution.partial':'execution.reported')}</small></article>)}
 {data.learnings.filter(l=>l.plan_id===plan.id).slice(0,2).map(l=><article key={l.id}><h3>{t('execution.learned')}</h3><p>{String(l.statement)}</p><small>{t('execution.causality')}</small></article>)}
 </>}
 {data.plans.filter(p=>["COMPLETED","CANCELLED"].includes(p.status)).slice(0,2).map(p=><details key={p.id}><summary>{String(p.name)} · {t(p.status==="COMPLETED"?"execution.COMPLETED":"execution.CANCELLED")}</summary>{data.learnings.filter(l=>l.plan_id===p.id).map(l=><p key={l.id}>{String(l.statement)}</p>)}<button className="text-button" onClick={()=>onContinue(p.id,t("execution.reviewPrompt",{focus:String(p.name)}))}>{t("execution.continue")}</button></details>)}
 </section>;
}
