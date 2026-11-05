import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startTestServer, student } from './helpers.js';

describe('autenticação', () => {
  let t;
  before(async () => {
    t = await startTestServer();
  });
  after(() => t.close());

  test('cadastro cria o usuário, inicia a sessão e nunca devolve a senha', async () => {
    const api = t.client();
    const res = await api('POST', '/api/auth/register', { ...student(1), email: 'aluno1@example.com' });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.identifier, 'aluno1');
    assert.equal(res.data.user.role, 'student');
    assert.ok(!JSON.stringify(res.data).includes('password'));
    assert.match(res.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);

    const me = await api('GET', '/api/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user.name, 'Aluno 1');
    assert.equal(me.data.faceEnrolled, false);
  });

  test('a senha é guardada com hash, não em texto puro', async () => {
    const row = t.db.prepare('SELECT password_hash FROM users WHERE identifier = ?').get('aluno1');
    assert.match(row.password_hash, /^scrypt\$/);
    assert.ok(!row.password_hash.includes(student(1).password));
  });

  test('rejeita matrícula duplicada (sem diferenciar maiúsculas)', async () => {
    const res = await t.client()('POST', '/api/auth/register', { ...student(1), identifier: 'ALUNO1' });
    assert.equal(res.status, 409);
    assert.equal(res.data.error, 'identifier_taken');
  });

  test('valida campos do cadastro', async () => {
    const api = t.client();
    const cases = [
      [{ ...student(2), password: '123' }, 'weak_password'],
      [{ ...student(2), identifier: 'a b' }, 'invalid_identifier'],
      [{ ...student(2), name: 'x' }, 'invalid_name'],
      [{ ...student(2), email: 'nao-e-email' }, 'invalid_email'],
    ];
    for (const [body, code] of cases) {
      const res = await api('POST', '/api/auth/register', body);
      assert.equal(res.status, 422, code);
      assert.equal(res.data.error, code);
    }
  });

  test('login com senha errada e com usuário inexistente dão a mesma resposta', async () => {
    const api = t.client();
    const wrong = await api('POST', '/api/auth/login', { identifier: 'aluno1', password: 'errada-errada' });
    const ghost = await api('POST', '/api/auth/login', { identifier: 'fantasma', password: 'errada-errada' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.data, ghost.data);
  });

  test('login correto + logout invalida a sessão', async () => {
    const api = t.client();
    const login = await api('POST', '/api/auth/login', { identifier: 'aluno1', password: student(1).password });
    assert.equal(login.status, 200);
    assert.equal((await api('GET', '/api/me')).status, 200);
    await api('POST', '/api/auth/logout', {});
    assert.equal((await api('GET', '/api/me')).status, 401);
  });

  test('rotas protegidas exigem sessão', async () => {
    const api = t.client();
    assert.equal((await api('GET', '/api/me')).status, 401);
    assert.equal((await api('POST', '/api/meals/checkin', { image: 'x' })).status, 401);
    assert.equal((await api('GET', '/api/admin/meals')).status, 401);
  });

  test('exige Content-Type JSON em requisições que alteram estado (proteção CSRF)', async () => {
    const res = await fetch(t.baseUrl + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ identifier: 'aluno1', password: student(1).password }),
    });
    assert.equal(res.status, 415);
  });

  test('bloqueia tentativas excessivas de login', async () => {
    const api = t.client();
    let last;
    for (let i = 0; i < 12; i++) {
      last = await api('POST', '/api/auth/login', { identifier: 'alvo', password: 'errada-errada' });
    }
    assert.equal(last.status, 429);
  });
});

describe('cadastro restrito', () => {
  test('código de convite é exigido quando configurado', async () => {
    const t = await startTestServer({ config: { registrationCode: 'turma-2026' } });
    try {
      const api = t.client();
      const sem = await api('POST', '/api/auth/register', student(1));
      assert.equal(sem.status, 403);
      assert.equal(sem.data.error, 'invalid_invite_code');
      const com = await api('POST', '/api/auth/register', { ...student(1), inviteCode: 'turma-2026' });
      assert.equal(com.status, 201);
    } finally {
      await t.close();
    }
  });

  test('cadastro pode ser fechado', async () => {
    const t = await startTestServer({ config: { registrationOpen: false } });
    try {
      const res = await t.client()('POST', '/api/auth/register', student(1));
      assert.equal(res.status, 403);
      assert.equal(res.data.error, 'registration_closed');
    } finally {
      await t.close();
    }
  });
});
