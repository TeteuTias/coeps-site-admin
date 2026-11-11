import { getSession, withApiAuthRequired } from "@/app/lib/auth0"
import { connectToDatabase } from "@/app/lib/mongodb"
import {
    remoteFinancialReviewReason,
    remoteProofApprovalState,
} from "@/app/lib/users/admin-remote-work"
import { ObjectId, type Db } from "mongodb"

export const dynamic = "force-dynamic"

type ReviewStatus = "APPROVED" | "INCONSISTENT"

interface RemoteAccessAuditDocument {
    _id: ObjectId
    userId: ObjectId
    editionId: string
    status?: string
    reviewReason?: string
    purchaseId?: ObjectId
    confirmedAt?: Date
    proofReviewStatus?: ReviewStatus | "PENDING"
    proofReviewReason?: string
    financialReviewStatus?: "CLEAR" | "REVIEW_REQUIRED"
    financialReviewReason?: string
    proofAudit?: { status: ReviewStatus; reviewedAt: Date; reviewedBy: string }
    proofAuditHistory?: Array<{ status: ReviewStatus; reviewedAt: Date; reviewedBy: string }>
    updatedAt?: Date
}

export const PUT = withApiAuthRequired(async function PUT(
    request: Request,
    context: { params: Promise<{ userId: string }> },
) {
    const { userId } = await context.params
    if (!ObjectId.isValid(userId)) {
        return Response.json(
            { error: "invalid_user_id", message: "O identificador do usuário é inválido." },
            { status: 400 },
        )
    }

    const payload = await request.json().catch(() => null) as { status?: unknown } | null
    const status = payload?.status
    if (status !== "APPROVED" && status !== "INCONSISTENT") {
        return Response.json(
            { error: "invalid_review_status", message: "Selecione aprovado ou inconsistente." },
            { status: 400 },
        )
    }

    const editionId = String(process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID || "").trim().toUpperCase()
    if (!editionId) {
        return Response.json(
            { error: "active_edition_not_configured", message: "A edição ativa não está configurada no admin." },
            { status: 503 },
        )
    }

    const adminSession = await getSession(request)
    const reviewedBy = String(adminSession?.user?.sub || "unknown")
    const { client, db: untypedDb } = await connectToDatabase()
    const db = untypedDb as Db
    const mongoSession = client.startSession()
    try {
        const result = await mongoSession.withTransaction(async () => {
            const accessCollection = db.collection<RemoteAccessAuditDocument>("trabalhos_acessos_remotos")
            const access = await accessCollection.findOne(
                { userId: new ObjectId(userId), editionId },
                { sort: { updatedAt: -1 }, session: mongoSession },
            )
            if (!access) return null

            const now = new Date()
            const audit = { status: status as ReviewStatus, reviewedAt: now, reviewedBy }
            if (status === "INCONSISTENT") {
                const financialReason = remoteFinancialReviewReason(access)
                await accessCollection.updateOne(
                    { _id: access._id },
                    {
                        $set: {
                            proofReviewStatus: "INCONSISTENT",
                            status: "REVIEW_REQUIRED",
                            proofReviewReason: "PROOF_INCONSISTENT",
                            reviewReason: financialReason || "PROOF_INCONSISTENT",
                            proofAudit: audit,
                            updatedAt: now,
                        },
                        $push: { proofAuditHistory: audit },
                    },
                    { session: mongoSession },
                )
                await db.collection("Dados_do_trabalho").updateMany(
                    {
                        participationMode: "REMOTE",
                        remoteAccessId: access._id,
                        $or: [
                            { financialReviewStatus: { $ne: "REVIEW_REQUIRED" } },
                            { financialReviewReason: "PROOF_INCONSISTENT" },
                        ],
                    },
                    {
                        $set: {
                            financialReviewStatus: "REVIEW_REQUIRED",
                            financialReviewReason: "PROOF_INCONSISTENT",
                            updatedAt: now,
                        },
                    },
                    { session: mongoSession },
                )
            } else {
                const approvalState = remoteProofApprovalState(access)
                const financialReason = approvalState.financialReason
                await accessCollection.updateOne(
                    { _id: access._id },
                    {
                        $set: {
                            proofReviewStatus: "APPROVED",
                            proofAudit: audit,
                            status: approvalState.status,
                            ...(financialReason ? { reviewReason: financialReason } : {}),
                            updatedAt: now,
                        },
                        $push: { proofAuditHistory: audit },
                        $unset: {
                            proofReviewReason: "",
                            ...(!financialReason ? { reviewReason: "" } : {}),
                        },
                    },
                    { session: mongoSession },
                )
                await db.collection("Dados_do_trabalho").updateMany(
                    {
                        participationMode: "REMOTE",
                        remoteAccessId: access._id,
                        financialReviewReason: "PROOF_INCONSISTENT",
                    },
                    {
                        $set: { financialReviewStatus: "CLEAR", updatedAt: now },
                        $unset: { financialReviewReason: "" },
                    },
                    { session: mongoSession },
                )
            }
            return { accessId: String(access._id), status }
        })

        if (!result) {
            return Response.json(
                { error: "remote_access_not_found", message: "Acesso remoto não encontrado." },
                { status: 404 },
            )
        }
        return Response.json({ ok: true, ...result })
    } finally {
        await mongoSession.endSession()
    }
})
