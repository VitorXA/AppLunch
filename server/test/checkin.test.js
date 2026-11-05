import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { DINNER_TIME, IMAGE, LUNCH_TIME, startTestServer, student } from './helpers.js';

async function signedUp(t, n = 1) {
  const api = t.client();
  const res = await api('POST', '/api/auth/register', student(n));
  assert.equal(res.status, 201);
  return api;
}

describe('cadastro facial e registro de refeição', () => {
  let t;
  let verifyResult;
  before(async () => {
    verifyResult = { match: true, score: 0.93 };
    const recognizer = {
      name: 'fake',
      enroll: async () => ({ template: 'tpl-1' }),
      verify: async ({ template }) => {
        assert.equal(template, 'tpl-1'); // o template salvo é repassado ao provedor
        return verifyResult;
      },
    };
    t = await startTestServer({ recognizer });
  });
  after(() => t.close());

  test('check-in sem rosto cadastrado retorna 412', async () => {
    const api = await signedUp(t, 1);
    const res = await api('POST', '/api/meals/checkin', { image: IMAGE });
    assert.equal(res.status, 412);
    assert.equal(res.data.error, 'face_not_enrolled');
  });

  test('cadastro do rosto exige consentimento explícito', async () => {
    const api = await signedUp(t, 2);
    const res = await api('POST', '/api/face/enroll', { image: IMAGE });
    assert.equal(res.status, 422);
    assert.equal(res.data.error, 'consent_required');
  });

  test('rejeita imagem inválida', async () => {
    const api = await signedUp(t, 3);
    for (const image of ['', 'lixo', 'data:image/jpeg;base64,AAAA', 123]) {
      const res = await api('POST', '/api/face/enroll', { image, consent: true });
      assert.equal(res.status, 422, String(image));
      assert.equal(res.data.error, 'invalid_image');
    }
  });

  test('rejeita imagem grande demais', async () => {
    const api = await signedUp(t, 4);
    const big = 'data:image/jpeg;base64,' + Buffer.alloc(2_000_000, 0xff).toString('base64');
    const res = await api('POST', '/api/face/enroll', { image: big, consent: true });
    assert.equal(res.status, 413);
  });

  test('fluxo completo: cadastra rosto, registra refeição e bloqueia repetição no mesmo dia', async () => {
    const api = await signedUp(t, 5);
    const enroll = await api('POST', '/api/face/enroll', { image: IMAGE, consent: true });
    assert.equal(enroll.status, 201);
    assert.equal((await api('POST', '/api/face/enroll', { image: IMAGE, consent: true })).status, 409);

    const me = await api('GET', '/api/me');
    assert.equal(me.data.faceEnrolled, true);
    assert.equal(me.data.currentMeal, 'lunch');
    assert.equal(me.data.meals[0].doneToday, false);

    const first = await api('POST', '/api/meals/checkin', { image: IMAGE });
    assert.equal(first.status, 201);
    assert.equal(first.data.meal.id, 'lunch');
    assert.equal(first.data.date, '2026-11-05');

    const second = await api('POST', '/api/meals/checkin', { image: IMAGE });
    assert.equal(second.status, 409);
    assert.equal(second.data.error, 'already_checked_in');
    assert.equal((await api('GET', '/api/me')).data.meals[0].doneToday, true);

    // No dia seguinte a sessão (12h) já expirou; depois de logar de novo, pode almoçar.
    t.state.now = new Date(LUNCH_TIME.getTime() + 24 * 3600_000);
    try {
      assert.equal((await api('POST', '/api/meals/checkin', { image: IMAGE })).status, 401);
      await api('POST', '/api/auth/login', { identifier: 'aluno5', password: student(5).password });
      assert.equal((await api('POST', '/api/meals/checkin', { image: IMAGE })).status, 201);
    } finally {
      t.state.now = LUNCH_TIME;
    }
  });

  test('fora da janela de refeição retorna 422', async () => {
    const api = await signedUp(t, 6);
    await api('POST', '/api/face/enroll', { image: IMAGE, consent: true });
    t.state.now = DINNER_TIME;
    try {
      const res = await api('POST', '/api/meals/checkin', { image: IMAGE });
      assert.equal(res.status, 422);
      assert.equal(res.data.error, 'outside_meal_window');
    } finally {
      t.state.now = LUNCH_TIME;
    }
  });

  test('rosto que não confere retorna 403 e não registra a refeição', async () => {
    const api = await signedUp(t, 7);
    await api('POST', '/api/face/enroll', { image: IMAGE, consent: true });
    verifyResult = { match: false, score: 0.2 };
    try {
      const res = await api('POST', '/api/meals/checkin', { image: IMAGE });
      assert.equal(res.status, 403);
      assert.equal(res.data.error, 'face_mismatch');
      assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM meals WHERE user_id = (SELECT id FROM users WHERE identifier = ?)').get('aluno7').n, 0);
    } finally {
      verifyResult = { match: true, score: 0.93 };
    }
  });

  test('usuário apaga o próprio rosto (exige senha) e pode recadastrar', async () => {
    const api = await signedUp(t, 8);
    await api('POST', '/api/face/enroll', { image: IMAGE, consent: true });
    assert.equal((await api('DELETE', '/api/face', { password: 'senha-errada' })).status, 401);
    const del = await api('DELETE', '/api/face', { password: student(8).password });
    assert.equal(del.status, 200);
    assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM face_templates WHERE user_id = (SELECT id FROM users WHERE identifier = ?)').get('aluno8').n, 0);
    assert.equal((await api('POST', '/api/face/enroll', { image: IMAGE, consent: true })).status, 201);
  });
});

describe('janelas de refeição configuráveis', () => {
  test('várias refeições com fuso horário próprio', async () => {
    const meals = [
      { id: 'breakfast', label: 'Café', start: '07:00', end: '09:00' },
      { id: 'lunch', label: 'Almoço', start: '11:00', end: '14:00' },
    ];
    const t = await startTestServer({ config: { meals, timezone: 'America/Sao_Paulo' }, now: new Date('2026-11-05T10:30:00Z') });
    try {
      const api = await signedUp(t, 1);
      const me = await api('GET', '/api/me');
      assert.equal(me.data.currentMeal, 'breakfast'); // 07:30 em São Paulo
      assert.deepEqual(me.data.meals.map((m) => m.id), ['breakfast', 'lunch']);
    } finally {
      await t.close();
    }
  });
});
