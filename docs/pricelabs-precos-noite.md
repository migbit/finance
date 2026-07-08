# PriceLabs - preparacao para pagina "Precos / noite"

Data da analise: 2026-07-08.

## Objetivo

Preparar a futura pagina da webapp para consultar e, mais tarde, gerir precos por noite usando PriceLabs.

A conclusao principal e simples:

- MCP e bom para analise assistida por IA, perguntas em linguagem natural e operacoes manuais controladas em chat.
- Customer API e a via correta para a webapp, porque permite chamadas programaticas e nao expoe credenciais no browser.

## MCP PriceLabs

O MCP liga a conta PriceLabs a um assistente AI. A PriceLabs documenta o conector como beta e comecou por Claude, mas tambem expoe um servidor MCP para clientes AI em:

```text
https://developers.pricelabs.co/_mcp/server
```

Para Claude, o fluxo e:

1. PriceLabs > Account Settings > AI Connector (MCP).
2. Copiar MCP URL e Client ID.
3. Claude > Customize > Connectors > Add custom connector.
4. Usar:
   - Name: `PriceLabs MCP`
   - URL: `https://mcp.pricelabs.co/mcp`
   - Client ID: o valor da conta PriceLabs
5. Autorizar no login PriceLabs.
6. Abrir uma conversa nova, porque as ferramentas MCP so aparecem em novas conversas.

As permissoes podem ser read e/ou write. Para alterar permissoes, e preciso desligar a integracao do lado PriceLabs e voltar a ligar.

Para team members, o admin ativa MCP em Account Settings > Team Settings. O acesso respeita as permissoes do utilizador, incluindo restricoes por listing e permissao de escrita.

Ferramentas MCP mais relevantes:

- `get_listings`: lista listings com id, PMS e min/base/max.
- `get_listing_data`: detalhe e metricas de uma ou mais listings.
- `update_listing_data`: atualiza min/base/max e tags; requer write access.
- `get_listing_prices`: calendario diario de precos.
- `refresh_listing_pricing`: recalcula calendario de precos; requer write access.
- `get_listing_rate_plans`: planos de tarifa da listing.
- `get_listing_date_overrides`: DSOs futuros.
- `update_listing_date_overrides`: cria/atualiza DSOs futuros; requer write access.
- `delete_listing_date_overrides`: remove DSOs.
- `get_pms_reservations`: reservas do PMS.
- `get_listing_neighborhood_market` e `get_neighbourhood_data`: contexto de mercado/concorrencia.
- `get_listing_performance_metrics`: KPIs como ADR, receita, ocupacao, RevPAR e comparacao com mercado.

## Customer API

Base URL:

```text
https://api.pricelabs.co
```

Autenticacao:

```http
X-API-Key: PRICE_LABS_API_KEY
```

A chave e obtida em PriceLabs > Account Settings > API Details > Enable. A API tem custo indicado pela PriceLabs de 1 USD por listing por mes para listings que sincronizam precos no mes, mais impostos aplicaveis.

Limites documentados:

- 60 requests/minuto por API key.
- 1000 requests/hora por API key.
- Excesso retorna HTTP 429.
- Timeout recomendado pelo fornecedor: 300 segundos.

## Endpoints principais para "Precos / noite"

### Listar listings

```http
GET /v1/listings
```

Query params uteis:

- `skip_hidden=true`: exclui listings escondidas.
- `only_syncing_listings=true`: devolve so listings com sync ligado.

Campos relevantes na resposta:

- `id`
- `pms`
- `name`
- `min`
- `base`
- `max`
- `currency` quando disponivel noutros endpoints
- `push_enabled`
- `isHidden`
- `last_refreshed_at`
- `last_date_pushed`
- `channel_listing_details`

### Obter calendario de precos

```http
POST /v1/listing_prices
```

Body:

```json
{
  "listings": [
    {
      "id": "LISTING_ID",
      "pms": "airbnb",
      "dateFrom": "2026-07-01",
      "dateTo": "2026-12-31",
      "reason": false
    }
  ]
}
```

Campos por dia:

- `date`
- `price`: preco recomendado PriceLabs.
- `user_price`: ultimo preco visto no PMS; `-1` pode significar dia indisponivel.
- `uncustomized_price`: preco antes de customizacoes.
- `min_stay`
- `booking_status`
- `ADR`, `ADR_STLY`
- `unbookable`: `0` bookable, `1` bloqueado por restricoes PriceLabs.
- `check_in`, `check_out`
- `demand_color`, `demand_desc`
- `weekly_discount`, `monthly_discount`
- `extra_person_fee`, `extra_person_fee_trigger`

Se `reason: true`, cada dia pode incluir:

- `listing_info`
- `market_factors`
- `pricing_customizations`
- `thresholds`
- `other_customizations`
- `final_price_override`
- `final_adjustments`

Usar `reason: false` por defeito na UI para reduzir payload. Ativar apenas numa vista de detalhe/diagnostico.

Erros por listing:

- `LISTING_NOT_PRESENT`
- `LISTING_NO_DATA`
- `LISTING_TOGGLE_OFF`

### Atualizar min/base/max da listing

```http
POST /v1/listings
```

Body:

```json
{
  "listings": [
    {
      "id": "LISTING_ID",
      "pms": "airbnb",
      "base": 120,
      "min": 80,
      "max": 250,
      "tags": ["Lisboa", "T1"],
      "push_enabled": true
    }
  ]
}
```

Este endpoint e adequado para edicoes estruturais de preco base, minimo, maximo, tags e sync. Nao e o endpoint ideal para mudar o preco de uma noite especifica.

### Ler Date Specific Overrides

```http
GET /v1/listings/{listing_id}/overrides?pms=airbnb&start_date=2026-07-01&end_date=2026-12-31
```

Por defeito so devolve overrides de hoje em diante.

Campos relevantes:

- `date`
- `price`
- `price_type`: `fixed`, `percent`, `percent_stacked`
- `currency`
- `base_price`
- `min_stay`
- `min_price`, `min_price_type`
- `max_price`, `max_price_type`
- `check_in_check_out_enabled`
- `check_in`, `check_out`
- `reason`
- `lead_time_expiry`

### Criar/atualizar Date Specific Overrides

```http
POST /v1/listings/{listing_id}/overrides
```

Body exemplo para uma noite:

```json
{
  "pms": "airbnb",
  "update_children": false,
  "overrides": [
    {
      "date": "2026-08-15",
      "price": "180",
      "price_type": "fixed",
      "currency": "EUR",
      "min_stay": 2,
      "reason": "Ajuste manual via webapp"
    }
  ]
}
```

Notas importantes:

- A operacao e all-or-nothing: se um override falha validacao, nenhum override e gravado.
- `price_type=fixed` requer `currency` exatamente igual a moeda do PMS.
- `percent` e `percent_stacked` usam percentagem sobre preco recomendado; valores documentados entre -75 e 1000.
- `percent_stacked` pode exigir feature ativada pela PriceLabs.
- `update_children` tem de ser boolean JSON real, nao string.

### Apagar Date Specific Overrides

```http
DELETE /v1/listings/{listing_id}/overrides
```

Body:

```json
{
  "pms": "airbnb",
  "update_children": false,
  "overrides": [
    { "date": "2026-08-15" }
  ]
}
```

### Reservas

```http
GET /v1/reservation_data
```

Parametros:

- `pms`: obrigatorio.
- `start_date` e `end_date`: filtro por check-in; ambos obrigatorios em conjunto.
- `booked_start_date` e/ou `booked_end_date`: filtro por data de reserva.
- `listing_id`: opcional.
- `include_hidden`: `true` por defeito.
- `include=available`: inclui disponibilidade quando suportado.
- `limit` e `offset`: paginacao; continuar ate `next_page=false`.

Campos relevantes:

- `listing_id`
- `listing_name`
- `reservation_id`
- `check_in`, `check_out`
- `booking_status`: `booked`, `cancelled`, `blocked`, `available`
- `booked_date`
- `rental_revenue`
- `total_cost`
- `no_of_days`
- `currency`
- `cleaning_fees`
- `booking_channel`

Este endpoint pode ser util para validar ocupacao, ADR real e comparacao com precos PriceLabs. A doc indica que sub-user API keys recebem 403 neste endpoint.

## Arquitetura recomendada para esta repo

Nunca chamar a PriceLabs diretamente do browser. A API key ficaria exposta em `js/*.js`.

Usar o padrao que o projeto ja tem:

1. Adicionar secret Firebase:

```bash
firebase functions:secrets:set PRICELABS_API_KEY
```

2. Criar Cloud Function `priceLabs` em `firebase/functions/index.js`.
3. Adicionar rewrite no `firebase.json`, por exemplo:

```json
{
  "source": "/api/pricelabs/**",
  "function": {
    "functionId": "priceLabs",
    "region": "europe-west1"
  }
}
```

4. Frontend chama apenas endpoints internos, por exemplo:

```text
GET  /api/pricelabs/listings
POST /api/pricelabs/prices
GET  /api/pricelabs/overrides?listing_id=...&pms=...
POST /api/pricelabs/overrides
DELETE /api/pricelabs/overrides
```

5. A Function valida inputs, aplica auth existente, injeta `X-API-Key`, limita payloads e normaliza erros.

## Modelo de dados sugerido para a UI

```js
{
  listingId: "12345",
  pms: "airbnb",
  name: "Apartamento 123",
  currency: "EUR",
  min: 80,
  base: 120,
  max: 250,
  pushEnabled: true,
  lastRefreshedAt: "2026-07-08T10:00:00Z",
  days: [
    {
      date: "2026-08-15",
      price: 180,
      userPrice: 180,
      uncustomizedPrice: 165,
      minStay: 2,
      demand: "High Demand",
      unbookable: false,
      checkIn: true,
      checkOut: true,
      override: {
        price: "180",
        priceType: "fixed",
        reason: "Ajuste manual via webapp"
      }
    }
  ]
}
```

## Funcionalidades provaveis da pagina

Primeira versao segura:

- Selecionar apartamento/listing.
- Selecionar intervalo de datas.
- Ver calendario/tabela com preco recomendado, preco PMS, estadia minima, procura, restricoes e overrides.
- Destacar noites com DSO.
- Ver ultima atualizacao PriceLabs.
- Exportar CSV ou copiar tabela.

Segunda versao com escrita:

- Editar preco fixo numa data.
- Editar estadia minima.
- Definir intervalo de DSOs.
- Remover override.
- Alterar base/min/max da listing.
- Exigir confirmacao explicita antes de enviar alteracoes.
- Guardar no Firestore um log local das alteracoes feitas pela webapp.

## Validacoes antes de escrita

- `listing_id` e `pms` obrigatorios e vindos da lista de listings autorizadas.
- Datas em formato `YYYY-MM-DD`.
- `dateTo >= dateFrom`.
- Intervalo maximo por request, por exemplo 370 dias.
- `price` numerico e positivo para `fixed`.
- `currency` obrigatoria e igual a currency da listing quando `fixed`.
- `min_stay` inteiro maior que zero.
- Para DSOs em lote, validar tudo antes de chamar PriceLabs porque a API e all-or-nothing.
- Mostrar diff antes de confirmar: preco atual, preco PriceLabs recomendado, override novo.

## Caching e rate limit

- Cache curto para listings: 5 a 15 minutos.
- Cache curto para precos por listing+intervalo: 5 a 15 minutos, invalidado apos update.
- Evitar `reason: true` em carregamentos gerais.
- Implementar retry apenas para 429/5xx com backoff; nao repetir POST/DELETE automaticamente sem idempotencia/controlos.
- Expor ao frontend mensagens amigaveis para `LISTING_TOGGLE_OFF`, `LISTING_NO_DATA` e validacoes de DSO.

## Fontes oficiais consultadas

- https://developers.pricelabs.co/llms.txt
- https://developers.pricelabs.co/mcp/overview
- https://developers.pricelabs.co/mcp/connect-to-claude
- https://developers.pricelabs.co/mcp/tools/overview
- https://developers.pricelabs.co/mcp/tools/listings
- https://developers.pricelabs.co/mcp/tools/pricing
- https://developers.pricelabs.co/mcp/tools/date-specific-overrides
- https://developers.pricelabs.co/customer-api/api-reference/overview
- https://developers.pricelabs.co/customer-api/api-reference/enable-the-api
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/listings/all-listings.md
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/prices/for-listings.md
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/listings/update-listings.md
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/date-specific-overrides-dso/listing-date-level-overrides.md
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/date-specific-overrides-dso/listing-date-level-overrides-1.md
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/date-specific-overrides-dso/listing-date-level-overrides-2.md
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/reservations/get-reservations.md
- https://developers.pricelabs.co/customer-api/api-reference/endpoints/customizations/update-capi-listing-customizations.md
