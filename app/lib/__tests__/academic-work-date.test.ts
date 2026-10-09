import assert from 'node:assert/strict';
import test from 'node:test';
import { academicWorkDate } from '../academic-work-date.ts';

test('anexos antigos sem data não interrompem a renderização do admin', () => {
    for (const value of [undefined, null, '', 'inválida', {}, new Date(NaN)]) {
        assert.deepEqual(academicWorkDate(value), { iso: undefined, label: 'Data não disponível' });
    }
});
test('datas confirmadas mantêm datetime válido e horário de Brasília', () => {
    assert.deepEqual(academicWorkDate('2026-10-08T15:00:00Z'), {
        iso: '2026-10-08T15:00:00.000Z', label: '08/10/2026, 12:00:00',
    });
});
