# Revisão dos Termos de Uso da SeedAI

## Consolidação autorizada — 17/10/2026

O titular autorizou adotar as metas, ajustar documentos e preparar o Stripe, mantendo planos desativados. A versão 0.2 dos Termos incorpora os preços aprovados para preparação, FREE sem renovação, consumo PRO compartilhado entre tarefas/empresas, canal empresarial e horário de suporte. Preserva cancelamento, direitos legais e ausência de cobrança automática. Referências à revisão inicial abaixo são históricas; não solicitá-la novamente.

A frase de aceite em `src/lib/operations/copy.ts` já distingue aceite dos Termos de ciência da Política nos quatro idiomas; não foi necessário alterar o formulário. A nova oferta ainda não corresponde a três preços contratáveis: faltam associação da oferta à assinatura/permissões e fluxo de mudança de plano. Procedimentos comerciais definitivos devem acompanhar a implementação, conforme [preparação Stripe](../STRIPE_ACTIVATION.md). Não publicar promessa de upgrade/prorrateio não implementada.

Metas internas adotadas: [OPERATIONAL_TARGETS](../OPERATIONAL_TARGETS.md). A aprovação de ajustes não comprova os instrumentos de transferência ou a retenção dos fornecedores, nem transforma a minuta local em contrato vigente. Sem aceite retroativo e sem inserir `approved=true` para contornar pendências factuais. Os controles do aplicativo permanecem fechados.

Preparação da Fase 13 em **15/10/2026**. A [minuta dos Termos](TERMOS_DE_USO_PT_BR.md) está disponível para revisão, sem aprovação, inserção no banco, aceite em nome de usuários ou publicação. Este documento registra propostas contratuais e sua correspondência com o produto; não é um parecer jurídico.

**Atualização do titular em 15/10:** os documentos já foram revisados; os ajustes serão enviados. Aguardar e incorporar a versão revisada, sem pedir novamente revisão inicial nem presumir aprovação das minutas atuais. O lançamento anunciado será comercial, com cobrança e produto funcional. Qualquer referência a beta deve descrever apenas validação interna anterior ou hipótese efetivamente oferecida, nunca rotular o lançamento pago como teste público.

## Dados da empresa e escopo

O titular informou: **Seed Tecnologias LTDA**, **CNPJ 61.526.298/0001-62**, **Rua Cassiano Dornas, nº 175, Itaúna/MG, Brasil, CEP 35680-347**. O CEP recebido como `35.680.347` foi apenas normalizado. Os dígitos verificadores do CNPJ passaram na conferência matemática; não houve consulta cadastral à Receita nem comprovação do endereço ou da representação legal.

Caixa empresarial **suporte@appseedai.com** configurada no Zoho; envio e resposta confirmados pelo titular. O contato de privacidade e o destinatário dos alertas permanecem **seedtecnologias.suporte@gmail.com**. A escolha do contato contratual final deve acompanhar a aprovação das minutas; a interface de suporte do candidato já inclui a caixa empresarial.

Os Termos abrangem o aplicativo e os recursos contratados. A lista de espera permanece sob seu aviso específico. A minuta inclui condições para futuras assinaturas de loja, claramente subordinadas à disponibilização e à contratação efetivas; não declara que iOS/Android, cobrança real ou restauração de compras estejam implementados.

## Condições propostas para aprovação

| Tema | Proposta e decisão necessária |
| --- | --- |
| Identificação | Conferir os dados societários fornecidos antes de publicar. Manter o nome da marca SeedAI distinto da razão social. |
| Público | Serviço para adultos capazes e representantes autorizados. Isso não comprova verificação automática de idade; validar apresentação e procedimento. |
| Conta e consultoria | Conta individual; múltiplas empresas conforme o plano, com permissões separadas. Permitir entregas legítimas de consultoria, sem revenda de contas ou compartilhamento de senha. |
| Serviço e IA | Sem garantia de retorno ou substituição de profissionais habilitados. Preservar a responsabilidade legal do fornecedor, sem cláusula de exoneração absoluta. |
| Conteúdo | Autorização limitada ao serviço e seus fins legítimos; uso comercial dos resultados pelo cliente, respeitados direitos de terceiros. Confirmar cadeia de direitos e condições dos provedores antes da versão final. |
| Preços | Proposta aprovada: R$ 99,99/199,99/399,99 mensais por usuário, com 1/3/5 empresas e orçamento interno compartilhado US$ 4/8/16. Catálogo e cobrança continuam desativados. Conferir total, tributos, canal e concessão correta de limites antes da venda. |
| Limites | Informar franquias e restrições financeiras de maneira compreensível na oferta. Não anunciar uso ilimitado nem usar “uso responsável” como justificativa genérica para reduzir qualquer entrega paga. Confirmar tratamento de falhas, reservas e contestação de consumo. |
| Continuidade paga | Renovação somente conforme contratação expressa; teste gratuito/PRO temporário sem conversão automática. Definir upgrade, downgrade, acumulação ou não de franquias, mudanças de preço e falhas de pagamento antes da venda. |
| Cancelamento e reembolso | Diferenciar fim da renovação, arrependimento, defeito, estorno e exclusão. Validar procedimento por canal; não limitar direitos legais ao cancelamento ao fim do ciclo. |
| Atendimento | Metas adotadas em 17/10: segunda a sexta, 9h–18h de Brasília, primeira resposta em um dia útil, exceto feriados locais. Confirmar recebimento, registro, prazos legais e solução de falhas do portal/loja. Não há plantão 24 horas comprovado. |
| Suspensão e encerramento | Exigir motivo, proporcionalidade, revisão e informação quando cabível; tratar continuidade e dados. Não impor perda automática de todo o histórico como penalidade. |
| Privacidade | Aprovar também retenção, transferências, fornecedores, atendimento e os demais pontos da [revisão da política](REVISAO_PRIVACIDADE.md). O aceite do contrato não substitui consentimentos opcionais. |
| Forma do aceite | Manter versão e prova de aceite, acesso anterior ao texto e cópia conservável. A interface já distingue contrato de ciência da Política; não tratar a caixa como autorização universal. |
| Regiões e idiomas | Validar os mercados realmente atendidos, normas locais, textos e oferta correspondentes. Não habilitar mercados somente porque há tradução da interface. |

## Evidências no projeto

| Comportamento | Referência e limite da evidência |
| --- | --- |
| Contratação atual em teste | `src/app/billing/actions.ts` e `src/lib/billing/contracts.ts`: validação de preço/sessão de teste; o portal precisa permitir cancelamento ao fim do período. Isso não implementa todos os fluxos de reembolso legal. |
| Plano e período | `src/lib/commercial/entitlements.ts` e `supabase/migrations/202610050001_usage_cycles.sql`: plano efetivo, término do ciclo e concessões temporárias; FREE sem presumir renovação mensal. |
| Consumo e limites | `src/lib/commercial/contracts.ts`, `src/lib/commercial/metering.ts`, `src/lib/commercial/usage-errors.ts`, `src/app/billing/page.tsx` e `src/lib/i18n/locales/pt-BR.json`: controles por conta e custo, saldo, relatórios PRO separados das análises de conversa. Configurações reais precisam ser conciliadas com a oferta final. |
| Empresas e histórico | `src/lib/auth/context.ts`, `src/app/workspace/actions.ts` e `src/lib/commercial/entitlements.ts`: vínculo com empresa, memória compartilhada e leitura de registros existentes após redução de plano, sujeita aos demais controles. |
| Limites da IA | `src/lib/brain/modules/identity.ts`, `src/lib/seed/instructions.ts` e módulos de simulação/executação. Escrita de registros não é execução de contratos, pagamentos ou campanhas externas. |
| Documentos e aceite | `src/app/legal/[kind]/page.tsx`, `src/app/access/page.tsx` e `src/app/access/actions.ts`: somente documentos aprovados por idioma, controle de versão e aceite autenticado. Ainda não há documento final aprovado nesta entrega. |
| Suporte | `src/app/support/actions.ts` e [procedimento operacional](../PHASE_13_OPERATIONS.md#exportação-exclusão-e-solicitações-de-privacidade): canal autenticado e revisão manual. A disponibilidade no código de staging não comprova publicação nem SLA. |

Nenhum valor de cota, preço ou contrato de loja foi alterado para se adequar à redação. Se a revisão aprovar um compromisso ainda não implementado, a implementação e sua validação devem preceder a publicação desse compromisso.

## Meta de lançamento e versões de loja

O titular definiu em 15/10 a intenção de **abrir o aplicativo ao público em 04/11/2026**, já disponível na App Store e no Google Play. O beta deve ser uma etapa privada de validação anterior, não o nome da abertura comercial. Essa é uma meta de planejamento, não autorização para abrir o sistema ou garantia de aprovação pelas lojas.

O titular iniciou os **cadastros organizacionais nas duas lojas**. A taxa do Google Play foi paga, os documentos foram enviados e o site foi vinculado; a análise ainda está pendente. O cadastro Apple também aguarda análise. O D-U-N-S foi informado e utilizado no cadastro. O repositório examinado contém o aplicativo web Next.js; não foram encontrados projetos iOS/Android ou configuração de empacotamento móvel. A cobrança existente é Stripe em teste; os nomes `apple` e `google` no contrato de tipos não são integrações funcionais.

Preparação necessária antes de afirmar disponibilidade nas lojas:

1. Concluir a análise dos cadastros organizacionais já iniciados. O D-U-N-S e o e-mail empresarial já foram obtidos; não solicitar novamente sua criação. Conferir o resultado efetivo nos painéis da [Apple](https://developer.apple.com/programs/enroll/) e do [Google Play](https://support.google.com/googleplay/android-developer/answer/13628312), sem confundir aprovação da conta com aprovação do aplicativo. Não contratar serviços ou declarar novos dados societários em nome do titular automaticamente.
2. Definir e implementar a distribuição móvel e testar em dispositivos. Um site responsivo não comprova a existência de um pacote publicável. A Apple avalia funcionalidade, qualidade e conteúdo; não presumir aprovação por simplesmente embutir o site. [App Review Guidelines, seção 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality).
3. Implementar e testar assinatura, confirmação, restauração, renovação, cancelamento e reembolso do canal utilizado; reconciliar acesso entre web e lojas sem cobrança duplicada. Aplicar as regras de compra da loja e do mercado efetivo, incluindo exceções e programas quando pertinentes. [Apple, seção 3.1](https://developer.apple.com/app-store/review/guidelines/#payments); [Google Play, pagamentos](https://support.google.com/googleplay/android-developer/answer/9858738).
4. Publicar documentos aprovados em endereços acessíveis aos usuários e revisores, preencher informações de privacidade e testar exclusão de conta. A [Apple](https://developer.apple.com/app-store/review/guidelines/#account-sign-in) exige iniciar a exclusão dentro do aplicativo quando há criação de conta; o [Google Play](https://support.google.com/googleplay/android-developer/answer/13327111) exige também um caminho web para o pedido. Não presumir que o processo manual de suporte atual satisfaça todos os requisitos da versão móvel.
5. Fazer os testes exigidos pela conta e pela loja, preparar acesso controlado dos revisores e submeter com margem para correções. Para novas contas **pessoais** do Google Play, há requisito específico de pelo menos 12 participantes continuamente inscritos por 14 dias em teste fechado; não extrapolar essa regra automaticamente às contas de organização. [Requisito oficial](https://support.google.com/googleplay/android-developer/answer/14151465).

**Risco para 04/11:** cadastro/verificação, versão móvel, compras e revisão externa ainda não estão comprovados. Os testes web já realizados não encerram essas etapas. A conclusão da Fase 13 não deve ser declarada equivalente a aprovação nas lojas. A Fase 14 permanece dependente de autorização e escopo; esta entrega não inicia desenvolvimento móvel nem cobrança real.

## Base jurídica e contratual consultada em 15/10/2026

- [Código de Defesa do Consumidor](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm): revisão de informação, oferta, responsabilidade, arrependimento e cláusulas abusivas. A minuta preserva direitos obrigatórios; não presume que todo contrato entre empresas esteja fora de uma relação de consumo.
- [Decreto nº 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm): identificar fornecedor e condições, permitir conservação do contrato e viabilizar atendimento/cancelamento. Validar também confirmação de recebimento, manifestação em até cinco dias para demandas abrangidas pelo art. 4º e mecanismo de arrependimento. Isso é requisito a operacionalizar, não declaração de que o processo atual já o cumpre integralmente.
- [Acordo de serviços da OpenAI](https://openai.com/policies/services-agreement/): conferir a relação entre conteúdo de entrada, resultados, direitos de terceiros e respostas não exclusivas. As exclusões e a arbitragem do contrato do fornecedor não foram copiadas para a relação da SeedAI com seus usuários. Confirmar a versão contratada na conta, sem presumir que a página pública comprove o aceite.

Os compromissos sugeridos nos Termos são específicos da SeedAI. As fontes não constituem aprovação jurídica da minuta nem substituem avaliação das circunstâncias da empresa.

## Aprovação e publicação

A [especificação da Fase 13](../PHASE_13_SPEC.md) determina: **“Conteúdo jurídico final deve ser validado por profissional adequado.”** Também exige autorização explícita para deploy em produção. Por isso, a minuta está pronta para revisão, sem ser cadastrada como `approved=true` nem apresentada ao usuário como contrato vigente.

Após a revisão: consolidar versão e vigência, alinhar oferta/interface e Política de Privacidade, preparar texto adequado à rota legal atual (que não renderiza Markdown), validar leitura e aceite em staging e só então publicar mediante autorização. Não registrar aceite retroativo, migrar usuários silenciosamente ou abrir o aplicativo apenas porque chegou a data planejada.

## Verificação desta entrega

Verificação realizada: dados empresariais consistentes nos dois documentos, grafia SeedAI, links e âncoras locais válidos, referências de código existentes e codificação UTF-8 sem erros. Leitura integral da minuta concluída. A varredura dos 440 arquivos versionáveis não encontrou credenciais; a conferência de diferenças não encontrou erros de formatação.

Trata-se de alteração documental; não houve mudança de lógica, banco, planos ou aplicação publicada, nem consumo de IA ou envio de mensagens. Lint, typecheck, testes de execução e build não foram repetidos para esta entrega de texto. As verificações documentais não substituem os testes e o aceite restantes da Fase 13.
