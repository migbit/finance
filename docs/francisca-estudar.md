# Estudar da Francisca

Página: `modules/francisca-estudar.html`, no menu Francisca > Estudar.

Organização: Matemática > 1.º Teste e Inglês > 1.º Teste. Ciências Naturais e História e Geografia de Portugal também têm 1.º Teste. Cada disciplina tem matéria, treinos, missão, simulações, progresso e histórico próprios; o plano de estudo é partilhado.

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
## Ciências Naturais · 1.º Teste (29/10/2026)

Fonte: leitura visual integral das 36 páginas de `C:/ChatGPT/Francisca/Ciencias1teste.pdf`, manual 8–43. Há cortes marginais e alguma curvatura junto à encadernação; os conceitos usados são legíveis. A primeira página não mostra o número, identificado pela sequência. Não foram incorporadas imagens digitalizadas na aplicação.

### Correspondência e objetivos

| PDF | Manual | Conteúdos e competências |
| --- | --- | --- |
| 1–4 | 8–11 | Importância da alimentação; alimento/nutriente; simples/composto; natural/processado; seis grupos de nutrientes; interpretar composição |
| 5–6 | 12–13 | Indicadores de proteínas, cor violeta, hipótese, controlo com água destilada, interpretar observações |
| 7–8 | 14–15 | Funções plástica, energética, reguladora/protetora; macro/micronutrientes; água e fibras |
| 9–10 | 16–17 | Dieta mediterrânica, sete grupos, proporções da roda, água, recomendações de vida |
| 11–12 | 18–19 | Necessidades variáveis, carência/excesso, avitaminoses/hipervitaminoses, alimentação e risco de doença |
| 13–15 | 20–22 | Ingredientes, alergénios, validade, conservação, informação nutricional; comparar mesma base; descodificador para sólidos/bebidas |
| 16–18 | 23–25 | Funções dos aditivos; salga, defumação, conserva, frio, calor, vácuo; probióticos, transgénicos e produtos light/zero |
| 19–20 | 26–27 | Síntese e exercícios de completar, V/F, justificação e identificação de conservação |
| 21–24 | 28–31 | Necessidade de digestão; tubo digestivo e glândulas anexas, secreções, vesícula biliar, percurso |
| 25–26 | 32–33 | Ingestão, digestão, absorção, assimilação e expulsão; distinguir destinos |
| 27–28 | 34–35 | Dentição adulta, tipos/funções, mastigação/insalivação, transformações físicas/químicas, bolo alimentar |
| 29–30 | 36–37 | Experiência da fragmentação do açúcar, condições controladas, deglutição, epiglote, peristaltismo |
| 31–32 | 38–39 | Cárdia/piloro, suco gástrico/quimo, duodeno, bílis, sucos pancreático e intestinal |
| 33–34 | 40–41 | Pregas/vilosidades/vasos, absorção para sangue/linfa, intestino grosso, fezes, reto, defecação e obstipação |
| 35–36 | 42–43 | Cárie, higiene oral, alimentação, água/fibras, atividade física, evitar tabaco/álcool |

O índice de apoio refere páginas posteriores sobre aves e ruminantes, mas essas páginas não foram fornecidas e não são matéria obrigatória aqui. Os registos experimentais do manual estão por preencher: a tabela usada nos exercícios está explicitamente identificada como experiência fictícia. Não se apresentam previsões como resultados observados. O esquema molecular é um modelo de transformação, sem pretender representar moléculas específicas. A definição dos alimentos processados é tratada sem pressupor que todos contêm aditivos. Não se reproduzem como regras absolutas as simplificações do manual sobre doença/risco; não se ensina que açúcar causa todos os tipos de diabetes ou que alimentação impede qualquer doença. O exemplo de leite pasteurizado sob o título ultrapasteurização não é usado para equiparar os dois tratamentos.

### Implementação

- `js/francisca-estudar-science-data.js`: 91 desafios originais, dez temas com resumos e referências, três níveis (recordar, interpretar, aplicar/justificar). Associação por alíneas, escolha múltipla, V/F com justificação, completar termos, ordenar etapas, leitura de tabelas, roda e três tipos de esquemas SVG originais.
- Reutiliza `courses`, núcleo de seleção/correção, sessões, missão de cinco chaves, pistas, recuperação, rascunho, plano e histórico existentes. Sem um segundo motor de jogos ou avaliação. Ciência tem chave independente `francisca-study-v1:${uid}:science-test-1`; as chaves anteriores são preservadas.
- A seleção adaptativa usa conceito (`topic + skill`), dificuldade e evidência de respostas, dando prioridade a erros, conceitos a recordar e perguntas diferentes. Um erro recebe identificação das alíneas, solução e explicação, seguido de outra pergunta do mesmo conceito quando existe. Recuperação e pistas não contam como independentes. Após erro volta a privilegiar tarefas básicas; com acertos independentes dá preferência às de aplicação.
- Um conceito confirmado exige dois IDs com acerto independente, pelo menos dois dias em Lisboa, uma tarefa de interpretação/raciocínio e ausência de erro mais recente do que o último acerto independente. Isto é uma regra conservadora de evidência observável, não deteção de acaso nem garantia de domínio. A aplicação não avalia semanticamente texto livre. A revisão inclui conceitos tentados ainda não confirmados e retoma perguntas noutra sessão; não agenda notificações.
- O painel ensina a identificar ideias, fechar o resumo, recordar, usar associações, ler os verbos do enunciado, justificar com dados e explicar/corrigir o erro. Propõe sessões de 10–15 minutos e revisão noutro dia. O rascunho persiste com a sessão e não recebe nota. Termos em português aceitam ausência de acentos; a solução mostra a grafia correta. Inglês mantém as regras anteriores.
- Simulação: 20 perguntas, duas por cada tema (uma básica/interpretação e uma de aplicação de competência diferente), 5 pontos cada = 100, duração sugerida 45 minutos. Seleção favorece tabelas, esquemas e V/F na parte de interpretação. Sem pistas ou feedback até entregar; navegação e retoma. Alíneas têm partes iguais da cotação; o total é arredondado às centésimas. Nota e percentagem usam os pontos, não só o número de perguntas inteiramente certas. Histórico preserva a cotação. Versões variam mantendo distribuição. Esta distribuição é uma opção pedagógica, não uma matriz atribuída à professora.

### Validação

`node --test tests/francisca-estudar-science.test.mjs tests/francisca-estudar.test.mjs tests/francisca-estudar-content.test.mjs tests/francisca-estudar-english.test.mjs tests/access-control.test.mjs tests/francisca-calendar.test.mjs tests/financas-pages.test.mjs`

54 testes passam. Ciências verifica integridade, soluções e alternativas, gabarito independente de conceitos e dados, 80 versões equilibradas, pontuação total/parcial, progressão por variante/dia, efeito de ajuda/erro e persistência. `tests/francisca-estudar-science.browser.mjs` percorre os 91 desafios, entrega teste com erro e crédito parcial, verifica retoma/recuperação/isolamento e largura de 390 px. As regressões existentes percorrem também os 80 exercícios de Matemática e 157 de Inglês. Capturas locais em `tests/.runtime`, excluídas da publicação. O progresso continua local a este navegador/conta, sem sincronização entre dispositivos.
## História e Geografia de Portugal · 1.º Teste (07/11/2026)

Fonte: leitura visual integral das dez páginas de `C:/ChatGPT/Francisca/1 teste historia.pdf`. A ordem do ficheiro corresponde ao manual 25–27, 29–35. A página 28, o mapa e o gráfico referidos na página 25 não foram fornecidos. Não se inventam os seus valores. Há cortes e curvatura nas margens, mas a matéria usada é legível. Não se publicam as digitalizações.

| PDF | Manual | Conteúdo |
| --- | --- | --- |
| 1 | 25 | Bandeirantes; Minas Gerais/1695; ouro, diamantes, impostos de 20%, colonização, emigração e escravização |
| 2–3 | 26–27 | Saberes, trabalhos e legado africano; língua, alimentação, música, dança, diversidade e repressão cultural |
| 4 | 29 | Clero/nobreza/Terceiro Estado; hierarquia, privilégios, burguesia, mobilidade; Inquisição, cristãos-novos, auto da fé |
| 5–6 | 30–31 | Governo e poderes de D. João V; origem divina como crença histórica; ostentação, cerimónias, invenção de Gusmão/1709 |
| 7–8 | 32–33 | Barroco e património: Mafra, Biblioteca Joanina/Coimbra, capela-mor de Évora e Aqueduto das Águas Livres/Lisboa; distinguir lenda de evidência |
| 9–10 | 34–35 | Sucessão em 1750; 1/11/1755; efeitos, socorro e reconstrução; ministro e rei; traçado urbano, gaiola e Praça do Comércio |

69 exercícios originais distribuídos por cinco temas. Reutilizam os campos, explicações, missão, pistas, treino adaptativo, recuperação por conceito, rascunho, plano e histórico existentes. A seleção de treino foi completada para seis perguntas mesmo quando há apenas cinco temas, mantendo IDs únicos. Existem perguntas escritas, associação por alíneas, V/F com justificação, textos de apoio explicitamente identificados como sínteses didáticas, tabela comparativa, cronologia e raciocínio de causa/consequência. Textos portugueses usam o idioma correto; não são apresentados como fontes primárias transcritas. Uma promessa não prova o resultado; uma lenda não prova a causa histórica. Exploração colonial e escravização são tratadas com rigor e sem celebrar violência.

Simulação de 10 perguntas, duas por tema, 10 pontos cada = 100; duração sugerida 40 minutos. Inclui um exercício de recordar/interpretar e um de aplicação de competência diferente em cada tema; versões variam. Sem pistas/correções antes da entrega, crédito proporcional por alínea e correção final. A cotação de História é indicada separadamente da de Ciências (5 pontos por pergunta). A classificação não avalia semanticamente justificações livres no rascunho nem conhece a matriz da professora. Progresso isolado na chave `francisca-study-v1:${uid}:history-test-1`, preservando as restantes disciplinas.

### Resumos visuais com gatinhos e bonequinhos

Cinco cartazes gerados com a ferramenta integrada de imagem (sem CLI), revistos visualmente e guardados em WebP com as dimensões originais:

- `assets/francisca/historia/brasil.webp`: ouro, imposto, trabalho forçado e legado.
- `assets/francisca/historia/sociedade.webp`: ordens, privilégios, burguesia e perseguição religiosa.
- `assets/francisca/historia/poder.webp`: três poderes e corte de D. João V.
- `assets/francisca/historia/patrimonio.webp`: barroco e quatro associações de lugar/função.
- `assets/francisca/historia/lisboa.webp`: sucessão, catástrofe, socorro e reconstrução.

São ilustrações mnemónicas atuais, com figuras e edifícios simplificados, não retratos fiéis ou documentos históricos. Os gatinhos são guias de memória. Não se usam gatos como pessoas escravizadas nem humor sobre vítimas. Alguns elementos decorativos das figuras são genéricos; não se avalia heráldica nem exatidão arquitetónica com estes desenhos. O cartaz de Lisboa inclui a imagem atual estilizada da praça; não deve ser lido como fotografia de 1755.

A secção abre por «Abrir resumos visuais». Cada cartaz tem imagem ampliável, texto alternativo, versão textual acessível, referência de páginas e botão «Esconder e recordar». Esconder tapa também a versão textual; apresenta um desafio de memória e permite conferir depois. Não atribui domínio por simplesmente abrir ou conferir um cartaz. As imagens carregam de forma diferida e podem ser abertas em tamanho completo; não são descarregadas obrigatoriamente ao abrir o módulo. O teste não mostra os cartazes.

Validação: 59 testes unitários/de conteúdo, incluindo gabarito independente, alternativas, cobertura, conceitos com exercícios de recuperação, 100 versões de teste, 100 pontos, crédito parcial e ficheiros WebP locais. O teste de navegador percorre os 69 exercícios a 390 px, verifica todas as imagens, esconder/recordar, retoma após erro, isolamento de disciplinas e entrega/correção do teste. Regressões das disciplinas anteriores verificadas em separado. Capturas em `tests/.runtime`, fora da publicação.

### Prompts finais das imagens de História

Os cinco prompts seguintes foram enviados à ferramenta integrada `image_gen`; a conversão PNG→WebP foi apenas codificação para uso no projeto, sem alterar a composição.

#### 1. brasil

Use case: infographic-diagram. Create a polished Portuguese school study poster, portrait, age 11, cream background, teal and ochre accents, cute small cat tutor with notebook in lower corner and respectful simple human stick-figure pupils. Topic: Brazil and the Portuguese economy in the 18th century. Exactly these large readable texts in Portuguese: 'BRASIL: OURO E PESSOAS', '1695 — Minas Gerais', 'Bandeirantes: litoral → interior', 'Coroa: imposto de 20% sobre o ouro', 'Ouro → riqueza da Coroa', 'Escravização: trabalho forçado e perda de liberdade', 'Legado africano: saberes, língua, música e alimentação'. Illustrate interior exploration with a symbolic coastal-to-mine arrow, five gold coins with exactly one highlighted as tax, open book and musical instrument symbols. No map with invented borders, no flags, no enslaved cartoon cats, no chains as a game, no celebration of exploitation. Cats are present-day memory guides only. Keep facts separate from mnemonics. Typography takes priority, ample whitespace.

#### 2. sociedade

Use case: infographic-diagram. Create a polished portrait Portuguese school memory poster age 11, cream background, teal and coral, cute cat tutor holding an open notebook, simple respectful human stick figures. EXACT large readable text: 'SOCIEDADE DE ORDENS', 'Clero + Nobreza: grupos privilegiados', 'Terceiro Estado: povo e burguesia', 'Hierarquia ≠ igualdade', 'Burguesia: riqueza do comércio', 'Inquisição: tribunal religioso', 'Cristãos-novos: judeus convertidos ao cristianismo', 'Perseguição religiosa não é tolerância'. Visual organization: three clearly named shelves, clero with book, nobility with symbolic decorative coat, Terceiro Estado with workers and merchant, king icon above shelves with label 'Rei'. Small separate serious panel with closed tribunal door for religious persecution. No violence, executions or humorous treatment of persecution. No implication people deserve unequal rights. Characters are memory aids, not historical documents.

#### 3. poder

Use case: infographic-diagram. Create a polished portrait Portuguese school memory poster age 11. Cream background, teal and gold, cute cat tutor beside three oversized power cards and small human 18th-century stylized figures. Exact large readable Portuguese text: 'D. JOÃO V: MONARQUIA ABSOLUTA', 'Rei concentra os poderes', 'Legislativo: aprovar leis', 'Executivo: governar', 'Judicial: intervir nos tribunais', 'Origem divina: crença usada para justificar o poder', 'Ouro do Brasil → luxo da corte', 'Festas, coches e grandes construções'. Central king figure, three cards linked by arrows from king, coins linked to carriage and ornate building. The divine-origin claim must visibly be labelled as historical belief, not truth. No modern parliament or modern flags. Cat is a friendly current-day narrator, not the king. Short text, strong hierarchy, white space.

#### 4. patrimonio

Use case: infographic-diagram. Create a polished portrait Portuguese school memory poster age 11, cream, teal and gold, cute small cat tutor with a magnifying glass, tiny human pupil stick figures. Exact readable Portuguese labels: 'BARROCO: MOSTRAR GRANDEZA', 'Decoração abundante', 'Talha dourada • mármores • azulejos', 'Mafra: convento + basílica + palácio', 'Biblioteca Joanina: Coimbra', 'Capela-mor: Sé de Évora', 'Aqueduto das Águas Livres: levar água a Lisboa'. Four large simple landmark memory icons: symmetrical convent-palace with paired bell towers and central dome for Mafra, ornate gilded library for Joanina, decorated chapel for Évora, arches carrying water for aqueduct. Do not depict aqueduct as library or identify all four monuments as identical architecture. These are schematic educational illustrations, not faithful photographs. No extra historical facts. Cat as mnemonic helper only, keep labels prominent.

#### 5. lisboa

Use case: infographic-diagram. Create a polished portrait Portuguese school memory poster age 11, cream, teal and muted coral, cute cat tutor with notebook and respectful simple human stick figures planning a city. Exact clear Portuguese text: 'LISBOA: 1755 E RECONSTRUÇÃO', '1750: D. José I sucede a D. João V', '1 de novembro de 1755', 'Terramoto + ondas gigantes + incêndios', 'Marquês de Pombal: organizar o socorro', 'Cuidar • alojar • limpar • vigiar', 'Reconstrução: ruas largas e perpendiculares', 'Prédios semelhantes + gaiola antissísmica', 'Praça do Comércio: estátua de D. José I'. Three sequential calm panels: damaged empty city symbolic, helpers with shelter and water icons, new geometric street plan with perpendicular grid and a small inset timber bracing cage inside building. No casualties, no cute disaster victims, no claim cage prevents all damage, no conflation king and minister. Accurate date and names. Focus on event → response → changes.
