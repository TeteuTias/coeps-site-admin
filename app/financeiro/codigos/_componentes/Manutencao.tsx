"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { History, Trash2 } from "lucide-react";
import { Aviso, Botao, Campo } from "@/app/components/ui";
import { Estado } from "@/app/components/Estado";
import { useAvisos } from "@/app/components/Avisos";
import { formatarData, formatarNumero } from "@/app/lib/formatar";
import { Recolhivel } from "./Recolhivel";
import { ehSemPermissao, mensagemErro, requestJson, SemRespostaError, type CleanupPreview } from "./tipos";

interface Props {
  bloqueado: boolean;
  aoOcupar: (ocupado: boolean) => void;
  /** Chamado depois de apagar; recebe a edição apagada para a página recarregar se for a que está na tela. */
  aoApagar: (edicaoId: string) => Promise<unknown> | void;
}

/** Limpeza anual: prévia obrigatória e confirmação digitada. Fora da rotina diária, por isso recolhida. */
export function Manutencao({ bloqueado, aoOcupar, aoApagar }: Props) {
  const { avisar, confirmar } = useAvisos();
  const [edicao, setEdicao] = useState("");
  const [previa, setPrevia] = useState<CleanupPreview | null>(null);
  const [acao, setAcao] = useState<"previa" | "apagar" | null>(null);
  const [semPermissao, setSemPermissao] = useState<string | null>(null);

  async function gerarPrevia(event: FormEvent) {
    event.preventDefault();
    setAcao("previa");
    aoOcupar(true);
    setPrevia(null);
    try {
      setPrevia(await requestJson<CleanupPreview>(`/api/get/pagamentos/historico/preview?edicaoId=${encodeURIComponent(edicao.trim().toUpperCase())}`));
    } catch (e) {
      if (ehSemPermissao(e)) setSemPermissao(mensagemErro(e, "Sua conta não tem permissão para esta operação."));
      else avisar("erro", "Não foi possível gerar a prévia", mensagemErro(e, "Tente de novo."));
    } finally {
      setAcao(null);
      aoOcupar(false);
    }
  }

  async function apagar() {
    if (!previa?.eligible) return;
    const confirmou = await confirmar({
      titulo: `Apagar o histórico de ${previa.edicaoId}?`,
      perigo: true,
      digitar: previa.expectedConfirmation,
      rotuloConfirmar: "Apagar histórico",
      descricao: `Serão removidos ${formatarNumero(previa.counts.codigos)} código(s) e ${formatarNumero(previa.counts.atribuicoes)} vínculo(s) de venda (${formatarNumero(previa.counts.total)} registros). Usuários, pagamentos e comprovantes não são apagados. Não dá para desfazer.`,
    });
    if (!confirmou) return;

    setAcao("apagar");
    aoOcupar(true);
    try {
      const dados = await requestJson<{ message: string; deleted: { total: number } }>(
        `/api/delete/pagamentos/historico/${encodeURIComponent(previa.edicaoId)}`,
        { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: previa.expectedConfirmation }) },
      );
      avisar("ok", "Histórico apagado", `${dados.message} ${formatarNumero(dados.deleted.total)} registros removidos.`);
      setPrevia(null);
      await aoApagar(previa.edicaoId);
    } catch (e) {
      avisar("erro", "Não foi possível apagar o histórico", e instanceof SemRespostaError ? e.message : mensagemErro(e, "Tente de novo."));
    } finally {
      setAcao(null);
      aoOcupar(false);
    }
  }

  return (
    <Recolhivel
      perigo
      titulo="Limpeza anual do histórico"
      resumo="Manutenção rara: só para edição encerrada, não ativa e sem atividade há mais de 365 dias."
    >
      <p className="flex items-start gap-2 text-sm text-sutil">
        <History className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Apaga os códigos e os vínculos de venda da edição escolhida. Usuários, pagamentos e comprovantes não são apagados. Primeiro gere a prévia.
      </p>
      {semPermissao ? (
        <Estado tipo="semPermissao" titulo="Sem permissão para limpar o histórico" texto={semPermissao} />
      ) : (
      <form onSubmit={gerarPrevia} className="flex flex-wrap items-end gap-3">
        <Campo
          rotulo="Edição que será avaliada"
          value={edicao}
          onChange={(e) => { setEdicao(e.target.value); setPrevia(null); }}
          placeholder="COEPS-2025"
          required
          className="w-full sm:w-72"
        />
        <Botao type="submit" estilo="contorno" carregando={acao === "previa"} disabled={bloqueado || acao !== null}>Gerar prévia</Botao>
      </form>
      )}

      {previa && (
        <div className="grid gap-3 rounded-xl border border-erro/30 bg-erro-fundo p-4">
          <h3 className="font-semibold">Prévia de <span className="num">{previa.edicaoId}</span></h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-sutil">Códigos</dt><dd className="num font-semibold">{formatarNumero(previa.counts.codigos)}</dd></div>
            <div><dt className="text-xs text-sutil">Vínculos de venda</dt><dd className="num font-semibold">{formatarNumero(previa.counts.atribuicoes)}</dd></div>
            <div><dt className="text-xs text-sutil">Registro mais recente</dt><dd className="num font-semibold">{formatarData(previa.latestRelevantDate, "Nenhum")}</dd></div>
          </dl>
          {previa.eligible ? (
            <div>
              <Botao estilo="perigo" carregando={acao === "apagar"} disabled={bloqueado || acao !== null} onClick={() => void apagar()}>
                <Trash2 className="size-4" aria-hidden="true" />Apagar histórico da edição
              </Botao>
            </div>
          ) : (
            <Aviso tom="alerta" titulo="Esta edição não pode ser limpa">{previa.reason ?? "A edição não atende às regras de limpeza."}</Aviso>
          )}
        </div>
      )}
    </Recolhivel>
  );
}
