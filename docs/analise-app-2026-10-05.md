# Análise técnica e de UX — 5 de outubro de 2026

> Atualização após esclarecimentos do utilizador: existe uma restrição de contas configurada no Firebase/Google. A hipótese de login aberto a desconhecidos não deve ser tratada como facto da instalação. A prioridade passa a ser a coerência das permissões dentro da família. Miguel usa duas contas; Isabel deve apenas consultar investimentos; os restantes familiares devem obter consulta após uma data de abertura prorrogável anualmente. Ver a continuação em `docs/analise-app-continuacao-2026-10-05.md`, que atualiza estes requisitos e acrescenta a análise dos restantes módulos. Nenhuma correção funcional foi aplicada.

## Contexto e alcance

O utilizador confirmou que usa Faturas e Investimentos sobretudo no PC e as restantes áreas sobretudo no telemóvel. O acesso deve ser limitado a pessoas explicitamente autorizadas.

Foi analisado o código local de navegação, autenticação, regras Firestore, Functions, backup, PWA e vários módulos. Foi inspecionada a página inicial sem sessão no navegador, em desktop e a 390 × 844, incluindo o menu móvel. Os fluxos autenticados foram avaliados pelo código; não foram exercitados com contas reais. Não foi verificado se as regras atualmente publicadas coincidem com as do repositório. Não foram alterados código funcional nem dados de produção.

## Prioridade 1 — Acesso e integridade

### 1. Substituir permissões por exclusão por uma lista explícita de pessoas e papéis

**Evidência:** `js/access-control.js:66`, `firebase/firestore.rules:26` e `firebase/functions/family-finance.js:148`.

Uma conta autenticada que não corresponde aos perfis restritos recebe acesso alargado. Nas finanças familiares, qualquer UID não vazio que não seja de uma criança recebe o papel `parent`. A regra do calendário escolar aceita qualquer conta autenticada.

Uma execução local do resolver confirmou `resolveFamilyActor('audit-unknown-account').role === 'parent'`. Isto contraria o requisito de acesso fechado. O impacto em produção depende também da configuração de autenticação e das regras efetivamente publicadas, que não foram auditadas.

**Proposta:** negar acesso por defeito; definir explicitamente administrador, familiar adulto, criança e restantes colaboradores necessários. Aplicar a mesma matriz no frontend, nas regras e em todas as Functions. UIDs explícitos são uma opção simples para esta dimensão; papéis atribuídos no servidor são outra. A interface deve explicar quando uma conta ainda não está autorizada.

**Aceitação:** uma conta desconhecida com token válido não lê nem altera dados privados por chamadas diretas. Cada perfil permitido mantém apenas as operações previstas. Confirmar a lista exata de contas antes da implementação para evitar bloquear o proprietário.

### 2. Alinhar a autorização do servidor de investimentos com a interface

**Evidência:** `firebase/functions/investment-access.js:4` e `firebase/functions/index.js:665`.

O helper do servidor só distingue a Filipa das restantes contas. Executado com os UIDs das duas crianças, devolve `write` para ambas, embora a navegação e as regras específicas lhes neguem investimentos. O endpoint de carteira Kraken usa este helper antes de consultar a carteira configurada.

**Proposta:** reutilizar uma política explícita de acesso e testar os endpoints com todos os perfis. O retorno `write` do helper não prova que estes endpoints executem ordens de compra ou venda; o problema identificado é a autorização para obter dados da carteira.

### 3. Remover a regra genérica que invalida restrições específicas

**Evidência:** `firebase/firestore.rules:390`, comparada com as regras de `dca_settings/automation`, `dca_reinforcements` e `dca_reconciliations`.

A regra final permite leitura e escrita a contas não restritas em coleções DCA. Por isso, para essas contas, as validações específicas e proibições de eliminação não constituem uma barreira efetiva: basta uma regra aplicável permitir a operação.

Este comportamento está documentado pelo [Firebase sobre regras sobrepostas](https://firebase.google.com/docs/firestore/security/rules-structure#overlapping_match_statements).

**Proposta:** eliminar a autorização genérica e enumerar operações por coleção. Acrescentar testes reais de regras no emulador para documentos malformados, eliminação proibida, alteração de histórico e acesso por conta desconhecida. Testes que apenas inspecionam texto das regras não demonstram o seu efeito.

### 4. Evitar interpretar campos de faturas como HTML ou JavaScript

**Evidência:** `js/faturas.js:607`, `js/faturas.js:628` e `js/faturas.js:827`.

Números de fatura são interpolados diretamente em HTML; dados serializados são colocados em handlers `onclick`. Substituir apenas aspas duplas não resolve todos os contextos. Texto com marcação pode alterar a página; apóstrofos nos dados podem quebrar handlers, e existe risco de XSS persistente.

**Proposta:** criar conteúdo de utilizador com `textContent`, ligar ações com `addEventListener` e manter objetos em memória por ID. Validar formatos na escrita. Não foram introduzidos payloads nem efetuadas gravações para explorar este problema.

## Prioridade 2 — Fiabilidade percebida e real

### 5. Transformar a exportação num backup verificável

**Evidência:** `js/settings.js:38` e `js/settings.js:84`; `modules/settings.html` promete exportar todos os dados.

Uma leitura que falha é convertida em `[]`; o processo pode gerar um ficheiro parcial, atualizar a data do último backup e mostrar sucesso. Uma simulação local de `permission-denied` confirmou esse retorno vazio. A lista fixa também não inclui todas as áreas atuais, como dados sob `users` e o calendário escolar. Não existe um percurso de restauro nesta página.

**Proposta:** distinguir coleção vazia de falha, apresentar cobertura e contagens, identificar exportações parciais, versionar o formato e testar o restauro num ambiente separado. Incluir uma política explícita para dados pessoais e subcoleções, em vez de prometer cobertura total com uma lista incompleta.

### 6. Proteger a gravação de faturas e tornar erros acionáveis

**Evidência:** `js/faturas.js:461`, `js/faturas.js:536` e `js/faturas.js:572`.

O handler de submissão cria documentos com `addDoc` sem bloqueio de submissão em curso ou chave de idempotência visível nesse percurso. Cliques rápidos ou tentativas repetidas podem criar duplicados. Na leitura, um erro também devolve `[]`, confundindo falha com ausência de registos. A eliminação usa `deleteDoc` definitivo, com confirmação mas sem recuperação na app.

**Proposta:** estado «A guardar», prevenção de duplicados também na camada de dados, validação da coerência entre datas/noites e erro com «Tentar novamente». Preservar dados preenchidos. Avaliar arquivo recuperável ou anulação auditada para registos importantes.

### 7. Tornar sessão e navegação completas

**Evidência:** `js/script.js:184`, `js/script.js:351` e `js/script.js:448`.

O código procura `logout-btn`, mas a navegação gerada não o cria. O nome do utilizador é um link sem ação associada. Erros de login são enviados apenas para a consola. No ensaio móvel, Escape manteve o painel aberto e o botão não tinha `aria-expanded`.

**Proposta:** menu de conta com sair/trocar de conta, mensagens visíveis de falha de login, fecho por Escape e toque exterior, gestão de foco e indicação acessível de estado. Consolidar os vários handlers de navegação num único componente.

## Prioridade 3 — UX ajustado ao uso real

As propostas seguintes são decisões de produto a validar com uso real, não erros demonstrados por testes completos das páginas autenticadas.

| Área | Melhoria proposta | Resultado pretendido |
|---|---|---|
| Início | Antes do login, botão central «Entrar com Google» e explicação de acesso privado. Após login, favoritos, retomar última área e pendentes relevantes ao perfil. | Substituir a instrução genérica para escolher um menu por uma próxima ação clara. |
| Faturas, no PC | Lista pesquisável por número, filtros de apartamento/canal/período e painel de edição ao lado. Separar campos essenciais de detalhes adicionais. Manter totais e ação de guardar visíveis. | Encontrar, comparar e corrigir faturas com menos navegação. |
| Investimentos, no PC | Resumo consistente entre DCA e Cripto: património, capital aplicado, resultado e liquidez, com definições claras. Mostrar momento/origem da cotação e quando está desatualizada. | Compreender o estado da carteira sem interpretar estruturas diferentes. |
| Navegação móvel | Favoritos pessoais e acesso rápido às áreas frequentes; testar uma barra inferior curta com «Mais» para o restante menu. | Evitar abrir grupos sucessivos em cada tarefa. |
| Ginásio | Entrada direta no treino atual, destaque do próximo exercício e ações principais junto à zona de interação. Preservar os rascunhos e temporizadores existentes. | Registar uma série com pouco esforço durante o treino. |
| Alimentação | Manter a navegação por refeições existente; dar destaque ao que falta escolher e ao estado real de gravação/sincronização. | Ver rapidamente a próxima ação e se os dados estão guardados. |
| Calendário e Datas | Priorizar próximos acontecimentos e ações rápidas. Rever a ocultação de ações em ecrãs menores em `css/mobile.css:718`. | Conservar ações necessárias no telemóvel, com menus compactos quando necessário. |

A página inicial foi efetivamente observada sem sessão: exibe «Seleciona uma funcionalidade no menu para começar», mas a navegação só apresenta login. Não foi confirmado um defeito de painel aberto por defeito: a imagem inicial foi captada durante a transição de tamanho.

## Evolução do código

Há boas bases a preservar: módulos de cálculo separados, uso de cêntimos e micros nas finanças familiares, ledger e estornos, transações no registo de hóspedes, mensagens acessíveis no componente de toast e testes de regras de negócio.

Recomenda-se uma evolução gradual:

1. **Separar responsabilidades:** extrair autenticação, permissões, navegação e acesso a dados de `script.js`. Dividir os ficheiros maiores por função; `ginasio.js` tem aproximadamente 147 KB e `crypto-ui.js` 124 KB.
2. **Reduzir divergências:** partilhar componentes e lógica entre módulos semelhantes, mantendo as configurações pessoais em dados próprios. Consolidar estilos globais e padrões de botões, formulários, estados vazios e modais.
3. **Ler apenas o necessário:** Faturas, Caixa e Análise carregam coleções inteiras em percursos examinados. Introduzir filtros e paginação na origem e agregados adequados para totais. Medir a melhoria com o volume real de dados; não foi efetuado um benchmark.
4. **Definir o contrato offline:** o service worker guarda assets locais, mas ignora CDNs de que dependem os imports Firebase. Cache de páginas, por si só, não garante arranque e utilização offline. Testar arranque sem rede, falha durante gravação e troca de conta. Rever chaves locais sem UID nos módulos pessoais.
5. **Automatizar verificações:** um comando documentado para testes unitários; outro para emulador; testes de navegador para login, menu móvel, guardar fatura, duplicação, exportação parcial e isolamento entre perfis. Separar testes de estrutura HTML de testes comportamentais.

## Ordem recomendada e verificação

| Etapa | Entrega | Critério de conclusão |
|---|---|---|
| 1 | Lista de acessos, regras explícitas e endpoints coerentes | Matriz de permissões passa no emulador e nos testes de endpoints; desconhecidos e crianças não obtêm investimentos. |
| 2 | Renderização segura, backup verificável e gravação robusta | Conteúdo é tratado como texto; falhas de exportação são visíveis; repetição do mesmo pedido não duplica faturas. |
| 3 | Início útil, menu de conta e navegação móvel | Percursos frequentes ficam acessíveis com poucas ações; teclado e foco funcionam. |
| 4 | Faturas e Investimentos otimizados para PC | Tarefas reais de pesquisa, edição e consulta exigem menos passos, sem perda de informação. |
| 5 | Componentes partilhados, consultas menores e offline | Medições e testes demonstram ganhos sem regressões. |

Nesta análise passaram **109 testes da pasta `tests` e 56 testes de Functions**. A suite `boletim-security.test.cjs` não executou os seus casos porque exige `FIRESTORE_EMULATOR_HOST`; a execução global terminou com essa falha de pré-condição. Portanto, não se afirma que a suite completa de segurança passou. Alguns testes atuais validam explicitamente o acesso alargado a contas desconhecidas e terão de mudar com o requisito confirmado.

Também foram executadas simulações locais sem rede para o papel de uma conta desconhecida, acesso das crianças ao helper de investimentos e falha de leitura no backup. Nenhuma destas simulações consultou dados de produção.
