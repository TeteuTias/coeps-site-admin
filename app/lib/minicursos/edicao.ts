// Campos que a tela "Configurar atividade" pode alterar num minicurso.
// Inscritos (participants), contagem, presença (attendanceList), cancelamentos e o _nSerie
// NÃO entram aqui: até 11/2026 esta rota gravava participants: [] e attendanceList: [] a cada
// edição, e qualquer ajuste de horário ou descrição tirava todo mundo do minicurso (inclusive quem pagou).

export interface TimelineEntrada {
    date_init: string;
    date_end: string;
    [campo: string]: unknown;
}

export interface EdicaoMinicurso {
    showToUser: unknown;
    name: unknown;
    description: unknown;
    maxParticipants: unknown;
    isFree: unknown;
    timeline: TimelineEntrada[];
    isOpen: unknown;
    dateOpen: string;
    type: unknown;
    organization_name: unknown;
    emoji: unknown;
    value: unknown;
}

/** "YYYY-MM-DDTHH:mm(:ss)" vindo do formulário → "YYYY-MM-DDTHH:mm:00-03:00". */
export function formatarDataComFuso(dataOriginal: string): string {
    if (typeof dataOriginal !== "string") throw new Error("Formato de data inválido. Use 'YYYY-MM-DDTHH:mm'.");
    const base = dataOriginal.slice(0, -3);
    if (base.length !== 16 || base[10] !== "T") {
        throw new Error("Formato de data inválido. Use 'YYYY-MM-DDTHH:mm'.");
    }
    return `${base}:00-03:00`;
}

/** Monta o $set da edição só com os campos editáveis. */
export function camposEditaveisMinicurso(data: Record<string, any>): EdicaoMinicurso {
    const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
    return {
        showToUser: data.showToUser,
        name: data.name,
        description: data.description,
        maxParticipants: data.maxParticipants,
        isFree: data.isFree,
        timeline: timeline.map((element: TimelineEntrada) => ({
            ...element,
            date_init: formatarDataComFuso(element.date_init),
            date_end: formatarDataComFuso(element.date_end),
        })),
        isOpen: data.isOpen,
        dateOpen: formatarDataComFuso(data.dateOpen),
        type: data.type,
        organization_name: data.organization_name,
        emoji: data.emoji,
        value: data.value,
    };
}
