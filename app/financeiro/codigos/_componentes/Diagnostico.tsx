import { Selo, Metrica } from "@/app/components/ui";
import { formatarDataHora, formatarNumero } from "@/app/lib/formatar";
import type { AdminPaymentLedgerBacklog } from "@/app/lib/types/payments/payment-admin.t";
import { Recolhivel } from "./Recolhivel";
import { formatAge } from "./tipos";

/** Fila que recebe os avisos do Asaas e atualiza as compras. É global: não depende da edição consultada. */
export function Diagnostico({ ledger }: { ledger: AdminPaymentLedgerBacklog | null }) {
  const c = ledger?.counts;
  const w = ledger?.worker;
  const atencao = Boolean(ledger && (c!.failed > 0 || c!.reviewRequired > 0 || w!.blockedByFailedEvent || w!.leaseExpired));
  const andando = Boolean(ledger && (c!.pending > 0 || c!.processing > 0));
  const selo = !ledger ? <Selo>Indisponível</Selo>
    : atencao ? <Selo tom="alerta">Precisa de atenção</Selo>
    : andando ? <Selo tom="info">Processando</Selo>
    : <Selo tom="ok">Em dia</Selo>;

  const n = (v: number | undefined) => (v === undefined ? null : formatarNumero(v));
  return (
    <Recolhivel
      titulo="Diagnóstico de processamento"
      selo={selo}
      resumo="Só para conferir se os avisos de pagamento estão sendo processados. Vale para todas as edições."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Aguardando" valor={n(c?.pending)} detalhe="PENDING" />
        <Metrica rotulo="Em processamento" valor={n(c?.processing)} detalhe="PROCESSING" />
        <Metrica rotulo="Com falha" valor={n(c?.failed)} detalhe="FAILED" />
        <Metrica rotulo="Em revisão" valor={n(c?.reviewRequired)} detalhe="REVIEW_REQUIRED" />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-sutil">Aviso mais antigo esperando</dt>
          <dd className="num font-semibold">{ledger ? `${formatAge(ledger.oldestOutstandingAgeSeconds)}${ledger.oldestOutstandingAt ? ` · desde ${formatarDataHora(ledger.oldestOutstandingAt)}` : ""}` : "Indisponível"}</dd>
        </div>
        <div>
          <dt className="text-xs text-sutil">Processador</dt>
          <dd className="font-semibold">{!w ? "Indisponível" : w.leaseExpired ? "Reserva expirada: pode ter parado" : w.locked ? "Em execução" : "Livre, sem reserva ativa"}</dd>
        </div>
        <div>
          <dt className="text-xs text-sutil">Reserva (lease) até</dt>
          <dd className="num font-semibold">{w ? formatarDataHora(w.leaseUntil, "Sem reserva") : "Indisponível"}</dd>
        </div>
        <div>
          <dt className="text-xs text-sutil">Parado por um evento com falha</dt>
          <dd className="font-semibold">{!w ? "Indisponível" : w.blockedByFailedEvent ? "Sim, exige atenção" : "Não"}</dd>
        </div>
      </dl>
      {atencao && <p className="text-sm text-alerta">Há eventos com falha, em revisão ou o processador parou. Leve estes números ao suporte técnico.</p>}
    </Recolhivel>
  );
}
