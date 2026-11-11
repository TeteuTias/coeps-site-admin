"use client";

import { useRef, useState } from "react";
import { useAvisos } from "@/app/components/Avisos";
import { displayUserName } from "@/app/lib/users/admin-user-contract";
import type { AdminUserSummary } from "@/app/lib/users/admin-user-contract";
import { interpretarEscrita } from "./chamada";
import type { Efeito } from "./chamada";

export type Quer = "dar" | "retirar" | "desinscrever";
export type Turno = "init" | "end";
export type Desfecho = "registrado" | "jaEstava" | "falha" | "semResposta" | "ocupado";

export interface PedidoAcao {
  pessoa: AdminUserSummary;
  quer: Quer;
  /** Só na palestra: em qual lista (entrada ou saída) a ação vale. */
  turno?: Turno;
  /** Só no minicurso: a pessoa não estava inscrita e dar presença também a inscreve. */
  inscreveJunto?: boolean;
}
export interface EstadoPessoa { presente: boolean; inscrito: boolean }
export interface Recente { id: string; nome: string; detalhe: string; quando: Date }

const rotuloTurno = (t?: Turno) => (t === "init" ? "entrada" : t === "end" ? "saída" : "");

/**
 * Uma ação de presença por pessoa, sem recarregar a lista: manda, lê o que a rota fez de verdade (ver `interpretarEscrita`),
 * atualiza só essa pessoa e avisa o resultado. Rede perdida vira "confira antes de repetir", nunca silêncio.
 */
export function useAcoesChamada({ enviar, aplicar, reconsultar }: {
  enviar: (p: PedidoAcao) => Promise<Response>;
  /** Grava na tela o estado novo dessa pessoa. */
  aplicar: (p: PedidoAcao) => void;
  /** Lê de novo o estado da pessoa no servidor (e o grava na tela). `null` = não foi possível. */
  reconsultar: (p: { pessoa: AdminUserSummary; turno?: Turno }) => Promise<EstadoPessoa | null>;
}) {
  const { avisar } = useAvisos();
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set());
  const [incertos, setIncertos] = useState<ReadonlySet<string>>(new Set());
  const [recentes, setRecentes] = useState<Recente[]>([]);
  const emVoo = useRef(new Set<string>());

  const marcarIncerto = (id: string, sim: boolean) => setIncertos((s) => {
    const n = new Set(s);
    if (sim) n.add(id); else n.delete(id);
    return n;
  });

  async function executar(p: PedidoAcao): Promise<Desfecho> {
    const { pessoa, quer, turno } = p;
    const id = pessoa._id;
    if (emVoo.current.has(id)) return "ocupado";
    emVoo.current.add(id);
    setOcupados(new Set(emVoo.current));
    const nome = displayUserName(pessoa);
    const aoTurno = turno ? ` (${rotuloTurno(turno)})` : "";
    const foco = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    try {
      let efeito: Efeito;
      let pagamentoMantido = false;
      try {
        const res = await enviar(p);
        const corpo: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          // a rota explica a recusa (ex.: etapa de pacote, Asaas indisponível): mostra a mensagem dela
          const motivo = typeof (corpo as { message?: unknown } | null)?.message === "string" ? (corpo as { message: string }).message : "";
          avisar("erro", "Não foi possível concluir", res.status === 401
            ? "Sua sessão expirou. Entre de novo e confira a lista antes de repetir."
            : motivo ? `${nome}: ${motivo} Nada foi alterado.` : `${nome}: o servidor recusou a operação (código ${res.status}). Nada foi confirmado; confira a pessoa na lista.`);
          return "falha";
        }
        efeito = interpretarEscrita(corpo);
        pagamentoMantido = (corpo as { pagamentoMantido?: unknown } | null)?.pagamentoMantido === true;
      } catch {
        marcarIncerto(id, true);
        avisar("erro", "Sem resposta do servidor", `${nome}: confira a situação da pessoa antes de repetir a ação.`);
        return "semResposta";
      }

      if (efeito === "alvoInexistente") {
        avisar("erro", "Atividade não encontrada", "O servidor não achou esta atividade e nada foi alterado. Recarregue a página.");
        return "falha";
      }

      if (efeito === "duvidoso") {
        const estado = await reconsultar({ pessoa, turno }).catch(() => null);
        if (!estado) {
          marcarIncerto(id, true);
          avisar("alerta", "Resposta sem confirmação", `${nome}: o servidor não informou o que mudou. Confira a pessoa antes de repetir.`);
          return "semResposta";
        }
        const confere = quer === "dar" ? estado.presente : quer === "retirar" ? !estado.presente : !estado.inscrito;
        if (!confere) {
          avisar("erro", "A ação não foi aplicada", `${nome}: a conferência mostrou que nada mudou.`);
          return "falha";
        }
        efeito = "aplicado";
      }

      aplicar(p);
      marcarIncerto(id, false);

      if (quer === "dar") {
        if (efeito === "jaEstava") {
          avisar("info", "Já estava presente", `${nome} já tinha presença${aoTurno}. Nada foi alterado.`);
          return "jaEstava";
        }
        avisar("ok", "Presença registrada", `${nome}${aoTurno}.${p.inscreveJunto ? " A pessoa também foi inscrita neste minicurso." : ""}`);
        setRecentes((l) => [
          { id, nome, quando: new Date(), detalhe: turno ? `Registrada a ${rotuloTurno(turno)}` : p.inscreveJunto ? "Inscrita na hora" : "Presença registrada" },
          ...l.filter((r) => r.id !== id),
        ].slice(0, 6));
        return "registrado";
      }

      const rotulo = quer === "retirar" ? "Presença retirada" : "Inscrição removida";
      if (efeito === "jaEstava") {
        avisar("info", quer === "retirar" ? "Já estava sem presença" : "Já estava sem inscrição", `${nome}${aoTurno}: nada foi alterado.`);
        return "jaEstava";
      }
      avisar("ok", rotulo, `${nome}${aoTurno}.${quer === "desinscrever" ? " A presença dessa pessoa também foi retirada." : ""}`);
      if (quer === "desinscrever") setRecentes((l) => l.filter((r) => r.id !== id));
      if (pagamentoMantido) avisar("alerta", "Pagamento não estornado", `${nome} já tinha PAGO: o valor NÃO foi estornado. Se for o caso, faça o estorno pelo painel do Asaas.`);
      return "registrado";
    } finally {
      emVoo.current.delete(id);
      setOcupados(new Set(emVoo.current));
      // o botão desabilita durante o envio e o navegador solta o foco: devolve, sem rolar a página
      if (foco?.isConnected) requestAnimationFrame(() => foco.focus({ preventScroll: true }));
    }
  }

  async function conferir(pessoa: AdminUserSummary, turno?: Turno) {
    const estado = await reconsultar({ pessoa, turno }).catch(() => null);
    if (!estado) {
      avisar("erro", "Ainda sem resposta", "Não foi possível conferir agora. Verifique a conexão e tente de novo.");
      return;
    }
    marcarIncerto(pessoa._id, false);
    avisar("info", "Situação conferida", `${displayUserName(pessoa)}: ${estado.presente ? "com presença" : "sem presença"}${turno ? ` (${rotuloTurno(turno)})` : ""}.`);
  }

  return { ocupados, incertos, recentes, executar, conferir };
}
