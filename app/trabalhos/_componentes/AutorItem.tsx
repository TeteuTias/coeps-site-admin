"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Botao, Campo, Selo } from "@/app/components/ui";
import type { Autor } from "./registro";

/** Autor com correção de nome e e-mail. O salvamento atualiza só este registro (feito pela página). */
export function AutorItem({ autor, aoSalvar }: {
  autor: Autor;
  aoSalvar: (nome: string, email: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(autor?.nome ?? "");
  const [email, setEmail] = useState(autor?.email ?? "");
  const [salvando, setSalvando] = useState(false);

  const abrir = () => { setNome(autor?.nome ?? ""); setEmail(autor?.email ?? ""); setEditando(true); };

  async function salvar() {
    setSalvando(true);
    try {
      if (await aoSalvar(nome.trim(), email.trim())) setEditando(false);
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <li className="grid gap-3 rounded-xl border border-tinta/30 bg-recuo/50 p-4">
        <Campo rotulo="Nome do autor" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo rotulo="E-mail do autor" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Botao carregando={salvando} onClick={salvar}>Salvar autor</Botao>
          <Botao estilo="contorno" disabled={salvando} onClick={() => setEditando(false)}>Cancelar</Botao>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-linha bg-cartao p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {autor?.nome || <span className="italic text-sutil">Autor sem nome</span>}
          {autor?.isOrientador && <Selo tom="info">Orientador</Selo>}
        </p>
        <p className="break-all text-sm text-sutil">{autor?.email || "E-mail não informado"}</p>
      </div>
      <Botao estilo="contorno" onClick={abrir}>
        <Pencil className="size-4" aria-hidden="true" />Corrigir nome ou e-mail
      </Botao>
    </li>
  );
}
