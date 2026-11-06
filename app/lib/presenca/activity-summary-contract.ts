import type { ICourse, ILecture } from "../types/events/event.t"

// Só _id e name são obrigatórios: documentos antigos podem não ter type/participants/maxParticipants
// e um único registro incompleto não pode derrubar a lista inteira.
export type RawActivity = Record<string, unknown> & { _id: string, name: string }

export const isRawActivity = (value: unknown): value is RawActivity => (
    typeof value === "object" && value !== null && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)._id === "string" &&
    typeof (value as Record<string, unknown>).name === "string"
)

// Infinity/NaN no Mongo viram null no JSON; sem número finito o limite é tratado como 0.
export const toCourseSummary = (raw: RawActivity): ICourse => ({
    ...raw,
    type: typeof raw.type === "string" ? raw.type : "",
    maxParticipants: typeof raw.maxParticipants === "number" && Number.isFinite(raw.maxParticipants) ? raw.maxParticipants : 0,
    participants: Array.isArray(raw.participants) ? raw.participants.map(String) : [],
} as unknown as ICourse)

export const toLectureSummary = (raw: RawActivity): ILecture => ({
    ...raw,
    type: typeof raw.type === "string" ? raw.type : "",
} as unknown as ILecture)
