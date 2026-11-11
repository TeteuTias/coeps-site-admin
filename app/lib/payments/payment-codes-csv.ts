export interface PaymentCodeCsvRow {
  codigo: string;
  tipo: string;
  perfilUtilizador?: string;
  percentualDesconto?: number;
  edicaoId: string;
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function buildPaymentCodesCsv(codes: PaymentCodeCsvRow[]) {
  const rows: unknown[][] = [
    ["Código", "Tipo", "Perfil", "Desconto (%)", "Edição"],
    ...codes.map((item) => [
      item.codigo,
      item.tipo,
      item.perfilUtilizador ?? "",
      item.percentualDesconto ?? "",
      item.edicaoId,
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(";")).join("\r\n")}`;
}
