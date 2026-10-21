// Exercícios originais. Fontes: ingleslivro.pdf (20 imagens) e
// inglesworlbook.pdf (13 imagens). Não publicar páginas/imagens dos manuais.
export const ENGLISH_TOPICS = [
  {id:'en-personal',title:'Personal information',icon:'Hi!',pages:'Livro 10, 13 · WB 3–4',lesson:[
    'Name é o nome; surname é o apelido. Country é o país; nationality é a nacionalidade. I am from Portugal. I am Portuguese.',
    'Who = quem; what = o quê/qual; where = onde; when = quando; why = porquê; which = qual de opções indicadas. Whose pergunta de quem é algo.',
    'Usa in com o mês e on com uma data: in May; on 2nd May. Dias ordinais: 1st, 2nd, 3rd, 4th… mas 11th, 12th e 13th.',
    'Países, nacionalidades, meses e o pronome I começam com maiúscula em inglês.'],example:'Where are you from? I am from Ireland. What nationality are you? I am Irish.'},
  {id:'en-be',title:'To be & personal pronouns',icon:'am',pages:'Livro 11–12',lesson:[
    'I am; he/she/it is; you/we/they are. Para dizer a idade: I am eleven, não I have eleven.',
    'Negativa: am not, is not/isn’t, are not/aren’t. Pergunta: põe am/is/are antes do sujeito: Is she happy?',
    'Resposta curta: Yes, she is. / No, she isn’t. Com to be não acrescentes do ou does.',
    'He substitui um rapaz/homem; she, uma rapariga/mulher; it, uma coisa ou animal quando não indicamos o sexo; they, várias pessoas/coisas.'],example:'Leo and I are friends. We are friends. Are you ready? Yes, I am.'},
  {id:'en-people',title:'Family, appearance & jobs',icon:'Aa',pages:'Livro 16–18, 20–25 · WB 3, 6, 8',lesson:[
    'Família: parents = pais; grandparents = avós; brother/sister = irmão/irmã; son/daughter = filho/filha; uncle/aunt = tio/tia; cousin = primo/prima; husband/wife = marido/mulher.',
    'Aspeto: tall/short = alto/baixo; thin = magro; straight/curly/wavy hair = cabelo liso/encaracolado/ondulado. She is tall. She has got brown eyes. She wears glasses.',
    'Personalidade: friendly = simpático; funny = divertido; hard-working = trabalhador; lazy = preguiçoso; polite/rude = educado/mal-educado; calm/noisy/quiet = calmo/barulhento/sossegado; serious = sério; active = ativo; shy = tímido.',
    'Profissões: doctor, nurse, teacher, vet, pilot, astronaut, mechanic, chef, firefighter, police officer, musician, actress, hairdresser, baker, photographer. Usa a/an: a teacher; an astronaut.'],example:'My aunt is a vet. She is friendly. She has got short curly hair.'},
  {id:'en-have',title:'Have got',icon:'got',pages:'Livro 19 · WB 7',lesson:[
    'I/you/we/they have got. He/she/it has got. Usa para ter algo ou descrever cabelo e olhos.',
    'Negativa: haven’t got / hasn’t got. She hasn’t got a pet.',
    'Pergunta: Have/Has + sujeito + got…? Has he got a bike?',
    'Respostas curtas: Yes, he has. / No, he hasn’t. Não ponhas got no fim da resposta curta.'],example:'They have got a dog. Have they got a cat? No, they haven’t.'},
  {id:'en-possessives',title:'Whose? Possessives',icon:'’s',pages:'Livro 12, 22–23 · WB 9, 15',lesson:[
    'Antes de um nome: my, your, his, her, its, our, their. This is her bag.',
    'Sem repetir o nome: mine, yours, his, hers, ours, theirs. This bag is hers. Estes pronomes não levam apóstrofo.',
    'Uma pessoa: Nina’s bag. Plural acabado em s: the girls’ bags. Plural irregular: the children’s books.',
    'Whose bag is this? pergunta de quem é a mala. Who’s significa who is ou who has, não significa whose.',
    'Nos exercícios do manual usa-se of em exemplos como the door of the classroom. Não confundas its (posse) com it’s (it is/it has).'],example:'It is our dog. The dog is ours. It is the children’s dog.'},
  {id:'en-routine',title:'Daily routine & starter words',icon:'day',pages:'Livro 26, 28 · WB 5, 10, 14–15',lesson:[
    'get up = levantar-se; have a shower = tomar duche; get dressed = vestir-se; have breakfast/lunch/dinner = tomar o pequeno-almoço/almoçar/jantar.',
    'brush my teeth = lavar os dentes; go to school = ir para a escola; start classes = começar as aulas; do my homework = fazer os TPC; watch TV; go to bed.',
    'Quarto: bedroom; cozinha: kitchen; sala: living room; casa de banho: bathroom. Objetos úteis: bed, wardrobe, table, chair, fridge, sink, mirror, bookcase.',
    'Alimentos do starter: bread, milk, water, juice, rice, fish, chicken, cheese, yoghurt, ice cream; fruta/legumes: pear, carrot, tomato, lettuce, broccoli.'],example:'I get up at seven. I have breakfast in the kitchen. Then I brush my teeth.'},
  {id:'en-time',title:'Telling the time',icon:'◷',pages:'Livro 27 · WB 11',lesson:[
    'À hora certa: seven o’clock. 15 minutos depois: quarter past seven. 30 minutos depois: half past seven.',
    'Past refere os minutos depois da hora. To refere os minutos que faltam para a PRÓXIMA hora: 7:50 = ten to eight.',
    'Quarter são 15 minutos. 7:45 = quarter to eight, não quarter past eight.',
    'Para dizer a que horas fazes algo, usa at: I get up at half past seven.'],example:'08:20 = twenty past eight. 08:40 = twenty to nine.'},
  {id:'en-present',title:'Present simple & frequency',icon:'-s',pages:'Livro 29–30 · WB 12–13, 15',lesson:[
    'Para rotinas: I/you/we/they play; he/she/it plays. Em geral acrescenta s na afirmativa da 3.ª pessoa.',
    'go → goes; do → does; watch → watches; brush → brushes. Consoante + y: study → studies. Vogal + y: play → plays. Have → has.',
    'Negativa: don’t + verbo com I/you/we/they; doesn’t + verbo com he/she/it. She doesn’t play, nunca doesn’t plays.',
    'Pergunta: Do/Does + sujeito + verbo? Does she study? Yes, she does. / No, she doesn’t. O verbo principal fica sem s depois de does.',
    'Frequência: always = sempre; usually = habitualmente; often = frequentemente; sometimes = às vezes; never = nunca. Não atribuas percentagens fixas a usually, often ou sometimes.',
    'A posição habitual é antes do verbo principal (I often read) e depois de to be (She is never late). Never já é negativo: não juntes don’t.'],example:'He usually studies after lunch. Does he study at night? No, he doesn’t.'},
  {id:'en-reading',title:'Reading & writing method',icon:'Read',pages:'Livro 10, 18, 24, 28 · WB 14–15',lesson:[
    'Lê primeiro o título e o texto todo. Depois procura a informação pedida: pessoa, idade, lugar, hora ou motivo.',
    'Em True/False, confirma no texto. Se for falso, escreve a informação correta; não adivinhes pela tua vida.',
    'Nas respostas curtas, escolhe o verbo certo: Is she…? → Yes, she is. Has she got…? → Yes, she has. Does she…? → Yes, she does.',
    'Para escrever a rotina: planeia manhã/tarde/noite. Usa I + verbo, horários com at e conectores como then e after school. Revê maiúsculas, apóstrofos e 3.ª pessoa.'],example:'First read. Then find evidence. Answer. Finally check your verbs and spelling.'}
];

export const ENGLISH_HINTS = Object.fromEntries(ENGLISH_TOPICS.map(t=>[t.id,{
  'en-personal':'A resposta pede uma pessoa, um lugar, uma data ou um motivo? Nas datas, distingue o mês (in) do dia exato (on).',
  'en-be':'Substitui o sujeito por I, he/she/it ou you/we/they. Escolhe am, is ou are. Numa pergunta, o verbo passa para a frente.',
  'en-people':'Lê a descrição com atenção: fala de parentesco, profissão, aspeto ou personalidade? Não confundas is com has got.',
  'en-have':'Há uma pessoa (he/she/it) ou várias (we/they)? Decide entre has e have. Depois vê se a frase é afirmativa, negativa ou uma pergunta.',
  'en-possessives':'Pergunta: de quem é? Se vem um nome a seguir, precisas de my/her/their…; se o nome já foi dito, pensa em mine/hers/theirs…',
  'en-routine':'Imagina as ações na ordem do teu dia e lê a frase inteira. Procura pistas como breakfast, school, evening e bed.',
  'en-time':'Olha para os minutos: até à meia hora usa past; depois conta o que falta para a próxima hora e usa to.',
  'en-present':'Identifica o sujeito e o tipo de frase. Depois de does/doesn’t, o verbo principal fica na forma base. O advérbio costuma vir antes do verbo principal e depois de to be.',
  'en-reading':'Volta ao texto e encontra a frase que prova a resposta. Não uses uma informação que o texto não dá.'
}[t.id]]));

export const ENGLISH_QUESTIONS=[];
const text=(label,answer,accept=[],extra={})=>({type:'text',label,answer,accept,...extra});
const choice=(label,options)=>({label,options,answer:options[0]});
const order=(answer,accept=[])=>({type:'order',label:'Build the sentence',answer,accept,words:answer.replace(/[.?!]$/,'').split(' ')});
function add(topic,skill,prompt,fields,steps,extra={}) {
  const id=`${topic}-${ENGLISH_QUESTIONS.filter(q=>q.topic===topic).length+1}`;
  ENGLISH_QUESTIONS.push({id,topic,skill,prompt,fields,steps,...extra});
}

// Informação pessoal: frases novas, sem factos biográficos de figuras públicas.
for(const [country,nationality] of [['Portugal','Portuguese'],['Ireland','Irish'],['Spain','Spanish'],['France','French'],['Scotland','Scottish'],['Brazil','Brazilian'],['China','Chinese'],['Greece','Greek'],['Australia','Australian'],['Angola','Angolan'],['the USA','American'],['the UK','British']])
  add('en-personal','nationality',`Complete: I am from ${country}. I am ____.`,[text('Nationality',nationality,[],{caseSensitive:true})],[`${country} é o país. A nacionalidade é ${nationality}.`,'As nacionalidades começam com maiúscula em inglês.']);
for(const [sentence,word,why] of [
  ['____ is your birthday? — It is on 3rd April.','When','Perguntamos quando: a resposta é uma data.'],
  ['____ are you from? — I am from Dublin.','Where','Perguntamos de onde: a resposta é um lugar.'],
  ['____ is your best friend? — It is Mia.','Who','Perguntamos quem: a resposta identifica uma pessoa.'],
  ['____ are you happy? — Because it is my birthday.','Why','Because introduz um motivo; a pergunta é porquê.'],
  ['____ bag do you prefer: the blue one or the red one?','Which','Escolhemos entre duas opções identificadas.'],
  ['____ is your favourite food? — Rice.','What','Perguntamos qual é a comida favorita.']
])add('en-personal','question-word',`${word==='Which'?'Complete with Which or Who':'Write the question word'}: ${sentence}`,[text('Question word',word)],[why,`A palavra é ${word}.`]);
add('en-personal','date','Complete: My birthday is ____ November. It is ____ 21st November.',[text('Before the month','in'),text('Before the full date','on')],['Usa in antes de um mês: in November.','Usa on antes de uma data: on 21st November.']);
add('en-personal','ordinal','Write the ordinal numbers in words: 2nd; 12th; 25th.',[text('2nd','second'),text('12th','twelfth'),text('25th','twenty-fifth',['twenty fifth'])],['2nd = second; 12th = twelfth. Atenção à escrita de twelfth.','25th = twenty-fifth. O ordinal está na última parte.']);

for(const [subject,answer] of [['I','am'],['My brother','is'],['Our teachers','are'],['My sister and I','are'],['You','are'],['The dog','is']])
  add('en-be','affirmative',`Complete with am, is or are: ${subject} ____ happy.`,[text('Verb',answer)],[`“${subject}” usa ${answer}.`,'I am; he/she/it is; you/we/they are.']);
add('en-be','negative','Make this sentence negative: She is late.',[text('Negative sentence','She is not late.',["She isn't late.","She's not late."])],['Põe not depois de is.','She is not late. A forma curta é She isn’t late.']);
add('en-be','short-answer','Answer with a negative short answer: Are the children at home? (No)',[text('Short answer',"No, they aren't.",['No, they are not.'])],['The children é plural: usa they.','A pergunta tem are; a resposta negativa é No, they aren’t.']);
add('en-be','question','Put the words in order to make a question.',[order('Is your sister a student?')],['Numa pergunta com to be, is fica antes do sujeito.','Is + your sister + a student?']);
add('en-be','pronoun','Replace the underlined idea with a pronoun: “Nora and Ben” are my friends. ____ are kind.',[text('Pronoun','They')],['Nora e Ben são duas pessoas.','Para várias pessoas usa they.']);
add('en-be','pronoun','Complete with personal pronouns: This is Eva. ____ is twelve. This is her bike. ____ is blue.',[text('Eva','She'),text('The bike','It')],['Eva é uma rapariga: she.','A bicicleta é uma coisa: it.']);
add('en-be','spot-error','Detective: choose the correct sentence about someone’s age.',[choice('Sentence',['I am twelve years old.','I have twelve years old.','I is twelve years old.','I has twelve years old.'])],['Em inglês dizemos a idade com to be.','I am twelve years old. Em português dizemos “tenho doze anos”, mas não traduzimos palavra por palavra.']);

for(const [clue,answer,accept] of [
  ['My mum’s sister is my ____.','aunt',[]],['My aunt’s son is my ____.','cousin',[]],['My father’s father is my ____.','grandfather',['grandad','granddad']],['My sister is my parents’ ____.','daughter',[]],['My mother and father are my ____.','parents',[]],['My dad’s brother is my ____.','uncle',[]],['My mum’s mother is my ____.','grandmother',['grandma']],['My parents’ son, who is not me, is my ____.','brother',[]]
])add('en-people','family',`Write the family word: ${clue}`,[text('Family word',answer,accept)],[{aunt:'A irmã da mãe é a tia: aunt.',cousin:'O filho da tia é o primo: cousin.',grandfather:'O pai do pai é o avô: grandfather ou grandad.',daughter:'Uma filha dos pais é daughter.',parents:'A mãe e o pai são os pais: parents.',uncle:'O irmão do pai é o tio: uncle.',grandmother:'A mãe da mãe é a avó: grandmother ou grandma.',brother:'Outro filho dos mesmos pais é um irmão: brother.'}[answer],'Lê a frase começando pela pessoa que fala e segue os parentes indicados.']);
for(const [clue,answer,accept] of [
  ['Someone who flies planes.','pilot',[]],['Someone who repairs cars.','mechanic',[]],['Someone who treats sick animals.','vet',['veterinarian']],['Someone who puts out fires.','firefighter',['fire fighter']],['Someone who cuts and styles hair.','hairdresser',[]],['Someone who takes photographs.','photographer',[]],['Someone who teaches pupils.','teacher',[]],['Someone who makes bread in a bakery.','baker',[]],['Someone who cooks food professionally.','chef',['cook']]
])add('en-people','job',`Name the job: ${clue}`,[text('Job',answer,accept)],[{pilot:'Quem pilota aviões é pilot: piloto.',mechanic:'Quem repara carros é mechanic: mecânico.',vet:'Quem trata animais doentes é vet: veterinário.',firefighter:'Quem apaga incêndios é firefighter: bombeiro.',hairdresser:'Quem corta e arranja cabelo é hairdresser: cabeleireiro.',photographer:'Quem tira fotografias é photographer: fotógrafo.',teacher:'Quem ensina alunos é teacher: professor.',baker:'Quem faz pão numa padaria é baker: padeiro.',chef:'Quem cozinha profissionalmente é chef ou cook.'}[answer],'Relaciona a ação descrita com a profissão; depois confirma a escrita da palavra.']);
for(const [clue,answer,options,why] of [
  ['Lily always says “please” and “thank you”. She is ____.','polite',['rude','lazy','noisy'],'Polite significa educada. Rude é o contrário.'],
  ['Sam does not like working. He is ____.','lazy',['hard-working','active','polite'],'Lazy significa preguiçoso; hard-working é trabalhador.'],
  ['Ava enjoys meeting people and is kind to new pupils. She is ____.','friendly',['rude','lazy','noisy'],'Friendly descreve alguém simpático e acolhedor.'],
  ['Leo makes his friends laugh. He is ____.','funny',['serious','quiet','rude'],'Funny significa divertido; serious é sério.']
])add('en-people','personality',clue,[choice('Adjective',[answer,...options])],[why,`A resposta é ${answer}.`]);
add('en-people','appearance','Complete with is or has got: My cousin ____ tall. She ____ long curly hair.',[text('Height','is'),text('Hair','has got',["'s got"])],['Altura usa to be: she is tall.','Cabelo usa have got: she has got long curly hair.']);
add('en-people','appearance','Choose the description that means “cabelo curto e liso”.',[choice('Description',['short straight hair','long curly hair','short wavy hair','long straight hair'])],['Short = curto; straight = liso.','A expressão é short straight hair.']);
for(const [clue,answer,accept,meaning] of [
  ['She always works hard and does her best. She is ____.','hard-working',['hard working'],'trabalhadora'],
  ['He makes a lot of loud sounds. He is ____.','noisy',[],'barulhento'],
  ['She does not talk much and makes little noise. She is ____.','quiet',[],'sossegada'],
  ['He is relaxed and does not get worried easily. He is ____.','calm',[],'calmo'],
  ['She feels nervous when meeting new people and finds it difficult to speak. She is ____.','shy',[],'tímida'],
  ['He does not joke much and takes things seriously. He is ____.','serious',[],'sério']
])add('en-people','personality',`Write the personality adjective: ${clue}`,[text('Adjective',answer,accept)],[`${answer} significa ${meaning}.`,'Usa as ações e o comportamento descritos como pistas.']);

for(const [subject,form] of [['I','have got'],['She','has got'],['My cousins','have got'],['Tom','has got'],['We','have got']])
  add('en-have','affirmative',`Complete with have got or has got: ${subject} ____ a new bike.`,[text('Verb',form)],[`${subject} usa ${form}.`,'He/she/it has got; I/you/we/they have got.']);
add('en-have','negative','Make this sentence negative: He has got a dog.',[text('Negative sentence',"He hasn't got a dog.",['He has not got a dog.'])],['He usa has. Na negativa, põe not depois de has.','He hasn’t got a dog.']);
add('en-have','negative','Complete the negative sentence using have got: We ____ a cat.',[text('Verb',"haven't got",['have not got'])],['We usa have; a negativa é have not got.','We haven’t got a cat.']);
add('en-have','question','Complete: ____ your sister ____ a pet?', [text('First gap','Has'),text('Second gap','got')],['Your sister equivale a she: usa has.','Numa pergunta, Has vem antes do sujeito e got depois: Has your sister got a pet?']);
add('en-have','question','Build the question.',[order('Have your friends got a dog?')],['Your friends é plural: have.','Have + your friends + got + a dog?']);
add('en-have','short-answer','Has Nina got green eyes? Answer yes with a short answer.',[text('Short answer','Yes, she has.')],['Nina pode ser substituída por she.','Responde Yes, she has. Não acrescentes got na resposta curta.']);
add('en-have','short-answer','Have the boys got a guitar? Answer no with a short answer.',[text('Short answer',"No, they haven't.",['No, they have not.'])],['The boys é plural: they.','Responde No, they haven’t.']);
add('en-have','spot-error','Detective: choose the correct question.',[choice('Question',['Has she got a brother?','Have she got a brother?','She has got a brother?','Does she has got a brother?'])],['No padrão have got do manual, a pergunta começa por Have ou Has.','Com she: Has she got a brother?']);

for(const [sentence,answer] of [['I have got a dog. This is ____ dog.','my'],['She has got a sister. ____ sister is ten.','Her'],['We are pupils. ____ school is near.','Our'],['They have got bikes. ____ bikes are red.','Their'],['Ben has got a book. This is ____ book.','his'],['The cat is black. ____ eyes are green.','Its']])
  add('en-possessives','determiner',`Complete with a possessive determiner: ${sentence}`,[text('Possessive determiner',answer)],[`O nome a seguir precisa de um determinante possessivo: ${answer}.`,'I → my; she → her; we → our; they → their; he → his; it → its.']);
for(const [sentence,answer] of [['This is my bag. It is ____.','mine'],['Those are her shoes. They are ____.','hers'],['This is our house. It is ____.','ours'],['Those are their books. They are ____.','theirs'],['This is your pen. It is ____.','yours'],['This is his coat. It is ____.','his']])
  add('en-possessives','pronoun',`Complete with a possessive pronoun: ${sentence}`,[text('Possessive pronoun',answer)],[`O nome já foi referido. Usa ${answer}, sem repetir esse nome.`,'Mine, yours, his, hers, ours e theirs não levam apóstrofo.']);
add('en-possessives','case','Rewrite using the possessive case: the guitar belonging to Emma.',[text('Noun phrase',"Emma's guitar")],['Uma pessoa no singular: acrescenta ’s ao nome de quem possui.','Emma’s guitar = a guitarra da Emma.']);
add('en-possessives','case','Rewrite using the possessive case: the bikes belonging to the girls (more than one girl).',[text('Noun phrase',"the girls' bikes")],['Girls é um plural já acabado em s.','Põe apenas o apóstrofo depois do s: the girls’ bikes.']);
add('en-possessives','case','Rewrite using the possessive case: the toys belonging to the children.',[text('Noun phrase',"the children's toys")],['Children é um plural irregular que não termina em s.','Acrescenta ’s: the children’s toys.']);
add('en-possessives','case','Complete with ’s, ’ or of: the window ____ the kitchen.',[text('Missing word','of')],['Neste padrão do manual, usamos of para ligar estas duas coisas.','The window of the kitchen = a janela da cozinha.']);
add('en-possessives','whose','Choose the question asking about ownership.',[choice('Question',['Whose jacket is this?','Who is this jacket?','Who’s jacket is this?','Where jacket is this?'])],['Whose significa de quem.','Who’s é uma contração de who is ou who has. A pergunta é Whose jacket is this?']);
add('en-possessives','spot-error','Detective: choose the correct sentence.',[choice('Sentence',['This book is hers.','This book is her.','This book is her’s.','This book is she.'])],['Sem nome a seguir, usa o pronome hers.','Hers não leva apóstrofo.']);

for(const [pt,en,accept] of [['levantar-me','get up',[]],['tomar o pequeno-almoço','have breakfast',[]],['tomar duche','have a shower',['take a shower']],['vestir-me','get dressed',[]],['lavar os meus dentes','brush my teeth',[]],['ir para a escola','go to school',[]],['começar as aulas','start classes',[]],['fazer os meus TPC','do my homework',[]],['ir para a cama','go to bed',[]],['jantar','have dinner',[]]])
  add('en-routine','action',`Write the routine expression in English: “${pt}”.`,[text('Expression',en,accept)],[`A expressão do manual é ${en}.`,'Aprende a expressão completa, não apenas o verbo isolado.']);
add('en-routine','room','Complete: I cook in the ____. I sleep in the ____.',[text('Cooking room','kitchen'),text('Sleeping room','bedroom')],['Kitchen é cozinha; bedroom é quarto.','Lê a ação para escolher a divisão certa.']);
add('en-routine','food','Write in English: pão; leite; cenoura.',[text('Pão','bread'),text('Leite','milk'),text('Cenoura','carrot')],['Pão = bread; leite = milk; cenoura = carrot.','Este vocabulário está na revisão inicial do workbook.']);
add('en-routine','order','Put the words in order.',[order('I brush my teeth after breakfast.',['After breakfast I brush my teeth.'])],['Uma ordem possível é I + brush + my teeth + after breakfast.','After breakfast indica quando e também pode vir no início: After breakfast, I brush my teeth.']);
add('en-routine','room','Write the rooms in English: sala de estar; casa de banho.',[text('Sala de estar','living room'),text('Casa de banho','bathroom')],['Sala de estar = living room. Casa de banho = bathroom.','Aprende living room como uma expressão de duas palavras.']);
add('en-routine','objects','Write in English: frigorífico; espelho; roupeiro.',[text('Frigorífico','fridge',['refrigerator']),text('Espelho','mirror'),text('Roupeiro','wardrobe')],['Fridge é frigorífico; mirror é espelho; wardrobe é roupeiro.','Associa as palavras às divisões da casa onde costumas encontrar os objetos.']);
add('en-routine','food','Write in English: queijo; iogurte; sumo.',[text('Queijo','cheese'),text('Iogurte','yoghurt',['yogurt']),text('Sumo','juice')],['Cheese = queijo; yoghurt = iogurte; juice = sumo.','Yoghurt é a grafia britânica usada no manual; yogurt também é uma grafia válida.']);

const timeWords=[[7,0,"seven o'clock"],[8,15,'quarter past eight'],[6,30,'half past six'],[9,45,'quarter to ten'],[8,10,'ten past eight'],[10,50,'ten to eleven'],[4,20,'twenty past four'],[2,40,'twenty to three']];
for(const [hour,minute,answer] of timeWords){
  const display=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  add('en-time','read-clock','Look at the clock. Write the time in words, using o’clock, past or to.',[text('Time',answer,answer.startsWith('quarter')?[`a ${answer}`]:[])],[`O relógio indica ${display}.`,minute===0?'O ponteiro dos minutos está no 12: usa o’clock.':minute<=30?`Passaram ${minute} minutos da hora ${hour}. Usa past; 15 é quarter e 30 é half.`:`Faltam ${60-minute} minutos para as ${hour+1}. Usa to com a próxima hora.`,`A resposta é ${answer}.`],{clock:{hour,minute}});
}
add('en-time','digital','What time is “quarter to seven”? Write the digital time.',[text('Digital time','6:45',['06:45','18:45'])],['Quarter são 15 minutos. To seven significa que faltam 15 minutos para as sete.','É 6:45. Sem indicar manhã/tarde, 18:45 também corresponde a essa hora.']);
add('en-time','order','Build the sentence.',[order('We have lunch at half past one.',['At half past one we have lunch.'])],['Usa at antes da hora.','Half past one são 1:30. Podes colocar a hora no fim ou no início: At half past one, we have lunch.']);

for(const [subject,verb,form,reason] of [
  ['She','study','studies','Consoante + y: troca y por ies.'],['He','watch','watches','Watch termina em ch: acrescenta es.'],['My sister','go','goes','Go fica goes com he/she/it.'],['The boys','play','play','O sujeito é plural: mantém play.'],['My dad','have','has','Have tem a forma especial has na 3.ª pessoa.'],['Nora','brush','brushes','Brush termina em sh: acrescenta es.'],['My brother','play','plays','Antes de y há uma vogal: acrescenta apenas s.'],['We','do','do','We mantém a forma base do.']
])add('en-present','affirmative',`Complete in the present simple: ${subject} ____ (${verb}) ${{study:'English',watch:'TV',go:'to school',play:'tennis',have:'lunch',brush:'her teeth',do:'our homework'}[verb]} every day.`,[text('Verb',form)],[reason,`${subject} usa ${form}.`]);
for(const [sentence,answer,accept] of [
  ['She plays tennis.',"She doesn't play tennis.",['She does not play tennis.']],
  ['They go to school by bus.',"They don't go to school by bus.",['They do not go to school by bus.']],
  ['He has lunch at home.',"He doesn't have lunch at home.",['He does not have lunch at home.']]
])add('en-present','negative',`Make this sentence negative: ${sentence}`,[text('Negative sentence',answer,accept)],['He/she/it usa doesn’t; I/you/we/they usa don’t.','Depois de don’t/doesn’t, o verbo principal fica na forma base.',answer]);
add('en-present','question','Complete: ____ your brother ____ (study) after dinner? Yes, he ____.',[text('Question helper','Does'),text('Main verb','study'),text('Short answer helper','does')],['Your brother equivale a he: usa Does.','Depois de Does, escreve study, não studies.','Does your brother study after dinner? Yes, he does.']);
add('en-present','question','Build the question.',[order('What time do they get up?')],['What time vem primeiro. They usa do.','What time + do + they + get up?']);
add('en-present','question','Do Anna and Zoe walk to school? Answer no with a short answer.',[text('Short answer',"No, they don't.",['No, they do not.'])],['Anna and Zoe equivale a they.','Responde No, they don’t.']);
add('en-present','frequency','Put “usually” in its usual position: I have breakfast at home.',[text('Sentence','I usually have breakfast at home.')],['Com o verbo principal have, o advérbio costuma vir antes dele.','I usually have breakfast at home.']);
add('en-present','frequency','Put “never” in its usual position: She is late.',[text('Sentence','She is never late.')],['Com to be, o advérbio vem depois do verbo.','She is never late. Never já significa nunca; não acrescentes not.']);
add('en-present','frequency','Build the sentence with often before the main verb.',[order('He often plays football after school.',['After school he often plays football.'])],['Often vem antes do verbo principal plays.','He é 3.ª pessoa do singular: plays tem s. After school pode ficar no início ou no fim.']);
add('en-present','spot-error','Detective: choose the correct sentence.',[choice('Sentence',["Does she go to school on foot?",'Does she goes to school on foot?','Do she go to school on foot?','Does she to go to school on foot?'])],['Does já assinala a 3.ª pessoa. O verbo principal fica go.','Does she go to school on foot?']);

export const READING_TEXTS=[
  {id:'mia',title:'Mia’s school day',paragraphs:[
    'My name is Mia Green. I am eleven and I am Irish. I live with my parents and my brother Luke. My mum is a vet and my dad is a mechanic. I have got long straight brown hair and green eyes. Luke has got short curly hair. He is funny and friendly.',
    'On school days I get up at half past seven. I have breakfast in the kitchen. I walk to school with Luke at quarter past eight. We have lunch in the school canteen. After school I do my homework. I usually play the guitar in the evening. I go to bed at ten o’clock.'
  ]},
  {id:'oliver',title:'Oliver and his family',paragraphs:[
    'I am Oliver Reed. I am twelve and I am British. My sister Ruby is ten. Our mum is a nurse and our dad is a chef. Ruby has got short wavy hair and blue eyes. She is active and polite. We have got a dog, but we haven’t got a cat.',
    'I get up at seven o’clock and I have a shower. My dad drives us to school at twenty to nine. I have lunch with my friends at school. On Tuesdays I play basketball after school. Ruby often reads in the afternoon. We have dinner at half past seven. I go to bed at quarter to ten.'
  ]}
];
const reading=(index,skill,prompt,fields,steps)=>add('en-reading',skill,prompt,fields,steps,{passage:READING_TEXTS[index],readingSet:READING_TEXTS[index].id});
reading(0,'details','Read the text. What nationality is Mia? Write the nationality only.',[text('Nationality','Irish',[],{caseSensitive:true})],['A primeira parte diz que Mia é Irish.','Escreve Irish, com maiúscula; não confundas nacionalidade com nome ou idade.']);
reading(0,'true-false','Read the text. “Mia goes to school by bus.” Choose the correct statement.',[choice('Statement',['False. She walks to school.','True. She goes by bus.','False. Her dad drives her.'])],['Mia diz que vai a pé com Luke: I walk to school.','A frase sobre o autocarro é falsa. A correção é She walks to school.']);
reading(0,'short-answer','Read the text. Has Mia got curly hair? Answer with a short answer.',[text('Short answer',"No, she hasn't.",['No, she has not.'])],['Mia tem cabelo liso; Luke é que tem cabelo encaracolado.','A pergunta começa por Has: responde No, she hasn’t.']);
reading(0,'time','Read the text. What time does Mia get up? Use past in your answer.',[text('Time','at half past seven',['half past seven','She gets up at half past seven.'])],['Encontra get up na segunda parte.','Half past seven são 7:30. A resposta é at half past seven.']);
reading(1,'details','Read the text. What is Oliver’s mum’s job? Write the job only.',[text('Job','nurse')],['A primeira parte identifica a profissão da mãe: nurse.','Nurse significa enfermeira/enfermeiro.']);
reading(1,'true-false','Read the text. “Oliver’s family has got a cat.” Choose the correct statement.',[choice('Statement',["False. They haven't got a cat.",'True. They have got a cat.',"False. They haven't got a dog."])],['A família tem um cão e não tem gato.','A correção é They haven’t got a cat.']);
reading(1,'short-answer','Read the text. Does Ruby often read in the afternoon? Answer with a short answer.',[text('Short answer','Yes, she does.')],['A segunda parte diz Ruby often reads in the afternoon.','A pergunta tem Does: responde Yes, she does.']);
reading(1,'time','Read the text. What time does Oliver go to bed? Use to in your answer.',[text('Time','at quarter to ten',['quarter to ten','at a quarter to ten','a quarter to ten','He goes to bed at quarter to ten.'])],['Procura go to bed no fim do texto.','Quarter to ten são 9:45. A resposta é at quarter to ten.']);

export const ENGLISH_WRITING={
  title:'My daily routine',
  prompt:'Write 40–60 words about your daily routine. Include your morning, school day and evening. Give at least two times and use one adverb of frequency.',
  plan:['Manhã: a que horas te levantas e o que fazes antes da escola?','Dia: como vais para a escola e o que fazes depois das aulas?','Noite: o que fazes, a que horas jantas e a que horas te deitas?'],
  checklist:['Escrevi sobre manhã, escola/tarde e noite.','Usei pelo menos dois horários com at.','Usei um advérbio de frequência numa posição correta.','Usei I com maiúscula e confirmei verbos, apóstrofos e pontuação.','O texto é meu, faz sentido e tem aproximadamente 40–60 palavras.'],
  model:'I get up at seven o’clock. I have breakfast and brush my teeth. I go to school at quarter past eight. After school, I do my homework. I usually read in the evening. I have dinner with my family and go to bed at half past nine.'
};

export const ENGLISH_EXAM_SLOTS=[
  ['en-people','family'],['en-people','job'],['en-people','appearance'],['en-personal',null],['en-be',null],
  ['en-have','affirmative'],['en-have','question'],['en-possessives','determiner'],['en-possessives','pronoun'],['en-possessives','case'],
  ['en-present','affirmative'],['en-present','negative'],['en-present','question'],['en-present','frequency'],['en-time','read-clock'],['en-routine','action']
];

// Acrescentar no fim: os IDs existentes identificam progresso e sessões guardadas.
// No teste, a aluna escreve a correção em vez de a reconhecer numa opção.
export const ENGLISH_READING_SKILLS=['true-false-written','full-answer','short-answer','time'];
reading(0,'true-false-written','Read: “Mia has lunch at home.” Choose True or False, then complete the correction: She ____ in the school canteen.',[
  choice('True or False',['False','True']),text('Missing words','has lunch')
],['O texto diz We have lunch in the school canteen: Mia almoça na cantina.','A afirmação é falsa. Ao falar de Mia, We have passa a She has: She has lunch in the school canteen.']);
reading(0,'full-answer','Where does Mia have breakfast? Write a complete sentence beginning with She. Use have breakfast and the place in the text.',[
  text('Complete sentence','She has breakfast in the kitchen.')
],['Procura breakfast: o texto indica in the kitchen.','Para responder sobre Mia, troca I have por She has.','She has breakfast in the kitchen. Uma resposta completa precisa do sujeito e do verbo.']);
reading(1,'true-false-written','Read: “Oliver’s family has got a cat.” Choose True or False, then complete the correction using have got: They ____ a cat.',[
  choice('True or False',['False','True']),text('Missing words',"haven't got",['have not got'])
],['O texto diz We haven’t got a cat. A afirmação é falsa.','Ao falar da família, We passa a They. They usa have: They haven’t got a cat.']);
reading(1,'full-answer','Where does Oliver have lunch? Write a complete sentence beginning with He. Use have lunch and the place in the text.',[
  text('Complete sentence','He has lunch at school.',['He has lunch with his friends at school.','He has lunch at school with his friends.'])
],['O texto diz I have lunch with my friends at school. O lugar é at school.','Ao responder sobre Oliver, usa He has, não He have. Se referires os amigos, my friends passa a his friends.','He has lunch at school.']);
for(const [meaning,word] of [['sempre','always'],['habitualmente','usually'],['frequentemente','often'],['às vezes','sometimes'],['nunca','never']])
  add('en-present','frequency-meaning',`Write the adverb of frequency from this list that means “${meaning}”: always, usually, often, sometimes, never.`,[text('Adverb',word)],[`${word} significa ${meaning}.`,'Escolhe pelo significado. Depois usa-o numa frase tua: antes do verbo principal ou depois de to be.']);
add('en-present','mixed','Complete in the present simple: Lara ____ (study) after school, but she ____ (not study) at night. Her friends ____ (play) tennis on Saturdays.',[
  text('Lara','studies'),text('Negative',"doesn't study",['does not study']),text('Her friends','play')
],['Lara equivale a she: study passa a studies (consoante + y).','Na negativa usa doesn’t e a forma base study.','Her friends é plural: play, sem s. Lê cada sujeito antes de escolher a forma.']);
add('en-present','question','Write the full question. Add do or does: How / your sister / go to school?',[
  text('Question','How does your sister go to school?')
],['How pergunta como. Your sister equivale a she: usa does.','A ordem é How + does + your sister + go to school?','Depois de does, go fica na forma base.']);
add('en-present','affirmative','Complete in the present simple: Ben ____ (do) his homework before dinner. He ____ (try) to finish on time.',[
  text('do','does'),text('try','tries')
],['Ben equivale a he: do passa a does.','Try termina em consoante + y: troca y por ies → tries.']);
reading(0,'true-false-written','Read: “Mia goes to school on foot.” Choose True or False, then complete the evidence from the text: She ____ to school with Luke.',[
  choice('True or False',['True','False']),text('Missing verb','walks')
],['On foot significa a pé. I walk to school confirma a afirmação: é verdadeira.','Ao falar de Mia, usa She walks, com s. A frase que confirma a resposta é She walks to school with Luke.']);
reading(1,'true-false-written','Read: “Oliver’s family has got a dog.” Choose True or False, then complete the evidence using have got: They ____ a dog.',[
  choice('True or False',['True','False']),text('Missing words','have got')
],['O texto diz We have got a dog: a afirmação é verdadeira.','Ao falar da família, We passa a They. They usa have got: They have got a dog.']);
