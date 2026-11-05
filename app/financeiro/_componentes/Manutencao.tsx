"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, UserX } from "lucide-react";
import { Aviso, Botao } from "@/app/components/ui";
import { useAvisos } from "@/app/components/Avisos";
import { enviar, relatarFalha } from "./util";

/** Ações coletivas e irreversíveis, fora da rotina de atendimento: recolhida por padrão e visualmente separada. */
export function Manutencao({ aoRemoverTodas }: { aoRemoverTodas: () => void }) {
  const { avisar, confirmar } = useAvisos();
  const [aberta, setAberta] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const idTitulo = useId();
  const idCorpo = useId();

  async function removerTodas() {
    const ok = await confirmar({
      titulo: "Remover TODAS as inscrições?",
      descricao: (
        <>
          Isto redefine os indicadores de pagamento (situação, forma de pagamento e animação, campos legados) de <strong>todos</strong> os usuários cadastrados,
          sem filtro de edição, e não só dos que aparecem na lista. Compras e registros de pagamento não são apagados, mas as pessoas deixam de constar como inscritas.
          Não há botão de desfazer: só um backup do banco recupera o estado anterior.
        </>
      ),
      perigo: true,
      digitar: "REMOVER TODAS",
      rotuloConfirmar: "Remover todas as inscrições",
    });
    if (!ok) return;
    setRemovendo(true);
    try {
      const r = await enviar("/api/delete/pagamentos/removerInscricao/ALL", { method: "DELETE" }, "Não foi possível remover as inscrições.");
      if (r.tipo === "semResposta") {
        avisar("erro", "Sem resposta do servidor", "Confira o estado da lista de inscritos antes de repetir: a operação pode ter sido aplicada em parte ou por inteiro.");
        return;
      }
      if (relatarFalha(avisar, r, "Inscrições não removidas")) return;
      aoRemoverTodas();
      avisar("ok", "Todas as inscrições foram removidas");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <section id="manutencao" aria-labelledby={idTitulo} className="scroll-mt-4 rounded-2xl border-2 border-dashed border-erro/40 bg-cartao p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={idTitulo} className="titulo text-xl leading-snug text-erro">Manutenção</h2>
          <p className="mt-0.5 text-sm text-sutil">Operações coletivas e irreversíveis. Não fazem parte da rotina de atendimento.</p>
        </div>
        <Botao estilo="contorno" tamanho="pequeno" aria-expanded={aberta} aria-controls={idCorpo} onClick={() => setAberta((v) => !v)}>
          {aberta ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          {aberta ? "Ocultar manutenção" : "Mostrar manutenção"}
        </Botao>
      </div>

      <div id={idCorpo} hidden={!aberta}>
        <div className="mt-4 grid gap-4">
        <Aviso tom="erro" titulo="Cuidado: estas ações afetam muitas pessoas de uma vez">
          Faça backup do banco antes e confirme com quem responde pelo financeiro.
        </Aviso>

        <div className="grid gap-3 rounded-xl border border-erro/30 p-4">
          <h3 className="text-base font-semibold">Remover todas as inscrições</h3>
          <p className="text-sm text-sutil">
            Redefine os indicadores de pagamento de <strong>todos</strong> os usuários (campos legados), sem filtro de edição. Para remover só uma pessoa, use a lista de inscritos.
          </p>
          <div>
            <Botao estilo="perigoSolido" carregando={removendo} onClick={() => void removerTodas()}>
              <UserX className="size-4" aria-hidden="true" />Remover todas as inscrições
            </Botao>
          </div>
        </div>

        <p className="text-sm text-sutil">
          A limpeza anual do histórico financeiro, com prévia e confirmação digitada, fica na página de{" "}
          <Link href="/financeiro/codigos" className="font-medium text-tinta underline">códigos de desconto e rastreio</Link>.
        </p>
        </div>
      </div>
    </section>
  );
}
