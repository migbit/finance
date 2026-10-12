# Ginásio — interface partilhada

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
