type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as UnknownRecord
        : null
}

export function parseDataObjectPayload(value: unknown): UnknownRecord | null {
    const payload = asRecord(value)
    return asRecord(payload?.data)
}

export function parseStringArrayDataPayload(value: unknown): string[] | null {
    const payload = asRecord(value)
    const data = payload?.data
    return Array.isArray(data) && data.every((item) => typeof item === "string")
        ? data
        : null
}

export function parseDataArrayPayload<T>(
    value: unknown,
    isItem: (item: unknown) => item is T,
): T[] | null {
    const payload = asRecord(value)
    const data = payload?.data
    return Array.isArray(data) && data.every(isItem) ? data : null
}
