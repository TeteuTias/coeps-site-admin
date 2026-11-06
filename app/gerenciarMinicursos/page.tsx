"use client";

import { useMemo, useState } from "react";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Botao, Cabecalho, Metrica, Pagina } from "@/app/components/ui";
import { useAvisos } from "@/app/components/Avisos";
import CreateCourseModal from "@/app/components/CreateCourseModal";
import { CatalogoAtividades, deMinicurso, useCatalogo } from "@/app/components/CatalogoAtividades";
import type { FiltroExtra, ItemCatalogo } from "@/app/components/CatalogoAtividades";
import { formatarNumero } from "@/app/lib/formatar";

// Cada filtro é uma pergunta diferente: visibilidade, inscrições, preço e tipo não se substituem.
const FILTROS: FiltroExtra[] = [
  {
    chave: "visibilidade", rotulo: "Visibilidade para o usuário",
    opcoes: [{ valor: "visivel", rotulo: "Visível ao usuário" }, { valor: "oculta", rotulo: "Oculta ao usuário" }],
    casa: (i, v) => i.visivel === (v === "visivel"),
  },
  {
    chave: "inscricoes", rotulo: "Inscrições",
    opcoes: [{ valor: "abertas", rotulo: "Abertas" }, { valor: "encerradas", rotulo: "Encerradas" }],
    casa: (i, v) => i.abertas === (v === "abertas"),
  },
  {
    chave: "preco", rotulo: "Preço",
    opcoes: [{ valor: "gratuita", rotulo: "Gratuita" }, { valor: "paga", rotulo: "Paga" }],
    casa: (i, v) => i.gratuita === (v === "gratuita"),
  },
];

export default function Page() {
  const { avisar, confirmar } = useAvisos();
  const { cursos, estado, atualizando, recarregar } = useCatalogo({ palestras: false });
  const [criando, setCriando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const itens = useMemo(() => cursos.map(deMinicurso), [cursos]);

  async function remover(item: ItemCatalogo) {
    const inscritos = item.inscritos ?? 0;
    const presentes = item.presentes ?? 0;
    const confirmado = await confirmar({
      titulo: `Excluir "${item.nome}"?`,
      descricao: (
        <>
          <p>Esta atividade tem <strong>{formatarNumero(inscritos)} inscritos</strong> e <strong>{formatarNumero(presentes)} presenças registradas</strong>.</p>
          <p className="mt-2">Ao excluir, a atividade, a lista de presença e todas as informações dela são perdidas. Não é possível desfazer.</p>
        </>
      ),
      perigo: true,
      rotuloConfirmar: "Excluir atividade",
      rotuloCancelar: "Manter atividade",
    });
    if (!confirmado) return;

    setRemovendo(item.id);
    try {
      const resposta = await fetch("/api/delete/minicurso/", { method: "DELETE", body: JSON.stringify({ eventId: item.id }) });
      const corpo = await resposta.json().catch(() => null) as { message?: string } | null;
      if (resposta.status === 404) {
        avisar("alerta", "A atividade já não existe", "Outra pessoa pode tê-la excluído. A lista foi atualizada.");
        await recarregar();
      } else if (!resposta.ok) {
        avisar("erro", "Não foi possível excluir a atividade", corpo?.message || "Tente de novo em instantes.");
      } else {
        avisar("ok", "Atividade excluída", corpo?.message);
        await recarregar();
      }
    } catch {
      avisar("erro", "Sem resposta do servidor", "Atualize a lista antes de repetir: a atividade pode já ter sido excluída.");
    } finally {
      setRemovendo(null);
    }
  }

  const botaoCriar = (
    <Botao onClick={() => setCriando(true)}>
      <Plus className="size-4" aria-hidden="true" />Criar atividade
    </Botao>
  );

  return (
    <Pagina>
      <Cabecalho
        etiqueta="Atividades"
        titulo="Gerenciar atividades"
        sub="Configure minicursos, visibilidade, vagas e programação."
        acoes={botaoCriar}
        acento="vermelho"
      >
        {estado === "ok" && itens.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metrica rotulo="Atividades" valor={formatarNumero(itens.length)} />
            <Metrica rotulo="Visíveis ao usuário" valor={formatarNumero(itens.filter((i) => i.visivel).length)} />
            <Metrica rotulo="Inscrições abertas" valor={formatarNumero(itens.filter((i) => i.abertas).length)} />
            <Metrica rotulo="Inscritos" valor={formatarNumero(itens.reduce((s, i) => s + (i.inscritos ?? 0), 0))} />
          </div>
        )}
      </Cabecalho>

      <CatalogoAtividades
        itens={itens}
        estado={estado}
        atualizando={atualizando}
        aoTentar={() => void recarregar()}
        filtros={FILTROS}
        mostrarSituacao
        acaoVazio={botaoCriar}
        textoVazio="Crie a primeira atividade para começar a receber inscrições."
        acoes={(item) => [
          { rotulo: "Configurar", icone: Settings, estilo: "principal", href: `/gerenciarMinicursos/configurar/${item.id}` },
          { rotulo: "Excluir", icone: Trash2, estilo: "perigo", onClick: () => void remover(item), carregando: removendo === item.id },
        ]}
      />

      <CreateCourseModal isOpen={criando} onClose={() => setCriando(false)} onSuccess={recarregar} />
    </Pagina>
  );
}
