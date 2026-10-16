'use client';
import {useI18n} from '@/lib/i18n/provider';
import {goalLabels} from '@/lib/goals/labels';
import type {Amount} from '@/lib/goals/domain';
export function GoalWeeklySummary({rows}:{rows:{key:string;kind:string;value:string}[]}){
 const {locale}=useI18n(),l=goalLabels(locale);
 const summaries=rows.filter(r=>r.kind==='GOAL').slice(0,2).flatMap(row=>{try{const x=JSON.parse(row.value) as {title:string;trajectory:string;limitations:string[]};if(typeof x.title!=='string')return [];return [{...x,key:row.key}];}catch{return [];}});
 function calculated(key:string){const row=rows.find(r=>r.key===key);if(!row)return null;try{const x=JSON.parse(row.value) as Amount&{unit:string;currency:string|null};const n=(v:number)=>new Intl.NumberFormat(locale,{...(x.currency?{style:'currency' as const,currency:x.currency}:{}),maximumFractionDigits:2}).format(v)+(x.unit==='percent'?'%':'');return (x.approximate?'≈ ':'')+(x.value!==null?n(x.value):x.min!==null&&x.max!==null?n(x.min)+' – '+n(x.max):l.unknown);}catch{return null;}}
 if(!summaries.length)return null;
 return <section aria-label={l.title}><h3>{l.title}</h3>{summaries.map((x,i)=><div key={i}><p>{x.title}</p><p>{l[x.trajectory as keyof typeof l]??l.unknown}</p>{(['progress','gap'] as const).map(kind=>{const value=calculated('goal_'+kind+'_'+x.key.slice(5));return value?<p key={kind}>{l[kind]}: {value}</p>:null;})}{x.limitations?.length>0&&<small>{l.limitations}: {x.limitations.map(k=>l[(k==='approximate'?'approximate_limit':k) as keyof typeof l]??l.unknown).join(' ')}</small>}</div>)}<small>{l.reference}</small></section>;
}
