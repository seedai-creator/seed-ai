import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {simulateCostCohorts} from './cost-cohorts.mjs';

if(process.argv.length!==3)throw Error('Provide a reviewed configuration snapshot JSON path.');
const snapshot=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));
const report=simulateCostCohorts(snapshot);
const rows=snapshot.usage_summary;
if(!Array.isArray(rows)||rows.some(r=>!Number.isSafeInteger(r.samples)||r.samples<1||!Number.isSafeInteger(r.unknown_costs)||r.unknown_costs<0||r.unknown_costs>r.samples))throw Error('Aggregate usage is incomplete');
report.historicalUsage={note:'Thirty-day historical aggregate, includes engineering tests and old configurations; not representative of beta users. P95 excludes unknown costs. Cache values are recorded estimates, not invoice verification.',
 unknownCostRows:rows.reduce((sum,r)=>sum+r.unknown_costs,0),
 knownRecordedCacheSavingsUsd:rows.reduce((sum,r)=>sum+(r.cache_savings_usd??0),0),
 groupsWithUnknownCacheSavings:rows.filter(r=>r.cache_savings_usd===null).length,
 groups:rows.map(r=>({plan:r.plan_code,feature:r.feature,model:r.model,samples:r.samples,unknownCosts:r.unknown_costs,averageUsd:r.average_usd,p95Usd:r.p95_usd,maxUsd:r.max_usd,recordedCacheSavingsUsd:r.cache_savings_usd}))};
const directory=new URL('../.test-build/phase-13-private-reports/',import.meta.url);
await mkdir(directory,{recursive:true});
await writeFile(new URL('COST_COHORTS.json',directory),JSON.stringify(report,null,2)+'\n');
const table=['| Plano | Usuários | Cenário | Demanda USD | Média USD | P95 USD | Teto compartilhado / 30 dias USD | Demanda acima do teto USD |','| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |',
 ...report.scenarios.map(r=>`| ${r.plan} | ${r.users} | ${r.scenario} | ${r.demandTotalUsd.toFixed(2)} | ${r.demandAverageUsd.toFixed(4)} | ${r.demandP95Usd.toFixed(4)} | ${r.sharedReservationCeilingUsd.toFixed(2)} | ${r.demandAboveSharedCeilingUsd.toFixed(2)} |`)];
await writeFile(new URL('COST_COHORTS.md',directory),`# Fase 13 — cenários de orçamento de IA\n\nConfiguração observada: ${report.capturedAt}. Simulação sem chamadas pagas e sem alterar limites. Não é previsão financeira nem garantia de consumo.\n\n${table.join('\n')}\n\nFREE usa franquia vitalícia; PRO usa um ciclo hipotético de 30 dias. O teto global é compartilhado por todos os usuários e recursos. Os cenários são independentes. A distribuição mista é uma hipótese explícita no JSON; a média e o p95 representam demanda simulada antes do teto global.\n\nCustos por recurso e economia de cache registrados estão no JSON. A amostra inclui testes de engenharia e configurações antigas; não representa uso normal nem comprova preços atuais do provedor. Custos desconhecidos não são tratados como zero.\n\nNão inclui infraestrutura, taxas, impostos ou câmbio. Avaliar orçamento global antes de ampliar a coorte; nenhum orçamento foi ampliado por este relatório.\n`);
console.log(JSON.stringify({scenarios:report.scenarios.length,unknownCostRows:report.historicalUsage.unknownCostRows,privateReport:'.test-build/phase-13-private-reports/COST_COHORTS.md',paidCalls:0}));
