# Estudar da Francisca

Página: `modules/francisca-estudar.html`, no menu Francisca > Estudar.

Organização: Matemática > 1.º Teste. Toda a matéria inicial, treinos, missão e simulações pertencem a esta preparação; as sessões e o histórico identificam o teste.

## Conteúdo inicial

65 perguntas originais, em português de Portugal, baseadas na leitura visual das 11 páginas de `C:/ChatGPT/Francisca/Digitalizado_20261019-2119.pdf`:

| Páginas do PDF | Páginas do livro | Conteúdo |
| --- | --- | --- |
| 1–2 | 102–103 | Barras, barras justapostas, moda, frequências relativas e pontuações |
| 3–4 | 104–105 | Gráficos circulares, percentagens e comparação de populações |
| 5 | 107, inferida pela sequência | Classes e contagem, frequências, classes modais e histogramas |
| 6–7 | 108–109 | Dados contínuos, limites de classes, amplitudes e histogramas |
| 8–9 | 8–9 | Potências, base, expoente, leitura e cálculo |
| 10–11 | 10–11 | Prioridade das operações, linguagem matemática e problemas com potências |

Não se publica o PDF nem as imagens do manual. As restantes disciplinas reutilizam a lista já presente no calendário; aguardam material e podem receber tarefas no plano.

## Funcionamento

- Treino: 6 perguntas, equilibradas por tema quando se escolhe «Todos». Explicação imediata; os erros nas perguntas iniciais acrescentam exercícios de recuperação no fim.
- Missão: 5 respostas corretas conquistam 5 chaves. Um erro mostra a explicação e acrescenta outro desafio antes de prosseguir. É possível guardar e sair.
- Teste: 12 perguntas, 2 por tema, sempre sem repetição de IDs. Permite regressar e editar. Exige todas as respostas válidas antes de confirmar a entrega; apresenta soluções e nota só no fim.
- Revisão: seleciona as perguntas cuja última tentativa foi errada. Prioriza perguntas ainda não dominadas no treino.
- Campos numéricos aceitam vírgula decimal e, nos campos de percentagem, o símbolo %. Não executam expressões escritas. Perguntas com vários campos só contam como certas quando todos estão certos. O rascunho é livre e não tem avaliação automática.
- A classificação é a proporção de perguntas totalmente corretas, com pesos iguais; os acertos de recuperação não aumentam a contagem de acertos independentes. Não há avaliação dos passos escritos nem crédito parcial de professora.
- Progresso, histórico das últimas 20 sessões, sessão ativa e tarefas ficam em `localStorage`, com chave por UID. Não há sincronização entre navegadores ou dispositivos. Esta limitação está visível na página. O calendário de testes continua a ser consultado na página própria.
- A página segue o mesmo acesso familiar do Horário e Calendário. A autenticação normal é obrigatória. Não foram alteradas regras do Firestore.

## Validação

`node --test tests/francisca-estudar.test.mjs tests/access-control.test.mjs tests/francisca-calendar.test.mjs tests/financas-pages.test.mjs`

Pré-visualização com conta fictícia, excluída da publicação por `firebase.json`: `node tests/francisca-estudar-preview.mjs`, em `http://127.0.0.1:4178/modules/francisca-estudar.html`. A rota `/mobile` apresenta a página num iframe de 390 px para revisão visual. Não liga a dados de produção.

A pré-visualização foi usada para verificar explicação após erro, retoma após recarregar, plano persistente, entrega de um teste de 12 perguntas, missão com erro e posterior conclusão, e apresentação a 390 px.

## Acrescentar matéria

Manter perguntas, respostas, passos e fontes em `js/francisca-estudar-data.js`. Preservar os IDs publicados porque o progresso usa esses identificadores. Cada tema precisa de pelo menos duas perguntas para participar no teste equilibrado. Ao adicionar disciplinas com exercícios, adaptar a seleção de conteúdos na página; não marcar uma disciplina como pronta sem material validado.
