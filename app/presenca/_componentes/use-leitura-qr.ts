"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseAdminUserDetailsPayload } from "@/app/lib/users/admin-user-contract";
import type { AdminUserSummary } from "@/app/lib/users/admin-user-contract";
import { PRAZO_MS, sinalizar } from "../presenca-bip";
import { limparCodigo } from "./chamada";

/** `lido` numera cada leitura: ler a mesma pessoa de novo é uma leitura nova. */
export type Leitura =
  | { lido: number; codigo: string; estado: "buscando" }
  | { lido: number; codigo: string; estado: "invalida"; mensagem: string }
  /** `semRede`: o cadastro não pôde ser consultado e os dados vêm da lista já carregada na tela. */
  | { lido: number; codigo: string; estado: "ok"; pessoa: AdminUserSummary; semRede?: boolean };

/** Transforma o texto do QR em pessoa. Leitura inválida só vira mensagem: não mexe na lista e não para o leitor. */
export function useLeituraQr(conhecidos: readonly AdminUserSummary[]) {
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const seq = useRef(0);
  const conhecidosRef = useRef(conhecidos);
  useEffect(() => { conhecidosRef.current = conhecidos; });

  const ler = useCallback(async (texto: string) => {
    const n = ++seq.current;
    const codigo = limparCodigo(texto);
    if (!codigo) {
      sinalizar("erro");
      setLeitura({ lido: n, codigo: texto.trim().slice(0, 40), estado: "invalida", mensagem: "Este QR não é de uma credencial do CIEPS." });
      return;
    }
    setLeitura({ lido: n, codigo, estado: "buscando" });
    const invalida = (mensagem: string) => { if (n !== seq.current) return; sinalizar("erro"); setLeitura({ lido: n, codigo, estado: "invalida", mensagem }); };
    // sem internet ou servidor fora: a chamada continua com a lista já carregada, e a presença vai para a fila do aparelho
    const daLista = () => {
      const pessoa = conhecidosRef.current.find((u) => u._id.toLowerCase() === codigo.toLowerCase());
      if (!pessoa) return invalida("Sem conexão e esta credencial não está na lista carregada nesta tela. Leia de novo quando a internet voltar.");
      if (n === seq.current) setLeitura({ lido: n, codigo, estado: "ok", pessoa, semRede: true });
    };
    try {
      const res = await fetch(`/api/get/usuarioPorId/${codigo}`, { signal: AbortSignal.timeout(PRAZO_MS) });
      if (res.status >= 500) return daLista();
      const corpo: unknown = await res.json().catch(() => null);
      if (res.status === 404) return invalida("Credencial não encontrada: não existe cadastro com este código.");
      if (!res.ok) return invalida("Não foi possível consultar o cadastro agora. Leia de novo ou use a busca.");
      const pessoa = parseAdminUserDetailsPayload(corpo);
      if (!pessoa) return invalida("O cadastro desta credencial veio com dados inválidos.");
      if (n === seq.current) setLeitura({ lido: n, codigo, estado: "ok", pessoa });
    } catch {
      daLista();
    }
  }, []);

  const limpar = useCallback(() => { seq.current++; setLeitura(null); }, []);
  return { leitura, ler, limpar };
}
