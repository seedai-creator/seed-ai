import {externalEnabled} from '@/lib/external/domain';
import {externalObservability} from '@/lib/external/server';
import {requireAdmin} from '@/lib/commercial/server';
export async function ExternalOperations(){
 if(!externalEnabled())return null;await requireAdmin();const data=await externalObservability().catch(()=>null);
 if(!data)return <p>Dados operacionais da pesquisa externa indisponíveis.</p>;
 const total=data.runs.length,completed=data.runs.filter(r=>r.status==='COMPLETED').length,partial=data.runs.filter(r=>r.status==='PARTIAL').length,failed=data.runs.filter(r=>r.status==='FAILED').length;
 const known=data.runs.filter(r=>r.estimated_cost!==null),cost=known.reduce((s,r)=>s+Number(r.estimated_cost),0);
 return <section><h2>Pesquisa externa</h2><p>Amostra das últimas {total} pesquisas: {completed} completas · {partial} parciais · {failed} falhas.</p><p>Fontes registradas: {data.runs.reduce((s,r)=>s+r.source_count,0)} · Chamadas web: {data.runs.reduce((s,r)=>s+r.tool_calls,0)}</p><p>Custo conhecido da amostra: US$ {cost.toFixed(4)}. Custo ainda desconhecido em {total-known.length} pesquisas.</p><p>Feedback recebido: {data.events.filter(e=>e.kind==='research_feedback').length} · Aberturas de fontes: {data.events.filter(e=>e.kind==='sources_viewed').length}</p></section>;
}
