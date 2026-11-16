import {QUESTIONS,TOPICS,TOPIC_HINTS} from './francisca-estudar-data.js';
import {PORTUGUESE_QUESTIONS,PORTUGUESE_TOPICS,PORTUGUESE_HINTS,PORTUGUESE_WRITING,PORTUGUESE_VISUALS,PT_STORY} from './francisca-estudar-portuguese-data.js';
import {HISTORY_QUESTIONS,HISTORY_TOPICS,HISTORY_HINTS,HISTORY_VISUALS} from './francisca-estudar-history-data.js';
import {SCIENCE_QUESTIONS,SCIENCE_TOPICS,SCIENCE_HINTS} from './francisca-estudar-science-data.js';
import {ENGLISH_QUESTIONS,ENGLISH_TOPICS,ENGLISH_HINTS,ENGLISH_WRITING,ENGLISH_EXAM_SLOTS,ENGLISH_READING_SKILLS} from './francisca-estudar-english-data.js';

export const MATHS_COURSE={
  id:'maths',subject:'Matemática',questions:QUESTIONS,topics:TOPICS,hints:TOPIC_HINTS,
  badge:'Potências + Dados',intro:'Exercícios originais baseados nas 11 páginas do teu PDF. Usa papel e lápis: escreve as contas antes de responder.',
  testDescription:'12 perguntas, 2 por tema. Podes rever as respostas. A correção aparece só quando entregares.',testButton:'Fazer teste · ~30 min',
  sources:'Potências, linguagem matemática e expressões: livro 8–11 (PDF 8–11). Gráficos de barras e circulares: livro 102–105 (PDF 1–4). Classes, frequências e histogramas: livro 107–109 (PDF 5–7; a página 107 foi identificada pela sequência).'
};
export const ENGLISH_COURSE={
  id:'english',subject:'Inglês',questions:ENGLISH_QUESTIONS,topics:ENGLISH_TOPICS,hints:ENGLISH_HINTS,writing:ENGLISH_WRITING,examSlots:ENGLISH_EXAM_SLOTS,readingSkills:ENGLISH_READING_SKILLS,
  badge:'People around me + My day',intro:'Treina com as páginas do livro e do workbook. Lê, tenta responder de memória e explica o que corrigiste. As explicações estão em português.',
  testDescription:'Leitura, vocabulário, gramática e horas: 20 exercícios + uma composição. Correção automática só no fim; escrita com grelha de revisão.',testButton:'Fazer teste · ~40 min',
  sources:'Livro: 20 digitalizações — páginas 10–13, um recorte Have a go! e páginas 16–30. Workbook: 13 digitalizações — páginas 3–15, incluindo o Test · Unit 1. Os áudios e o vídeo mencionados no papel não estão nos PDFs. Esta simulação escrita usa textos e situações originais; não reproduz os áudios nem garante a matriz da professora.'
};
export const SCIENCE_COURSE={id:'science',subject:'Ciências Naturais',language:'pt-PT',adaptive:true,questions:SCIENCE_QUESTIONS,topics:SCIENCE_TOPICS,hints:SCIENCE_HINTS,
 badge:'Alimentação + Digestão',intro:'Sessões de 6 desafios: recordar, interpretar e justificar. Um acerto é um começo; confirma o conceito noutra pergunta e noutro dia.',
 testDescription:'20 perguntas · 100 pontos · cerca de 45 minutos. Dois desafios por tema, incluindo aplicação e raciocínio. Sem pistas; correção só no fim.',testButton:'Fazer teste · ~45 min',
 sources:'36 digitalizações, manual 8–43: alimentação e nutrientes, experiências, roda, saúde, rótulos, aditivos e conservação; sistema digestivo humano até saúde oral/digestiva. Aves e ruminantes só figuram no índice: não são avaliados. Esquemas originais simplificados, sem escala. Não se conhece a matriz da professora.'};
export const HISTORY_COURSE={id:'history',subject:'História e Geografia de Portugal',language:'pt-PT',adaptive:true,questions:HISTORY_QUESTIONS,topics:HISTORY_TOPICS,hints:HISTORY_HINTS,visuals:HISTORY_VISUALS,
 badge:'Portugal no século XVIII',intro:'Liga datas, pessoas, causas e consequências. Treina em sessões curtas e usa os resumos com gatinhos para recordar sem olhar.',
 testDescription:'10 perguntas · 100 pontos · cerca de 40 minutos. Duas por tema, com fontes didáticas, cronologia e raciocínio. Sem pistas; correção só no fim.',testButton:'Fazer teste · ~40 min',
 testMarking:'Cada pergunta vale 10 pontos, repartidos igualmente pelas alíneas. A nota automática avalia as respostas dos campos; as justificações livres no rascunho precisam de revisão acompanhada.',
 sources:'Leitura integral das 10 páginas do PDF: manual 25–27 e 29–35. Brasil, ouro e escravização; legado africano; sociedade e Inquisição; monarquia absoluta; barroco e património; terramoto e reconstrução de Lisboa. A página 28 e o mapa/gráfico referidos na página 25 não foram fornecidos: não se inventam esses dados. As ilustrações com gatinhos são resumos atuais, sem valor de documento histórico. Não se conhece a matriz da professora.'};
export const PORTUGUESE_COURSE={id:'portuguese',subject:'Português',language:'pt-PT',adaptive:true,coherentReadings:true,questions:PORTUGUESE_QUESTIONS,topics:PORTUGUESE_TOPICS,hints:PORTUGUESE_HINTS,writing:PORTUGUESE_WRITING,writingPassage:PT_STORY,visuals:PORTUGUESE_VISUALS,
 badge:'Ler, compreender e escrever',intro:'Lê textos novos, justifica com pistas e aplica a gramática. Usa os cartazes com gatinhos para recordar e depois pratica sem olhar.',testDescription:'20 exercícios: 80 pontos. Narrativa de 120–200 palavras: 20 pontos de revisão acompanhada. Total 100 pontos. Sem pistas; correção no fim.',testButton:'Fazer teste · ~60 min',
 testMarking:'Cada exercício vale 4 pontos, repartidos pelas alíneas. A composição vale 20 pontos e precisa de revisão acompanhada. A nota global só fica completa depois de registar essa revisão.',
 visualMethodTitle:'Estudar Português · 10–15 minutos',visualMethodText:'Observa um cartaz, esconde-o e recorda duas regras com exemplos teus. Faz seis desafios, identifica uma pista no texto e explica um erro. Alterna leitura, gramática e escrita.',
 sources:'21 digitalizações: manual 14–19, 23, 26–35 e 46–49. Leitura de notícia, entrevista, publicidade e roteiro; conto/narrativa; gramática e escrita. Os áudios e vídeos referidos não foram fornecidos: não se avalia a escuta. Textos e roteiros do treino são originais/fictícios, sem reproduzir os textos ou imagens do manual. A matriz da professora não foi fornecida.'};
export const COURSES=[MATHS_COURSE,ENGLISH_COURSE,SCIENCE_COURSE,HISTORY_COURSE,PORTUGUESE_COURSE];
