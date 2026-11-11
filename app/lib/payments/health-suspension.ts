import type { Db } from "mongodb";
import { PAYMENT_CODES_COLLECTION } from "./payment-code-repository.ts";

export const HEALTH_PAYMENT_TYPE = "profissional_saude";
export const SUSPENDED_PAYMENT_STATUS = 3;
const SUSPENSION_REASON = "REPASSE_PENDENTE";

export interface HealthSuspensionCounts {
  ativos: number;
  suspensos: number;
  codigosBloqueados: number;
}

export interface HealthSuspensionResult {
  usuarios: number;
  codigos: number;
}

/** Suspende inscritos e bloqueia códigos livres; não toca em atribuições, comprovantes nem códigos usados. */
export async function suspendHealthProfessionals(
  db: Db,
  edicaoId: string,
  adminId: string,
  now = new Date(),
): Promise<HealthSuspensionResult> {
  const users = await db.collection("usuarios").updateMany(
    {
      "pagamento.tipo_pagamento": HEALTH_PAYMENT_TYPE,
      "pagamento.edicaoId": edicaoId,
      "pagamento.situacao": 1,
    },
    {
      $set: {
        "pagamento.situacao": SUSPENDED_PAYMENT_STATUS,
        "pagamento.suspensao": {
          ativa: true,
          motivo: SUSPENSION_REASON,
          suspensoEm: now,
          suspensoPor: adminId,
        },
      },
    },
  );
  const codes = await db.collection(PAYMENT_CODES_COLLECTION).updateMany(
    { edicaoId, perfilUtilizador: "PROFISSIONAL_SAUDE", status: "ATIVO" },
    { $set: { status: "INATIVO", inativadoPorSuspensao: true, updatedAt: now } },
  );
  return { usuarios: users.modifiedCount, codigos: codes.modifiedCount };
}

/** Reativa pela marca de suspensão (não pela situação) e só devolve os códigos que a suspensão bloqueou. */
export async function reactivateHealthProfessionals(
  db: Db,
  edicaoId: string,
  adminId: string,
  now = new Date(),
): Promise<HealthSuspensionResult> {
  const users = await db.collection("usuarios").updateMany(
    {
      "pagamento.tipo_pagamento": HEALTH_PAYMENT_TYPE,
      "pagamento.edicaoId": edicaoId,
      "pagamento.suspensao.ativa": true,
    },
    {
      $set: {
        "pagamento.situacao": 1,
        "pagamento.suspensao.ativa": false,
        "pagamento.suspensao.reativadoEm": now,
        "pagamento.suspensao.reativadoPor": adminId,
      },
    },
  );
  const codes = await db.collection(PAYMENT_CODES_COLLECTION).updateMany(
    {
      edicaoId,
      perfilUtilizador: "PROFISSIONAL_SAUDE",
      status: "INATIVO",
      inativadoPorSuspensao: true,
    },
    {
      $set: { status: "ATIVO", updatedAt: now },
      $unset: { inativadoPorSuspensao: "" },
    },
  );
  return { usuarios: users.modifiedCount, codigos: codes.modifiedCount };
}

export async function countHealthSuspension(
  db: Db,
  edicaoId: string,
): Promise<HealthSuspensionCounts> {
  const userBase = {
    "pagamento.tipo_pagamento": HEALTH_PAYMENT_TYPE,
    "pagamento.edicaoId": edicaoId,
  };
  const [ativos, suspensos, codigosBloqueados] = await Promise.all([
    db.collection("usuarios").countDocuments({ ...userBase, "pagamento.situacao": 1 }),
    db.collection("usuarios").countDocuments({ ...userBase, "pagamento.suspensao.ativa": true }),
    db.collection(PAYMENT_CODES_COLLECTION).countDocuments({
      edicaoId,
      perfilUtilizador: "PROFISSIONAL_SAUDE",
      status: "INATIVO",
      inativadoPorSuspensao: true,
    }),
  ]);
  return { ativos, suspensos, codigosBloqueados };
}
