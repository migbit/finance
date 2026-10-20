# Estudar da Francisca

Página: `modules/francisca-estudar.html`, no menu Francisca > Estudar.

Organização: Matemática > 1.º Teste. Toda a matéria inicial, treinos, missão e simulações pertencem a esta preparação; as sessões e o histórico identificam o teste.

## Conteúdo inicial

80 perguntas em português de Portugal, baseadas na leitura visual das 11 páginas de `C:/ChatGPT/Francisca/Digitalizado_20261019-2119.pdf`. A revisão de 20/10/2026 voltou a comparar todos os enunciados, soluções, gráficos e resumos com essas páginas:

| Páginas do PDF | Páginas do livro | Conteúdo |
| --- | --- | --- |
| 1–2 | 102–103 | Barras, barras justapostas, moda, frequências relativas e pontuações |
| 3–4 | 104–105 | Gráficos circulares, percentagens e comparação de populações |
| 5 | 107, inferida pela sequência | Classes e contagem, frequências, classes modais e histogramas |
| 6–7 | 108–109 | Dados contínuos, construção e limites de classes, amplitudes, histogramas e percentagens arredondadas |
| 8–9 | 8–9 | Potências, base, expoente, leitura, expoente 1, bases decimais e potências de 10 |
| 10–11 | 10–11 | Prioridade das operações, linguagem matemática e problemas com potências |

Não se publica o PDF nem as imagens do manual. As restantes disciplinas reutilizam a lista já presente no calendário; aguardam material e podem receber tarefas no plano.

## Funcionamento

- Treino: 6 perguntas, equilibradas por tema quando se escolhe «Todos». Pista opcional sem a resposta, guardada com a sessão; acertos com pista não contam como independentes. Explicação imediata; os erros nas perguntas iniciais acrescentam exercícios de recuperação no fim. Dá-se preferência à mesma competência; na sua ausência, a outra pergunta do mesmo tema.
- Missão: 5 respostas corretas conquistam 5 chaves. Um erro mostra a explicação e acrescenta outro desafio antes de prosseguir. É possível guardar e sair.
- Teste: 12 perguntas, 2 por tema e de competências diferentes, sempre sem repetição de IDs. Sem pistas. Permite regressar e editar. Exige todas as respostas válidas antes de confirmar a entrega; apresenta soluções e nota só no fim.
- Revisão: seleciona as perguntas cuja última tentativa foi errada. Prioriza perguntas ainda não dominadas no treino.
- Campos numéricos aceitam vírgula decimal e, nos campos de percentagem, o símbolo %. Os campos que pedem uma potência aceitam `2^3`, `2³` ou `2**3` e têm um botão xʸ para inserir ^. Quando se pede um resultado numérico, copiar a potência do enunciado não é aceite: a aluna tem de fazer o cálculo. Quando o enunciado pede a resposta como potência de uma base indicada, o campo exige a potência completa e verifica base e expoente. Não se executa código nem se avaliam expressões arbitrárias. As quatro perguntas afetadas foram corrigidas e as respostas guardadas no formato antigo são convertidas uma única vez, mantendo sessões e histórico. Perguntas com vários campos só contam como certas quando todos estão certos. O rascunho é livre e não tem avaliação automática.
- A classificação é a proporção de perguntas totalmente corretas, com pesos iguais; os acertos de recuperação não aumentam a contagem de acertos independentes. Não há avaliação dos passos escritos nem crédito parcial de professora.
- O resumo valoriza também os desafios resolvidos com ajuda, identificados à parte, e convida a explicar uma resolução em voz alta e a voltar a praticar noutro dia. Duas perguntas «Detetive do erro» pedem que se encontre/corrija um erro de raciocínio. São propostas de envolvimento; não se presume conhecer os interesses pessoais da Francisca.
- Progresso, histórico das últimas 20 sessões, sessão ativa e tarefas ficam em `localStorage`, com chave por UID. Não há sincronização entre navegadores ou dispositivos. Esta limitação está visível na página. O calendário de testes continua a ser consultado na página própria.
- A página segue o mesmo acesso familiar do Horário e Calendário. A autenticação normal é obrigatória. Não foram alteradas regras do Firestore.

## Validação

`node --test tests/francisca-estudar.test.mjs tests/francisca-estudar-content.test.mjs tests/access-control.test.mjs tests/francisca-calendar.test.mjs tests/financas-pages.test.mjs`

O teste de conteúdo compara as 80 respostas com um gabarito separado, resolvido a partir dos enunciados, rejeita alternativas erradas e verifica totais, intervalos e arredondamentos. O teste de navegador `tests/francisca-estudar.browser.mjs` percorre as 80 perguntas, verifica explicações e largura a 390 px, entrega um teste de 12 perguntas, retoma pistas e respostas, e confirma que pistas/recuperação não contam como acertos sem ajuda.

Pré-visualização com conta fictícia, excluída da publicação por `firebase.json`: `node tests/francisca-estudar-preview.mjs`, em `http://127.0.0.1:4178/modules/francisca-estudar.html`. A rota `/mobile` apresenta a página num iframe de 390 px para revisão visual. Não liga a dados de produção.

A pré-visualização foi usada para verificar explicação após erro, retoma após recarregar, plano persistente, entrega de um teste de 12 perguntas, missão com erro e posterior conclusão, e apresentação a 390 px.

## Resultado da revisão da matéria

- Não foram encontrados erros nos resultados numéricos das 65 perguntas iniciais. Clarificou-se que o expoente conta fatores, e não operações de multiplicação; distinguiu-se frequência relativa decimal de percentagem; qualificou-se a relação entre amplitude e número de classes.
- Acrescentaram-se 15 exercícios para competências presentes no PDF que estavam ausentes ou pouco representadas: expoente 1, base decimal, potências de 10, produto como potência, leitura de expressões, deteção de erros, conversão de frequência relativa decimal, arredondamentos, dados contínuos, construção dos limites das classes e histograma a partir de tabela.
- Os histogramas de alturas identificam a unidade no eixo horizontal. Os resumos avisam que percentagens arredondadas podem não somar exatamente 100%. As soluções decimais usam vírgula.
- A correspondência é com o PDF fornecido, não com uma matriz de avaliação da professora nem com todo o programa anual. Reconhecer expressões numa escolha múltipla não substitui escrever e justificar passos: o rascunho/papel continua importante e não é avaliado automaticamente.
- As escolhas pedagógicas de alternar exemplos e problemas, usar perguntas para recuperar a matéria e espaçar revisões são apoiadas pelo [guia do Institute of Education Sciences](https://ies.ed.gov/ncee/wwc/PracticeGuide/1). As pistas e desafios são uma aplicação ao contexto desta página, sem prometer um efeito individual na motivação.

## Acrescentar matéria

Manter perguntas, respostas, passos e fontes em `js/francisca-estudar-data.js`. Preservar os IDs publicados porque o progresso usa esses identificadores. Cada tema precisa de pelo menos duas perguntas para participar no teste equilibrado. Ao adicionar disciplinas com exercícios, adaptar a seleção de conteúdos na página; não marcar uma disciplina como pronta sem material validado.
