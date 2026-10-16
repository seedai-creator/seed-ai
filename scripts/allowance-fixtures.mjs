// Fictional business data only. No customer data, provider calls or plan activation.
export const market={user_language:'pt-BR',company_preferred_language:null,company_country:'BR',company_currency:'BRL',company_locale:'pt-BR',company_timezone:'America/Sao_Paulo'};
export const companies=[
 {name:'Oficina Cedro',segment:'oficina mecânica',leads:100,sales:20,problem:'Levamos dois dias para responder aos orçamentos e não fazemos acompanhamento.'},
 {name:'Padaria Ipê',segment:'padaria',leads:200,sales:80,problem:'Sobra pão no fim da tarde, mas ainda não medimos a perda por produto.'},
 {name:'Estúdio Jacarandá',segment:'estúdio de design',leads:40,sales:4,problem:'Temos somente dois profissionais e os projetos atuais ocupam toda a semana.'},
 {name:'Loja Araucária',segment:'loja de roupas',leads:150,sales:30,problem:'Não registramos os motivos de desistência das compras.'},
 {name:'Marcenaria Jatobá',segment:'marcenaria',leads:30,sales:6,problem:'As entregas estão atrasando; queremos entender a capacidade antes de vender mais.'}
];
export const memoryFor=c=>JSON.stringify([
 {key:'company_name',value:c.name,kind:'FACT'},
 {key:'segment',value:c.segment,kind:'FACT'},
 {key:'reported_last_month',value:`No mês passado: ${c.leads} pedidos de orçamento e ${c.sales} vendas. ${c.problem}`,kind:'FACT'}
]);
export const freeMessages=[
 'Tenho uma empresa e preciso vender mais. Por onde começo?',
 'Tenho a Oficina Cedro, uma oficina mecânica. No mês passado recebemos 100 pedidos de orçamento e fechamos 20 vendas. Levamos dois dias para responder e não fazemos acompanhamento. Quero começar sem aumentar os anúncios.',
 'Vou acompanhar os orçamentos pendentes nos próximos sete dias. Eu serei o responsável. Organize um primeiro plano simples, com no máximo três ações, um indicador e uma data de revisão. Ainda não tenho dados de margem.'
];
export function longHistory(){
 const result=[];
 for(let i=0;i<10;i++)result.push(
  {role:'user',content:`Registro ${i+1} da Oficina Cedro. `+'A equipe está registrando motivos de perda e o tempo de resposta dos orçamentos. Ainda não medimos se isso mudou o resultado. '.repeat(12)},
  {role:'assistant',content:'O registro descreve uma ação em acompanhamento. Precisamos comparar períodos equivalentes antes de atribuir uma melhora ao trabalho. '.repeat(10)}
 );
 result.push({role:'user',content:'Com base na memória da Oficina Cedro, qual deve ser a próxima revisão do acompanhamento de orçamentos? Não temos resultados novos; preciso de uma prioridade executável.'});
 return result;
}
