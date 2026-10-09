export function academicWorkDate(value: unknown) {
    const date = typeof value === 'string' || typeof value === 'number' || value instanceof Date ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime())) return { iso: undefined, label: 'Data não disponível' };
    return { iso: date.toISOString(), label: date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) };
}
