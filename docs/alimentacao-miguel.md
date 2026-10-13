# Miguel · Alimentação

## Utilização

- Os cartões mostram nome, tempo, energia da porção, proteína e escolha. Ingredientes, preparação, notas e edição ficam num único detalhe.
- O resumo apresenta as escolhas face à meta e identifica nutrientes parcialmente conhecidos. Introduzir apenas kcal não equivale a consumir zero proteína.
- “Já comi” guarda uma cópia da porção e dos nutrientes. Lanches, alterações da meta ou edições do catálogo não alteram essa cópia. “Corrigir” desbloqueia a refeição; as escolhas e cópias são limpas na mudança do dia local.
- A meta predefinida continua em 2 400 kcal. Metas pessoais já guardadas são preservadas.
- Pode repetir-se a mesma receita ao almoço e ao jantar, útil para preparação de várias doses.

## Porções e catálogo

O ajuste prático é ativado apenas no plano do Miguel; os consumidores partilhados, incluindo Filipa, conservam o comportamento anterior. Arroz e quinoa prontos variam entre 75–250 g em passos de 25 g; batata entre 200–400 g; massa seca entre 60–120 g. Os wraps mantêm uma porção fixa. As calorias apresentadas correspondem à porção resultante, mesmo quando não coincide exatamente com a meta. Complementos só contam depois de adicionados.

Existem quatro pequenos-almoços, oito refeições principais e cinco lanches. Foram acrescentados bolonhesa de soja, caril de grão/tofu, salada de feijão-frade/ovo e wraps de húmus/tofu. O lanche de pão tem uma variante salgada com húmus e tomate, sem batido. A whey em pó usa uma referência única Evowhey (104 kcal e 23 g de proteína/30 g), já existente no catálogo. Receitas editadas pelo utilizador mantêm os seus valores.

Os valores são estimativas por ingrediente, não análises laboratoriais. A massa integral usa o [rótulo Barilla Integral](https://www.barilla.com/pt-pt/produtos/massas/integral/penne-rigate-integral), consultado em 12/10/2026. Arroz e produtos já usados mantêm as referências do catálogo. Soja texturizada, grão, feijão-frade, húmus, tortilhas e hortícolas usam valores médios explicitamente identificados nas receitas; devem ser afinados pelos rótulos concretos.

Uma alteração apenas do nome, notas ou preparação conserva os restantes dados. Alterar ingredientes ou nutrientes preserva a preparação, mas invalida componentes, variantes e ajustes antigos, passando a usar a porção introduzida. Atualizações do catálogo não substituem edições pessoais.

## Verificação

`node --test tests/alimentacao-*.test.mjs tests/filipa-alimentacao-*.test.mjs`

`tests/alimentacao.browser.mjs` usa Playwright/Chrome, servidor local e Firebase simulado. Verifica escolhas, consumo, alteração de meta, edição, persistência, registo apenas de kcal e larguras de 320, 390, 768 e 1440 px, sem aceder à conta ou escrever na cloud. `PLAYWRIGHT_MODULE` e `BROWSER_EXECUTABLE` permitem indicar instalações locais.
