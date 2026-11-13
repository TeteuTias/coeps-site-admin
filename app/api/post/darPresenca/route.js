import { getSession, withApiAuthRequired } from "@/app/lib/auth0";
import { isAdminSub } from "@/app/lib/user/userPermissionsServerSide";
import { NextResponse } from "next/server"
import { connectToDatabase } from "@/app/lib/mongodb";
import { gravarPresenca, lerCorpo, lerPedidoPresenca } from "@/app/lib/presenca/registro-presenca";
import { anotarAuditoria } from "@/app/lib/auditoria/registro";


export const POST = withApiAuthRequired(async function POST(request) {
    const corpo = await lerCorpo(request)
    const lido = lerPedidoPresenca(corpo, false)
    if ("falha" in lido) return NextResponse.json(lido.falha.corpo, { status: lido.falha.status })

    try {
        const { db } = await connectToDatabase();
        // apenasInscrever: o admin inscreve sem dar presença (botão "Inscrever" da lista).
        const acao = corpo?.apenasInscrever === true ? "inscrever" : "dar"
        // Inscrever sem presença é ajuste manual do admin; as outras contas só dão presença (QR).
        if (acao === "inscrever") {
            const session = await getSession(request).catch(() => null)
            if (!isAdminSub(session?.user?.sub)) {
                return NextResponse.json({ error: "forbidden", message: "Somente o admin pode inscrever sem dar presença." }, { status: 403 })
            }
        }
        if (acao === "inscrever") {
            anotarAuditoria(request, { acao: "inscricao.admin", categoria: "inscricao", resumo: "Inscreveu o congressista no minicurso pelo Admin (sem presença)" })
        }
        const resposta = await gravarPresenca(db, "minicursos", acao, lido.pedido)
        return NextResponse.json(resposta.corpo, { status: resposta.status })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }
})
