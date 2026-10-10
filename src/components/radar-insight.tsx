'use client';
import {useEffect,useState} from 'react';
import {useI18n} from '@/lib/i18n/provider';
import {radarLabels} from '@/lib/radar/narrative';
import {readRadarHome,readRadarPreference,setRadarPreference,radarFeedback} from '@/app/radar/actions';
export function RadarInsight({companyId,active,onAnalyze,onCorrect}:{companyId:string;active:boolean;onAnalyze:(id:string,prompt:string)=>void;onCorrect:(view:'company'|'memory')=>void}){
 const {locale}=useI18n(),l=radarLabels(locale);const [insight,setInsight]=useState<Awaited<ReturnType<typeof readRadarHome>>>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{if(!active)return;let alive=true;void readRadarHome(companyId).then(v=>{if(alive)setInsight(v);}).catch(()=>{if(alive)setInsight(null);});return()=>{alive=false;};},[companyId,locale,active]);
 async function act(action:'INVESTIGATING'|'DISMISSED'|'RESOLVED',feedback:'NOT_RELEVANT'|'WRONG_CONTEXT'|'ALREADY_KNOWN'|null=null){if(!insight)return;setBusy(true);setError(false);try{await radarFeedback(companyId,insight.id,action,feedback);if(action==='INVESTIGATING')onAnalyze(insight.id,insight.prompt);if(feedback==='WRONG_CONTEXT')onCorrect(insight.correctionView);setInsight(null);}catch{setError(true);}finally{setBusy(false);}}
 if(!active||!insight)return null;
 return <aside className="radar-card" aria-label={insight.title}><p className="core-eyebrow">{insight.title}</p><p>{insight.summary}</p><small>{insight.scope}</small><details><summary>{l.evidence}</summary>{insight.evidence.map((e,i)=><p key={i}><strong>{e.label}</strong><br/>{e.text}{e.reference&&<><br/>{e.reference}</>}{e.externalSources.map(s=><span key={s.url}><br/><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> · {new Intl.DateTimeFormat(locale).format(new Date(s.at))}</span>)}</p>)}<p>{insight.why}</p></details><div className="radar-actions"><button className="text-button" disabled={busy} onClick={()=>void act('INVESTIGATING')}>{l.analyze} →</button><details><summary aria-label={l.settings}>⋯</summary><button disabled={busy} onClick={()=>void act('DISMISSED','NOT_RELEVANT')}>{l.dismiss}</button><button disabled={busy} onClick={()=>void act('DISMISSED','ALREADY_KNOWN')}>{l.known}</button><button disabled={busy} onClick={()=>void act('DISMISSED','WRONG_CONTEXT')}>{l.wrong}</button><button disabled={busy} onClick={()=>void act('RESOLVED')}>{l.resolve}</button></details></div>{error&&<p role="alert">{l.error}</p>}</aside>;
}
export function RadarPreference({companyId}:{companyId:string}){
 const {locale}=useI18n(),l=radarLabels(locale);const [enabled,setEnabled]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{let alive=true;void readRadarPreference(companyId).then(v=>{if(alive)setEnabled(v.proactive_insights_enabled);}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[companyId]);
 async function save(value:boolean){setBusy(true);setError(false);try{await setRadarPreference(companyId,value);setEnabled(value);}catch{setError(true);}finally{setBusy(false);}}
 return <fieldset className="radar-preference"><legend>{l.settings}</legend><label><input type="checkbox" checked={enabled===true} disabled={enabled===null||busy} onChange={e=>void save(e.target.checked)}/>{l.enabled}</label>{error&&<p role="alert">{l.error}</p>}</fieldset>;
}
