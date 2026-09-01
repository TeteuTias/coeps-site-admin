import assert from "node:assert/strict"
import test from "node:test"
import {
    parseAdminPaymentConfigHttpResponse,
    parseAdminPaymentConfigPayload,
} from "../payment-config-contract.ts"

const VALID_CONFIG = {
    _id: "66bcfceedc9c7250e85b2ac6",
    nome: "Lote CIEPS",
    valorAVista: 100,
    valorBoleto: 95,
    valorDebito: 90,
    valorPix: 85,
    parcelamentos: [
        { codigo: 1, totalParcelas: 2, valorCadaParcela: 50 },
    ],
    pagamentosAceitos: ["PIX", "CREDIT_CARD"],
}

test("aceita configuração financeira válida e normaliza campos opcionais", () => {
    const config = parseAdminPaymentConfigPayload(VALID_CONFIG)
    assert.ok(config)
    assert.equal(config.nome, "Lote CIEPS")
    assert.deepEqual(config.pagamentosAceitos, ["PIX", "CREDIT_CARD"])
    assert.equal(config.dataInit, "")
})

test("rejeita corpo de erro e envelopes com arrays ou números inválidos", () => {
    assert.equal(parseAdminPaymentConfigHttpResponse(false, VALID_CONFIG), null)
    assert.equal(parseAdminPaymentConfigPayload({ message: "erro" }), null)
    assert.equal(parseAdminPaymentConfigPayload({ ...VALID_CONFIG, parcelamentos: {} }), null)
    assert.equal(parseAdminPaymentConfigPayload({ ...VALID_CONFIG, pagamentosAceitos: "PIX" }), null)
    assert.equal(parseAdminPaymentConfigPayload({ ...VALID_CONFIG, valorPix: "85" }), null)
    assert.equal(parseAdminPaymentConfigPayload({
        ...VALID_CONFIG,
        parcelamentos: [{ codigo: 1, totalParcelas: 2, valorCadaParcela: undefined }],
    }), null)
})
