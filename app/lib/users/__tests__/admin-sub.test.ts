import assert from "node:assert/strict"
import test from "node:test"
import checkUserPermission, { isAdminSub } from "../../user/userPermissionsServerSide.ts"

const ADMIN = "6a8799078ecd649be9bdb061"
const OUTRAS = ["6a87991a310d49dafb8d113b", "6a8799158b3fe756dd02f487", "6a87990e9d8d0385e0a77083"]

test("só a conta de admin faz ajustes manuais (inscrever sem presença)", () => {
    assert.equal(isAdminSub(`auth0|${ADMIN}`), true)
    assert.equal(isAdminSub(ADMIN), true)
    for (const conta of OUTRAS) assert.equal(isAdminSub(`auth0|${conta}`), false)
    assert.equal(isAdminSub(undefined), false)
    assert.equal(isAdminSub(`auth0|${ADMIN}x`), false)
})

test("as outras contas continuam dando e retirando presença (QR Code)", async () => {
    for (const conta of OUTRAS) {
        for (const rota of ["/api/post/darPresenca", "/api/post/retirarPresenca"]) {
            assert.equal(await checkUserPermission(new URL(`https://admin.test${rota}`), "api", conta), true)
        }
    }
})

test("só o admin remove inscrição de minicurso", async () => {
    const rota = new URL("https://admin.test/api/delete/removerInscricaoMinicurso/")
    assert.equal(await checkUserPermission(rota, "api", ADMIN), true)
    for (const conta of OUTRAS) assert.equal(await checkUserPermission(rota, "api", conta), false)
})
