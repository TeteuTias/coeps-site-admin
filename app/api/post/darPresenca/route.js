import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { connectToDatabase } from "@/app/lib/mongodb";
import { gravarPresenca, lerCorpo, lerPedidoPresenca } from "@/app/lib/presenca/registro-presenca";


export const POST = withApiAuthRequired(async function POST(request) {
    const corpo = await lerCorpo(request)
    const lido = lerPedidoPresenca(corpo, false)
    if ("falha" in lido) return NextResponse.json(lido.falha.corpo, { status: lido.falha.status })

    try {
        const { db } = await connectToDatabase();
        // apenasInscrever: o admin inscreve sem dar presença (botão "Inscrever" da lista).
        const acao = corpo?.apenasInscrever === true ? "inscrever" : "dar"
        const resposta = await gravarPresenca(db, "minicursos", acao, lido.pedido)
        return NextResponse.json(resposta.corpo, { status: resposta.status })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }
})
