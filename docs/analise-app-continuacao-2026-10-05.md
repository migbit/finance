# Continuação da análise — 5 de outubro de 2026

## Requisitos confirmados e correções à avaliação anterior

O utilizador confirmou uma restrição de contas configurada no Firebase/Google. Considera-se, portanto, que apenas familiares autorizados podem iniciar sessão. Essa configuração não foi inspecionada remotamente nesta análise. A conclusão anterior sobre contas desconhecidas precisa desta ressalva: o código local é permissivo, mas isso não demonstra que uma pessoa externa consiga autenticar-se na instalação real.

Permanece necessário distinguir os acessos dos familiares e manter a mesma política na navegação, Firestore e Functions.

### Investimentos: política pretendida

Aplica-se a DCA e Cripto.

| Pessoa | Antes da abertura | Depois da abertura |
|---|---|---|
| Miguel, através de qualquer uma das suas duas contas indicadas na conversa | Gestão | Gestão |
| Isabel | Consulta | Consulta |
| Restantes membros autorizados da família, incluindo as filhas | Sem acesso | Consulta |

O utilizador respondeu «Consulta» à pergunta sobre Isabel. Pela descrição original, a prorrogação é considerada uma ação de Miguel; não foi concedido esse poder à Isabel. Antes de implementar, deve verificar-se a correspondência das duas contas de Miguel e da conta de Isabel aos respetivos UIDs, sem inferir identidades a partir de UIDs já presentes no código.

Exemplo temporal fornecido pelo utilizador:

| Situação | Abertura de consulta à família |
|---|---|
| Miguel não prolonga até 31/12/2026 | 21/12/2027 |
| Miguel prolonga mais um ano durante 2026 | 21/12/2028 |
| No segundo caso, volta a prolongar mais um ano em 2027 | 21/12/2029 |

Proposta de UX: mostrar a Miguel a data atualmente prevista, a data limite para prolongar, a última prorrogação e um botão com consequência explícita, por exemplo «Adiar abertura para 21/12/2028». A operação deve ser idempotente para a mesma renovação anual: clicar duas vezes não deve adiar dois anos. A regra deve usar tempo de servidor e Europe/Lisbon e ser aplicada às coleções, endpoints e dados auxiliares de investimentos. A data de abertura refere-se à visibilidade na app, conforme o pedido.

**O que existe hoje:** uma data fixa de 21/12/2027 em `js/access-control.js:6`, `firebase/functions/investment-access.js:2` e `firebase/firestore.rules:91`. A Filipa passa a consulta nessa data. As filhas continuam bloqueadas no frontend e nas regras, mas o helper de servidor de investimentos autoriza-as antes da data. Isabel não tem um papel explícito de consulta; entra no grupo genérico com escrita. Não foi encontrada uma funcionalidade de prorrogação no código pesquisado.

**Pormenores ainda a definir antes de implementação:** possibilidade de prorrogar depois de 31 de dezembro mas antes da abertura; possibilidade de voltar a restringir depois da abertura. A análise não escolhe silenciosamente esses comportamentos.

### Explicação concreta da sobreposição de regras

Em `firebase/firestore.rules:314`, a regra de reforços DCA valida valores e impede apagar. Em `firebase/firestore.rules:390`, a regra genérica também abrange esses documentos e permite escrita a contas fora dos perfis restritos.

Num pedido de eliminação feito por uma dessas contas:

1. A regra específica devolve «não permitir».
2. A regra genérica devolve «permitir».
3. O Firestore permite a eliminação, porque basta uma autorização aplicável.

Não existe prioridade automática para a regra mais específica. Isto também afeta validações da automação e a imutabilidade das reconciliações. Mesmo num grupo familiar fechado, interessa que um erro da interface não consiga contornar essas proteções. A correção será nas regras de acesso; não implica alterar os documentos existentes. Deve ser validada primeiro no emulador. [Documentação oficial das regras sobrepostas](https://firebase.google.com/docs/firestore/security/rules-structure#overlapping_match_statements).

### Código e dados têm cópias distintas

GitHub e a pasta local guardam o código. Os módulos examinados guardam os seus registos no Firestore; isso não os coloca automaticamente no Git. A pasta `data` inspecionada também não é uma exportação completa desses registos.

O utilizador não vê necessidade no botão de backup. A decisão sobre esse botão fica em aberto, mas não se deve removê-lo com a premissa de que o repositório já recupera faturas, movimentos ou treinos. Primeiro deve confirmar-se se existe exportação ou backup dos dados no Firebase/Google Cloud. Esta verificação não foi feita, nem foi ativado qualquer serviço. [Exportação e recuperação no Firestore](https://firebase.google.com/docs/firestore/manage-data/export-import).

As correções das Faturas ficam pendentes, conforme pedido. Não foi alterada qualquer base de dados, regra publicada ou código funcional.

## Novos problemas concretos

### A. Alimentação: indicação de sincronização falsa — prioridade alta

**Locais:** `js/alimentacao.js:214` e `js/alimentacao.js:234`; `js/filipa-alimentacao.js:227` e `js/filipa-alimentacao.js:247`.

`syncToCloud` captura falhas e devolve `false`. `loadRemoteProfile` chama-a e depois escreve incondicionalmente «Guardado e sincronizado». Uma simulação local usando essas funções e uma escrita fictícia rejeitada confirmou a mensagem incorreta nos dois módulos.

Além disso, `writeStored` captura erros de armazenamento local sem devolver falha. O ecrã pode afirmar «Guardado neste dispositivo» mesmo quando essa gravação falhou.

**Melhoria:** só afirmar sucesso após confirmação; manter as alterações pendentes identificadas; permitir repetir a sincronização; não substituir um estado de erro por sucesso no chamador.

### B. Alimentação: mistura entre contas e conflito entre dispositivos — prioridade alta

**Locais:** chaves em `js/alimentacao.js:35` e `js/filipa-alimentacao.js:33`, normalização e comparação de datas nas funções seguintes.

O armazenamento local é por módulo, sem UID, enquanto a gravação remota usa a conta autenticada. Ao mudar de conta no mesmo navegador, um perfil local mais recente pode ser enviado para outra conta. Com as duas contas de Miguel, há ainda uma decisão de modelo: ambas representam a mesma pessoa, mas certos módulos usam documentos diferentes por UID, enquanto Ginásio de Miguel usa coleções partilhadas.

Há também um risco na viragem do dia: a normalização limpa o plano diário e atribui a hora atual à cópia local antes da comparação com a nuvem. Isso pode fazer uma cópia local antiga ganhar a comparação e substituir receitas alteradas noutro dispositivo no dia anterior. Este cenário foi identificado pelo encadeamento do código, não exercitado contra dados reais.

**Melhoria:** definir uma identidade pessoal estável ligada às contas autorizadas; isolar caches por essa identidade; separar receitas, preferências e registos diários; usar versões/conflitos explícitos. Qualquer eventual migração de dados deve ser um trabalho separado e revisto, não uma consequência silenciosa de abrir a página.

### C. Horas de Limpeza: alterar a data pode destruir outro registo — prioridade alta

**Local:** `js/cleaning-hours-admin.js:634`.

Ao mudar a data, `editEntry` grava no ID `funcionaria__nova-data` com `setDoc`, sem verificar se já existe, e depois apaga o ID original. São duas operações separadas.

**Reprodução em memória:** existiam 2 horas no dia 1 e 7 horas no dia 2. Editar o primeiro para o dia 2, com 3 horas, terminou com apenas um registo de 3 horas. O registo de 7 horas foi substituído. Nenhum acesso à base de dados foi usado nesta reprodução.

**Melhoria:** detetar colisão e pedir uma escolha explícita; mover atomicamente quando o destino está livre. A entrada manual também usa um único ID por funcionária/dia e pode substituir valores já existentes. Deve explicar se a operação é «adicionar» ou «substituir».

### D. Horas de Limpeza: remuneração histórica varia com a tarifa atual — prioridade alta

**Locais:** `js/cleaning-hours-admin.js:609` e `js/cleaning-hours-admin.js:614`.

O valor é calculado com a tarifa atual da funcionária, sem tarifa histórica no registo. Na simulação, um registo antigo de 5 horas passou de 40 € para 50 € ao mudar a tarifa de 8 €/h para 10 €/h.

**Melhoria:** guardar a tarifa aplicável ao registo ou uma tabela de tarifas por data. Distinguir horas pendentes, aprovadas e eventualmente pagas. Confirmar o comportamento pretendido antes de recalcular qualquer histórico; não houve recalculação ou migração real.

O endpoint de horas em `firebase/functions/index.js:931` também admite editar/apagar um dia através do token sem bloquear um registo aprovado. A página pública atual apresenta o calendário, pelo que isso é uma capacidade do endpoint e não uma ação necessariamente exposta no ecrã atual. Definir se uma aprovação deve tornar o registo imutável ou exigir um pedido de correção.

### E. Compras: sucesso antes de terminar a gravação — prioridade média

**Local:** `js/diversos.js:815`.

O botão de requisitar usa `forEach(async ...)` e mostra «Lista requisitada e guardada» imediatamente. Não espera pelo conjunto de gravações. Algumas podem falhar depois da mensagem de sucesso.

Os nomes dos artigos são também usados como caminhos de campos (`itens.${nome}` em `js/diversos.js:706`); um ponto no nome passa a ter significado estrutural.

**Melhoria:** aguardar as gravações, preferir uma operação coerente para a lista, identificar falhas e usar IDs estáveis para artigos. No telemóvel, um estado global discreto reduz a sucessão de notificações por item.

### F. Datas e Questionário: consultar também pode escrever — prioridade média

**Locais:** `js/datas.js:318`, `js/datas.js:338`, `js/datas.js:727`, `js/questionario.js:729` e `js/questionario.js:775`.

Datas cria documentos em falta e preenche prazos vazios ao carregar. Questionário recalcula e grava contagens de tags depois de ler as respostas. Assim, visitar a página não é estritamente uma operação de leitura.

**Melhoria:** separar inicialização/migração de consulta; apresentar valores por defeito sem os gravar automaticamente; calcular contagens derivadas localmente ou mantê-las na operação que altera as respostas. Os prazos predefinidos de Datas devem aparecer como valores configuráveis; esta análise não verificou a sua correção fiscal.

A lista de empresas é gravada como um array completo (`js/datas.js:305`), o que pode perder alterações concorrentes entre dispositivos. Preferir alterações por entidade ou controlo de versão.

### G. Finanças das filhas: aprovações noutro dispositivo não aparecem automaticamente — prioridade média

**Local:** `js/financas-filha.js:1496` e `js/financas-filha.js:1606`.

A página obtém os dados no arranque e após algumas ações locais. O intervalo de um minuto apenas redesenha os movimentos já carregados; não procura dados novos. Se um dos pais aprovar um pedido noutro dispositivo, a filha pode continuar a vê-lo como pendente até atualizar a página.

**Melhoria:** atualizar ao regressar à app e sinalizar decisões novas; mostrar a hora da última atualização e disponibilizar atualização explícita. Evitar interromper formulários que estejam a ser preenchidos.

Na gestão parental, o formulário de ajuste fecha antes de terminar o pedido e uma nova submissão gera outra chave de idempotência (`js/gestao-financas.js:761`). Se o servidor gravar mas a resposta se perder, repetir manualmente pode criar outra operação. Manter formulário e identificador da mesma tentativa até resolver o resultado incerto. Este cenário foi identificado pelo código, não reproduzido em produção.

### H. Ginásio: uma falha de leitura pode preparar a substituição de um treino — prioridade alta

**Locais:** `js/ginasio.js:3126` e `js/ginasio.js:3468`.

Quando a leitura de um treino falha, o carregamento usa `session: null` e permite continuar com um aviso. Guardar usa o mesmo ID determinístico de ginásio/treino/data e grava a sessão completa. Se havia um treino remoto que não foi lido, guardar uma sessão parcial pode substituir o existente quando a ligação recuperar.

Um rascunho local também prevalece sobre a sessão remota sem comparar as suas versões. São riscos deduzidos pelo código; não foram provocados num treino real.

**Melhoria:** distinguir «não existe» de «não foi possível ler»; permitir trabalho em rascunho, mas exigir resolução do conflito antes de substituir um treino remoto. Preservar o que já está bem: gravação conjunta de treino/resumo, recuperação de rascunho, prevenção de cliques repetidos e proteção contra respostas de carregamentos antigos.

### I. Carlos — Faturas: cêntimos ocultos e gravações concorrentes — prioridade média

**Locais:** `js/diversos.js:85` e `js/diversos.js:1218`.

Total, pago e saldo usam um formatador que arredonda ao euro, enquanto cada pagamento mostra duas casas decimais. Um saldo de 0,40 € aparece como 0 €, embora continue por pagar. O carregamento consulta pagamentos por fatura e acrescenta linhas conforme as respostas chegam, sem uma ordem final explícita.

**Melhoria:** mostrar sempre cêntimos; ordenar deterministicamente; prevenir pagamentos repetidos e validar o saldo na gravação, não apenas no `max` do campo HTML.

## UX dos restantes módulos

| Área | Preservar | Melhorar |
|---|---|---|
| Ginásio | Rascunhos, temporizadores, treino/resumo gravados em conjunto | Treino atual como ponto de entrada; sinal claro de rascunho/guardado; resolução de conflitos; ação de guardar ao alcance do polegar. |
| Alimentação | Escolha por refeição e totais recalculados | Estado de sincronização verdadeiro; foco na próxima refeição; evitar perder dados ao alternar conta/dispositivo. |
| Limpezas | Calendário simples para a funcionária e atualização ao regressar ao separador | Edição num formulário em vez de vários prompts; impedir colisões de datas; separar pendentes e aprovados; conservar tarifas históricas. |
| Datas | Grelhas por obrigação/período e atualização em tempo real | Vista móvel «por concluir»; filtros persistentes; manter ações acessíveis; não preencher a base ao consultar. |
| Compras/Reparações/Obras | Reutilização de listas e estados | Atalhos diretos a estas tarefas, em vez de depender do rótulo amplo «Diversos»; feedback de gravação consistente. |
| Finanças familiares | Ledger, estornos, decisões auditadas e linguagem ajustada à idade | Novas aprovações visíveis sem recarregar; preservar formulários quando há erro; destacar pedido pendente e próxima ação. |
| Calendário da Francisca | Próximos testes, datas sem conversões UTC, formulários validados e tentativa de recuperação | Arquivar/recuperar em vez de apagar definitivamente; atualizar o conceito de «hoje» quando uma página fica aberta de um dia para o outro. |
| Horário | Dados separados da apresentação, vista do dia e impressão | Marcar aula atual/próxima e atualizar o dia ao regressar à app; mostrar claramente o dia selecionado ao fim de semana. |
| Caixa | Resumo por caixa e edição no contexto | Histórico de correções, feedback de erro na edição e confirmação de transferência entre caixas quando aplicável. |
| IVA/PALLCO | Valores com cêntimos e edição existente | Labels persistentes nos formulários, filtros e padrão único de guardar/erro; extrair lógica de `diversos.js`. Não foram avaliadas regras fiscais. |
| Faturas em Falta | Bloqueio de submissão repetida e construção segura de células | Distinguir «resolvida» de «apagada», com histórico e pesquisa. |
| Questionário | Tags e combinação de dados quantitativos/qualitativos | Resumo de problemas recorrentes com ligação às respostas; consulta sem escritas automáticas. |
| Boletins | Transações, fecho de acesso e separação entre dados públicos/administrativos | Lista de tarefas pendentes e pesquisa. A regra administrativa atual contém um único UID: verificar se ambas as contas de Miguel devem gerir boletins, sem alargar esse acesso automaticamente. |

Estas propostas de UX baseiam-se na estrutura e no comportamento descritos pelo código. Não houve navegação autenticada nestas páginas nesta continuação, precisamente para evitar escritas automáticas.

## Ordem recomendada após os esclarecimentos

1. Especificar completamente a matriz Miguel/Isabel/família e a prorrogação; corrigir a coerência das regras quando for pedida a implementação.
2. Corrigir riscos de substituição de registos em Limpezas e Ginásio, sincronização de Alimentação e as Faturas já assinaladas para correção.
3. Tornar confiáveis os estados de gravação, impedir repetições e preservar histórico e valores monetários.
4. Melhorar os percursos móveis mais frequentes e a atualização entre dispositivos.
5. Simplificar componentes e consultas, medindo o impacto com dados de teste.

## Verificação realizada nesta continuação

Leitura estática dos módulos indicados e quatro cenários executados com funções extraídas do código, dependências simuladas e dados exclusivamente em memória:

- Alimentação de Miguel: falha simulada de escrita terminou com «Guardado e sincronizado».
- Alimentação da Filipa: o mesmo comportamento.
- Limpezas: 5 horas antigas passaram de 40 € para 50 € quando a tarifa atual mudou.
- Limpezas: mover um registo para uma data ocupada substituiu o destino e removeu a origem.

Não foram feitas chamadas de dados à app, alterações à base de dados, correções de código, publicações ou migrações. Os 165 testes citados no relatório anterior pertencem à primeira fase da análise; não se apresenta aqui uma nova execução dessa suite.
