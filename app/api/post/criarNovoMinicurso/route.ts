import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { connectToDatabase } from "@/app/lib/mongodb";
import { buildCourseCreateDocument, CourseValidationError } from "@/app/lib/minicursos/course-editorial";

export const POST = withApiAuthRequired(async function POST(request) {
    let document: ReturnType<typeof buildCourseCreateDocument>;
    try {
        document = buildCourseCreateDocument(await request.json());
    } catch (error) {
        if (error instanceof CourseValidationError) {
            return NextResponse.json({ message: error.message, field: error.field }, { status: 400 });
        }
        return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection("minicursos").insertOne(document);
        return NextResponse.json({ message: "Novo Minicurso criado com sucesso!" })
    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu Algum erro" }, { status: 500 })
    }
})
