"use client";

import { useCallback, useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { Aviso, Botao, Metrica, Secao, Selo } from "@/app/components/ui";
import { Atualizando } from "@/app/components/Estado";
import { useAvisos } from "@/app/components/Avisos";
import { formatarDataHora, formatarNumero } from "@/app/lib/formatar";
import { buildCodeListParams, mensagemErro, requestJson, SemRespostaError, type CodesResponse } from "./tipos";

interface Contagem { edicaoId: string; ativos: number; suspensos: number; codigosBloqueados: number }
interface Resultado { acao: "SUSPENDER" | "REATIVAR"; edicaoId: string; usuarios: number; codigos: number; em: string }

interface Props {
  /** Edição que a lista abaixo está consultando. */
  editionId: string;
  activeEditionId: string | null;
  isActiveEdition: boolean;
  /** Outra operação da página está em andamento. */
  bloqueado: boolean;
  aoOcupar: (ocupado: boolean) => void;
  /** Recarrega a lista de códigos depois de uma suspensão ou reativação. */
  aoMudar: () => Promise<unknown> | void;
}

/** O servidor sempre usa a edição ativa para suspender e reativar; por isso estes números e botões são só dela. */
export function PainelRepasse({ editionId, activeEditionId, isActiveEdition, bloqueado, aoOcupar, aoMudar }: Props) {
  const { avisar, confirmar } = useAvisos();
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [acaoAtiva, setAcaoAtiva] = useState<"SUSPENDER" | "REATIVAR" | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const carregar = useCallback(async (): Promise<Contagem | null> => {
    setCarregando(true);
    try {
      const dados = await requestJson<Contagem>("/api/post/pagamentos/profissionaisSaude/suspensao");
      setContagem(dados);
      setErro(null);
      return dados;
    } catch (e) {
      // não mantém o número antigo: sem leitura, o painel diz "Indisponível" em vez de um valor que pode estar velho
      setContagem(null);
      setErro(mensagemErro(e, "Não foi possível consultar a suspensão."));
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const edicaoDosNumeros = contagem?.edicaoId ?? activeEditionId;
  const edicaoDiverge = Boolean(contagem && activeEditionId && contagem.edicaoId !== activeEditionId);
  const podeAgir = isActiveEdition && !edicaoDiverge && Boolean(contagem) && !bloqueado && !acaoAtiva;

  async function alterar(acao: "SUSPENDER" | "REATIVAR") {
    setAcaoAtiva(acao);
    aoOcupar(true);
    try {
      // lê de novo para mostrar a edição e as quantidades de agora, não as da carga da página
      const atual = await carregar();
      if (!atual) {
        avisar("erro", "Não foi possível conferir a edição ativa", "Nada foi alterado. Tente de novo.");
        return;
      }
      if (activeEditionId && atual.edicaoId !== activeEditionId) {
        avisar("alerta", "A edição ativa mudou", `A página mostrava ${activeEditionId}, mas a ativa agora é ${atual.edicaoId}. Nada foi alterado: recarregue a página e confira.`);
        return;
      }

      const suspender = acao === "SUSPENDER";
      let codigosAfetados: number | null = atual.codigosBloqueados;
      if (suspender) {
        try {
          const params = buildCodeListParams({ page: 1, limit: 1, editionId: atual.edicaoId, activeTab: "SAUDE", statusFilter: "ATIVO", search: "" });
          codigosAfetados = (await requestJson<CodesResponse>(`/api/get/pagamentos/codigos?${params.toString()}`)).pagination.total;
        } catch {
          codigosAfetados = null;
        }
      }
      const pessoas = suspender ? atual.ativos : atual.suspensos;

      const confirmou = await confirmar({
        titulo: suspender ? "Suspender os profissionais da saúde?" : "Reativar os profissionais da saúde?",
        perigo: suspender,
        digitar: suspender ? "SUSPENDER" : "REATIVAR",
        rotuloConfirmar: suspender ? "Suspender todos" : "Reativar todos",
        descricao: (
          <div className="grid gap-3">
            <p>Edição <strong className="num">{atual.edicaoId}</strong> (a edição ativa agora).</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong className="num">{formatarNumero(pessoas)}</strong> inscrição(ões) {suspender ? "ativa(s) serão suspensas" : "suspensa(s) pelo repasse serão reativadas"}.</li>
              <li>{codigosAfetados === null
                ? "Não foi possível contar os códigos de saúde afetados; o resultado final mostra o número."
                : <><strong className="num">{formatarNumero(codigosAfetados)}</strong> código(s) de saúde {suspender ? "ativo(s) serão bloqueados" : "bloqueado(s) pela suspensão voltarão a ficar ativos"}.</>}</li>
            </ul>
            {suspender ? (
              <p>Comprovantes, vínculos de compra e códigos que já chegaram ao limite não são alterados.</p>
            ) : (
              <p>Se alguém teve a situação mudada à mão depois da suspensão, essa mudança pode ser sobrescrita. Um código que já atingiu o limite pode voltar como ativo e esgotado. Confira esses casos depois.</p>
            )}
            <p className="text-xs">A operação é feita no servidor sobre a edição ativa no momento do envio. Se der erro no meio, parte pode ter sido aplicada: os números do painel são atualizados para você conferir.</p>
          </div>
        ),
      });
      if (!confirmou) return;

      const dados = await requestJson<{ acao: string; edicaoId?: string; usuarios: number; codigos: number }>(
        "/api/post/pagamentos/profissionaisSaude/suspensao",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao }) },
      );
      const aplicada = dados.edicaoId ?? atual.edicaoId;
      setResultado({ acao, edicaoId: aplicada, usuarios: dados.usuarios, codigos: dados.codigos, em: new Date().toISOString() });
      avisar(
        aplicada === atual.edicaoId ? "ok" : "alerta",
        suspender ? "Suspensão concluída" : "Reativação concluída",
        `Edição ${aplicada}: ${formatarNumero(dados.usuarios)} inscrição(ões) ${suspender ? "suspensas" : "reativadas"} e ${formatarNumero(dados.codigos)} código(s) ${suspender ? "bloqueados" : "liberados"}.` +
          (aplicada === atual.edicaoId ? "" : ` Atenção: a edição aplicada difere da que você confirmou (${atual.edicaoId}).`),
      );
    } catch (e) {
      avisar(
        "erro",
        "Não foi possível concluir",
        e instanceof SemRespostaError
          ? e.message
          : `${mensagemErro(e, "Erro ao alterar a suspensão.")} Parte da operação pode ter sido aplicada: confira os números do painel antes de repetir.`,
      );
    } finally {
      await Promise.allSettled([carregar(), aoMudar()]);
      setAcaoAtiva(null);
      aoOcupar(false);
    }
  }

  return (
    <Secao
      titulo="Repasse da prefeitura"
      descricao="Suspende o acesso de todos os profissionais da saúde inscritos e bloqueia os códigos de saúde ainda ativos. Reativar desfaz a suspensão por repasse; confira antes se alguém foi ajustado à mão."
      acoes={edicaoDosNumeros ? <Selo tom="info">Edição ativa: {edicaoDosNumeros}</Selo> : undefined}
    >
      {!isActiveEdition && (
        <Aviso tom="info" titulo="Estes números são da edição ativa, não da que você está consultando">
          A lista abaixo é da edição {editionId || "consultada"}. O painel de repasse sempre trabalha na edição ativa{activeEditionId ? ` (${activeEditionId})` : ""}, por isso os botões só funcionam quando você consulta a edição ativa.
        </Aviso>
      )}
      {edicaoDiverge && (
        <Aviso tom="alerta" titulo="A edição ativa mudou">A página mostra {activeEditionId}, mas o servidor trabalha com {contagem?.edicaoId}. Recarregue a página antes de agir.</Aviso>
      )}
      {erro && (
        <Aviso tom="erro" titulo="Não foi possível ler os números do repasse">
          <p>{erro}</p>
          <Botao className="mt-2" estilo="contorno" carregando={carregando} onClick={() => void carregar()}>Tentar de novo</Botao>
        </Aviso>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Inscritos ativos" valor={contagem ? formatarNumero(contagem.ativos) : null} detalhe={contagem ? `Edição ${contagem.edicaoId}` : undefined} />
        <Metrica rotulo="Inscritos suspensos" valor={contagem ? formatarNumero(contagem.suspensos) : null} detalhe={contagem ? `Edição ${contagem.edicaoId}` : undefined} />
        <Metrica rotulo="Códigos bloqueados" valor={contagem ? formatarNumero(contagem.codigosBloqueados) : null} detalhe="Bloqueados pela suspensão" />
      </div>
      <Atualizando ativo={carregando && !acaoAtiva} />
      <div className="flex flex-wrap gap-2">
        <Botao estilo="perigo" disabled={!podeAgir} carregando={acaoAtiva === "SUSPENDER"} onClick={() => void alterar("SUSPENDER")}>
          <HeartPulse className="size-4" aria-hidden="true" />Suspender todos
        </Botao>
        <Botao disabled={!podeAgir} carregando={acaoAtiva === "REATIVAR"} onClick={() => void alterar("REATIVAR")}>Reativar todos</Botao>
      </div>
      {resultado && (
        <Aviso tom="ok" titulo={`${resultado.acao === "SUSPENDER" ? "Última suspensão" : "Última reativação"} desta sessão, ${formatarDataHora(resultado.em)}`}>
          Edição {resultado.edicaoId}: {formatarNumero(resultado.usuarios)} inscrição(ões) {resultado.acao === "SUSPENDER" ? "suspensas" : "reativadas"} e {formatarNumero(resultado.codigos)} código(s) {resultado.acao === "SUSPENDER" ? "bloqueados" : "liberados"}.
        </Aviso>
      )}
    </Secao>
  );
}
