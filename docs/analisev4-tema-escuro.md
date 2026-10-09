# Análise: tema escuro e navegação

A página `modules/analisev4.html` é a primeira aplicação do tema escuro.

## Reutilizar noutras páginas

1. Carregar `css/theme-dark.css` depois das folhas de estilo base e mobile.
2. Adicionar `data-theme="dark"` ao `body` e usar `#101722` no `theme-color`.
3. Usar as variáveis de superfície, texto, contorno e estado deste ficheiro em vez
   de cores literais. A navegação, os seletores, os campos e as tabelas têm regras
   partilhadas. As particularidades do layout ficam na folha de estilo da página.
4. Rever os estilos específicos e gráficos da página antes de ativar o tema:
   fundos brancos e cores embutidas em JavaScript não herdam automaticamente o tema.
5. Confirmar desktop, mobile, menus, tabelas, estados selecionados e foco de teclado.

`css/analisev4.css` contém apenas o layout e as adaptações da Análise aos estilos
legados. As outras páginas continuam a utilizar o seu tema atual até serem revistas.

## Comportamento acordado

- Painel único com seletor Total / 123 / 1248 / Comparar para KPIs, análise mensal
  e detalhe. Os KPIs continuam a comparar até ao mesmo dia do ano anterior.
- «Comparar»: cada KPI mostra os dois ALs e a evolução homóloga individual;
  gráfico/tabela mantêm a comparação entre ALs. O detalhe agrega os dois e indica Total.
- Identidade dos ALs: 123 azul, 1248 laranja (RGB 245, 133, 20).
- Seletor Com/Sem taxa Airbnb aplicado a toda a análise monetária, incluindo as
  bases homólogas, o objetivo anual e os preços/noite no detalhe. Subtrai a taxa
  registada em cada fatura, sem alterar os dados guardados nem aplicar uma
  percentagem atual aos anos anteriores. Por defeito inclui a taxa.
- Noites, reservas, ocupação e taxas de limpeza não mudam com este seletor.
- Percentagem dentro da barra de progresso; seletores com cor mais suave e
  espaço interior. Métrica e Mês/Cumulativo na mesma linha quando há largura.
- Gráfico/tabela: mantém-se a comparação com o mês homólogo completo.
- Gráfico: ano atual e dois anteriores, com opção de abrir o histórico mais antigo.
  A tabela mantém por defeito o ano atual e anterior, com histórico opcional.
- Ocupação: dados a partir de 2025; 2024 nunca aparece nesta métrica.
- Média histórica removida. As cores de cada ano não mudam ao abrir o histórico.
- Detalhe recolhido por defeito. Mobile usa seletores nativos de métrica e detalhe.
- Faturação, taxas de limpeza e tratamento das noites extra mantidos.

## Verificação

Executar `node --test tests/analisev4.test.cjs` na raiz do projeto.
Os testes usam faturas sintéticas e datas fixas, sem ligação ao Firebase.
Cobrem a mudança de ano, o histórico de ocupação, a janela da comparação,
os períodos dos KPIs/gráfico, a contribuição das noites extra, os KPIs por AL
e a exclusão da taxa Airbnb (histórico, mudança de ano e detalhe das reservas).
