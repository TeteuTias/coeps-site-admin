import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { connectToDatabase } from "@/app/lib/mongodb";
import { updateCourseEditorial } from "@/app/lib/minicursos/course-editorial";

export const PUT = withApiAuthRequired(async function PUT(request) {
    let data: Record<string, unknown>;
    try {
        data = await request.json();
    } catch {
        return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const { status, ...body } = await updateCourseEditorial(db.collection("minicursos"), data);
        return NextResponse.json(body, { status });
    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu Algum erro" }, { status: 500 })
    }
})
