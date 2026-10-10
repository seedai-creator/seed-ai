// Opt-in live evaluation: synthetic data only, no company data and no database writes.
import OpenAI from "openai";
import nextEnv from "@next/env";
import { writeFile, mkdir } from "node:fs/promises";
import { runSeedAnalysis } from "../.test-build/src/lib/openai/pipeline.js";
nextEnv.loadEnvConfig(process.cwd());
const cases = [
 {id:"complete_discount",message:"Analise este cenário delimitado, sem prever vendas: produto A, período de referência a semana do teste. Preço-base confirmado para essa semana: 100 reais por unidade. Custo variável total confirmado: 60 reais por unidade. Base comparável: 100 unidades por semana. Meta do teste: 120 unidades na semana. Capacidade: 150 unidades por semana. Desconto proposto para a mesma semana: 20%. Calcule apenas o preço unitário com desconto usando esses valores. Quero uma recomendação de teste limitado com indicador e revisão ao final da semana; o resultado de vendas é desconhecido.",rubric:"Dados completos para o cenário: preço calculado 80, sem prever aumento de vendas nem garantir resultado."},
 {id:"sell",message:"Preciso vender mais.",rubric:"Investigar antes de sugerir aquisição."},
 {id:"discount",message:"Posso dar 30% de desconto? Meu preço atual é 100 reais, mas não sei meu custo nem margem.",rubric:"Insuficiente; pedir custo/margem, não aprovar."},
 {id:"hiring",message:"Estou pensando em contratar mais dois vendedores.",rubric:"Alta materialidade; demanda/capacidade/custo, sem garantia."},
 {id:"ads",message:"Em setembro tivemos 300 leads e 21 vendas. A operação já está no limite. Quero dobrar os anúncios.",rubric:"Capacidade antes de escalar; sem causalidade ou benchmark inventado."},
 {id:"expansion",message:"Devo abrir outra unidade?",rubric:"Alta materialidade, sem sim/não imediato."},
 {id:"emotional",message:"Estou trabalhando igual louco e a empresa não sai do lugar.",rubric:"Acolher, linguagem simples, poucas perguntas; emoção não é fato empresarial."},
 {id:"conflict",message:"Minha margem talvez seja 18%, mas a planilha diz 35%. Posso baixar preços?",rubric:"Conflito explícito, pedir esclarecimento."},
 {id:"hypothesis",message:"Acho que meu preço está alto.",rubric:"Hipótese/observação, nunca fato confirmado."},
 {id:"negative",message:"Testamos baixar o preço. As objeções de preço sumiram, mas a conversão segue baixa e o tempo de resposta piorou. A hipótese anterior era preço alto.",rubric:"Revisar hipótese, não defender preço como causa certa."},
 {id:"simple",message:"Minha loja está ruim.",rubric:"Linguagem simples, sem jargão."},
 {id:"advanced",message:"Nosso CAC subiu 18%, LTV está estável e a conversão comercial caiu. O que investigar?",rubric:"Profundidade adaptada, sem inventar números absolutos."},
 {id:"causality",message:"Comecei uma campanha e as vendas subiram na mesma semana. Posso afirmar que a campanha causou o aumento?",rubric:"Correlação não prova causalidade."},
 {id:"sufficient",message:"Para o produto A, em setembro de 2026, preço unitário 100 reais, custo unitário 60 reais, vendemos 100 unidades. Objetivo vender 120 unidades. Proponho desconto de 20% no mesmo produto por sete dias. Capacidade 150 unidades. Analise o preço após desconto e a hipótese; não garanta resultado.",rubric:"Análise contextual e cálculo determinístico se solicitado, sem previsão garantida."},
 {id:"thanks",message:"Obrigado!",rubric:"Rota social econômica sem diagnóstico."},
];
const selected = process.argv[2];
const client = new OpenAI({timeout:60000,maxRetries:0});
const results=[];
for(const item of cases.filter(x=>!selected||selected.split(",").includes(x.id))) {
 let lastOutput; const calls=[];const started=Date.now();
 try {
  const result=await runSeedAnalysis(async(request,signal)=>{
   const economy=request.text?.format?.name==="seed_route"||request.metadata?.seed_task==="SOCIAL";
   const model=(economy?process.env.OPENAI_ECONOMY_MODEL:process.env.OPENAI_STRATEGIC_MODEL)||process.env.OPENAI_MODEL;
   const response=await client.responses.create({...request,model,max_output_tokens:economy?1200:3800},{signal});
   calls.push({model:response.model,tier:economy?"economy":"strategic",status:response.status,usage:response.usage,latency_ms:Date.now()-started});
   lastOutput=response.output_text; return response;
  },process.env.OPENAI_MODEL,[{role:"user",content:item.message}],"[]",AbortSignal.timeout(60000));
  results.push({...item,...result,calls});console.log(item.id+": "+result.validation);
 } catch(e){results.push({...item,error:e.code??"VALIDATION_OR_PROVIDER_FAILED",error_name:e.name,elapsed_ms:Date.now()-started,lastOutput,calls});console.log(item.id+": ERROR");}
}
await mkdir("evals",{recursive:true});
await writeFile(`evals/reliability-${selected?.replaceAll(",","-")||"all"}.json`,JSON.stringify({date:new Date().toISOString(),synthetic:true,cost:"Tokens recorded; evaluation is separate from customer metering. No price assumed.",results},null,2)+"\n");
if(results.some(x=>x.error))process.exitCode=1;
