// Conteúdo original, alinhado com Digitalizado_20261019-2119.pdf.
// As imagens e o PDF do manual não são publicados com a aplicação.
export const TOPICS = [
  { id: 'powers', title: 'Potências', icon: '2³', pages: 'Livro · pp. 8–9 e 11', lesson: ['Uma potência é uma multiplicação de fatores iguais. Em 4³, a base é 4 e o expoente é 3.', '4³ = 4 × 4 × 4 = 64. Não é 4 × 3!', 'Ao quadrado significa expoente 2. Ao cubo significa expoente 3.'], example: 'O quadrado de 6: 6² = 6 × 6 = 36.' },
  { id: 'expressions', title: 'Expressões numéricas', icon: '( )', pages: 'Livro · pp. 10–11', lesson: ['Começa pelos parênteses. Dentro deles, respeita também a prioridade das operações.', 'Calcula potências; depois multiplicações e divisões, da esquerda para a direita; por fim adições e subtrações, da esquerda para a direita.', 'O dobro de uma soma é 2 × (a + b). Os parênteses mostram o que se duplica.'], example: '3 + 2² × 5 = 3 + 4 × 5 = 3 + 20 = 23.' },
  { id: 'bars', title: 'Ler gráficos de barras', icon: '▥', pages: 'Livro · pp. 102–103', lesson: ['Lê o título, a legenda e a escala dos eixos. Cada intervalo do eixo pode valer mais do que 1.', 'A frequência absoluta é o número de vezes que uma resposta aparece. A moda é a resposta mais frequente.', 'Para comparar grupos de tamanhos diferentes, usa frequências relativas, como percentagens.'], example: 'Se 8 de 20 alunos escolhem dança: 8 ÷ 20 × 100 = 40%.' },
  { id: 'circle', title: 'Gráficos circulares e %', icon: '◔', pages: 'Livro · pp. 104–105', lesson: ['O círculo completo representa todos os dados: 100%. O maior setor representa a categoria mais frequente.', 'Percentagem = número de casos ÷ total × 100. Para descobrir o número de casos: percentagem ÷ 100 × total.', '25% é um quarto. 50% é metade. Para descobrir a parte em falta, subtrai as outras percentagens a 100%.'], example: '25% de 40 alunos = 40 ÷ 4 = 10 alunos.' },
  { id: 'classes', title: 'Classes e frequências', icon: '[a,b[', pages: 'Livro · pp. 107–109', lesson: ['Na classe 10 a < 15 entram os valores desde 10, incluindo 10, até antes de 15. O 15 entra na classe seguinte.', 'Amplitude de uma classe = limite superior − limite inferior. Conta cada valor uma só vez.', 'A classe modal tem a maior frequência. Pode haver mais do que uma. As frequências absolutas somam o total de dados.'], example: 'Para 10 a < 15, a amplitude é 15 − 10 = 5.' },
  { id: 'histogram', title: 'Construir histogramas', icon: '▟', pages: 'Livro · pp. 107–109', lesson: ['Os histogramas representam dados agrupados em intervalos. Nas classes seguidas, as barras ficam encostadas.', 'Nos exercícios, as classes têm a mesma amplitude. A altura de cada barra é a sua frequência.', 'Confirma se o eixo vertical pede contagens ou percentagens. As percentagens devem somar 100%.'], example: 'Em 20 dados, uma classe com 5 valores terá uma barra de altura 25%, pois 5 ÷ 20 × 100 = 25.' }
];

export const QUESTIONS = [];
function add(topic, skill, prompt, fields, steps, extra = {}) {
  const number = QUESTIONS.filter(q => q.topic === topic).length + 1;
  QUESTIONS.push({ id: `${topic}-${number}`, topic, skill, prompt, fields, steps, ...extra });
}
const number = (label, answer, suffix = '') => ({ label, answer, suffix });
const choice = (options, correct = 0) => ({ options, answer: options[correct] });
const table = (headers, rows) => ({ headers, rows });

// Potências: calcular, interpretar e traduzir, sem confundir base e expoente.
for (const [base, exponent] of [[3,4],[4,3],[6,2],[2,5],[5,3],[7,2]]) {
  const expanded = Array(exponent).fill(base).join(' × ');
  add('powers', 'value', `Calcula ${base}${sup(exponent)}.`, [number('Valor da potência', base ** exponent)], [`A base é ${base}. O expoente ${exponent} diz quantas vezes multiplicas esse número por ele próprio.`, `${base}${sup(exponent)} = ${expanded} = ${base ** exponent}.`, `Multiplicar a base pelo expoente daria ${base * exponent}; isso não representa esta potência.`]);
}
for (const [base, exponent] of [[7,4],[3,5]]) add('powers', 'parts', `Identifica a base e o expoente de ${base}${sup(exponent)}.`, [number('Base',base),number('Expoente',exponent)], [`A base é o número que se repete na multiplicação: ${base}.`,`O número pequeno, ${exponent}, é o expoente. Indica ${exponent} fatores iguais a ${base}.`]);
add('powers','language','Qual expressão significa «o cubo de cinco»?', [choice(['5³','3⁵','5 × 3','5 + 3'])], ['Cubo significa expoente 3.','O cubo de cinco é 5³ = 5 × 5 × 5 = 125. A base continua a ser cinco.']);
add('powers','language','Qual expressão significa «quatro elevado a cinco»?', [choice(['4⁵','5⁴','4 × 5','4 + 5'])], ['Primeiro dizemos a base: quatro. Depois o expoente: cinco.','Escrevemos 4⁵, isto é, cinco fatores iguais a 4.']);
add('powers','context','Uma sala tem 8 filas com 8 cadeiras por fila. Escreve o total como potência de base 8 e calcula.', [number('Expoente da potência de base 8',2),number('Número de cadeiras',64)], ['Há 8 grupos de 8 cadeiras: 8 × 8.','Como são dois fatores iguais a 8, escrevemos 8² = 64 cadeiras.']);
add('powers','context','Compraram-se 9 caixas com 9 copos cada. Cada mesa leva 3 copos. Quantas mesas completas se podem preparar?', [number('Mesas completas',27)], ['Primeiro conta os copos: 9² = 9 × 9 = 81.','Agora divide os copos por 3: 81 ÷ 3 = 27 mesas.']);

// Expressões com explicações que seguem a ordem de cálculo.
const expressions = [
  ['4 + 3² × 2',22,['3² = 9.','Multiplica antes de somar: 9 × 2 = 18.','4 + 18 = 22.']],
  ['(7 − 3)² + 6',22,['Primeiro os parênteses: 7 − 3 = 4.','Depois a potência: 4² = 16.','16 + 6 = 22.']],
  ['30 − 2³ × 3',6,['A potência primeiro: 2³ = 8.','Depois multiplica: 8 × 3 = 24.','30 − 24 = 6.']],
  ['36 ÷ (2² + 5)',4,['Dentro dos parênteses: 2² = 4 e 4 + 5 = 9.','Fica 36 ÷ 9 = 4.']],
  ['18 ÷ 3 × 2',12,['A divisão e a multiplicação têm a mesma prioridade. Avança da esquerda para a direita.','18 ÷ 3 = 6. Depois 6 × 2 = 12. Não multipliques 3 × 2 primeiro.']],
  ['20 − 6 + 2',16,['A subtração e a adição têm a mesma prioridade. Avança da esquerda para a direita.','20 − 6 = 14. Depois 14 + 2 = 16.']],
  ['2 × (3 + 4²)',38,['Nos parênteses, calcula a potência: 4² = 16.','Soma: 3 + 16 = 19.','Duplica toda a soma: 2 × 19 = 38.']],
  ['5² − 3² + 2',18,['Calcula as potências: 5² = 25 e 3² = 9.','Da esquerda para a direita: 25 − 9 = 16. Depois 16 + 2 = 18.']],
  ['(6 − 4)³ + 12 ÷ 4',11,['Parênteses: 6 − 4 = 2. Potência: 2³ = 8.','Divisão: 12 ÷ 4 = 3.','Por fim: 8 + 3 = 11.']],
  ['4² ÷ (7 − 3) × 2',8,['Parênteses: 7 − 3 = 4. Potência: 4² = 16.','Divisão e multiplicação, da esquerda para a direita: 16 ÷ 4 = 4; 4 × 2 = 8.']]
];
expressions.forEach(([expr,result,steps],i) => add('expressions', i === 4 || i === 5 ? 'order' : 'calculate', `Calcula: ${expr}.`, [number('Resultado',result)], steps));
add('expressions','language','Escolhe a expressão que traduz «o dobro da soma de três com o quadrado de cinco».', [choice(['2 × (3 + 5²)','2 × 3 + 5²','(2 × 3 + 5)²','2 + 3 × 5²'])], ['A soma de três com o quadrado de cinco é 3 + 5².','O dobro dessa soma é 2 × (3 + 5²). Os parênteses fazem com que dupliques a soma inteira.']);
add('expressions','context','Um retângulo mede (3² + 2) cm de comprimento e (2³ − 3) cm de largura. Calcula o perímetro.', [number('Perímetro',32,'cm')], ['Comprimento: 3² + 2 = 9 + 2 = 11 cm.','Largura: 2³ − 3 = 8 − 3 = 5 cm.','O perímetro é a volta toda: 2 × (11 + 5) = 32 cm.']);

// Leitura de barras com escalas explícitas e comparação de dois grupos.
for (const [labels,values,ask] of [
  [['Futebol','Dança','Natação','Judo'],[12,8,6,4],0],
  [['Gato','Cão','Peixe','Coelho'],[6,10,4,8],3],
  [['Maçã','Pera','Banana','Morango'],[8,4,12,6],2]
]) {
  const chart={type:'bar',title:'Preferências de uma turma',labels,values,unit:'Alunos',step:2};
  add('bars','read',`Observa o gráfico. Quantos alunos escolheram «${labels[ask]}»?`,[number('Número de alunos',values[ask])],['Procura a categoria no eixo horizontal.','Segue a barra até à escala vertical. Cada intervalo vale 2 alunos.',`A barra chega a ${values[ask]}: são ${values[ask]} alunos.`],{chart});
  const max=Math.max(...values); const mode=labels[values.indexOf(max)];
  add('bars','mode','Qual é a moda das preferências desta turma?',[choice([mode,...labels.filter(v=>v!==mode)])],['A moda é a categoria com maior frequência, ou seja, a barra mais alta.',`A barra mais alta é «${mode}», com ${max} alunos. A moda é a categoria, não o número ${max}.`],{chart});
}
add('bars','compare','Na turma A, 8 de 20 alunos escolhem dança. Na turma B, 9 de 30 escolhem dança. Em que turma é maior a percentagem que escolhe dança?', [choice(['Turma A','Turma B','É igual','Não se pode comparar'])],['As turmas têm tamanhos diferentes. Compara percentagens.','Turma A: 8 ÷ 20 × 100 = 40%. Turma B: 9 ÷ 30 × 100 = 30%.','40% é maior do que 30%. A resposta é a turma A.']);
add('bars','points','Num jogo, os Azuis marcaram 10 lances livres, 4 triplos e 8 lançamentos de 2 pontos. Os Verdes marcaram 8 lances livres, 5 triplos e 6 lançamentos de 2 pontos. Calcula a pontuação de cada equipa.',[number('Pontos dos Azuis',38),number('Pontos dos Verdes',35)],['Um lance livre vale 1, um triplo vale 3 e os outros lançamentos valem 2.','Azuis: 10 × 1 + 4 × 3 + 8 × 2 = 10 + 12 + 16 = 38.','Verdes: 8 × 1 + 5 × 3 + 6 × 2 = 8 + 15 + 12 = 35.'],{table:table(['Lançamento','Azuis','Verdes'],[['Livre (1 ponto)',10,8],['Triplo (3 pontos)',4,5],['2 pontos',8,6]])});

// Gráficos circulares: valores exatos, sem depender de medir setores à vista.
const fruitChart={type:'pie',title:'Fruto preferido · 40 alunos',labels:['Maçã','Banana','Pera','Morango'],values:[25,15,20,40],unit:'%'};
add('circle','read','No gráfico, qual é o fruto mais escolhido?', [choice(['Morango','Maçã','Banana','Pera'])],['O maior setor corresponde à maior percentagem.','Morango tem 40%, a maior percentagem. É o fruto mais escolhido.'],{chart:fruitChart});
add('circle','count','Quantos dos 40 alunos preferem maçã?', [number('Alunos',10)],['O setor da maçã representa 25%.','25% é um quarto: 40 ÷ 4 = 10 alunos.'],{chart:fruitChart});
add('circle','count','Quantos dos 40 alunos preferem morango?', [number('Alunos',16)],['Morango representa 40% de 40 alunos.','40 ÷ 100 × 40 = 16 alunos.'],{chart:fruitChart});
add('circle','percent','Numa turma de 25 alunos, 7 preferem pera. Qual é a frequência relativa, em percentagem?', [number('Percentagem',28,'%')],['Divide a parte pelo total: 7 ÷ 25 = 0,28.','Multiplica por 100: 0,28 × 100 = 28%.']);
add('circle','percent','Numa turma de 30 alunos, 12 vão a pé para a escola. Que percentagem representam?', [number('Percentagem',40,'%')],['Frequência relativa = parte ÷ total × 100.','12 ÷ 30 × 100 = 40%.']);
add('circle','missing','Um gráfico circular tem três categorias: 35%, 25% e uma percentagem em falta. Qual é a percentagem em falta?', [number('Percentagem em falta',40,'%')],['O círculo todo representa 100%.','35 + 25 = 60. Falta 100 − 60 = 40%.']);
add('circle','total','20% dos alunos de uma escola são 18 alunos. Quantos alunos tem a escola?', [number('Total de alunos',90)],['20% é um quinto do total.','Se um quinto são 18 alunos, o total é 5 × 18 = 90 alunos.']);
add('circle','compare','A escola A tem 100 alunos e 30% vão a pé. A escola B tem 80 alunos e 35% vão a pé. Em qual há mais alunos a ir a pé?', [choice(['Escola A','Escola B','O número é igual','É impossível saber'])],['Aqui queremos o número de alunos, não apenas a maior percentagem.','Escola A: 30 ÷ 100 × 100 = 30 alunos. Escola B: 35 ÷ 100 × 80 = 28 alunos.','30 é maior do que 28: escola A.']);

// Classes: limites inclusivos/exclusivos e tabelas a completar.
const leaves=[4,6,9,12,15,17,18,21,23,24,27,29,31,33,36,38,39,41,44,46];
for(const [low,high,ans] of [[0,10,3],[10,20,4],[20,30,5],[30,40,5]]) {
  const inside=leaves.filter(x=>x>=low&&x<high);
  add('classes','count',`Os números são as folhas recolhidas por 20 alunos: ${leaves.join(', ')}. Quantos valores pertencem à classe ${low} a < ${high}?`,[number('Frequência absoluta',ans)],[`Inclui ${low} e os valores maiores, mas para antes de ${high}.`,`Nesta classe entram: ${inside.join(', ')}.`,`Conta-os: ${ans} valores.`]);
}
add('classes','boundary','As classes são 120 a < 130, 130 a < 140 e 140 a < 150. Em que classe fica uma altura de exatamente 140 cm?', [choice(['140 a < 150','130 a < 140','120 a < 130','Nas duas últimas'])],['O sinal < significa «menor do que». A classe 130 a < 140 não inclui 140.','O 140 entra no início da classe seguinte: 140 a < 150. Nunca se conta nas duas.']);
add('classes','amplitude','Uma classe de alturas vai de 135 cm até antes de 142 cm. Qual é a sua amplitude?', [number('Amplitude',7,'cm')],['A amplitude é a diferença entre o limite superior e o inferior.','142 − 135 = 7 cm. Não somes mais 1.']);
add('classes','mode','Identifica a classe modal nesta tabela de alturas.', [choice(['140 a < 150','130 a < 140','150 a < 160','Não existe'])],['Procura a maior frequência absoluta na tabela: é 11.','A classe correspondente é 140 a < 150. É o intervalo de alturas com mais alunos.'],{table:table(['Altura (cm)','Alunos'],[['130 a < 140',5],['140 a < 150',11],['150 a < 160',8]])});
add('classes','percent','Uma tabela de alturas tem frequências absolutas 12, 20 e 18. Completa as frequências relativas das três classes.', [number('1.ª classe',24,'%'),number('2.ª classe',40,'%'),number('3.ª classe',36,'%')],['O total é 12 + 20 + 18 = 50 atletas.','1.ª classe: 12 ÷ 50 × 100 = 24%.','2.ª: 20 ÷ 50 × 100 = 40%. 3.ª: 18 ÷ 50 × 100 = 36%.','Confirma: 24 + 40 + 36 = 100%.'],{table:table(['Altura (cm)','Atletas'],[['135 a < 142',12],['142 a < 149',20],['149 a < 156',18]])});
add('classes','amplitude','Para agrupar os mesmos dados, usamos classes de maior amplitude. O que tende a acontecer ao número de classes necessárias?', [choice(['Diminui','Aumenta','Duplica sempre','Não se pode agrupar'])],['Uma classe mais larga consegue receber mais valores.','Para cobrir o mesmo conjunto de valores, precisas de menos classes.']);
add('classes','outlier','As estimativas do comprimento de uma ponte foram 480, 510, 550, 490, 520 e 5000 metros. Qual registo deves verificar primeiro por ser muito diferente dos outros?', [number('Estimativa a verificar',5000,'m')],['Compara os valores: quase todos estão perto de 500 metros.','5000 é cerca de dez vezes maior. Deve ser verificado primeiro. Um valor diferente não é automaticamente um erro: é preciso confirmar.']);

// Histograma: a aluna constrói as alturas das barras por teclado.
for(const [values,limits] of [ [[2,3,5,7,8,9,11,12,14,15],[0,5,10,15,20]], [[10,11,12,15,17,19,20,21,23,24],[10,15,20,25]] ]) {
  const counts=limits.slice(0,-1).map((v,i)=>values.filter(x=>x>=v&&x<limits[i+1]).length);
  const labels=limits.slice(0,-1).map((v,i)=>`${v} a < ${limits[i+1]}`);
  add('histogram','build',`Constrói o histograma das contagens. Dados: ${values.join(', ')}. Escreve a altura de cada barra.`,counts.map((v,i)=>number(labels[i],v)),['Começa por separar os valores pelas classes. O limite final não entra na classe.',...counts.map((v,i)=>`${labels[i]}: ${values.filter(x=>x>=limits[i]&&x<limits[i+1]).join(', ')} → ${v} valores.`),'As barras ficam encostadas porque representam intervalos seguidos.'],{build:{labels,unit:'Contagem',max:6}});
  add('histogram','relative',`Representa estes 10 dados num histograma de percentagens: ${values.join(', ')}. Completa a altura de cada barra.`,counts.map((v,i)=>number(labels[i],v*10,'%')),['Há 10 dados. Cada valor corresponde a 1 ÷ 10 × 100 = 10%.',...counts.map((v,i)=>`${labels[i]}: ${v} valores → ${v} ÷ 10 × 100 = ${v*10}%.`),'Confirma que as alturas somam 100%.'],{build:{labels,unit:'%',max:100}});
}
const histChart={type:'histogram',title:'Alturas de 20 plantas',labels:['0 a < 10','10 a < 20','20 a < 30','30 a < 40'],values:[3,7,6,4],unit:'Plantas',step:1};
add('histogram','read','Qual é a frequência absoluta da classe 10 a < 20 cm?', [number('Número de plantas',7)],['Localiza o intervalo 10 a < 20 no eixo horizontal.','A barra chega a 7 no eixo vertical: são 7 plantas.'],{chart:histChart});
add('histogram','mode','Qual é a classe modal das alturas das plantas?', [choice(['10 a < 20','0 a < 10','20 a < 30','30 a < 40'])],['A classe modal tem a barra mais alta.','A barra mais alta corresponde a 10 a < 20 cm, com 7 plantas.'],{chart:histChart});
add('histogram','cumulative','Que percentagem das 20 plantas mede menos de 20 cm?', [number('Percentagem',50,'%')],['Menos de 20 cm inclui as duas primeiras classes.','São 3 + 7 = 10 plantas num total de 20.','10 ÷ 20 × 100 = 50%. O valor 20 não está incluído.'],{chart:histChart});
add('histogram','cumulative','Quantas das 20 plantas medem pelo menos 20 cm?', [number('Número de plantas',10)],['Pelo menos 20 significa 20 ou mais.','Soma as duas últimas classes: 6 + 4 = 10 plantas.'],{chart:histChart});
add('histogram','concept','Qual é a representação mais adequada para alturas agrupadas em intervalos seguidos de igual amplitude?', [choice(['Histograma com barras encostadas','Gráfico de barras com espaços entre categorias','Uma lista sem escala','Um círculo sem legenda'])],['As alturas são medidas que podem ser agrupadas em intervalos.','O histograma usa barras encostadas para intervalos seguidos. Precisa de título, eixos identificados e escala.']);

function sup(n) { return String(n).replace(/\d/g,d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]); }

// Questões de aplicação, semelhantes às tarefas que pedem o resultado em potência.
add('expressions','power-result','Calcula 3² + (5 − 2)² + 7. Escreve também o resultado como potência de base 5.',[number('Resultado numérico',25),number('Expoente da potência de base 5',2)],['Parênteses: 5 − 2 = 3.','Potências: 3² = 9. Fica 9 + 9 + 7 = 25.','25 = 5 × 5 = 5². O expoente é 2.']);
add('expressions','power-result','Calcula 18 − 2³ − 1. Escreve também o resultado como potência de base 3.',[number('Resultado numérico',9),number('Expoente da potência de base 3',2)],['Calcula a potência: 2³ = 8.','Subtrai da esquerda para a direita: 18 − 8 − 1 = 10 − 1 = 9.','9 = 3 × 3 = 3². O expoente é 2.']);
add('expressions','power-result','Calcula 2² × (3² − 5). Escreve também o resultado como potência de base 2.',[number('Resultado numérico',16),number('Expoente da potência de base 2',4)],['Dentro dos parênteses: 3² − 5 = 9 − 5 = 4.','A outra potência é 2² = 4. Multiplica: 4 × 4 = 16.','16 = 2 × 2 × 2 × 2 = 2⁴. O expoente é 4.']);
const clubsChart={type:'grouped',title:'Clube preferido · turmas de tamanhos diferentes',labels:['Teatro','Música','Desporto'],values:[20,30,50],second:[30,40,30],series:['Turma A','Turma B'],unit:'%',step:10};
add('bars','grouped','No gráfico de barras justapostas, qual é a percentagem de alunos da turma B que prefere Música?',[number('Percentagem',40,'%')],['Lê a legenda: as barras da turma B são as da segunda cor.','Na categoria Música, a barra da turma B chega a 40%.'],{chart:clubsChart});
add('bars','grouped','O gráfico usa percentagens. A turma A tem 20 alunos e a turma B tem 30 alunos. Quantos alunos de cada turma preferem Desporto?',[number('Alunos da turma A',10),number('Alunos da turma B',9)],['Lê Desporto no gráfico: 50% na turma A e 30% na turma B.','Turma A: 50 ÷ 100 × 20 = 10 alunos.','Turma B: 30 ÷ 100 × 30 = 9 alunos. Compara os números depois de teres em conta os totais diferentes.'],{chart:clubsChart});
add('classes','multimode','As classes têm estas frequências: 0 a < 5 → 6; 5 a < 10 → 8; 10 a < 15 → 8; 15 a < 20 → 3. Quais são as classes modais?',[choice(['5 a < 10 e 10 a < 15','Apenas 5 a < 10','Apenas 10 a < 15','0 a < 5 e 15 a < 20'])],['A maior frequência é 8.','Duas classes têm essa frequência: 5 a < 10 e 10 a < 15. Por isso, há duas classes modais.']);
