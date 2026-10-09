import { valorFatura, splitFaturaPorDia } from './analisev2-core.js';

// Only change the analysis basis. Never modify the cached invoices or guess a
// historical percentage: use the Airbnb fee recorded on each invoice.
export function applyAirbnbFeeMode(rows, includeFee = true) {
  if (includeFee) return rows;
  return rows.map(row => {
    const gross = valorFatura(row);
    const net = gross - (Number(row.taxaAirbnb) || 0);
    return {
      ...row,
      valorDistribuido: net,
      taxaAirbnb: 0,
      precoMedioNoite: typeof row.precoMedioNoite === 'number' && gross > 0
        ? row.precoMedioNoite * net / gross
        : row.precoMedioNoite
    };
  });
}

// Match the precise nightly entries used by the reservation detail, including
// nights that cross a month/year boundary. Do not retain the invoice check-in
// field here: the detail filters each night by its own date.
export function preciseAnalysisNights(rows) {
  return rows.flatMap(row => (splitFaturaPorDia(row) || []).map(slice => ({
    apartamento: String(row.apartamento),
    ano: slice.ano,
    mes: slice.mes,
    dia: slice.dia,
    valor: slice.valorDistribuido,
    weekday: new Date(slice.ano, slice.mes - 1, slice.dia).getDay(),
    preciseDate: true
  })));
}
