import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import {
  LEGACY_PAYMENT_CONFIG_ID,
  PaymentConfigError,
  createAutomaticLot,
  getActivePaymentConfig,
  parseAutomaticLotUpdate,
  parseLotOpeningTime,
  serializePaymentConfig,
  updateAutomaticLot,
} from "../payment-config-repository.ts";

interface FindCall {
  collection: string;
  filter: unknown;
  options: unknown;
}

function createFakeDb(findResults: unknown[], updateResult = { matchedCount: 1 }) {
  const findCalls: FindCall[] = [];
  const updateCalls: Array<{
    collection: string;
    filter: unknown;
    update: unknown;
    options: unknown;
  }> = [];
  const collections: string[] = [];

  const db = {
    collection(name: string) {
      collections.push(name);
      return {
        async findOne(filter: unknown, options: unknown) {
          findCalls.push({ collection: name, filter, options });
          return findResults.shift() ?? null;
        },
        async updateOne(filter: unknown, update: unknown, options: unknown) {
          updateCalls.push({ collection: name, filter, update, options });
          return updateResult;
        },
      };
    },
  };

  return { db, findCalls, updateCalls, collections };
}

function withEditionEnvironment(
  paymentEdition: string | undefined,
  aliasEdition: string | undefined,
  callback: () => Promise<void>,
) {
  const previousPayment = process.env.PAYMENT_EDITION_ID;
  const previousAlias = process.env.COEPS_ACTIVE_EDITION_ID;
  if (paymentEdition === undefined) delete process.env.PAYMENT_EDITION_ID;
  else process.env.PAYMENT_EDITION_ID = paymentEdition;
  if (aliasEdition === undefined) delete process.env.COEPS_ACTIVE_EDITION_ID;
  else process.env.COEPS_ACTIVE_EDITION_ID = aliasEdition;

  return callback().finally(() => {
    if (previousPayment === undefined) delete process.env.PAYMENT_EDITION_ID;
    else process.env.PAYMENT_EDITION_ID = previousPayment;
    if (previousAlias === undefined) delete process.env.COEPS_ACTIVE_EDITION_ID;
    else process.env.COEPS_ACTIVE_EDITION_ID = previousAlias;
  });
}

const firstLot = {
  codigo: 1,
  nome: "Primeiro lote",
  limiteVagas: 100,
  precos: {
    valorPix: 220,
    valorBoleto: 225,
    valorDebito: 230,
    valorAVista: 235,
    parcelamentos: [
      { codigo: 1, totalParcelas: 1, valorCadaParcela: 235 },
    ],
  },
};

const secondLot = {
  codigo: 2,
  nome: "Segundo lote",
  limiteVagas: 150,
  precos: {
    valorPix: 249,
    valorBoleto: 250,
    valorDebito: 251,
    valorAVista: 252,
    parcelamentos: [
      { codigo: 2, totalParcelas: 2, valorCadaParcela: 130 },
    ],
  },
};

function automaticConfig(id = new ObjectId()) {
  return {
    _id: id,
    edicaoId: "CIEPS-2026",
    ativo: true,
    modo: "automatico",
    configuracaoLotesAutomaticos: {
      lotes: [structuredClone(firstLot), structuredClone(secondLot)],
    },
  };
}

test("PAYMENT_EDITION_ID tem prioridade e a seleção explícita falha fechada", async () => {
  await withEditionEnvironment("  cieps-2026  ", "OUTRA-EDICAO", async () => {
    const fake = createFakeDb([null]);
    assert.equal(await getActivePaymentConfig(fake.db as never), null);
    assert.equal(fake.findCalls.length, 1);
    assert.deepEqual(fake.findCalls[0].filter, {
      edicaoId: "CIEPS-2026",
      ativo: true,
    });
  });
});

test("COEPS_ACTIVE_EDITION_ID é usado quando a variável principal está ausente", async () => {
  await withEditionEnvironment(undefined, " cieps-2027 ", async () => {
    const config = automaticConfig();
    config.edicaoId = "CIEPS-2027";
    const fake = createFakeDb([config]);
    assert.equal(await getActivePaymentConfig(fake.db as never), config);
    assert.deepEqual(fake.findCalls[0].filter, {
      edicaoId: "CIEPS-2027",
      ativo: true,
    });
  });
});

test("sem edição explícita seleciona o ativo mais recente por updatedAt e dataInit", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const config = automaticConfig();
    const fake = createFakeDb([config]);
    assert.equal(await getActivePaymentConfig(fake.db as never), config);
    assert.deepEqual(fake.findCalls[0], {
      collection: "ingressos_config",
      filter: { ativo: true },
      options: {
        sort: { updatedAt: -1, dataInit: -1 },
        session: undefined,
      },
    });
  });
});

test("usa o documento legado somente quando não há configuração ativa", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const legacy = { _id: new ObjectId(LEGACY_PAYMENT_CONFIG_ID), nome: "Legado" };
    const fake = createFakeDb([null, legacy]);
    assert.equal(await getActivePaymentConfig(fake.db as never), legacy);
    assert.deepEqual(fake.findCalls[1].filter, {
      _id: new ObjectId(LEGACY_PAYMENT_CONFIG_ID),
      $or: [{ ativo: true }, { ativo: { $exists: false } }],
    });
  });
});

test("serializa a leitura preservando lotes, preços e parcelamentos automáticos", () => {
  const config = automaticConfig();
  const serialized = serializePaymentConfig(config as never);
  assert.equal(serialized._id, String(config._id));
  assert.deepEqual(
    serialized.configuracaoLotesAutomaticos?.lotes,
    [firstLot, secondLot],
  );
  assert.equal(serialized.modo, "automatico");
});

test("atualiza somente o lote solicitado usando o mesmo documento carregado", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const config = automaticConfig();
    const fake = createFakeDb([config]);
    const input = {
      configId: String(config._id),
      loteCodigo: 2,
      lote: {
        nome: "Segundo lote atualizado",
        limiteVagas: 175,
        precos: {
          valorPix: 260,
          valorBoleto: 261,
          valorDebito: 262,
          valorAVista: 263,
          parcelamentos: [
            { codigo: 3, totalParcelas: 3, valorCadaParcela: 90 },
          ],
        },
      },
    };

    const result = await updateAutomaticLot(fake.db as never, input, "admin-1");
    assert.deepEqual(result, { codigo: 2, ...input.lote });
    assert.equal(fake.updateCalls.length, 1);
    assert.deepEqual(fake.updateCalls[0].filter, {
      _id: config._id,
      modo: "automatico",
      "configuracaoLotesAutomaticos.lotes": { $elemMatch: { codigo: 2 } },
    });
    assert.deepEqual(fake.updateCalls[0].options, {
      arrayFilters: [{ "lot.codigo": 2 }],
    });
    const update = fake.updateCalls[0].update as { $set: Record<string, unknown> };
    assert.equal(
      update.$set["configuracaoLotesAutomaticos.lotes.$[lot].nome"],
      "Segundo lote atualizado",
    );
    assert.deepEqual(
      update.$set["configuracaoLotesAutomaticos.lotes.$[lot].precos"],
      input.lote.precos,
    );
    assert.equal("configuracaoLotesAutomaticos.lotes" in update.$set, false);
    assert.equal(JSON.stringify(update).includes("Primeiro lote"), false);
    assert.deepEqual(new Set(fake.collections), new Set(["ingressos_config"]));
  });
});

test("rejeita payloads automáticos inválidos sem consultar o banco", () => {
  const id = String(new ObjectId());
  const valid = {
    configId: id,
    loteCodigo: 1,
    lote: {
      nome: "Lote",
      limiteVagas: 10,
      precos: {
        valorPix: 1,
        valorBoleto: 1,
        valorDebito: 1,
        valorAVista: 1,
        parcelamentos: [{ codigo: 1, totalParcelas: 1, valorCadaParcela: 1 }],
      },
    },
  };
  const invalidPayloads = [
    { ...valid, configId: "inválido" },
    { ...valid, loteCodigo: -1 },
    { ...valid, lote: { ...valid.lote, nome: "   " } },
    { ...valid, lote: { ...valid.lote, limiteVagas: 0 } },
    { ...valid, lote: { ...valid.lote, limiteVagas: 1.5 } },
    {
      ...valid,
      lote: {
        ...valid.lote,
        precos: { ...valid.lote.precos, valorPix: Number.NaN },
      },
    },
    {
      ...valid,
      lote: {
        ...valid.lote,
        precos: { ...valid.lote.precos, valorPix: Number.POSITIVE_INFINITY },
      },
    },
    {
      ...valid,
      lote: {
        ...valid.lote,
        precos: { ...valid.lote.precos, valorPix: -1 },
      },
    },
    {
      ...valid,
      lote: {
        ...valid.lote,
        precos: {
          ...valid.lote.precos,
          parcelamentos: [
            { codigo: 1, totalParcelas: 1, valorCadaParcela: 1 },
            { codigo: 1, totalParcelas: 2, valorCadaParcela: 1 },
          ],
        },
      },
    },
    {
      ...valid,
      lote: {
        ...valid.lote,
        precos: {
          ...valid.lote.precos,
          parcelamentos: [{ codigo: 1, totalParcelas: 0, valorCadaParcela: 1 }],
        },
      },
    },
  ];

  for (const payload of invalidPayloads) {
    assert.equal(parseAutomaticLotUpdate(payload), null);
  }
});

test("rejeita tela obsoleta antes de qualquer atualização", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const config = automaticConfig();
    const fake = createFakeDb([config]);
    await assert.rejects(
      updateAutomaticLot(
        fake.db as never,
        {
          configId: String(new ObjectId()),
          loteCodigo: 1,
          lote: {
            nome: firstLot.nome,
            limiteVagas: firstLot.limiteVagas,
            precos: firstLot.precos,
          },
        },
        "admin-1",
      ),
      (error: unknown) =>
        error instanceof PaymentConfigError && error.code === "stale_payment_config",
    );
    assert.equal(fake.updateCalls.length, 0);
  });
});

test("rejeita códigos de lote existentes duplicados sem sobrescrever lotes", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const config = automaticConfig();
    config.configuracaoLotesAutomaticos.lotes[1].codigo = 1;
    const fake = createFakeDb([config]);
    await assert.rejects(
      updateAutomaticLot(
        fake.db as never,
        {
          configId: String(config._id),
          loteCodigo: 1,
          lote: {
            nome: firstLot.nome,
            limiteVagas: firstLot.limiteVagas,
            precos: firstLot.precos,
          },
        },
        "admin-1",
      ),
      (error: unknown) =>
        error instanceof PaymentConfigError &&
        error.code === "invalid_existing_lot_codes",
    );
    assert.equal(fake.updateCalls.length, 0);
  });
});

const newLotInput = {
  nome: "Quarto lote",
  limiteVagas: 35,
  precos: {
    valorPix: 370,
    valorBoleto: 370,
    valorDebito: 370,
    valorAVista: 370,
    parcelamentos: [
      { codigo: 225, totalParcelas: 1, valorCadaParcela: 370 },
      { codigo: 456, totalParcelas: 3, valorCadaParcela: 123.33 },
    ],
  },
};

test("lê o horário de abertura como Brasília e recusa formatos ambíguos", () => {
  assert.equal(parseLotOpeningTime("2026-11-10T12:30"), "2026-11-10T15:30:00.000Z");
  assert.equal(parseLotOpeningTime("2026-11-10T12:30:15"), "2026-11-10T15:30:15.000Z");
  assert.equal(parseLotOpeningTime("2026-11-10T15:30:00.000Z"), "2026-11-10T15:30:00.000Z");
  assert.equal(parseLotOpeningTime("2026-11-10T12:30:00-03:00"), "2026-11-10T15:30:00.000Z");
  assert.equal(parseLotOpeningTime(null), null);
  assert.equal(parseLotOpeningTime(""), null);
  for (const invalid of ["2026-11-10", "amanhã", "2026-13-40T99:99", 1731250200000, {}]) {
    assert.equal(parseLotOpeningTime(invalid), undefined);
  }
});

test("cria lote no fim da lista com código seguinte e trava de horário", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const config = automaticConfig();
    const fake = createFakeDb([config]);

    const result = await createAutomaticLot(
      fake.db as never,
      { configId: String(config._id), lote: { ...newLotInput, abreEm: "2026-11-10T12:30" } },
      "admin-1",
    );

    const expected = { codigo: 3, ...newLotInput, abreEm: "2026-11-10T15:30:00.000Z" };
    assert.deepEqual(result, expected);
    assert.equal(fake.updateCalls.length, 1);
    assert.deepEqual(fake.updateCalls[0].filter, {
      _id: config._id,
      modo: "automatico",
      "configuracaoLotesAutomaticos.lotes.codigo": { $ne: 3 },
    });
    const update = fake.updateCalls[0].update as {
      $push: Record<string, unknown>;
      $set: Record<string, unknown>;
    };
    assert.deepEqual(update.$push, { "configuracaoLotesAutomaticos.lotes": expected });
    assert.equal(update.$set.updatedBy, "admin-1");
    assert.ok(update.$set.updatedAt instanceof Date);
  });
});

test("cria lote sem trava sem gravar abreEm", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const config = automaticConfig();
    const fake = createFakeDb([config]);

    const result = await createAutomaticLot(
      fake.db as never,
      { configId: String(config._id), lote: { ...newLotInput, abreEm: null } },
      "admin-1",
    );

    assert.deepEqual(result, { codigo: 3, ...newLotInput });
    assert.equal("abreEm" in result, false);
  });
});

test("criação recusa tela obsoleta, horário inválido e corrida de códigos", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const stale = createFakeDb([automaticConfig()]);
    await assert.rejects(
      createAutomaticLot(stale.db as never, { configId: String(new ObjectId()), lote: newLotInput }, "admin-1"),
      (error: unknown) => error instanceof PaymentConfigError && error.code === "stale_payment_config",
    );
    assert.equal(stale.updateCalls.length, 0);

    const config = automaticConfig();
    const invalid = createFakeDb([config]);
    await assert.rejects(
      createAutomaticLot(
        invalid.db as never,
        { configId: String(config._id), lote: { ...newLotInput, abreEm: "10/11 12:30" } },
        "admin-1",
      ),
      (error: unknown) => error instanceof PaymentConfigError && error.code === "invalid_automatic_lot",
    );
    assert.equal(invalid.findCalls.length, 0);

    const raced = automaticConfig();
    const race = createFakeDb([raced], { matchedCount: 0 });
    await assert.rejects(
      createAutomaticLot(race.db as never, { configId: String(raced._id), lote: newLotInput }, "admin-1"),
      (error: unknown) => error instanceof PaymentConfigError && error.code === "automatic_lot_changed",
    );
  });
});

test("edição trava, destrava ou preserva o horário de abertura", async () => {
  await withEditionEnvironment(undefined, undefined, async () => {
    const baseInput = (abreEm?: string | null) => {
      const config = automaticConfig();
      const lote = { nome: firstLot.nome, limiteVagas: firstLot.limiteVagas, precos: firstLot.precos };
      return {
        config,
        input: {
          configId: String(config._id),
          loteCodigo: 1,
          lote: abreEm === undefined ? lote : { ...lote, abreEm },
        },
      };
    };
    const path = "configuracaoLotesAutomaticos.lotes.$[lot].abreEm";

    const locked = baseInput("2026-11-10T12:30");
    const lockedDb = createFakeDb([locked.config]);
    const lockedResult = await updateAutomaticLot(lockedDb.db as never, locked.input, "admin-1");
    const lockedUpdate = lockedDb.updateCalls[0].update as Record<string, Record<string, unknown>>;
    assert.equal(lockedUpdate.$set[path], "2026-11-10T15:30:00.000Z");
    assert.equal("$unset" in lockedUpdate, false);
    assert.equal(lockedResult.abreEm, "2026-11-10T15:30:00.000Z");

    const unlocked = baseInput(null);
    const unlockedDb = createFakeDb([unlocked.config]);
    await updateAutomaticLot(unlockedDb.db as never, unlocked.input, "admin-1");
    const unlockedUpdate = unlockedDb.updateCalls[0].update as Record<string, Record<string, unknown>>;
    assert.deepEqual(unlockedUpdate.$unset, { [path]: "" });
    assert.equal(path in unlockedUpdate.$set, false);

    const untouched = baseInput();
    const untouchedDb = createFakeDb([untouched.config]);
    await updateAutomaticLot(untouchedDb.db as never, untouched.input, "admin-1");
    const untouchedUpdate = untouchedDb.updateCalls[0].update as Record<string, Record<string, unknown>>;
    assert.equal("$unset" in untouchedUpdate, false);
    assert.equal(path in untouchedUpdate.$set, false);
  });
});
