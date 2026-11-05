"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Download, Mail, RefreshCw } from "lucide-react";
import { Botao, BotaoLink, Cabecalho, CampoBusca, Escolha, Metrica, Pagina } from "@/app/components/ui";
import { Atualizando, Estado } from "@/app/components/Estado";
import { useAvisos } from "@/app/components/Avisos";
import { useUser } from "@/app/lib/auth0-client";
import { formatarNumero } from "@/app/lib/formatar";
import type { IAcademicWorks } from "@/app/lib/types/academicWorks/academicWorks.t";
import type { IUser } from "@/app/lib/types/user/user.t";
import { CartaoTrabalho } from "./_componentes/CartaoTrabalho";
import { arquivoRevisado, arquivosDe, autoresDe, fichasDe, normalizar, tituloDe, type Ficha } from "./_componentes/registro";
import { gravarRascunhos, lerRascunhos, type Rascunho, type Rascunhos } from "./_componentes/rascunhos";
import { ORDEM_AVALIACAO, SITUACOES, situacaoDe, type SituacaoId } from "./_componentes/situacao";

type Filtro = SituacaoId | "todas";
const MSG_SEM_RESPOSTA = "Sem resposta do servidor.";

export default function AvaliarTrabalhoPage() {
  // useSearchParams exige Suspense: o filtro inicial vem da URL
  return (
    <Suspense fallback={<Pagina largura="ampla"><Estado tipo="carregando" titulo="Carregando trabalhos…" /></Pagina>}>
      <PainelTrabalhos />
    </Suspense>
  );
}

function PainelTrabalhos() {
  const { avisar, confirmar } = useAvisos();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useUser();
  const dono = user?.sub;

  const [trabalhos, setTrabalhos] = useState<IAcademicWorks[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [falhouCarga, setFalhouCarga] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const carregouRef = useRef(false);

  const [busca, setBusca] = useState(params.get("q") ?? "");
  const [situacao, setSituacao] = useState<Filtro>(() => {
    const s = params.get("situacao");
    return s && (ORDEM_AVALIACAO as readonly string[]).includes(s) ? (s as Filtro) : "todas";
  });

  const [rascunhos, setRascunhos] = useState<Rascunhos>({});
  const [rascunhosLidos, setRascunhosLidos] = useState(false);

  const [exportando, setExportando] = useState<"zip" | "planilha" | null>(null);
  const [progresso, setProgresso] = useState("");

  // Rascunhos: lidos da sessão do navegador depois da montagem, por conta (evita divergência com o HTML do servidor), e gravados a cada mudança
  useEffect(() => { if (dono) { setRascunhos(lerRascunhos(dono)); setRascunhosLidos(true); } }, [dono]);
  useEffect(() => { if (dono && rascunhosLidos) gravarRascunhos(dono, rascunhos); }, [dono, rascunhos, rascunhosLidos]);

  // Filtros na URL sem navegar: replaceState não refaz a requisição da página a cada tecla
  useEffect(() => {
    const p = new URLSearchParams();
    if (busca.trim()) p.set("q", busca);
    if (situacao !== "todas") p.set("situacao", situacao);
    const qs = p.toString();
    if (qs !== window.location.search.replace(/^\?/, "")) window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [busca, situacao, pathname]);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const resposta = await fetch("/api/get/trabalhos-avaliacoes");
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const corpo = await resposta.json();
      if (!Array.isArray(corpo?.data)) throw new Error("Resposta sem a lista de trabalhos.");
      setTrabalhos([...corpo.data].reverse());
      setUsers(Array.isArray(corpo.users) ? corpo.users : []);
      setFalhouCarga(false);
      carregouRef.current = true;
      setCarregou(true);
    } catch (erro) {
      console.error("Erro ao carregar trabalhos:", erro);
      // Com lista já na tela, ela fica; só avisa
      if (carregouRef.current) avisar("erro", "Não foi possível atualizar a lista", "Você continua vendo a última lista carregada.");
      else setFalhouCarga(true);
    } finally {
      setAtualizando(false);
    }
  }, [avisar]);

  useEffect(() => { void carregar(); }, [carregar]);

  const usuarioPorId = useMemo(() => new Map(users.map((u) => [`${u._id}`, u])), [users]);

  const contagem = useMemo(() => {
    const c: Record<SituacaoId, number> = { "em-avaliacao": 0, ajustes: 0, aceito: 0, recusado: 0, "sem-situacao": 0 };
    for (const t of trabalhos) c[situacaoDe(t.status)]++;
    return c;
  }, [trabalhos]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return trabalhos.filter((t) => {
      if (situacao !== "todas" && situacaoDe(t.status) !== situacao) return false;
      if (!termo) return true;
      const titular = usuarioPorId.get(`${t.userId}`)?.informacoes_usuario?.nome;
      return [t.titulo, titular, ...autoresDe(t).map((a) => a?.nome)].some((campo) => normalizar(campo).includes(termo));
    });
  }, [trabalhos, busca, situacao, usuarioPorId]);

  const filtrosAtivos = busca.trim() !== "" || situacao !== "todas";
  const n = filtrados.length;
  const escopo = `${formatarNumero(n)} ${n === 1 ? "trabalho" : "trabalhos"}${filtrosAtivos ? (n === 1 ? " filtrado" : " filtrados") : ""}`;
  const limparFiltros = () => { setBusca(""); setSituacao("todas"); };

  const mudarRascunho = useCallback((id: string, patch: Partial<Rascunho> | null) => {
    setRascunhos((prev) => {
      const proximo = { ...prev };
      if (patch === null) { delete proximo[id]; return proximo; }
      const r: Rascunho = { ...prev[id], ...patch };
      (Object.keys(r) as (keyof Rascunho)[]).forEach((k) => { if (r[k] === undefined) delete r[k]; });
      if (Object.keys(r).length === 0) delete proximo[id]; else proximo[id] = r;
      return proximo;
    });
  }, []);

  // Salvar atualiza só o registro afetado: a lista não recarrega nem desmonta os outros cartões
  const enviarAvaliacao = useCallback(async (t: IAcademicWorks, r?: Rascunho): Promise<boolean> => {
    const id = `${t._id}`;
    const apiStatus = SITUACOES[r?.situacao ?? situacaoDe(t.status)].api;
    if (!apiStatus) { avisar("erro", "Escolha a situação do trabalho"); return false; }

    // Nota apagada na tela não pode enviar a nota antiga: pede o valor antes de gravar
    const pedeNota = r?.situacao === "aceito" || r?.situacao === "recusado" || (!r?.situacao && ["aceito", "recusado"].includes(situacaoDe(t.status)));
    const semNota = pedeNota ? fichasDe(t).find((item) => r?.fichas?.[`${item._id}`]?.nota === "") : undefined;
    if (semNota) { avisar("erro", "Preencha a nota", `Critério: ${semNota.nome}. Seu texto continua guardado.`); return false; }

    const ficha: Ficha[] = fichasDe(t).map((item) => {
      const d = r?.fichas?.[`${item._id}`];
      if (!d) return item;
      const saida = { ...item };
      if (d.nota !== undefined && d.nota !== "" && Number.isFinite(Number(d.nota))) {
        saida.notasRecebidas = [Math.max(item.notaMinima, Math.min(item.notaMaxima, Number(d.nota)))];
      }
      if (d.justificativa !== undefined) saida.justificativa = [d.justificativa];
      return saida;
    });

    try {
      const resposta = await fetch("/api/post/avaliar-trabalho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: t._id, userId: t.userId, status: apiStatus, avaliadorComentarios: r?.parecer ?? "", ficha_avalicao: ficha }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        avisar("erro", "A avaliação não foi enviada", `${corpo?.message || `Erro ${resposta.status}.`} O texto continua guardado.`);
        return false;
      }
      // Espelha o que o servidor gravou: status, novo parecer e a nota/justificativa no topo do histórico da ficha
      setTrabalhos((prev) => prev.map((x) => {
        if (`${x._id}` !== id) return x;
        const comentario = { comentario: r?.parecer ?? "", date: new Date(), status: apiStatus } as unknown as IAcademicWorks["avaliadorComentarios"][number];
        return {
          ...x,
          status: apiStatus as IAcademicWorks["status"],
          avaliadorComentarios: [...(Array.isArray(x.avaliadorComentarios) ? x.avaliadorComentarios : []), comentario],
          configuracaoModalidade: {
            ...x.configuracaoModalidade,
            ficha_avalicao: fichasDe(x).map((f) => {
              const enviado = ficha.find((p) => `${p._id}` === `${f._id}`);
              return enviado ? { ...f, notasRecebidas: [enviado.notasRecebidas?.[0], ...(f.notasRecebidas ?? [])], justificativa: [enviado.justificativa?.[0], ...(f.justificativa ?? [])] } : f;
            }) as Ficha[],
          },
        };
      }));
      mudarRascunho(id, null);
      avisar("ok", "Avaliação enviada", `${tituloDe(t)}: ${apiStatus}.`);
      return true;
    } catch (erro) {
      console.error("Erro ao enviar avaliação:", erro);
      avisar("erro", MSG_SEM_RESPOSTA, "Não sabemos se a avaliação foi registrada. Veja em “Avaliações anteriores” ou atualize a lista antes de enviar de novo. Seu texto continua guardado.");
      return false;
    }
  }, [avisar, mudarRascunho]);

  const salvarAutor = useCallback(async (id: string, index: number, emailAtual: string | null, nome: string, email: string): Promise<boolean> => {
    const ok = await confirmar({
      titulo: "Corrigir os dados deste autor?",
      descricao: <>Nome: <strong>{nome || "(vazio)"}</strong><br />E-mail: <strong>{email || "(vazio)"}</strong></>,
      rotuloConfirmar: "Corrigir autor",
    });
    if (!ok) return false;
    try {
      const resposta = await fetch("/api/post/trabalhos/autor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trabalhoId: id, index, emailAtual, nome, email }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        if (resposta.status === 409) {
          avisar("alerta", "O autor foi alterado por outra pessoa", `${corpo?.message || ""} A lista foi atualizada: confira os dados e tente de novo.`.trim());
          void carregar();
        } else {
          avisar("erro", "Não foi possível corrigir o autor", corpo?.message || `Erro ${resposta.status}.`);
        }
        return false;
      }
      const novo = { nome: corpo?.data?.nome ?? nome, email: corpo?.data?.email ?? email };
      setTrabalhos((prev) => prev.map((t) => (`${t._id}` !== id ? t : { ...t, autores: autoresDe(t).map((a, i) => (i === index ? { ...a, ...novo } : a)) })));
      avisar("ok", "Autor corrigido", `${novo.nome} · ${novo.email}`);
      return true;
    } catch (erro) {
      console.error("Erro ao corrigir autor:", erro);
      avisar("erro", MSG_SEM_RESPOSTA, "Não sabemos se o autor foi alterado. Atualize a lista e confira antes de repetir.");
      return false;
    }
  }, [avisar, confirmar, carregar]);

  // Planilha e ZIP usam a mesma lista filtrada que está na tela
  async function baixarPlanilha() {
    if (n === 0) { avisar("alerta", "Nenhum trabalho na lista", "Ajuste os filtros para exportar."); return; }
    setExportando("planilha");
    try {
      const XLSX = await import("xlsx");
      const linhas = filtrados.map((t) => {
        const titular = usuarioPorId.get(`${t.userId}`)?.informacoes_usuario;
        return {
          "ID TRABALHO": `${t._id}`,
          "TITULO": t.titulo ?? "",
          "TITULAR QUE SUBMETEU": titular?.nome || "NÃO ENCONTRADO",
          "TELEFONE DO TITULAR": titular?.numero_telefone || "NÃO ENCONTRADO",
          "E-MAIL DO TITULAR": titular?.email || "NÃO ENCONTRADO",
          "AUTORES": autoresDe(t).map((a) => a?.nome).filter(Boolean).join("; "),
        };
      });
      const livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(linhas), "Dados");
      XLSX.writeFile(livro, "Trabalhos.xlsx");
      avisar("ok", "Planilha gerada", `${escopo} na planilha Trabalhos.xlsx.`);
    } catch (erro) {
      console.error("Erro ao gerar planilha:", erro);
      avisar("erro", "Não foi possível gerar a planilha", "Tente de novo.");
    } finally {
      setExportando(null);
    }
  }

  async function baixarZip() {
    if (n === 0) { avisar("alerta", "Nenhum trabalho na lista", "Ajuste os filtros para baixar arquivos."); return; }
    setExportando("zip");

    // Remove caracteres que quebram a extração no Windows e evita "/" virar subpasta no ZIP
    const nomeSeguro = (nome: string) => nome.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100);
    const falhas: string[] = [];
    let totalArquivos = 0;

    try {
      const { default: JSZip } = await import("jszip");
      // Um único ZIP com uma pasta por trabalho: navegadores bloqueiam vários downloads automáticos
      const zip = new JSZip();

      for (const [index, trabalho] of filtrados.entries()) {
        const arquivos = arquivosDe(trabalho);
        if (arquivos.length === 0) continue;
        setProgresso(`Baixando arquivos: trabalho ${index + 1} de ${n}…`);

        // Numeração garante pastas distintas mesmo com títulos repetidos
        const pasta = zip.folder(`${index + 1} - ${nomeSeguro(trabalho.titulo || "trabalho")}`)!;
        const nomesUsados = new Set<string>();

        for (const [indexArquivo, arquivo] of arquivos.entries()) {
          try {
            const resposta = await fetch(arquivo.url);
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            const blob = await resposta.blob();

            let nome = nomeSeguro(arquivo.originalName || `arquivo-${indexArquivo + 1}`);
            if (arquivoRevisado(arquivo)) nome = `REVISADO - ${nome}`;
            if (nomesUsados.has(nome)) nome = `${indexArquivo + 1} - ${nome}`;
            nomesUsados.add(nome);

            pasta.file(nome, blob);
            totalArquivos++;
          } catch (erro) {
            console.error(`Erro no arquivo ${arquivo?.originalName}:`, erro);
            falhas.push(`${tituloDe(trabalho)}: ${arquivo?.originalName ?? "arquivo sem nome"}`);
          }
        }
      }

      if (totalArquivos === 0) {
        if (falhas.length > 0) avisar("erro", "Nenhum arquivo pôde ser baixado", `${falhas.length} falha(s). Nenhum ZIP foi gerado.`);
        else avisar("alerta", "Sem arquivos", "Os trabalhos filtrados não têm arquivos anexados.");
        return;
      }

      setProgresso("Montando o ZIP…");
      const conteudo = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(conteudo);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Trabalhos_Filtrados.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      if (falhas.length > 0) {
        const lista = falhas.slice(0, 20).join("\n");
        const resto = falhas.length > 20 ? `\n… e mais ${falhas.length - 20}` : "";
        avisar("alerta", `ZIP gerado sem ${falhas.length} arquivo(s)`, `Estes anexos não puderam ser baixados e ficaram de fora:\n${lista}${resto}`);
      } else {
        avisar("ok", "ZIP gerado", `${formatarNumero(totalArquivos)} arquivo(s) de ${escopo}.`);
      }
    } catch (erro) {
      console.error("Erro geral no processo de download:", erro);
      avisar("erro", "Não foi possível gerar o ZIP", "Nenhum arquivo foi baixado.");
    } finally {
      setExportando(null);
      setProgresso("");
    }
  }

  const carregando = !carregou && !falhouCarga;

  return (
    <Pagina largura="ampla">
      <Cabecalho
        etiqueta="CIEPS / Trabalhos"
        titulo="Painel de avaliação"
        sub="Revise, filtre e avalie os trabalhos acadêmicos submetidos."
        acoes={<BotaoLink href="/trabalhos/email" estilo="contorno"><Mail className="size-4" aria-hidden="true" />Enviar e-mails</BotaoLink>}
      />

      {carregando && <Estado tipo="carregando" titulo="Carregando trabalhos…" linhas={4} />}
      {falhouCarga && <Estado tipo="erro" titulo="Não foi possível carregar os trabalhos" aoTentar={() => void carregar()} />}

      {carregou && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metrica rotulo="Total de trabalhos" valor={formatarNumero(trabalhos.length)} />
            {ORDEM_AVALIACAO.map((id) => <Metrica key={id} rotulo={SITUACOES[id].plural} valor={formatarNumero(contagem[id])} />)}
            {contagem["sem-situacao"] > 0 && <Metrica rotulo={SITUACOES["sem-situacao"].plural} valor={formatarNumero(contagem["sem-situacao"])} />}
          </div>

          <section aria-label="Filtros e exportação" className="grid gap-4 rounded-2xl bg-cartao p-4 ring-1 ring-linha/60 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_16rem_auto] md:items-end">
              <CampoBusca rotulo="Buscar por título, autor ou titular" rotuloOculto={false} placeholder="Título do trabalho, autor ou titular da conta…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <Escolha rotulo="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value as Filtro)}>
                <option value="todas">Todas as situações</option>
                {ORDEM_AVALIACAO.map((id) => <option key={id} value={id}>{SITUACOES[id].rotulo}</option>)}
              </Escolha>
              <Botao estilo="contorno" carregando={atualizando} onClick={() => void carregar()}>
                {!atualizando && <RefreshCw className="size-4" aria-hidden="true" />}Atualizar lista
              </Botao>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-linha pt-4">
              <Botao carregando={exportando === "zip"} disabled={exportando !== null || n === 0} onClick={() => void baixarZip()}>
                {exportando !== "zip" && <Download className="size-4" aria-hidden="true" />}Baixar arquivos de {escopo}
              </Botao>
              <Botao estilo="contorno" carregando={exportando === "planilha"} disabled={exportando !== null || n === 0} onClick={() => void baixarPlanilha()}>
                {exportando !== "planilha" && <Download className="size-4" aria-hidden="true" />}Baixar informações de {escopo}
              </Botao>
            </div>
            <p className="text-xs text-sutil">Os dois botões usam a lista exibida abaixo, com a busca e a situação escolhidas. A planilha traz o titular que submeteu e os autores, sem CPF.</p>
            {progresso && <p role="status" aria-live="polite" className="text-sm text-sutil">{progresso}</p>}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" aria-live="polite" className="text-sm font-medium">
              {n === 0 ? "Nenhum trabalho com os filtros atuais." : `${formatarNumero(n)} ${n === 1 ? "trabalho encontrado" : "trabalhos encontrados"}.`}
            </p>
            <Atualizando ativo={atualizando} />
          </div>

          {trabalhos.length === 0 && <Estado tipo="vazio" titulo="Nenhum trabalho submetido ainda" texto="Quando alguém submeter um trabalho, ele aparece aqui." />}
          {trabalhos.length > 0 && n === 0 && <Estado tipo="semResultado" acao={<Botao estilo="contorno" onClick={limparFiltros}>Limpar busca e filtros</Botao>} />}

          <div className="grid gap-4">
            {filtrados.map((t) => (
              <CartaoTrabalho
                key={`${t._id}`}
                trabalho={t}
                titular={usuarioPorId.get(`${t.userId}`)}
                rascunho={rascunhos[`${t._id}`]}
                aoMudarRascunho={mudarRascunho}
                aoEnviarAvaliacao={enviarAvaliacao}
                aoSalvarAutor={salvarAutor}
              />
            ))}
          </div>
        </>
      )}
    </Pagina>
  );
}
