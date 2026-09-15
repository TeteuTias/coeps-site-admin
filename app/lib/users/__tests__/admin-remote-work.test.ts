import assert from "node:assert/strict"
import test from "node:test"
import {
    buildAdminRemoteParticipation,
    normalizeAdminRemoteParticipation,
    participationModeLabel,
    remoteProofApprovalState,
} from "../admin-remote-work.ts"

const ACCESS = {
    _id: { toHexString: () => "66bbc8c2db29318201acc2b1" },
    editionId: "COEPS-2026",
    municipalityCode: "3103504",
    municipalityName: "Araguari",
    uf: "MG",
    status: "ACTIVE",
    proofReviewStatus: "PENDING",
    proof: {
        proofId: { toHexString: () => "66bbc8c2db29318201acc2b2" },
        objectKey: "private/must-not-leak.pdf",
        originalName: "conta.pdf",
        mimeType: "application/pdf",
        size: 1024,
        uploadedAt: new Date("2026-09-01T12:00:00.000Z"),
    },
    purchaseId: { toHexString: () => "66bbc8c2db29318201acc2b3" },
    confirmedAt: new Date("2026-09-02T12:00:00.000Z"),
}

test("classifica regular, somente remoto, combinado e sem acesso", () => {
    assert.equal(buildAdminRemoteParticipation({ pagamento: { situacao: 1 } }, null).mode, "REGULAR")
    assert.equal(buildAdminRemoteParticipation({ pagamento: { situacao: 0 } }, ACCESS).mode, "REMOTE")
    assert.equal(buildAdminRemoteParticipation({ pagamento: { situacao: 1 } }, ACCESS).mode, "BOTH")
    assert.equal(buildAdminRemoteParticipation({}, null).mode, "NONE")
    assert.equal(participationModeLabel("BOTH"), "Regular + remoto")
})

test("expõe metadados seguros e nunca a chave privada do comprovante", () => {
    const participation = buildAdminRemoteParticipation(
        { pagamento: { situacao: 1 } },
        ACCESS,
        2,
        [{
            _id: "work-1",
            titulo: "Trabalho remoto",
            status: "Em Avaliação",
            dataSubmissao: new Date("2026-09-03T12:00:00.000Z"),
        }],
    )
    assert.equal(participation.remoteWorkCount, 2)
    assert.equal(participation.works[0]?.title, "Trabalho remoto")
    assert.equal(participation.proof?.uploadedAt, "2026-09-01T12:00:00.000Z")
    assert.doesNotMatch(JSON.stringify(participation), /objectKey|must-not-leak/)
})

test("normalização defensiva tolera payload remoto parcial", () => {
    const normalized = normalizeAdminRemoteParticipation({
        mode: "REMOTE",
        proof: { id: "proof-1", size: Number.NaN },
        works: [{ id: "work-1" }, null, {}],
    })
    assert.equal(normalized.mode, "REMOTE")
    assert.equal(normalized.proof?.size, 0)
    assert.equal(normalized.works.length, 1)
    assert.equal(normalized.works[0]?.title, "Trabalho sem título")
})

test("aprovar o comprovante nunca remove um bloqueio financeiro", () => {
    assert.deepEqual(
        remoteProofApprovalState({
            confirmedAt: new Date("2026-09-10T12:00:00.000Z"),
            financialReviewStatus: "REVIEW_REQUIRED",
            financialReviewReason: "PAYMENT_REFUND:PAYMENT_REFUNDED",
            reviewReason: "PROOF_INCONSISTENT",
        }),
        {
            status: "REVIEW_REQUIRED",
            financialReason: "PAYMENT_REFUND:PAYMENT_REFUNDED",
        },
    )
    assert.deepEqual(
        remoteProofApprovalState({ confirmedAt: new Date("2026-09-10T12:00:00.000Z"), reviewReason: "PROOF_INCONSISTENT" }),
        { status: "ACTIVE", financialReason: null },
    )
})
