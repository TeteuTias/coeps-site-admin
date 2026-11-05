"use client";

import { useCallback, useRef, useState } from "react";
import { parseAdminUserDetailsPayload } from "@/app/lib/users/admin-user-contract";
import type { AdminUserDetails } from "@/app/lib/users/admin-user-contract";
import { limparCodigo } from "./chamada";

/** `lido` numera cada leitura: ler a mesma pessoa de novo é uma leitura nova. */
export type Leitura =
  | { lido: number; codigo: string; estado: "buscando" }
  | { lido: number; codigo: string; estado: "invalida"; mensagem: string }
  | { lido: number; codigo: string; estado: "ok"; pessoa: AdminUserDetails };

/** Transforma o texto do QR em pessoa. Leitura inválida só vira mensagem: não mexe na lista e não para o leitor. */
export function useLeituraQr() {
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const seq = useRef(0);

  const ler = useCallback(async (texto: string) => {
    const n = ++seq.current;
    const codigo = limparCodigo(texto);
    if (!codigo) {
      setLeitura({ lido: n, codigo: texto.trim().slice(0, 40), estado: "invalida", mensagem: "Este QR não é de uma credencial do CIEPS." });
      return;
    }
    setLeitura({ lido: n, codigo, estado: "buscando" });
    const invalida = (mensagem: string) => { if (n === seq.current) setLeitura({ lido: n, codigo, estado: "invalida", mensagem }); };
    try {
      const res = await fetch(`/api/get/usuarioPorId/${codigo}`);
      const corpo: unknown = await res.json().catch(() => null);
      if (res.status === 404) return invalida("Credencial não encontrada: não existe cadastro com este código.");
      if (!res.ok) return invalida("Não foi possível consultar o cadastro agora. Leia de novo ou use a busca.");
      const pessoa = parseAdminUserDetailsPayload(corpo);
      if (!pessoa) return invalida("O cadastro desta credencial veio com dados inválidos.");
      if (n === seq.current) setLeitura({ lido: n, codigo, estado: "ok", pessoa });
    } catch {
      invalida("Sem resposta do servidor. Leia de novo ou use a busca.");
    }
  }, []);

  const limpar = useCallback(() => { seq.current++; setLeitura(null); }, []);
  return { leitura, ler, limpar };
}
