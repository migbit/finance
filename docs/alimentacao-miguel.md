# Miguel · Alimentação

## Utilização

- Os cartões mostram nome, tempo, energia da porção, proteína e escolha. Ingredientes, preparação, notas e edição ficam num único detalhe.
- O resumo mostra o **total das refeições registadas**, incluindo escolhas planeadas e consumidas. Não é o consumo completo do dia se houver alimentos por registar, nem um saldo disponível para extras.
- As porções são independentes: escolher outra refeição, acrescentar lanches ou registar kcal nunca redimensiona os ingredientes das restantes receitas. Não há reservas, meta de 2 400 kcal ou ordenação automática para compensar supostos défices de proteína/fibra.
- A referência prática de proteína é cerca de 120–150 g/dia, contando toda a alimentação, para o perfil confirmado: 41 anos, 74,5 kg, 1,77 m, objetivo de perder 2–3 kg preservando músculo. É uma referência, não uma obrigação de completar o total com receitas da app ou whey.
- Introduzir apenas kcal mantém os macronutrientes como desconhecidos, identificando os totais como parciais. “Adicionar lanche ou extra” permite incluir outros alimentos.
- “Já comi” guarda uma cópia da porção e nutrientes. Alterar o catálogo não altera essa cópia, incluindo porções ajustadas guardadas pela versão anterior. “Corrigir” desbloqueia a refeição. Na mudança do dia local são limpas escolhas, variantes escolhidas, lanches e cópias consumidas.
- Pode repetir-se a mesma receita ao almoço e ao jantar. Receitas pessoais e edições existentes são preservadas.

## Porções e catálogo

Quatro pequenos-almoços, oito refeições principais e cinco lanches, com variantes explícitas. As necessidades energéticas não são dedutíveis com precisão apenas da idade e peso; as quantidades são pontos de partida práticos, ajustáveis pela fome, atividade e restante alimentação.

| Receita | Porção revista | kcal / proteína aproximadas |
| --- | --- | --- |
| Frittata | 2 ovos, 100 g de claras, 300 g de batata, 250 g de legumes, 30 g de mozzarella e 5 g de azeite | 629 / 41,4 g |
| Massa de lentilhas | 80 g de massa seca, 100 g de skyr, 20 g de mozzarella; restantes ingredientes mantidos | 561 / 44,8 g |
| Creme de arroz | Base sem whey; opção explícita com 10 g de whey | 411 / 29,1 g ou 445 / 36,8 g |
| Pré-exercício menor | 60 g de pão, 15 g de compota, 100 g de banana, 200 ml de bebida de soja; sem whey | 352 / 12,8 g |
| Skyr, banana e cereais menor | 150 g de skyr, 120 g de banana e 20 g de cereais | 268 / 19,8 g |
| Taça menor sem whey | 170 g de skyr, 150 g de fruta e 25 g de cereais | 255 / 21,8 g |

As outras seis refeições principais e os restantes pequenos-almoços mantêm as quantidades base. O shake é opcional; não é acrescentado automaticamente. As variantes antigas dos lanches continuam disponíveis. O pão com húmus e tomate tem 8,7 g de proteína, claramente distinto do pão com batido (31 g).

Variantes novas calculam ingredientes e nutrientes a partir dos componentes, com preparação correspondente. O seletor do pequeno-almoço permite pré-visualizar a porção; só “Escolher” atualiza o registo. Cada botão de lanche identifica energia e proteína da respetiva variante. A whey em pó mantém a referência Evowhey (104 kcal e 23 g de proteína/30 g).

Os valores são estimativas por ingrediente. Produtos já usados mantêm as referências dos rótulos registados; restantes ingredientes usam valores médios identificados nas receitas. Uma alteração apenas do nome, notas ou preparação conserva os restantes dados. Alterar ingredientes ou nutrientes invalida componentes e variantes antigas. Atualizações do catálogo não substituem edições pessoais.

## Compatibilidade e verificação

Miguel usa calculateRecordedPlan, sem metas ou ajuste de porções. O planeador anterior continua disponível para Filipa e os seus testes de regressão. O campo legado manualCalories é preservado nos dados existentes, mas não afeta Miguel nem aparece como configuração.

Comando: node --test tests/alimentacao-*.test.mjs tests/filipa-alimentacao-*.test.mjs

O teste tests/alimentacao.browser.mjs usa Playwright/Chrome, servidor local e Firebase simulado. Verifica porções independentes, variantes, consumo, edição, persistência, registo apenas de kcal, migração de metas antigas, mudança de dia e larguras de 320, 390, 768 e 1440 px. Não acede à conta nem escreve na cloud. PLAYWRIGHT_MODULE e BROWSER_EXECUTABLE permitem indicar instalações locais.
