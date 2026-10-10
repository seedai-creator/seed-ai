'use client';
import {useI18n} from '@/lib/i18n/provider';
import {externalLabels} from '@/lib/external/labels';
import {publicUrl} from '@/lib/external/domain';
export function ExternalWeeklySources({rows}:{rows:{source_id:string;value:string}[]}){
 const {locale}=useI18n(),l=externalLabels(locale);
 if(!rows.length)return null;
 return <section><h3>{l.findings}</h3>{rows.map(row=>{try{const r=JSON.parse(row.value) as {findings:{text:string;claimIds:string[]}[];claims:{id:string;sourceIds:string[]}[];sources:{id:string;url:string;at:string}[]};return <div key={row.source_id}>{r.findings.slice(0,2).map((f,i)=><p key={i}>{f.text} {[...new Set(f.claimIds.flatMap(id=>r.claims.find(c=>c.id===id)?.sourceIds??[]))].map(id=>{const s=r.sources.find(s=>s.id===id);return s&&publicUrl(s.url)?<a key={id} href={s.url} target="_blank" rel="noopener noreferrer"> [{id}]</a>:null;})}</p>)}</div>;}catch{return null;}})}</section>;
}
