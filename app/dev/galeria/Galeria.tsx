"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import {
  Area, Aviso, Botao, BotaoLink, Cabecalho, Campo, CampoBusca, Caixa, Cartao, Escolha, Metrica, Pagina, Secao, Selo,
  TabelaRolavel, classeTd, classeTh,
} from "@/app/components/ui";
import { Atualizando, Estado } from "@/app/components/Estado";
import { Dialogo } from "@/app/components/Dialogo";
import { Copiavel } from "@/app/components/Copiavel";
import { useAvisos } from "@/app/components/Avisos";
import { formatarCentavos, formatarDataHora, formatarMoeda, formatarNumero, formatarPercentual } from "@/app/lib/formatar";

const pessoas = [
  { nome: "Ana Beatriz Lima Albuquerque de Souza", email: "ana@exemplo.com", situacao: "Pago", tom: "ok", valor: 15000 },
  { nome: "Carlos Eduardo", email: "carlos@exemplo.com", situacao: "Pendente", tom: "alerta", valor: 18000 },
  { nome: "Marina Souza", email: "marina@exemplo.com", situacao: "Suspenso", tom: "erro", valor: 0 },
] as const;

export function Galeria() {
  const { avisar, confirmar } = useAvisos();
  const [dialogo, setDialogo] = useState<"simples" | "perigo" | "digitar" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState("");

  const fechar = () => { if (!ocupado) setDialogo(null); };
  function confirmarComEspera() {
    setOcupado(true);
    setTimeout(() => { setOcupado(false); setDialogo(null); avisar("ok", "Ação concluída", "Exemplo: nada foi gravado."); }, 1200);
  }

  return (
    <Pagina>
      <Cabecalho
        etiqueta="Desenvolvimento"
        titulo="Galeria de componentes"
        sub="Peças do painel com dados fictícios. Nada aqui lê ou grava no banco."
        voltar={{ href: "/", rotulo: "Voltar ao início" }}
        acoes={<><Botao estilo="contorno"><Download className="size-4" aria-hidden="true" />Exportar</Botao><Botao><Plus className="size-4" aria-hidden="true" />Novo</Botao></>}
      />

      <Secao titulo="Botões" descricao="Ação principal em tinta; as demais em contorno. Mínimo de 44 px de altura.">
        <div className="flex flex-wrap items-center gap-2">
          <Botao>Principal</Botao>
          <Botao estilo="contorno">Contorno</Botao>
          <Botao estilo="fantasma">Fantasma</Botao>
          <Botao estilo="perigo">Perigo</Botao>
          <Botao estilo="perigoSolido">Perigo sólido</Botao>
          <Botao carregando>Salvando</Botao>
          <Botao disabled>Desabilitado</Botao>
          <Botao tamanho="pequeno" estilo="contorno">Pequeno</Botao>
          <BotaoLink href="/" estilo="contorno">Link em botão</BotaoLink>
        </div>
      </Secao>

      <Secao titulo="Métricas" descricao="Sem valor aparece 'Indisponível', nunca um zero que parece dado.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica rotulo="Inscritos" valor={formatarNumero(1284)} detalhe="Edição CIEPS 2026" />
          <Metrica rotulo="Receita bruta" valor={formatarMoeda(185432.5)} />
          <Metrica rotulo="Ocupação do lote" valor={formatarPercentual(0.78)} detalhe="156 de 200 vagas" />
          <Metrica rotulo="Estornos" valor={null} detalhe="A consulta falhou." />
        </div>
        <p className="num text-sm text-sutil">Zero é dado: {formatarMoeda(0)} · em centavos: {formatarCentavos(12345)} · {formatarDataHora("2026-11-04T10:00:00-03:00")}</p>
      </Secao>

      <Secao titulo="Selos e avisos" descricao="Sempre com texto: a cor sozinha não informa.">
        <div className="flex flex-wrap gap-2"><Selo>Neutro</Selo><Selo tom="ok">Pago</Selo><Selo tom="alerta">Pendente</Selo><Selo tom="erro">Suspenso</Selo><Selo tom="info">Em revisão</Selo><Selo tom="escuro">Presente</Selo></div>
        <div className="grid gap-2 md:grid-cols-2">
          <Aviso tom="ok" titulo="Salvo">Alterações gravadas.</Aviso>
          <Aviso tom="alerta" titulo="Atenção">O limite de 500 itens por operação.</Aviso>
          <Aviso tom="erro" titulo="Não foi possível salvar">Confira sua conexão.</Aviso>
          <Aviso tom="info" titulo="Informação">Os números são da edição ativa.</Aviso>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao estilo="contorno" onClick={() => avisar("ok", "Presença registrada", "Ana Beatriz entrou às 09:02.")}>Aviso de sucesso</Botao>
          <Botao estilo="contorno" onClick={() => avisar("erro", "Falha ao registrar", "Sem resposta do servidor. Confira antes de repetir.")}>Aviso de erro (fica até fechar)</Botao>
          <Botao estilo="contorno" onClick={async () => avisar((await confirmar({ titulo: "Excluir atividade?", descricao: "Os inscritos perdem a vaga.", perigo: true, rotuloConfirmar: "Excluir" })) ? "ok" : "info", "Resposta recebida")}>confirmar() no lugar de confirm()</Botao>
        </div>
      </Secao>

      <Secao titulo="Campos" descricao="Rótulo ligado, erro e ajuda anunciados ao leitor de tela.">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo rotulo="Nome" placeholder="Nome completo" ajuda="Como aparece no certificado." />
          <Campo rotulo="E-mail" type="email" defaultValue="ana@exemplo" erro="Informe um e-mail válido." />
          <Escolha rotulo="Situação" defaultValue="1"><option value="1">Pago</option><option value="0">Pendente</option></Escolha>
          <CampoBusca rotulo="Buscar pessoa" rotuloOculto={false} placeholder="Nome, e-mail ou ID" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Area rotulo="Parecer" className="md:col-span-2" placeholder="Escreva o parecer…" />
          <Caixa rotulo="Mostrar para o usuário" ajuda="Aparece no site público." />
          <Caixa rotulo="Inscrições abertas" defaultChecked />
        </div>
      </Secao>

      <Secao titulo="Tabela" descricao="Rolagem interna; a página nunca ganha rolagem horizontal.">
        <TabelaRolavel rotulo="Pessoas de exemplo">
          <thead><tr><th className={classeTh}>Nome</th><th className={classeTh}>E-mail</th><th className={classeTh}>Situação</th><th className={`${classeTh} text-right`}>Valor</th></tr></thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.email}>
                <td className={`${classeTd} max-w-64 truncate font-medium`} title={p.nome}>{p.nome}</td>
                <td className={classeTd}>{p.email}</td>
                <td className={classeTd}><Selo tom={p.tom}>{p.situacao}</Selo></td>
                <td className={`${classeTd} text-right`}>{formatarCentavos(p.valor)}</td>
              </tr>
            ))}
          </tbody>
        </TabelaRolavel>
        <p className="text-sm text-sutil">ID Asaas para suporte: <Copiavel texto="pay_0a1b2c3d4e5f" rotulo="ID do pagamento" /></p>
      </Secao>

      <Secao titulo="Estados" descricao="Mesma família em toda lista e painel.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Estado tipo="carregando" linhas={2} />
          <Estado tipo="vazio" titulo="Nenhum trabalho enviado" texto="Quando houver submissões, elas aparecem aqui." />
          <Estado tipo="semResultado" />
          <Estado tipo="erro" aoTentar={() => avisar("info", "Tentando de novo…")} />
          <Estado tipo="semPermissao" className="lg:col-span-2" />
        </div>
        <Atualizando ativo />
      </Secao>

      <Secao titulo="Diálogos" descricao="Fundo inerte, Tab preso, Escape fecha, foco volta ao botão. Em ação destrutiva o foco começa em Cancelar.">
        <div className="flex flex-wrap gap-2">
          <Botao estilo="contorno" onClick={() => setDialogo("simples")}>Confirmação simples</Botao>
          <Botao estilo="perigo" onClick={() => setDialogo("perigo")}>Ação destrutiva</Botao>
          <Botao estilo="perigo" onClick={() => setDialogo("digitar")}>Confirmação digitada</Botao>
        </div>
      </Secao>

      <Cartao className="text-sm text-sutil">Cartão simples, a base de tudo: fundo claro sobre o papel, sombra de uma linha e canto de 16 px.</Cartao>

      <Dialogo aberto={dialogo === "simples"} titulo="Salvar alterações?" descricao="As mudanças valem para quem abrir a atividade a partir de agora." rotuloConfirmar="Salvar" ocupado={ocupado} onCancelar={fechar} onConfirmar={confirmarComEspera} />
      <Dialogo aberto={dialogo === "perigo"} titulo="Excluir atividade?" descricao="Esta ação não pode ser desfeita." perigo rotuloConfirmar="Excluir" ocupado={ocupado} onCancelar={fechar} onConfirmar={confirmarComEspera} />
      <Dialogo aberto={dialogo === "digitar"} titulo="Remover 1.284 inscrições?" descricao="Operação coletiva e irreversível." perigo digitar="REMOVER 1284" rotuloConfirmar="Remover todas" ocupado={ocupado} onCancelar={fechar} onConfirmar={confirmarComEspera} />
    </Pagina>
  );
}
