// Gravação da presença (bip ou botão) nas listas da atividade.
// Cada chamada mexe só em um id, com $addToSet/$pull: dois leitores na mesma atividade nunca sobrescrevem
// o registro um do outro, e repetir o mesmo pedido (bip duplo ou reenvio da fila do aparelho) não duplica.
import { ObjectId } from "mongodb";
import type { Db, Document, PullOperator } from "mongodb";

export type Turno = "init" | "end";
export interface PedidoPresenca { eventId: string; userId: string; listType?: Turno }
export type Resposta = { status: number; corpo: Record<string, unknown> };

const HEX24 = /^[0-9a-f]{24}$/i;
const erro = (status: number, error: string, message: string): Resposta => ({ status, corpo: { error, message } });

/** Lê e valida o corpo do pedido. Na palestra, `listType` (entrada/saída) é obrigatório. */
export function lerPedidoPresenca(corpo: unknown, comTurno: boolean): { pedido: PedidoPresenca } | { falha: Resposta } {
    const c = typeof corpo === "object" && corpo !== null ? (corpo as Record<string, unknown>) : null;
    if (!c || typeof c.eventId !== "string" || !HEX24.test(c.eventId)) {
        return { falha: erro(400, "atividade_invalida", "O identificador da atividade é inválido.") };
    }
    if (typeof c.userId !== "string" || !HEX24.test(c.userId.trim())) {
        return { falha: erro(400, "credencial_invalida", "O código da credencial é inválido.") };
    }
    // os ids nas listas são o _id do usuário em texto (minúsculo); normaliza para não gravar o mesmo id duas vezes
    const pedido: PedidoPresenca = { eventId: c.eventId, userId: c.userId.trim().toLowerCase() };
    if (comTurno) {
        if (c.listType !== "init" && c.listType !== "end") {
            return { falha: erro(400, "turno_invalido", "Informe se a presença é de entrada ou de saída.") };
        }
        pedido.listType = c.listType;
    }
    return { pedido };
}

/** Lê o JSON do request sem estourar 500 em corpo malformado. */
export async function lerCorpo(request: Request): Promise<unknown> {
    try { return await request.json(); } catch { return null; }
}

function campoDaLista(colecao: "minicursos" | "palestras", turno?: Turno) {
    if (colecao === "minicursos") return "attendanceList";
    return turno === "end" ? "attendanceListEnd" : "attendanceListInit";
}

/**
 * Dá ou retira a presença. Responde `{ data: UpdateResult }` (a tela lê matchedCount/modifiedCount).
 * Dar presença exige que a credencial exista: um código qualquer de 24 caracteres não entra na lista.
 * No minicurso, dar presença também inscreve (regra que já existia).
 * "inscrever" (só minicurso) põe na lista de inscritos sem presença. O admin não passa pela trava de
 * horário, vagas nem pagamento do site: a tela só avisa.
 */
export async function gravarPresenca(
    db: Db,
    colecao: "minicursos" | "palestras",
    acao: "dar" | "retirar" | "inscrever",
    pedido: PedidoPresenca,
): Promise<Resposta> {
    const campo = campoDaLista(colecao, pedido.listType);
    if (acao === "inscrever" && colecao !== "minicursos") return erro(400, "sem_inscricao", "Palestra não tem inscrição.");
    if (acao === "dar" || acao === "inscrever") {
        const usuario = await db.collection("usuarios").findOne({ _id: new ObjectId(pedido.userId) }, { projection: { _id: 1 } });
        if (!usuario) return erro(404, "credencial_inexistente", "Não existe cadastro com este código de credencial.");
        const adicionar: Record<string, string> = acao === "inscrever" ? {} : { [campo]: pedido.userId };
        if (colecao === "minicursos") adicionar.participants = pedido.userId;
        const data = await db.collection(colecao).updateOne({ _id: new ObjectId(pedido.eventId) }, { $addToSet: adicionar });
        return { status: 200, corpo: { data } };
    }
    const data = await db.collection(colecao).updateOne({ _id: new ObjectId(pedido.eventId) }, { $pull: { [campo]: pedido.userId } as PullOperator<Document> });
    return { status: 200, corpo: { data } };
}
