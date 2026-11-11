import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { deleteUnusedCodes, MAX_BULK_CODE_DELETION, parseCodeIds } from "../code-deletion.ts";

const edition = "CIEPS-2026";

function code(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    edicaoId: edition,
    codigo: "D-CIEPS2026-X",
    codigoNormalizado: "DCIEPS2026X",
    tipo: "DESCONTO",
    status: "ATIVO",
    ...overrides,
  };
}

function fakeDb(codes: Record<string, any>[], usedIds: ObjectId[] = []) {
  const deleted: { filter: Record<string, any> }[] = [];
  const used = new Set(usedIds.map(String));
  const collection = (name: string) => ({
    find: () => ({ toArray: async () => codes }),
    countDocuments: async (filter: Record<string, any>) => {
      assert.equal(name, "pagamentos.atribuicoes");
      const ids: unknown[] = filter.$or[0]["codigoDesconto.codigoId"]?.$in ??
        filter.$or[0]["codigoRastreio.codigoId"]?.$in ?? [];
      return ids.some((id) => used.has(String(id))) ? 1 : 0;
    },
    deleteMany: async (filter: Record<string, any>) => {
      deleted.push({ filter });
      return { deletedCount: filter._id.$in.length };
    },
  });
  return { db: { collection } as never, deleted };
}

test("ids: aceita únicos e válidos, recusa vazio, inválido ou acima do limite", () => {
  const id = new ObjectId().toHexString();
  assert.equal(parseCodeIds([id, id])?.length, 1);
  assert.equal(parseCodeIds([]), null);
  assert.equal(parseCodeIds(["abc"]), null);
  assert.equal(parseCodeIds("abc"), null);
  const many = Array.from({ length: MAX_BULK_CODE_DELETION + 1 }, () => new ObjectId().toHexString());
  assert.equal(parseCodeIds(many), null);
});

test("exclui só os livres e explica cada código que ficou", async () => {
  const free = code();
  const used = code({ codigo: "USADO-1" });
  const reserved = code({ status: "RESERVADO", codigo: "RES-1" });
  const otherEdition = code({ edicaoId: "CIEPS-2025", codigo: "OLD-1" });
  const activeTracking = code({ tipo: "RASTREIO", codigo: "RAS-1" });
  const missing = new ObjectId();
  const { db, deleted } = fakeDb([free, used, reserved, otherEdition, activeTracking], [used._id]);

  const result = await deleteUnusedCodes(
    db,
    [free._id, used._id, reserved._id, otherEdition._id, activeTracking._id, missing],
    edition,
  );

  assert.equal(result.excluidos, 1);
  assert.deepEqual(deleted[0].filter._id.$in.map(String), [String(free._id)]);
  assert.deepEqual(deleted[0].filter.status, { $ne: "RESERVADO" });
  const reasons = Object.fromEntries(result.ignorados.map((item) => [item.codigo ?? item.id, item.motivo]));
  assert.match(reasons["USADO-1"], /compra/);
  assert.match(reasons["RES-1"], /reservado/);
  assert.match(reasons["OLD-1"], /outra edição/);
  assert.match(reasons["RAS-1"], /Desative/);
  assert.match(reasons[String(missing)], /não encontrado/);
});

test("não chama deleteMany quando nada pode ser excluído", async () => {
  const used = code();
  const { db, deleted } = fakeDb([used], [used._id]);
  const result = await deleteUnusedCodes(db, [used._id], edition);
  assert.equal(result.excluidos, 0);
  assert.equal(deleted.length, 0);
});
