# Estudar da Francisca

Página: `modules/francisca-estudar.html`, no menu Francisca > Estudar.

Organização: Matemática > 1.º Teste e Inglês > 1.º Teste. Cada disciplina tem matéria, treinos, missão, simulações, progresso e histórico próprios; o plano de estudo é partilhado.

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

Não se publicam os PDFs nem as imagens dos manuais. Além de Inglês, as restantes disciplinas reutilizam a lista já presente no calendário; aguardam material e podem receber tarefas no plano.

## Funcionamento de Matemática

- Treino: 6 perguntas, equilibradas por tema quando se escolhe «Todos». Pista opcional sem a resposta, guardada com a sessão; acertos com pista não contam como independentes. Explicação imediata; os erros nas perguntas iniciais acrescentam exercícios de recuperação no fim. Dá-se preferência à mesma competência; na sua ausência, a outra pergunta do mesmo tema.
- Missão: 5 respostas corretas conquistam 5 chaves. Um erro mostra a explicação e acrescenta outro desafio antes de prosseguir. É possível guardar e sair.
- Teste: 12 perguntas, 2 por tema e de competências diferentes, sempre sem repetição de IDs. Sem pistas. Permite regressar e editar. Exige todas as respostas válidas antes de confirmar a entrega; apresenta soluções e nota só no fim.
- Revisão: seleciona as perguntas cuja última tentativa foi errada. Prioriza perguntas ainda não dominadas no treino.
- Campos numéricos aceitam vírgula decimal e, nos campos de percentagem, o símbolo %. Os campos que pedem uma potência aceitam `2^3`, `2³` ou `2**3` e têm um botão xʸ para inserir ^. Quando se pede um resultado numérico, copiar a potência do enunciado não é aceite: a aluna tem de fazer o cálculo. Quando o enunciado pede a resposta como potência de uma base indicada, o campo exige a potência completa e verifica base e expoente. Não se executa código nem se avaliam expressões arbitrárias. As quatro perguntas afetadas foram corrigidas e as respostas guardadas no formato antigo são convertidas uma única vez, mantendo sessões e histórico. Perguntas com vários campos só contam como certas quando todos estão certos. O rascunho é livre e não tem avaliação automática.
- A classificação é a proporção de perguntas totalmente corretas, com pesos iguais; os acertos de recuperação não aumentam a contagem de acertos independentes. Não há avaliação dos passos escritos nem crédito parcial de professora.
- O resumo valoriza também os desafios resolvidos com ajuda, identificados à parte, e convida a explicar uma resolução em voz alta e a voltar a praticar noutro dia. Duas perguntas «Detetive do erro» pedem que se encontre/corrija um erro de raciocínio. São propostas de envolvimento; não se presume conhecer os interesses pessoais da Francisca.
- Progresso, histórico das últimas 20 sessões e sessão ativa ficam em `localStorage`, por UID e disciplina. Matemática mantém a chave anterior `francisca-study-v1:${uid}`; Inglês usa `francisca-study-v1:${uid}:english-test-1`. O plano comum continua na chave de Matemática, sem copiar nem apagar tarefas antigas. Não há sincronização entre navegadores ou dispositivos. Esta limitação está visível na página. O calendário de testes continua a ser consultado na página própria.
- A página segue o mesmo acesso familiar do Horário e Calendário. A autenticação normal é obrigatória. Não foram alteradas regras do Firestore.

## Validação

`node --test tests/francisca-estudar.test.mjs tests/francisca-estudar-content.test.mjs tests/francisca-estudar-english.test.mjs tests/access-control.test.mjs tests/francisca-calendar.test.mjs tests/financas-pages.test.mjs`

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

Matemática usa `js/francisca-estudar-data.js`; Inglês usa `js/francisca-estudar-english-data.js`. As configurações ficam em `js/francisca-estudar-courses.js`. Preservar os IDs publicados porque o progresso usa esses identificadores. Cada tema de Matemática precisa de pelo menos duas competências para o teste equilibrado; Inglês segue a sua matriz de seleção. Não marcar uma disciplina como pronta sem material validado.

## Inglês · 1.º Teste (21/10/2026)

157 perguntas originais, nove temas, explicações em português e tarefas em inglês. Fontes lidas visualmente na íntegra: `C:/ChatGPT/Francisca/ingleslivro.pdf` (20 imagens) e `C:/ChatGPT/Francisca/inglesworlbook.pdf` (13 imagens; conserva-se a grafia do ficheiro).

| Digitalizações | Páginas impressas | Matéria e formatos |
| --- | --- | --- |
| Livro 1–4 | 10–13 | Informação pessoal, to be, pronomes pessoais, determinantes possessivos e question words |
| Livro 5 | Recorte Have a go!, sem número visível | Família, emoções e partes do dia; não se deduzem respostas de uma imagem que falta |
| Livro 6–15 | 16–25 | Família, aspeto, personalidade, leitura, have got, profissões, possessive case/pronouns e descrição escrita/oral |
| Livro 16–20 | 26–30 | Rotina, horas, leitura e present simple afirmativo/negativo/interrogativo |
| Workbook 1–3 | 3–5 | Revisão: dados pessoais, ordinais, aniversários, nacionalidades, família, casa e alimentação |
| Workbook 4–7 | 6–9 | Família/descrição, have got, profissões e possessivos |
| Workbook 8–11 | 10–13 | Rotina, horas, present simple e adverbs of frequency |
| Workbook 12–13 | 14–15 | Modelo Test · Unit 1: leitura, gramática e escrita sobre a rotina |

- Treino: seis perguntas de temas distintos quando se escolhe Todos (seis dos nove temas por sessão). Missão: cinco chaves. Revisão e recuperação usam apenas perguntas de Inglês; as pistas marcam a resposta como assistida.
- Há escolha múltipla, lacunas, transformações de frases, respostas curtas, ordinais, perguntas de leitura, relógios analógicos e jogos de ordenar palavras. O jogo permite desfazer, limpar e retomar; exige todas as palavras antes de verificar. Sem arrastar, para funcionar em telemóvel e por teclado.
- Respostas escritas toleram espaços, apóstrofos tipográficos, maiúsculas/minúsculas em geral e vírgulas/pontuação final. As nacionalidades pedidas isoladamente exigem maiúscula. Formas alternativas corretas são explícitas (is not/isn’t, has not/hasn’t, grafias de vocabulário, etc.). Não há comparação vaga que aceite erros de gramática ou apóstrofos de posse incorretos. A pontuação e as maiúsculas das frases completas devem ser revistas na grelha.
- A simulação tem 20 exercícios: quatro de leitura sobre um de dois textos originais (verdadeiro/falso com evidência ou correção escrita, resposta completa, resposta curta e horas), três de família/profissões/descrição, um de informação pessoal, um de to be, dois de have got, três de possessivos, quatro de present simple/frequência, um de horas e um de rotina. A leitura mantém um texto coerente. Depois, composição de 40–60 palavras, com manhã/tarde/noite, dois horários e um advérbio. O número de palavras é uma meta desta simulação, não uma exigência atribuída à professora.
- A composição é obrigatória para entregar, fica guardada com a sessão e com a correção, e tem grelha de revisão/exemplo apenas depois da entrega. Não recebe nota automática. A percentagem diz expressamente que abrange só os 20 exercícios fechados, com pesos iguais e sem crédito parcial.
- A oficina permite planear, escrever, rever com cinco critérios e ler o próprio texto em voz alta. O rascunho persiste por conta/discipina. O método propõe recordar cinco palavras, praticar, justificar uma correção e repetir noutro dia.
- Os áudios e o vídeo referidos nas páginas não vêm nos PDFs. Não se inventam respostas para esses exercícios nem se anuncia uma avaliação de listening/pronúncia. A simulação acompanha o modelo escrito do workbook, não uma matriz da professora que não foi fornecida.

`tests/francisca-estudar-english.test.mjs` verifica a matriz de seleção, respostas alternativas, erros comuns, relógios, leitura, ordenação e isolamento de estados. `tests/francisca-estudar-english.browser.mjs` percorre as 157 perguntas a 390 px, testa missão com erro, ordenação/retoma, escrita/entrega/correção, plano comum e preservação da sessão de Matemática. As duas regressões de navegador usam contas fictícias e bloqueiam pedidos externos; imagens de verificação ficam em `tests/.runtime`, excluídas da publicação.

## Revisão de adequação de Inglês (21/10/2026)

Compararam-se novamente os exercícios, resumos e explicações com as páginas de gramática do livro e com o modelo Test · Unit 1 do workbook (14–15). A base estava adequada; as principais alterações reforçam a produção escrita e evitam correções excessivamente rígidas:

- Mais 14 exercícios (157 no total): seis de leitura, cinco sobre o significado dos advérbios e três de present simple, incluindo formas misturadas, uma pergunta escrita sem peças e does/tries.
- A simulação mantém 20 exercícios e composição. As quatro perguntas de leitura passam a incluir verdadeiro/falso com preenchimento de evidência ou correção, e uma resposta completa escrita. Há afirmações verdadeiras e falsas. Os exercícios anteriores mantêm IDs e campos, preservando sessões guardadas e histórico.
- Jogos de ordenar aceitam também complementos de tempo no início quando a frase mantém o sentido. A correção tolera a ausência da vírgula em respostas como No they aren't; continua a exigir verbos e apóstrofos corretos. A pontuação é revista à parte na escrita.
- Dois enunciados ficaram mais precisos: escolha entre Which/Who e negativa explicitamente com have got. O resumo explica o significado de always/usually/often/sometimes/never, sem percentagens arbitrárias.
- O método propõe uma sessão de cerca de 15 minutos (recordar, praticar, explicar/corrigir), retoma das dificuldades na sessão seguinte e uma simulação após praticar os temas. Recomenda revisão da composição com um adulto/professora; não apresenta a grelha como correção automática.
- A simulação continua mais abrangente do que o modelo de duas páginas do workbook, pois inclui também a matéria das restantes digitalizações indicadas para o teste. Não se conhece a matriz nem a ponderação real da professora. Áudios não fornecidos e composição não são avaliados automaticamente.

Validação da revisão: 50 testes unitários/de conteúdo; regressões de navegador de Inglês (157 perguntas) e Matemática (80 perguntas), incluindo entrega, retoma e largura de 390 px.
