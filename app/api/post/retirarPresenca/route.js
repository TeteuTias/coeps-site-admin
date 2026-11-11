import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { connectToDatabase } from "@/app/lib/mongodb";
import { gravarPresenca, lerCorpo, lerPedidoPresenca } from "@/app/lib/presenca/registro-presenca";


export const POST = withApiAuthRequired(async function POST(request) {
    const lido = lerPedidoPresenca(await lerCorpo(request), false)
    if ("falha" in lido) return NextResponse.json(lido.falha.corpo, { status: lido.falha.status })

    try {
        const { db } = await connectToDatabase();
        const resposta = await gravarPresenca(db, "minicursos", "retirar", lido.pedido)
        return NextResponse.json(resposta.corpo, { status: resposta.status })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }
})
