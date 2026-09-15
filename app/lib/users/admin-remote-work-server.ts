import type { Db, Document, ObjectId } from "mongodb"
import {
    type AdminRemoteParticipation,
    buildAdminRemoteParticipation,
} from "./admin-remote-work"

const REMOTE_ACCESS_COLLECTION = "trabalhos_acessos_remotos"
const WORKS_COLLECTION = "Dados_do_trabalho"

function currentEditionId(): string | null {
    const value = process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID
    const normalized = String(value || "").trim().toUpperCase()
    return normalized || null
}

function idKey(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (!value || typeof value !== "object" || !("toHexString" in value)) return null
    try {
        const result = (value as { toHexString: () => unknown }).toHexString()
        return typeof result === "string" && result ? result : null
    } catch {
        return null
    }
}

function userIdOf(user: Document): ObjectId | null {
    const value = user._id
    return value && typeof value === "object" && "toHexString" in value
        ? value as ObjectId
        : null
}

export async function loadAdminRemoteParticipationMap(
    db: Db,
    users: Document[],
): Promise<Map<string, AdminRemoteParticipation>> {
    const userIds = users.map(userIdOf).filter((id): id is ObjectId => id !== null)
    const editionId = currentEditionId()
    if (!editionId) {
        return new Map(users.map(user => [
            idKey(user._id) ?? "",
            buildAdminRemoteParticipation(user, null),
        ]))
    }
    const accesses = userIds.length
        ? await db.collection(REMOTE_ACCESS_COLLECTION).find(
            {
                userId: { $in: userIds },
                editionId,
            },
            {
                projection: {
                    userId: 1,
                    editionId: 1,
                    municipalityCode: 1,
                    municipalityName: 1,
                    uf: 1,
                    proof: 1,
                    proofReviewStatus: 1,
                    status: 1,
                    purchaseId: 1,
                    confirmedAt: 1,
                    reviewReason: 1,
                    proofReviewReason: 1,
                    financialReviewStatus: 1,
                    financialReviewReason: 1,
                    updatedAt: 1,
                },
                sort: { updatedAt: -1 },
            },
        ).toArray()
        : []

    const accessByUser = new Map<string, Document>()
    for (const access of accesses) {
        const key = idKey(access.userId)
        if (key && !accessByUser.has(key)) accessByUser.set(key, access)
    }

    const accessIds = [...accessByUser.values()]
        .map(access => access._id)
        .filter(Boolean)
    const works = accessIds.length
        ? await db.collection(WORKS_COLLECTION).find(
            { participationMode: "REMOTE", remoteAccessId: { $in: accessIds } },
            { projection: { remoteAccessId: 1 } },
        ).toArray()
        : []
    const workCountByAccess = new Map<string, number>()
    for (const work of works) {
        const key = idKey(work.remoteAccessId)
        if (key) workCountByAccess.set(key, (workCountByAccess.get(key) ?? 0) + 1)
    }

    return new Map(users.map(user => {
        const key = idKey(user._id) ?? ""
        const access = accessByUser.get(key) ?? null
        const accessId = idKey(access?._id)
        return [
            key,
            buildAdminRemoteParticipation(user, access, accessId ? workCountByAccess.get(accessId) ?? 0 : 0),
        ]
    }))
}

export async function loadAdminRemoteParticipation(
    db: Db,
    user: Document,
    userId: ObjectId,
): Promise<AdminRemoteParticipation> {
    const editionId = currentEditionId()
    if (!editionId) return buildAdminRemoteParticipation(user, null)
    const access = await db.collection(REMOTE_ACCESS_COLLECTION).findOne(
        { userId, editionId },
        {
            projection: {
                userId: 1,
                editionId: 1,
                municipalityCode: 1,
                municipalityName: 1,
                uf: 1,
                proof: 1,
                proofReviewStatus: 1,
                status: 1,
                purchaseId: 1,
                confirmedAt: 1,
                reviewReason: 1,
                proofReviewReason: 1,
                financialReviewStatus: 1,
                financialReviewReason: 1,
                updatedAt: 1,
            },
            sort: { updatedAt: -1 },
        },
    )
    const works = access?._id
        ? await db.collection(WORKS_COLLECTION).find(
            { participationMode: "REMOTE", remoteAccessId: access._id },
            {
                projection: {
                    titulo: 1,
                    status: 1,
                    financialReviewStatus: 1,
                    dataSubmissao: 1,
                },
                sort: { dataSubmissao: -1 },
            },
        ).toArray()
        : []
    return buildAdminRemoteParticipation(user, access, works.length, works)
}
