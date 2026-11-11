type UnknownRecord = Record<string, unknown>

export type AdminParticipationMode = "REGULAR" | "REMOTE" | "BOTH" | "NONE"
export type AdminRemoteAccessStatus =
    | "ELIGIBLE"
    | "PAYMENT_PENDING"
    | "ACTIVE"
    | "REVIEW_REQUIRED"
    | "REVOKED"

export type AdminRemoteProofReviewStatus = "PENDING" | "APPROVED" | "INCONSISTENT"

export interface AdminRemoteProof {
    id: string
    originalName: string
    mimeType: string
    size: number
    uploadedAt: string | null
}

export interface AdminRemoteWorkSummary {
    id: string
    title: string
    status: string | null
    financialReviewStatus: string | null
    submittedAt: string | null
}

export interface AdminRemoteParticipation {
    mode: AdminParticipationMode
    regularConfirmed: boolean
    remoteConfirmed: boolean
    editionId: string | null
    accessId: string | null
    status: AdminRemoteAccessStatus | null
    reviewStatus: AdminRemoteProofReviewStatus | null
    reviewReason: string | null
    municipalityCode: string | null
    municipalityName: string | null
    uf: string | null
    proof: AdminRemoteProof | null
    purchaseId: string | null
    confirmedAt: string | null
    remoteWorkCount: number
    works: AdminRemoteWorkSummary[]
}

function asRecord(value: unknown): UnknownRecord | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as UnknownRecord
        : null
}

function stringOrNull(value: unknown): string | null {
    if (typeof value === "string") {
        const normalized = value.trim()
        return normalized || null
    }
    const candidate = asRecord(value)
    if (!candidate || typeof candidate.toHexString !== "function") return null
    try {
        const normalized = candidate.toHexString()
        return typeof normalized === "string" && normalized ? normalized : null
    } catch {
        return null
    }
}

function dateToIso(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function accessStatus(value: unknown): AdminRemoteAccessStatus | null {
    return ["ELIGIBLE", "PAYMENT_PENDING", "ACTIVE", "REVIEW_REQUIRED", "REVOKED"].includes(String(value))
        ? value as AdminRemoteAccessStatus
        : null
}

function reviewStatus(value: unknown): AdminRemoteProofReviewStatus | null {
    return ["PENDING", "APPROVED", "INCONSISTENT"].includes(String(value))
        ? value as AdminRemoteProofReviewStatus
        : null
}

function normalizedProof(value: unknown): AdminRemoteProof | null {
    const proof = asRecord(value)
    const id = stringOrNull(proof?.proofId)
    if (!proof || !id) return null
    return {
        id,
        originalName: stringOrNull(proof.originalName) ?? "comprovante",
        mimeType: stringOrNull(proof.mimeType) ?? "application/octet-stream",
        size: typeof proof.size === "number" && Number.isFinite(proof.size) ? proof.size : 0,
        uploadedAt: dateToIso(proof.uploadedAt),
    }
}

function normalizedWork(value: unknown): AdminRemoteWorkSummary | null {
    const work = asRecord(value)
    const id = stringOrNull(work?._id) ?? stringOrNull(work?.id)
    if (!work || !id) return null
    return {
        id,
        title: stringOrNull(work.titulo) ?? stringOrNull(work.title) ?? "Trabalho sem título",
        status: stringOrNull(work.status),
        financialReviewStatus: stringOrNull(work.financialReviewStatus),
        submittedAt: dateToIso(work.dataSubmissao ?? work.submittedAt),
    }
}

export function participationModeLabel(mode: AdminParticipationMode): string {
    switch (mode) {
        case "REGULAR": return "Regular"
        case "REMOTE": return "Somente remoto"
        case "BOTH": return "Regular + remoto"
        default: return "Sem acesso"
    }
}

export function remoteFinancialReviewReason(value: unknown): string | null {
    const access = asRecord(value)
    return stringOrNull(access?.financialReviewReason) ?? (
        stringOrNull(access?.reviewReason) === "PROOF_INCONSISTENT"
            ? null
            : stringOrNull(access?.reviewReason)
    )
}

export function remoteProofApprovalState(value: unknown): {
    status: "ACTIVE" | "PAYMENT_PENDING" | "ELIGIBLE" | "REVIEW_REQUIRED"
    financialReason: string | null
} {
    const access = asRecord(value)
    const financialReason = remoteFinancialReviewReason(access)
    const hasFinancialBlock = access?.financialReviewStatus === "REVIEW_REQUIRED" || Boolean(financialReason)
    if (hasFinancialBlock) return { status: "REVIEW_REQUIRED", financialReason }
    if (dateToIso(access?.confirmedAt)) return { status: "ACTIVE", financialReason: null }
    if (stringOrNull(access?.purchaseId)) return { status: "PAYMENT_PENDING", financialReason: null }
    return { status: "ELIGIBLE", financialReason: null }
}

export function buildAdminRemoteParticipation(
    user: unknown,
    access: unknown,
    remoteWorkCount = 0,
    rawWorks: unknown[] = [],
): AdminRemoteParticipation {
    const userRecord = asRecord(user)
    const payment = asRecord(userRecord?.pagamento)
    const accessRecord = asRecord(access)
    const regularConfirmed = payment?.situacao === 1
    const purchaseId = stringOrNull(accessRecord?.purchaseId)
    const confirmedAt = dateToIso(accessRecord?.confirmedAt)
    const remoteConfirmed = Boolean(confirmedAt)
    const mode: AdminParticipationMode = regularConfirmed
        ? remoteConfirmed ? "BOTH" : "REGULAR"
        : remoteConfirmed ? "REMOTE" : "NONE"
    const works = rawWorks
        .map(normalizedWork)
        .filter((work): work is AdminRemoteWorkSummary => work !== null)

    return {
        mode,
        regularConfirmed,
        remoteConfirmed,
        editionId: stringOrNull(accessRecord?.editionId),
        accessId: stringOrNull(accessRecord?._id),
        status: accessStatus(accessRecord?.status),
        reviewStatus: reviewStatus(accessRecord?.proofReviewStatus),
        reviewReason: stringOrNull(accessRecord?.financialReviewReason) ??
            stringOrNull(accessRecord?.proofReviewReason) ??
            stringOrNull(accessRecord?.reviewReason),
        municipalityCode: stringOrNull(accessRecord?.municipalityCode),
        municipalityName: stringOrNull(accessRecord?.municipalityName),
        uf: stringOrNull(accessRecord?.uf),
        proof: normalizedProof(accessRecord?.proof),
        purchaseId,
        confirmedAt,
        remoteWorkCount: Math.max(0, Number.isFinite(remoteWorkCount) ? Math.trunc(remoteWorkCount) : 0),
        works,
    }
}

export function normalizeAdminRemoteParticipation(value: unknown): AdminRemoteParticipation {
    const participation = asRecord(value)
    const mode = ["REGULAR", "REMOTE", "BOTH", "NONE"].includes(String(participation?.mode))
        ? participation?.mode as AdminParticipationMode
        : "NONE"
    const proof = asRecord(participation?.proof)
    const proofId = stringOrNull(proof?.id)
    const rawWorks = Array.isArray(participation?.works) ? participation.works : []
    return {
        mode,
        regularConfirmed: participation?.regularConfirmed === true,
        remoteConfirmed: participation?.remoteConfirmed === true,
        editionId: stringOrNull(participation?.editionId),
        accessId: stringOrNull(participation?.accessId),
        status: accessStatus(participation?.status),
        reviewStatus: reviewStatus(participation?.reviewStatus),
        reviewReason: stringOrNull(participation?.reviewReason),
        municipalityCode: stringOrNull(participation?.municipalityCode),
        municipalityName: stringOrNull(participation?.municipalityName),
        uf: stringOrNull(participation?.uf),
        proof: proof && proofId ? {
            id: proofId,
            originalName: stringOrNull(proof.originalName) ?? "comprovante",
            mimeType: stringOrNull(proof.mimeType) ?? "application/octet-stream",
            size: typeof proof.size === "number" && Number.isFinite(proof.size) ? proof.size : 0,
            uploadedAt: dateToIso(proof.uploadedAt),
        } : null,
        purchaseId: stringOrNull(participation?.purchaseId),
        confirmedAt: dateToIso(participation?.confirmedAt),
        remoteWorkCount: typeof participation?.remoteWorkCount === "number" && Number.isFinite(participation.remoteWorkCount)
            ? Math.max(0, Math.trunc(participation.remoteWorkCount))
            : 0,
        works: rawWorks.map(normalizedWork).filter((work): work is AdminRemoteWorkSummary => work !== null),
    }
}
