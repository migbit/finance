# Catálogo de meditação

## Âmbito

Este catálogo reúne práticas contemplativas documentadas em fontes históricas, tradicionais, académicas e práticas. É deliberadamente um catálogo vivo: práticas orais, perdidas, restritas, locais ou ainda não digitalizadas impedem qualquer alegação honesta de exaustividade.

Inclui práticas budistas, hindus, de yoga e tantra público, jainistas, sikhs, daoistas, confucianas, cristãs, judaicas, sufis, indígenas publicamente documentadas e métodos seculares ou contemporâneos. Hipnose, afirmações, relaxamento simples e práticas relacionadas com o uso de substâncias são excluídos.

## Critério de identidade

Traduções, transliterações e sinónimos ficam na mesma ficha. Uma variante só recebe ficha própria quando muda materialmente a impressão digital procedural:

`âncora + modo de atenção + operação mental + respiração + movimento + objetivo/contexto`

Programas compostos, como MBSR ou MBCT, não são tratados automaticamente como uma única técnica; as práticas procedurais que contêm podem aparecer individualmente.

## Revisão editorial

Cada ficha deve conter:

- nome português, nomes originais, línguas e aliases;
- tradição, sistema de crença, região e período;
- família funcional, modo de atenção, âncoras, características e objetivos;
- posições possíveis, flexibilidade, dificuldade e intensidade;
- preparação, pelo menos cinco passos, encerramento e adaptações;
- contexto e precauções sem bloquear a experimentação individual;
- pelo menos duas fontes identificáveis, privilegiando texto primário/tradicional ou investigação e uma orientação prática credível;
- síntese original em português, sem reproduzir capítulos, traduções ou transcrições protegidas.

Os conteúdos encontram-se em três shards para facilitar manutenção:

- `data/meditations/buddhist.json`
- `data/meditations/asian-non-buddhist.json`
- `data/meditations/global-modern.json`

O teste `tests/meditation-catalog.test.mjs` valida o esquema, IDs, fontes e cobertura mínima. A validação automática não substitui revisão linguística ou por especialistas de cada tradição.

## Recomendações pessoais

Uma sessão concluída recebe uma classificação inteira de 0 a 20. Repetições da mesma técnica são primeiro reduzidas à média dessa técnica, impedindo que uma prática repetida muitas vezes domine o perfil.

Depois de cinco técnicas diferentes, o recomendador compara:

- sistema de crença e tradição;
- família e modo de atenção;
- âncoras e características procedurais;
- objetivos;
- posição e flexibilidade;
- dificuldade e intensidade.

Posições com baixa exigência de flexibilidade, sobretudo cadeira e deitado, têm uma preferência inicial suave. Nunca são uma exclusão: filtros manuais podem selecionar qualquer posição e cada ficha deve indicar adaptações amigas dos joelhos sempre que forem procedimentalmente honestas.

Cerca de 15% das práticas novas recebem um pequeno sinal exploratório determinístico. Isto introduz variedade sem colocar todas as sugestões fora do perfil à frente das compatíveis. A interface explica os principais fatores de cada recomendação.

Práticas nunca experimentadas aparecem sempre antes das experimentadas. Entre as experimentadas, a ordenação recomendada usa a média pessoal e, em caso de empate, o número de sessões.

## Persistência

O catálogo é estático e versionado no repositório. Apenas sessões pessoais são gravadas no Firestore:

`users/{uid}/meditation_sessions/{sessionId}`

Cada sessão começa como `in_progress` e só conta como experimentada depois de passar a `completed`. O documento conserva o ID e o título da técnica, datas, objetivo temporal, pausas, duração real, classificação e nota. Sessões canceladas não contam para ordenação nem aprendizagem.

Quando uma técnica é retirada do catálogo, as sessões associadas deixam de aparecer e de influenciar estatísticas ou recomendações, mas o histórico remoto não é apagado automaticamente.

O PIN da interface é uma barreira visual, não criptografia nem controlo de acesso. O UID separa os caminhos usados pela interface, mas as regras gerais atuais do projeto permitem acesso a utilizadores autenticados; isso deve ser revisto se a aplicação deixar de ser estritamente pessoal.
