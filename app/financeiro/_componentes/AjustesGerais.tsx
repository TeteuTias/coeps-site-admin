"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Botao, Caixa, Campo } from "@/app/components/ui";
import { useAvisos } from "@/app/components/Avisos";
import type { IPaymentConfig } from "@/app/lib/types/payments/payment.t";
import { Bloco } from "./Bloco";
import { TIPOS_PAGAMENTO, corpoGeral, enviarJson, relatarFalha, rotuloTipo, type TipoPagamento } from "./util";

export function PrecoOrganizador({ config, aoSalvar }: { config: IPaymentConfig; aoSalvar: () => Promise<void> }) {
  const { avisar } = useAvisos();
  const salvo = (config.configuracaoOrganizador?.valorFinalCentavos ?? 0) / 100;
  const [valor, setValor] = useState(salvo);
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const erro = tentou && !(valor > 0) ? "Informe um preço maior que zero." : undefined;

  async function salvar() {
    setTentou(true);
    if (!(valor > 0)) return;
    setSalvando(true);
    try {
      const r = await enviarJson("/api/put/pagamentos/configuracaoGeralPagamento", "PUT", corpoGeral(config, { valorOrganizador: valor }), "Não foi possível salvar o preço.");
      if (relatarFalha(avisar, r, "Preço não salvo")) return;
      await aoSalvar();
      avisar("ok", "Preço de organizador salvo");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Bloco
      titulo="Preço reservado para organizadores"
      descricao="Total fixo aplicado em qualquer meio de pagamento quando um desconto individual estiver marcado como organizador. Essas inscrições não ocupam vagas dos lotes. Vale por edição."
    >
      <div className="flex flex-wrap items-end gap-3">
        <Campo className="w-full sm:w-56" rotulo="Valor final (R$)" type="number" min="0.01" step="0.01" value={valor} erro={erro} onChange={(e) => setValor(parseFloat(e.target.value) || 0)} />
        <Botao carregando={salvando} onClick={() => void salvar()}><Save className="size-4" aria-hidden="true" />Salvar preço</Botao>
      </div>
    </Bloco>
  );
}

export function TiposAceitos({ config, aoSalvar }: { config: IPaymentConfig; aoSalvar: () => Promise<void> }) {
  const { avisar } = useAvisos();
  const salvos = config.pagamentosAceitos ?? [];
  const [selecionados, setSelecionados] = useState<TipoPagamento[]>(salvos);
  const [salvando, setSalvando] = useState(false);
  const alterado = selecionados.length !== salvos.length || selecionados.some((t) => !salvos.includes(t));

  const alternar = (t: TipoPagamento) =>
    setSelecionados((atual) => (atual.includes(t) ? atual.filter((x) => x !== t) : [...atual, t]));

  async function salvar() {
    setSalvando(true);
    try {
      // O servidor lê a lista no campo "parcelamentos": é o contrato atual da API, mantido como está.
      const r = await enviarJson("/api/put/pagamentos/configuracaoTiposDePagamentosAceitos/", "PUT", { _id: config._id, parcelamentos: selecionados }, "Não foi possível salvar as formas de pagamento.");
      if (relatarFalha(avisar, r, "Formas de pagamento não salvas")) return;
      await aoSalvar();
      avisar("ok", "Formas de pagamento atualizadas");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Bloco titulo="Formas de pagamento aceitas" descricao="Marque as formas que o checkout oferece.">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TIPOS_PAGAMENTO.map((t) => (
          <Caixa key={t} rotulo={rotuloTipo(t)} checked={selecionados.includes(t)} onChange={() => alternar(t)} />
        ))}
      </div>
      <div>
        <Botao carregando={salvando} disabled={!alterado} onClick={() => void salvar()}><Save className="size-4" aria-hidden="true" />Salvar formas de pagamento</Botao>
      </div>
    </Bloco>
  );
}
