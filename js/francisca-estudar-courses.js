import {QUESTIONS,TOPICS,TOPIC_HINTS} from './francisca-estudar-data.js';
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
export const COURSES=[MATHS_COURSE,ENGLISH_COURSE,SCIENCE_COURSE];
