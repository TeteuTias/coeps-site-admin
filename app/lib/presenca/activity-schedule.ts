export interface ActivitySchedule {
    // Texto de data e horário do primeiro item da timeline, ex.: "14/11 · 08:00–12:00".
    when: string
    // Local do primeiro item (local ou local_description); null quando não informado.
    where: string | null
    // Quantidade de horários além do primeiro.
    extra: number
}

const TIME_ZONE = "America/Sao_Paulo"

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" })
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

const PENDING_LABEL = "Data e horário a confirmar"

function toDate(value: unknown): Date | null {
    if (typeof value !== "string" && !(value instanceof Date)) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null
}

// Aceita documentos antigos: timeline pode faltar, não ser array ou ter itens inválidos.
export function formatActivitySchedule(timeline: unknown): ActivitySchedule {
    const items = Array.isArray(timeline)
        ? timeline.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        : []
    const first = items.find((item) => toDate(item.date_init) !== null)
    if (!first) {
        return { when: PENDING_LABEL, where: items.length ? text(items[0].local) ?? text(items[0].local_description) : null, extra: 0 }
    }

    const start = toDate(first.date_init) as Date
    const end = toDate(first.date_end)
    const day = dayFormatter.format(start)
    const startTime = timeFormatter.format(start)
    const when = end && end.getTime() >= start.getTime()
        ? `${day} · ${startTime}–${timeFormatter.format(end)}`
        : `${day} · ${startTime}`

    return {
        when,
        where: text(first.local) ?? text(first.local_description),
        extra: items.filter((item) => item !== first && toDate(item.date_init) !== null).length,
    }
}

export function formatExtraSchedules(extra: number): string {
    return extra === 1 ? "+ 1 outro horário" : `+ ${extra} outros horários`
}
