import { ObjectId } from "mongodb";

// Campos que a tela de configuração pode alterar. Inscritos, presenças, contador e série
// pertencem ao servidor e nunca vêm do formulário.
const EDITORIAL_FIELDS = [
  "showToUser",
  "name",
  "description",
  "maxParticipants",
  "isFree",
  "isOpen",
  "type",
  "organization_name",
  "emoji",
  "value",
] as const;

// Horário de Brasília, o mesmo que o site público usa para exibir e comparar.
const EVENT_OFFSET = "-03:00";
// Aceita "AAAA-MM-DDTHH:mm" (datetime-local editado) e "AAAA-MM-DDTHH:mm:ss" (valor reaberto, com segundos).
const EVENT_DATE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/;

export class CourseValidationError extends Error {
  field: string;
  constructor(message: string, field: string) {
    super(message);
    this.field = field;
  }
}

export function formatEventDate(value: unknown, field: string): string {
  const match = typeof value === "string" ? EVENT_DATE.exec(value) : null;
  const formatted = match ? `${match[1]}:00${EVENT_OFFSET}` : null;
  if (!formatted || Number.isNaN(Date.parse(formatted))) {
    throw new CourseValidationError("Data inválida. Use o formato dia/mês/ano e hora.", field);
  }
  return formatted;
}

type TimelineItem = Record<string, unknown> & { _id?: unknown };

function buildTimeline(raw: unknown, previous: TimelineItem[] = []) {
  if (!Array.isArray(raw)) {
    throw new CourseValidationError("A programação da atividade é inválida.", "timeline");
  }
  // etapas antigas sem _id não casam com nada: sem isso todas herdariam a lista da última
  const byId = new Map(previous.filter((item) => item._id != null).map((item) => [String(item._id), item]));
  return raw.map((item: TimelineItem, index) => {
    if (!item || typeof item !== "object") {
      throw new CourseValidationError("A programação da atividade é inválida.", `timeline.${index}`);
    }
    const stored = item._id != null ? byId.get(String(item._id)) : undefined;
    return {
      ...item,
      date_init: formatEventDate(item.date_init, `timeline.${index}.date_init`),
      date_end: formatEventDate(item.date_end, `timeline.${index}.date_end`),
      // quem fala e quem passou pela etapa vêm do que está salvo, não do formulário
      speakers: stored?.speakers ?? [],
      presence_list: stored?.presence_list ?? [],
    };
  });
}

function pickEditorial(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const key of EDITORIAL_FIELDS) {
    // undefined viraria null no $set e apagaria o valor salvo
    if (data[key] !== undefined) fields[key] = data[key];
  }
  return fields;
}

export function buildCourseCreateDocument(data: Record<string, unknown>) {
  return {
    ...pickEditorial(data),
    participantsCount: 0,
    participants: [],
    attendanceList: [],
    timeline: buildTimeline(data.timeline),
    dateOpen: formatEventDate(data.dateOpen, "dateOpen"),
    _nSerie: new ObjectId().toString(),
  };
}

interface CourseCollection {
  findOne(filter: { _id: ObjectId }): Promise<{ timeline?: TimelineItem[] } | null>;
  updateOne(filter: { _id: ObjectId }, update: { $set: Record<string, unknown> }): Promise<{ matchedCount: number }>;
}

export type CourseUpdateResult =
  | { status: 200; message: string }
  | { status: 400 | 404; message: string; field?: string };

export async function updateCourseEditorial(
  collection: CourseCollection,
  data: Record<string, unknown>,
): Promise<CourseUpdateResult> {
  if (typeof data._id !== "string" || !ObjectId.isValid(data._id)) {
    return { status: 400, message: "Atividade inválida.", field: "_id" };
  }
  const filter = { _id: new ObjectId(data._id) };
  const current = await collection.findOne(filter);
  if (!current) return { status: 404, message: "Atividade não encontrada." };

  let $set: Record<string, unknown>;
  try {
    $set = {
      ...pickEditorial(data),
      timeline: buildTimeline(data.timeline, current.timeline),
      dateOpen: formatEventDate(data.dateOpen, "dateOpen"),
    };
  } catch (error) {
    if (error instanceof CourseValidationError) {
      return { status: 400, message: error.message, field: error.field };
    }
    throw error;
  }

  const { matchedCount } = await collection.updateOne(filter, { $set });
  if (matchedCount === 0) return { status: 404, message: "Atividade não encontrada." };
  return { status: 200, message: "Atividade atualizada com sucesso!" };
}
