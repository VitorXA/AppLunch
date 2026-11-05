import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { IMAGE, startTestServer, student } from './helpers.js';

describe('painel administrativo', () => {
  let t;
  before(async () => {
    t = await startTestServer();
  });
  after(() => t.close());

  test('aluno não acessa rotas de admin', async () => {
    const api = t.client();
    await api('POST', '/api/auth/register', student(1));
    assert.equal((await api('GET', '/api/admin/meals')).status, 403);
    assert.equal((await api('DELETE', '/api/admin/users/1/face', {})).status, 403);
  });

  test('admin vê os registros do dia com totais', async () => {
    const alunoApi = t.client();
    await alunoApi('POST', '/api/auth/register', student(2));
    await alunoApi('POST', '/api/face/enroll', { image: IMAGE, consent: true });
    assert.equal((await alunoApi('POST', '/api/meals/checkin', { image: IMAGE })).status, 201);

    const { identifier, password } = await t.createAdmin();
    const adminApi = t.client();
    assert.equal((await adminApi('POST', '/api/auth/login', { identifier, password })).status, 200);

    const res = await adminApi('GET', '/api/admin/meals');
    assert.equal(res.status, 200);
    assert.equal(res.data.date, '2026-11-05');
    assert.equal(res.data.totals.lunch, 1);
    assert.equal(res.data.entries[0].identifier, 'aluno2');
    assert.equal(res.data.entries[0].mealType, 'lunch');

    const other = await adminApi('GET', '/api/admin/meals?date=2026-11-04');
    assert.equal(other.data.totals.lunch, 0);
    assert.equal((await adminApi('GET', '/api/admin/meals?date=ontem')).status, 422);
  });

  test('admin remove o rosto cadastrado de um aluno', async () => {
    const adminApi = t.client();
    await adminApi('POST', '/api/auth/login', { identifier: 'admin', password: 'admin-password' });
    const id = t.db.prepare('SELECT id FROM users WHERE identifier = ?').get('aluno2').id;
    assert.equal((await adminApi('DELETE', `/api/admin/users/${id}/face`, {})).status, 200);
    assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM face_templates WHERE user_id = ?').get(id).n, 0);
    assert.equal((await adminApi('DELETE', '/api/admin/users/9999/face', {})).status, 404);
  });
});
