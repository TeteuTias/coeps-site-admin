const DATE_FORMAT: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
};

export function academicWorkDate(value: unknown) {
    const date = typeof value === 'string' || typeof value === 'number' || value instanceof Date ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime())) return { iso: undefined, label: 'Data não disponível' };
    return { iso: date.toISOString(), label: date.toLocaleString('pt-BR', DATE_FORMAT) };
}
