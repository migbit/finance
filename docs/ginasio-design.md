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
