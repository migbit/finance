# Ginásio — interface partilhada

## Acesso partilhado com a Filipa — 14/10/2026

A Filipa pode consultar e alterar a página Ginásio no menu Miguel após a
publicação. O módulo `ginasio` está autorizado no controlo de acesso e as regras
Firestore concedem à sua conta leitura/escrita nos documentos das seis coleções:
`ginasio_treinos`, `ginasio_resumos`, `ginasio_pesos`,
`ginasio_reps_recomendadas`, `ginasio_aquecimentos` e `ginasio_maquinas_custom`.
A sua página continua a usar os dados próprios em `/users/{FILIPA_UID}`.

Validação: `node --test tests/access-control.test.mjs` e testes de integração
`tests/ginasio-access.test.mjs` num emulador Firestore em `127.0.0.1:8187`,
projeto fictício `demo-ginasio-access`. Definir `FIRESTORE_EMULATOR_HOST` antes
de executar estes últimos. Cobrem listagem, leitura, criação, alteração,
remoção e a manutenção das restrições para crianças, visitantes e dados alheios.

Atualização de 11/10/2026 para `ginasio.html` e `filipa-ginasio.html`.

- As duas páginas carregam `theme-dark.css`, o mesmo tema da Análise, e
  `ginasio.css` para o layout. Não duplicar a paleta no HTML.
- A página da Filipa continua a montar o conteúdo da página de referência;
  a folha de estilos passa a ser carregada diretamente, sem copiar CSS inline.
- Alertas/opções, criação de máquinas, histórico, evolução e instruções de
  aquecimento/progressão usam painéis expansíveis. Os aquecimentos para registo
  continuam visíveis dentro de cada exercício aberto.
- Em mobile, peso, repetições e RIR aparecem lado a lado. Os blocos de conclusão
  e RPE do treino híbrido têm duas colunas, com o volume numa linha separada.
- A carga total é apresentada de forma compacta; o cálculo completo fica no
  título do valor e a resistência inicial mantém-se no cabeçalho da máquina.

## Limites acordados

Esta alteração é de apresentação. Exercícios, séries, repetições, RIR-alvo,
cargas, progressão e funcionamento das notificações não foram alterados.

Antes de introduzir o treino curto de Miguel ou qualquer alteração ao plano,
apresentar uma comparação por exercício, atual/proposto lado a lado, para
análise do utilizador. Os treinos da Filipa devem permanecer inalterados.

## Verificação

`node --test tests/filipa-ginasio-page.test.mjs`

Comparação integral das configurações com a versão anterior e verificação
visual local em desktop e a 360 px, incluindo treino híbrido. A pré-visualização
usa dados fictícios, sem acesso nem escrita no Firebase. Não constitui um teste
dos alertas no Fold 6/Brave com o ecrã bloqueado.

## Plano de Miguel — aprovação de 12/10/2026

A comparação por exercício e a revisão científica foram aprovadas na conversa.
O módulo `js/miguel-ginasio-plan.js` aplica a revisão apenas a Pernas e Peito +
Ombro + Braços no Dragão e Costas na Constituição. Totais normais: 17, 15 e
14 séries, respetivamente. A variante sentada do curl, o Hack Squat e outros
ginásios/treinos conservam a prescrição anterior até análise específica.

- As séries acrescentadas têm indicação de introdução gradual. Só séries
  efetivamente registadas entram na sessão; a grelha não é uma obrigação de
  completar todo o volume na retoma.
- Tríceps e bíceps têm um exercício selecionável de três séries por grupo.
  As alternativas conservam IDs, cargas e histórico próprios. A troca é
  bloqueada depois de registar trabalho/aquecimento nesse exercício, ou durante
  um descanso, para não descartar dados inadvertidamente.
- Curtos excecionais: pernas 8, costas 6, peito/ombro/braços 7 séries. O nome
  distingue a sessão no histórico e nos rascunhos. A primeira sessão curta
  pode consultar cargas anteriores do normal; o normal não usa o curto como
  prova de progressão. Num novo dia, a seleção restaurada regressa ao normal.
- A progressão do novo plano requer confirmação humana de duas sessões
  comparáveis, execução, esforço, sintomas e recuperação; não mostra o antigo
  aviso automático «Progride!» baseado numa única sessão.
- Sessões/rascunhos sem versão continuam a usar o plano legado, incluindo os
  antigos exercícios adicionais de braços. Ao voltar a guardar, mantêm a
  identificação `legacy`; não há migração remota automática.
- A recuperação preserva índices de séries omitidas e dá prioridade ao peso
  guardado na própria sessão. Os planos da Filipa e as notificações não mudam.

Validação: `node --test tests/miguel-ginasio-plan.test.mjs tests/filipa-ginasio-page.test.mjs`.
Verificação em Chromium com Firebase simulado: planos normais/curtos, escolha de
braços, recuperação de rascunho, gravação, históricos antigos com séries
omitidas, mobile e isolamento da Filipa. Sem escrita em dados reais.

## Copiar depois de gravar — Miguel

Após a confirmação da gravação no Firebase, copia automaticamente o mesmo
resumo guardado para o clipboard, pronto a colar no ChatGPT. Uma falha de
gravação não desencadeia a cópia. Se o browser recusar a cópia automática,
aparece o botão «Copiar resumo»; se também recusar esse gesto, apresenta o texto
selecionável. O botão reutiliza o resumo gravado, não alterações ainda por
guardar. A página da Filipa mantém o comportamento anterior.

## Constituição — Peito + Ombro + Braços, aprovado em 12/10/2026

Substitui a opção Peito no seletor de Miguel. O catálogo legado e os resumos
guardados mantêm o treino antigo; não se apagam nem renomeiam dados remotos.
A seleção anterior de Peito passa a sugerir o novo treino, sem reutilizar o
rascunho antigo como se fosse uma sessão deste plano.

- Normal: Chest Press Technogym 3×8–12, Pectoral Technogym 3×12–20,
  elevação lateral com halteres 3×12–20, Arm Extension Technogym 3×10–15,
  Arm Curl Technogym 3×8–12. Total: 15 séries.
- Curto excecional: press 3, lateral 2, tríceps 1, bíceps 1. Total: 7 séries.
- Alternativas exclusivas: lateral no cabo unilateral, tríceps no cabo e
  Scott com halter. Cada série unilateral inclui ambos os lados.
- Novos IDs e cargas iniciais a definir (campo a zero), sem herdar kg do
  Dragão ou do antigo Peito. Nas elevações e Scott regista-se o peso por halter.
- Descanso de 2min30 no press e 1min30 nos restantes. Aquecimento leve,
  configuração da pega/banco nas notas e ajuste inicial com 2–3 reps em reserva.

## Aquecimento adaptado à ordem real — Miguel, 12/10/2026

`js/ginasio-warmup.js` define relações explícitas entre os exercícios conhecidos
de todos os planos de Miguel, incluindo curtos e alternativas. Não modifica
as séries de trabalho, repetições ou cargas. A página da Filipa e a apresentação
de sessões legadas não recebem esta adaptação. Máquinas personalizadas sem
correspondência conservam as suas instruções, sem inferir preparação muscular.

| Situação | Antes | Agora |
| --- | --- | --- |
| Primeiro movimento ou grupo ainda não preparado | Texto fixo | Preparação específica de referência |
| Press antes de tríceps/peitoral isolado | Aquecimento repetido | Extra opcional, recolhido, com botão para mostrar |
| Puxada/remada antes de bíceps | Aquecimento repetido | Extra opcional |
| Leg press antes de extensão | Aquecimento repetido | Extra opcional |
| Remada após puxada; press após fly | Texto fixo | Uma série de adaptação específica, sem eliminar toda a preparação |
| Hip thrust antes de leg curl | Texto fixo | Preparação própria do curl mantida |

São consideradas pelo menos duas séries de trabalho compatíveis registadas
nos últimos 20 minutos, com hora válida e repetições positivas. Esta janela e
contagem são regras práticas conservadoras, não limiares fisiológicos validados.
Um registo do próprio exercício evita sugerir novo aquecimento entre séries.
Abrir um cartão, regressar à página, corrigir repetições ou decorrer tempo
atualiza a sugestão. Valores predefinidos, aquecimentos apenas planeados e
registos de outras sessões não contam como trabalho realizado.

O utilizador pode mostrar a preparação completa para máquina/carga nova ou
sensação de frio. Dor exige adaptar/interromper, não apenas aquecer mais.
Quando falta preparação específica num exercício conhecido, disponibiliza-se
uma série leve de familiarização (6–8 reps, RIR 4+, carga a definir).
Os aquecimentos iniciados, editados e guardados nunca são ocultados ou apagados
pela sugestão. Linhas recolhidas não são iniciadas pelo cronómetro nem entram
automaticamente no resumo. O índice original da série de aquecimento é
preservado nos novos registos para recuperar uma preparação reduzida.

Fundamentação: a revisão de Ribeiro et al. (2021),
https://doi.org/10.6063/motricidade.21143, descreve resultados heterogéneos.
Viveiros et al. (2024), https://doi.org/10.1016/j.jbmt.2024.08.004, encontrou
vantagem de um aquecimento específico com menos repetições num ensaio com 15
homens treinados. Nenhum destes trabalhos valida este algoritmo entre exercícios
nem garante prevenção de lesões; a transferência é uma aplicação prática
prudente com controlo manual e manutenção da preparação específica.

Validação: `node --test tests/ginasio-warmup.test.mjs tests/miguel-ginasio-plan.test.mjs tests/filipa-ginasio-page.test.mjs`.
Chromium com Firebase simulado: ordem inversa, correção de séries, pausa,
controlo manual, persistência de aquecimentos iniciados e de índices omitidos,
gravação/cópia, ausência de overflow mobile e isolamento da Filipa.
