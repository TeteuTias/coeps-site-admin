"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Aviso, Botao } from "@/app/components/ui";
import { useAvisos } from "@/app/components/Avisos";
import { CHAVE_ARMAZENAMENTO } from "./fila-presenca";
import type { Pendente } from "./fila-presenca";
import { EVENTO_FILA, enviarPendentes, lerPendentes, sinalizar } from "./presenca-bip";

const REENVIO_MS = 15000;

/**
 * Presenças guardadas no aparelho: reenvia ao abrir a tela, quando a internet volta e a cada 15 s,
 * e pede confirmação para fechar/recarregar a aba enquanto houver pendência.
 */
export function usePendentesPresenca(eventId: string, aoEntregar: () => void) {
  const { avisar } = useAvisos();
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const aoEntregarRef = useRef(aoEntregar);
  useEffect(() => { aoEntregarRef.current = aoEntregar; });

  const enviarAgora = useCallback(async () => {
    const { entregues, recusados } = await enviarPendentes();
    setPendentes(lerPendentes());
    if (recusados.length) { sinalizar("erro"); avisar("erro", "Presença guardada não foi registrada", recusados.join("\n")); }
    if (entregues.some((p) => p.eventId === eventId)) aoEntregarRef.current();
  }, [eventId, avisar]);

  useEffect(() => {
    setPendentes(lerPendentes());
    void enviarAgora();
    const atualizar = () => setPendentes(lerPendentes());
    const aoVoltar = () => { void enviarAgora(); };
    const outraAba = (e: StorageEvent) => { if (e.key === CHAVE_ARMAZENAMENTO) atualizar(); };
    const relogio = setInterval(() => { if (lerPendentes().length) void enviarAgora(); }, REENVIO_MS);
    window.addEventListener(EVENTO_FILA, atualizar);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("storage", outraAba);
    return () => {
      clearInterval(relogio);
      window.removeEventListener(EVENTO_FILA, atualizar);
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("storage", outraAba);
    };
  }, [enviarAgora]);

  const temPendente = pendentes.length > 0;
  useEffect(() => {
    if (!temPendente) return;
    const segurar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [temPendente]);

  return { pendentes, enviarAgora };
}

/** Aviso fixo com o total guardado no aparelho (todas as atividades) e os nomes desta atividade. */
export function AvisoPendentes({ pendentes, eventId, enviarAgora }: { pendentes: Pendente[]; eventId: string; enviarAgora: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false);
  if (!pendentes.length) return null;
  const aqui = pendentes.filter((p) => p.eventId === eventId);
  const n = pendentes.length;
  const nomes = aqui.slice(0, 8).map((p) => `${p.nome || p.userId}${p.quer === "retirar" ? " (retirar)" : ""}${p.turno ? ` · ${p.turno === "end" ? "saída" : "entrada"}` : ""}`).join(", ");
  return (
    <Aviso tom="alerta" titulo={`${n} ${n === 1 ? "presença guardada" : "presenças guardadas"} neste aparelho, aguardando internet`}>
      <p>
        Já estão salvas aqui e são enviadas sozinhas quando a conexão voltar. Mantenha esta página aberta e não limpe os dados do navegador.
        {aqui.length > 0 && ` Desta atividade: ${nomes}${aqui.length > 8 ? ` e mais ${aqui.length - 8}` : ""}.`}
        {aqui.length < n && ` ${n - aqui.length} de outra atividade.`}
      </p>
      <div className="mt-2">
        <Botao estilo="contorno" tamanho="pequeno" carregando={enviando} onClick={async () => { setEnviando(true); try { await enviarAgora(); } finally { setEnviando(false); } }}>
          Enviar agora
        </Botao>
      </div>
    </Aviso>
  );
}
